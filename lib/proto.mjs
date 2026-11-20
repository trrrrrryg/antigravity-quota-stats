/**
 * Lightweight zero-dependency protobuf wire-format decoder for Antigravity
 * SQLite metadata blobs (`gen_metadata` and `steps.metadata`).
 */

export const BASE_MODEL_ENUM_MAP = {
  1322: 'gemini-3.8-flash-tiered',
  1401: 'claude-opus-5-5-medium',
  1403: 'claude-sonnet-5-5-low',
  1417: 'gemini-4-argon-trial',
  1418: 'gemini-4-argon-trial',
  1525: 'gemini-4-hydrogen',
  1528: 'gemini-4-hydrogen',
  1537: 'gemini-pro-orchestrator-neon',
  1667: 'gemini-pro-orchestrator',
  1668: 'gemini-pro-orchestrator-g1-pro',
  1669: 'gemini-flash-worker-agy',
};

const MODEL_DISPLAY_RULES = [
  [/gemini-4-hydrogen/i, 'Gemini 4 Hydrogen'],
  [/gemini-4-neon/i, 'Gemini 4 Neon'],
  [/gemini-4-argon/i, 'Gemini 4 Argon'],
  [/gemini-4-helium/i, 'Gemini 4 Helium'],
  [/gemini-pro-orchestrator-neon/i, 'Orchestrator (Neon)'],
  [/gemini-pro-orchestrator-g1-pro/i, 'Orchestrator (Argon)'],
  [/gemini-pro-orchestrator/i, 'Orchestrator'],
  [/gemini-flash-worker/i, 'Flash Worker'],
  [/gemini-3\.8-flash/i, 'Gemini 3.8 Flash'],
  [/gemini-3/i, 'Gemini 3'],
  [/claude-opus-5-5|claude-opus-4/i, 'Claude Opus 5.5'],
  [/claude-sonnet-5-5|claude-sonnet-4/i, 'Claude Sonnet 5.5'],
  [/gpt-oss/i, 'GPT-OSS 120B'],
];

export function classifyModelPool(rawOrDisplay) {
  const s = String(rawOrDisplay || '').toLowerCase();
  if (!s) return 'gemini';
  if (s.includes('argon') || s.includes('g1-pro') || s.includes('m417') || s.includes('m418') || s.includes('m668')) {
    return 'argon';
  }
  if (s.includes('claude') || s.includes('gpt') || s.includes('m401') || s.includes('m403')) {
    return 'claude';
  }
  return 'gemini';
}

export function formatModelDisplayName(rawId) {
  if (!rawId) return 'Unknown Model';
  const s = String(rawId).trim();
  for (const [re, label] of MODEL_DISPLAY_RULES) {
    if (re.test(s)) return label;
  }
  const ph = /^MODEL_PLACEHOLDER_([A-Z0-9_]+)$/i.exec(s);
  if (ph) return `Model ${ph[1]}`;
  return s
    .replace(/-(tiered|trial|medium|high|xhigh|low|agy)$/i, '')
    .split('-')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ''))
    .join(' ');
}

export function decodeProtoFields(buf, maxDepth = 2, depth = 0) {
  const fields = [];
  let pos = 0;
  const len = buf.length;

  const readVarint = () => {
    let val = 0n;
    let shift = 0n;
    while (pos < len) {
      const b = buf[pos++];
      val |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return val;
      shift += 7n;
      if (shift > 70n) throw new Error('varint overflow');
    }
    throw new Error('eof in varint');
  };

  while (pos < len) {
    const tag = readVarint();
    const f = Number(tag >> 3n);
    const wt = Number(tag & 7n);
    if (f <= 0) throw new Error('invalid field');

    if (wt === 0) {
      fields.push({ f, wt, v: Number(readVarint()) });
    } else if (wt === 2) {
      const byteLen = Number(readVarint());
      if (byteLen < 0 || pos + byteLen > len) throw new Error('invalid length');
      const slice = buf.subarray(pos, pos + byteLen);
      pos += byteLen;
      let sub = null;
      if (depth < maxDepth && byteLen > 2 && byteLen < 8192) {
        try {
          sub = decodeProtoFields(slice, maxDepth, depth + 1);
        } catch {}
      }
      fields.push({ f, wt, slice, sub });
    } else if (wt === 5) {
      if (pos + 4 > len) throw new Error('eof i32');
      pos += 4;
      fields.push({ f, wt });
    } else if (wt === 1) {
      if (pos + 8 > len) throw new Error('eof i64');
      pos += 8;
      fields.push({ f, wt });
    } else {
      throw new Error('unsupported wire type ' + wt);
    }
  }
  return fields;
}

export function extractEnumModelPairs(buf, targetMap) {
  let top;
  try {
    top = decodeProtoFields(buf, 3);
  } catch {
    return;
  }
  const f1 = top.find((x) => x.f === 1 && x.sub);
  if (!f1) return;

  const enumId =
    f1.sub.find((x) => x.f === 3 && x.wt === 0)?.v ||
    f1.sub.find((x) => x.f === 4 && x.sub)?.sub?.find((x) => x.f === 1 && x.wt === 0)?.v;
  if (!enumId) return;

  const candidates = [];
  const walk = (arr) => {
    for (const item of arr || []) {
      if (item.wt === 2 && !item.sub && item.slice.length >= 4 && item.slice.length <= 64) {
        const txt = item.slice.toString('utf8');
        if (/^(?:gemini|claude|gpt)-[a-z0-9._-]+$/i.test(txt)) {
          candidates.push(txt);
        }
      }
      if (item.sub) walk(item.sub);
    }
  };
  walk(f1.sub);
  if (candidates.length > 0) {
    targetMap.set(enumId, candidates[0]);
  }
}

export function parseStepMetadata(buf) {
  let top;
  try {
    top = decodeProtoFields(buf, 2);
  } catch {
    return null;
  }

  let tsSec = 0;
  for (const fieldNum of [6, 7, 8, 32]) {
    const tf = top.find((x) => x.f === fieldNum && x.sub);
    const sec = tf?.sub?.find((x) => x.f === 1 && x.wt === 0)?.v;
    if (sec && sec > 1_600_000_000 && sec < 2_500_000_000) {
      tsSec = sec;
      break;
    }
  }

  const f9 = top.find((x) => x.f === 9 && x.sub);
  const f11 = top.find((x) => x.f === 11 && x.wt === 0)?.v || 0;
  let usage = null;
  if (f9) {
    const modelEnum = f9.sub.find((x) => x.f === 1 && x.wt === 0)?.v || f11 || 0;
    const inputTokens = f9.sub.find((x) => x.f === 2 && x.wt === 0)?.v || 0;
    const outputTokens = f9.sub.find((x) => x.f === 3 && x.wt === 0)?.v || 0;
    const cacheReadTokens = f9.sub.find((x) => x.f === 5 && x.wt === 0)?.v || 0;
    if (inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0) {
      usage = {
        modelEnum,
        inputTokens,
        outputTokens,
        cacheReadTokens,
      };
    }
  }

  return {
    tsMs: tsSec ? tsSec * 1000 : 0,
    usage,
  };
}
