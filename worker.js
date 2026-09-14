// ====================================================================
// WORKER FINAL — Load Balancer + VLESS + TCP + UDP Relay + MUX
//                  + Chained Proxy via Path
// ====================================================================
//
// Fitur:
//   1. Load balancer HTTP (race Promise.any + abort)
//   2. WebSocket sequential failover (bukan race, karena WS persisten)
//   3. Auth VLESS UUID (timing-safe)
//   4. Command TCP  → connect() Cloudflare langsung
//   5. Command UDP  → WebSocket ke VPS relay (protokol VLRLY004)
//   6. Command MUX  → TCP + UDP dalam satu WebSocket
//   7. Chained proxy → override target TCP dari path URL
//
// Alur:
//   Client ──wss──► Worker ──┬── TCP  → connect() ke target
//                            │   UDP  → WebSocket ke VPS ──► dgram ──► Target UDP
//                            │   MUX  → campuran TCP + UDP
//                            └── HTTP → race ke backend worker (load balancer)
// ====================================================================

import { connect } from 'cloudflare:sockets';

// ====================================================================
// BAGIAN 1 — KONFIGURASI
// ====================================================================

const CONFIG = Object.freeze({
    // ----------------------------------------------------------------
    // Auth: daftar UUID yang diterima
    // ----------------------------------------------------------------
    UUID_LIST: [
        '965ef141-21c6-4b93-bcbd-f22adfbcca85',
    ],

    // ----------------------------------------------------------------
    // VPS relay untuk UDP (protokol VLRLY004)
    // Port harus sama dengan LISTEN_PORT di index.js
    // ----------------------------------------------------------------
    VPS_RELAY_HOST: 'vps.contoh.com',   // ← GANTI dengan IP/domain VPS
    VPS_RELAY_PORT: 443,

    // ----------------------------------------------------------------
    // Backend worker untuk load balancer HTTP
    // ----------------------------------------------------------------
    WORKER_URLS: [
        'cf.bebas11.workers.dev',
        'cf.bebas9.workers.dev',
        'avaritia.elvinrakus.workers.dev',
        'id20.kbl.ccwu.cc',
        'id21.kbl.ccwu.cc',
        // ↓↓ TAMBAHKAN SISA DAFTAR ANDA DI SINI ↓↓
    ],

    // ----------------------------------------------------------------
    // Batas protokol
    // ----------------------------------------------------------------
    MAX_PACKET_LEN: 65535,
    MAX_PROTOCOL_HEADER: 4096,
    MAX_MUX_META_LEN: 512,

    // ----------------------------------------------------------------
    // Timeout
    // ----------------------------------------------------------------
    WEBSOCKET_HANDSHAKE_TIMEOUT_MS: 6000,

    // ----------------------------------------------------------------
    // Keamanan
    // ----------------------------------------------------------------
    REJECT_UDP_443: false,   // false = izinkan QUIC/STUN di port 443

    // ----------------------------------------------------------------
    // Load balancer HTTP
    // ----------------------------------------------------------------
    HTTP_BATCH_SIZE: 4,
});

// ====================================================================
// BAGIAN 2 — KONSTANTA PROTOKOL
// ====================================================================

// --- Protokol VLRLY004 (Worker ↔ VPS) ---
const VLRLY_MAGIC = new TextEncoder().encode('VLRLY004');
const VLRLY_MODE_FIXED_UDP = 0x01;
const VLRLY_MODE_MUX = 0x02;
const VLRLY_MODE_PACKET_UDP = 0x03;

// --- Address type (VLESS / SOCKS) ---
const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x02;
const ATYP_IPV6 = 0x03;

// --- Command VLESS ---
const CMD_TCP = 0x01;
const CMD_UDP = 0x02;
const CMD_MUX = 0x03;

// --- MUX status ---
const MUX_STATUS_NEW = 0x01;
const MUX_STATUS_KEEP = 0x02;
const MUX_STATUS_END = 0x03;
const MUX_STATUS_KEEPALIVE = 0x04;

// --- MUX option ---
const MUX_OPTION_DATA = 0x01;
const MUX_OPTION_ERROR = 0x02;

// --- MUX network ---
const MUX_NETWORK_TCP = 0x01;
const MUX_NETWORK_UDP = 0x02;

