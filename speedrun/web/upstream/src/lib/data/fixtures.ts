/**
 * Illustrative fixture data for the mock API. Every figure here is illustrative.
 * Only per-team facts live here; aggregates are derived in aggregate.ts.
 */
import type {
  AgentRole,
  ExperimentConfig,
  AgentTeam,
  BenchmarkHealth,
  BenchmarkView,
  BuilderView,
  BusinessUnit,
  Experiment,
  Organization,
  TeamStructure,
  TraceRun,
} from "../types";
import * as teamDetail from "./fixtures-teams";

export const organization: Organization = {
  id: "acme",
  name: "Acme",
  p95Seconds: 44,
  coverage: {
    staleInstances: 0, // derived from units in aggregate.ts
    incompleteTraces: 0,
    missingCostInstances: 0,
    missingEvaluationRuns: 0,
    observed: 0.86,
    inferred: 0.11,
    uncertain: 0.03,
  },
  radarVolumes: seededVolumes(84, 7),
  radarRegression: { from: 14, to: 17, teamId: "refund", label: "P95 +12s · Fri 07/18" },
  radarAnomalies: [16, 40, 61],
  radarDays: ["Thu 07/17", "Fri 07/18", "Sat 07/19", "Sun 07/20", "Mon 07/21", "Tue 07/22", "Wed 07/23"],
};

/** Deterministic pseudo-random volumes: busier mid-day, quieter at night. */
function seededVolumes(n: number, seed: number): number[] {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: n }, (_, i) => {
    const hour = i % 12;
    const base = 0.35 + 0.45 * Math.sin((hour / 12) * Math.PI);
    return Math.round((base + (rand() * 0.35 - 0.15)) * 140);
  });
}

export const businessUnits: BusinessUnit[] = [
  {
    id: "customer-service",
    name: "Customer Service",
    icon: "people",
    p95Seconds: 39,
    coverage: {
      staleInstances: 1,
      incompleteTraces: 135,
      missingCostInstances: 12,
      missingEvaluationRuns: 154,
      observed: 0.88,
      inferred: 0.1,
      uncertain: 0.02,
    },
  },
  {
    id: "finance",
    name: "Finance",
    icon: "ledger",
    p95Seconds: 48,
    coverage: {
      staleInstances: 1,
      incompleteTraces: 163,
      missingCostInstances: 12,
      missingEvaluationRuns: 188,
      observed: 0.84,
      inferred: 0.12,
      uncertain: 0.04,
    },
  },
];

export const agentRoles: AgentRole[] = [
  // Customer Service
  { id: "refund-lead", initials: "RL", name: "Refund Lead", description: "Leads the Refund Team: creates and assigns tasks." },
  { id: "support-lead", initials: "SL", name: "Support Lead", description: "Leads the Order Support Team." },
  { id: "escalation-lead", initials: "EL", name: "Escalation Lead", description: "Leads the Escalation Team." },
  { id: "order-specialist", initials: "OS", name: "Order Specialist", description: "Retrieves order details and status.", primaryTool: "Orders API" },
  { id: "policy-reviewer", initials: "PR", name: "Policy Reviewer", description: "Interprets refund and support policy." },
  { id: "refund-reviewer", initials: "RR", name: "Refund Reviewer", description: "Authorizes refunds." },
  { id: "response-writer", initials: "RW", name: "Response Writer", description: "Drafts customer replies." },
  { id: "escalation-specialist", initials: "ES", name: "Escalation Specialist", description: "Handles complex cases." },
  // Finance
  { id: "invoice-lead", initials: "IL", name: "Invoice Lead", description: "Leads the Invoice Team." },
  { id: "expense-lead", initials: "XL", name: "Expense Lead", description: "Leads the Expense Review Team." },
  { id: "recon-lead", initials: "CL", name: "Reconciliation Lead", description: "Leads the Reconciliation Team." },
  { id: "invoice-extractor", initials: "IE", name: "Invoice Extractor", description: "Extracts invoice fields." },
  { id: "vendor-matcher", initials: "VM", name: "Vendor Matcher", description: "Matches vendors and POs." },
  { id: "payment-approver", initials: "PA", name: "Payment Approver", description: "Routes payment approvals." },
  { id: "expense-reviewer", initials: "ER", name: "Expense Reviewer", description: "Reviews expense claims." },
  { id: "receipt-matcher", initials: "RM", name: "Receipt Matcher", description: "Matches receipts to claims." },
  { id: "policy-checker", initials: "PC", name: "Policy Checker", description: "Checks expense policy." },
  { id: "ledger-matcher", initials: "LM", name: "Ledger Matcher", description: "Matches ledger entries." },
  { id: "variance-analyst", initials: "VA", name: "Variance Analyst", description: "Explains variances." },
  { id: "journal-writer", initials: "JE", name: "Journal Entry Writer", description: "Drafts journal entries." },
  { id: "audit-logger", initials: "AU", name: "Audit Logger", description: "Writes audit evidence." },
];

