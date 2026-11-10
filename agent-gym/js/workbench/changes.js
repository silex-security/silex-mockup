// What a variant changes against its baseline, read from the two versions' model configuration. Pure. The workbench strip,
// the Compare dialog and the shared-agent impact check all read it, so they cannot disagree about what changed.
import { versionModelConfig } from '../simulation/executor.js';

export function configRows(baseline, variant) {
  if (!baseline && !variant) return [];
  const keys = [...new Set([...Object.keys(baseline?.traits ?? {}), ...Object.keys(variant?.traits ?? {})])];
  return [
    { key: 'model', baseline: baseline?.model ?? '—', variant: variant?.model ?? '—' },
    ...keys.map(key => ({ key, baseline: baseline?.traits?.[key] ?? '—', variant: variant?.traits?.[key] ?? '—' })),
  ].map(row => ({ ...row, changed: row.baseline !== row.variant }));
}

/** Node-level diff of the baseline against the variant, every node listed. Null without a variant. */
export function nodeDiffOf(workflow, variant) {
  if (!variant) return null;
  const base = versionModelConfig({ workflow, variant }, 'baseline');
  const next = versionModelConfig({ workflow, variant }, 'variant');
  const rows = workflow.nodes.map(n => ({ id: n.id, label: n.label, chip: n.chip, agentId: n.agentId, changed: variant.changedNodeIds.includes(n.id), fields: configRows(base[n.id], next[n.id]) }));
  return { workflowName: workflow.name, variantName: variant.name, rows, changedCount: rows.filter(r => r.changed).length };
}

/** Every field of each changed step, with the ones that differ marked. Null without a variant. */
export function changeSetOf(workflow, variant) {
  const diff = nodeDiffOf(workflow, variant);
  if (!diff) return null;
  const rows = diff.rows.filter(r => r.changed).flatMap(r => r.fields.map(f => ({ nodeId: r.id, node: r.label, agentId: r.agentId, field: f.key, baseline: f.baseline, variant: f.variant, changed: f.changed })));
  return { baselineLabel: `${workflow.name} · rev ${workflow.rev}`, variantLabel: diff.variantName, rows, changeCount: rows.filter(r => r.changed).length };
}