// --- UTF-8 strict decoder ---
const utf8Fatal = new TextDecoder('utf-8', { fatal: true });

// ====================================================================
// BAGIAN 3 — UTILITAS BINER & STRING
// ====================================================================

function concatUint8(...parts) {
    const list = parts.filter(p => p && p.byteLength);
    const total = list.reduce((sum, p) => sum + p.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of list) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
}

function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
}

function normalizeUUID(text) {
    const s = String(text || '').trim().toLowerCase();
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (!pattern.test(s)) {
        throw new Error('invalid UUID: ' + text);
    }
    return s;
}

function uuidToBytes(text) {
    return hexToBytes(normalizeUUID(text).replaceAll('-', ''));
}

function processVlessUUID(bytes) {
    const out = bytes.slice();
    out[6] = 0;
    out[7] = 0;
    return out;
}

function timingSafeEqual(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    let diff = 0;
    for (let i = 0; i < a.byteLength; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

function isValidUser(userBytes) {
    const got = processVlessUUID(userBytes);
    for (const uuidText of CONFIG.UUID_LIST) {
        try {
            const expected = processVlessUUID(uuidToBytes(uuidText));
            if (timingSafeEqual(got, expected)) return true;
        } catch (_) {
            // UUID tidak valid, lewati
        }
    }
    return false;
}

// ====================================================================
// BAGIAN 4 — KONVERSI ALAMAT
// ====================================================================

function ipv4ToBytes(address) {
    return new Uint8Array(String(address).split('.').map(Number));
}

function ipv6ToBytes(address) {
    let input = String(address).split('%')[0].toLowerCase();

    // Handle IPv4-mapped tail (contoh: ::ffff:1.2.3.4)
    const lastColon = input.lastIndexOf(':');
    if (input.includes('.') && lastColon >= 0) {
        const v4 = input.slice(lastColon + 1).split('.').map(Number);
        const tail = [
            ((v4[0] << 8) | v4[1]).toString(16),
            ((v4[2] << 8) | v4[3]).toString(16),
        ];
        input = input.slice(0, lastColon) + ':' + tail.join(':');
    }

    const halves = input.split('::');
    const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
    const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];
    const missing = 8 - left.length - right.length;
    const words = [
        ...left,
        ...Array(Math.max(0, missing)).fill('0'),
        ...right,
    ];

    const out = new Uint8Array(16);
    words.forEach((word, index) => {
        const n = parseInt(word, 16);
        out[index * 2] = (n >>> 8) & 0xff;
        out[index * 2 + 1] = n & 0xff;
    });
    return out;
}

function ipv6FromBytes(bytes) {
    const words = [];
    for (let i = 0; i < 16; i += 2) {
        words.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
    }
    return words.join(':');
}

function inferAddressType(host) {
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return ATYP_IPV4;
    if (host.includes(':')) return ATYP_IPV6;
    return ATYP_DOMAIN;
}

// ====================================================================
// BAGIAN 5 — PARSER ENDPOINT
// ====================================================================

function parseEndpoint(buffer, offset) {
    if (buffer.byteLength < offset + 3) return null;

    const port = (buffer[offset] << 8) | buffer[offset + 1];
    if (port === 0) throw new Error('endpoint has zero port');

    const atyp = buffer[offset + 2];
    let cursor = offset + 3;

    // --- IPv4 ---
    if (atyp === ATYP_IPV4) {
        if (buffer.byteLength < cursor + 4) return null;
        const host = `${buffer[cursor]}.${buffer[cursor + 1]}.${buffer[cursor + 2]}.${buffer[cursor + 3]}`;
        return { host, port, atyp, next: cursor + 4 };
    }

    // --- Domain ---
    if (atyp === ATYP_DOMAIN) {
        if (buffer.byteLength < cursor + 1) return null;
        const len = buffer[cursor++];
        if (!len || buffer.byteLength < cursor + len) return null;
        let host;
        try {
            host = utf8Fatal.decode(buffer.subarray(cursor, cursor + len));
        } catch (_) {
            throw new Error('endpoint has invalid UTF-8 domain');
        }
        return { host, port, atyp, next: cursor + len };
    }

    // --- IPv6 ---
    if (atyp === ATYP_IPV6) {
        if (buffer.byteLength < cursor + 16) return null;
        const host = ipv6FromBytes(buffer.subarray(cursor, cursor + 16));
        return { host, port, atyp, next: cursor + 16 };
    }

    throw new Error('unknown address type ' + atyp);
}

function encodeEndpoint(endpoint) {
    const port = endpoint.port;
    const head = new Uint8Array(3);
    head[0] = (port >>> 8) & 0xff;
    head[1] = port & 0xff;

    const atyp = endpoint.atyp || inferAddressType(endpoint.host);
    if (atyp === ATYP_IPV4) {
        head[2] = ATYP_IPV4;
        return concatUint8(head, ipv4ToBytes(endpoint.host));
    }
    if (atyp === ATYP_IPV6) {
        head[2] = ATYP_IPV6;
        return concatUint8(head, ipv6ToBytes(endpoint.host));
    }
    head[2] = ATYP_DOMAIN;
    const domainBytes = new TextEncoder().encode(endpoint.host);
    return concatUint8(head, new Uint8Array([domainBytes.byteLength]), domainBytes);
}

// ====================================================================
// BAGIAN 6 — PARSER HEADER VLESS
// ====================================================================

function parseVlessHeader(buffer) {
    if (buffer.byteLength < 18) return null;
    if (buffer[0] !== 0) return null;   // versi harus 0

    const user = buffer.slice(1, 17);   // 16 byte UUID
    const addonLength = buffer[17];
    const commandIndex = 18 + addonLength;

    if (buffer.byteLength < commandIndex + 1) return null;
    const command = buffer[commandIndex];

    // --- MUX: tidak punya target di header ---
    if (command === CMD_MUX) {
        return {
            user,
            command,
            target: null,
            headerLength: commandIndex + 1,
        };
    }

    // --- TCP / UDP: baca target ---
    if (command !== CMD_TCP && command !== CMD_UDP) return null;

    let cursor = commandIndex + 1;
    if (buffer.byteLength < cursor + 3) return null;

    const port = (buffer[cursor] << 8) | buffer[cursor + 1];
    cursor += 2;
    const atyp = buffer[cursor];

    const endpoint = parseEndpoint(buffer, cursor);
    if (!endpoint) return null;

    return {
        user,
        command,
        target: { host: endpoint.host, port, atyp },
        headerLength: endpoint.next,
    };
}

// ====================================================================
// BAGIAN 7 — PARSER PATH CHAINED PROXY
// ====================================================================

function isValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isValidHostname(host) {
    if (!host || host.length > 253) return false;

    // IPv4
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return host.split('.').every(n => Number(n) >= 0 && Number(n) <= 255);
    }

    // Domain (paling tidak ada satu titik dan TLD >= 2 huruf)
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+$/;
    return domainPattern.test(host);
}

