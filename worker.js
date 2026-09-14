// ====================================================================
// WORKER v12 — COMPLETE SMART LB + AUTO-DETECT UDP RELAY
// ====================================================================
// Routing:
//   HTTP biasa          → Smart Load Balancer (batch hedging) — ASLI
//   WS + VLESS TCP      → Smart Load Balancer (batch hedging) — ASLI
//   WS + Trojan TCP     → Smart Load Balancer (batch hedging) — ASLI
//   WS + VLESS UDP      → Railway (VLRLY004 FIXED_UDP, passthrough)
//   WS + Trojan UDP     → Railway (VLRLY004 PACKET_UDP, translate)
//   WS + lainnya        → Smart Load Balancer (fallback)
// ====================================================================

import { connect } from 'cloudflare:sockets';

// ==================== KONFIGURASI RAILWAY ====================
const RAILWAY_HOST = 'roundhouse.proxy.rlwy.net';   // ← GANTI dengan host Railway
const RAILWAY_PORT = 34567;                         // ← GANTI dengan port TCP Proxy Railway
const RAILWAY_TLS  = false;                         // Railway TCP proxy = plain TCP

// ==================== PEEK TIMEOUT ====================
const PEEK_TIMEOUT_MS = 5000;

// ==================== VLRLY004 MAGIC ====================
const RELAY_MAGIC = new Uint8Array([0x56,0x4c,0x52,0x4c,0x59,0x30,0x30,0x34]);
const RELAY_MODE_FIXED_UDP  = 0x01;
const RELAY_MODE_PACKET_UDP = 0x03;

