/* Keys built dynamically (not visible to the t('…') scanner) that zh.js must still contain. */
const TYPES = ['trigger', 'agent', 'tool', 'decision', 'control', 'data', 'outcome', 'prohibited'];
const GROUPS = ['inputs', 'agents', 'logic', 'data', 'outcomes'];
const LINT = ['no_trigger', 'unreachable', 'cycle', 'dangling_port', 'no_success_outcome', 'unused_data', 'no_watches', 'bad_watch', 'expr_syntax', 'expr_unknown_identifier', 'missing_config'];
const EFFECTS = ['data_read', 'write', 'write_denied', 'approval_issued', 'approval_denied', 'approval_reused', 'approval_consumed', 'redact', 'emit', 'error'];
const MONITORS = ['unauthorized_write', 'duplicate_effect', 'secret_exposure'];
/* Decision Trace: keys that localise derive.js / mapping.js output (trace/tr.js). */
const TRACE = [
  ...['authority', 'approval binding', 'idempotency', 'taint'].map(x => `trace.law.${x}`),
  ...['below_threshold', 'split', 'replay', 'duplicate_submit', 'injection_exfil', 'benign'].map(x => `trace.sampling.${x}`),
  ...['below_threshold.owasp:LLM06', 'below_threshold.owaspa:T2', 'split.owasp:LLM06', 'split.owaspa:T2', 'replay.owaspa:T3',
      'injection_exfil.atlas:AML.T0051', 'injection_exfil.owasp:LLM01', 'injection_exfil.owasp:LLM02'].map(x => `trace.limit.${x}`),
  ...['ag:planner', 'ag:tool-reg', 'ag:hitl', 'ag:guardrail', 'ag:harness'].map(x => `trace.crit.${x}`),
  ...['data', 'trigger', 'decision', 'control'].map(x => `trace.unmapped.${x}`),
  ...['0', '1', '2', '3'].map(x => `trace.elig.${x}`),
  ...['friction', 'addedLatencyMedian', 'patchOps'].map(x => `trace.rank.${x}`),
  ...['risk', 'friction', 'latency', 'coverage', 'compliance', 'cost', 'performance'].map(x => `trace.obj.${x}`),
  ...['eligible', 'ineligible', 'stale', 'rejected', 'approved'].map(x => `trace.state.${x}`),
  ...['step', 'class', 'threat', 'family', 'finding', 'candidate', 'decision'].flatMap(x => [`trace.kind.${x}`, `trace.col.${x}`])
];
export const REQUIRED_KEYS = [
  ...TYPES.flatMap(x => [`node.${x}.label`, `node.${x}.desc`, `node.${x}.syn`]),
  ...GROUPS.map(g => `group.${g}`),
  ...LINT.map(c => `lint.${c}`),
  ...EFFECTS.map(e => `effect.${e}`),
  ...MONITORS.flatMap(m => [`monitor.${m}.label`, `monitor.${m}.desc`]),
  ...TRACE
];
