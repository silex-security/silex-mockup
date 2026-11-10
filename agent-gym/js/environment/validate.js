// validateEnvironment(draft, requirements?) -> ValidationReport. Pure. The report carries the behaviour digest of
// the draft it checked, so any later behaviour-changing edit makes it stale (commands.js draftStatus).
// Each RULE returns issues; an issue with level 'warning' is advisory, every other issue is an error.
import { capabilityOf, digestOf, uniqueIds } from '../model.js';
import { ENVIRONMENTS, deriveCapabilities, deriveFaultCapabilities } from '../fixtures/environments.js';
import { WORKFLOWS } from '../fixtures/workflows.js';
import { SCENARIOS, SCENARIO_SETS } from '../fixtures/scenarios.js';
import { faultCapabilityOf } from '../simulation/adapters.js';
import { LINK_FIELDS, PERMISSION_LABEL } from './catalog.js';

const salesWorkflow = WORKFLOWS.find(w => w.id === 'wf-sales-follow-up');
const followUpSet = SCENARIO_SETS.find(s => s.id === 'set-follow-up-resilience');
const salesEnv = ENVIRONMENTS.find(e => e.id === 'env-sales');
const followUpScenarios = followUpSet.scenarioRefs.map(r => SCENARIOS.find(s => s.id === r.id && s.rev === r.rev));

/** What the Sales follow-up workflow and its resilience scenario set need from an environment. */
export const SALES_FOLLOW_UP = Object.freeze({
  name: salesWorkflow.name,
  capabilities: Object.freeze([...salesWorkflow.requiredCapabilities]),
  approvalRequiredFor: Object.freeze([...salesWorkflow.policySnapshot.approvalRequiredFor]),
  faultCapabilities: Object.freeze(uniqueIds(followUpScenarios.flatMap(s => s.overrides.filter(o => o.kind === 'fault').map(o => faultCapabilityOf(salesEnv, o))))),
});

/** The fingerprint a report is pinned to. Layout, names, descriptions and chat do not change behavior. */
export const behaviourDigest = d => digestOf({
  components: d.components.map(({ pos, name, description, ...rest }) => rest),
  relations: d.relations, dataSeed: d.dataSeed,
  assumptions: d.assumptions.map(({ text, ...rest }) => rest),
});

const TOOL_NAME = /^[a-z][a-z0-9_]{0,47}$/;
const TYPE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\[\])?$/;
const ENUMS = {
  permission: Object.keys(PERMISSION_LABEL),
  failureBehavior: ['none', 'timeout_after_send'],
  dedup: ['none', 'idempotency_key', 'custom_adapter'],
};

const error = (code, message, componentId) => ({ code, message, ...(componentId && { componentId }) });
const warning = (code, message, componentId) => ({ level: 'warning', ...error(code, message, componentId) });
const enabledWrites = c => c.tools.filter(t => t.effect === 'write' && c.enabledTools.includes(t.name));
const isSchema = s => s && typeof s === 'object' && !Array.isArray(s) && Object.entries(s).every(([k, v]) => /^[A-Za-z][A-Za-z0-9_]*$/.test(k) && typeof v === 'string' && TYPE_NAME.test(v));