const m = (roleId: string, duty: string, isLead = false) => ({ roleId, duty, isLead });

export const teams: AgentTeam[] = [
  {
    id: "escalation",
    unitId: "customer-service",
    name: "Escalation Team",
    description: "Routes complex cases to specialists",
    icon: "escalation",
    workflow: { status: "registered", id: "WF-017", name: "Customer Support · Escalation Handling" },
    baseline: "v2.3",
    members: [m("escalation-lead", "Triage", true), m("order-specialist", "Case history"), m("escalation-specialist", "Resolution"), m("response-writer", "Reply")],
    humanReviewers: 1,
    instances: 400,
    instancesReporting: 400,
    runs: 786,
    successRate: 0.891,
    totalCost: 168.1,
    p95Seconds: 42,
    deltas: { runs: -3.4, cost: -1.2, costPerSuccess: 6.0, successPp: -6.1, p95Seconds: 3 },
    anomaly: { kind: "low-success", metric: "Success −6.1 pp" },
    p95Trend: [38, 39, 39, 40, 40, 41, 42, 42],
  },
  {
    id: "refund",
    unitId: "customer-service",
    name: "Refund Team",
    description: "Reviews and processes refund requests",
    icon: "refund",
    workflow: { status: "registered", id: "WF-014", name: "Customer Support · Refund Resolution" },
    baseline: "v1.4",
    members: [m("refund-lead", "Parse & assign", true), m("order-specialist", "Order lookup"), m("policy-reviewer", "Eligibility"), m("refund-reviewer", "Authorize")],
    humanReviewers: 1,
    instances: 400,
    instancesReporting: 399,
    runs: 1840,
    successRate: 0.981,
    totalCost: 349.6,
    p95Seconds: 36,
    deltas: { runs: 6.3, cost: 4.7, costPerSuccess: -1.9, successPp: 0.4, p95Seconds: 12 },
    anomaly: { kind: "slow", metric: "P95 +12s" },
    p95Trend: [31, 30, 30, 28, 25, 24, 36, 36],
  },
  {
    id: "order-support",
    unitId: "customer-service",
    name: "Order Support Team",
    description: "Resolves order and delivery questions",
    icon: "orders",
    workflow: { status: "registered", id: "WF-019", name: "Customer Support · Order Support" },
    baseline: "v1.6",
    members: [m("support-lead", "Triage", true), m("order-specialist", "Order status"), m("policy-reviewer", "Policy"), m("response-writer", "Reply")],
    humanReviewers: 0,
    instances: 400,
    instancesReporting: 400,
    runs: 1230,
    successRate: 0.974,
    totalCost: 407.32,
    p95Seconds: 24,
    deltas: { runs: 2.1, cost: 31.0, costPerSuccess: 28.0, successPp: -0.1, p95Seconds: -1 },
    anomaly: { kind: "expensive", metric: "Cost / run +28%" },
    p95Trend: [25, 25, 24, 25, 24, 23, 24, 24],
  },
  {
    id: "invoice",
    unitId: "finance",
    name: "Invoice Team",
    description: "Extracts, matches and approves supplier invoices",
    icon: "invoice",
    workflow: { status: "registered", id: "WF-023", name: "Finance · Invoice Processing" },
    baseline: "v1.9",
    members: [m("invoice-lead", "Assign", true), m("invoice-extractor", "Extract"), m("vendor-matcher", "Match"), m("payment-approver", "Approve"), m("audit-logger", "Evidence")],
    humanReviewers: 1,
    instances: 500,
    instancesReporting: 499,
    runs: 2010,
    successRate: 0.955,
    totalCost: 472.1,
    p95Seconds: 47,
    deltas: { runs: 1.8, cost: 2.0, costPerSuccess: 0.4, successPp: -0.3, p95Seconds: 9 },
    anomaly: { kind: "slow", metric: "P95 +9s" },
    p95Trend: [38, 38, 39, 38, 39, 40, 47, 47],
  },
  {
    id: "expense-review",
    unitId: "finance",
    name: "Expense Review Team",
    description: "Reviews employee expense claims against policy",
    icon: "expense",
    workflow: { status: "unregistered", name: "Finance · Expense Reimbursement" },
    baseline: "v2.0",
    members: [m("expense-lead", "Assign", true), m("receipt-matcher", "Receipts"), m("policy-checker", "Policy"), m("expense-reviewer", "Review")],
    humanReviewers: 1,
    instances: 350,
    instancesReporting: 350,
    runs: 1420,
    successRate: 0.97,
    totalCost: 331.8,
    p95Seconds: 31,
    deltas: { runs: 0.9, cost: 25.1, costPerSuccess: 24.0, successPp: 0.2, p95Seconds: 0 },
    anomaly: { kind: "expensive", metric: "Cost / run +24%" },
    p95Trend: [31, 30, 31, 31, 30, 31, 31, 31],
  },
  {
    id: "reconciliation",
    unitId: "finance",
    name: "Reconciliation Team",
    description: "Reconciles ledgers and explains variances",
    icon: "reconcile",
    workflow: { status: "registered", id: "WF-029", name: "Finance · Ledger Reconciliation" },
    baseline: "v2.2",
    members: [m("recon-lead", "Assign", true), m("ledger-matcher", "Match"), m("variance-analyst", "Explain"), m("journal-writer", "Entries"), m("audit-logger", "Evidence")],
    humanReviewers: 1,
    instances: 350,
    instancesReporting: 350,
    runs: 1259,
    successRate: 0.912,
    totalCost: 355.24,
    p95Seconds: 52,
    deltas: { runs: -0.6, cost: 0.8, costPerSuccess: 6.2, successPp: -4.8, p95Seconds: 2 },
    anomaly: { kind: "low-success", metric: "Success −4.8 pp" },
    p95Trend: [49, 50, 50, 51, 50, 51, 52, 52],
  },
];

