// Agent Gym v2 domain shapes, enums and pure helpers. No DOM, no storage, no timers.
// docs/agent-gym-v2-contract.md names which module owns each shape.

export const SCHEMA_VERSION = 2;
export const FIXTURE_VERSION = 'gym-fx-1';
export const STORAGE_KEY = 'silex.gym.demo.v2';
export const DEMO_SEED = 29;

export const ATTEMPT_STATUS = Object.freeze(['queued', 'running', 'completed', 'cancelled', 'failed']);
export const TERMINAL_STATE = Object.freeze(['passed', 'failed', 'cancelled', 'error']);
export const REVIEW_DECISION = Object.freeze(['pass_for_demo', 'needs_iteration', 'reject']);
export const SCENARIO_REVIEW = Object.freeze(['draft', 'needs_review', 'reviewed']);
export const ENV_DRAFT_STATUS = Object.freeze(['draft', 'invalid', 'needs_review', 'validated']);
export const VARIATION_DIMENSION = Object.freeze(['prompt', 'tool_failure', 'permission', 'data_state']);
export const VERSION_ID = Object.freeze(['baseline', 'variant']);
export const REPETITIONS = Object.freeze({ min: 1, max: 10, default: 3 });
export const VARIATION_COUNT = Object.freeze({ min: 1, max: 20, default: 4 });

