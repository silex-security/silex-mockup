// parseEnvironmentFixture(text, byteLength) -> { ok: true, content, summary } | { ok: false, errors }
// The boundary for the attach button: a local JSON fixture file is parsed into draft content with strict field,
// size and enum limits. Nothing is uploaded and nothing connects; the result only becomes an importFixture command.
import { DEDUP_LABEL, FAILURE_LABEL, LINK_FIELDS, PERMISSION_LABEL } from './catalog.js';

export const FIXTURE_LIMITS = Object.freeze({ bytes: 64 * 1024, components: 12, tools: 12, relations: 24, assumptions: 24, text: 200 });

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const TOOL = /^[a-z][a-z0-9_]{0,47}$/;
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const TYPE = /^[A-Za-z][A-Za-z0-9_]{0,31}(\[\])?$/;
const TOP = ['format', 'version', 'name', 'components', 'relations', 'dataSeed', 'assumptions'];
const COMPONENT = ['id', 'kind', 'app', 'name', 'category', 'description', 'mode', 'tools', 'enabledTools', 'permission', 'failureBehavior', 'dedup', 'pos'];

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = FIXTURE_LIMITS.text) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

function parseSchema(value, where, errors) {
  if (!isObject(value) || Object.keys(value).length > 16) { errors.push(`${where} must be an object of at most 16 fields`); return {}; }
  for (const [k, v] of Object.entries(value)) if (!FIELD_KEY.test(k) || typeof v !== 'string' || !TYPE.test(v)) errors.push(`${where}.${k} must map a field name to a type name`);
  return { ...value };
}

function parseComponent(raw, i, errors) {
  const where = `components[${i}]`;
  if (!isObject(raw)) { errors.push(`${where} must be an object`); return null; }
  for (const key of Object.keys(raw)) if (!COMPONENT.includes(key)) errors.push(`${where}.${key} is not a known field`);
  if (!ID.test(raw.id ?? '')) errors.push(`${where}.id must be lower-case letters, digits and dashes`);
  if (!(raw.kind in LINK_FIELDS)) errors.push(`${where}.kind must be one of ${Object.keys(LINK_FIELDS).join(', ')}`);
  for (const key of ['name', 'category']) if (!text(raw[key], 60)) errors.push(`${where}.${key} must be 1 to 60 characters`);
  if (raw.description != null && !text(raw.description)) errors.push(`${where}.description must be at most ${FIXTURE_LIMITS.text} characters`);
  if (raw.mode != null && raw.mode !== 'simulated') errors.push(`${where}.mode must be "simulated"; live connections are not supported`);
  for (const [key, labels, fallback] of [['permission', PERMISSION_LABEL, 'read_only'], ['failureBehavior', FAILURE_LABEL, 'none'], ['dedup', DEDUP_LABEL, 'none']])
    if ((raw[key] ?? fallback) in labels === false) errors.push(`${where}.${key} must be one of ${Object.keys(labels).join(', ')}`);
  const tools = Array.isArray(raw.tools) ? raw.tools : [];
  if (!Array.isArray(raw.tools) || !tools.length || tools.length > FIXTURE_LIMITS.tools) errors.push(`${where}.tools must list 1 to ${FIXTURE_LIMITS.tools} tools`);
  const parsedTools = tools.slice(0, FIXTURE_LIMITS.tools).map((t, j) => {
    const at = `${where}.tools[${j}]`;
    if (!isObject(t)) { errors.push(`${at} must be an object`); return null; }
    if (!TOOL.test(t.name ?? '')) errors.push(`${at}.name must be a snake_case tool name`);
    if (t.effect !== 'read' && t.effect !== 'write') errors.push(`${at}.effect must be "read" or "write"`);
    return { name: t.name, effect: t.effect, input: parseSchema(t.input, `${at}.input`, errors), output: parseSchema(t.output, `${at}.output`, errors) };
  }).filter(Boolean);
  const names = parsedTools.map(t => t.name);
  const enabledTools = raw.enabledTools ?? names;
  if (!Array.isArray(enabledTools) || enabledTools.some(t => !names.includes(t))) errors.push(`${where}.enabledTools must name tools the component defines`);
  return {
    id: raw.id, kind: raw.kind, app: typeof raw.app === 'string' && ID.test(raw.app) ? raw.app : raw.kind, name: raw.name, category: raw.category,
    description: raw.description ?? '', mode: 'simulated', tools: parsedTools, enabledTools: Array.isArray(enabledTools) ? [...enabledTools] : [],
    permission: raw.permission ?? 'read_only', failureBehavior: raw.failureBehavior ?? 'none', dedup: raw.dedup ?? 'none', pos: { x: i % 2, y: Math.floor(i / 2) },
  };
}

