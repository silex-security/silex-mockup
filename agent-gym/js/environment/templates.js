// Saving a validated draft as an immutable EnvironmentRevision, and checking a revision against an experiment.
//
//   templateRefFor(state, draftId) -> Ref        the revision Save as template writes (or already wrote)
//   saveEnvironmentTemplate(state, { draftId, validationDigest }) -> { state } | { error }
//   environmentDependencyCheck(state, experimentId, ref) -> { ok, errors, missing, warnings }
// Saving never overwrites a revision. Template ids start with `tpl-`, so they never collide with a fixture id.
import { refKey, uniqueIds } from '../model.js';
import { buildEnvironmentRevision } from '../fixtures/environments.js';
import { validateExperiment } from '../validators.js';
import { setEnvironment } from '../simulation/attempts.js';
import { draftStatus } from './commands.js';
import { behaviourDigest } from './validate.js';

const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'environment';

function revisionContent(draft, id, rev) {
  const notes = [`${draft.relations.length} field links`, 'Permissions', 'Tool behavior'];
  return buildEnvironmentRevision({
    id, rev, name: draft.name, icon: 'database',
    caps: uniqueIds(draft.components.map(c => c.category)).slice(0, 3), notes,
    components: draft.components, relations: draft.relations, dataSeed: draft.dataSeed,
  });
}

const revisionsOf = (state, id) => Object.values(state.environments).filter(e => e.id === id).sort((a, b) => Number(a.rev) - Number(b.rev));

/** Same behaviour as the latest saved revision of this template reuses it; anything else is the next integer revision. */
function plan(state, draft) {
  const id = draft.baseRef?.id ?? `tpl-${slug(draft.name)}`;
  const latest = revisionsOf(state, id).at(-1);
  if (latest && revisionContent(draft, id, latest.rev).digest === latest.digest) return { id, rev: latest.rev, existing: latest };
  return { id, rev: String((latest ? Number(latest.rev) : 0) + 1), existing: null };
}

export const templateRefFor = (state, draftId) => {
  const { id, rev } = plan(state, state.environmentDrafts[draftId]);
  return { id, rev };
};

export function saveEnvironmentTemplate(state, { draftId, validationDigest }) {
  const draft = state.environmentDrafts[draftId];
  if (!draft) return { error: { code: 'draft_missing', message: `No environment draft ${draftId}` } };
  if (draftStatus(draft) !== 'validated' || validationDigest !== behaviourDigest(draft))
    return { error: { code: 'validation_stale', message: 'Validate the current draft before saving it as a template' } };
  const { id, rev, existing } = plan(state, draft);
  const baseRef = { id, rev };
  const withBase = { ...state, environmentDrafts: { ...state.environmentDrafts, [draftId]: { ...draft, baseRef } } };
  if (existing) return { state: withBase };
  const revision = revisionContent(draft, id, rev);
  // The draft's report checked exactly this content; it is re-keyed to the revision digest the run gate compares.
  return { state: { ...withBase, environments: { ...withBase.environments, [refKey(revision)]: { ...revision, validation: { ...draft.validation, digest: revision.digest } } } } };
}

const ENVIRONMENT_CODES = ['environment_missing', 'environment_not_validated', 'dependency_unmatched'];

/** The run gate's environment checks for `experimentId` as if it used `ref`. Nothing is written. */
export function environmentDependencyCheck(state, experimentId, ref) {
  if (!state.experiments[experimentId]) return { ok: false, errors: [{ code: 'experiment_missing', message: `No experiment ${experimentId}` }], missing: [], warnings: [] };
  const trial = setEnvironment(state, { experimentId, environmentRef: ref });
  if (trial.error) return { ok: false, errors: [trial.error], missing: [], warnings: [] };
  const report = validateExperiment(trial.state, experimentId);
  const errors = report.errors.filter(e => ENVIRONMENT_CODES.includes(e.code));
  return { ok: errors.length === 0, errors, missing: report.dependencyReport.missing, warnings: report.warnings.filter(w => w.code === 'set_environment_differs') };
}