/* ---------------- Refund Team: structure, trace, benchmarks, builder ---------------- */

export const teamStructures: TeamStructure[] = [
  {
    teamId: "refund",
    runId: "1220",
    atSeconds: 18,
    tasks: [
      { id: "T1", title: "Parse & route request", ownerRoleId: "refund-lead", state: "done" },
      { id: "T2", title: "Fetch order", ownerRoleId: "order-specialist", state: "in-progress" },
      { id: "T3", title: "Load refund policy", ownerRoleId: "policy-reviewer", state: "done", reusable: true },
      { id: "T4", title: "Check eligibility", ownerRoleId: "policy-reviewer", state: "blocked", dependsOn: "T2" },
      { id: "T5", title: "Authorize refund", ownerRoleId: "refund-reviewer", state: "blocked", dependsOn: "T4" },
    ],
    mailbox: [
      { fromRoleId: "order-specialist", toRoleId: "policy-reviewer", label: "order details" },
      { fromRoleId: "policy-reviewer", toRoleId: "refund-reviewer", label: "eligible ✓" },
    ],
    signals: {
      coordinationOverheadPct: 18,
      blockedSecondsPerRun: 15,
      blockedNote: "PR waits on order (T4 ← T2)",
      duplicateContextLoads: 2,
      duplicateContextTokens: "6.1k tok",
      duplicateNote: "PR and RR each load the policy",
      stuckTasks7d: 4,
    },
    candidates: [
      {
        id: "01",
        rank: 1,
        title: "Tune retry & timeout",
        target: "Order Specialist · T2",
        roleIds: ["order-specialist"],
        objective: "Latency",
        status: "recommended",
        note: "Order Specialist · T2",
        diagnosis:
          "Orders API P95 rose from 4s to 9s on Fri 07/18. On 19% of runs (38 of 200) the first call hits the 8s timeout, waits 2s, then retries — and T4 and T5 sit blocked behind it.",
        params: [
          { name: "First-attempt timeout", current: "8s", candidate: "4s" },
          { name: "Retry delay", current: "2s", candidate: "1s" },
        ],
        estimate: "Up to −5s",
        estimateNote: "on retried runs · P95 est. 36s → ~31s",
        guardrail: "Order Specialist is shared by 3 teams, so the change reaches them too. Max retries and approval checks stay unchanged.",
      },
      {
        id: "02",
        rank: 2,
        title: "Supply policy once to the team",
        target: "PR + RR",
        roleIds: ["policy-reviewer", "refund-reviewer"],
        objective: "Cost",
        status: "candidate",
        note: "PR + RR · 2 loads → 1 · valid while policy v3.2",
        brief: "Policy Reviewer and Refund Reviewer each load the same policy into their own context. Supply it once — while policy v3.2 holds.",
      },
      {
        id: "x1",
        rank: null,
        title: "Merge Policy + Refund Reviewer",
        target: "PR + RR",
        roleIds: ["policy-reviewer", "refund-reviewer"],
        objective: "Cost",
        status: "rejected",
        note: "Rejected · removes separation of duties",
      },
    ],
    humanReview: "Human · escalated when risk ≥ 0.8",
  },
  ...teamDetail.structures,
];

