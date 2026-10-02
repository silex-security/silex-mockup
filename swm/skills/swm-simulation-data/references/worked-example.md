# Worked examples

## 1. Add a Logistics domain pack, end to end

### Seed

```js
// swm/tools/silex-seed.mjs — append to DOMAINS (and add one PROHIBITED entry below)
{ id:'logistics', name:'Logistics', code:'LO', coverage:.73, agents:5, workflows:12, incidents:1,
  pack:'Logistics Pack v0.9 (draft)', owner:'CSCO · Supply Chain',
  dims:{ identity:.77, agent:.73, workflow:.68, policy:.74, resource:.7, outcome:.75 },
  entities:['Shipment','Carrier','Warehouse','Dispatch Order','Delivery Confirmation','Freight Invoice'],
  capabilities:[
    { id:'lo-disp', name:'Dispatch Planning', coverage:.76, entities:1380, incidents:1,
      dims:{ identity:.8, agent:.76, workflow:.7, policy:.78, resource:.72, outcome:.77 },
      workflows:[
        { id:'WF-091', name:'Dispatch Planning', coverage:.79, entities:760 },
        { id:'WF-092', name:'Carrier Selection', coverage:.71, entities:620 }] },
    { id:'lo-wms', name:'Warehouse Receipt', coverage:.69, entities:1020, incidents:0,
      dims:{ identity:.74, agent:.7, workflow:.64, policy:.71, resource:.68, outcome:.72 },
      workflows:[
        { id:'WF-093', name:'Freight Settlement', coverage:.66, entities:580 }] }] }
```

A domain's prohibited outcomes are **not** entity types. Author them in `PROHIBITED`, retyped as an
effect or state:

```js
// PROHIBITED
logistics: [
  { id:'proh-logistics-undelivered-freight', label:'Undelivered Freight Charge', kind:'effect',
    isA:'financial-value-transfer',
    def:'An effect of a settlement action that paid for a delivery that never arrived, not a record the company holds.' }
],
```

Give every entity an `ENTITY_ISA` entry, then give the pack actions and hazards:

```js
// ENTITY_ISA
logistics: {
  'Shipment':'core-commitment', 'Carrier':'core-party', 'Warehouse':'core-resource',
  'Dispatch Order':'core-commitment', 'Delivery Confirmation':'core-record', 'Freight Invoice':'core-record'
},

// DOMAIN_ACTIONS
logistics: [
  { id:'act-lo-dispatch', label:'Dispatch Planning', isA:'core-action-write',
    mayCause:['core-effect-record-alteration'], workflows:['WF-091'] },
  { id:'act-lo-carrier-pick', label:'Carrier Selection', isA:'core-action-approve',
    mayCause:['core-effect-record-alteration'], workflows:['WF-092'] },
  { id:'act-lo-receive', label:'Warehouse Receipt', isA:'core-action-write',
    mayCause:['core-effect-data-write'], workflows:['WF-092'] },
  { id:'act-lo-settle', label:'Freight Settlement', isA:'core-action-transfer-value',
    mayCause:['financial-value-transfer'], workflows:['WF-093'] }
],

// DOMAIN_HAZARDS
logistics: [
  { id:'haz-lo-settle-without-delivery', label:'Freight Settled Without Delivery Proof',
    def:'A freight invoice is paid although no delivery confirmation exists.',
    hazardFor:['Freight Invoice','act-lo-settle'], mayLeadTo:['proh-logistics-undelivered-freight'],
    characterizes:['atlas:AML.T0053'], mitigatedBy:['core-control-dual-approval'], requiresEvidence:['core-evidence-approval-record'] },
  { id:'haz-lo-carrier-unvetted', label:'Carrier Selected Without Vetting',
    def:'A carrier is chosen on cost alone before its identity is checked.',
    hazardFor:['Carrier','act-lo-carrier-pick'],
    characterizes:['atlas:AML.T0073'], mitigatedBy:['human-approval'], requiresEvidence:['core-evidence-identity-assertion'] },
  { id:'haz-lo-dispatch-orphan', label:'Dispatch Released With No Carrier',
    def:'A dispatch order goes out before a carrier is committed to it.',
    hazardFor:['Dispatch Order','act-lo-dispatch'],
    characterizes:['owasp:LLM06'], mitigatedBy:['core-control-policy-gate'], requiresEvidence:['core-evidence-observation'] }
],
```

