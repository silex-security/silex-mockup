/* SILEX-authored seed for the Security World Model.
   Everything here is Silex's own mock content (marked src "silex" in the graph)
   so the demo can be honest about which nodes come from public ontologies
   (D3FEND / ATLAS / ATT&CK / UCO / OWASP) and which are illustrative.
   Figures line up with the numbers already shown elsewhere in the mockup. */

export const GROUPS = [
  { id:'identity', name:'Identity & Authority', glyph:'circle',   blurb:'Users, service accounts, roles, delegation, permission' },
  { id:'agent',    name:'Agent & Model',        glyph:'square',   blurb:'Agents, models, memory, planners, execution context' },
  { id:'tool',     name:'Tool & Action',        glyph:'diamond',  blurb:'Tools, APIs, actions, state transitions, side effects' },
  { id:'resource', name:'Resource & Data',      glyph:'triangle', glyphAlt:'triangle2', blurb:'Assets, records, datasets, credentials, sensitive fields' },
  { id:'workflow', name:'Workflow',             glyph:'wye',      blurb:'Goals, sequences, dependencies, legitimate completion' },
  { id:'policy',   name:'Policy & Control',     glyph:'plus',     blurb:'Rules, guardrails, approvals, enforcement decisions' },
  { id:'threat',   name:'Threat & Failure',     glyph:'star',     blurb:'Incidents, evidence, vulnerabilities, mechanisms, TTPs' },
  { id:'outcome',  name:'Outcome',              glyph:'asterisk', blurb:'Business results, prohibited outcomes, loss, continuity' }
];

export const LAYERS = [
  { id:1, key:'general',  name:'General Agent Security Ontology', blurb:'Reusable semantics shared by every domain and every agentic system' },
  { id:2, key:'domain',   name:'Domain Ontology Packs',           blurb:'Business meaning per enterprise domain' },
  { id:3, key:'agentic',  name:'Agentic-System Ontology',         blurb:'Planner, memory, tools, MCP and the threats that target them' },
  { id:4, key:'runtime',  name:'Runtime Knowledge Graph',         blurb:'What is actually deployed, observed and decided right now' }
];

export const DIMENSIONS = [
  { id:'identity', name:'Identity & Authority' }, { id:'agent', name:'Agent & Tool' },
  { id:'workflow', name:'Workflow' },             { id:'policy', name:'Policy & Control' },
  { id:'resource', name:'Resource & Data' },      { id:'outcome', name:'Business Outcome' }
];

