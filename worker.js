// ====================================================================
// WORKER FINAL — Load Balancer + VLESS + TCP + UDP Relay + MUX
//                  + Chained Proxy via Path
// ====================================================================
//
// Fitur:
//   1. Load balancer HTTP (race Promise.any + abort + anti unhandled)
//   2. Auth VLESS UUID (timing-safe)
//   3. Command TCP  → connect() Cloudflare langsung
//   4. Command UDP  → WebSocket ke VPS relay (protokol VLRLY004)
//   5. Command MUX  → TCP + UDP dalam satu WebSocket
//   6. Chained proxy → override target TCP dari path URL
// ====================================================================

import { connect } from 'cloudflare:sockets';

// ====================================================================
// KONFIGURASI
// ====================================================================

const CONFIG = Object.freeze({
    UUID_LIST: [
        '965ef141-21c6-4b93-bcbd-f22adfbcca85',
    ],

    // VPS relay untuk UDP (protokol VLRLY004)
    // Port harus sama dengan LISTEN_PORT di index.js
    VPS_RELAY_HOST: 'vps.contoh.com',   // ← GANTI dengan IP/domain VPS
    VPS_RELAY_PORT: 443,

    // Backend worker untuk load balancer HTTP
    WORKER_URLS: [
        'cf.bebas11.workers.dev',
        'cf.bebas9.workers.dev',
        'avaritia.elvinrakus.workers.dev',
        'urv-worker-cf.renaldisch.workers.dev',
        'cf.buatvpn.workers.dev',
        'cf.kebal1.workers.dev',
        'cf.osianne23.workers.dev',
        'wibu.wibucf6.workers.dev',
        'cf.yeyay736.workers.dev',
        'cf.andremith59.workers.dev',
        'fajar.masfajar0004.workers.dev',
        'cf.evintokes.workers.dev',
        'rizaxyz.uddyalsh4.workers.dev',
        'rizaxy.allieisozk96.workers.dev',
        'cf.rneohler.workers.dev',
        'cf.bebas12.workers.dev',
        'cf.bebas13.workers.dev',
        'cf.bebas14.workers.dev',
        'cf.bebas15.workers.dev',
        'cf.bebas16.workers.dev',
        'cf.bebas17.workers.dev',
        'cf.bebas18.workers.dev',
        'cf.bebas19.workers.dev',
        'my-worker.axwellllrich.workers.dev',
        'revenge.revenge02821.workers.dev',
        'dd-fathu.fathudede.workers.dev',
        'cf.manutin.workers.dev',
        'cf.janji1.workers.dev',
        'cf.janji2.workers.dev',
        'cf.janji3.workers.dev',
        'cf.janji5.workers.dev',
        'cf.janji6.workers.dev',
        'cf.janji7.workers.dev',
        'cf.janji8.workers.dev',
        'cf.janji9.workers.dev',
        'cf.janji10.workers.dev',
        'cf.sosiisspahit.workers.dev',
        'jokowi.hidupjokowi19.workers.dev',
        'rizaxy.udy18.workers.dev',
        'rizaxy.ett82.workers.dev',
        'rizaxy.ilton89.workers.dev',
        'rizaxy.entakin45.workers.dev',
        'rizaxy.eoerge.workers.dev',
        'rizaxy.heresa46.workers.dev',
        'rizaxy.oriseffler.workers.dev',
        'rizaxy.avonarber.workers.dev',
        'rizaxy.on59.workers.dev',
        'rizaxy.ohnnyeer.workers.dev',
        'cfgw.ennethuettgen.workers.dev',
        'cf.juangxx.workers.dev',
        'agus041114.agus041117.workers.dev',
        'rizaabc.immy48.workers.dev',
        'rizaabc.lejandralick.workers.dev',
        'rizaabc.eniferarter.workers.dev',
        'rizaabc.rittanyunde13.workers.dev',
        'rizaabc.shleyoyle.workers.dev',
        'bonchell.riyanjibril227.workers.dev',
        'yura.ontytracke.workers.dev',
        'rizabc.arianne38.workers.dev',
        'rizabcd.m4ptc5svia.workers.dev',
        'rizabcd.herwood35.workers.dev',
        'rizabcd.izeth83.workers.dev',
        'cf.haxil71864.workers.dev',
        'gmod.1a1.workers.dev',
        'rizabc.orbinriesen19.workers.dev',
        'rizabc.mmanuel79.workers.dev',
        'v4riza.hari24.workers.dev',
        'v4riza.oni10.workers.dev',
        'v4riza.erritt98.workers.dev',
        'v4riza.elipachoen7.workers.dev',
        'v4riza.ealreiger10.workers.dev',
        'v4riza.ridget88.workers.dev',
        'v4riza.essicaarisian.workers.dev',
        'v4riza.arshall94.workers.dev',
        'v4riza.oseseynolds.workers.dev',
        'v4riza.atthew32.workers.dev',
        'v4.sosiisspahit.workers.dev',
        'v4.agus041117.workers.dev',
        'v4trondol.herman60.workers.dev',
        'v4trondol.erson53.workers.dev',
        'v4trondol.laineeilly.workers.dev',
        'v4trondol.annerulauf.workers.dev',
        'v4trondol.arren50.workers.dev',
        'good.revenge02821.workers.dev',
        'v4.juangxx.workers.dev',
        'v4.clam25.workers.dev',
        'gas2.paidk.workers.dev',
        'gas2.goku1-653.workers.dev',
        'gas2.goku2-c51.workers.dev',
        'gas2.goku3-d78.workers.dev',
        'gas2.goku7.workers.dev',
        'gas2.goku25.workers.dev',
        'gas1.goku28.workers.dev',
        'gas2.goku24.workers.dev',
        'v4.urtangworth.workers.dev',
        'v4.homas18.workers.dev',
        'v4.atum34.workers.dev',
        'v4.nnaerde.workers.dev',
        'v4.athy60.workers.dev',
        'v4.ustinwift33.workers.dev',
        'v4nm.lifetime01.workers.dev',
        'v4nm.lifetime02.workers.dev',
        'v4nm.lifetime03.workers.dev',
        'v4nm.lifetime04.workers.dev',
        'v4nm.lifetime05.workers.dev',
        'v4nm.lifetime06.workers.dev',
        'v4nm.lifetime07.workers.dev',
        'v4nm.lifetime08.workers.dev',
        'v4nm.lifetime09.workers.dev',
        'v4nm.lifetime10.workers.dev',
        'v4nm.lifetime11.workers.dev',
        'v4nm.lifetime12.workers.dev',
        'v4nm.lifetime13.workers.dev',
        'v4nm.lifetime14.workers.dev',
        'v4nm.lifetime15.workers.dev',
        'v4nm.lifetime16.workers.dev',
        'v4nm.lifetime17.workers.dev',
        'v4nm.lifetime18.workers.dev',
        'v4nm.lifetime19.workers.dev',
        'v4nm.lifetime20.workers.dev',
        'v4nm.lifetime21.workers.dev',
        'v4nm.lifetime22.workers.dev',
        'v4nm.lifetime23.workers.dev',
        'v4nm.lifetime24.workers.dev',
        'v4nm.lifetime25.workers.dev',
        'v4nm.lifetime26.workers.dev',
        'v4nm.lifetime27.workers.dev',
        'v4nm.lifetime28.workers.dev',
        'v4nm.lifetime29.workers.dev',
        'v4nm.lifetime30.workers.dev',
        'v4nm.lifetime31.workers.dev',
        'v4nm.lifetime32.workers.dev',
        'v4nm.lifetime33.workers.dev',
        'v4nm.lifetime34.workers.dev',
        'v4nm.lifetime35.workers.dev',
        'v4nm.lifetime36.workers.dev',
        'v4nm.lifetime37.workers.dev',
        'v4nm.lifetime38.workers.dev',
        'v4nm.lifetime39.workers.dev',
        'v4nm.lifetime40.workers.dev',
        'v4nm.lifetime41.workers.dev',
        'v4nm.lifetime42.workers.dev',
        'v4nm.lifetime43.workers.dev',
        'v4nm.lifetime44.workers.dev',
        'v4nm.lifetime45.workers.dev',
        'v4nm.lifetime46.workers.dev',
        'v4nm.lifetime47.workers.dev',
        'v4nm.lifetime48.workers.dev',
        'v4nm.lifetime49.workers.dev',
        'v4nm.lifetime50.workers.dev',
        'v4nm.lifetime51.workers.dev',
        'v4nm.lifetime52.workers.dev',
        'v4nm.lifetime53.workers.dev',
        'v4nm.lifetime54.workers.dev',
        'v4nm.lifetime55.workers.dev',
        'v4nm.lifetime56.workers.dev',
        'v4nm.lifetime57.workers.dev',
        'v4nm.lifetime58.workers.dev',
        'v4nm.lifetime59.workers.dev',
        'v4nm.lifetime60.workers.dev',
        'v4nm.lifetime61.workers.dev',
        'v4nm.lifetime62.workers.dev',
        'v4nm.lifetime63.workers.dev',
        'v4nm.lifetime64.workers.dev',
        'v4nm.lifetime65.workers.dev',
        'v4nm.lifetime66.workers.dev',
        'v4nm.lifetime67.workers.dev',
        'v4nm.lifetime68.workers.dev',
        'v4nm.lifetime69.workers.dev',
        'v4nm.lifetime70.workers.dev',
        'v4nm.lifetime71.workers.dev',
        'v4nm.lifetime72.workers.dev',
        'v4nm.lifetime73.workers.dev',
        'v4nm.lifetime74.workers.dev',
        'v4nm.lifetime75.workers.dev',
        'v4nm.lifetime76.workers.dev',
        'v4nm.lifetime77.workers.dev',
        'v4nm.lifetime78.workers.dev',
        'v4riza.rew56.workers.dev',
        'v4riza.liaeil.workers.dev',
        'v4riza.aishaacobi.workers.dev',
        'v4riza.lonzo4.workers.dev',
        'v4riza.rma48.workers.dev',
        'v4riza.aleelorar.workers.dev',
        'v4riza.ascalechimmel42.workers.dev',
        'v4riza.raobel.workers.dev',
        'v4riza.eanaskolski40.workers.dev',
        'v4riza.bbie3.workers.dev',
        'v4riza.ricka28.workers.dev',
        'v4riza.erekbbott35.workers.dev',
        'v4riza.kyeickinson28.workers.dev',
        'freshv4.tera86654.workers.dev',
        'v4riza.ewayne5.workers.dev',
        'v4riza.raader.workers.dev',
        'v4riza.ozelle19.workers.dev',
        'v4riza.uellaerlach.workers.dev',
        'v4riza.aisy6.workers.dev',
        'v4riza.ony99.workers.dev',
        'v4riza.ahsaanobel46.workers.dev',
        'v4riza.lviseuschkeast.workers.dev',
        'v4riza.ay26.workers.dev',
        'v4riza.ash35.workers.dev',
        'v4riza.anda44.workers.dev',
        'v4riza.lbertaing82.workers.dev',
        'v4riza.hilusikowski21.workers.dev',
        'v4riza.einawaniawski79.workers.dev',
        'v4riza.lmailler74.workers.dev',
        'dimas-geo4.fahrulcrandy.workers.dev',
        'lenn-geo4.violent13125.workers.dev',
        'eginaailey.eginaailey.workers.dev',
        'geo4.mahardika.workers.dev',
        'geo4.masuk.workers.dev',
        'geo4.aiaooley.workers.dev',
        'g4riza.ribertoonnellyrady.workers.dev',
        'g4riza.eoffreyeil45.workers.dev',
        'g4riza.ellingtonalvorson.workers.dev',
        'g4riza.ack6.workers.dev',
        'g4riza.aqueltreich54.workers.dev',
        'g4riza.rmahanahan22.workers.dev',
        'g4riza.antosirthe33.workers.dev',
        'g4riza.raulio30.workers.dev',
        'g4riza.iolet0.workers.dev',
        'g4riza.unaacyver37.workers.dev',
        'modv4.mahardika.workers.dev',
        'revenge28.revenge02821.workers.dev',
        'vpn-node.sgmelbiskc.workers.dev',
        'dewi.dewianida8.workers.dev',
        'dewo.dewianida8.workers.dev',
        'custom.1a1.workers.dev',
        'ata.kukubukuku854.workers.dev',
        'modgeo.msabaru56.workers.dev',
        'taly.sgmelbiskc.workers.dev',
        'geomodv5.clam25.workers.dev',
        'vpn-node.lhubhuu321.workers.dev',
        'vpn-node.samuelkason673.workers.dev',
        'dewi8.dewianida8.workers.dev',
        'vpn-node.agus041117.workers.dev',
        'lll.agus041117.workers.dev',
        'v5geo.lifetime02.workers.dev',
        'v5geo.lifetime03.workers.dev',
        'v5geo.lifetime04.workers.dev',
        'v5geo.lifetime05.workers.dev',
        'v5geo.lifetime06.workers.dev',
        'v5geo.lifetime07.workers.dev',
        'v5geo.lifetime08.workers.dev',
        'v5geo.lifetime09.workers.dev',
        'v5geo.lifetime10.workers.dev',
        'v5geo.lifetime11.workers.dev',
        'v5geo.lifetime12.workers.dev',
        'v5geo.lifetime13.workers.dev',
        'v5geo.lifetime14.workers.dev',
        'v5geo.lifetime15.workers.dev',
        'v5geo.lifetime16.workers.dev',
        'v5geo.lifetime17.workers.dev',
        'v5geo.lifetime18.workers.dev',
        'v5geo.lifetime19.workers.dev',
        'v5geo.lifetime20.workers.dev',
        'v5geo.lifetime21.workers.dev',
        'v5geo.lifetime22.workers.dev',
        'v5geo.lifetime23.workers.dev',
        'v5geo.lifetime24.workers.dev',
        'v5geo.lifetime25.workers.dev',
        'v5geo.lifetime26.workers.dev',
        'v5geo.lifetime27.workers.dev',
        'v5geo.lifetime28.workers.dev',
        'v5geo.lifetime29.workers.dev',
        'v5geo.lifetime30.workers.dev',
        'v5geo.lifetime31.workers.dev',
        'v5geo.lifetime32.workers.dev',
        'v5geo.lifetime33.workers.dev',
        'v5geo.lifetime34.workers.dev',
        'v5geo.lifetime35.workers.dev',
        'v5geo.lifetime36.workers.dev',
        'v5geo.lifetime37.workers.dev',
        'v5geo.lifetime38.workers.dev',
        'v5geo.lifetime39.workers.dev',
        'v5geo.lifetime40.workers.dev',
        'v5geo.lifetime41.workers.dev',
        'v5geo.lifetime42.workers.dev',
        'v5geo.lifetime43.workers.dev',
        'v5geo.lifetime44.workers.dev',
        'v5geo.lifetime45.workers.dev',
        'v5geo.lifetime46.workers.dev',
        'v5geo.lifetime47.workers.dev',
        'v5geo.lifetime48.workers.dev',
        'v5geo.lifetime49.workers.dev',
        'v5geo.lifetime50.workers.dev',
        'v5geo.lifetime51.workers.dev',
        'v5geo.lifetime52.workers.dev',
        'v5geo.lifetime53.workers.dev',
        'v5geo.lifetime54.workers.dev',
        'v5geo.lifetime55.workers.dev',
        'v5geo.lifetime56.workers.dev',
        'v5geo.lifetime57.workers.dev',
        'v5geo.lifetime58.workers.dev',
        'v5geo.lifetime59.workers.dev',
        'v5geo.lifetime60.workers.dev',
        'v5geo.lifetime61.workers.dev',
        'v5geo.lifetime62.workers.dev',
        'v5geo.lifetime63.workers.dev',
        'v5geo.lifetime64.workers.dev',
        'v5geo.lifetime65.workers.dev',
        'v5geo.lifetime66.workers.dev',
        'v5geo.lifetime67.workers.dev',
        'v5geo.lifetime68.workers.dev',
        'v5geo.lifetime69.workers.dev',
        'v5geo.lifetime70.workers.dev',
        'v5geo.lifetime71.workers.dev',
        'v5geo.lifetime72.workers.dev',
        'v5geo.lifetime73.workers.dev',
        'v5geo.lifetime74.workers.dev',
        'v5geo.lifetime75.workers.dev',
        'v5geo.lifetime76.workers.dev',
        'v5geo.lifetime77.workers.dev',
        'v5geo.lifetime78.workers.dev',
        'masfajar.pages.dev',
        'we.masusilo.my.id',
        'nauutica.fengwhuut.workers.dev',
        'fengwhuut.fengwhuut.workers.dev',
        'vpn-geo.fengwhuut.workers.dev',
        'fenglikethis.fengwhuut.workers.dev',
        'vpn.fengwhuut.workers.dev',
        'cubatrytest.fengwhuut.workers.dev',
        'fng.fengwhuut.workers.dev',
        'geo.fengwhuut.workers.dev',
        'nauticamod.fengwhuut.workers.dev',
        'f32g.fengwhuut.workers.dev',
        'fgfg.fengvpn.workers.dev',
        'github.nizwara94-f3f.workers.dev',
        'kluwut.fengvpn.workers.dev',
        'vpn-wc.fengwhuut.workers.dev',
        'cf.fgfg.web.id',
        'cf-deploy.fengwhuut.workers.dev',
        'cf-dashboard.fengwhuut.workers.dev',
    ],

    MAX_PACKET_LEN: 65535,
    MAX_PROTOCOL_HEADER: 4096,
    MAX_MUX_META_LEN: 512,
    WEBSOCKET_HANDSHAKE_TIMEOUT_MS: 6000,
    REJECT_UDP_443: false,
    HTTP_BATCH_SIZE: 4,
});

