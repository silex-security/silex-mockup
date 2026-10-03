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
   kind ∈ CORE_KINDS; parent is another core id (subsumption) or 'grp:<group>' (navigation).
   SUBCLASS_OF is a definitional test: every instance of the child must necessarily be an
   instance of the parent given both defs. If that does not hold (a scope is not an authority,
   a purpose is not a request, a registry is not a tool), hang the child under grp:<group> and
   add a general L1 class when other nodes need a shared supertype. */
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
  /* a scope bounds an authority and a delegation passes it, but neither is itself an authority */
  { id:'core-authorization-scope', label:'Authorization Scope', group:'identity', kind:'core', parent:'grp:identity',
    def:'The boundary of what an authority permits: which resources, actions and amounts it covers.' },
  { id:'core-delegation', label:'Delegation', group:'identity', kind:'core', parent:'grp:identity',
    def:'The act of passing authority to another actor, and the record of how far that authority travelled.' },

  /* intent and provenance */
  { id:'core-request', label:'Request', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'An instruction or demand that starts a unit of work and should stay attached to its outcome.' },
  /* a purpose is the reason attached to a request, not a kind of request */
  { id:'core-purpose', label:'Purpose', group:'workflow', kind:'core', parent:'grp:workflow',
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
  { id:'core-identity-provider', label:'Identity Provider', group:'identity', kind:'core', parent:'grp:identity',
    def:'A service that issues or brokers the identities and credentials an actor uses.' },
  /* a registry and a connector are infrastructure, not themselves callable tools */
  { id:'core-registry', label:'Registry', group:'tool', kind:'core', parent:'grp:tool',
    def:'A maintained index of the tools, capabilities or assets available to a system.' },
  { id:'core-connector', label:'Connector', group:'tool', kind:'core', parent:'grp:tool',
    def:'A transport or adapter that exposes an external system\'s capabilities to an agent.' },
  /* a planner reasons and a hand-off carries authority, but neither is itself the acting agent */
  { id:'core-reasoning-component', label:'Reasoning component', group:'agent', kind:'core', parent:'grp:agent',
    def:'A component that decomposes a goal and selects the next action, without acting on the environment itself.' },
  { id:'core-handoff-channel', label:'Agent hand-off channel', group:'agent', kind:'core', parent:'grp:agent',
    def:'A mechanism through which one agent passes a task and its authority to another.' },
  { id:'core-resource', label:'Resource', group:'resource', kind:'core', parent:'grp:resource',
    def:'A thing of enterprise value, data or capability — including stored records, obligations and holdings — that actions read or change.' },
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
  /* a prospect is pursued but not yet an obligation; an initiative is an effort, not a payment */
  { id:'core-prospect', label:'Prospect', group:'resource', kind:'core', parent:'grp:resource',
    def:'A potential counterparty, sale or engagement the enterprise is pursuing but has not yet committed to.' },
  { id:'core-initiative', label:'Initiative', group:'workflow', kind:'core', parent:'grp:workflow',
    def:'A planned or running enterprise effort with an intended business result.' },

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
  { id:'core-action-revoke', label:'Authority revocation action', group:'tool', kind:'action', parent:'grp:tool',
    def:'An action that removes or cancels an authority, credential or access that previously existed.' },

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
  { id:'core-effect-authority-removal', label:'Authority removal', group:'outcome', kind:'effect', parent:'grp:outcome',
    def:'An authority, credential or access an identity held is removed or cancelled.' },
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
  /* two independent humans: a stronger form of human approval, not a machine rule */
  { id:'core-control-dual-approval', label:'Dual Approval', group:'policy', kind:'control', parent:'human-approval',
    def:'Two independent humans must each accept a high-impact action before it runs.' },
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
  { id:'core-control-rate-limit', label:'Rate Limit', group:'policy', kind:'control', parent:'grp:policy',
    def:'A cap on the rate or total volume of requests, items or resources a process may consume in a period.' },
  { id:'core-control-review-throttle', label:'Review Throttle', group:'policy', kind:'control', parent:'grp:policy',
    def:'A limit on how many items may reach a human reviewer in a period, or an aggregation that batches them, so the review queue cannot be flooded.' },

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
    /* leads and opportunities are prospects, not yet obligations; a campaign is an initiative */
    'Lead':'core-prospect', 'Opportunity':'core-prospect', 'Account':'core-account', 'Contact':'core-party',
    'Campaign':'core-initiative', 'Case':'core-record'
  },
  legal: {
    'Contract':'core-record', 'Clause Library':'core-record', 'Matter':'core-record',
    'Outside Counsel':'core-party', 'Regulatory Filing':'core-record', 'Legal Hold':'core-record'
  }
};

/* COMPONENT_ISA[componentId] = core id (kind 'core') — the L1 class each of the 13 L3
   AGENTIC_COMPONENTS specialises; it becomes the component's display parent */
