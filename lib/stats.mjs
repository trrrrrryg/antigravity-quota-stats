import { DatabaseSync } from 'node:sqlite';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  BASE_MODEL_ENUM_MAP,
  classifyModelPool,
  extractEnumModelPairs,
  formatModelDisplayName,
  parseStepMetadata,
} from './proto.mjs';

export const AGY_DIR = process.env.ANTIGRAVITY_HOME || join(homedir(), '.gemini', 'antigravity');
export const BRAIN_DIR = join(AGY_DIR, 'brain');
export const CONV_DIR = join(AGY_DIR, 'conversations');
export const SUMMARIES_DB = join(AGY_DIR, 'conversation_summaries.db');
export const DATA_DIR = join(AGY_DIR, 'sidecar_data', 'antigravity-quota-stats');
export const CONFIG_FILE = join(DATA_DIR, 'quota-config.json');

export const PLAN_PRESETS = {
  pro: { id: 'pro', label: 'Google AI Pro', short: 'Pro', budget5hNet: 12_000_000, budget7dNet: 120_000_000 },
  ultra: { id: 'ultra', label: 'Google AI Ultra', short: 'Ultra', budget5hNet: 60_000_000, budget7dNet: 600_000_000 },
  free: { id: 'free', label: 'Free Tier', short: 'Free', budget5hNet: 3_000_000, budget7dNet: 25_000_000 },
  local: { id: 'local', label: '仅本地统计', short: '本地', budget5hNet: 0, budget7dNet: 0 },
};

const DEFAULT_CONFIG = {
  planTier: 'pro',
  budget5hNet: PLAN_PRESETS.pro.budget5hNet,
  budget7dNet: PLAN_PRESETS.pro.budget7dNet,
  calibratedRemainingPct: null,
  calibratedAtMs: null,
  calibrated5hNetAtSave: 0,
  calibratedWeeklyRemainingPct: null,
  calibratedWeeklyAtMs: null,
  calibrated7dNetAtSave: 0,
  calibratedReset5hAtMs: null,
  tokenMode: 'total', // 'total' (in+cache+out) | 'net' (in+out)
  updatedAt: 0,
};

function sanitizePct(rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === '') return null;
  const n = Math.round(Number(rawVal));
  return Number.isNaN(n) ? null : Math.max(0, Math.min(100, n));
}

function sanitizeConfig(raw) {
  const tier = PLAN_PRESETS[raw?.planTier] ? raw.planTier : 'pro';
  const preset = PLAN_PRESETS[tier];
  const custom5h = Number(raw?.budget5hNet);
  const custom7d = Number(raw?.budget7dNet);
  const budget5hNet =
    tier === 'local' ? 0 : Number.isFinite(custom5h) && custom5h > 0 ? Math.round(custom5h) : preset.budget5hNet;
  const budget7dNet =
    tier === 'local' ? 0 : Number.isFinite(custom7d) && custom7d > 0 ? Math.round(custom7d) : preset.budget7dNet;

  const calPct = sanitizePct(raw?.calibratedRemainingPct);
  const calWeeklyPct = sanitizePct(raw?.calibratedWeeklyRemainingPct);
  const rawReset5h = Number(raw?.calibratedReset5hAtMs);
  const calibratedReset5hAtMs = Number.isFinite(rawReset5h) && rawReset5h > 1_577_836_800_000 ? Math.round(rawReset5h) : null;

  return {
    planTier: tier,
    budget5hNet,
    budget7dNet,
    calibratedRemainingPct: calPct,
    calibratedAtMs: calPct !== null && Number(raw?.calibratedAtMs) > 0 ? Number(raw.calibratedAtMs) : null,
    calibrated5hNetAtSave: calPct !== null && Number(raw?.calibrated5hNetAtSave) >= 0 ? Number(raw.calibrated5hNetAtSave) : 0,
    calibratedWeeklyRemainingPct: calWeeklyPct,
    calibratedWeeklyAtMs: calWeeklyPct !== null && Number(raw?.calibratedWeeklyAtMs) > 0 ? Number(raw.calibratedWeeklyAtMs) : null,
    calibrated7dNetAtSave: calWeeklyPct !== null && Number(raw?.calibrated7dNetAtSave) >= 0 ? Number(raw.calibrated7dNetAtSave) : 0,
    calibratedReset5hAtMs,
    tokenMode: raw?.tokenMode === 'net' ? 'net' : 'total',
    updatedAt: Number(raw?.updatedAt || Date.now()),
  };
}