function safeParseProxyAddress(value) {
    const text = String(value || '').trim();

    // --- [IPv6]:port ---
    const bracketMatch = text.match(/^\[([^\]]+)][:\-](\d+)$/);
    if (bracketMatch) {
        const port = Number(bracketMatch[2]);
        if (!isValidPort(port)) return null;
        return { hostname: bracketMatch[1], port };
    }

    // --- host:port atau host-port ---
    const genericMatch = text.match(/^(.+?)[:\-](\d+)$/);
    if (!genericMatch) return null;

    const hostname = genericMatch[1];
    const port = Number(genericMatch[2]);

    if (!isValidHostname(hostname)) return null;
    if (!isValidPort(port)) return null;

    return { hostname, port };
}

const PATH_PATTERNS = [
    // /vless/host:port atau /trojan/host-port dan sebagainya
    /^\/(vless|trojan|vmess|ss)\/(\[[^\]]+]:\d+|[^/]+?[:\-]\d+)\/?$/i,
    // /[ipv6]:port
    /^\/(\[[0-9a-fA-F:]+\]:\d+)\/?$/,
    // /host:port atau /host-port (paling umum)
    /^\/([a-zA-Z0-9._\-]+[:\-]\d+)\/?$/,
];

function parseChainedPath(pathname) {
    for (const pattern of PATH_PATTERNS) {
        const match = String(pathname || '').match(pattern);
        if (!match) continue;

        // Pattern pertama: protocol + address
        if (match.length === 3) {
            const proxyAddress = safeParseProxyAddress(match[2]);
            if (proxyAddress) {
                return {
                    protocol: match[1].toLowerCase(),
                    proxyAddress,
                };
            }
            continue;
        }

        // Pattern kedua/ketiga: address saja
        const proxyAddress = safeParseProxyAddress(match[1]);
        if (proxyAddress) {
            return { protocol: 'vless', proxyAddress };
        }
    }
    return null;
}