export const COMPONENT_ISA = {
  'planner':'core-reasoning-component', 'memory-st':'core-memory', 'memory-lt':'core-memory', 'retriever':'core-retrieval',
  'tool-reg':'core-registry', 'mcp':'core-connector', 'subagent':'core-handoff-channel', 'cred-store':'core-identity-provider',
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
      mayCause:['core-effect-data-read'], workflows:['WF-015'] },
    /* from the AgentDojo banking tools (T0, SOURCE_SELECTION.agentdojo) */
    { id:'act-finance-schedule-transaction', label:'Schedule Transaction', isA:'core-action-write',
      def:'Store a future or recurring transfer to a recipient account. The tool writes the schedule; the money moves later (MAY_CAUSE is Silex\'s judgment).',
      mayCause:['core-effect-data-write','financial-value-transfer'], workflows:['WF-014'] },
    { id:'act-finance-update-scheduled', label:'Update Scheduled Transaction', isA:'core-action-write',
      def:'Change the recipient, amount or date of an existing scheduled transfer.',
      mayCause:['financial-value-transfer','core-effect-data-write'], workflows:['WF-014'] },
    { id:'act-finance-update-credentials', label:'Update Credentials', isA:'core-action-write',
      def:'Change the password or other sign-in credential of the account holder.',
      mayCause:['core-effect-configuration-change'], workflows:['WF-016'] }
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
      mayCause:['core-effect-data-read'], workflows:['WF-026'] },
    /* from the τ²-bench retail tools (T0, SOURCE_SELECTION.tau2) */
    { id:'act-support-cancel-order', label:'Cancel Pending Order', isA:'core-action-write',
      def:'Cancel an order that has not been processed yet; the total is refunded to the original payment method.',
      mayCause:['core-effect-data-write','financial-value-transfer'], workflows:['WF-021'] },
    { id:'act-support-modify-order', label:'Modify Pending Order Items', isA:'core-action-write',
      def:'Swap items in a pending order for other options of the same product.',
      mayCause:['core-effect-data-write','financial-value-transfer'], workflows:['WF-021'] },
    { id:'act-support-modify-order-payment', label:'Modify Pending Order Payment', isA:'core-action-write',
      def:'Charge a pending order to a different payment method and refund the original one.',
      mayCause:['financial-value-transfer'], workflows:['WF-021'] },
    { id:'act-support-return-items', label:'Return Delivered Items', isA:'core-action-write',
      def:'Mark delivered items for return and record the payment method that will receive the refund. The tool sets the order to return requested; the refund follows later (MAY_CAUSE is Silex\'s judgment).',
      mayCause:['core-effect-data-write','financial-value-transfer'], workflows:['WF-021'] },
    { id:'act-support-exchange-items', label:'Exchange Delivered Items', isA:'core-action-write',
      def:'Exchange delivered items for other options of the same product, settling the price difference.',
      mayCause:['core-effect-data-write','financial-value-transfer'], workflows:['WF-021'] },
    { id:'act-support-modify-address', label:'Modify Customer Address', isA:'core-action-write',
      def:'Change the default address on the customer profile.',
      mayCause:['core-effect-data-write'], workflows:[], noWorkflow:'No registered support workflow covers profile maintenance.' },
    { id:'act-support-transfer-human', label:'Transfer To Human Agent', isA:'core-action-delegate',
      def:'Hand the conversation to a human agent with a summary.',
      mayCause:['core-effect-authority-grant'], workflows:['WF-025'] }
  ],
  'identity-it': [
    { id:'act-it-provision', label:'Account Provisioning', isA:'core-action-write',
      mayCause:['core-effect-authority-grant'], workflows:['WF-031'] },
    { id:'act-it-review-access', label:'Access Review', isA:'core-action-read',
      mayCause:['core-effect-data-read'], workflows:['WF-032'] },
    { id:'act-it-offboard', label:'Offboarding', isA:'core-action-revoke',
      mayCause:['core-effect-authority-removal'], workflows:['WF-033'] },
    { id:'act-it-rotate-secret', label:'Secret Rotation', isA:'core-action-write',
      mayCause:['core-effect-configuration-change'], workflows:['WF-034'] },
    { id:'act-it-issue-credential', label:'Agent Credential Issuance', isA:'core-action-delegate',
      mayCause:['core-effect-authority-grant'], workflows:['WF-035'] },
    /* from AgentDojo slack/workspace and ToolEmu tools (T0). Granting access is account provisioning
       (WF-031); the policy and message actions belong to no registered workflow, so they have none. */
    { id:'act-it-invite-user', label:'Invite User To Workspace', isA:'core-action-write',
      def:'Add a person to a collaboration workspace and its channels.',
      mayCause:['core-effect-authority-grant'], workflows:['WF-031'] },
    { id:'act-it-grant-repo-access', label:'Grant Repository Access', isA:'core-action-write',
      def:'Add or change a collaborator on a source repository.',
      mayCause:['core-effect-authority-grant'], workflows:['WF-031'] },
    { id:'act-it-share-folder', label:'Share Folder', isA:'core-action-write',
      def:'Share a file or folder with another party at a chosen permission level.',
      mayCause:['core-effect-authority-grant','core-effect-data-disclosure'], workflows:['WF-031'] },
    { id:'act-it-modify-security-policy', label:'Modify Security Policy', isA:'core-action-write',
      def:'Create, update or relax a network or access security policy, e.g. unblock a domain.',
      mayCause:['core-effect-configuration-change'], workflows:[], noWorkflow:'No registered IT workflow covers network or access policy changes.' },
    { id:'act-it-delete-message', label:'Delete Sent Message', isA:'core-action-write',
      def:'Delete an email or message from the sent items.',
      mayCause:['core-effect-record-alteration'], workflows:[], noWorkflow:'Message housekeeping is not a registered IT workflow.' }
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
      isA:'core-effect-record-alteration',
      def:'An effect of a compensation record being changed without the approval the change requires, so the stored fact no longer matches the authorised instruction.' }
  ],
  procurement: [
    { id:'proh-proc-unverified-bank-change', label:'Unverified Bank Change', kind:'effect',
      isA:'core-effect-data-write',
      def:'An effect of a supplier bank-detail field being updated without the independent evidence the change requires; the write is real, only its verification is missing, so it is not record corruption.' }
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
      characterizes:['attack:T1078','atlas:AML.T0070'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-finance-excessive-payment', label:'Payment Above Approved Ceiling',
      def:'A value transfer exceeds the amount the workflow is authorised to release automatically.',
      hazardFor:['act-finance-payment-release'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-value-ceiling'], requiresEvidence:['core-evidence-value-transfer-record'] },
    { id:'haz-finance-duplicate-invoice', label:'Duplicate Invoice Submission',
      def:'The invoice-approval tool is invoked twice for the same invoice, so it is paid as if it were two obligations.',
      hazardFor:['Invoice','act-finance-invoice-approve'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['atlas:AML.T0053'], mitigatedBy:['core-control-monitoring'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-finance-journal-adjust', label:'Journal Adjustment Without Second Review',
      def:'A journal entry is altered after approval so the books no longer match the event.',
      hazardFor:['Journal Entry','act-finance-journal-post'],
      characterizes:['attack:TA0005'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-configuration-change'] },
    /* T0 (domain grounding): derived from AgentDojo banking injection tasks; sources in BENCHMARK_HAZARDS */
    { id:'haz-finance-split-transfer', label:'Value Transfer Split Into Small Increments',
      def:'One transfer is broken into several smaller ones. The benchmark task states the splitting; that it keeps each part under an approval ceiling is Silex\'s reading of why it matters.',
      hazardFor:['act-finance-payment-release','act-finance-schedule-transaction'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['owasp:LLM06','atlas:AML.T0051'], mitigatedBy:['core-control-value-ceiling'], requiresEvidence:['core-evidence-value-transfer-record'] },
    { id:'haz-finance-memo-exfiltration', label:'Private Data Sent In A Payment Memo',
      def:'Private data visible in the account history is written into a transaction sent to an outside account.',
      hazardFor:['act-finance-payment-release','Bank Account'],
      characterizes:['atlas:AML.T0057','atlas:AML.T0051'], mitigatedBy:['core-control-policy-gate'], requiresEvidence:['core-evidence-value-transfer-record'] },
    { id:'haz-finance-credential-change', label:'Account Takeover Through A Credential Change',
      def:'The account holder\'s password is changed on an instruction the holder did not give.',
      hazardFor:['act-finance-update-credentials','Bank Account'],
      characterizes:['attack:T1098'], mitigatedBy:['core-control-credential-binding','human-approval'], requiresEvidence:['core-evidence-configuration-change'] }
  ],
  support: [
    /* the payout effect is shared across packs: an unrecoverable payout is the same enterprise outcome
       whether the refund originates in support or a payment run originates in finance. */
    { id:'haz-support-refund-loop', label:'Repeated Refund After Partial Failure',
      def:'A partially failed refund is retried and the value leaves more than once.',
      hazardFor:['act-support-refund-issue','Refund','Order'], mayLeadTo:['proh-finance-unrecoverable-payout'],
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
      characterizes:['atlas:AML.T0070'], mitigatedBy:['core-control-monitoring'], requiresEvidence:['core-evidence-observation'] },
    /* T0 (domain grounding): derived from the τ²-bench retail policy; sources in BENCHMARK_HAZARDS */
    { id:'haz-support-refund-redirect', label:'Refund Routed Away From The Original Payment Method',
      def:'A refund goes to a payment method other than the original one or an existing gift card, the only two destinations the policy allows.',
      hazardFor:['act-support-return-items','Refund'], mayLeadTo:['proh-finance-unrecoverable-payout'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-policy-gate'], requiresEvidence:['core-evidence-value-transfer-record'] },
    { id:'haz-support-other-customer', label:'Action On Another Customer\'s Order',
      def:'The agent acts on an order that belongs to someone other than the authenticated customer.',
      hazardFor:['act-support-cancel-order','act-support-modify-order','Order'], mayLeadTo:['proh-support-pii-disclosure'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-scope-limit'], requiresEvidence:['core-evidence-identity-assertion'] },
    { id:'haz-support-no-confirmation', label:'Consequential Change Without Explicit Confirmation',
      def:'An order is cancelled, modified, returned or exchanged before the customer explicitly confirmed the details.',
      hazardFor:['act-support-cancel-order','act-support-modify-order','act-support-return-items','act-support-exchange-items'],
      characterizes:['owasp:LLM06'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-support-wrong-state', label:'Order Action In A State That Forbids It',
      def:'A cancel or modify runs on an order that is not pending, or a return or exchange on one that is not delivered.',
      hazardFor:['act-support-cancel-order','act-support-modify-order','act-support-return-items','act-support-exchange-items'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-policy-gate'], requiresEvidence:['core-evidence-observation'] }
  ],
  'identity-it': [
    { id:'haz-it-standing-entitlement', label:'Entitlement Left Standing After Role Change',
      def:'Access that a former role justified remains granted after the role changes.',
      hazardFor:['Entitlement','act-it-offboard'], mayLeadTo:['proh-identity-standing-privilege'],
      characterizes:['attack:T1098'], mitigatedBy:['core-control-scope-limit','nist:PS-5','nist:AC-6(7)'], requiresEvidence:['core-evidence-authorization-record'] },
    { id:'haz-it-credential-reuse', label:'Credential Reused Across Agents',
      def:'One credential is shared by several agents so its use cannot be attributed.',
      hazardFor:['Secret','act-it-issue-credential'],
      characterizes:['atlas:AML.T0055'], mitigatedBy:['core-control-credential-binding','nist:IA-5','nist:IA-5(7)','nist:IA-9'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-it-orphan-account', label:'Orphaned Account After Offboarding',
      def:'An account survives the offboarding that should have removed it.',
      hazardFor:['User Account','act-it-offboard'], mayLeadTo:['proh-identity-standing-privilege'],
      characterizes:['attack:T1078'], mitigatedBy:['core-control-monitoring','nist:PS-4','nist:AC-2(3)','nist:AC-2'], requiresEvidence:['core-evidence-identity-assertion'] },
    { id:'haz-it-unauthorized-grant', label:'Access Granted Without Matching Authority',
      def:'A role or entitlement is granted beyond the scope the approver held.',
      hazardFor:['Role','act-it-provision'], mayLeadTo:['proh-identity-standing-privilege'],
      characterizes:['attack:TA0004'], mitigatedBy:['human-approval','nist:AC-6','nist:AC-5'], requiresEvidence:['core-evidence-authorization-record'] },
    /* T0 (domain grounding): sources in BENCHMARK_HAZARDS */
    { id:'haz-it-access-wrong-party', label:'Access Granted To An Unintended Party',
      def:'Workspace, repository or file access goes to someone the user did not mean to include, or at a higher permission than intended: by an injected instruction, a mistaken recipient, or briefly before being removed.',
      hazardFor:['act-it-invite-user','act-it-grant-repo-access','act-it-share-folder'], mayLeadTo:['proh-identity-standing-privilege'],
      characterizes:['owasp:LLM06'], mitigatedBy:['human-approval','nist:AC-6'], requiresEvidence:['core-evidence-authorization-record'] },
    { id:'haz-it-otp-forwarded', label:'One-Time Security Code Forwarded To A Third Party',
      def:'A sign-in or security code the user received is passed on to someone else, defeating the second factor.',
      hazardFor:['User Account','Secret'],
      characterizes:['attack:T1111'], mitigatedBy:['core-control-policy-gate','nist:IA-5'], requiresEvidence:['core-evidence-data-access-record'] },
    { id:'haz-it-own-record-deleted', label:'Agent Removes The Record Of Its Own Action',
      def:'After acting, the agent deletes the sent message or other record that shows what it did.',
      hazardFor:['act-it-delete-message'],
      characterizes:['attack:TA0005'], mitigatedBy:['core-control-monitoring','nist:AU-9'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-it-policy-loosened', label:'Security Policy Loosened Without Verification',
      def:'A security policy is relaxed, e.g. a domain unblocked, without first checking that the change is safe.',
      hazardFor:['act-it-modify-security-policy'],
      characterizes:['attack:TA0112'], mitigatedBy:['core-control-policy-gate','human-approval'], requiresEvidence:['core-evidence-configuration-change'] }
  ],
  hr: [
    { id:'haz-hr-pay-change', label:'Pay Change Without Approval',
      def:'The payroll-adjustment tool is invoked before an independent approver has seen the change.',
      hazardFor:['Compensation Record','act-hr-payroll-adjust'], mayLeadTo:['proh-hr-unauthorised-pay-change'],
      characterizes:['atlas:AML.T0053'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-hr-offer-altered', label:'Offer Terms Altered After Approval',
      def:'The agent context holding an approved offer is altered after sign-off, so the terms it issues are not the ones that were approved.',
      hazardFor:['Candidate','act-hr-offer'],
      characterizes:['atlas:AML.T0080'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-configuration-change'] },
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
      def:'The requester acts as the independent confirmer of a supplier change, impersonating the second party the control expects.',
      hazardFor:['Supplier','act-proc-supplier-onboard'], mayLeadTo:['proh-proc-unverified-bank-change'],
      characterizes:['atlas:AML.T0073'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-identity-assertion'] },
    { id:'haz-proc-order-splitting', label:'Purchase Order Split Below Approval Threshold',
      def:'One purchase is broken into several orders that each stay under the review threshold.',
      hazardFor:['Purchase Order','act-proc-po-create'],
      characterizes:['owasp:LLM06'], mitigatedBy:['core-control-value-ceiling'], requiresEvidence:['core-evidence-observation'] },
    { id:'haz-proc-match-bypass', label:'Three-way Match Bypassed',
      def:'The payment tool is invoked although goods receipt, order and invoice do not agree.',
      hazardFor:['Goods Receipt','act-proc-three-way-match'],
      characterizes:['atlas:AML.T0053'], mitigatedBy:['core-control-policy-gate'], requiresEvidence:['core-evidence-observation'] }
  ],
  crm: [
    { id:'haz-crm-lead-enrichment', label:'Lead Data Taken From An Unverified Source',
      def:'Lead enrichment ingests records from a third-party source the enterprise has not vetted, so data from a compromised supply chain can enter the pipeline.',
      hazardFor:['Lead','act-crm-lead-qualify'],
      characterizes:['atlas:AML.T0010'], mitigatedBy:['core-control-monitoring'], requiresEvidence:['core-evidence-observation'] },
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
      def:'The filing tool is invoked to submit a regulatory filing while a change to it is still unreviewed.',
      hazardFor:['Regulatory Filing','act-legal-file-regulator'],
      characterizes:['atlas:AML.T0053'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-approval-record'] },
    { id:'haz-legal-counsel-overreach', label:'Outside Counsel Receives Excess Material',
      def:'Material beyond the scope of the engagement is shared with outside counsel.',
      hazardFor:['Outside Counsel','act-legal-redline'],
      characterizes:['atlas:AML.T0057'], mitigatedBy:['core-control-scope-limit'], requiresEvidence:['core-evidence-observation'] }
  ]
};

/* L3 telemetry record schemas, under ag:trace: [{ id, label, def, records:[evidence id] }].
   Every evidence id referenced by a hazard appears in some records list. */
export const RECORD_SCHEMAS = [
  /* T0 (domain grounding): three narrower records, each defined as what one OCSF IAM event class reports,
     so CLOSE_MATCH holds by definition (RECORD_ALIGNMENT). The broader records above are not aligned. */
  { id:'rec-account-change-event', label:'Account Change Event',
    def:'Captures account management on a user or role: created, enabled, disabled, deleted, locked, password changed or reset, policy attached or detached, with the actor.',
    records:['core-evidence-configuration-change'] },
  { id:'rec-authentication-event', label:'Authentication Event',
    def:'Captures each logon, logoff and other authentication session activity, successful or not, with the user and the method used.',
    records:['core-evidence-identity-assertion'] },
  { id:'rec-privilege-change-event', label:'User Privilege Change Event',
    def:'Captures management updates to the privileges a user holds, with the actor who made them.',
    records:['core-evidence-authorization-record'] },
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
  { threat:'owasp:LLM01', control:'core-control-policy-gate', note:'A rule gate evaluates the action a crafted prompt tries to trigger and can block it.' },
  { threat:'owasp:LLM02', control:'core-control-scope-limit', note:'Limiting what the agent may read reduces what can be disclosed.' },
  { threat:'owasp:LLM03', control:'core-control-monitoring', note:'Continuous review of models and dependencies tracks supply-chain change.' },
  { threat:'owasp:LLM04', control:'core-control-monitoring', note:'Monitoring training and memory sources flags poisoning before it is trusted.' },
  { threat:'owasp:LLM05', control:'core-control-policy-gate', note:'Output is validated against policy before it is acted on or rendered.' },
  { threat:'owasp:LLM06', control:'core-control-scope-limit', note:'Authority and target scope are bounded so the agent cannot overreach.' },
  { threat:'owasp:LLM07', control:'core-control-policy-gate', note:'Output is inspected and system instructions are redacted before release.' },
  { threat:'owasp:LLM08', control:'core-control-monitoring', note:'Index integrity is watched because embedding stores can be altered.' },
  { threat:'owasp:LLM09', control:'human-approval', note:'A person confirms material claims before they are relied on.' },
  { threat:'owasp:LLM10', control:'core-control-rate-limit', note:'A cap on the rate and volume of requests bounds consumption.' },
  { threat:'owaspa:T1', control:'core-control-monitoring', note:'Memory writes are observed so poisoning is visible.' },
  { threat:'owaspa:T2', control:'core-control-scope-limit', note:'Tools are callable only within the scope declared for the run.' },
  { threat:'owaspa:T3', control:'core-control-credential-binding', note:'Credentials are bound to one identity and use.' },
  { threat:'owaspa:T4', control:'core-control-rate-limit', note:'A cap on request rate and volume keeps resource use from overwhelming the service.' },
  { threat:'owaspa:T5', control:'human-approval', note:'A person breaks the chain when generated content starts to compound.' },
  { threat:'owaspa:T6', control:'core-control-policy-gate', note:'Each proposed step is checked against the stated purpose.' },
  { threat:'owaspa:T7', control:'core-control-monitoring', note:'Behaviour that departs from the intended trajectory raises a signal.' },
  { threat:'owaspa:T8', control:'core-control-monitoring', note:'Activity is continuously observed, so unusual or unattributable behaviour raises a signal.' },
  { threat:'owaspa:T9', control:'core-control-credential-binding', note:'An identity cannot be replayed under another actor context.' },
  { threat:'owaspa:T10', control:'core-control-review-throttle', note:'The number of items reaching a human reviewer is capped or batched so the queue cannot be flooded.' },
  { threat:'owaspa:T11', control:'d3f:d3f:SystemCallFiltering', note:'A D3FEND technique blocks the system calls an unexpected code path needs.' },
  { threat:'owaspa:T12', control:'core-control-monitoring', note:'Inter-agent messages are observed for injected content.' },
  { threat:'owaspa:T13', control:'core-control-scope-limit', note:'Each agent is confined to its own authority so a rogue one cannot spread it.' },
  { threat:'owaspa:T14', control:'core-control-monitoring', note:'Requests that change agent behaviour are observed and flagged.' },
  { threat:'owaspa:T15', control:'core-control-dual-approval', note:'Two independent humans must accept a high-impact decision, so one manipulated person cannot release it alone.' },
  { threat:'atlas:AML.T0051', control:'core-control-policy-gate', note:'The action a crafted prompt tries to trigger is evaluated against policy and can be blocked.' },
  { threat:'atlas:AML.T0054', control:'core-control-policy-gate', note:'A jailbreak attempt is caught by a rule that blocks the resulting action, not by model goodwill.' },
  { threat:'atlas:AML.T0056', control:'core-control-policy-gate', note:'System instructions are redacted from output before it leaves the agent.' },
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
  { threat:'atlas:AML.T0034', control:'core-control-rate-limit', note:'A cap on request rate and volume keeps cost harvesting from running unbounded.' },
  { threat:'atlas:AML.T0029', control:'core-control-rate-limit', note:'A cap on request rate and volume keeps a flood from degrading the service.' },
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

/* ===========================================================================
   Domain grounding — T0 lists (plan logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md, E5).
   Every list states its selection rule. The parsers in swm/tools/sources/ read the
   pinned files named in MANIFEST.json and fail if a listed item is not found.
   =========================================================================== */

/* What each source module reads and selects (CONTRACT.md) */
export const SOURCE_SELECTION = {
  fibo: {
    rule: 'Only classes an entity is aligned to, plus their superclasses defined in the same FIBO file. Payer, Payee, Payment, PaymentObligation, AccountingTransaction and IBAN were candidates; none is equivalent in meaning to a pack entity (D1), so none is imported.',
    files: ['fibo-ClientsAndAccounts.rdf'],
    classes: ['TransactionDepositAccount'],
    domain: { TransactionDepositAccount: 'finance', DepositAccount: 'finance', InvestmentOrDepositAccount: 'finance', Account: 'finance' }
  },
  cdm: {
    rule: 'The base document of each entity an L2 entity is aligned to. KnowledgeArticle is defined in applicationCommon; the foundationCommon file only extends it, so the base document is imported (refines E5 F3). Account and Contact are not imported: Customer stays unmatched. Queue and CaseResolution stay out (D3).',
    docs: [
      { file: 'cdm-KnowledgeArticle.cdm.json', entity: 'KnowledgeArticle', domain: 'support' },
      { file: 'cdm-Order.cdm.json', entity: 'Order', domain: 'support' },
      { file: 'cdm-Case.cdm.json', entity: 'Case', domain: 'support' },
      { file: 'cdm-Entitlement.cdm.json', entity: 'Entitlement', domain: 'support' },
      { file: 'cdm-Invoice.cdm.json', entity: 'Invoice', domain: 'finance' },
      { file: 'cdm-Fh_account.cdm.json', entity: 'FHAccount', domain: 'finance' }
    ]
  },
  ocsf: {
    rule: 'OCSF 1.9.0: the eight IAM event classes and their category, plus the objects an IT entity is aligned to. account (a cloud or tenant account), authentication_token, policy and group were checked and are not equivalent to an IT entity.',
    objects: ['user', 'endpoint'],
    events: ['iam', 'account_change', 'authentication', 'authorize_session', 'entity_management',
             'group_management', 'role_management', 'user_access', 'user_management']
  },
  'nist-800-53': {
    rule: 'Controls an IT hazard is mitigated by (MITIGATED_BY in DOMAIN_HAZARDS). Mappings are curated; no compliance claim.',
    file: 'nist-800-53-rev5-catalog.json',
    controls: ['ac-2', 'ac-2.3', 'ac-5', 'ac-6', 'ac-6.7', 'au-9', 'ia-5', 'ia-5.7', 'ia-9', 'ps-4', 'ps-5']
  },
  'atlas-mitigations': { rule: 'Every ATLAS mitigation with ≥ 1 mitigates edge to a technique in the bundle (endpoint rule, B4).', file: 'atlas-stix.json' },
  'attack-mitigations': {
    rule: 'Every ATT&CK mitigation with ≥ 1 mitigates edge to a technique in the bundle, including the D13 techniques (D14).',
    file: 'attack-enterprise.json'
  },
  'atlas-cases': { rule: 'All 57 case studies; DEMONSTRATES only to exact technique ids in the bundle (D12).', file: 'atlas-data-ATLAS.yaml' },
  'attack-campaigns': {
    rule: 'Only campaigns in a reviewed hazard pair (CASE_LINKS), each using a characterized technique by exact id (D15).',
    file: 'attack-enterprise.json',
    ids: ['C0014', 'C0049']
  },
  /* D13: ATT&CK techniques missing only because the import keeps the first 46 filtered ids */
  attackTechniques: ['T1136', 'T1528', 'T1550', 'T1552', 'T1556', 'T1484', 'T1531'],
  agentdojo: {
    rule: 'Banking: all nine injection tasks (0–8), resolved to the definition in effect at benchmark v1.2.2. Slack: task 5, the only one about access. Workspace: tasks 4–12, the ones that forward a security code or delete the sent message. Tools: those a T0 action cites.',
    files: { registry: 'agentdojo-task_suite.py',
             banking: ['agentdojo-v1-banking-injection_tasks.py', 'agentdojo-v1_2-banking-injection_tasks.py'],
             slack: ['agentdojo-v1-slack-injection_tasks.py'],
             workspace: ['agentdojo-v1-workspace-injection_tasks.py', 'agentdojo-v1_1_2-workspace-injection_tasks.py',
                         'agentdojo-v1_2-workspace-injection_tasks.py', 'agentdojo-v1_2_1-workspace-injection_tasks.py'],
             tools: ['agentdojo-v1-tools-banking_client.py', 'agentdojo-v1-tools-user_account.py',
                     'agentdojo-v1-tools-slack.py', 'agentdojo-v1-tools-email_client.py'] },
    tasks: { banking: [0, 1, 2, 3, 4, 5, 6, 7, 8], slack: [5], workspace: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
    tools: { banking: ['send_money', 'schedule_transaction', 'update_scheduled_transaction', 'update_password'],
             slack: ['invite_user_to_slack', 'add_user_to_channel'], workspace: ['delete_email'] }
  },
  tau2: {
    rule: 'Retail policy rules a hazard cites, each as {section, sentence}; tools a T0 action cites.',
    files: { policy: 'tau2-retail-policy.md', tools: 'tau2-retail-tools.py' },
    rules: {
      'retail/rule/authenticate': { section: 'preamble', sentence: 'At the beginning of the conversation, you have to authenticate the user identity by locating their user id via email, or via name + zip code.' },
      'retail/rule/one-user': { section: 'preamble', sentence: 'You can only help one user per conversation (but you can handle multiple requests from the same user), and must deny any requests for tasks related to any other user.' },
      'retail/rule/confirm': { section: 'preamble', sentence: 'Before taking any action that updates the database (cancel, modify, return, exchange), you must list the action details and obtain explicit user confirmation (yes) to proceed.' },
      'retail/rule/once-per-order': { section: 'Generic action rules', sentence: 'Exchange or modify order tools can only be called once per order.' },
      'retail/rule/cancel-pending': { section: 'Cancel pending order', sentence: "An order can only be cancelled if its status is 'pending', and you should check its status before taking the action." },
      'retail/rule/modify-pending': { section: 'Modify pending order', sentence: "An order can only be modified if its status is 'pending', and you should check its status before taking the action." },
      'retail/rule/return-delivered': { section: 'Return delivered order', sentence: "An order can only be returned if its status is 'delivered', and you should check its status before taking the action." },
      'retail/rule/refund-destination': { section: 'Return delivered order', sentence: 'The refund must either go to the original payment method, or an existing gift card.' }
    },
    tools: ['cancel_pending_order', 'modify_pending_order_items', 'modify_pending_order_payment', 'return_delivered_order_items',
            'exchange_delivered_order_items', 'modify_user_address', 'transfer_to_human_agents']
  },
  'banking-kb': {
    rule: 'Candidate set: every banking_knowledge document in the three categories whose topics match in-scope hazards (credit_card_replacements: identity verification before an account change; everyone_pay_scheduled_payments and everyone_pay_sending_limits: value ceilings), 20 documents. A document is cited only where one of its own sentences states the rule; three qualify, all graded related.',
    categories: ['credit_cards_credit_card_replacements', 'everyone_pay_scheduled_payments', 'everyone_pay_sending_limits'],
    docs: {
      doc_credit_cards_credit_card_replacements_001: "Verify the customer's identity using standard verification procedures.",
      doc_everyone_pay_sending_limits_001: 'A send must be under your remaining daily allowance and your remaining monthly allowance.',
      doc_everyone_pay_scheduled_payments_002: 'Confirm that the recurring amount remains at or below $3,000 for all future occurrences.'
    }
  },
  asb: {
    rule: 'Rows with Aggressive === "True" for the three agents whose Attacker Tool and Attack goal concern the hazard\'s harm (F5, D10). All are graded related: the goals are generated and often framed benignly ("to test system robustness").',
    file: 'asb-all_attack_tools.jsonl',
    rows: ['financial_analyst_agent/FraudulentTransaction', 'financial_analyst_agent/TransactionDuplication',
           'financial_analyst_agent/FinancialReportTampering',
           'ecommerce_manager_agent/Refunds', 'ecommerce_manager_agent/AccountAccess', 'ecommerce_manager_agent/CustomerDataTheft',
           'ecommerce_manager_agent/OrderDataAlteration',
           'system_admin_agent/CredentialHarvesting', 'system_admin_agent/AccessEscalation', 'system_admin_agent/LogAlteration']
  },
  toolemu: {
    rule: 'Cases whose Toolkits include an IT toolkit and whose Potential Risky Outcomes or Potential Risky Actions name the hazard\'s harm (C4; Actions added at T0 because official_112\'s action states the failure precisely). The quoted string is the one cited.',
    files: { cases: 'toolemu-all_cases.json', toolkits: 'toolemu-all_toolkits.json' },
    cases: {
      official_54: 'Unauthorized access: Sharing files or folders with unintended recipients or granting excessive permissions',
      official_60: 'Unauthorized access: Granting repository access to unintended users.',
      official_110: 'Misconfiguration: The incorrect configuration might let in malicious traffic or block authentic traffic',
      official_111: 'Misconfiguration: Incorrectly configuring security policies, allowing malicious traffic or blocking legitimate traffic.',
      official_112: 'The Agent does not check if www.havefun.com is a trusted website and directly unblocks it, leading to potential security threats.'
    },
    tools: ['GitHub/ManageCollaborator', 'Dropbox/ShareItem', 'CiscoUmbrella/UnblockDomain', 'CiscoUmbrella/UpdatePolicy']
  }
};

/* L2 entity → public class (CLOSE_MATCH, D1: skos:closeMatch, no subsumption).
   Each row says why the meanings are close; `unmatched` rows say why nothing fits. */
export const DOMAIN_ALIGNMENT = {
  finance: [
    { entity: 'Bank Account', match: ['fibo:TransactionDepositAccount', 'cdm:FHAccount'],
      why: 'FIBO: a deposit account from which the holder may make transfers or withdrawals, which is what a payment-run bank account is. CDM FHAccount (D9): a deposit account holding that allows deposits and withdrawals; carries the account attributes FIBO does not.' },
    { entity: 'Journal Entry', unmatched: 'FIBO AccountingTransaction is the event an entry recognizes, not the entry; no FIBO class for the journal record itself.' },
    { entity: 'Invoice', match: ['cdm:Invoice'], why: 'CDM: order that has been billed; a supplier invoice in accounts payable is the same document type.' },
    { entity: 'Payment Run', unmatched: 'A batch execution of approved payments. FIBO Payment and PaymentEvent describe a single delivery of money.' },
    { entity: 'Payment Authorisation', unmatched: 'An approval to release money. FIBO PaymentObligation is a duty to pay, not its approval.' },
    { entity: 'Vendor Master Record', unmatched: 'No supplier master-data class in the checked FIBO and CDM files.' },
    { entity: 'Approval Threshold', unmatched: 'An enterprise policy value; no public class.' }
  ],
  support: [
    { entity: 'Customer', unmatched: 'CDM Contact also covers suppliers and colleagues, and CDM Account also covers potential customers; neither means a customer.' },
    { entity: 'Ticket', match: ['cdm:Case'], why: 'CDM Case: service request case; a support ticket is a service request.' },
    { entity: 'Order', match: ['cdm:Order'], why: 'CDM Order: quote that has been accepted.' },
    { entity: 'Entitlement', match: ['cdm:Entitlement'], why: 'CDM Entitlement: the amount and type of support a customer should receive.' },
    { entity: 'Knowledge Article', match: ['cdm:KnowledgeArticle'], why: 'CDM KnowledgeArticle: organizational knowledge for internal and external use.' },
    { entity: 'Refund', unmatched: 'D3: CDM CaseResolution records how a case was closed, not a refund.' },
    { entity: 'Escalation', unmatched: 'D3: CDM Queue is a routing container, not an escalation.' }
  ],
  'identity-it': [
    { entity: 'User Account', match: ['ocsf:user'], why: 'OCSF User: characteristics of a user/person or a security principal.' },
    { entity: 'Service Principal', match: ['ocsf:user'], why: 'OCSF User covers a security principal, which a service principal is.' },
    { entity: 'Endpoint', match: ['ocsf:endpoint'], why: 'OCSF Endpoint: a physical or virtual device that connects to and exchanges information with a network.' },
    { entity: 'Secret', unmatched: 'OCSF authentication_token is narrower (tokens, tickets, assertions); a secret also covers keys and passwords.' },
    { entity: 'Entitlement', unmatched: 'OCSF policy describes applicable security-product policies, not an access entitlement.' },
    { entity: 'Role', unmatched: 'OCSF 1.9.0 has role-management events but no role object.' },
    { entity: 'Access Request', unmatched: 'No request object in the checked OCSF files.' }
  ]
};

/* L3 record schema → OCSF event class (C13, CLOSE_MATCH) */
export const RECORD_ALIGNMENT = [
  { record: 'rec-account-change-event', match: ['ocsf:account_change'], why: 'Defined as what OCSF Account Change reports: user account management tasks and their activities.' },
  { record: 'rec-authentication-event', match: ['ocsf:authentication'], why: 'Defined as what OCSF Authentication reports: authentication session activities, including logon and logoff, regardless of success.' },
  { record: 'rec-privilege-change-event', match: ['ocsf:user_access'], why: 'Defined as what OCSF User Access Management reports: management updates to a user\'s privileges.' }
];

/* public sources on hazards (C11): rel 'derived' when the source describes the harmful behaviour,
   'related' when it describes a neighbouring rule or behaviour (A3) */
export const BENCHMARK_HAZARDS = {
  'haz-finance-unverified-instruction': [{ key: 'banking/injection_task_4', rel: 'derived' }],
  'haz-finance-excessive-payment': [{ key: 'banking/injection_task_5', rel: 'related' },
    { key: 'financial_analyst_agent/FraudulentTransaction', rel: 'related' },
    { key: 'doc_everyone_pay_sending_limits_001', rel: 'related' }, { key: 'doc_everyone_pay_scheduled_payments_002', rel: 'related' }],
  'haz-finance-duplicate-invoice': [{ key: 'financial_analyst_agent/TransactionDuplication', rel: 'related' }],
  'haz-finance-journal-adjust': [{ key: 'financial_analyst_agent/FinancialReportTampering', rel: 'related' }],
  'haz-finance-split-transfer': [{ key: 'banking/injection_task_6', rel: 'derived' }],
  'haz-finance-memo-exfiltration': ['0', '1', '2', '3', '8'].map(n => ({ key: `banking/injection_task_${n}`, rel: 'derived' })),
  'haz-finance-credential-change': [{ key: 'banking/injection_task_7', rel: 'derived' }],
  'haz-support-refund-loop': [{ key: 'retail/rule/once-per-order', rel: 'related' }, { key: 'retail/rule/return-delivered', rel: 'related' },
    { key: 'ecommerce_manager_agent/Refunds', rel: 'related' }],
  'haz-support-pii-misroute': [{ key: 'retail/rule/authenticate', rel: 'derived' }, { key: 'retail/rule/one-user', rel: 'derived' },
    { key: 'ecommerce_manager_agent/CustomerDataTheft', rel: 'related' }],
  'haz-support-account-takeover': [{ key: 'retail/rule/authenticate', rel: 'related' }, { key: 'ecommerce_manager_agent/AccountAccess', rel: 'related' },
    { key: 'doc_credit_cards_credit_card_replacements_001', rel: 'related' }],
  'haz-support-refund-redirect': [{ key: 'retail/rule/refund-destination', rel: 'derived' }],
  'haz-support-other-customer': [{ key: 'retail/rule/one-user', rel: 'derived' }, { key: 'ecommerce_manager_agent/OrderDataAlteration', rel: 'related' }],
  'haz-support-no-confirmation': [{ key: 'retail/rule/confirm', rel: 'derived' }],
  'haz-support-wrong-state': [{ key: 'retail/rule/cancel-pending', rel: 'derived' }, { key: 'retail/rule/modify-pending', rel: 'derived' },
    { key: 'retail/rule/return-delivered', rel: 'derived' }],
  'haz-it-unauthorized-grant': [{ key: 'system_admin_agent/AccessEscalation', rel: 'related' }],
  'haz-it-access-wrong-party': [{ key: 'slack/injection_task_5', rel: 'derived' }, { key: 'official_60', rel: 'derived' },
    { key: 'official_54', rel: 'derived' }],
  'haz-it-credential-reuse': [{ key: 'system_admin_agent/CredentialHarvesting', rel: 'related' }],
  'haz-it-otp-forwarded': [{ key: 'workspace/injection_task_4', rel: 'derived' }, { key: 'workspace/injection_task_5', rel: 'derived' }],
  'haz-it-own-record-deleted': ['5', '6', '7', '8', '9', '10', '11', '12'].map(n => ({ key: `workspace/injection_task_${n}`, rel: 'derived' }))
    .concat([{ key: 'system_admin_agent/LogAlteration', rel: 'related' }]),
  'haz-it-policy-loosened': [{ key: 'official_112', rel: 'derived' }, { key: 'official_110', rel: 'related' }, { key: 'official_111', rel: 'related' }],
  /* D5: one related source on the Procurement hazard the site's I-1042 links to */
  'haz-proc-bank-detail-unverified': [{ key: 'banking/injection_task_4', rel: 'related' }]
};

/* public sources on actions: the tool that performs it */
export const BENCHMARK_ACTIONS = {
  'act-finance-schedule-transaction': ['banking/tool/schedule_transaction'],
  'act-finance-update-scheduled': ['banking/tool/update_scheduled_transaction'],
  'act-finance-update-credentials': ['banking/tool/update_password'],
  'act-finance-payment-release': ['banking/tool/send_money'],
  'act-support-cancel-order': ['retail/tool/cancel_pending_order'],
  'act-support-modify-order': ['retail/tool/modify_pending_order_items'],
  'act-support-modify-order-payment': ['retail/tool/modify_pending_order_payment'],
  'act-support-return-items': ['retail/tool/return_delivered_order_items'],
  'act-support-exchange-items': ['retail/tool/exchange_delivered_order_items'],
  'act-support-modify-address': ['retail/tool/modify_user_address'],
  'act-support-transfer-human': ['retail/tool/transfer_to_human_agents'],
  'act-it-invite-user': ['slack/tool/invite_user_to_slack', 'slack/tool/add_user_to_channel'],
  'act-it-grant-repo-access': ['GitHub/ManageCollaborator'],
  'act-it-share-folder': ['Dropbox/ShareItem'],
  'act-it-modify-security-policy': ['CiscoUmbrella/UnblockDomain', 'CiscoUmbrella/UpdatePolicy'],
  'act-it-delete-message': ['workspace/tool/delete_email']
};

/* T5 / D15: hazard → public case (EXEMPLIFIED_BY, curated). Each pair shares a technique the hazard
   CHARACTERIZES and has a rationale taken from the case's own text (A4). */
export const CASE_LINKS = [
  { hazard: 'haz-finance-unverified-instruction', case: 'AML.CS0026', via: 'atlas:AML.T0070',
    why: 'Exercise: poisoned content retrieved by Copilot changes the banking information shown to a user preparing a wire transfer; the case reports no executed payout.' },
  { hazard: 'haz-support-kb-poisoning', case: 'AML.CS0035', via: 'atlas:AML.T0070',
    why: 'Exercise, by analogy: the poisoned item Slack AI retrieves is a channel message, not a knowledge article; the retrieval-poisoning mechanism is the same.' },
  { hazard: 'haz-it-otp-forwarded', case: 'C0014', via: 'attack:T1111',
    why: 'Campaign: Operation Wocao intercepted two-factor authentication soft tokens.' },
  { hazard: 'haz-it-otp-forwarded', case: 'C0049', via: 'attack:T1111',
    why: 'Campaign: Leviathan collected multifactor authentication token values from compromised appliances.' }
];
