import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_DIR,
  PLAN_PRESETS,
  createCollector,
  saveQuotaConfig,
} from '../../lib/stats.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INJECT_PATH = join(__dirname, 'inject.js');
const LOCK_FILE = join(DATA_DIR, 'sidecar.lock');

const MY_PORT = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || 0);
const MY_LS = process.env.ANTIGRAVITY_LS_ADDRESS || '';

function lockPayload() {
  return JSON.stringify({ pid: process.pid, port: MY_PORT, ls: MY_LS, at: Date.now() });
}

function releaseOwnLock() {
  try {
    const raw = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    if (Number(raw.pid) === process.pid) {
      unlinkSync(LOCK_FILE);
    }
  } catch {}
}

function acquireSingletonLock() {
  mkdirSync(DATA_DIR, { recursive: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const fd = openSync(LOCK_FILE, 'wx');
      writeFileSync(fd, lockPayload());
      closeSync(fd);
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') return true;
      try {
        const raw = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
        const holder = Number(raw.pid);
        const age = Date.now() - Number(raw.at || 0);
        let alive = false;
        try {
          process.kill(holder, 0);
          alive = true;
        } catch {}
        const sameHostSession =
          String(raw.ls || '') === MY_LS && Number(raw.port || 0) === MY_PORT;
        if (!alive || age > 30_000 || !sameHostSession) {
          if (alive && !sameHostSession && holder && holder !== process.pid) {
            try { process.kill(holder); } catch {}
          }
          try { unlinkSync(LOCK_FILE); } catch {}
          continue;
        }
        return false;
      } catch {
        try { unlinkSync(LOCK_FILE); } catch {}
      }
    }
  }
  return false;
}

if (!acquireSingletonLock()) {
  process.exit(0);
}

setInterval(() => {
  try {
    writeFileSync(LOCK_FILE, lockPayload());
  } catch {}
}, 10_000).unref();

let cachedInjectSrc = '';
let cachedInjectMtime = 0;
let cachedInjectVer = 1;

function loadInjectScript() {
  try {
    if (!existsSync(INJECT_PATH)) return { src: '', ver: 0 };
    const st = statSync(INJECT_PATH);
    if (st.mtimeMs !== cachedInjectMtime || !cachedInjectSrc) {
      cachedInjectSrc = readFileSync(INJECT_PATH, 'utf8');
      cachedInjectMtime = st.mtimeMs;
      const m = cachedInjectSrc.match(/const VER = (\d+)/);
      cachedInjectVer = m ? Number(m[1]) : 1;
    }
  } catch {}
  return { src: cachedInjectSrc, ver: cachedInjectVer };
}

class CdpClient {
  constructor(ws, url) {
    this.ws = ws;
    this.url = url;
    this.seq = 0;
    this.pending = new Map();
    this.dead = false;
  }

  static connect(wsUrl) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        reject(new Error('CDP WebSocket timeout'));
      }, 6000);

      ws.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          const client = new CdpClient(ws, wsUrl);
          ws.addEventListener('message', (ev) => {
            let msg;
            try {
              msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
            } catch {
              return;
            }
            if (msg.id && client.pending.has(msg.id)) {
              const fn = client.pending.get(msg.id);
              client.pending.delete(msg.id);
              fn(msg);
            } else if (msg.method && typeof client.onEvent === 'function') {
              try { client.onEvent(msg); } catch {}
            }
          });
          ws.addEventListener('close', () => {
            client.dead = true;
          });
          resolve(client);
        },
        { once: true }
      );

      ws.addEventListener(
        'error',
        () => {
          clearTimeout(timer);
          reject(new Error('CDP WebSocket error'));
        },
        { once: true }
      );
    });
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP call timeout'));
      }, 6000);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async evalValue(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res?.result?.exceptionDetails) return null;
    return res?.result?.result?.value;
  }

  close() {
    this.dead = true;
    try { this.ws.close(); } catch {}
  }
}