/* ---- L2: domain packs ---------------------------------------------------- */
export const DOMAINS = [
  { id:'finance', name:'Finance', code:'FI', coverage:.86, agents:12, workflows:38, incidents:4,
    pack:'Finance Security Pack v2.6', owner:'CFO · Finance Operations',
    dims:{ identity:.9, agent:.88, workflow:.81, policy:.89, resource:.84, outcome:.86 },
    entities:['Invoice','Vendor Master Record','Payment Run','Bank Account','Journal Entry','Approval Threshold','Payment Authorisation'],
    capabilities:[
      { id:'fi-ap', name:'Accounts Payable', coverage:.83, entities:2140, incidents:3,
        dims:{ identity:.88, agent:.9, workflow:.76, policy:.87, resource:.8, outcome:.83 },
        workflows:[
          { id:'WF-011', name:'Invoice Processing', coverage:.88, entities:920 },
          { id:'WF-012', name:'Vendor Management', coverage:.71, entities:610 },
          { id:'WF-013', name:'Payment Approval', coverage:.9,  entities:610 }] },
      { id:'fi-tr', name:'Treasury', coverage:.9, entities:1480, incidents:1,
        dims:{ identity:.93, agent:.86, workflow:.88, policy:.92, resource:.87, outcome:.9 },
        workflows:[
          { id:'WF-014', name:'Cash Management', coverage:.92, entities:640 },
          { id:'WF-015', name:'Liquidity Forecasting', coverage:.85, entities:430 },
          { id:'WF-016', name:'Bank Operations', coverage:.93, entities:410 }] },
      { id:'fi-ct', name:'Controllership', coverage:.87, entities:3180, incidents:0,
        dims:{ identity:.9, agent:.87, workflow:.84, policy:.9, resource:.86, outcome:.88 },
        workflows:[
          { id:'WF-017', name:'Journal Entry', coverage:.89, entities:1450 },
          { id:'WF-018', name:'Period Close', coverage:.84, entities:980 },
          { id:'WF-019', name:'Reconciliation', coverage:.88, entities:750 }] }] },

  { id:'support', name:'Customer Service', code:'CX', coverage:.79, agents:18, workflows:64, incidents:7,
    pack:'Customer Service Pack v1.9', owner:'COO · Customer Operations',
    dims:{ identity:.82, agent:.84, workflow:.72, policy:.78, resource:.76, outcome:.81 },
    entities:['Customer','Ticket','Refund','Order','Entitlement','Knowledge Article','Escalation'],
    capabilities:[
      { id:'cx-rf', name:'Refunds & Adjustments', coverage:.74, entities:2860, incidents:4,
        dims:{ identity:.8, agent:.83, workflow:.66, policy:.72, resource:.71, outcome:.78 },
        workflows:[
          { id:'WF-021', name:'Customer Refund', coverage:.68, entities:1320 },
          { id:'WF-022', name:'Goodwill Credit', coverage:.77, entities:840 },
          { id:'WF-023', name:'Chargeback Response', coverage:.8, entities:700 }] },
      { id:'cx-tk', name:'Ticket Triage', coverage:.85, entities:4210, incidents:2,
        dims:{ identity:.86, agent:.9, workflow:.8, policy:.84, resource:.82, outcome:.85 },
        workflows:[
          { id:'WF-024', name:'Intent Classification', coverage:.9, entities:1900 },
          { id:'WF-025', name:'Escalation Routing', coverage:.82, entities:1210 },
          { id:'WF-026', name:'Knowledge Retrieval', coverage:.79, entities:1100 }] },
      { id:'cx-id', name:'Customer Identity Verification', coverage:.76, entities:1640, incidents:1,
        dims:{ identity:.79, agent:.78, workflow:.7, policy:.77, resource:.74, outcome:.76 },
        workflows:[
          { id:'WF-027', name:'Account Recovery', coverage:.72, entities:880 },
          { id:'WF-028', name:'PII Disclosure Check', coverage:.8, entities:760 }] }] },

  { id:'identity-it', name:'Identity & IT', code:'IT', coverage:.91, agents:9, workflows:27, incidents:2,
    pack:'Identity & IT Pack v3.1', owner:'CIO · Platform Engineering',
    dims:{ identity:.96, agent:.9, workflow:.87, policy:.93, resource:.89, outcome:.88 },
    entities:['User Account','Service Principal','Role','Entitlement','Access Request','Secret','Endpoint'],
    capabilities:[
      { id:'it-jm', name:'Joiner / Mover / Leaver', coverage:.94, entities:5320, incidents:0,
        dims:{ identity:.97, agent:.9, workflow:.92, policy:.95, resource:.9, outcome:.9 },
        workflows:[
          { id:'WF-031', name:'Account Provisioning', coverage:.96, entities:2400 },
          { id:'WF-032', name:'Access Review', coverage:.91, entities:1620 },
          { id:'WF-033', name:'Offboarding', coverage:.94, entities:1300 }] },
      { id:'it-sec', name:'Secrets & Credentials', coverage:.88, entities:2110, incidents:2,
        dims:{ identity:.93, agent:.88, workflow:.82, policy:.9, resource:.86, outcome:.85 },
        workflows:[
          { id:'WF-034', name:'Secret Rotation', coverage:.9, entities:1150 },
          { id:'WF-035', name:'Agent Credential Issuance', coverage:.85, entities:960 }] }] },

  { id:'hr', name:'Human Resources', code:'HR', coverage:.68, agents:6, workflows:19, incidents:1,
    pack:'HR Pack v1.2 (draft)', owner:'CHRO · People Operations',
    dims:{ identity:.74, agent:.7, workflow:.58, policy:.69, resource:.66, outcome:.71 },
    entities:['Employee','Candidate','Compensation Record','Leave Request','Performance Review'],
    capabilities:[
      { id:'hr-on', name:'Onboarding', coverage:.72, entities:1240, incidents:1,
        dims:{ identity:.78, agent:.73, workflow:.62, policy:.72, resource:.7, outcome:.74 },
        workflows:[
          { id:'WF-041', name:'Offer & Contract', coverage:.75, entities:640 },
          { id:'WF-042', name:'Day-one Access', coverage:.69, entities:600 }] },
      { id:'hr-pay', name:'Payroll & Benefits', coverage:.63, entities:980, incidents:0,
        dims:{ identity:.7, agent:.66, workflow:.54, policy:.65, resource:.61, outcome:.67 },
        workflows:[
          { id:'WF-043', name:'Payroll Adjustment', coverage:.6, entities:520 },
          { id:'WF-044', name:'Benefits Enrolment', coverage:.66, entities:460 }] }] },

  { id:'procurement', name:'Procurement', code:'PO', coverage:.74, agents:8, workflows:31, incidents:3,
    pack:'Procurement Pack v1.7', owner:'CPO · Sourcing',
    dims:{ identity:.8, agent:.77, workflow:.69, policy:.75, resource:.66, outcome:.76 },
    entities:['Purchase Order','Supplier','Contract','Sourcing Event','Goods Receipt','Spend Category'],
    capabilities:[
      { id:'po-src', name:'Sourcing & Contracts', coverage:.78, entities:1860, incidents:1,
        dims:{ identity:.83, agent:.8, workflow:.73, policy:.78, resource:.7, outcome:.8 },
        workflows:[
          { id:'WF-051', name:'Supplier Onboarding', coverage:.7, entities:900 },
          { id:'WF-052', name:'Contract Review', coverage:.84, entities:960 }] },
      { id:'po-p2p', name:'Purchase to Pay', coverage:.7, entities:2420, incidents:2,
        dims:{ identity:.77, agent:.74, workflow:.65, policy:.72, resource:.62, outcome:.72 },
        workflows:[
          { id:'WF-053', name:'PO Creation', coverage:.76, entities:1120 },
          { id:'WF-054', name:'Three-way Match', coverage:.68, entities:780 },
          { id:'WF-055', name:'Vendor Master Change', coverage:.55, entities:520 }] }] }
];

