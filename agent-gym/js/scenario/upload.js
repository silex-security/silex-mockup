// Local test-case files for the Upload source. The browser reads the file; nothing is uploaded anywhere. This module
// is the boundary: it checks the file before reading, parses JSON or CSV, and turns each accepted row into a base
// scenario spec. A summary is shown before anything is applied.
import { EXPECTED_OUTCOME } from '../simulation/assertions.js';

export const UPLOAD_LIMITS = Object.freeze({ maxBytes: 64 * 1024, extensions: ['.json', '.csv'], maxRows: 20, maxField: 500 });

// Accepted field names; CSV headers may use the snake_case spelling.
const FIELDS = { title: 'title', prompt: 'prompt', initialState: 'initialState', initial_state: 'initialState', task: 'task', expectedBehavior: 'expectedBehavior', expected_behavior: 'expectedBehavior', outcome: 'outcome' };
const REQUIRED = ['title', 'prompt', 'outcome'];
export const UPLOAD_FIELDS = Object.freeze(['title', 'prompt', 'initial_state', 'task', 'expected_behavior', 'outcome']);

const FORBIDDEN = [
  [/<\s*\/?\s*script/i, 'contains a script tag'],
  [/javascript\s*:/i, 'contains a javascript: link'],
  [/\b(?:https?|ftp|file):\/\//i, 'contains an external URL'],
  [/\bwww\.[a-z0-9-]+\./i, 'contains an external URL'],
  [/\bdata:[a-z]+\/[a-z0-9.+-]+[;,]/i, 'contains a data URL'],
  [/<\s*(iframe|object|embed|img|svg|link|style)\b/i, 'contains HTML markup'],
  [/\bon[a-z]+\s*=/i, 'contains an inline event handler'],
];

const extensionOf = name => { const i = String(name).lastIndexOf('.'); return i < 0 ? '' : String(name).slice(i).toLowerCase(); };

/** Checks name and size before the browser reads the file. Returns a problem message or null. */
export function checkFileMeta({ name, size }) {
  const ext = extensionOf(name);
  if (!UPLOAD_LIMITS.extensions.includes(ext)) return `Only ${UPLOAD_LIMITS.extensions.join(' or ')} files are accepted.`;
  if (!(size > 0)) return 'The file is empty.';
  if (size > UPLOAD_LIMITS.maxBytes) return `The file is ${Math.ceil(size / 1024)} KB; the limit is ${UPLOAD_LIMITS.maxBytes / 1024} KB.`;
  return null;
}

/** RFC 4180 style: quoted fields, doubled quotes, CRLF or LF. Returns rows of cells. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw Error('a quoted field is not closed');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function recordsOf(format, text) {
  if (format === 'json') {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray(data.scenarios) ? data.scenarios : null;
    if (!list) throw Error('expected an array of test cases or { "scenarios": [...] }');
    return list;
  }
  const [header, ...rows] = parseCsv(text);
  if (!header) throw Error('the file has no header row');
  const names = header.map(h => h.trim());
  return rows.map(cells => {
    if (cells.length !== names.length) return { __error: `has ${cells.length} cells; the header has ${names.length}` };
    return Object.fromEntries(names.map((n, i) => [n, cells[i]]));
  });
}

function rowSpec(record, fileName) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { reason: 'is not an object' };
  if (record.__error) return { reason: record.__error };
  const fields = {};
  for (const [key, value] of Object.entries(record)) {
    const name = FIELDS[key];
    if (!name) return { reason: `has an unknown field "${String(key).slice(0, 40)}"` };
    if (typeof value !== 'string') return { reason: `field ${key} is not text` };
    if (value.length > UPLOAD_LIMITS.maxField) return { reason: `field ${key} is longer than ${UPLOAD_LIMITS.maxField} characters` };
    fields[name] = value.trim();
  }
  const missing = REQUIRED.filter(k => !fields[k]);
  if (missing.length) return { reason: `is missing ${missing.join(', ')}` };
  if (!(fields.outcome in EXPECTED_OUTCOME)) return { reason: `has an unsupported outcome "${fields.outcome.slice(0, 40)}"` };
  return {
    spec: {
      title: fields.title.slice(0, 80), source: { kind: 'upload', label: `Upload · ${fileName}` },
      messages: [{ turn: 1, role: 'user', text: fields.prompt }],
      initialState: { summary: fields.initialState || 'Default seeded data', patch: {} },
      task: fields.task || fields.title.slice(0, 80),
      expectedBehavior: { summary: fields.expectedBehavior || EXPECTED_OUTCOME[fields.outcome].label, outcome: fields.outcome },
      stateChecks: [], scriptedEvents: [],
    },
  };
}

/**
 * Parses a local file the browser has already read.
 * @returns {{ ok: boolean, error: string|null, rows: {line:number, spec:object}[], rejected: {line:number, reason:string}[],
 *   summary: { fileName:string, format:string, total:number, accepted:number, rejected:number } }}
 */
export function parseUpload({ name, size, text }) {
  const fileName = String(name).split(/[\\/]/).pop().slice(0, 60);
  const format = extensionOf(name).slice(1);
  const empty = error => ({ ok: false, error, rows: [], rejected: [], summary: { fileName, format, total: 0, accepted: 0, rejected: 0 } });
  const meta = checkFileMeta({ name, size: size ?? new TextEncoder().encode(text).length });
  if (meta) return empty(meta);
  for (const [pattern, why] of FORBIDDEN) if (pattern.test(text)) return empty(`The file ${why}. Scripts, markup and links are not accepted.`);
  let records;
  try { records = recordsOf(format, text); } catch (e) { return empty(`The file could not be read as ${format.toUpperCase()}: ${e.message}.`); }
  if (records.length === 0) return empty('The file has no test cases.');
  if (records.length > UPLOAD_LIMITS.maxRows) return empty(`The file has ${records.length} test cases; the limit is ${UPLOAD_LIMITS.maxRows}.`);
  const rows = [], rejected = [];
  records.forEach((record, i) => {
    const line = format === 'csv' ? i + 2 : i + 1;
    const r = rowSpec(record, fileName);
    if (r.spec) rows.push({ line, spec: r.spec }); else rejected.push({ line, reason: `${format === 'csv' ? 'Row' : 'Item'} ${line} ${r.reason}` });
  });
  return { ok: rows.length > 0, error: rows.length ? null : 'No test case passed the checks.', rows, rejected, summary: { fileName, format, total: records.length, accepted: rows.length, rejected: rejected.length } };
}