// ====================================================================
// BAGIAN 8 — KONEKSI KE VPS RELAY
// ====================================================================

function encodeFixedUdpHeader(target) {
    const port = target.port;
    const head = new Uint8Array(3);
    head[0] = (port >>> 8) & 0xff;
    head[1] = port & 0xff;

    const atyp = target.atyp || inferAddressType(target.host);

    if (atyp === ATYP_IPV4) {
        head[2] = ATYP_IPV4;
        return concatUint8(
            VLRLY_MAGIC,
            new Uint8Array([VLRLY_MODE_FIXED_UDP]),
            head,
            ipv4ToBytes(target.host)
        );
    }
    if (atyp === ATYP_IPV6) {
        head[2] = ATYP_IPV6;
        return concatUint8(
            VLRLY_MAGIC,
            new Uint8Array([VLRLY_MODE_FIXED_UDP]),
            head,
            ipv6ToBytes(target.host)
        );
    }
    head[2] = ATYP_DOMAIN;
    const domainBytes = new TextEncoder().encode(target.host);
    return concatUint8(
        VLRLY_MAGIC,
        new Uint8Array([VLRLY_MODE_FIXED_UDP]),
        head,
        new Uint8Array([domainBytes.byteLength]),
        domainBytes
    );
}

function encodeMuxHeader() {
    return concatUint8(VLRLY_MAGIC, new Uint8Array([VLRLY_MODE_MUX]));
}

async function openVpsRelay(initialHeader) {
    const url = `https://${CONFIG.VPS_RELAY_HOST}:${CONFIG.VPS_RELAY_PORT}/`;
    const response = await fetch(url, {
        headers: {
            Upgrade: 'websocket',
            Connection: 'Upgrade',
        },
    });

    if (!response.webSocket) {
        throw new Error('VPS relay tidak mengembalikan WebSocket');
    }

    const ws = response.webSocket;
    ws.accept();
    ws.send(initialHeader);
    return ws;
}

// ====================================================================
// BAGIAN 9 — FRAME MUX
// ====================================================================

function encodeMuxFrame(sessionId, status, option, data, network, endpoint) {
    const metaParts = [
        new Uint8Array([
            (sessionId >>> 8) & 0xff,
            sessionId & 0xff,
            status,
            option,
        ]),
    ];

    if (network) {
        metaParts.push(new Uint8Array([network]));
    }
    if (endpoint) {
        metaParts.push(encodeEndpoint(endpoint));
    }

    const meta = concatUint8(...metaParts);

    const frameParts = [
        new Uint8Array([(meta.byteLength >>> 8) & 0xff, meta.byteLength & 0xff]),
        meta,
    ];

    if ((option & MUX_OPTION_DATA) && data && data.byteLength) {
        frameParts.push(new Uint8Array([
            (data.byteLength >>> 8) & 0xff,
            data.byteLength & 0xff,
        ]));
        frameParts.push(data);
    }

    return concatUint8(...frameParts);
}

// ====================================================================
// BAGIAN 10 — HANDLER UTAMA SESI WEBSOCKET
// ====================================================================

