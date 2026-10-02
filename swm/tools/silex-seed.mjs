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
  { id:1, key:'general',  name:'General Agent Ontology Graph', blurb:'Reusable semantics shared by every domain and every agentic system' },
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
  { id:'trace',      name:'Trace & Telemetry',    group:'workflow', coverage:.92, instances:53, blurb:'Observed steps, tool calls and decisions — the evidence base.' },
  { id:'harness',    name:'Business Outcome Harness', group:'outcome', coverage:.82, instances:24, blurb:'Legitimate completion, prohibited outcomes, cost and the business constraints an agent must respect.' }
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
    { id:'rt-inc-1042',   name:'I-1042 Refund loop', group:'threat', type:'incident', parent:'rt-wf-021', coverage:1, severity:'critical', blurb:'Refund agent re-issued a refund after a partial failure.', domain:'support' },
    { id:'rt-inc-0987',   name:'I-0987 Vendor bank change', group:'threat', type:'incident', parent:'rt-wf-055', coverage:1, severity:'serious', blurb:'Bank details changed from an unverified email instruction.', domain:'procurement' },
    { id:'rt-out-loss',   name:'Unrecoverable payout', group:'outcome', type:'harness', outcome:'prohibited', coverage:1, blurb:'Prohibited outcome: money leaves without a recoverable path.', domain:'finance' },
    { id:'rt-out-pii',    name:'PII disclosed to wrong party', group:'outcome', type:'harness', outcome:'prohibited', coverage:1, blurb:'Prohibited outcome: customer data reaches an unverified requester.', domain:'support' },
    { id:'rt-out-served', name:'Customer made whole', group:'outcome', type:'harness', outcome:'legitimate', coverage:1, blurb:'Legitimate completion: refund issued once, correctly.', domain:'support' }
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
  ['outcome',  /prohibited|legitimate completion|outcome|result|loss|damage|availability|integrity|confidential|business/i]
];

/* ==== ontology rigor exports (plan 2026-10-02, contract: ./schema.mjs) =====
   Shapes are fixed by the plan's Contract section. Every id below is a Silex id
   (no namespace prefix) unless it points at a public node, which keeps its
   bundle id (e.g. 'attack:T1078', 'd3f:d3f:Credential', 'owasp:LLM06').

   Conventions this file follows (also recorded in references/seed-schema.md):
   - CORE_L1[].id is the bare Silex id other exports reference.
   - ENTITY_ISA and DOMAIN_HAZARDS.hazardFor name L2 entities by their label,
     exactly as DOMAINS[].entities / CANDIDATE_DOMAINS[].entities spell them.
   - DOMAIN_ACTIONS[].id and domain hazard ids are bare Silex ids.
   - Public references always carry their bundle id. */

/* L1 Silex core concepts: [{ id, label, group, kind, def, parent, relatedMatch? }]
   kind ∈ CORE_KINDS; parent is another core id (subsumption) or 'grp:<group>' (navigation). */
