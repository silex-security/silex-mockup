# Worked examples

## 1. Add a Legal domain pack, end to end

### Seed

```js
// swm/tools/silex-seed.mjs — append to DOMAINS
{ id:'legal', name:'Legal & Compliance', code:'LG', coverage:.71, agents:5, workflows:14, incidents:2,
  pack:'Legal Pack v0.9 (draft)', owner:'GC · Legal Operations',
  dims:{ identity:.78, agent:.74, workflow:.66, policy:.8, resource:.69, outcome:.72 },
  entities:['Contract','Clause Library','Matter','Outside Counsel','Regulatory Filing',
            'Privileged Disclosure (prohibited)'],
  capabilities:[
    { id:'lg-ctr', name:'Contract Lifecycle', coverage:.74, entities:1620, incidents:1,
      dims:{ identity:.8, agent:.77, workflow:.69, policy:.82, resource:.71, outcome:.75 },
      workflows:[
        { id:'WF-061', name:'Clause Review', coverage:.78, entities:880 },
        { id:'WF-062', name:'Counterparty Redlines', coverage:.69, entities:740 }] },
    { id:'lg-reg', name:'Regulatory Response', coverage:.67, entities:940, incidents:1,
      dims:{ identity:.75, agent:.7, workflow:.62, policy:.77, resource:.66, outcome:.69 },
      workflows:[
        { id:'WF-063', name:'Filing Preparation', coverage:.7, entities:520 },
        { id:'WF-064', name:'Privilege Screening', coverage:.63, entities:420 }] }] }
```

Give it presence at L4, otherwise Legal has no runtime instances and no component will be placed
there:

```js
// RUNTIME.nodes
{ id:'rt-legal-agent', name:'Contract Review Agent', group:'agent', type:'planner', coverage:.74,
  blurb:'Drafts and redlines contract clauses under counsel review.', domain:'legal' },
{ id:'rt-clause-index', name:'Clause Library Index', group:'resource', type:'retriever', coverage:.66,
  blurb:'RAG index over the approved clause library and past redlines.', domain:'legal' },
{ id:'rt-wf-062', name:'WF-062 Counterparty Redlines', group:'workflow', type:'trace', coverage:.69,
  blurb:'Registered workflow under validation.', domain:'legal' },
{ id:'rt-out-priv', name:'Privileged material disclosed', group:'outcome', type:'harness',
  outcome:'prohibited', coverage:1,
  blurb:'Prohibited outcome: privileged content leaves the matter.', domain:'legal' },

// RUNTIME.links
['rt-legal-agent','rt-clause-index','RETRIEVES_FROM'],
['rt-wf-062','rt-legal-agent','EXECUTED_BY'],
['rt-clause-index','rt-out-priv','CAN_REACH'],
```

And a gap so the domain has something to say in the coverage panel:

```js
// GAPS
{ id:'g-privilege', title:'Privilege screening only partly modelled',
  detail:'WF-064 at 63% · privileged-material detection is inferred from clause tags, not observed',
  severity:'serious', scope:['enterprise','legal','lg-reg','WF-064'],
  action:{ label:'Open WF-064', kind:'workflow', value:'WF-064' } }
```

### Build and check

```bash
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs
node swm/tools/build-ontology.mjs --offline
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs
```

Expect: the sunburst gains a sixth domain wedge, weighted coverage moves a point or two, the L2 count
rises by about a dozen types, and `L3→L4` gains four relations.

### The authored parts the build cannot reach

- **Domain Suites tab** (`index.html`, `#suiteGrid`) is still hand-written markup: add a
  `<button class="suite-card" data-suite="legal">` card if Legal should appear there.
- **Overview counters** ("5 domain packs · 53 agents · 179 workflows") are authored text; grep for
  the numbers and update them so the page does not contradict itself.

## 2. Re-skin the demo for another industry

Replace three exports and keep the rest:

| Replace | Keep |
|---|---|
| `DOMAINS` — the new industry's packs, capabilities, workflows, entity types | `GROUPS`, `LAYERS`, `DIMENSIONS` — not industry-specific |
| `RUNTIME` — agents, tools, policies, incidents and outcomes of that industry | `AGENTIC_COMPONENTS` — planner, memory, RAG, MCP and friends are the same everywhere |
| `GAPS` — the story of what is not yet modelled | `OWASP_LLM`, `OWASP_AGENTIC`, `GROUP_HINTS` |

Then:

1. Keep one workflow and one incident wired to the ids the page cross-links (`WF-021`, `I-1042`), or
   update those references in `index.html` — the Workflow Library, Incident Queue and blueprint story
   all point at them.
2. Keep one prohibited-outcome entity per domain so the *Outcome* group stays populated at L2.
3. Keep the narrative consistent: one weak domain, one unconnected data source, one live incident.
   The demo lands because the numbers, the gaps and the copy agree.
4. Rebuild, verify, preview, and re-read the authored text in `index.html` for stale figures.