export const traceRuns: TraceRun[] = [
  {
    teamId: "refund",
    runId: "1220",
    durationSeconds: 30,
    cost: 0.19,
    outcome: "authorized",
    criticalPath: ["T2", "T4", "T5"],
    blockedSeconds: 15,
    lanes: [
      {
        roleId: "refund-lead",
        summary: "T1 Parse · create tasks",
        segments: [
          { start: 0, end: 3, kind: "lead", label: "T1 Parse & create tasks" },
          { start: 3, end: 29, kind: "blocked", label: "Idle — monitoring" },
          { start: 29, end: 30, kind: "lead", label: "Close case" },
        ],
        markers: [],
        messages: [],
      },
      {
        roleId: "order-specialist",
        summary: "T2 Fetch order · timeout 8s · wait 2s · retry 11s",
        highlighted: true,
        segments: [
          { start: 3, end: 11, kind: "timeout", label: "Attempt 1 — timed out at 8s" },
          { start: 11, end: 13, kind: "wait", label: "Retry delay 2s" },
          { start: 13, end: 24, kind: "critical", label: "Attempt 2 — 11s" },
        ],
        markers: [{ at: 11.5, candidateId: "01" }],
        messages: [{ at: 24, to: "policy-reviewer", label: "order details" }],
      },
      {
        roleId: "policy-reviewer",
        summary: "T3 Load policy · T4 Check eligibility · blocked 15s on T2",
        segments: [
          { start: 3, end: 9, kind: "reusable", label: "T3 Load refund policy (6.1k tok)" },
          { start: 9, end: 24, kind: "blocked", label: "Blocked on T2" },
          { start: 24, end: 27, kind: "critical", label: "T4 Check eligibility" },
        ],
        markers: [{ at: 6, candidateId: "02" }],
        messages: [{ at: 27, to: "refund-reviewer", label: "eligible ✓" }],
      },
      {
        roleId: "refund-reviewer",
        summary: "Load policy (duplicate) · T5 Authorize",
        segments: [
          { start: 3, end: 8, kind: "reusable", label: "Load refund policy — duplicate" },
          { start: 8, end: 27, kind: "blocked", label: "Blocked on T4" },
          { start: 27, end: 29, kind: "critical", label: "T5 Authorize refund" },
        ],
        markers: [{ at: 5.5, candidateId: "02" }],
        messages: [{ at: 29, to: "refund-lead", label: "authorized" }],
      },
    ],
    focus: {
      taskId: "T2",
      title: "Fetch order",
      roleId: "order-specialist",
      tool: "Orders API",
      durationSeconds: 21,
      cost: 0.08,
      attempts: 2,
      actedAs: "svc-refund-agent · permissions inherited from Refund Lead",
      stateTouched: "order record",
      downstream: "T4, T5 blocked 15s",
    },
    variant: {
      experimentTitle: "Tune order-lookup retry policy",
      objective: "Latency",
      defaultChange: "retry-timeout",
      presets: {
        "retry-timeout": { desc: "Tune timeout, delay and retry limit", params: [{ name: "First-attempt timeout", baseline: "8s", suggested: "4s" }, { name: "Retry delay", baseline: "2s", suggested: "1s" }, { name: "Max retries", baseline: "3" }] },
        "switch-tool": { desc: "Use a compatible Orders API", params: [{ name: "Orders API endpoint", baseline: "orders-v2" }] },
        "switch-model": { desc: "Edit this agent's model", params: [{ name: "Model", baseline: "large-2026-05" }] },
        "prompt-context": { desc: "Edit this agent's instructions", params: [{ name: "Context budget", baseline: "6.1k tok" }] },
      },
      scopeLabel: "Similar runs + timeout cases",
      note: "Retry limit and approval checks remain unchanged.",
      criteria: "Agent Studio · Refund policy v3 (inherited, read only)",
      environment: "Sandbox · Orders API test",
      improvementThreshold: "≥ 10%",
      testSet: [
        { name: "Original run", count: 1 },
        { name: "Similar runs", count: 59 },
        { name: "Timeout cases", count: 25 },
        { name: "Boundary cases", count: 15 },
      ],
      sharedCases: 20,
      sampleCases: [
        { id: "#1220", title: "Order lookup timeout", type: "Original run", source: "Production trace" },
        { id: "#1221", title: "Standard refund", type: "Similar run", source: "Production trace" },
        { id: "#T-014", title: "Repeated API timeout", type: "Timeout", source: "Test library" },
        { id: "#B-008", title: "Refund approval boundary", type: "Boundary", source: "Test library" },
        { id: "#OS-031", title: "Delivery status lookup", type: "Order Support Team", source: "Production trace" },
      ],
    },
  },
  ...teamDetail.traceRuns,
];