// ====================================================================
// KONSTANTA PROTOKOL
// ====================================================================

const VLRLY_MAGIC = new TextEncoder().encode('VLRLY004');
const VLRLY_MODE_FIXED_UDP = 0x01;
const VLRLY_MODE_MUX = 0x02;

const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x02;
const ATYP_IPV6 = 0x03;

const CMD_TCP = 0x01;
const CMD_UDP = 0x02;
const CMD_MUX = 0x03;

const MUX_STATUS_NEW = 0x01;
const MUX_STATUS_KEEP = 0x02;
const MUX_STATUS_END = 0x03;
const MUX_STATUS_KEEPALIVE = 0x04;
const MUX_OPTION_DATA = 0x01;
const MUX_OPTION_ERROR = 0x02;
const MUX_NETWORK_TCP = 0x01;
const MUX_NETWORK_UDP = 0x02;

const utf8Fatal = new TextDecoder('utf-8', { fatal: true });

// ====================================================================
// UTILITAS BINER
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
    if (!pattern.test(s)) throw new Error('invalid UUID');
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
    for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

function isValidUser(userBytes) {
    const got = processVlessUUID(userBytes);
    for (const uuidText of CONFIG.UUID_LIST) {
        try {
            const expected = processVlessUUID(uuidToBytes(uuidText));
            if (timingSafeEqual(got, expected)) return true;
        } catch (_) {}
    }
    return false;
}