async function handleSession(ws, routeInfo) {
    const buffered = [];

    // ---- Baca header VLESS ----
    const headerResult = await new Promise((resolve) => {
        const onMessage = (event) => {
            if (typeof event.data === 'string') return;

            const data = new Uint8Array(event.data);
            buffered.push(data);
            const all = concatUint8(...buffered);

            if (all.byteLength > CONFIG.MAX_PROTOCOL_HEADER) {
                ws.removeEventListener('message', onMessage);
                resolve({ error: 'protocol header terlalu besar' });
                return;
            }

            const header = parseVlessHeader(all);
            if (header) {
                ws.removeEventListener('message', onMessage);
                resolve({
                    header,
                    leftover: all.subarray(header.headerLength),
                });
            }
        };

        ws.addEventListener('message', onMessage);
        ws.addEventListener('close', () => resolve({ error: 'closed' }));
        ws.addEventListener('error', () => resolve({ error: 'error' }));
    });

    // ---- Handle error ----
    if (headerResult.error) {
        try { ws.close(1002, headerResult.error); } catch (_) {}
        return;
    }

    // ---- Auth ----
    if (!isValidUser(headerResult.header.user)) {
        try { ws.close(1008, 'auth failed'); } catch (_) {}
        return;
    }

    const { command, target } = headerResult.header;
    const leftover = headerResult.leftover;

    // ---- Dispatch ----
    if (command === CMD_TCP) {
        // Chained proxy HANYA untuk TCP
        const effectiveTarget = routeInfo?.proxyAddress
            ? {
                host: routeInfo.proxyAddress.hostname,
                port: routeInfo.proxyAddress.port,
                atyp: inferAddressType(routeInfo.proxyAddress.hostname),
            }
            : target;
        await serveTcp(ws, effectiveTarget, leftover);
    } else if (command === CMD_UDP) {
        // UDP selalu ke VPS relay (path diabaikan)
        await serveUdp(ws, target, leftover);
    } else if (command === CMD_MUX) {
        await serveMux(ws, leftover);
    } else {
        try { ws.close(1003, 'command tidak didukung'); } catch (_) {}
    }
}

// ====================================================================
// BAGIAN 11 — HANDLER TCP (connect langsung)
// ====================================================================

async function serveTcp(ws, target, leftover) {
    let socket;
    try {
        socket = connect({ hostname: target.host, port: target.port });
        await socket.opened;
    } catch (_) {
        try { ws.close(1011, 'connect gagal'); } catch (__) {}
        return;
    }

    let closed = false;
    const closeAll = () => {
        if (closed) return;
        closed = true;
        try { socket.close(); } catch (_) {}
        try { ws.close(); } catch (_) {}
    };

    // ---- Klien → TCP ----
    const clientToTcp = (async () => {
        try {
            const writer = socket.writable.getWriter();
            if (leftover.byteLength) {
                await writer.write(leftover);
            }
            await new Promise((resolve) => {
                const onMessage = async (event) => {
                    if (typeof event.data === 'string') return;
                    try {
                        await writer.write(new Uint8Array(event.data));
                    } catch (_) {
                        resolve();
                    }
                };
                ws.addEventListener('message', onMessage);
                ws.addEventListener('close', resolve);
                ws.addEventListener('error', resolve);
            });
            try { writer.releaseLock(); } catch (_) {}
        } catch (_) {}
    })();

    // ---- TCP → Klien ----
    const tcpToClient = (async () => {
        try {
            const reader = socket.readable.getReader();
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                try {
                    ws.send(value);
                } catch (_) {
                    break;
                }
            }
        } catch (_) {}
        closeAll();
    })();

    await Promise.race([clientToTcp, tcpToClient]);
    closeAll();
}

// ====================================================================
// BAGIAN 12 — HANDLER UDP (via VPS relay)
// ====================================================================

async function serveUdp(ws, target, leftover) {
    if (CONFIG.REJECT_UDP_443 && target.port === 443) {
        try { ws.close(1003, 'UDP/443 ditolak'); } catch (_) {}
        return;
    }

    let vpsWs;
    try {
        vpsWs = await openVpsRelay(encodeFixedUdpHeader(target));
    } catch (_) {
        try { ws.close(1011, 'VPS relay gagal'); } catch (__) {}
        return;
    }

    let closed = false;
    const closeAll = () => {
        if (closed) return;
        closed = true;
        try { ws.close(); } catch (_) {}
        try { vpsWs.close(); } catch (_) {}
    };

    // ---- Klien → VPS ----
    // VLESS UDP payload mentah → bungkus [panjang:2][payload] untuk VPS
    const sendToVps = (payload) => {
        if (!payload.byteLength || payload.byteLength > CONFIG.MAX_PACKET_LEN) return;
        const frame = new Uint8Array(2 + payload.byteLength);
        frame[0] = (payload.byteLength >>> 8) & 0xff;
        frame[1] = payload.byteLength & 0xff;
        frame.set(payload, 2);
        vpsWs.send(frame);
    };

    if (leftover.byteLength) sendToVps(leftover);

    ws.addEventListener('message', (event) => {
        if (closed) return;
        if (typeof event.data === 'string') return;
        try {
            sendToVps(new Uint8Array(event.data));
        } catch (_) {
            closeAll();
        }
    });
    ws.addEventListener('close', closeAll);
    ws.addEventListener('error', closeAll);

    // ---- VPS → Klien ----
    // VPS sudah bungkus [panjang:2][payload]; teruskan apa adanya
    vpsWs.addEventListener('message', (event) => {
        if (closed) return;
        if (typeof event.data === 'string') return;
        try {
            ws.send(event.data);
        } catch (_) {
            closeAll();
        }
    });
    vpsWs.addEventListener('close', closeAll);
    vpsWs.addEventListener('error', closeAll);
}