/* ---- L3: agentic-system components -------------------------------------- */
export const AGENTIC_COMPONENTS = [
  { id:'planner',    name:'Planner / Reasoner',   group:'agent',    coverage:.84, instances:53, blurb:'Decomposes a goal into steps and chooses the next action.' },
  { id:'memory-st',  name:'Short-term Memory',    group:'agent',    coverage:.79, instances:53, blurb:'Working context carried across steps of one run.' },
  { id:'memory-lt',  name:'Long-term Memory',     group:'agent',    coverage:.66, instances:31, blurb:'Persisted state reused across runs — a poisoning target.' },
  { id:'retriever',  name:'Retriever / RAG Index',group:'resource', coverage:.72, instances:24, blurb:'Vector or keyword index feeding untrusted content into context.' },
  { id:'tool-reg',   name:'Tool Registry',        group:'tool',     coverage:.88, instances:186,blurb:'Declared tools, their scopes and their side effects.' },
  { id:'mcp',        name:'MCP / API Connector',  group:'tool',     coverage:.81, instances:64, blurb:'Transport that exposes enterprise systems to the agent.' },
  { id:'subagent',   name:'Sub-agent Delegation', group:'agent',    coverage:.61, instances:19, blurb:'Agent-to-agent hand-off; authority travels with the call.' },
  { id:'cred-store', name:'Credential Broker',    group:'identity', coverage:.9,  instances:42, blurb:'Issues the identity an agent acts under.' },
  { id:'exec-ctx',   name:'Execution Context',    group:'agent',    coverage:.77, instances:53, blurb:'Sandbox, runtime permissions and resource limits for a run.' },
  { id:'guardrail',  name:'Guardrail / Policy Engine', group:'policy', coverage:.87, instances:128, blurb:'Evaluates each proposed action against policy before it runs.' },
  { id:'hitl',       name:'Human Approval Gate',  group:'policy',   coverage:.83, instances:37, blurb:'Human decision point inserted into the agent loop.' },
  { id:'trace',      name:'Trace & Telemetry',    group:'workflow', coverage:.92, instances:53, blurb:'Observed steps, tool calls and decisions — the evidence base.' }
];