export const benchmarkViews: BenchmarkView[] = [
  {
    suite: {
      id: "refund-core",
      teamId: "refund",
      name: "Refund Team · Core",
      version: "v3",
      anchorCases: 80,
      rollingCases: 40,
      rollingRefreshedDaysAgo: 7,
      repeats: 3,
      pinned: "harness 2.1 · Sandbox · Orders API test · Refunds L2 v0.4",
      lastRun: "07/25",
      nextRun: "08/01",
      costPerExecution: 0.15,
    },
    scorecard: {
      quality: { taskSuccess: 0.975, taskSuccessCi: 1.2, passK: 0.925, passKCi: 2.4, gate: "pass" },
      safety: { newViolations: 0, reuseValidity: 0.994, gate: "pass" },
      efficiency: { netCostPerSuccess: 0.18, silexOverhead: 0.01, p50: 18, p95: 24, p95Ci: 2 },
      teamwork: { teamVsBestMemberPp: 6.3, blockedSeconds: 14, overheadPct: 17 },
    },
    weeks: ["06/06", "06/13", "06/20", "06/27", "07/04", "07/11", "07/18", "07/25"],
    markers: [
      { week: "06/13", label: "v1.3" },
      { week: "06/27", label: "model swap" },
      { week: "07/04", label: "v1.4" },
    ],
    passK: [0.888, 0.9, 0.894, 0.913, 0.925, 0.925, 0.931, 0.925],
    p95Benchmark: [30, 29, 30, 27, 24, 24, 25, 24],
    p95Production: [31, 30, 30, 28, 25, 24, 36, 36],
    fit: [
      { change: "v1.3 · prompt trim (PR)", predicted: "cost −6%", measured: "cost −5%", fit: true },
      { change: "Model swap · Order Specialist", predicted: "P95 −3s · success −0.2pp", measured: "P95 −3s · success −0.4pp", fit: true },
      { change: "v1.4 · Orders API client 2.0", predicted: "P95 −3s", measured: "P95 −3s", fit: true },
      { change: "#022 · cache policy retrieval", predicted: "cost −4%", measured: "cost −3%", fit: true },
      { change: "Lead routing threshold", predicted: "success +0.3pp", measured: "success +0.2pp", fit: true },
      { change: "07/18 · Orders API slowdown", predicted: "P95 ±0s", measured: "P95 +12s", fit: false, note: "no config change" },
    ],
    fitNote: {
      title: "Why it missed",
      text: "The sandbox Orders API answers in a fixed time, so the benchmark can't see upstream slowdowns. The miss points at the environment, not the agents.",
      action: "Add upstream-latency cases →",
    },
    caseTypes: [
      { name: "Typical runs", cases: 52, passK: 0.981 },
      { name: "Timeouts", cases: 25, passK: 0.8 },
      { name: "Boundary", cases: 15, passK: 0.933 },
      { name: "Adversarial", cases: 8, passK: 0.875 },
      { name: "Shared-agent", cases: 20, passK: 0.95 },
    ],
    weakSpotNote: "Timeouts are the weak spot: the same retry policy experiment #028 targets.",
  },
  ...teamDetail.benchmarkViews,
];

export const benchmarkHealth: BenchmarkHealth[] = [
  { teamId: "refund", suiteVersion: "Core v3", trend: "flat", passKTrend: [88.8, 90, 89.4, 91.3, 92.5, 92.5, 93.1, 92.5], passK: 0.925, fitHits: 5, fitTotal: 6, fitNote: "upstream latency", rollingRefreshedDaysAgo: 7, refreshOverdue: false },
  { teamId: "order-support", suiteVersion: "Core v2", trend: "improving", passKTrend: [90, 90.5, 91.2, 92, 92.8, 93.6, 94.4, 95], passK: 0.95, fitHits: 4, fitTotal: 4, rollingRefreshedDaysAgo: 9, refreshOverdue: false },
  { teamId: "escalation", suiteVersion: "Core v2", trend: "regressing", passKTrend: [88.5, 88, 87.9, 86.5, 85.1, 83.8, 82.4, 81.3], passK: 0.813, fitHits: 3, fitTotal: 3, fitNote: "matches production", rollingRefreshedDaysAgo: 12, refreshOverdue: false },
  { teamId: "invoice", suiteVersion: "Core v1", trend: "flat", passKTrend: [90, 90.4, 90.1, 90.2, 90.5, 90.1, 90.4, 90.2], passK: 0.902, fitHits: 2, fitTotal: 3, rollingRefreshedDaysAgo: 41, refreshOverdue: true },
  { teamId: "expense-review", suiteVersion: "Core v2", trend: "improving", passKTrend: [91, 91.2, 91.5, 92.3, 92.6, 93.1, 93.6, 94.1], passK: 0.941, fitHits: 3, fitTotal: 3, rollingRefreshedDaysAgo: 5, refreshOverdue: false },
  { teamId: "reconciliation", suiteVersion: "Core v1", trend: "flat", passKTrend: [86.4, 86.9, 86.5, 86.8, 86.4, 86.6, 86.9, 86.7], passK: 0.867, fitHits: 0, fitTotal: 1, fitNote: "not enough changes yet", rollingRefreshedDaysAgo: 18, refreshOverdue: false },
];