export function loadQuotaConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return sanitizeConfig(JSON.parse(readFileSync(CONFIG_FILE, 'utf8')));
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveQuotaConfig(patch, current5hNet = 0, current7dNet = 0) {
  mkdirSync(DATA_DIR, { recursive: true });
  const prev = loadQuotaConfig();
  const nextRaw = { ...prev, ...patch, updatedAt: Date.now() };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'planTier')) {
    const p = PLAN_PRESETS[patch.planTier];
    if (p) {
      if (!Object.prototype.hasOwnProperty.call(patch, 'budget5hNet')) nextRaw.budget5hNet = p.budget5hNet;
      if (!Object.prototype.hasOwnProperty.call(patch, 'budget7dNet')) nextRaw.budget7dNet = p.budget7dNet;
    }
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'calibratedRemainingPct')) {
    if (patch.calibratedRemainingPct === null || patch.calibratedRemainingPct === '') {
      nextRaw.calibratedRemainingPct = null;
      nextRaw.calibratedAtMs = null;
      nextRaw.calibrated5hNetAtSave = 0;
    } else {
      nextRaw.calibratedAtMs = Date.now();
      nextRaw.calibrated5hNetAtSave = Math.max(0, Number(current5hNet || 0));
    }
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'calibratedWeeklyRemainingPct')) {
    if (patch.calibratedWeeklyRemainingPct === null || patch.calibratedWeeklyRemainingPct === '') {
      nextRaw.calibratedWeeklyRemainingPct = null;
      nextRaw.calibratedWeeklyAtMs = null;
      nextRaw.calibrated7dNetAtSave = 0;
    } else {
      nextRaw.calibratedWeeklyAtMs = Date.now();
      nextRaw.calibrated7dNetAtSave = Math.max(0, Number(current7dNet || 0));
    }
  }
  const clean = sanitizeConfig(nextRaw);
  const tmp = `${CONFIG_FILE}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(clean, null, 2), 'utf8');
  try {
    renameSync(tmp, CONFIG_FILE);
  } catch {
    writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2), 'utf8');
  }
  return clean;
}

function fileStamp(filePath) {
  let sig = '';
  for (const p of [filePath, `${filePath}-wal`]) {
    try {
      const st = statSync(p);
      sig += `${Math.round(st.mtimeMs)}:${st.size}|`;
    } catch {
      sig += '0|';
    }
  }
  return sig;
}

function toLocalDayKey(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoMs(s) {
  if (!s) return 0;
  const ms = Date.parse(s);
  return Number.isFinite(ms) && ms > 1_577_836_800_000 ? ms : 0; // >= 2020-01-01
}

export function createCollector() {
  const enumMap = new Map(Object.entries(BASE_MODEL_ENUM_MAP).map(([k, v]) => [Number(k), v]));
  const convCache = new Map();
  const transcriptCache = new Map();
  let summaryCache = { stamp: '', rows: [] };

  function loadSummaries() {
    if (!existsSync(SUMMARIES_DB)) return [];
    const stamp = fileStamp(SUMMARIES_DB);
    if (summaryCache.stamp === stamp) return summaryCache.rows;
    try {
      const db = new DatabaseSync(SUMMARIES_DB, { readOnly: true });
      const rows = db
        .prepare(
          `SELECT conversation_id, step_count, last_modified_time, agent_name
           FROM conversation_summaries
           WHERE step_count > 0`
        )
        .all();
      db.close();
      const parsed = [];
      for (const r of rows) {
        const ms = parseIsoMs(r.last_modified_time);
        if (!ms) continue;
        parsed.push({
          id: r.conversation_id,
          stepCount: Number(r.step_count || 0),
          lastMs: ms,
          agentName: r.agent_name || '',
        });
      }
      summaryCache = { stamp, rows: parsed };
      return parsed;
    } catch {
      return summaryCache.rows;
    }
  }

  function loadDbConversation(convId, dbPath) {
    const stamp = fileStamp(dbPath);
    const cached = convCache.get(convId);
    if (cached && cached.stamp === stamp) return cached.data;

    let db;
    try {
      db = new DatabaseSync(dbPath, { readOnly: true });
      for (const row of db.prepare('SELECT data FROM gen_metadata WHERE length(data) < 8192').all()) {
        extractEnumModelPairs(Buffer.from(row.data), enumMap);
      }
      const events = [];
      for (const row of db.prepare('SELECT idx, step_type, metadata FROM steps WHERE metadata IS NOT NULL ORDER BY idx').all()) {
        const meta = parseStepMetadata(Buffer.from(row.metadata));
        if (!meta) continue;
        const rawModel = meta.usage?.modelEnum ? enumMap.get(meta.usage.modelEnum) || `MODEL_${meta.usage.modelEnum}` : '';
        if (meta.usage) {
          events.push({
            tsMs: meta.tsMs,
            kind: 'model_usage',
            pool: classifyModelPool(rawModel),
            modelRaw: rawModel,
            modelName: formatModelDisplayName(rawModel),
            input: meta.usage.inputTokens,
            cacheRead: meta.usage.cacheReadTokens,
            output: meta.usage.outputTokens,
          });
        } else if (row.step_type === 1 && meta.tsMs) {
          events.push({
            tsMs: meta.tsMs,
            kind: 'user_msg',
          });
        }
      }
      db.close();
      const data = { events, hasDb: true };
      convCache.set(convId, { stamp, data });
      return data;
    } catch {
      try { if (db) db.close(); } catch {}
      return cached ? cached.data : null;
    }
  }

  function loadTranscriptConversation(convId, tpPath) {
    const stamp = fileStamp(tpPath);
    const cached = transcriptCache.get(convId);
    if (cached && cached.stamp === stamp) return cached.data;

    try {
      const lines = readFileSync(tpPath, 'utf8').split(/\r?\n/);
      const events = [];
      for (const line of lines) {
        if (!line) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        const tsMs = parseIsoMs(obj.created_at);
        const isUser = obj.type === 'USER_INPUT' || obj.source === 'USER_EXPLICIT';
        const isModelMsg = obj.type === 'PLANNER_RESPONSE';
        const inTok = Number(obj.input_tokens || 0);
        const caTok = Number(obj.cache_read_tokens || 0);
        const outTok = Number(obj.output_tokens || 0);
        if (isUser) {
          events.push({ tsMs, kind: 'user_msg' });
        }
        if (inTok || caTok || outTok || isModelMsg) {
          const rawModel = obj.model || '';
          events.push({
            tsMs,
            kind: inTok || caTok || outTok ? 'model_usage' : 'model_msg',
            pool: classifyModelPool(rawModel),
            modelRaw: rawModel,
            modelName: rawModel ? formatModelDisplayName(rawModel) : '',
            input: inTok,
            cacheRead: caTok,
            output: outTok,
          });
        }
      }
      const data = { events };
      transcriptCache.set(convId, { stamp, data });
      return data;
    } catch {
      return cached ? cached.data : null;
    }
  }

  function gatherAllEvents(nowMs) {
    const summaries = loadSummaries();
    const convIds = new Set();

    const dbConvIds = new Set();
    if (existsSync(CONV_DIR)) {
      for (const f of readdirSync(CONV_DIR)) {
        if (f.endsWith('.db')) {
          const id = f.slice(0, -3);
          dbConvIds.add(id);
          convIds.add(id);
        }
      }
    }
    const brainConvIds = new Set();
    if (existsSync(BRAIN_DIR)) {
      for (const d of readdirSync(BRAIN_DIR, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const tp = join(BRAIN_DIR, d.name, '.system_generated', 'logs', 'transcript.jsonl');
        if (existsSync(tp)) {
          brainConvIds.add(d.name);
          convIds.add(d.name);
        }
      }
    }

    const perConv = [];
    for (const id of convIds) {
      const dbPath = join(CONV_DIR, `${id}.db`);
      const tpPath = join(BRAIN_DIR, id, '.system_generated', 'logs', 'transcript.jsonl');
      const dbData = dbConvIds.has(id) ? loadDbConversation(id, dbPath) : null;
      const tpData = brainConvIds.has(id) ? loadTranscriptConversation(id, tpPath) : null;

      let events = [];
      if (dbData && dbData.events.length > 0) {
        // Combine DB usage events (100% model enum accuracy) + transcript user message counts if DB lacks user_msg
        const dbHasUserMsgs = dbData.events.some((e) => e.kind === 'user_msg');
        events = [...dbData.events];
        if (!dbHasUserMsgs && tpData) {
          for (const e of tpData.events) {
            if (e.kind === 'user_msg') events.push(e);
          }
        }
      } else if (tpData) {
        events = tpData.events;
      }

      if (events.length > 0) {
        perConv.push({ id, events });
      }
    }

    // Build slice aggregates for 'all', '30d', '7d'
    const cutoffs = {
      all: 0,
      '30d': nowMs - 30 * 86_400_000,
      '7d': nowMs - 7 * 86_400_000,
    };

    const ranges = {};
    for (const [key, sinceMs] of Object.entries(cutoffs)) {
      ranges[key] = aggregateRange(summaries, perConv, sinceMs, nowMs);
    }

    // Rolling 5h / Today / 7d window metrics split strictly by independent quota pool
    const cutoff5h = nowMs - 5 * 3_600_000;
    const cutoff7d = nowMs - 7 * 86_400_000;
    const todayStart = new Date(nowMs);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const mkPoolBucket = () => ({
      tokens5hNet: 0,
      tokens5hTotal: 0,
      steps5h: 0,
      oldest5hTsMs: 0,
      tokensTodayNet: 0,
      tokensTodayTotal: 0,
      stepsToday: 0,
      tokens7dNet: 0,
      tokens7dTotal: 0,
      steps7d: 0,
    });
    const pools = {
      gemini: mkPoolBucket(),
      claude: mkPoolBucket(),
      argon: mkPoolBucket(),
    };

    for (const conv of perConv) {
      for (const e of conv.events) {
        if (e.kind !== 'model_usage' || !e.tsMs) continue;
        const poolKey = pools[e.pool] ? e.pool : classifyModelPool(e.modelRaw || e.modelName);
        const b = pools[poolKey];
        const net = e.input + e.output;
        const tot = net + e.cacheRead;
        if (e.tsMs >= cutoff5h) {
          b.tokens5hNet += net;
          b.tokens5hTotal += tot;
          b.steps5h++;
          if (!b.oldest5hTsMs || e.tsMs < b.oldest5hTsMs) b.oldest5hTsMs = e.tsMs;
        }
        if (e.tsMs >= todayStartMs) {
          b.tokensTodayNet += net;
          b.tokensTodayTotal += tot;
          b.stepsToday++;
        }
        if (e.tsMs >= cutoff7d) {
          b.tokens7dNet += net;
          b.tokens7dTotal += tot;
          b.steps7d++;
        }
      }
    }

    const gem = pools.gemini;
    const config = loadQuotaConfig();
    const preset = PLAN_PRESETS[config.planTier] || PLAN_PRESETS.pro;

    const computeWindowPct = (consumedNet, budgetNet, calPct, calAtMs, calNetAtSave, windowMs) => {
      if (config.planTier === 'local' || budgetNet <= 0) {
        return { pct: null, source: 'local' };
      }
      if (calPct !== null && calAtMs && nowMs - calAtMs <= windowMs) {
        const deltaNet = Math.max(0, consumedNet - calNetAtSave);
        const consumedPct = (deltaNet / budgetNet) * 100;
        return { pct: Math.max(0, Math.min(100, Math.round(calPct - consumedPct))), source: 'calibrated' };
      }
      const usedPct = (consumedNet / budgetNet) * 100;
      return { pct: Math.max(0, Math.min(100, Math.round(100 - usedPct))), source: 'window' };
    };

    const win5h = computeWindowPct(
      gem.tokens5hNet,
      config.budget5hNet,
      config.calibratedRemainingPct,
      config.calibratedAtMs,
      config.calibrated5hNetAtSave,
      5 * 3_600_000
    );
    const win7d = computeWindowPct(
      gem.tokens7dNet,
      config.budget7dNet,
      config.calibratedWeeklyRemainingPct,
      config.calibratedWeeklyAtMs,
      config.calibrated7dNetAtSave,
      7 * 86_400_000
    );

    const FIVE_H_MS = 5 * 3_600_000;
    let reset5hAtMs = null;
    let reset5hSource = 'idle'; // 'calibrated' | 'window' | 'idle'
    if (config.calibratedReset5hAtMs) {
      let target = config.calibratedReset5hAtMs;
      while (target <= nowMs) target += FIVE_H_MS;
      reset5hAtMs = target;
      reset5hSource = 'calibrated';
    } else if (gem.oldest5hTsMs > 0) {
      reset5hAtMs = gem.oldest5hTsMs + FIVE_H_MS;
      reset5hSource = 'window';
    }

    return {
      generatedAt: nowMs,
      quota: {
        tierId: config.planTier,
        tierLabel: preset.label,
        tierShort: preset.short,
        budget5hNet: config.budget5hNet,
        budget7dNet: config.budget7dNet,
        remainingPct: win5h.pct,
        pctSource: win5h.source,
        weeklyRemainingPct: win7d.pct,
        weeklyPctSource: win7d.source,
        oldest5hTsMs: gem.oldest5hTsMs || null,
        reset5hAtMs,
        reset5hSource,
        tokens5hNet: gem.tokens5hNet,
        tokens5hTotal: gem.tokens5hTotal,
        steps5h: gem.steps5h,
        tokensTodayNet: gem.tokensTodayNet,
        tokensTodayTotal: gem.tokensTodayTotal,
        stepsToday: gem.stepsToday,
        tokens7dNet: gem.tokens7dNet,
        tokens7dTotal: gem.tokens7dTotal,
        steps7d: gem.steps7d,
        pools,
        config,
      },
      ranges,
    };
  }

  function aggregateRange(summaries, perConv, sinceMs, nowMs) {
    const activeConvIds = new Set();
    let userMessages = 0;
    let modelSteps = 0;
    let totalInput = 0;
    let totalCacheRead = 0;
    let totalOutput = 0;

    const hourBuckets = new Array(24).fill(0);
    const dayMap = new Map(); // YYYY-MM-DD -> { net, total, steps, messages }
    const modelMap = new Map(); // displayName -> { name, steps, input, cacheRead, output, net, total }

    for (const s of summaries) {
      if (s.lastMs >= sinceMs && (!s.agentName || s.agentName === 'magpie-bridge')) {
        activeConvIds.add(s.id);
      }
    }

    for (const conv of perConv) {
      let convTouched = false;
      for (const e of conv.events) {
        if (sinceMs > 0 && (!e.tsMs || e.tsMs < sinceMs)) continue;
        convTouched = true;
        const dayKey = e.tsMs ? toLocalDayKey(e.tsMs) : '';
        if (dayKey && !dayMap.has(dayKey)) {
          dayMap.set(dayKey, { date: dayKey, net: 0, total: 0, steps: 0, messages: 0 });
        }

        if (e.kind === 'user_msg') {
          userMessages++;
          if (dayKey) dayMap.get(dayKey).messages++;
          if (e.tsMs) hourBuckets[new Date(e.tsMs).getHours()] += 1;
        } else if (e.kind === 'model_usage') {
          modelSteps++;
          const net = e.input + e.output;
          const tot = net + e.cacheRead;
          totalInput += e.input;
          totalCacheRead += e.cacheRead;
          totalOutput += e.output;
          if (dayKey) {
            const d = dayMap.get(dayKey);
            d.net += net;
            d.total += tot;
            d.steps++;
            d.messages++;
          }
          if (e.tsMs) {
            hourBuckets[new Date(e.tsMs).getHours()] += 1;
          }
          const mName = e.modelName || 'Unknown Model';
          const mPool = e.pool || classifyModelPool(e.modelRaw || mName);
          if (!modelMap.has(mName)) {
            modelMap.set(mName, { name: mName, pool: mPool, steps: 0, input: 0, cacheRead: 0, output: 0, net: 0, total: 0 });
          }
          const mm = modelMap.get(mName);
          mm.steps++;
          mm.input += e.input;
          mm.cacheRead += e.cacheRead;
          mm.output += e.output;
          mm.net += net;
          mm.total += tot;
        }
      }
      if (convTouched) activeConvIds.add(conv.id);
    }

    const tokensNet = totalInput + totalOutput;
    const tokensTotal = tokensNet + totalCacheRead;
    const activeDays = [...dayMap.values()].filter((d) => d.steps > 0 || d.messages > 0).length;

    let peakHour = 0;
    let peakVal = -1;
    for (let h = 0; h < 24; h++) {
      if (hourBuckets[h] > peakVal) {
        peakVal = hourBuckets[h];
        peakHour = h;
      }
    }

    const models = [...modelMap.values()]
      .sort((a, b) => b.total - a.total)
      .map((m) => ({
        ...m,
        shareTotalPct: tokensTotal > 0 ? Math.round((m.total / tokensTotal) * 1000) / 10 : 0,
        shareNetPct: tokensNet > 0 ? Math.round((m.net / tokensNet) * 1000) / 10 : 0,
      }));

    // Build 24 columns x 7 rows heatmap ending on the current week's Saturday (Sun=0..Sat=6)
    const today = new Date(nowMs);
    today.setHours(0, 0, 0, 0);
    const endDow = today.getDay(); // 0=Sun..6=Sat
    const cols = 24;
    const endDate = new Date(today.getTime() + (6 - endDow) * 86_400_000);
    const startDate = new Date(endDate.getTime() - (cols * 7 - 1) * 86_400_000);

    const quantile = (arr, q) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * q))] : 0);
    const activeTotals = [...dayMap.values()].map((d) => d.total).filter((v) => v > 0).sort((a, b) => a - b);
    const activeNets = [...dayMap.values()].map((d) => d.net).filter((v) => v > 0).sort((a, b) => a - b);
    const q1 = quantile(activeTotals, 0.25);
    const q2 = quantile(activeTotals, 0.5);
    const q3 = quantile(activeTotals, 0.8);
    const n1 = quantile(activeNets, 0.25);
    const n2 = quantile(activeNets, 0.5);
    const n3 = quantile(activeNets, 0.8);

    const levelOf = (val, t1, t2, t3) => {
      if (val <= 0) return 0;
      if (val >= t3 && t3 > 0) return 4;
      if (val >= t2 && t2 > 0) return 3;
      if (val >= t1 && t1 > 0) return 2;
      return 1;
    };

    const cells = [];
    for (let i = 0; i < cols * 7; i++) {
      const cur = new Date(startDate.getTime() + i * 86_400_000);
      const isFuture = cur.getTime() > today.getTime();
      const dateKey = toLocalDayKey(cur.getTime());
      const rec = dayMap.get(dateKey);
      const total = rec ? rec.total : 0;
      const net = rec ? rec.net : 0;
      const steps = rec ? rec.steps : 0;
      const messages = rec ? rec.messages : 0;
      cells.push({
        date: dateKey,
        month: cur.getMonth() + 1,
        day: cur.getDate(),
        isFuture,
        total,
        net,
        steps,
        messages,
        level: isFuture ? 0 : levelOf(total, q1, q2, q3),
        levelNet: isFuture ? 0 : levelOf(net, n1, n2, n3),
      });
    }

    return {
      sessions: activeConvIds.size,
      userMessages,
      modelSteps,
      messages: userMessages + modelSteps,
      tokensTotal,
      tokensNet,
      tokensInput: totalInput,
      tokensCacheRead: totalCacheRead,
      tokensOutput: totalOutput,
      activeDays,
      peakHour: peakVal > 0 ? peakHour : null,
      topModel: models[0] ? models[0].name : '—',
      models,
      heatmap: {
        cols,
        rows: 7,
        cells,
      },
    };
  }

  return {
    getSnapshot() {
      return gatherAllEvents(Date.now());
    },
  };
}