export const RULES = Object.freeze({
  basics(draft) {
    const out = [];
    if (!draft.name?.trim()) out.push(error('name_missing', 'Give the environment a name'));
    if (!draft.components.length) out.push(error('no_components', 'Add at least one simulated component'));
    return out;
  },
  toolSchemas(draft) {
    return draft.components.flatMap(c => {
      const out = [];
      const names = c.tools.map(t => t.name);
      if (!c.tools.length) out.push(error('tool_schema', `${c.name} has no tools`, c.id));
      for (const t of c.tools) {
        if (!TOOL_NAME.test(t.name ?? '')) out.push(error('tool_schema', `${c.name}: "${t.name}" is not a valid tool name`, c.id));
        if (t.effect !== 'read' && t.effect !== 'write') out.push(error('tool_schema', `${c.name}: ${t.name} must be a read or a write tool`, c.id));
        if (!isSchema(t.input) || !isSchema(t.output)) out.push(error('tool_schema', `${c.name}: ${t.name} has an invalid input or output schema`, c.id));
      }
      if (new Set(names).size !== names.length) out.push(error('tool_schema', `${c.name} defines a tool twice`, c.id));
      for (const t of c.enabledTools) if (!names.includes(t)) out.push(error('tool_schema', `${c.name} enables ${t}, which it does not define`, c.id));
      return out;
    });
  },
  componentSettings(draft) {
    return draft.components.flatMap(c => [
      ...(c.mode !== 'simulated' ? [error('mode_unsupported', `${c.name} must be Simulated`, c.id)] : []),
      ...Object.entries(ENUMS).filter(([key, values]) => !values.includes(c[key])).map(([key]) => error('setting_unknown', `${c.name} has an unknown ${key} "${c[key]}"`, c.id)),
    ]);
  },
  references(draft) {
    const ids = draft.components.map(c => c.id);
    const out = [];
    if (new Set(ids).size !== ids.length) out.push(error('reference_integrity', 'Two components share one ID'));
    for (const r of draft.relations) for (const end of [r.from, r.to]) if (!ids.includes(end))
      out.push(error('reference_integrity', `The ${r.field} relationship points at ${end}, which is not in this environment`));
    for (const a of draft.assumptions) if (a.componentId && !ids.includes(a.componentId))
      out.push(error('reference_integrity', `Assumption "${a.text}" refers to a missing component`));
    return out;
  },
  relationFields(draft) {
    return draft.relations.flatMap(r => {
      const ends = [r.from, r.to].map(id => draft.components.find(c => c.id === id));
      if (ends.some(c => !c)) return [];
      if (r.from === r.to) return [error('relation_field', `The ${r.field} relationship links ${ends[0].name} to itself`, r.from)];
      return ends.filter(c => !LINK_FIELDS[c.kind]?.[r.field]).map(c => error('relation_field', `${c.name} has no ${r.field} field for the relationship`, c.id));
    });
  },
  readOnly(draft) {
    return draft.components.filter(c => c.permission === 'read_only').flatMap(c =>
      enabledWrites(c).map(t => error('read_only_write', `${c.name} is read-only but enables the write tool ${t.name}`, c.id)));
  },
  approvalBoundary(draft, req) {
    return draft.components.flatMap(c => c.tools.filter(t => c.enabledTools.includes(t.name) && req.approvalRequiredFor.includes(capabilityOf(c, t.name)) && c.permission !== 'send_requires_approval')
      .map(t => error('approval_boundary', `${req.name} needs approval before ${t.name}; set ${c.name} to Send requires approval`, c.id)));
  },
  faultSupport(draft) {
    return draft.components.filter(c => c.failureBehavior === 'timeout_after_send').flatMap(c => [
      ...(!enabledWrites(c).length ? [error('fault_unsupported', `${c.name} has Timeout after send but no enabled write tool to commit`, c.id)] : []),
      ...(c.dedup === 'none' ? [warning('retry_duplicates', `${c.name}: a retry after the timeout can repeat the side effect, because deduplication is off`, c.id)] : []),
    ]);
  },
  dedupSupport(draft) {
    return draft.components.filter(c => c.dedup !== 'none').flatMap(c => {
      const out = enabledWrites(c).filter(t => !('idempotencyKey' in t.input))
        .map(t => error('dedup_unsupported', `${c.name}: ${t.name} takes no idempotency key, so it cannot deduplicate`, c.id));
      const status = c.tools.some(t => t.effect === 'read' && c.enabledTools.includes(t.name) && 'idempotencyKey' in t.input);
      if (c.dedup === 'custom_adapter' && !status) out.push(error('dedup_unsupported', `${c.name}: the custom adapter contract needs an enabled status tool that takes the idempotency key`, c.id));
      return out;
    });
  },
  requiredCapabilities(draft, req) {
    const have = new Set([...deriveCapabilities(draft.components), ...deriveFaultCapabilities(draft.components)]);
    const missing = [...req.capabilities, ...req.faultCapabilities].filter(cap => !have.has(cap));
    return missing.length ? [error('capability_missing', `${req.name} needs ${missing.join(', ')}, which no enabled tool or fault hook provides`)] : [];
  },
  linked(draft) {
    return draft.components.filter(c => draft.components.length > 1 && !draft.relations.some(r => r.from === c.id || r.to === c.id))
      .map(c => warning('component_unlinked', `${c.name} is not linked to any other component`, c.id));
  },
});

/** @returns {import('../model.js').ValidationReport} */
export function validateEnvironment(draft, requirements = SALES_FOLLOW_UP) {
  const issues = Object.values(RULES).flatMap(rule => rule(draft, requirements));
  const errors = issues.filter(i => i.level !== 'warning');
  const warnings = issues.filter(i => i.level === 'warning').map(({ level, ...w }) => w);
  const pendingAssumptionIds = draft.assumptions.filter(a => a.kind === 'behavior' && a.state === 'pending').map(a => a.id);
  return {
    digest: behaviourDigest(draft), errors, warnings, pendingAssumptionIds,
    status: errors.length ? 'invalid' : pendingAssumptionIds.length ? 'needs_review' : 'validated',
  };
}
