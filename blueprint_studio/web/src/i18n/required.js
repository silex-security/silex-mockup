/* Keys built dynamically (not visible to the t('…') scanner) that zh.js must still contain. */
const TYPES = ['trigger', 'agent', 'tool', 'decision', 'control', 'data', 'outcome', 'prohibited'];
const GROUPS = ['inputs', 'agents', 'logic', 'data', 'outcomes'];
const LINT = ['no_trigger', 'unreachable', 'cycle', 'dangling_port', 'no_success_outcome', 'unused_data', 'no_watches', 'bad_watch', 'expr_syntax', 'expr_unknown_identifier', 'missing_config'];
const EFFECTS = ['data_read', 'write', 'write_denied', 'approval_issued', 'approval_denied', 'approval_reused', 'approval_consumed', 'redact', 'emit', 'error'];
const MONITORS = ['unauthorized_write', 'duplicate_effect', 'secret_exposure'];
export const REQUIRED_KEYS = [
  ...TYPES.flatMap(x => [`node.${x}.label`, `node.${x}.desc`, `node.${x}.syn`]),
  ...GROUPS.map(g => `group.${g}`),
  ...LINT.map(c => `lint.${c}`),
  ...EFFECTS.map(e => `effect.${e}`),
  ...MONITORS.flatMap(m => [`monitor.${m}.label`, `monitor.${m}.desc`])
];