// ====================================================================
// BAGIAN 13 — HANDLER MUX (TCP + UDP dalam satu WebSocket)
// ====================================================================

async function serveMux(ws, leftover) {
    let vpsWs;
    try {
        vpsWs = await openVpsRelay(encodeMuxHeader());
    } catch (_) {
        try { ws.close(1011, 'VPS relay gagal'); } catch (__) {}
        return;
    }

    // Sesi aktif: id → { type: 'tcp'|'udp', socket? }
    const sessions = new Map();

    let closed = false;
    const closeAll = () => {
        if (closed) return;
        closed = true;
        for (const session of sessions.values()) {
            try { session.socket?.close?.(); } catch (_) {}
        }
        sessions.clear();
        try { ws.close(); } catch (_) {}
        try { vpsWs.close(); } catch (_) {}
    };

    // Buffer decoder
    let pending = leftover.byteLength ? leftover : new Uint8Array(0);

    const sendMuxBack = (sessionId, status, option, data) => {
        try {
            ws.send(encodeMuxFrame(sessionId, status, option, data));
        } catch (_) {
            closeAll();
        }
    };

    async function processFrames() {
        while (pending.byteLength >= 2) {
            const metaLength = (pending[0] << 8) | pending[1];
            if (metaLength < 4 || metaLength > CONFIG.MAX_MUX_META_LEN) {
                closeAll();
                return;
            }

            const metaEnd = 2 + metaLength;
            if (pending.byteLength < metaEnd) break;

            const meta = pending.subarray(2, metaEnd);
            const sessionId = (meta[0] << 8) | meta[1];
            const status = meta[2];
            const option = meta[3];

            let cursor = metaEnd;
            let data = new Uint8Array(0);

            if (option & MUX_OPTION_DATA) {
                if (pending.byteLength < cursor + 2) break;
                const dataLength = (pending[cursor] << 8) | pending[cursor + 1];
                if (pending.byteLength < cursor + 2 + dataLength) break;
                data = pending.subarray(cursor + 2, cursor + 2 + dataLength);
                cursor += 2 + dataLength;
            }

            const rawFrame = pending.subarray(0, cursor);
            pending = pending.subarray(cursor);

            // ---- STATUS: NEW ----
            if (status === MUX_STATUS_NEW) {
                const network = meta[4];
                const endpoint = parseEndpoint(meta, 5);
                if (!endpoint) {
                    closeAll();
                    return;
                }

                if (network === MUX_NETWORK_TCP) {
                    let socket;
                    try {
                        socket = connect({
                            hostname: endpoint.host,
                            port: endpoint.port,
                        });
                    } catch (_) {
                        sendMuxBack(sessionId, MUX_STATUS_END, MUX_OPTION_ERROR, null);
                        continue;
                    }
                    sessions.set(sessionId, { type: 'tcp', socket });

                    // TCP → MUX KEEP
                    (async () => {
                        try {
                            const reader = socket.readable.getReader();
                            while (true) {
                                const { value, done } = await reader.read();
                                if (done) break;
                                sendMuxBack(sessionId, MUX_STATUS_KEEP, MUX_OPTION_DATA, value);
                            }
                        } catch (_) {}
                        sendMuxBack(sessionId, MUX_STATUS_END, 0, null);
                        sessions.delete(sessionId);
                    })();

                } else if (network === MUX_NETWORK_UDP) {
                    sessions.set(sessionId, { type: 'udp' });
                    // Teruskan frame NEW apa adanya ke VPS
                    vpsWs.send(rawFrame);
                }
                continue;
            }

            // ---- STATUS: KEEP ----
            if (status === MUX_STATUS_KEEP) {
                const session = sessions.get(sessionId);
                if (!session) continue;

                if (session.type === 'tcp') {
                    if (data.byteLength) {
                        try {
                            const writer = session.socket.writable.getWriter();
                            await writer.write(data);
                            writer.releaseLock();
                        } catch (_) {}
                    }
                } else {
                    // UDP: teruskan ke VPS
                    vpsWs.send(rawFrame);
                }
                continue;
            }

            // ---- STATUS: END ----
            if (status === MUX_STATUS_END) {
                const session = sessions.get(sessionId);
                if (session?.type === 'tcp') {
                    try { session.socket.close(); } catch (_) {}
                } else if (session?.type === 'udp') {
                    vpsWs.send(rawFrame);
                }
                sessions.delete(sessionId);
                continue;
            }

            // ---- STATUS: KEEPALIVE ----
            if (status === MUX_STATUS_KEEPALIVE) {
                // Teruskan hanya untuk sesi UDP (menjaga XUDP grace di VPS)
                if (sessions.get(sessionId)?.type === 'udp') {
                    vpsWs.send(rawFrame);
                }
                continue;
            }
        }
    }

    // ---- Klien → Worker ----
    ws.addEventListener('message', (event) => {
        if (closed) return;
        if (typeof event.data === 'string') return;
        pending = concatUint8(pending, new Uint8Array(event.data));
        processFrames().catch(closeAll);
    });
    ws.addEventListener('close', closeAll);
    ws.addEventListener('error', closeAll);

    // ---- VPS → Klien (hanya frame UDP) ----
    vpsWs.addEventListener('message', (event) => {
        if (closed) return;
        if (typeof event.data === 'string') return;
        try {
            ws.send(event.data);
        } catch (_) {
            closeAll();
        }
    });
    vpsWs.addEventListener('close', closeAll);
    vpsWs.addEventListener('error', closeAll);
}