// ==================== DAFTAR WORKER BACKEND (LB) ====================
const WORKER_URLS = [
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
  'atadev.kukubukuku854.workers.dev',
  '2.hajijah.indevs.in',
  'v1.sultan.ccwu.cc',
  'v2.sultan.ccwu.cc',
  'v3.sultan.ccwu.cc',
  'v4.sultan.ccwu.cc',
  'v5.sultan.ccwu.cc',
  'v6.sultan.ccwu.cc',
  'v7.sultan.ccwu.cc',
  'v8.sultan.ccwu.cc',
  'v9.sultan.ccwu.cc',
  'v10.sultan.ccwu.cc',
  'v11.sultan.ccwu.cc',
  'v12.sultan.ccwu.cc',
  'v13.sultan.ccwu.cc',
  'v14.sultan.ccwu.cc',
  'v15.sultan.ccwu.cc',
  'v16.sultan.ccwu.cc',
  'v17.sultan.ccwu.cc',
  'v18.sultan.ccwu.cc',
  'v19.sultan.ccwu.cc',
  'v20.sultan.ccwu.cc',
  'v21.sultan.ccwu.cc',
  'v22.sultan.ccwu.cc',
  'v23.sultan.ccwu.cc',
  'v24.sultan.ccwu.cc',
  'v25.sultan.ccwu.cc',
  'v26.sultan.ccwu.cc',
  'v27.sultan.ccwu.cc',
  'v28.sultan.ccwu.cc',
  'v29.sultan.ccwu.cc',
  'v30.sultan.ccwu.cc',
  'v31.sultan.ccwu.cc',
  'v32.sultan.ccwu.cc',
  'v33.sultan.ccwu.cc',
  'v34.sultan.ccwu.cc',
  'v35.sultan.ccwu.cc',
  'v36.sultan.ccwu.cc',
  'v37.sultan.ccwu.cc',
  'v38.sultan.ccwu.cc',
  'v39.sultan.ccwu.cc',
  'v40.sultan.ccwu.cc',
  'my.cfvpn.my.id',
  'my1.cfvpn.my.id',
  'my2.cfvpn.my.id',
  'my3.cfvpn.my.id',
  'my4.cfvpn.my.id',
  'my5.cfvpn.my.id',
  'my6.cfvpn.my.id',
  'my7.cfvpn.my.id',
  'my8.cfvpn.my.id',
  'my9.cfvpn.my.id',
  'my10.cfvpn.my.id',
  'my11.cfvpn.my.id',
  'my12.cfvpn.my.id',
  'my13.cfvpn.my.id',
  'my14.cfvpn.my.id',
  'my15.cfvpn.my.id',
  'my16.cfvpn.my.id',
  'my17.cfvpn.my.id',
  'my18.cfvpn.my.id',
  'my19.cfvpn.my.id',
  'my20.cfvpn.my.id',
  'my21.cfvpn.my.id',
  'm1.cfvpn.kdns.fr',
  'm2.cfvpn.kdns.fr',
  'm3.cfvpn.kdns.fr',
  'm4.cfvpn.kdns.fr',
  'm5.cfvpn.kdns.fr',
  'm6.cfvpn.kdns.fr',
  'm7.cfvpn.kdns.fr',
  'm8.cfvpn.kdns.fr',
  'm9.cfvpn.kdns.fr',
  'm10.cfvpn.kdns.fr',
  'm11.cfvpn.kdns.fr',
  'm12.cfvpn.kdns.fr',
  'm13.cfvpn.kdns.fr',
  'm14.cfvpn.kdns.fr',
  'm15.cfvpn.kdns.fr',
  'm16.cfvpn.kdns.fr',
  'm17.cfvpn.kdns.fr',
  'm18.cfvpn.kdns.fr',
  'm19.cfvpn.kdns.fr',
  'm20.cfvpn.kdns.fr',
  'm21.cfvpn.kdns.fr',
  'id1.kbl.ccwu.cc',
  'id2.kbl.ccwu.cc',
  'id3.kbl.ccwu.cc',
  'id4.kbl.ccwu.cc',
  'id5.kbl.ccwu.cc',
  'id6.kbl.ccwu.cc',
  'id7.kbl.ccwu.cc',
  'id8.kbl.ccwu.cc',
  'id9.kbl.ccwu.cc',
  'id10.kbl.ccwu.cc',
  'id11.kbl.ccwu.cc',
  'id12.kbl.ccwu.cc',
  'id13.kbl.ccwu.cc',
  'id14.kbl.ccwu.cc',
  'id15.kbl.ccwu.cc',
  'id16.kbl.ccwu.cc',
  'id17.kbl.ccwu.cc',
  'id18.kbl.ccwu.cc',
  'id19.kbl.ccwu.cc',
  'id20.kbl.ccwu.cc',
  'id21.kbl.ccwu.cc'
];

// ==================== KONFIGURASI LB ====================
const CACHE_KEY = 'worker_stats_v12';
const DEFAULT_SCORE = 100;
const MAX_CONSECUTIVE_FAILURES = 3;
const COOLDOWN_SECONDS = 60;
const MIN_TIMEOUT = 2000;
const MAX_TIMEOUT = 10000;
const INITIAL_BATCH_SIZE = 3;
const MAX_BATCH_SIZE = 6;
const EWMA_ALPHA = 0.3;
const PREDICTIVE_SCORE_WEIGHT = 0.4;
const JITTER_PENALTY_THRESHOLD = 500;
const BLACKLIST_SCORE_THRESHOLD = 20;
const BLACKLIST_DURATION = 120;
const RECOVERY_INTERVAL = 30;
const P95_PERCENTILE = 0.95;
const LATENCY_HISTORY_SIZE = 30;