export const CORE_L1 = [
  /* identity and authority */
  { id:'core-principal', label:'Principal', group:'identity', kind:'core', parent:'grp:identity',
    def:'An actor that can hold identity, authority and accountability in an enterprise system.',
    relatedMatch:['uco:identity:Identity'] },
  { id:'core-human-user', label:'Human User', group:'identity', kind:'core', parent:'core-principal',
    def:'A person who authenticates and acts directly, or on whose behalf an agent acts.',
    relatedMatch:['uco:identity:Person'] },
  { id:'core-service-account', label:'Service Account', group:'identity', kind:'core', parent:'core-principal',
    def:'A non-human identity issued to software or an agent so it can act under its own name.',
    relatedMatch:['uco:observable:Account'] },
  { id:'core-agent-identity', label:'Agent Identity', group:'identity', kind:'core', parent:'core-principal',
    def:'The identity an autonomous agent presents when it acts, distinct from the model instance behind it.' },
  { id:'core-external-party', label:'External Party', group:'identity', kind:'core', parent:'core-principal',
    def:'An actor outside the enterprise boundary whose requests or data the system must treat as untrusted by default.' },
  { id:'core-authenticated-subject', label:'Authenticated Subject', group:'identity', kind:'core', parent:'core-principal',
    def:'The identity a request is proven to come from after verification, as opposed to one merely asserted.' },
  { id:'core-credential', label:'Authentication credential', group:'identity', kind:'core', parent:'grp:identity',
    def:'A secret or token that proves an identity and can be replayed or stolen if mishandled.',
    relatedMatch:['d3f:d3f:Credential'] },
  { id:'core-authority', label:'Authority', group:'identity', kind:'core', parent:'grp:identity',
    def:'The right to make a particular decision or cause a particular state change on behalf of the enterprise.' },
  { id:'core-authorization-scope', label:'Authorization Scope', group:'identity', kind:'core', parent:'core-authority',
    def:'The boundary of what an authority permits: which resources, actions and amounts it covers.' },
  { id:'core-delegation', label:'Delegation', group:'identity', kind:'core', parent:'core-authority',
    def:'The act of passing authority to another actor, and the record of how far that authority travelled.' },

  /* intent and provenance */
  { id:'core-request', label:'Request', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'An instruction or demand that starts a unit of work and should stay attached to its outcome.' },
  { id:'core-purpose', label:'Purpose', group:'workflow', kind:'core', parent:'core-request',
    def:'The stated reason a request is made, which an action must remain consistent with.' },
  { id:'core-provenance', label:'Provenance', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'The origin and chain of custody of a request, datum or instruction.' },
  { id:'core-value-flow', label:'Value Flow', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'The path by which money or another measurable value moves through a process.' },
  { id:'core-trust-boundary', label:'Trust Boundary', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'A line across which the trust level of content or an actor changes and must be re-established.' },
  { id:'core-consent', label:'Consent', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'A subject permission that limits whether and how their data or authority may be used.' },

  /* generic L1 classes the components and business entities specialise */
  { id:'core-agent', label:'Agent', group:'agent', kind:'core', parent:'grp:agent',
    def:'A goal-directed software actor that reasons and takes steps, alone or handing off to another agent.' },
  { id:'core-tool', label:'Callable tool (agent-facing)', group:'tool', kind:'core', parent:'grp:tool',
    def:'A callable capability with a defined scope and side effect that an agent can invoke.',
    relatedMatch:['uco:tool:Tool'] },
  { id:'core-memory', label:'Memory', group:'agent', kind:'core', parent:'grp:agent',
    def:'State an agent carries between steps or across runs, and can later read back.' },
  { id:'core-retrieval', label:'Retrieval Index', group:'resource', kind:'core', parent:'grp:resource',
    def:'A searchable store that selects content to place into an agent context.' },
  { id:'core-guardrail', label:'Guardrail', group:'policy', kind:'core', parent:'grp:policy',
    def:'A rule or policy engine that decides whether a proposed action may proceed.' },
  { id:'core-human-gate', label:'Human decision point', group:'policy', kind:'core', parent:'grp:policy',
    def:'A named human decision point that can stop or release an otherwise automatic action.' },
  { id:'core-telemetry', label:'Telemetry', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'The observed record of steps, calls and decisions that later evidence is read from.' },
  { id:'core-outcome-harness', label:'Outcome Harness', group:'outcome', kind:'core', parent:'grp:outcome',
    def:'The business constraints and completion conditions an agent process must respect.' },
  { id:'core-execution-context', label:'Runtime environment', group:'agent', kind:'core', parent:'grp:agent',
    def:'The sandbox, runtime permissions and resource limits a single run executes inside.' },
  { id:'core-resource', label:'Resource', group:'resource', kind:'core', parent:'grp:resource',
    def:'A thing of enterprise value, data or capability that actions read or change.' },
  { id:'core-record', label:'Business Record', group:'resource', kind:'core', parent:'core-resource',
    def:'A stored statement of business fact, such as an invoice, ticket or review.' },
  { id:'core-party', label:'Party', group:'identity', kind:'core', parent:'grp:identity',
    def:'A person or organisation the enterprise deals with, such as a customer or supplier.' },
  { id:'core-commitment', label:'Commitment', group:'resource', kind:'core', parent:'core-resource',
    def:'An obligation to deliver or pay, such as an order, refund or payment run.' },
  { id:'core-entitlement', label:'Access entitlement (general)', group:'resource', kind:'core', parent:'core-resource',
    def:'A granted right or threshold that determines what an identity may do.' },
  { id:'core-account', label:'Account (value or access holding)', group:'resource', kind:'core', parent:'core-resource',
    def:'A named holding of value or access, such as a bank account or a user account.',
    relatedMatch:['uco:observable:Account'] },

  /* action taxonomy */
  { id:'core-action-read', label:'Read Action', group:'tool', kind:'action', parent:'grp:tool',
    def:'An action whose primary effect is to observe or retrieve without changing business state.' },
  { id:'core-action-write', label:'Write Action', group:'tool', kind:'action', parent:'grp:tool',
    def:'An action that creates or modifies a stored business fact.' },
  { id:'core-action-execute', label:'Execute Action', group:'tool', kind:'action', parent:'grp:tool',
    def:'An action that runs code, a command or a process in the environment.' },
  { id:'core-action-transfer-value', label:'Value Transfer Action', group:'tool', kind:'action', parent:'grp:tool',
    def:'An action that moves money or another measurable value out of the enterprise.' },
  { id:'core-action-approve', label:'Approval Action', group:'tool', kind:'action', parent:'grp:tool',
    def:'An action that formally accepts a request and releases it to proceed.' },
  { id:'core-action-delegate', label:'Delegation Action', group:'tool', kind:'action', parent:'grp:tool',
    def:'An action that grants or passes authority to another actor.' },

  /* effect taxonomy */
  { id:'core-effect-data-read', label:'Data Read Effect', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'Business state changes only in that data was observed.' },
  { id:'core-effect-data-write', label:'Data Write Effect', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'Business state changes because a stored fact was created or updated.' },
  { id:'core-effect-data-disclosure', label:'Data Disclosure Effect', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'Data reaches a party that was not entitled to see it.',
    relatedMatch:['attack:TA0010'] },
  { id:'financial-value-transfer', label:'Financial-value transfer', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'Money or equivalent value leaves the enterprise or moves between accounts.' },
  { id:'core-effect-authority-grant', label:'Authority Grant Effect', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'An identity gains a right it did not previously hold.' },
  { id:'core-effect-configuration-change', label:'Configuration Change Effect', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'A setting, permission or integration is altered from its approved state.' },
  { id:'core-effect-service-disruption', label:'Service Disruption Effect', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'A business service becomes unavailable or degraded.' },
  { id:'core-effect-record-alteration', label:'Record Alteration Effect', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'A stored fact is changed in a way that no longer matches the event that produced it.' },

  /* state taxonomy (classes the prohibited states need) */
  { id:'core-state-standing-privilege', label:'Persistent privilege state', group:'resource', kind:'state', parent:'grp:resource',
    def:'Access that remains granted after the reason for it has passed.' },
  { id:'core-state-unverified-identity', label:'Unverified Identity', group:'resource', kind:'state', parent:'grp:resource',
    def:'A subject is acting before its identity has been proven.' },

  /* security objectives */
  { id:'core-objective-confidentiality', label:'Confidentiality', group:'outcome', kind:'objective', parent:'grp:outcome',
    def:'Information is readable only by parties entitled to it.',
    relatedMatch:['attack:TA0010'] },
  { id:'core-objective-integrity', label:'Integrity', group:'outcome', kind:'objective', parent:'grp:outcome',
    def:'Stored facts keep matching the events that produced them.',
    relatedMatch:['attack:TA0040'] },
  { id:'core-objective-availability', label:'Availability', group:'outcome', kind:'objective', parent:'grp:outcome',
    def:'Business services keep operating when they are needed.' },
  { id:'core-objective-authorization', label:'Authorized Action', group:'outcome', kind:'objective', parent:'grp:outcome',
    def:'Every state change is backed by authority that covers it.' },
  { id:'core-objective-accountability', label:'Accountability', group:'outcome', kind:'objective', parent:'grp:outcome',
    def:'Every decision can be traced to the actor and authority behind it.' },
  { id:'core-objective-safe-completion', label:'Safe Completion', group:'outcome', kind:'objective', parent:'grp:outcome',
    def:'A process reaches its legitimate end without an unacceptable side effect.' },

  /* control taxonomy */
  { id:'human-approval', label:'Human approval', group:'policy', kind:'control', parent:'grp:policy',
    def:'A person must explicitly accept an action before it runs.',
    relatedMatch:['d3f:d3f:AccessMediation'] },
  { id:'core-control-dual-approval', label:'Dual Approval', group:'policy', kind:'control', parent:'grp:policy',
    def:'Two independent people or roles must accept a high-impact action.' },
  { id:'core-control-policy-gate', label:'Policy Gate', group:'policy', kind:'control', parent:'grp:policy',
    def:'An automated rule evaluates a proposed action and can block or redact it.' },
  { id:'core-control-scope-limit', label:'Scope Limit', group:'policy', kind:'control', parent:'grp:policy',
    def:'An action is confined to the resources and targets its authority covers.' },
  { id:'core-control-credential-binding', label:'Credential Binding', group:'policy', kind:'control', parent:'grp:policy',
    def:'A credential is bound to one identity and use so it cannot be replayed elsewhere.',
    relatedMatch:['d3f:d3f:AgentAuthentication'] },
  { id:'core-control-value-ceiling', label:'Value Ceiling', group:'policy', kind:'control', parent:'grp:policy',
    def:'A hard limit on the amount a process may move without additional review.' },
  { id:'core-control-monitoring', label:'Continuous Monitoring', group:'policy', kind:'control', parent:'grp:policy',
    def:'Ongoing observation that raises a signal when behaviour departs from the expected pattern.',
    relatedMatch:['d3f:d3f:PlatformMonitoring'] },

  /* evidence taxonomy */
  { id:'core-evidence-identity-assertion', label:'Identity Assertion', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A claim about who a subject is, and the proof shown for it.' },
  { id:'core-evidence-approval-record', label:'Approval Record', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A record that a named approver accepted a specific request.' },
  { id:'core-evidence-authorization-record', label:'Authorization Record', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A record of the authority an action was permitted to use.' },
  { id:'core-evidence-value-transfer-record', label:'Value Transfer Record', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A record of value moving, with its amount, parties and time.' },
  { id:'core-evidence-data-access-record', label:'Data-access evidence', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A record of which subject read which data, and when.' },
  { id:'core-evidence-configuration-change', label:'Configuration-change evidence', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A record of a setting or permission change and who made it.' },
  { id:'core-evidence-observation', label:'Observation', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A raw observed event from the runtime graph that has not been adjudicated.',
    relatedMatch:['uco:core:Event'] },
  { id:'core-evidence-attestation', label:'Attestation', group:'threat', kind:'evidence', parent:'grp:threat',
    def:'A signed statement from a party that a condition holds.' },

  /* abstract hazard root (exempt from the principle-3 chain; L2 hazards are not) */
  { id:'core-hazard-root', label:'Hazard', group:'threat', kind:'hazard', parent:'grp:threat',
    def:'A condition that makes a harmful outcome possible and calls for a control and evidence.' }
];

/* ENTITY_ISA[domainId][entityLabel] = core id — required for every L2 entity in all 7 packs */
export const ENTITY_ISA = {
  finance: {
    'Invoice':'core-record', 'Vendor Master Record':'core-record', 'Payment Run':'core-commitment',
    'Bank Account':'core-account', 'Journal Entry':'core-record', 'Approval Threshold':'core-entitlement',
    'Payment Authorisation':'core-entitlement'
  },
  support: {
    'Customer':'core-party', 'Ticket':'core-record', 'Refund':'core-commitment', 'Order':'core-commitment',
    'Entitlement':'core-entitlement', 'Knowledge Article':'core-record', 'Escalation':'core-record'
  },
  'identity-it': {
    'User Account':'core-account', 'Service Principal':'core-service-account', 'Role':'core-entitlement',
    'Entitlement':'core-entitlement', 'Access Request':'core-request', 'Secret':'core-credential',
    'Endpoint':'core-resource'
  },
  hr: {
    'Employee':'core-party', 'Candidate':'core-party', 'Compensation Record':'core-record',
    'Leave Request':'core-request', 'Performance Review':'core-record'
  },
  procurement: {
    'Purchase Order':'core-commitment', 'Supplier':'core-party', 'Contract':'core-record',
    'Sourcing Event':'core-record', 'Goods Receipt':'core-record', 'Spend Category':'core-record'
  },
  crm: {
    'Lead':'core-party', 'Opportunity':'core-commitment', 'Account':'core-account', 'Contact':'core-party',
    'Campaign':'core-commitment', 'Case':'core-record'
  },
  legal: {
    'Contract':'core-record', 'Clause Library':'core-record', 'Matter':'core-record',
    'Outside Counsel':'core-party', 'Regulatory Filing':'core-record', 'Legal Hold':'core-record'
  }
};

/* COMPONENT_ISA[componentId] = core id (kind 'core') — the L1 class each of the 13 L3
   AGENTIC_COMPONENTS specialises; it becomes the component's display parent */
export const COMPONENT_ISA = {
  'planner':'core-agent', 'memory-st':'core-memory', 'memory-lt':'core-memory', 'retriever':'core-retrieval',
  'tool-reg':'core-tool', 'mcp':'core-tool', 'subagent':'core-agent', 'cred-store':'core-credential',
  'exec-ctx':'core-execution-context', 'guardrail':'core-guardrail', 'hitl':'core-human-gate',
  'trace':'core-telemetry', 'harness':'core-outcome-harness'
};

/* DOMAIN_ACTIONS[domainId] = [{ id, label, isA, mayCause:[effect id], workflows:[WF id], implementedBy?:[rt id] }] */
export const DOMAIN_ACTIONS = {
  finance: [
    { id:'act-finance-invoice-intake', label:'Invoice Intake', isA:'core-action-write',
      mayCause:['core-effect-data-write'], workflows:['WF-011'] },
    { id:'act-finance-invoice-approve', label:'Invoice Approval', isA:'core-action-approve',
      mayCause:['financial-value-transfer'], workflows:['WF-013'] },
    { id:'act-finance-payment-release', label:'Payment Release', isA:'core-action-transfer-value',
      mayCause:['financial-value-transfer'], workflows:['WF-013','WF-014'], implementedBy:['rt-ledger'] },
    { id:'act-finance-journal-post', label:'Journal Posting', isA:'core-action-write',
      mayCause:['core-effect-record-alteration','core-effect-data-write'], workflows:['WF-017'] },
    { id:'act-finance-reconcile', label:'Reconciliation', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-019'] },
    { id:'act-finance-forecast', label:'Liquidity Forecast', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-015'] }
  ],
  support: [
    { id:'act-support-refund-issue', label:'Refund Issue', isA:'core-action-transfer-value',
      mayCause:['financial-value-transfer','core-effect-data-write'], workflows:['WF-021'], implementedBy:['rt-tool-refund'] },
    { id:'act-support-credit-grant', label:'Goodwill Credit', isA:'core-action-transfer-value',
      mayCause:['financial-value-transfer'], workflows:['WF-022'] },
    { id:'act-support-chargeback-respond', label:'Chargeback Response', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-023'] },
    { id:'act-support-intent-classify', label:'Intent Classification', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-024'] },
    { id:'act-support-escalate', label:'Escalation Routing', isA:'core-action-delegate',
      mayCause:['core-effect-authority-grant'], workflows:['WF-025'] },
    { id:'act-support-pii-disclose', label:'Customer Data Disclosure', isA:'core-action-read',
      mayCause:['core-effect-data-disclosure'], workflows:['WF-028'] },
    { id:'act-support-knowledge-retrieve', label:'Knowledge Retrieval', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-026'] }
  ],
  'identity-it': [
    { id:'act-it-provision', label:'Account Provisioning', isA:'core-action-write',
      mayCause:['core-effect-authority-grant'], workflows:['WF-031'] },
    { id:'act-it-review-access', label:'Access Review', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-032'] },
    { id:'act-it-offboard', label:'Offboarding', isA:'core-action-delegate',
      mayCause:['core-effect-authority-grant'], workflows:['WF-033'] },
    { id:'act-it-rotate-secret', label:'Secret Rotation', isA:'core-action-write',
      mayCause:['core-effect-configuration-change'], workflows:['WF-034'] },
    { id:'act-it-issue-credential', label:'Agent Credential Issuance', isA:'core-action-delegate',
      mayCause:['core-effect-authority-grant'], workflows:['WF-035'] }
  ],
  hr: [
    { id:'act-hr-offer', label:'Offer Issuance', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-041'] },
    { id:'act-hr-day1-access', label:'Day-one Access Grant', isA:'core-action-delegate',
      mayCause:['core-effect-authority-grant'], workflows:['WF-042'] },
    { id:'act-hr-payroll-adjust', label:'Payroll Adjustment', isA:'core-action-write',
      mayCause:['financial-value-transfer','core-effect-record-alteration'], workflows:['WF-043'] },
    { id:'act-hr-benefits-enrol', label:'Benefits Enrolment', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-044'] }
  ],
  procurement: [
    { id:'act-proc-supplier-onboard', label:'Supplier Onboarding', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-051'] },
    { id:'act-proc-contract-review', label:'Contract Review', isA:'core-action-approve',
      mayCause:['core-effect-record-alteration'], workflows:['WF-052'] },
    { id:'act-proc-po-create', label:'Purchase Order Creation', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-053'], implementedBy:['rt-db-vendor'] },
    { id:'act-proc-three-way-match', label:'Three-way Match', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-054'] },
    { id:'act-proc-vendor-bank-change', label:'Vendor Bank Detail Change', isA:'core-action-write',
      mayCause:['financial-value-transfer','core-effect-record-alteration'], workflows:['WF-055'],
      implementedBy:['rt-tool-vendor','rt-db-vendor'] }
  ],
  crm: [
    { id:'act-crm-lead-qualify', label:'Lead Qualification', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-071'] },
    { id:'act-crm-quote-price', label:'Opportunity Pricing', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-072'] },
    { id:'act-crm-case-resolve', label:'Case Resolution', isA:'core-action-write',
      mayCause:['core-effect-data-write'], workflows:['WF-073'] }
  ],
  legal: [
    { id:'act-legal-clause-review', label:'Clause Review', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-081'] },
    { id:'act-legal-redline', label:'Redline Preparation', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-081'] },
    { id:'act-legal-file-regulator', label:'Submit regulatory filing', isA:'core-action-write',
      mayCause:['core-effect-record-alteration'], workflows:['WF-082'] }
  ]
};

/* PROHIBITED[domainId] = [{ id, label, kind:'effect'|'state', isA, def }]
   The five former "(prohibited)" L2 entities, retyped as effects or states. */
export const PROHIBITED = {
  finance: [
    { id:'proh-finance-unrecoverable-payout', label:'Unrecoverable Payout', kind:'effect',
      isA:'financial-value-transfer',
      def:'An effect rather than a business entity: it names what a payment action produced, not a thing the enterprise owns.' }
  ],
  support: [
    { id:'proh-support-pii-disclosure', label:'PII Disclosure to Wrong Party', kind:'effect',
      isA:'core-effect-data-disclosure',
      def:'An effect of a disclosure action, classified as an outcome of the process rather than a stored record.' }
  ],
  'identity-it': [
    { id:'proh-identity-standing-privilege', label:'Standing Privilege', kind:'state',
      isA:'core-state-standing-privilege',
      def:'A condition of an entitlement that persists after its justification ends, so it is modelled as a state.' }
  ],
  hr: [
    { id:'proh-hr-unauthorised-pay-change', label:'Unauthorised Pay Change', kind:'effect',
      isA:'financial-value-transfer',
      def:'An effect of an unapproved compensation action on the value already committed to an employee.' }
  ],
  procurement: [
    { id:'proh-proc-unverified-bank-change', label:'Unverified Bank Change', kind:'effect',
      isA:'core-effect-record-alteration',
      def:'An effect of a supplier record change that no independent evidence supported, not an entity type.' }
  ]
};

/* DOMAIN_HAZARDS[domainId] = [{ id, label, def, hazardFor:[entity label|action id], mayLeadTo?:[prohibited id],
                                characterizes:[threat id], mitigatedBy:[control id], requiresEvidence:[evidence id] }]
   Every L2 hazard carries all three principle-3 links. */
export const DOMAIN_HAZARDS = {
  finance: [
    { id:'haz-finance-unverified-instruction', label:'Payment From Unverified Instruction',
      def:'A payment instruction reaches release without independent proof of who sent it.',
      hazardFor:['act-finance-payment-release','Vendor Master Record'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['attack:T1078'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-finance-excessive-payment', label:'Payment Above Approved Ceiling',
      def:'A value transfer exceeds the amount the workflow is authorised to release automatically.',
      hazardFor:['act-finance-payment-release'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-value-ceiling'], requiresEvidence:['core-evidence-value-transfer-record'] },
    { id:'haz-finance-duplicate-invoice', label:'Duplicate Invoice Submission',
      def:'The same invoice is entered twice and paid as if it were two obligations.',
      hazardFor:['Invoice','act-finance-invoice-approve'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['atlas:AML.T0053'], mitigatedBy:['core-control-monitoring'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-finance-journal-adjust', label:'Journal Adjustment Without Second Review',
      def:'A journal entry is altered after approval so the books no longer match the event.',
      hazardFor:['Journal Entry','act-finance-journal-post'],
      characterizes:['attack:TA0005'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-configuration-change'] }
  ],
  support: [
    { id:'haz-support-refund-loop', label:'Repeated Refund After Partial Failure',
      def:'A partially failed refund is retried and the value leaves more than once.',
      hazardFor:['act-support-refund-issue','Refund'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-value-ceiling'], requiresEvidence:['core-evidence-value-transfer-record'] },
    { id:'haz-support-pii-misroute', label:'Customer Data Sent To Unverified Requester',
      def:'Customer data is returned to a requester whose identity was only asserted.',
      hazardFor:['act-support-pii-disclose','Customer'], mayLeadTo:['proh-support-pii-disclosure'],
      characterizes:['atlas:AML.T0057'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-identity-assertion'] },
    { id:'haz-support-account-takeover', label:'Account Recovery Without Verified Identity',
      def:'Account recovery proceeds on evidence weaker than the account it restores.',
      hazardFor:['act-support-intent-classify','Customer'], mayLeadTo:['proh-support-pii-disclosure'],
      characterizes:['attack:T1078'], mitigatedBy:['core-control-credential-binding'], requiresEvidence:['core-evidence-identity-assertion'] },
    { id:'haz-support-kb-poisoning', label:'Poisoned Knowledge Article Retrieved',
      def:'A knowledge article with tampered content is selected into the answer.',
      hazardFor:['Knowledge Article','act-support-knowledge-retrieve'],
      characterizes:['atlas:AML.T0070'], mitigatedBy:['core-control-monitoring'], requiresEvidence:['core-evidence-observation'] }
  ],
  'identity-it': [
    { id:'haz-it-standing-entitlement', label:'Entitlement Left Standing After Role Change',
      def:'Access that a former role justified remains granted after the role changes.',
      hazardFor:['Entitlement','act-it-offboard'], mayLeadTo:['proh-identity-standing-privilege'],
      characterizes:['attack:T1098'], mitigatedBy:['core-control-scope-limit'], requiresEvidence:['core-evidence-authorization-record'] },
    { id:'haz-it-credential-reuse', label:'Credential Reused Across Agents',
      def:'One credential is shared by several agents so its use cannot be attributed.',
      hazardFor:['Secret','act-it-issue-credential'],
      characterizes:['atlas:AML.T0055'], mitigatedBy:['core-control-credential-binding'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-it-orphan-account', label:'Orphaned Account After Offboarding',
      def:'An account survives the offboarding that should have removed it.',
      hazardFor:['User Account','act-it-offboard'], mayLeadTo:['proh-identity-standing-privilege'],
      characterizes:['attack:T1078'], mitigatedBy:['core-control-monitoring'], requiresEvidence:['core-evidence-identity-assertion'] },
    { id:'haz-it-unauthorized-grant', label:'Access Granted Without Matching Authority',
      def:'A role or entitlement is granted beyond the scope the approver held.',
      hazardFor:['Role','act-it-provision'], mayLeadTo:['proh-identity-standing-privilege'],
      characterizes:['attack:TA0004'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-authorization-record'] }
  ],
  hr: [
    { id:'haz-hr-pay-change', label:'Pay Change Without Approval',
      def:'A compensation adjustment is applied before an independent approver sees it.',
      hazardFor:['Compensation Record','act-hr-payroll-adjust'], mayLeadTo:['proh-hr-unauthorised-pay-change'],
      characterizes:['atlas:AML.T0053'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-hr-offer-altered', label:'Offer Terms Altered After Approval',
      def:'Offer terms are edited after sign-off so what was approved is not what is issued.',
      hazardFor:['Candidate','act-hr-offer'],
      characterizes:['attack:T1098'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-configuration-change'] },
    { id:'haz-hr-day1-excess', label:'Excessive Access Granted On Day One',
      def:'A new joiner receives more access than the role needs at the moment of onboarding.',
      hazardFor:['Employee','act-hr-day1-access'],
      characterizes:['attack:TA0004'], mitigatedBy:['core-control-scope-limit'], requiresEvidence:['core-evidence-authorization-record'] }
  ],
  procurement: [
    { id:'haz-proc-bank-detail-unverified', label:'Bank Detail Change From Unverified Instruction',
      def:'Supplier bank details are changed on the strength of an instruction nobody independently confirmed.',
      hazardFor:['Supplier','act-proc-vendor-bank-change'], mayLeadTo:['proh-proc-unverified-bank-change'],
      characterizes:['atlas:AML.T0052'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-proc-supplier-collusion', label:'Supplier Details Confirmed By Same Requester',
      def:'The person who requested the change is also the one who confirms it.',
      hazardFor:['Supplier','act-proc-supplier-onboard'], mayLeadTo:['proh-proc-unverified-bank-change'],
      characterizes:['atlas:AML.T0073'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-identity-assertion'] },
    { id:'haz-proc-order-splitting', label:'Purchase Order Split Below Approval Threshold',
      def:'One purchase is broken into several orders that each stay under the review threshold.',
      hazardFor:['Purchase Order','act-proc-po-create'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-value-ceiling'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-proc-match-bypass', label:'Three-way Match Bypassed',
      def:'A payment proceeds although goods receipt, order and invoice do not agree.',
      hazardFor:['Goods Receipt','act-proc-three-way-match'],
      characterizes:['atlas:AML.T0053'], mitigatedBy:['core-control-policy-gate'], requiresEvidence:['core-evidence-observation'] }
  ],
  crm: [
    { id:'haz-crm-lead-enrichment', label:'Lead Data Taken From An Unverified Source',
      def:'Contact enrichment pulls from a source the enterprise has not vetted.',
      hazardFor:['Lead','act-crm-lead-qualify'],
      characterizes:['atlas:AML.T0003'], mitigatedBy:['core-control-monitoring'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-crm-discount-beyond-authority', label:'Discount Approved Beyond Authority',
      def:'A quote discount is released above the level the approver may grant.',
      hazardFor:['Opportunity','act-crm-quote-price'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-value-ceiling'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-crm-contact-sharing', label:'Contact Data Shared Without Consent',
      def:'Contact details are reused for a purpose the subject did not consent to.',
      hazardFor:['Contact','act-crm-case-resolve'],
      characterizes:['atlas:AML.T0057'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-data-access-record'] }
  ],
  legal: [
    { id:'haz-legal-privilege-retrieval', label:'Privileged Material Retrieved Without Screening',
      def:'Content that should stay inside the matter is selected and surfaced.',
      hazardFor:['Matter','act-legal-clause-review'],
      characterizes:['atlas:AML.T0057'], mitigatedBy:['core-control-policy-gate'], requiresEvidence:['core-evidence-data-access-record'] },
    { id:'haz-legal-filing-unreviewed', label:'Filing Sent With Unreviewed Change',
      def:'A regulatory filing is submitted before the final change has been reviewed.',
      hazardFor:['Regulatory Filing','act-legal-file-regulator'],
      characterizes:['atlas:AML.T0077'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-legal-counsel-overreach', label:'Outside Counsel Receives Excess Material',
      def:'Material beyond the scope of the engagement is shared with outside counsel.',
      hazardFor:['Outside Counsel','act-legal-redline'],
      characterizes:['atlas:AML.T0057'], mitigatedBy:['core-control-scope-limit'], requiresEvidence:['core-evidence-observation'] }
  ]
};

/* L3 telemetry record schemas, under ag:trace: [{ id, label, def, records:[evidence id] }].
   Every evidence id referenced by a hazard appears in some records list. */
export const RECORD_SCHEMAS = [
  { id:'rec-approval-evidence', label:'Approval Evidence Record',
    def:'Captures approvals and authorizations with the approver, the request and the scope they covered.',
    records:['core-evidence-approval-record','core-evidence-authorization-record'] },
  { id:'rec-value-transfer', label:'Value Transfer Ledger Record',
    def:'Captures each value movement with amount, parties and time so a transfer can be reconciled.',
    records:['core-evidence-value-transfer-record'] },
  { id:'rec-runtime-observation', label:'Runtime Observation Record',
    def:'Captures observed agent steps and tool calls before any judgement is applied to them.',
    records:['core-evidence-observation'] },
  { id:'rec-configuration-change', label:'Configuration Change Record',
    def:'Captures settings and permission changes with the actor who made them.',
    records:['core-evidence-configuration-change'] },
  { id:'rec-identity-assertion', label:'Identity Assertion Record',
    def:'Captures the identity claim and the proof presented for a request.',
    records:['core-evidence-identity-assertion'] },
  { id:'rec-data-access', label:'Data Access Record',
    def:'Captures which subject read which data and under what purpose.',
    records:['core-evidence-data-access-record'] },
  { id:'rec-attestation', label:'Attestation Record',
    def:'Captures a signed statement from a party that a condition holds.',
    records:['core-evidence-attestation'] }
];

/* L3 threat → countermeasure: [{ threat, control, note }].
   All 25 OWASP risks, plus the ATLAS techniques that can be justified honestly. */
export const COUNTER_MAP = [
  { threat:'owasp:LLM01', control:'core-control-policy-gate', note:'A rule gate inspects untrusted input before it can steer the planner.' },
  { threat:'owasp:LLM02', control:'core-control-scope-limit', note:'Limiting what the agent may read reduces what can be disclosed.' },
  { threat:'owasp:LLM03', control:'core-control-monitoring', note:'Continuous review of models and dependencies tracks supply-chain change.' },
  { threat:'owasp:LLM04', control:'core-control-monitoring', note:'Monitoring training and memory sources flags poisoning before it is trusted.' },
  { threat:'owasp:LLM05', control:'core-control-policy-gate', note:'Output is validated against policy before it is acted on or rendered.' },
  { threat:'owasp:LLM06', control:'core-control-scope-limit', note:'Authority and target scope are bounded so the agent cannot overreach.' },
  { threat:'owasp:LLM07', control:'core-control-scope-limit', note:'System instructions are kept out of any content the agent can emit.' },
  { threat:'owasp:LLM08', control:'core-control-monitoring', note:'Index integrity is watched because embedding stores can be altered.' },
  { threat:'owasp:LLM09', control:'human-approval', note:'A person confirms material claims before they are relied on.' },
  { threat:'owasp:LLM10', control:'core-control-value-ceiling', note:'A hard resource or value ceiling bounds consumption.' },
  { threat:'owaspa:T1', control:'core-control-monitoring', note:'Memory writes are observed so poisoning is visible.' },
  { threat:'owaspa:T2', control:'core-control-scope-limit', note:'Tools are callable only within the scope declared for the run.' },
  { threat:'owaspa:T3', control:'core-control-credential-binding', note:'Credentials are bound to one identity and use.' },
  { threat:'owaspa:T4', control:'core-control-value-ceiling', note:'Resource use is capped so overload cannot compound.' },
  { threat:'owaspa:T5', control:'human-approval', note:'A person breaks the chain when generated content starts to compound.' },
  { threat:'owaspa:T6', control:'core-control-policy-gate', note:'Each proposed step is checked against the stated purpose.' },
  { threat:'owaspa:T7', control:'core-control-monitoring', note:'Behaviour that departs from the intended trajectory raises a signal.' },
  { threat:'owaspa:T8', control:'core-control-monitoring', note:'Tamper-evident telemetry keeps actions attributable.' },
  { threat:'owaspa:T9', control:'core-control-credential-binding', note:'An identity cannot be replayed under another actor context.' },
  { threat:'owaspa:T10', control:'core-control-value-ceiling', note:'Thresholds keep the review queue from being flooded by small items.' },
  { threat:'owaspa:T11', control:'d3f:d3f:SystemCallFiltering', note:'A D3FEND technique blocks the system calls an unexpected code path needs.' },
  { threat:'owaspa:T12', control:'core-control-monitoring', note:'Inter-agent messages are observed for injected content.' },
  { threat:'owaspa:T13', control:'core-control-scope-limit', note:'Each agent is confined to its own authority so a rogue one cannot spread it.' },
  { threat:'owaspa:T14', control:'human-approval', note:'Human demands on the system are reviewed before they change behaviour.' },
  { threat:'owaspa:T15', control:'human-approval', note:'A person validates high-impact decisions a manipulator is pushing.' },
  { threat:'atlas:AML.T0051', control:'core-control-policy-gate', note:'Prompt content is screened where it enters the context.' },
  { threat:'atlas:AML.T0054', control:'core-control-policy-gate', note:'Jailbreak style instructions are blocked by policy, not by model goodwill.' },
  { threat:'atlas:AML.T0056', control:'core-control-scope-limit', note:'System prompt text is excluded from anything the agent may reveal.' },
  { threat:'atlas:AML.T0057', control:'core-control-scope-limit', note:'Data access is bounded to what the task needs.' },
  { threat:'atlas:AML.T0070', control:'core-control-monitoring', note:'Retrieval indexes are watched for entries that were not authored.' },
  { threat:'atlas:AML.T0071', control:'core-control-monitoring', note:'Unexpected index entries are surfaced for review.' },
  { threat:'atlas:AML.T0080', control:'core-control-monitoring', note:'Context writes across steps are observed for tampering.' },
  { threat:'atlas:AML.T0081', control:'core-control-policy-gate', note:'Agent configuration changes go through the same policy gate as actions.' },
  { threat:'atlas:AML.T0083', control:'core-control-credential-binding', note:'Credentials stored in agent configuration are bound and rotated.' },
  { threat:'atlas:AML.T0086', control:'core-control-scope-limit', note:'Tool invocation is confined to the declared capability set.' },
  { threat:'atlas:AML.T0010', control:'d3f:d3f:AssetInventory', note:'A D3FEND technique keeps a verifiable inventory of model and dependency assets.' },
  { threat:'atlas:AML.T0020', control:'core-control-monitoring', note:'Training data provenance is watched for unexplained change.' },
  { threat:'atlas:AML.T0018', control:'d3f:d3f:FileIntegrityMonitoring', note:'A D3FEND technique detects unauthorised changes to model files.' },
  { threat:'atlas:AML.T0076', control:'d3f:d3f:FileIntegrityMonitoring', note:'File integrity monitoring catches corruption of stored models.' },
  { threat:'atlas:AML.T0053', control:'core-control-scope-limit', note:'Agent tool invocation is limited to scopes the run was granted.' },
  { threat:'atlas:AML.T0082', control:'core-control-credential-binding', note:'Credentials reachable through retrieval are bound and not reusable.' },
  { threat:'atlas:AML.T0043', control:'core-control-monitoring', note:'Adversarial inputs are watched for rather than assumed absent.' },
  { threat:'atlas:AML.T0034', control:'core-control-value-ceiling', note:'Cost is capped so harvesting cannot run unbounded.' },
  { threat:'atlas:AML.T0029', control:'core-control-value-ceiling', note:'A capacity ceiling keeps a denial attempt from consuming the service.' },
  { threat:'atlas:AML.T0040', control:'core-control-credential-binding', note:'Inference access requires a bound, attributable credential.' }
];

/* L4 incident → L2 hazard (illustrative): [{ incident, hazard }] */
export const INCIDENT_HAZARDS = [
  { incident:'rt-inc-0987', hazard:'haz-proc-bank-detail-unverified' },
  { incident:'rt-inc-1042', hazard:'haz-support-refund-loop' }
];

/* Candidate domain packs (ontology only, no coverage figures):
   { id, name, code, pack, owner, entities, capabilities:[{id,name,workflows:[{id,name}]}] } */
export const CANDIDATE_DOMAINS = [
  { id:'crm', name:'Customer Relationship Management', code:'CR',
    pack:'CRM Pack v0.8 (candidate)', owner:'CRO · Revenue Operations',
    entities:['Lead','Opportunity','Account','Contact','Campaign','Case'],
    capabilities:[
      { id:'crm-lead', name:'Lead Management', workflows:[{ id:'WF-071', name:'Lead Qualification' }] },
      { id:'crm-opp',  name:'Opportunity Management', workflows:[{ id:'WF-072', name:'Quote to Opportunity' }] },
      { id:'crm-case', name:'Customer Case Handling', workflows:[{ id:'WF-073', name:'Case Resolution' }] } ] },
  { id:'legal', name:'Legal & Compliance', code:'LG',
    pack:'Legal Pack v0.9 (candidate)', owner:'GC · Legal Operations',
    entities:['Contract','Clause Library','Matter','Outside Counsel','Regulatory Filing','Legal Hold'],
    capabilities:[
      { id:'lg-ctr', name:'Contract Lifecycle', workflows:[{ id:'WF-081', name:'Clause Review' }] },
      { id:'lg-reg', name:'Regulatory Response', workflows:[{ id:'WF-082', name:'Filing Preparation' }] } ] }
];
