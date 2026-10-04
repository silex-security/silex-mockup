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
  if (!res.ok) {
    const err = new Error(`deepseek http ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return await res.text();
}

// String-aware JSON parse of the assistant content: a bare JSON array, or an array wrapped in a
// single ```json fence. Throws if the content is not an array.
function parseContentArray(content) {
  let s = content.trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (m) s = m[1].trim();
  const parsed = JSON.parse(s);
  if (!Array.isArray(parsed)) throw new Error('content is not an array');
  return parsed;
}

function malformed() {
  return { status: 'malformed', predictions: [], dropped: { unknown_tool: 0, unknown_class: 0, malformed: 0 } };
}

// Parses a chat-completion envelope. Requires choices[0].message.content to be a string, then parses
// that content as a JSON array (bare or fenced). Unknown tools/classes are dropped and counted.
export function parseResponse(text, tools) {
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    return malformed();
  }
  const content = envelope?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return malformed();

  let arr;
  try {
    arr = parseContentArray(content);
  } catch {
    return malformed();
  }

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
  return { status: 'ok', predictions, dropped };
}