/* ---- L4: runtime instances ---------------------------------------------- */
export const RUNTIME = {
  nodes:[
    { id:'rt-refund-agent', name:'Refund Agent', group:'agent', type:'planner', coverage:.68, blurb:'Customer Service refund automation running WF-021.', domain:'support' },
    { id:'rt-ap-agent',   name:'AP Invoice Agent', group:'agent', type:'planner', coverage:.88, blurb:'Finance accounts-payable automation running WF-011.', domain:'finance' },
    { id:'rt-treasury-agent', name:'Treasury Agent', group:'agent', type:'planner', coverage:.92, blurb:'Cash-management agent running WF-014.', domain:'finance' },
    { id:'rt-refund-mem', name:'Refund Agent · long-term memory', group:'agent', type:'memory-lt', coverage:.54, blurb:'Case notes reused across refund runs.', domain:'support' },
    { id:'rt-kb-index',   name:'Support KB Index', group:'resource', type:'retriever', coverage:.7, blurb:'RAG index over customer knowledge articles and past tickets.', domain:'support' },
    { id:'rt-mcp-pay',    name:'MCP · Payments', group:'tool', type:'mcp', coverage:.84, blurb:'Connector exposing the payments API to agents.', domain:'finance' },
    { id:'rt-mcp-crm',    name:'MCP · CRM', group:'tool', type:'mcp', coverage:.78, blurb:'Connector exposing customer records to agents.', domain:'support' },
    { id:'rt-tool-refund',name:'issueRefund()', group:'tool', type:'tool-reg', coverage:.72, blurb:'Money-moving tool call with a 500 USD auto-approve ceiling.', domain:'support' },
    { id:'rt-tool-vendor',name:'updateVendorBank()', group:'tool', type:'tool-reg', coverage:.55, blurb:'Vendor master bank-detail mutation.', domain:'procurement' },
    { id:'rt-svc-identity',name:'svc-refund-agent', group:'identity', type:'cred-store', coverage:.9, blurb:'Service principal the refund agent acts under.', domain:'support' },
    { id:'rt-user-csr',   name:'CSR · Tier-2 queue', group:'identity', type:'cred-store', coverage:.86, blurb:'Human delegator whose authority the agent inherits.', domain:'support' },
    { id:'rt-db-vendor',  name:'Vendor Master DB', group:'resource', type:'tool-reg', coverage:.58, blurb:'System of record for supplier payment details.', domain:'procurement' },
    { id:'rt-ledger',     name:'Payment Ledger', group:'resource', type:'tool-reg', coverage:.89, blurb:'Authoritative record of outgoing payments.', domain:'finance' },
    { id:'rt-policy-500', name:'Refund ceiling · 500 USD', group:'policy', type:'guardrail', coverage:.93, blurb:'Auto-approve ceiling above which a human must decide.', domain:'support' },
    { id:'rt-policy-dual',name:'Dual control · vendor bank change', group:'policy', type:'guardrail', coverage:.76, blurb:'Second approver required for bank-detail mutations.', domain:'procurement' },
    { id:'rt-hitl-t2',    name:'Tier-2 approval gate', group:'policy', type:'hitl', coverage:.83, blurb:'Human decision point on high-value refunds.', domain:'support' },
    { id:'rt-wf-021',     name:'WF-021 Customer Refund', group:'workflow', type:'trace', coverage:.68, blurb:'Registered workflow under validation.', domain:'support' },
    { id:'rt-wf-011',     name:'WF-011 Invoice Processing', group:'workflow', type:'trace', coverage:.88, blurb:'Registered workflow, deployed.', domain:'finance' },
    { id:'rt-wf-055',     name:'WF-055 Vendor Master Change', group:'workflow', type:'trace', coverage:.55, blurb:'Registered workflow with an open coverage gap.', domain:'procurement' },
    { id:'rt-inc-1042',   name:'I-1042 Refund loop', group:'threat', type:'incident', coverage:1, severity:'critical', blurb:'Refund agent re-issued a refund after a partial failure.', domain:'support' },
    { id:'rt-inc-0987',   name:'I-0987 Vendor bank change', group:'threat', type:'incident', coverage:1, severity:'serious', blurb:'Bank details changed from an unverified email instruction.', domain:'procurement' },
    { id:'rt-out-loss',   name:'Unrecoverable payout', group:'outcome', type:'prohibited', coverage:1, blurb:'Prohibited outcome: money leaves without a recoverable path.', domain:'finance' },
    { id:'rt-out-pii',    name:'PII disclosed to wrong party', group:'outcome', type:'prohibited', coverage:1, blurb:'Prohibited outcome: customer data reaches an unverified requester.', domain:'support' },
    { id:'rt-out-served', name:'Customer made whole', group:'outcome', type:'legitimate', coverage:1, blurb:'Legitimate completion: refund issued once, correctly.', domain:'support' }
  ],
  links:[
    ['rt-user-csr','rt-svc-identity','DELEGATES_AUTHORITY'],
    ['rt-svc-identity','rt-refund-agent','AUTHORIZES'],
    ['rt-refund-agent','rt-refund-mem','READS_WRITES'],
    ['rt-refund-agent','rt-kb-index','RETRIEVES_FROM'],
    ['rt-refund-agent','rt-mcp-crm','CALLS'],
    ['rt-refund-agent','rt-tool-refund','CALLS'],
    ['rt-tool-refund','rt-ledger','MUTATES'],
    ['rt-policy-500','rt-tool-refund','GOVERNS'],
    ['rt-hitl-t2','rt-tool-refund','GATES'],
    ['rt-wf-021','rt-refund-agent','EXECUTED_BY'],
    ['rt-inc-1042','rt-wf-021','OCCURRED_IN'],
    ['rt-inc-1042','rt-out-loss','REACHES'],
    ['rt-refund-mem','rt-inc-1042','CONTRIBUTED_TO'],
    ['rt-wf-021','rt-out-served','INTENDS'],
    ['rt-ap-agent','rt-mcp-pay','CALLS'],
    ['rt-mcp-pay','rt-ledger','MUTATES'],
    ['rt-wf-011','rt-ap-agent','EXECUTED_BY'],
    ['rt-treasury-agent','rt-mcp-pay','CALLS'],
    ['rt-tool-vendor','rt-db-vendor','MUTATES'],
    ['rt-policy-dual','rt-tool-vendor','GOVERNS'],
    ['rt-wf-055','rt-tool-vendor','INVOKES'],
    ['rt-inc-0987','rt-wf-055','OCCURRED_IN'],
    ['rt-inc-0987','rt-out-loss','REACHES'],
    ['rt-db-vendor','rt-tool-refund','INFORMS'],
    ['rt-kb-index','rt-inc-1042','CONTRIBUTED_TO'],
    ['rt-mcp-crm','rt-out-pii','CAN_REACH']
  ]
};

