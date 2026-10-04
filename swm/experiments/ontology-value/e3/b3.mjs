// b3.mjs — X2b B3 runner (plan § E3): a hosted LLM (DeepSeek) asked to list other attack paths WITHOUT the
// ontology, given only the suite manifest and ONE fold's blocked call. The request carries NOTHING but the
// prompt, this suite's tools and this fold's calls (no second fold, no annotation, no goal).
//
// canonicalJSON: object keys sorted recursively, arrays in given order, no whitespace. The exact
// serializeRequest() byte string is what gets logged and POSTed, so F3-b3 can rebuild it byte-identically.
import { CLASSES } from './predict.mjs';

export function canonicalJSON(x) {
  if (Array.isArray(x)) return '[' + x.map(canonicalJSON).join(',') + ']';
  if (x !== null && typeof x === 'object') {
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonicalJSON(x[k])).join(',') + '}';
  }
  return JSON.stringify(x);
}

export function buildRequest(fold, tools, promptText) {
  const toolList = tools
    .map(t => ({ name: t.name, description: t.description }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    model: 'deepseek-v4-pro',
    temperature: 0,
    messages: [
      { role: 'system', content: promptText },
      {
        role: 'user',
        content: canonicalJSON({
          suite: fold.suite,
          tools: toolList,
          blocked_observation: { calls: fold.blocked?.calls ?? [] },
        }),
      },
    ],
  };
}

export function serializeRequest(req) {
  return canonicalJSON(req);
}

export async function send(req) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: serializeRequest(req),
  });
  if (!res.ok) throw new Error(`deepseek http ${res.status}`);
  return await res.text();
}

function extractJSONArray(text) {
  const start = text.indexOf('[');
  if (start < 0) throw new Error('no JSON array in response');
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  throw new Error('unterminated JSON array in response');
}

// Parses the model's response into the common schema. Unknown tools/classes are dropped and counted.
export function parseResponse(text, tools) {
  let arr;
  try {
    arr = JSON.parse(extractJSONArray(text));
  } catch (e) {
    throw new Error('parse failure: ' + e.message);
  }
  if (!Array.isArray(arr)) throw new Error('response is not an array');
  const toolNames = new Set(tools.map(t => t.name));
  const classSet = new Set(CLASSES);
  const seen = new Set();
  const predictions = [];
  const dropped = { unknown_tool: 0, unknown_class: 0, malformed: 0 };
  for (const item of arr) {
    if (!item || typeof item !== 'object') { dropped.malformed++; continue; }
    const tool = typeof item.tool === 'string' ? item.tool : null;
    const cls = typeof item.class === 'string' ? item.class : null;
    if (!tool || !cls) { dropped.malformed++; continue; }
    if (!toolNames.has(tool)) { dropped.unknown_tool++; continue; }
    if (!classSet.has(cls)) { dropped.unknown_class++; continue; }
    const key = `${tool}\u0000${cls}`;
    if (seen.has(key)) continue;
    seen.add(key);
    predictions.push({ tool, class: cls, rank: predictions.length + 1 });
    if (predictions.length >= 10) break;
  }
  return { predictions, dropped };
}