function readDevToolsPortFile() {
  const candidates = [
    process.env.APPDATA ? join(process.env.APPDATA, 'Antigravity', 'DevToolsActivePort') : '',
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Antigravity', 'DevToolsActivePort') : '',
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue;
      const firstLine = readFileSync(file, 'utf8').split(/\r?\n/)[0].trim();
      if (/^\d+$/.test(firstLine)) return Number(firstLine);
    } catch {}
  }
  return null;
}

async function queryCdpTargets(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return null;
    const list = await res.json();
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

async function findAntigravityPage() {
  const ports = [];
  const filePort = readDevToolsPortFile();
  if (filePort) ports.push(filePort);
  if (!ports.includes(9222)) ports.push(9222);

  for (const port of ports) {
    const list = await queryCdpTargets(port);
    if (!list) continue;
    const page =
      list.find((t) => t.type === 'page' && /^https:\/\/127\.0\.0\.1:\d+\/c\//.test(String(t.url || ''))) ||
      list.find((t) => t.type === 'page' && /^https:\/\/127\.0\.0\.1/.test(String(t.url || ''))) ||
      list.find((t) => t.type === 'page' && !String(t.url || '').startsWith('devtools://'));
    if (page && page.webSocketDebuggerUrl) {
      return { port, page };
    }
  }
  return null;
}

const collector = createCollector();

const SUMMARY_FILE = join(DATA_DIR, 'quota-summary.json');

function normalizeQuotaSummary(resp, capturedAt) {
  const pools = { gemini: {}, claude: {}, argon: {} };
  for (const g of resp?.groups || []) {
    for (const b of g.buckets || []) {
      const id = String(b.bucketId || '');
      const pool = id.startsWith('gemini-argon') ? 'argon' : id.startsWith('3p') ? 'claude' : id.startsWith('gemini') ? 'gemini' : null;
      if (!pool) continue;
      const resetMs = Date.parse(b.resetTime || '');
      if (!Number.isFinite(resetMs)) continue;
      const frac = Number(b.remainingFraction || 0);
      const key = b.window === 'weekly' ? 'weekly' : 'fiveHour';
      pools[pool][key] = { pct: Math.max(0, Math.min(100, Math.round(frac * 100))), resetMs };
    }
  }
  return { capturedAt, pools };
}

let summaryState = null;
try {
  if (existsSync(SUMMARY_FILE)) {
    const raw = JSON.parse(readFileSync(SUMMARY_FILE, 'utf8'));
    if (raw?.response?.groups) summaryState = normalizeQuotaSummary(raw.response, Number(raw.capturedAt) || 0);
  }
} catch {}

function ingestSummaryText(text) {
  try {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s < 0 || e <= s) return;
    const json = JSON.parse(text.slice(s, e + 1));
    const resp = json.response || json;
    if (!resp?.groups) return;
    const now = Date.now();
    summaryState = normalizeQuotaSummary(resp, now);
    writeFileSync(SUMMARY_FILE, JSON.stringify({ capturedAt: now, response: resp }, null, 2));
    state.summary = summaryState;
  } catch {}
}

// Passively observe the app's own RetrieveUserQuotaSummary responses (fired when the usage popover opens).
function attachNetwork(client) {
  const watched = new Set();
  client.onEvent = (msg) => {
    if (msg.method === 'Network.responseReceived') {
      const u = String(msg.params?.response?.url || '');
      if (u.includes('RetrieveUserQuotaSummary')) watched.add(msg.params.requestId);
    } else if (msg.method === 'Network.loadingFinished' && watched.has(msg.params?.requestId)) {
      watched.delete(msg.params.requestId);
      client
        .send('Network.getResponseBody', { requestId: msg.params.requestId })
        .then((r) => {
          const body = r?.result?.body;
          if (!body) return;
          ingestSummaryText(r.result.base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body);
        })
        .catch(() => {});
    }
  };
  client.send('Network.enable').catch(() => {});
}

// User-triggered "sync" button: opens the model menu usage popover once, exactly like a manual hover, then closes it.
let lastSyncAt = 0;
async function runUsageSync(client) {
  if (Date.now() - lastSyncAt < 15_000) return;
  lastSyncAt = Date.now();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = async () => {
    for (const type of ['keyDown', 'keyUp']) {
      await client.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    }
  };
  try {
    await client.evalValue(`document.querySelector('[data-testid="model-selector-trigger"]')?.click()`);
    await sleep(500);
    const pos = await client.evalValue(`(() => { const els = [...document.querySelectorAll('span')].filter((e) => /^(查看用量|View usage)$/i.test((e.innerText || '').trim())); const el = els[els.length - 1]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (pos) await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
    await sleep(1600);
  } finally {
    try { await esc(); await sleep(150); await esc(); } catch {}
  }
}

const state = {
  cdpConnected: false,
  cdpPort: null,
  mounted: false,
  visible: false,
  snapshot: collector.getSnapshot(),
  liveQuota: null,
  summary: summaryState,
  presets: PLAN_PRESETS,
};

let cdpClient = null;
let currentTargetWs = '';

async function tick() {
  try {
    state.snapshot = collector.getSnapshot();

    const found = await findAntigravityPage();
    if (!found) {
      if (cdpClient) {
        cdpClient.close();
        cdpClient = null;
        currentTargetWs = '';
      }
      state.cdpConnected = false;
      state.cdpPort = null;
      state.mounted = false;
      state.visible = false;
      return 3000;
    }

    const { port, page } = found;
    if (!cdpClient || cdpClient.dead || currentTargetWs !== page.webSocketDebuggerUrl) {
      if (cdpClient) cdpClient.close();
      cdpClient = await CdpClient.connect(page.webSocketDebuggerUrl);
      currentTargetWs = page.webSocketDebuggerUrl;
      attachNetwork(cdpClient);
    }

    state.cdpConnected = true;
    state.cdpPort = port;

    const { src, ver } = loadInjectScript();
    if (src) {
      const currentVer = await cdpClient.evalValue('window.__AGY_QUOTA_BAR ? window.__AGY_QUOTA_BAR.ver : 0');
      if (currentVer !== ver) {
        await cdpClient.evalValue(src);
      }
    }

    // Consume pending config changes saved from sidebar popover UI
    const pendingPatch = await cdpClient.evalValue(
      'window.__AGY_QUOTA_BAR && window.__AGY_QUOTA_BAR.consumePendingConfig ? window.__AGY_QUOTA_BAR.consumePendingConfig() : null'
    );
    if (pendingPatch && typeof pendingPatch === 'object') {
      saveQuotaConfig(
        pendingPatch,
        state.snapshot.quota?.tokens5hNet || 0,
        state.snapshot.quota?.tokens7dNet || 0
      );
      state.snapshot = collector.getSnapshot();
    }

    const liveReact = await cdpClient.evalValue(
      'window.__AGY_QUOTA_BAR && window.__AGY_QUOTA_BAR.readLiveQuota ? window.__AGY_QUOTA_BAR.readLiveQuota() : null'
    );
    if (liveReact && typeof liveReact === 'object') {
      state.liveQuota = liveReact;
    }

    const syncRequested = await cdpClient.evalValue(
      'window.__AGY_QUOTA_BAR && window.__AGY_QUOTA_BAR.consumeSyncRequest ? window.__AGY_QUOTA_BAR.consumeSyncRequest() : false'
    );
    if (syncRequested === true) {
      await runUsageSync(cdpClient);
    }

    const payloadJson = JSON.stringify({
      snapshot: state.snapshot,
      presets: PLAN_PRESETS,
      summary: summaryState,
    });
    const res = await cdpClient.evalValue(
      `window.__AGY_QUOTA_BAR ? window.__AGY_QUOTA_BAR.update(${payloadJson}) : null`
    );
    if (res && res.ok) {
      state.mounted = !!res.mounted;
      state.visible = !!res.visible;
    }
    return 1200;
  } catch {
    if (cdpClient) {
      cdpClient.close();
      cdpClient = null;
      currentTargetWs = '';
    }
    state.cdpConnected = false;
    state.mounted = false;
    return 3000;
  }
}

async function runLoop() {
  for (;;) {
    const delay = await tick();
    await new Promise((r) => setTimeout(r, delay));
  }
}

const AUX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Quota & Usage Stats</title>
<script src="/preload.js"></script>
<style>
  :root {
    --bg: #0D0D11; --card: #121216; --well: #17171B; --border: rgba(255,255,255,.075);
    --text: #EAEBF1; --muted: #8E909A; --accent: #2F71E3; --cell-0: #1B1B21;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #F6F7F9; --card: #FFFFFF; --well: #F0F2F6; --border: rgba(15,23,42,.10);
      --text: #1F2328; --muted: #656D76; --accent: #2F71E3; --cell-0: #E6E8EE;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 14px; background: var(--bg); color: var(--text);
    font-family: "Google Sans Flex", "Google Sans", system-ui, "Microsoft YaHei", sans-serif;
    font-size: 12.5px; line-height: 1.45;
  }
  .panel {
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px; margin-bottom: 10px;
  }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .q-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
  .q-card { background: var(--well); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; }
  .tabs { display: flex; gap: 4px; }
  .tab {
    background: transparent; border: none; color: var(--muted); padding: 4px 10px;
    border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500;
  }
  .tab.active { background: #1F1F24; color: var(--text); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }
  .badge {
    font-size: 10.5px; padding: 1px 7px; border-radius: 6px;
    background: rgba(47,113,227,.15); color: #70A4FF; font-weight: 600;
  }
  .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
  .kpi {
    background: var(--well); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 11px;
  }
  .kpi-lbl { font-size: 11px; color: var(--muted); }
  .kpi-val { font-size: 17px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .grid {
    display: grid; grid-template-rows: repeat(7, 1fr); grid-auto-flow: column;
    gap: 3px; margin-top: 12px;
  }
  .cell { aspect-ratio: 1; border-radius: 3px; background: var(--cell-0); cursor: default; }
  .cell.l1 { background: rgba(47, 113, 227, 0.30); }
  .cell.l2 { background: rgba(47, 113, 227, 0.52); }
  .cell.l3 { background: rgba(47, 113, 227, 0.76); }
  .cell.l4 { background: #2F71E3; }
  .foot { margin-top: 10px; font-size: 11.5px; color: var(--muted); }
  .track { height: 5px; border-radius: 99px; background: rgba(128,128,128,.2); overflow: hidden; margin: 8px 0 4px; }
  .fill { height: 100%; background: var(--accent); transition: width .25s ease; }
  .m-row { margin-top: 8px; }
  .m-bar { height: 5px; border-radius: 99px; background: rgba(128,128,128,.16); overflow: hidden; margin-top: 4px; }
  .m-fill { height: 100%; background: var(--accent); }
  #tip {
    position: fixed; display: none; pointer-events: none; z-index: 99;
    background: #1B1B21; color: #F3F3F7; border: 1px solid var(--border);
    border-radius: 7px; padding: 4px 8px; font-size: 11px; white-space: nowrap;
    box-shadow: 0 8px 20px rgba(0,0,0,.45);
  }
</style>
</head>
<body>
  <div class="panel">
    <div class="row">
      <strong id="q-title">订阅额度与周期消耗</strong>
      <span id="cdp-badge" class="badge">检测中</span>
    </div>
    <div class="q-grid">
      <div class="q-card">
        <div class="row"><span>5小时额度</span><span id="q5-pct" style="font-weight:600">—</span></div>
        <div class="track"><div id="q5-fill" class="fill" style="width:0%"></div></div>
        <div id="q5-sub" style="font-size:11px; color:var(--muted);">—</div>
      </div>
      <div class="q-card">
        <div class="row"><span>当前周额度</span><span id="q7-pct" style="font-weight:600">—</span></div>
        <div class="track"><div id="q7-fill" class="fill" style="width:0%"></div></div>
        <div id="q7-sub" style="font-size:11px; color:var(--muted);">—</div>
      </div>
    </div>
  </div>
  <div class="panel">
    <div class="row">
      <div class="tabs">
        <button class="tab active" data-tab="overview">概述</button>
        <button class="tab" data-tab="models">模型</button>
      </div>
      <div class="tabs">
        <button class="tab active" data-range="all">全部</button>
        <button class="tab" data-range="30d">30天</button>
        <button class="tab" data-range="7d">7天</button>
      </div>
    </div>
    <div id="view-overview">
      <div class="kpis" id="kpis"></div>
      <div class="grid" id="grid"></div>
      <div class="foot" id="fun-note"></div>
    </div>
    <div id="view-models" style="display:none; margin-top:10px;"></div>
  </div>
  <div id="tip"></div>
<script>
let tab = 'overview', range = 'all', latest = null;
const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n||0);
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
  render();
});
document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => {
  range = b.dataset.range;
  document.querySelectorAll('[data-range]').forEach(x => x.classList.toggle('active', x === b));
  render();
});
const tip = document.getElementById('tip');
function render() {
  if (!latest) return;
  const s = latest.snapshot, q = s.quota, r = s.ranges[range] || s.ranges.all;
  const badge = document.getElementById('cdp-badge');
  badge.textContent = latest.mounted ? '已挂载侧栏 (:' + latest.cdpPort + ')' : (latest.cdpConnected ? 'CDP 已连接' : '仅辅助面板');
  document.getElementById('q-title').textContent = q.tierLabel;
  const p5 = q.remainingPct, p7 = q.weeklyRemainingPct;
  let rstTxt = '';
  if (q.reset5hAtMs) {
    const dt = new Date(q.reset5hAtMs);
    const hm = String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0');
    const mins = Math.max(1, Math.ceil((q.reset5hAtMs - Date.now()) / 60000));
    const cd = mins >= 60 ? Math.floor(mins/60)+'h'+String(mins%60).padStart(2,'0')+'m' : mins+'m';
    rstTxt = ' · ' + hm + ' 重置 (' + cd + ')';
  }
  document.getElementById('q5-fill').style.width = (p5 !== null && p5 !== undefined ? p5 : 100) + '%';
  document.getElementById('q5-pct').textContent = p5 !== null && p5 !== undefined ? ('余 ' + p5 + '%') : fmt(q.tokens5hNet);
  document.getElementById('q5-sub').textContent = '净 ' + fmt(q.tokens5hNet) + (q.budget5hNet ? ' / ' + fmt(q.budget5hNet) : '') + rstTxt;
  document.getElementById('q7-fill').style.width = (p7 !== null && p7 !== undefined ? p7 : 100) + '%';
  document.getElementById('q7-pct').textContent = p7 !== null && p7 !== undefined ? ('余 ' + p7 + '%') : fmt(q.tokens7dNet);
  document.getElementById('q7-sub').textContent = '净 ' + fmt(q.tokens7dNet) + (q.budget7dNet ? ' / ' + fmt(q.budget7dNet) : '') + ' · 今日 ' + fmt(q.tokensTodayTotal);

  document.getElementById('view-overview').style.display = tab === 'overview' ? 'block' : 'none';
  document.getElementById('view-models').style.display = tab === 'models' ? 'block' : 'none';

  document.getElementById('kpis').innerHTML = [
    ['会话', r.sessions],
    ['消息', r.messages.toLocaleString()],
    ['Token 总数', fmt(r.tokensTotal)],
    ['活跃天数', r.activeDays],
    ['高峰时段', r.peakHour !== null ? r.peakHour + '时' : '—'],
    ['常用模型', r.topModel],
  ].map(([l, v]) => '<div class="kpi"><div class="kpi-lbl">'+l+'</div><div class="kpi-val">'+v+'</div></div>').join('');

  const grid = document.getElementById('grid');
  const hmCells = (s.ranges && s.ranges.all && s.ranges.all.heatmap && s.ranges.all.heatmap.cells) || r.heatmap.cells;
  grid.innerHTML = '';
  for (const c of hmCells) {
    const el = document.createElement('div');
    el.className = 'cell' + (c.level ? ' l'+c.level : '');
    if (c.isFuture) el.style.opacity = '0.25';
    el.onmousemove = (ev) => {
      tip.style.display = 'block';
      tip.textContent = c.month + '月' + c.day + '日 — ' + (c.total > 0 ? (fmt(c.total) + ' tokens · ' + c.messages + ' 消息') : '无使用');
      tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, ev.clientX + 10) + 'px';
      tip.style.top = Math.max(8, ev.clientY - 28) + 'px';
    };
    el.onmouseleave = () => { tip.style.display = 'none'; };
    grid.appendChild(el);
  }

  const books = Math.max(1, Math.round(r.tokensTotal / 22000));
  document.getElementById('fun-note').textContent = '你使用的 Token 大约是《小王子》的 ' + books.toLocaleString() + ' 倍（净消耗输入+输出 ' + fmt(r.tokensNet) + '）。';

  document.getElementById('view-models').innerHTML = r.models.map(m =>
    '<div class="m-row"><div class="row"><span>'+m.name+'</span><span style="color:var(--muted)">'+fmt(m.total)+' ('+m.shareTotalPct+'%)</span></div><div class="m-bar"><div class="m-fill" style="width:'+m.shareTotalPct+'%"></div></div></div>'
  ).join('') || '<div style="color:var(--muted)">暂无模型记录</div>';
}
async function poll() {
  try {
    const res = await fetch('/api/state');
    latest = await res.json();
    render();
  } catch {}
}
poll();
setInterval(poll, 2000);
</script>
</body>
</html>`;

async function readBodyJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_768) break;
  }
  return raw ? JSON.parse(raw) : {};
}

async function startWebServer() {
  try {
    const sdk = await import('sidecar_sdk');
    const app = new sdk.SidecarApp();
    app.page('/', () => new sdk.Response(AUX_HTML, {
      contentType: 'text/html; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
    }));
    app.api('/api/state', () => state, 'GET');
    app.api('/api/config', async (req) => {
      const body = typeof req?.json === 'function' ? await req.json() : {};
      saveQuotaConfig(body, state.snapshot?.quota?.tokens5hNet || 0, state.snapshot?.quota?.tokens7dNet || 0);
      state.snapshot = collector.getSnapshot();
      return { ok: true, snapshot: state.snapshot };
    }, 'POST');
    await app.run();
    return;
  } catch {}

  const port = Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || 0);
  if (!port) return;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(state));
      return;
    }
    if (req.url === '/api/config' && req.method === 'POST') {
      try {
        const body = await readBodyJson(req);
        saveQuotaConfig(body, state.snapshot?.quota?.tokens5hNet || 0, state.snapshot?.quota?.tokens7dNet || 0);
        state.snapshot = collector.getSnapshot();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: true, snapshot: state.snapshot }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(AUX_HTML);
  });
  server.listen(port, '127.0.0.1');
}

function startHostWatchdog() {
  if (!MY_LS) return;
  let missCount = 0;
  setInterval(async () => {
    try {
      const res = await fetch(`http://${MY_LS}/healthz`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        missCount = 0;
        return;
      }
      missCount++;
    } catch {
      missCount++;
    }
    if (missCount >= 3) {
      releaseOwnLock();
      process.exit(0);
    }
  }, 15_000).unref();
}

startHostWatchdog();
startWebServer();
runLoop();