/* ---- coverage gaps ------------------------------------------------------- */
export const GAPS = [
  { id:'g-hr', title:'HR workflows only partly represented', detail:'6 agents known, 2 of 19 workflows registered · coverage 68%',
    severity:'serious', scope:['enterprise','hr'], action:{ label:'Register workflows', kind:'gap', value:'HR workflows' } },
  { id:'g-vendor', title:'Procurement vendor data not connected', detail:'Vendor master changes are inferred from tool calls, not observed at the source',
    severity:'critical', scope:['enterprise','procurement','po-p2p','WF-055'], action:{ label:'Connect data', kind:'gap', value:'Procurement vendor data' } },
  { id:'g-unreg', title:'3 known workflows not yet registered', detail:'Discovered in the environment but missing from the Workflow Library',
    severity:'serious', scope:['enterprise'], action:{ label:'Review', kind:'libUnregistered', value:'1' } },
  { id:'g-memory', title:'Long-term memory contents unmodelled', detail:'31 agents persist memory across runs; what is stored there is not in the world model',
    severity:'critical', scope:['enterprise','support','cx-rf','WF-021'], action:{ label:'Open incident I-1042', kind:'incident', value:'I-1042' } },
  { id:'g-subagent', title:'Sub-agent delegation partly observed', detail:'19 delegations seen; authority inherited across the hand-off is inferred, not read',
    severity:'warning', scope:['enterprise'], action:null },
  { id:'g-horizontal', title:'Horizontal agents unassigned to a domain', detail:'File-reading and analytics agents used by every domain · taxonomy deferred',
    severity:'warning', scope:['enterprise'], action:null },
  { id:'g-refund', title:'Refund path coverage below target', detail:'WF-021 at 68% · goodwill-credit branch and partial-failure retries not represented',
    severity:'serious', scope:['enterprise','support','cx-rf','WF-021'], action:{ label:'Open WF-021', kind:'workflow', value:'WF-021' } },
  { id:'g-payroll', title:'Payroll adjustment mostly unobserved', detail:'WF-043 at 60% · compensation records are read through an unmonitored connector',
    severity:'serious', scope:['enterprise','hr','hr-pay','WF-043'], action:null }
];

