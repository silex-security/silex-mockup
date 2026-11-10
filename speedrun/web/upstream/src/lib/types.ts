/**
 * Domain model for SILEX Speedrun + Agent Gym.
 *
 * Hierarchy: Organization → Business Unit → Agent Team → agent roles (lead + teammates).
 * An agent *role* is a team member (e.g. "Order Specialist"); *instances* are the
 * running copies of a team. One role can be a member of several teams (shared agent),
 * and in each team it inherits that team lead's permissions.
 *
 * Raw fixtures store per-team facts only; every aggregate (business unit, organization)
 * is derived in `lib/data/aggregate.ts` so the numbers on screen always add up.
 */

export type EvidenceGrade = "estimated" | "simulated" | "observed";
/** Ontology evidence grade for paths / cases: seen in traffic vs possible by type. */
export type ConceptGrade = "observed" | "latent";
export type Tier = "L1" | "L2" | "L3";

export type AnomalyKind = "slow" | "expensive" | "low-success";

export interface Anomaly {
  kind: AnomalyKind;
  /** e.g. "P95 +12s", "Cost / run +28%" */
  metric: string;
}

export interface AgentRole {
  id: string;
  /** Two-letter avatar initials */
  initials: string;
  name: string;
  description: string;
  /** Tool / system the role mainly uses */
  primaryTool?: string;
}

export interface TeamMember {
  roleId: string;
  isLead: boolean;
  /** What this member does in this team, e.g. "Order lookup" */
  duty: string;
}

export interface WeeklyPoint {
  /** MM/DD label */
  week: string;
  value: number;
}

/** The Workflow Library entry this team runs. The demo site's Library holds the other half of the relation. */
export type TeamWorkflow = { status: "registered"; id: string; name: string } | { status: "unregistered"; name: string };

export interface AgentTeam {
  id: string;
  unitId: string;
  name: string;
  description: string;
  icon: "refund" | "escalation" | "orders" | "invoice" | "expense" | "reconcile";
  workflow: TeamWorkflow;
  /** Production version currently deployed, e.g. "v1.4" */
  baseline: string;
  members: TeamMember[];
  humanReviewers: number;
  instances: number;
  instancesReporting: number;
  runs: number;
  /** 0–1 */
  successRate: number;
  totalCost: number;
  p95Seconds: number;
  /** 7-day deltas shown on KPI tiles */
  deltas: { runs: number; cost: number; costPerSuccess: number; successPp: number; p95Seconds: number };
  anomaly?: Anomaly;
  /** 8 weekly P95 points for sparklines */
  p95Trend: number[];
}

export interface DataCoverage {
  staleInstances: number;
  incompleteTraces: number;
  missingCostInstances: number;
  missingEvaluationRuns: number;
  /** 0–1 shares of reconstructed state */
  observed: number;
  inferred: number;
  uncertain: number;
}

export interface BusinessUnit {
  id: string;
  name: string;
  icon: "people" | "ledger";
  /** P95 is a distribution statistic and cannot be derived from team P95s, so it is stored */
  p95Seconds: number;
  coverage: DataCoverage;
}

export interface Organization {
  id: string;
  name: string;
  p95Seconds: number;
  coverage: DataCoverage;
  /** Run volume per bucket, 12 buckets/day × 7 days, oldest first */
  radarVolumes: number[];
  /** Bucket indices that carried a P95 regression */
  radarRegression: { from: number; to: number; teamId: string; label: string };
  radarAnomalies: number[];
  radarDays: string[];
}

/* ---------- Team structure (lead · teammates · shared task list · mailbox) ---------- */

export type TaskState = "done" | "in-progress" | "blocked" | "pending";

export interface TeamTask {
  id: string; // "T1"
  title: string;
  ownerRoleId: string;
  state: TaskState;
  dependsOn?: string;
  /** Marked as reusable context (candidate for knowledge supply) */
  reusable?: boolean;
}

export interface MailboxEdge {
  fromRoleId: string;
  toRoleId: string;
  label: string;
}

export interface TeamworkSignals {
  coordinationOverheadPct: number;
  blockedSecondsPerRun: number;
  blockedNote: string;
  duplicateContextLoads: number;
  duplicateContextTokens: string;
  duplicateNote: string;
  stuckTasks7d: number;
}

export interface OptimizationCandidate {
  id: string; // "01"
  rank: number | null; // null = rejected
  title: string;
  target: string;
  /** Team members the candidate changes */
  roleIds: string[];
  objective: "Latency" | "Cost" | "Quality";
  status: "recommended" | "candidate" | "rejected";
  note: string;
  diagnosis?: string;
  params?: { name: string; current: string; candidate: string }[];
  estimate?: string;
  estimateNote?: string;
  /** What the change leaves untouched (shown under the proposal) */
  guardrail?: string;
  /** One-line explanation shown beside the trace */
  brief?: string;
}

export interface TeamStructure {
  teamId: string;
  runId: string;
  atSeconds: number;
  tasks: TeamTask[];
  mailbox: MailboxEdge[];
  signals: TeamworkSignals;
  candidates: OptimizationCandidate[];
  /** When the team hands a run to a human reviewer */
  humanReview?: string;
}