// ====================================================================
// BAGIAN 14 — LOAD BALANCER HTTP (race + abort)
// ====================================================================

async function httpFallback(request) {
    const url = new URL(request.url);
    const pathAndQuery = url.pathname + url.search;
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

    // ---- Shuffle daftar backend ----
    const shuffled = [...CONFIG.WORKER_URLS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const batchSize = CONFIG.HTTP_BATCH_SIZE;

    for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        const controller = new AbortController();

        const promises = batch.map(async (host) => {
            const targetUrl = `https://${host}${pathAndQuery}`;
            const sourceRequest = hasBody ? request.clone() : request;

            const modifiedRequest = new Request(targetUrl, {
                method: request.method,
                headers: new Headers(request.headers),
                body: hasBody ? sourceRequest.body : null,
                redirect: 'manual',
                signal: controller.signal,
            });

            const response = await fetch(modifiedRequest);
            if (response.status !== 429 && response.status < 500) {
                return response;
            }
            throw new Error('backend mengembalikan status ' + response.status);
        });

        try {
            const fastestResponse = await Promise.any(promises);
            controller.abort();
            return fastestResponse;
        } catch (_) {
            controller.abort();
            continue;
        }
    }

    return new Response('Semua backend worker tidak tersedia.', {
        status: 503,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Retry-After': '5',
        },
    });
}

// ====================================================================
// BAGIAN 15 — ENTRY POINT
// ====================================================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const routeInfo = parseChainedPath(url.pathname);

        const upgradeHeader = (request.headers.get('Upgrade') || '').toLowerCase();

        // ---- WebSocket: VLESS / UDP / MUX ----
        if (upgradeHeader === 'websocket') {
            const [clientSocket, serverSocket] = Object.values(new WebSocketPair());
            serverSocket.accept();

            ctx.waitUntil(
                handleSession(serverSocket, routeInfo).catch(() => {
                    try { serverSocket.close(1011, 'internal error'); } catch (_) {}
                })
            );

            return new Response(null, { status: 101, webSocket: clientSocket });
        }

        // ---- HTTP: load balancer ----
        return httpFallback(request);
    },
};