// ====================================================================
// KONVERSI ALAMAT
// ====================================================================

function ipv4ToBytes(address) {
    return new Uint8Array(String(address).split('.').map(Number));
}

function ipv6ToBytes(address) {
    let input = String(address).split('%')[0].toLowerCase();
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
    const words = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
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
// PARSER ENDPOINT
// ====================================================================

function parseEndpoint(buffer, offset) {
    if (buffer.byteLength < offset + 3) return null;
    const port = (buffer[offset] << 8) | buffer[offset + 1];
    if (port === 0) throw new Error('zero port');
    const atyp = buffer[offset + 2];
    let cursor = offset + 3;

    if (atyp === ATYP_IPV4) {
        if (buffer.byteLength < cursor + 4) return null;
        const host = `${buffer[cursor]}.${buffer[cursor + 1]}.${buffer[cursor + 2]}.${buffer[cursor + 3]}`;
        return { host, port, atyp, next: cursor + 4 };
    }
    if (atyp === ATYP_DOMAIN) {
        if (buffer.byteLength < cursor + 1) return null;
        const len = buffer[cursor++];
        if (!len || buffer.byteLength < cursor + len) return null;
        let host;
        try { host = utf8Fatal.decode(buffer.subarray(cursor, cursor + len)); }
        catch (_) { throw new Error('invalid UTF-8 domain'); }
        return { host, port, atyp, next: cursor + len };
    }
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
// PARSER HEADER VLESS
// ====================================================================

function parseVlessHeader(buffer) {
    if (buffer.byteLength < 18) return null;
    if (buffer[0] !== 0) return null;
    const user = buffer.slice(1, 17);
    const addonLength = buffer[17];
    const commandIndex = 18 + addonLength;
    if (buffer.byteLength < commandIndex + 1) return null;
    const command = buffer[commandIndex];

    if (command === CMD_MUX) {
        return { user, command, target: null, headerLength: commandIndex + 1 };
    }
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
// PARSER CHAINED PROXY PATH
// ====================================================================

function isValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isValidHostname(host) {
    if (!host || host.length > 253) return false;
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return host.split('.').every(n => Number(n) >= 0 && Number(n) <= 255);
    }
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+$/;
    return domainPattern.test(host);
}

function safeParseProxyAddress(value) {
    const text = String(value || '').trim();
    const bracketMatch = text.match(/^\[([^\]]+)][:\-](\d+)$/);
    if (bracketMatch) {
        const port = Number(bracketMatch[2]);
        if (!isValidPort(port)) return null;
        return { hostname: bracketMatch[1], port };
    }
    const genericMatch = text.match(/^(.+?)[:\-](\d+)$/);
    if (!genericMatch) return null;
    const hostname = genericMatch[1];
    const port = Number(genericMatch[2]);
    if (!isValidHostname(hostname)) return null;
    if (!isValidPort(port)) return null;
    return { hostname, port };
}

const PATH_PATTERNS = [
    /^\/(vless|trojan|vmess|ss)\/(\[[^\]]+]:\d+|[^/]+?[:\-]\d+)\/?$/i,
    /^\/(\[[0-9a-fA-F:]+\]:\d+)\/?$/,
    /^\/([a-zA-Z0-9._\-]+[:\-]\d+)\/?$/,
];