// ====================================================================
// MAIN FETCH — ROUTER UTAMA
// ====================================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health
    if (url.pathname === '/__health') {
      return new Response(JSON.stringify({
        ok: true,
        worker: 'v12',
        railway_host: RAILWAY_HOST,
        railway_port: RAILWAY_PORT,
        railway_tls: RAILWAY_TLS,
        backend_count: WORKER_URLS.length,
        protocols: ['vless-tcp', 'vless-udp', 'trojan-tcp', 'trojan-udp', 'http'],
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();
    if (upgrade === 'websocket') {
      return handleSmartWs(request, env, ctx);
    }

    return handleLoadBalancer(request, env, ctx);
  },
};

// ====================================================================
// SMART WS — PEEK & AUTO-ROUTE
// ====================================================================
async function handleSmartWs(request, env, ctx) {
  let clientWs, serverWs;
  try {
    const pair = new WebSocketPair();
    clientWs = pair[0];
    serverWs = pair[1];
  } catch {
    return new Response('WS unsupported', { status: 500 });
  }
  serverWs.accept();

  const router = new WsRouter(request, serverWs, env, ctx);
  ctx.waitUntil(router.run());

  return new Response(null, { status: 101, webSocket: clientWs });
}

// ====================================================================
// WS ROUTER — Peek, deteksi, route
// ====================================================================
class WsRouter {
  constructor(request, serverWs, env, ctx) {
    this.request = request;
    this.serverWs = serverWs;
    this.env = env;
    this.ctx = ctx;
    this.startTime = performance.now();

    this.queue = [];
    this.queuedBytes = 0;
    this.state = 'peeking';       // peeking | routing | routed | closed
    this.dest = null;

    this._routeResolve = null;
    this._routeReject  = null;

    // Buffers untuk translation
    this.trojanToRailBuffer = new Uint8Array(0);
    this.railToClientBuffer = new Uint8Array(0);
  }

  async run() {
    this.serverWs.addEventListener('message', (ev) => this._onClientMsg(ev.data));
    this.serverWs.addEventListener('close', () => this._close(1000, 'client closed'));
    this.serverWs.addEventListener('error', () => this._close(1011, 'client error'));

    const peekTimer = setTimeout(() => {
      if (this.state === 'peeking') this._close(1008, 'peek timeout');
    }, PEEK_TIMEOUT_MS);

    await new Promise((resolve, reject) => {
      this._routeResolve = () => { clearTimeout(peekTimer); resolve(); };
      this._routeReject  = (e) => { clearTimeout(peekTimer); reject(e); };
    }).catch(() => {});
  }

  async _onClientMsg(data) {
    if (this.state === 'closed') return;
    const bytes = toU8(data);
    if (!bytes || bytes.byteLength === 0) return;

    if (this.state === 'routed') {
      await this._forwardToDest(bytes);
      return;
    }

    this.queue.push(bytes);
    this.queuedBytes += bytes.byteLength;

    if (this.state === 'peeking') this._tryRoute();
  }

  // ---------- Deteksi Protokol ----------
  async _tryRoute() {
    const all = concatAll(this.queue);
    if (all.byteLength < 1) return;

    const b0 = all[0];

    // ─── VLESS: version = 0x00 ───
    if (b0 === 0x00) {
      const p = parseVless(all);
      if (p.status === 'incomplete') return;
      if (p.status === 'invalid') {
        this.state = 'routing';
        return this._routeWsToBackend();
      }
      if (p.cmd === 0x02 && p.endpointBytes) {
        this.state = 'routing';
        return this._routeVlessUdp(p.headerLength, p.endpointBytes);
      }
      // TCP / MUX → backend (batch hedging)
      this.state = 'routing';
      return this._routeWsToBackend();
    }

    // ─── Trojan: hex char ───
    if ((b0 >= 0x30 && b0 <= 0x39) || (b0 >= 0x61 && b0 <= 0x66)) {
      const p = parseTrojan(all);
      if (p.status === 'incomplete') return;
      if (p.status === 'invalid') {
        this.state = 'routing';
        return this._routeWsToBackend();
      }
      if (p.cmd === 0x02 || p.cmd === 0x03) {
        this.state = 'routing';
        return this._routeTrojanUdp(p.headerLength);
      }
      this.state = 'routing';
      return this._routeWsToBackend();