/**
 * @typedef {{ id: string, rev: string }} Ref            an immutable revision, keyed in the store as `id@rev`
 *
 * @typedef {Object} ToolSpec
 * @property {string} name                               e.g. 'send_email'
 * @property {'read'|'write'} effect
 * @property {Record<string,string>} input               field -> type name
 * @property {Record<string,string>} output
 *
 * @typedef {Object} Component                            one simulated system inside an environment
 * @property {string} id                                 'salesforce' | 'gmail' | 'gcal' | 'customdb' | ...
 * @property {'crm'|'email'|'calendar'|'db'|'tickets'|'payments'|'kb'|'identity'|'logs'|'cloud'} kind
 * @property {string} app                                icon key, see components/icons.js
 * @property {string} name
 * @property {string} category                           'CRM', 'Email', ...
 * @property {string} description
 * @property {'simulated'} mode                          the only legal mode
 * @property {ToolSpec[]} tools
 * @property {string[]} enabledTools                     subset of tools[].name
 * @property {'read_write'|'read_only'|'send_requires_approval'} permission
 * @property {'none'|'timeout_after_send'} failureBehavior  fault hook a scenario may inject
 * @property {'none'|'idempotency_key'|'custom_adapter'} dedup
 * @property {{x:number,y:number}} pos                   topology grid position
 *
 * @typedef {{ id: string, from: string, to: string, field: string }} Relation   a field link, not a data sync
 *
 * @typedef {Object} Assumption
 * @property {string} id
 * @property {string|null} componentId
 * @property {string} text
 * @property {'info'|'behavior'} kind                    only 'behavior' can block
 * @property {'pending'|'confirmed'} state
 *
 * @typedef {Object} ValidationReport
 * @property {string} digest                             digest of the draft it checked
 * @property {{code:string,message:string,componentId?:string}[]} errors
 * @property {{code:string,message:string,componentId?:string}[]} warnings
 * @property {string[]} pendingAssumptionIds
 * @property {'invalid'|'needs_review'|'validated'} status
 *
 * @typedef {Object} EnvironmentRevision                  immutable once saved
 * @property {string} id
 * @property {string} rev                                '1.2'
 * @property {string} name
 * @property {string} icon
 * @property {string[]} caps                             card subtitle, e.g. ['CRM','Email','Calendar']
 * @property {string[]} notes                            e.g. ['Shared contacts','Permissions','Tool behavior']
 * @property {Component[]} components
 * @property {Relation[]} relations
 * @property {Object} dataSeed                           synthetic records per component kind
 * @property {string[]} capabilities                     derived: `${kind}.${tool}` for every enabled tool
 * @property {string[]} faultCapabilities                derived: e.g. ['email.timeout_after_send']
 * @property {ValidationReport} validation
 * @property {string} digest
 *
 * @typedef {Object} EnvironmentDraft                     the N2 editor's working object
 * @property {string} id
 * @property {string} name
 * @property {Ref|null} baseRef
 * @property {number} revision                           edit counter, bumped by every applied command
 * @property {Component[]} components
 * @property {Relation[]} relations
 * @property {Object} dataSeed
 * @property {Assumption[]} assumptions
 * @property {{role:'user'|'assistant', text:string, chips?:string[], changes?:string[], kind?:string}[]} chat
 * @property {ValidationReport|null} validation          stale when validation.digest != digest of the draft
 * @property {{past:Object[], future:Object[]}} history   snapshots for undo and redo
 *
 * @typedef {Object} StateCheck                           rule-builder assertion, never user code
 * @property {string} id
 * @property {string} label
 * @property {string} path                               see simulation/assertions.js CHECK_PATHS
 * @property {'=='|'<='|'>='} op
 * @property {number|string|boolean} value
 *
 * @typedef {Object} ScenarioOverride                     per-run overlay, never written back to the template
 * @property {'fault'|'permission'|'data'} kind
 * @property {string} target                             e.g. 'gmail.send_email', 'contact.optOut'
 * @property {string|boolean|number} value
 * @property {string} label
 *
 * @typedef {Object} Scenario
 * @property {string} id
 * @property {string} rev
 * @property {string} title
 * @property {{kind:'chat'|'trace'|'blueprint'|'upload'|'fixture', label:string}} source
 * @property {string|null} baseId                        lineage for a variation
 * @property {{dimension:string, type:string, label:string}|null} variation
 * @property {{turn:number, role:'user', text:string}[]} messages   ordered; more than one for multi-turn
 * @property {{summary:string, patch:Object}} initialState
 * @property {string} task
 * @property {{summary:string, outcome:string}} expectedBehavior    outcome is an EXPECTED_OUTCOME key
 * @property {StateCheck[]} stateChecks
 * @property {ScenarioOverride[]} overrides
 * @property {{after:string, type:'approval_grant'}[]} scriptedEvents   trusted simulated events on the trace
 * @property {'draft'|'needs_review'|'reviewed'} reviewState
 * @property {'same_intent'|'review'|null} badge
 *
 * @typedef {Object} ScenarioSetRevision
 * @property {string} id
 * @property {string} rev
 * @property {string} name
 * @property {Ref} environmentRef
 * @property {Ref} workflowRef
 * @property {Ref[]} scenarioRefs                        ordered, unique by id
 * @property {string} digest
 *
 * @typedef {Object} WorkflowNode
 * @property {string} id
 * @property {string} label
 * @property {'tool'|'model'|'decision'} kind
 * @property {string} chip                               'CRM' | 'Model' | 'Email' | ''
 * @property {string|null} capability                    `${kind}.${tool}` this step needs
 * @property {string} inputs
 * @property {string} outputs
 * @property {{col:number,row:number}} pos
 *
 * @typedef {Object} WorkflowRevision
 * @property {string} id
 * @property {string} rev
 * @property {string} name
 * @property {{label:string, fixture:true}} source
 * @property {WorkflowNode[]} nodes
 * @property {{from:string,to:string,label?:string}[]} edges
 * @property {string[]} requiredCapabilities
 * @property {{approvalRequiredFor:string[], optOutGuard:boolean}} policySnapshot
 * @property {Record<string,{model:string, traits:Record<string,string>}>} modelConfig   by node id
 * @property {string} digest
 *
 * @typedef {Object} Variant                              v1: a patch to model configuration only
 * @property {string} id
 * @property {string} name
 * @property {Ref} workflowRef
 * @property {string} baseDigest
 * @property {{nodeId:string, model:string, traits:Record<string,string>}[]} patch
 * @property {string[]} changedNodeIds
 * @property {string} digest
 *
 * @typedef {Object} ExperimentDraft
 * @property {string} id
 * @property {number} number
 * @property {string} title
 * @property {number} draftRevision
 * @property {number|null} savedRevision                 dirty when savedRevision != draftRevision
 * @property {Ref} workflowRef
 * @property {string|null} variantId
 * @property {Ref} environmentRef
 * @property {Ref} scenarioSetRef
 * @property {string[]} selectedScenarioIds              unique; subset of the set
 * @property {number} repetitions
 *
 * @typedef {{id:string, versionId:'baseline'|'variant', scenarioId:string, repeatIndex:number}} PlanItem
 *
 * @typedef {Object} AttemptSnapshot                      deep-frozen copy of every revision an attempt uses
 * @property {ExperimentDraft} experiment
 * @property {WorkflowRevision} workflow
 * @property {Variant|null} variant
 * @property {EnvironmentRevision} environment
 * @property {ScenarioSetRevision} scenarioSet
 * @property {Scenario[]} scenarios
 * @property {number} repetitions
 *
 * @typedef {Object} Attempt                              one queue row
 * @property {string} id
 * @property {string} experimentId
 * @property {string} title
 * @property {string} label                              'rev 3 · attempt 1'
 * @property {string} idempotencyKey
 * @property {AttemptSnapshot} inputSnapshot
 * @property {string} inputDigest
 * @property {number} seed
 * @property {string} fixtureVersion
 * @property {PlanItem[]} plan
 * @property {number} cursor                             executions with a terminal state
 * @property {'queued'|'running'|'completed'|'cancelled'|'failed'} status
 * @property {'active'|'paused'} runner                  'paused' after a refresh or a user pause
 * @property {number} enqueuedSeq
 * @property {{decision:string, note:string, reviewedAt:string, deploymentState:'not_deployed'}|null} review
 *
 * @typedef {Object} TraceEvent
 * @property {number} seq
 * @property {string} nodeId
 * @property {'tool_call'|'model'|'decision'|'approval'|'policy_block'|'note'} type
 * @property {string} [tool]
 * @property {Object} [request]
 * @property {'ok'|'timeout'|'denied'|'error'} [responseState]
 * @property {'none'|'committed'|'deduplicated'|'blocked'} [sideEffectState]
 * @property {boolean} [attemptedPolicyViolation]
 * @property {string} note
 *
 * @typedef {Object} Execution
 * @property {string} id
 * @property {string} attemptId
 * @property {'baseline'|'variant'} versionId
 * @property {string} scenarioId
 * @property {number} repeatIndex
 * @property {string} initialStateDigest
 * @property {TraceEvent[]} events
 * @property {Object} finalState                         { outbox, crm, calendar, db, approvals, ledger }
 * @property {{id:string,label:string,pass:boolean,expected:string,observed:string}[]} assertionResults
 * @property {'passed'|'failed'|'cancelled'|'error'} terminalState
 * @property {'simulated'} evidenceGrade
 *
 * @typedef {Object} Comparison                           computed only from matching executions
 * @property {number} expectedPairs
 * @property {number} completePairs
 * @property {string[]} missingPairs
 * @property {{baseline:{pass:number,total:number}, variant:{pass:number,total:number}}} totals
 * @property {{scenarioId:string, title:string, baseline:{pass:number,total:number}, variant:{pass:number,total:number}, improved:number, regressed:number}[]} byScenario
 * @property {{pairId:string, scenarioId:string, repeatIndex:number, kind:'improved'|'regressed'|'same', deltas:string[]}[]} pairs
 * @property {number} improvedPairs
 * @property {number} regressedPairs
 * @property {'pass'|'regression'|'inconclusive'} verdict  'pass' needs every pair complete and no regression
 *
 * @typedef {Object} GymError
 * @property {string} code
 * @property {string} message
 * @property {{label:string, route?:string, action?:string}} [fix]   where the user repairs it
 *
 * @typedef {Object} GymState                             the single store value
 * @property {number} schemaVersion
 * @property {string} fixtureVersion
 * @property {Record<string,EnvironmentRevision>} environments       by `id@rev`
 * @property {Record<string,EnvironmentDraft>} environmentDrafts
 * @property {Record<string,WorkflowRevision>} workflows             by `id@rev`
 * @property {Record<string,Variant>} variants
 * @property {Record<string,Scenario>} scenarios                     by `id@rev`
 * @property {Record<string,Object>} scenarioDrafts                  N3 builder drafts, owned by scenario/
 * @property {Record<string,ScenarioSetRevision>} scenarioSets       by `id@rev`
 * @property {Record<string,ExperimentDraft>} experiments
 * @property {Record<string,Attempt>} attempts
 * @property {string[]} attemptOrder                                 queue order
 * @property {Record<string,Execution[]>} executions                 by attempt id, in plan order
 * @property {number} seq                                            monotonic id and enqueue counter
 */

export const refKey = ref => `${ref.id}@${ref.rev}`;
export const parseRef = key => { const i = key.lastIndexOf('@'); return { id: key.slice(0, i), rev: key.slice(i + 1) }; };
export const sameRef = (a, b) => !!a && !!b && a.id === b.id && a.rev === b.rev;
export const clone = value => structuredClone(value);
export const pairId = item => `${item.scenarioId}#${item.repeatIndex}`;
export const capabilityOf = (component, toolName) => `${component.kind}.${toolName}`;

const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`
  : JSON.stringify(value ?? null);

// A version-consistency fingerprint (FNV-1a over a key-sorted serialisation). Not a security or production proof.
export function digestOf(value) {
  const text = stable(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const executionCount = (versions, scenarios, repetitions) => versions * scenarios * repetitions;
export const pairCount = (scenarios, repetitions) => scenarios * repetitions;
export const uniqueIds = ids => [...new Set(ids)];