Give it presence at L4, otherwise Logistics has no runtime instances and no component shows a
`DEPLOYED_IN` edge into it:

```js
// RUNTIME.nodes
{ id:'rt-lo-agent', name:'Dispatch Agent', group:'agent', type:'planner', coverage:.74,
  blurb:'Plans dispatches and picks carriers under policy.', domain:'logistics' },
{ id:'rt-lo-index', name:'Carrier Directory Index', group:'resource', type:'retriever', coverage:.66,
  blurb:'RAG index over carrier records and past performance.', domain:'logistics' },
{ id:'rt-wf-091', name:'WF-091 Dispatch Planning', group:'workflow', type:'trace', coverage:.79,
  blurb:'Registered workflow under validation.', domain:'logistics' },

// RUNTIME.links
['rt-lo-agent','rt-lo-index','RETRIEVES_FROM'],
['rt-wf-091','rt-lo-agent','EXECUTED_BY'],
```

And a gap so the domain has something to say in the coverage panel:

```js
// GAPS
{ id:'g-freight', title:'Freight settlement mostly unobserved',
  detail:'WF-093 at 66% · delivery proof is inferred from carrier messages, not read from the warehouse',
  severity:'serious', scope:['enterprise','logistics','lo-wms','WF-093'],
  action:{ label:'Open WF-093', kind:'workflow', value:'WF-093' } }
```

### Build and check

```bash
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs
node swm/tools/build-ontology.mjs --offline
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs
```

Expect: the sunburst gains a sixth domain wedge, weighted coverage moves a point or two, the L2 count
rises, L3→L4 gains relations, and the Logistics hazard chain appears in the Explorer.

### The authored parts the build cannot reach

- **Domain Suites tab** (`index.html`, `#suiteGrid`) is still hand-written markup: add a
  `<button class="suite-card" data-suite="logistics">` card if Logistics should appear there.
- **Overview counters** ("5 domain packs · 53 agents · 179 workflows") are authored text; grep for
  the numbers and update them so the page does not contradict itself.

> CRM and Legal are already built-in **candidate** packs in `CANDIDATE_DOMAINS` (ontology only, no
> coverage figures). Use a different domain when you want a worked example that touches coverage.

## 2. Re-skin the demo for another industry

Replace three exports and keep the rest:

| Replace | Keep |
|---|---|
| `DOMAINS` — the new industry's packs, capabilities, workflows, entity types | `GROUPS`, `LAYERS`, `DIMENSIONS` — not industry-specific |
| `RUNTIME` — agents, tools, policies, incidents and outcomes of that industry | `AGENTIC_COMPONENTS` and `COMPONENT_ISA` — planner, memory, RAG and friends are the same everywhere |
| `GAPS` — the story of what is not yet modelled | `OWASP_LLM`, `OWASP_AGENTIC`, `GROUP_HINTS` |

Then also refresh the ontology-rigour exports that name the old domains: `ENTITY_ISA`,
`DOMAIN_ACTIONS`, `PROHIBITED`, `DOMAIN_HAZARDS`, `INCIDENT_HAZARDS` and the OWASP rows of
`COUNTER_MAP`. The L1 `CORE_L1` concepts, their `COMPONENT_ISA` targets and `RECORD_SCHEMAS` are not
industry-specific and normally stay.

Then:

1. Keep one workflow and one incident wired to the ids the page cross-links (`WF-021`, `I-1042`), or
   update those references in `index.html` — the Workflow Library, Incident Queue and blueprint story
   all point at them.
2. Keep at least one prohibited outcome per domain, authored in `PROHIBITED` (not as an entity), so
   the *Outcome* group stays populated at L2 and each one is still reached by a hazard.
3. Keep every hazard's `characterizes`, `mitigatedBy` and `requiresEvidence` filled, and make sure
   each required evidence appears in a `RECORD_SCHEMAS` entry.
4. Keep the narrative consistent: one weak domain, one unconnected data source, one live incident.
   The demo lands because the numbers, the gaps and the copy agree.
5. Rebuild, verify, preview, and re-read the authored text in `index.html` for stale figures.