function parseChainedPath(pathname) {
    for (const pattern of PATH_PATTERNS) {
        const match = String(pathname || '').match(pattern);
        if (!match) continue;
        if (match.length === 3) {
            const proxyAddress = safeParseProxyAddress(match[2]);
            if (proxyAddress) return { protocol: match[1].toLowerCase(), proxyAddress };
            continue;
        }
        const proxyAddress = safeParseProxyAddress(match[1]);
        if (proxyAddress) return { protocol: 'vless', proxyAddress };
    }
    return null;
}

// ====================================================================
// KONEKSI KE VPS RELAY
// ====================================================================

function encodeFixedUdpHeader(target) {
    const port = target.port;
    const head = new Uint8Array(3);
    head[0] = (port >>> 8) & 0xff;
    head[1] = port & 0xff;
    const atyp = target.atyp || inferAddressType(target.host);

    if (atyp === ATYP_IPV4) {
        head[2] = ATYP_IPV4;
        return concatUint8(VLRLY_MAGIC, new Uint8Array([VLRLY_MODE_FIXED_UDP]), head, ipv4ToBytes(target.host));
    }
    if (atyp === ATYP_IPV6) {
        head[2] = ATYP_IPV6;
        return concatUint8(VLRLY_MAGIC, new Uint8Array([VLRLY_MODE_FIXED_UDP]), head, ipv6ToBytes(target.host));
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const url = `https://${CONFIG.VPS_RELAY_HOST}:${CONFIG.VPS_RELAY_PORT}/`;
        const response = await fetch(url, {
            headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.webSocket) throw new Error('VPS relay: no webSocket');
        const ws = response.webSocket;
        ws.accept();
        ws.send(initialHeader);
        return ws;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

// ====================================================================
// FRAME MUX
// ====================================================================

function encodeMuxFrame(sessionId, status, option, data) {
    const meta = new Uint8Array([
        (sessionId >>> 8) & 0xff,
        sessionId & 0xff,
        status,
        option,
    ]);
    const parts = [
        new Uint8Array([(meta.byteLength >>> 8) & 0xff, meta.byteLength & 0xff]),
        meta,
    ];
    if ((option & MUX_OPTION_DATA) && data && data.byteLength) {
        parts.push(new Uint8Array([(data.byteLength >>> 8) & 0xff, data.byteLength & 0xff]));
        parts.push(data);
    }
    return concatUint8(...parts);
}

// ====================================================================
// HANDLER SESI
// ====================================================================

async function handleSession(ws, routeInfo) {
    const buffered = [];

    const headerResult = await new Promise((resolve) => {
        let done = false;
        const finish = (val) => { if (!done) { done = true; resolve(val); } };
        const onMessage = (event) => {
            if (typeof event.data === 'string') return;
            const data = new Uint8Array(event.data);
            buffered.push(data);
            const all = concatUint8(...buffered);
            if (all.byteLength > CONFIG.MAX_PROTOCOL_HEADER) {
                ws.removeEventListener('message', onMessage);
                finish({ error: 'header too large' });
                return;
            }
            const header = parseVlessHeader(all);
            if (header) {
                ws.removeEventListener('message', onMessage);
                finish({ header, leftover: all.subarray(header.headerLength) });
            }
        };
        ws.addEventListener('message', onMessage);
        ws.addEventListener('close', () => finish({ error: 'closed' }));
        ws.addEventListener('error', () => finish({ error: 'error' }));
    });

    if (headerResult.error) {
        try { ws.close(1002, headerResult.error); } catch (_) {}
        return;
    }
    if (!isValidUser(headerResult.header.user)) {
        try { ws.close(1008, 'auth failed'); } catch (_) {}
        return;
    }

    const { command, target } = headerResult.header;
    const leftover = headerResult.leftover;

    if (command === CMD_TCP) {
        const effectiveTarget = routeInfo?.proxyAddress
            ? {
                host: routeInfo.proxyAddress.hostname,
                port: routeInfo.proxyAddress.port,
                atyp: inferAddressType(routeInfo.proxyAddress.hostname),
            }
            : target;
        await serveTcp(ws, effectiveTarget, leftover);
    } else if (command === CMD_UDP) {
        await serveUdp(ws, target, leftover);
    } else if (command === CMD_MUX) {
        await serveMux(ws, leftover);
    } else {
        try { ws.close(1003, 'command unsupported'); } catch (_) {}
    }
}

// ====================================================================
// HANDLER TCP (connect langsung)
// ====================================================================

async function serveTcp(ws, target, leftover) {
    let socket;
    try {
        socket = connect({ hostname: target.host, port: target.port });
        await socket.opened;
    } catch (_) {
        try { ws.close(1011, 'connect failed'); } catch (__) {}
        return;
    }

    let closed = false;
    const closeAll = () => {
        if (closed) return;
        closed = true;
        try { socket.close(); } catch (_) {}
        try { ws.close(); } catch (_) {}
    };

    const clientToTcp = (async () => {
        try {
            const writer = socket.writable.getWriter();
            if (leftover.byteLength) await writer.write(leftover);
            await new Promise((resolve) => {
                const onMessage = async (event) => {
                    if (closed) { resolve(); return; }
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

    const tcpToClient = (async () => {
        try {
            const reader = socket.readable.getReader();
            while (!closed) {
                const { value, done } = await reader.read();
                if (done) break;
                try { ws.send(value); } catch (_) { break; }
            }
        } catch (_) {}
        closeAll();
    })();

    try {
        await Promise.race([clientToTcp, tcpToClient]);
    } catch (_) {}
    closeAll();
}

// ====================================================================
// HANDLER UDP (via VPS relay)
// ====================================================================

async function serveUdp(ws, target, leftover) {
    if (CONFIG.REJECT_UDP_443 && target.port === 443) {
        try { ws.close(1003, 'udp/443 rejected'); } catch (_) {}
        return;
    }

    let vpsWs;
    try {
        vpsWs = await openVpsRelay(encodeFixedUdpHeader(target));
    } catch (_) {
        try { ws.close(1011, 'vps relay failed'); } catch (__) {}
        return;
    }

    let closed = false;
    const closeAll = () => {
        if (closed) return;
        closed = true;
        try { ws.close(); } catch (_) {}
        try { vpsWs.close(); } catch (_) {}
    };

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
        try { sendToVps(new Uint8Array(event.data)); }
        catch (_) { closeAll(); }
    });
    ws.addEventListener('close', closeAll);
    ws.addEventListener('error', closeAll);

    vpsWs.addEventListener('message', (event) => {
        if (closed) return;
        if (typeof event.data === 'string') return;
        try { ws.send(event.data); }
        catch (_) { closeAll(); }
    });
    vpsWs.addEventListener('close', closeAll);
    vpsWs.addEventListener('error', closeAll);
}

// ====================================================================
// HANDLER MUX
// ====================================================================

async function serveMux(ws, leftover) {
    let vpsWs;
    try {
        vpsWs = await openVpsRelay(encodeMuxHeader());
    } catch (_) {
        try { ws.close(1011, 'vps relay failed'); } catch (__) {}
        return;
    }

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

    let pending = leftover.byteLength ? leftover : new Uint8Array(0);

    const sendMuxBack = (sessionId, status, option, data) => {
        try { ws.send(encodeMuxFrame(sessionId, status, option, data)); }
        catch (_) { closeAll(); }
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

            if (status === MUX_STATUS_NEW) {
                const network = meta[4];
                const endpoint = parseEndpoint(meta, 5);
                if (!endpoint) { closeAll(); return; }

                if (network === MUX_NETWORK_TCP) {
                    let socket;
                    try {
                        socket = connect({ hostname: endpoint.host, port: endpoint.port });
                    } catch (_) {
                        sendMuxBack(sessionId, MUX_STATUS_END, MUX_OPTION_ERROR, null);
                        continue;
                    }
                    sessions.set(sessionId, { type: 'tcp', socket });

                    (async () => {
                        try {
                            const reader = socket.readable.getReader();
                            while (!closed) {
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
                    vpsWs.send(rawFrame);
                }
                continue;
            }

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
                    vpsWs.send(rawFrame);
                }
                continue;
            }

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

            if (status === MUX_STATUS_KEEPALIVE) {
                if (sessions.get(sessionId)?.type === 'udp') vpsWs.send(rawFrame);
                continue;
            }
        }
    }

    ws.addEventListener('message', (event) => {
        if (closed) return;
        if (typeof event.data === 'string') return;
        pending = concatUint8(pending, new Uint8Array(event.data));
        processFrames().catch(closeAll);
    });
    ws.addEventListener('close', closeAll);
    ws.addEventListener('error', closeAll);

    vpsWs.addEventListener('message', (event) => {
        if (closed) return;
        if (typeof event.data === 'string') return;
        try { ws.send(event.data); }
        catch (_) { closeAll(); }
    });
    vpsWs.addEventListener('close', closeAll);
    vpsWs.addEventListener('error', closeAll);
}

// ====================================================================
// LOAD BALANCER HTTP
// ====================================================================

async function httpFallback(request) {
    const url = new URL(request.url);
    const pathAndQuery = url.pathname + url.search;
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

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
            throw new Error('backend status ' + response.status);
        });

        // ⭐ KUNCI PERBAIKAN AbortError:
        // Tempel noop catch ke SETIAP promise supaya saat controller.abort()
        // dipanggil, promise yang kalah tidak menghasilkan unhandled rejection.
        for (const p of promises) {
            p.catch(() => { /* swallow */ });
        }

        try {
            const fastest = await Promise.any(promises);
            controller.abort();
            return fastest;
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
// ENTRY POINT
// ====================================================================

export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const routeInfo = parseChainedPath(url.pathname);

            const upgradeHeader = (request.headers.get('Upgrade') || '').toLowerCase();

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

            return await httpFallback(request);
        } catch (error) {
            return new Response('Worker error: ' + (error?.message || 'unknown'), {
                status: 500,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }
    },
};