export const builderViews: BuilderView[] = [
  {
    teamId: "refund",
    suiteName: "Core v3",
    ontologyVersions: "L1 1.2 · Refunds L2 0.4 · L3 0.9",
    concepts: [
      { id: "tool-misuse", tier: "L1", name: "Tool misuse · retry storm", cases: 4 },
      { id: "delegated-authority", tier: "L1", name: "Authority via delegation", cases: 0 },
      { id: "eligibility", tier: "L2", name: "Eligibility rules", cases: 31 },
      { id: "approval-threshold", tier: "L2", name: "Approval threshold > $500", cases: 15 },
      { id: "partial-refund", tier: "L2", name: "Partial refund", cases: 9 },
      { id: "policy-version", tier: "L2", name: "Policy version changes", cases: 0 },
      { id: "order-state", tier: "L2", name: "Already-refunded order", note: "live state", cases: 0 },
      { id: "task-dependency", tier: "L3", name: "Task dependency (T4 ← T2)", cases: 52 },
      { id: "tool-timeout", tier: "L3", name: "Tool timeout", note: "fixed latency only", cases: 25, thin: true },
      { id: "latency-drift", tier: "L3", name: "Upstream latency drift", cases: 0 },
      { id: "mailbox-late", tier: "L3", name: "Mailbox message late", cases: 0 },
      { id: "escalation", tier: "L3", name: "Lead escalation to human", cases: 8 },
    ],
    outOfScopeNote:
      "Not listed: concepts outside this team's reach (e.g. multi-currency — no Refund Team tool converts currency). Only concepts that can change a result get cases.",
    recommendations: [
      { id: "R1", conceptId: "latency-drift", title: "Upstream latency drift on Orders API", ontologyType: "L3 · ToolLatency", grade: "observed", rationale: "Closes the 07/18 benchmark-fit miss. Production P95 of the Orders API went 4s → 9s; the sandbox only replays a fixed 4s.", cases: 12, status: "building" },
      { id: "R2", conceptId: "policy-version", title: "Refund policy changes mid-week", ontologyType: "L2 · PolicyVersion", grade: "latent", rationale: "Proposal 02 supplies the policy once to the team. A test must show the supplied copy is dropped when v3.2 → v3.3 — stale reuse scores as a failure.", cases: 8, status: "proposed" },
      { id: "R3", conceptId: "delegated-authority", title: "Shared agent under another lead's permissions", ontologyType: "L3 · DelegatedAuthority", grade: "latent", rationale: "Order Specialist inherits a different lead's permissions in each team. Current shared-agent cases all run under Refund Lead.", cases: 6, status: "proposed" },
      { id: "R4", conceptId: "order-state", title: "Already-refunded order", ontologyType: "L2 · OrderState", grade: "observed", rationale: "3 production runs in 7 days. Checks the team fetches live order state every time instead of reusing it — the one thing Speedrun must never cache.", cases: 6, status: "proposed" },
      { id: "R5", conceptId: "mailbox-late", title: "Teammate message arrives late", ontologyType: "L3 · MailboxMessage", grade: "latent", rationale: "T4 unblocks on a message from Order Specialist. Nothing tests a delayed message, or a task marked done before the message lands.", cases: 6, status: "proposed" },
    ],
    skipped: [
      { title: "Generic customer-support tasks from a public benchmark", reason: "Doesn't use this team's tools, policy or state, and likely in model training data" },
    ],
    construction: {
      recommendationId: "R1",
      steps: [
        { name: "Type", done: true },
        { name: "Instances", done: true },
        { name: "Scenario", done: true },
        { name: "Pass check", done: true },
        { name: "Validate", done: false },
        { name: "Review", done: false },
      ],
      type: "ToolLatency(tool, profile) → Task.duration, Task.retries",
      instances: "Orders API · used by Order Specialist in T2 · timeout 8s · max retries 3",
      profilesLabel: "Profiles, from production 07/18–07/25",
      profiles: "p50 4s · p95 9s · p99 14s · 2% errors",
      expansion: "12 cases = 4 latency profiles × 3 order types (standard, partial, over $500 threshold).",
      preview: {
        id: "#UL-007",
        title: "Partial refund · Orders API at p95 (9s)",
        seedState: "order #48213 · paid $84.20 · 1 item returned · eligible",
        injected: "Orders API latency 9s on 1st call, 4s on retry",
        task: "“Refund the returned item on order 48213”",
        passIf: "refund.amount = 42.10 ∧ refund.status = issued ∧ approvals = 0",
        record: "success · duration · retries · cost · blocked time",
      },
      checks: [
        { label: "Consistent with the ontology and its declared assumptions", state: "pass" },
        { label: "Matches how the Orders API actually behaved in production", state: "pass" },
        { label: "Baseline v1.4 still completes authorized refunds · running 12 × 3", state: "running" },
        { label: "Sandbox-ready: resettable seed state; pass check is a state condition", state: "pass" },
      ],
      reviewNote:
        "Observed-grade families go to one reviewer (Refund Ops). Latent ones also need an expert sign-off — and a dismissal teaches the ontology where it's wrong.",
    },
  },
  ...teamDetail.builderViews,
];