export function parseEnvironmentFixture(source, byteLength = source.length) {
  if (byteLength > FIXTURE_LIMITS.bytes) return { ok: false, errors: [`The file is ${Math.ceil(byteLength / 1024)} KB; the limit is ${FIXTURE_LIMITS.bytes / 1024} KB`] };
  let raw;
  try { raw = JSON.parse(source); } catch { return { ok: false, errors: ['The file is not valid JSON'] }; }
  if (!isObject(raw)) return { ok: false, errors: ['The file must contain one JSON object'] };
  const errors = [];
  for (const key of Object.keys(raw)) if (!TOP.includes(key)) errors.push(`${key} is not a known field`);
  if (!text(raw.name, 80)) errors.push('name must be 1 to 80 characters');
  if (!Array.isArray(raw.components) || !raw.components.length || raw.components.length > FIXTURE_LIMITS.components) errors.push(`components must list 1 to ${FIXTURE_LIMITS.components} components`);
  const components = (Array.isArray(raw.components) ? raw.components.slice(0, FIXTURE_LIMITS.components) : []).map((c, i) => parseComponent(c, i, errors)).filter(Boolean);
  const ids = components.map(c => c.id);
  if (new Set(ids).size !== ids.length) errors.push('component ids must be unique');
  const relations = raw.relations ?? [];
  if (!Array.isArray(relations) || relations.length > FIXTURE_LIMITS.relations) errors.push(`relations must list at most ${FIXTURE_LIMITS.relations} relationships`);
  const parsedRelations = (Array.isArray(relations) ? relations.slice(0, FIXTURE_LIMITS.relations) : []).map((r, i) => {
    if (!isObject(r) || !ids.includes(r.from) || !ids.includes(r.to) || !FIELD_KEY.test(r.field ?? '')) { errors.push(`relations[${i}] must link two listed components by a field name`); return null; }
    return { id: typeof r.id === 'string' && ID.test(r.id) ? r.id : `rel-${r.from}-${r.to}-${r.field}`, from: r.from, to: r.to, field: r.field };
  }).filter(Boolean);
  if (raw.dataSeed != null && !isObject(raw.dataSeed)) errors.push('dataSeed must be an object');
  const assumptions = raw.assumptions ?? [];
  if (!Array.isArray(assumptions) || assumptions.length > FIXTURE_LIMITS.assumptions) errors.push(`assumptions must list at most ${FIXTURE_LIMITS.assumptions} items`);
  const parsedAssumptions = (Array.isArray(assumptions) ? assumptions.slice(0, FIXTURE_LIMITS.assumptions) : []).map((a, i) => {
    const ok = isObject(a) && ID.test(a.id ?? '') && text(a.text) && ['info', 'behavior'].includes(a.kind) && (a.componentId == null || ids.includes(a.componentId));
    if (!ok) { errors.push(`assumptions[${i}] needs an id, text, kind "info" or "behavior", and a listed componentId or null`); return null; }
    return { id: a.id, componentId: a.componentId ?? null, text: a.text, kind: a.kind, state: 'pending' };
  }).filter(Boolean);
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) };
  const content = { name: raw.name.trim(), components, relations: parsedRelations, dataSeed: raw.dataSeed ?? {}, assumptions: parsedAssumptions };
  return {
    ok: true, content,
    summary: { name: content.name, systems: components.length, tools: components.reduce((n, c) => n + c.enabledTools.length, 0), relationships: parsedRelations.length, assumptions: parsedAssumptions.length },
  };
}