/* ---- OWASP catalogues (public lists, cited in SOURCES.md) ---------------- */
export const OWASP_LLM = [
  ['LLM01','Prompt Injection','planner'], ['LLM02','Sensitive Information Disclosure','retriever'],
  ['LLM03','Supply Chain Vulnerabilities','tool-reg'], ['LLM04','Data and Model Poisoning','memory-lt'],
  ['LLM05','Improper Output Handling','exec-ctx'], ['LLM06','Excessive Agency','tool-reg'],
  ['LLM07','System Prompt Leakage','planner'], ['LLM08','Vector and Embedding Weaknesses','retriever'],
  ['LLM09','Misinformation','memory-st'], ['LLM10','Unbounded Consumption','exec-ctx']
];

export const OWASP_AGENTIC = [
  ['T1','Memory Poisoning','memory-lt'], ['T2','Tool Misuse','tool-reg'], ['T3','Privilege Compromise','cred-store'],
  ['T4','Resource Overload','exec-ctx'], ['T5','Cascading Hallucination Attacks','memory-st'],
  ['T6','Intent Breaking & Goal Manipulation','planner'], ['T7','Misaligned & Deceptive Behaviours','planner'],
  ['T8','Repudiation & Untraceability','trace'], ['T9','Identity Spoofing & Impersonation','cred-store'],
  ['T10','Overwhelming Human-in-the-Loop','hitl'], ['T11','Unexpected RCE and Code Attacks','exec-ctx'],
  ['T12','Agent Communication Poisoning','subagent'], ['T13','Rogue Agents in Multi-Agent Systems','subagent'],
  ['T14','Human Attacks on Multi-Agent Systems','subagent'], ['T15','Human Manipulation','hitl']
];

/* Which L1 group a public-ontology node lands in, by keyword. First hit wins. */
export const GROUP_HINTS = [
  ['identity', /identit|credential|account|token|authenticat|authoriz|privileg|permission|role|certificate|password|session|key/i],
  ['agent',    /agent|model|inference|llm|prompt|memory|planner|neural|training|machine.?learn|ml /i],
  ['tool',     /tool|api|function|command|call|service|process|execut|script|shell|container|job|task/i],
  ['resource', /file|data|database|record|document|storage|volume|repositor|dataset|index|embedding|artifact|asset|network|host|image/i],
  ['policy',   /policy|control|guardrail|approv|rule|filter|isolat|harden|restrict|validat|verif|authoriz.?polic|mitigat|defen/i],
  ['threat',   /attack|threat|exploit|malware|injection|poison|exfiltrat|evasion|compromis|abuse|vulnerab|impact|persistence|reconnaissance|discovery|collection|impair/i],
  ['workflow', /workflow|sequence|orchestrat|pipeline|chain|procedure|plan|schedul/i],
  ['outcome',  /outcome|result|loss|damage|availability|integrity|confidential|business/i]
];