/* ---------------- Agent Gym ---------------- */

/**
 * Agent Gym configuration for a variant of a team's focus task, built from the
 * team's trace-run defaults so every team's experiment reads from the same data.
 */
export function buildGymConfig(opts: {
  teamId: string;
  params: { name: string; baseline: string; variant: string }[];
  variantName: string;
  scope: "this-run" | "similar-runs" | "all-teams";
  objective?: string;
  roleId?: string;
  task?: string;
  note?: string;
}): ExperimentConfig {
  const team = teams.find((t) => t.id === opts.teamId)!;
  const run = traceRuns.find((r) => r.teamId === team.id)!;
  const bench = benchmarkViews.find((b) => b.suite.teamId === team.id)!;
  const v = run.variant;
  const roleId = opts.roleId ?? run.focus.roleId;
  const role = agentRoles.find((r) => r.id === roleId)!;
  const shared = teams.filter((t) => t.members.some((mb) => mb.roleId === roleId)).length;
  const testSet: ExperimentConfig["testSet"] = v.testSet.map((t, i) => ({
    ...t,
    checked: opts.scope === "this-run" ? i === 0 : true,
  }));
  if (shared > 1 && v.sharedCases) {
    testSet.push({ name: `Other teams using ${role.name}`, count: v.sharedCases, checked: opts.scope === "all-teams", highlight: true });
  }
  const cases = testSet.filter((t) => t.checked).reduce((n, t) => n + t.count, 0);
  const estimate = cases * 3 * 2 * bench.suite.costPerExecution;
  return {
    baseline: `Production ${team.baseline}`,
    variantName: opts.variantName,
    target: `${role.name} / ${opts.task ?? `${run.focus.taskId} ${run.focus.title}`}`,
    sharedAcrossTeams: shared,
    params: opts.params,
    note: opts.note ?? v.note,
    testSet,
    sampleCases: v.sampleCases,
    objective: opts.objective ?? v.objective,
    criteria: v.criteria,
    acceptanceChecks: [
      "No drop in success rate",
      "No new requirement violations",
      ...(shared > 1 ? ["No regression in other teams sharing this agent"] : []),
    ],
    improvementThreshold: v.improvementThreshold,
    environment: v.environment,
    repetitions: 3,
    concurrency: 5,
    budgetCap: Math.max(20, Math.ceil((estimate * 1.1) / 10) * 10),
    costPerExecution: bench.suite.costPerExecution,
  };
}

const config028 = buildGymConfig({
  teamId: "refund",
  variantName: "retry-policy-v2",
  scope: "all-teams",
  params: [
    { name: "First-attempt timeout", baseline: "8s", variant: "4s" },
    { name: "Retry delay", baseline: "2s", variant: "1s" },
    { name: "Max retries", baseline: "3", variant: "3" },
  ],
});

const config018 = buildGymConfig({
  teamId: "escalation",
  variantName: "lead-prompt-v3",
  scope: "similar-runs",
  objective: "Success",
  roleId: "escalation-lead",
  task: "T1 Triage & route case",
  params: [
    { name: "Lead prompt", baseline: "v2.3", variant: "v3" },
    { name: "Routing threshold", baseline: "0.6", variant: "0.6" },
  ],
  note: "Routing threshold and lead review stay unchanged.",
});