/* ---------- Trace ---------- */

export type SegmentKind = "work" | "lead" | "critical" | "timeout" | "wait" | "blocked" | "idle" | "reusable";

export interface TraceSegment {
  start: number;
  end: number;
  kind: SegmentKind;
  label: string;
}

export interface TraceLane {
  roleId: string;
  summary: string;
  segments: TraceSegment[];
  markers: { at: number; candidateId: string }[];
  messages: { at: number; to: string; label: string }[];
  highlighted?: boolean;
}

export interface TraceRun {
  teamId: string;
  runId: string;
  durationSeconds: number;
  cost: number;
  outcome: "authorized" | "approved" | "resolved" | "escalated" | "failed" | "rejected";
  criticalPath: string[];
  blockedSeconds: number;
  lanes: TraceLane[];
  focus: {
    taskId: string;
    title: string;
    roleId: string;
    tool: string;
    durationSeconds: number;
    cost: number;
    attempts: number;
    actedAs: string;
    stateTouched: string;
    downstream: string;
  };
  /** Defaults for "Create variant" and the Agent Gym experiment it produces */
  variant: VariantContext;
}

export type ChangeType = "retry-timeout" | "switch-tool" | "switch-model" | "prompt-context";

export interface VariantPreset {
  desc: string;
  params: { name: string; baseline: string; suggested?: string }[];
}

export interface VariantContext {
  experimentTitle: string;
  objective: "Latency" | "Cost" | "Success";
  defaultChange: ChangeType;
  presets: Record<ChangeType, VariantPreset>;
  scopeLabel: string;
  note: string;
  criteria: string;
  environment: string;
  improvementThreshold: string;
  /** Test-set groups (excluding the shared-agent group) */
  testSet: { name: string; count: number }[];
  /** Cases from other teams that share the changed agent */
  sharedCases?: number;
  sampleCases: { id: string; title: string; type: string; source: string }[];
}

/* ---------- Benchmarks ---------- */

export interface BenchmarkSuite {
  id: string;
  teamId: string;
  name: string;
  version: string;
  anchorCases: number;
  rollingCases: number;
  rollingRefreshedDaysAgo: number;
  repeats: number;
  pinned: string;
  lastRun: string;
  nextRun: string;
  costPerExecution: number;
}

export interface Scorecard {
  quality: { taskSuccess: number; taskSuccessCi: number; passK: number; passKCi: number; gate: "pass" | "fail" };
  safety: { newViolations: number; reuseValidity: number; gate: "pass" | "fail" };
  efficiency: { netCostPerSuccess: number; silexOverhead: number; p50: number; p95: number; p95Ci: number };
  teamwork: { teamVsBestMemberPp: number; blockedSeconds: number; overheadPct: number };
}

export interface FitRow {
  change: string;
  predicted: string;
  measured: string;
  fit: boolean;
  note?: string;
}

export interface BenchmarkView {
  suite: BenchmarkSuite;
  scorecard: Scorecard;
  weeks: string[];
  markers: { week: string; label: string }[];
  passK: number[];
  p95Benchmark: number[];
  p95Production: number[];
  fit: FitRow[];
  /** Reading of the fit table; `action` links to the Benchmark Builder */
  fitNote: { title: string; text: string; action?: string };
  caseTypes: { name: string; cases: number; passK: number }[];
  weakSpotNote: string;
}

export type BenchmarkTrend = "improving" | "flat" | "regressing";

export interface BenchmarkHealth {
  teamId: string;
  suiteVersion: string;
  trend: BenchmarkTrend;
  passKTrend: number[];
  passK: number;
  fitHits: number;
  fitTotal: number;
  fitNote?: string;
  rollingRefreshedDaysAgo: number;
  refreshOverdue: boolean;
}

/* ---------- Benchmark Builder ---------- */

export interface Concept {
  id: string;
  tier: Tier;
  name: string;
  note?: string;
  cases: number;
  /** Covered but thin (e.g. "fixed latency only") */
  thin?: boolean;
}

export interface CaseFamilyRecommendation {
  id: string; // "R1"
  conceptId: string;
  title: string;
  ontologyType: string;
  grade: ConceptGrade;
  rationale: string;
  cases: number;
  status: "building" | "proposed" | "in-review" | "accepted";
}

export interface ConstructionStep {
  name: string;
  done: boolean;
}

export interface GeneratedCase {
  id: string;
  title: string;
  seedState: string;
  injected: string;
  task: string;
  passIf: string;
  record: string;
}

export interface BuilderView {
  teamId: string;
  suiteName: string;
  ontologyVersions: string;
  concepts: Concept[];
  outOfScopeNote: string;
  recommendations: CaseFamilyRecommendation[];
  skipped: { title: string; reason: string }[];
  construction: {
    recommendationId: string;
    steps: ConstructionStep[];
    type: string;
    instances: string;
    profiles: string;
    profilesLabel: string;
    expansion: string;
    preview: GeneratedCase;
    checks: { label: string; state: "pass" | "running" | "fail" }[];
    reviewNote: string;
  };
}