const config016 = buildGymConfig({
  teamId: "reconciliation",
  variantName: "ledger-mapping-once",
  scope: "similar-runs",
  objective: "Cost",
  roleId: "ledger-matcher",
  task: "T2 Match ledger entries",
  params: [{ name: "Ledger mapping", baseline: "loaded per agent", variant: "supplied once" }],
  note: "Valid while the chart of accounts is unchanged. Balance checks and audit evidence stay unchanged.",
});

export const experiments: Experiment[] = [
  { id: "028", title: "Tune order-lookup retry policy", teamId: "refund", source: "speedrun", objective: "Latency", status: "pending", result: { text: "Test set required", tone: "neutral" }, updatedMinutesAgo: 2, config: config028 },
  { id: "027", title: "Switch classification model", teamId: "invoice", source: "agent-studio", objective: "Cost", status: "queued", queuePosition: 1, result: { text: "150 cases · Ready", tone: "neutral" }, updatedMinutesAgo: 8 },
  { id: "026", title: "Replace order lookup tool", teamId: "order-support", source: "speedrun", objective: "Latency", status: "running", progress: { done: 42, total: 100 }, updatedMinutesAgo: 12 },
  { id: "025", title: "Reduce retrieval context", teamId: "escalation", source: "speedrun", objective: "Cost", status: "needs-review", result: { text: "Cost −18% · 0 regressions", tone: "good", grade: "simulated" }, updatedMinutesAgo: 24 },
  { id: "024", title: "Prefetch order on intake", teamId: "order-support", source: "speedrun", objective: "Latency", status: "needs-review", result: { text: "P95 −13.9% · 0 regressions", tone: "good", grade: "simulated" }, updatedMinutesAgo: 35 },
  { id: "023", title: "Update approval prompt", teamId: "expense-review", source: "agent-studio", objective: "Success", status: "needs-review", result: { text: "2 regressions detected", tone: "warn" }, updatedMinutesAgo: 60 },
  { id: "022", title: "Cache policy retrieval", teamId: "order-support", source: "speedrun", objective: "Cost", status: "done", result: { text: "Adopted · v1.5", tone: "neutral" }, updatedMinutesAgo: 120 },
  { id: "021", title: "Adjust routing threshold", teamId: "invoice", source: "agent-studio", objective: "Success", status: "done", result: { text: "Not adopted", tone: "neutral" }, updatedMinutesAgo: 180 },
  { id: "020", title: "Shorten variance summary", teamId: "reconciliation", source: "speedrun", objective: "Cost", status: "done", result: { text: "Adopted · v2.2", tone: "neutral" }, updatedMinutesAgo: 300 },
  { id: "019", title: "Batch receipt matching", teamId: "expense-review", source: "speedrun", objective: "Latency", status: "queued", queuePosition: 2, result: { text: "90 cases · Ready", tone: "neutral" }, updatedMinutesAgo: 320 },
  { id: "018", title: "Escalation lead prompt v3", teamId: "escalation", source: "agent-studio", objective: "Success", status: "pending", result: { text: "Test set required", tone: "neutral" }, updatedMinutesAgo: 400, config: config018 },
  { id: "017", title: "Parallel vendor lookup", teamId: "invoice", source: "speedrun", objective: "Latency", status: "needs-review", result: { text: "P95 −6.0% · 1 regression", tone: "warn", grade: "simulated" }, updatedMinutesAgo: 480 },
  { id: "016", title: "Reuse ledger mapping", teamId: "reconciliation", source: "speedrun", objective: "Cost", status: "pending", result: { text: "Test set required", tone: "neutral" }, updatedMinutesAgo: 560, config: config016 },
  { id: "015", title: "Smaller model for replies", teamId: "order-support", source: "speedrun", objective: "Cost", status: "done", result: { text: "Not adopted", tone: "neutral" }, updatedMinutesAgo: 1440 },
  { id: "014", title: "Tighten refund eligibility prompt", teamId: "refund", source: "agent-studio", objective: "Success", status: "done", result: { text: "Adopted · v1.4", tone: "neutral" }, updatedMinutesAgo: 2880 },
  { id: "013", title: "Expense policy summary", teamId: "expense-review", source: "speedrun", objective: "Cost", status: "done", result: { text: "Adopted · v2.0", tone: "neutral" }, updatedMinutesAgo: 4320 },
  { id: "012", title: "Invoice OCR fallback", teamId: "invoice", source: "agent-studio", objective: "Success", status: "done", result: { text: "Adopted · v1.9", tone: "neutral" }, updatedMinutesAgo: 5760 },
  { id: "011", title: "Escalation hand-off format", teamId: "escalation", source: "speedrun", objective: "Latency", status: "done", result: { text: "Not adopted", tone: "neutral" }, updatedMinutesAgo: 7200 },
];

export const sandboxCapacity = { slots: 1, inUse: 1, environment: "Orders API test" };
