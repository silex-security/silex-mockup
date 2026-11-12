# Home page against the product-suite diagram and Memo V3

Date: 2026-11-11. Owner request: compare the demo site with the "Product Suite for Agent Lifecycle" diagram and the *Memo V3* tab of the investor memo ("SILEX | Enterprise Infrastructure for AI Agents"), list what to improve, then do the first batch.

## What was compared

- The diagram: four products (Agent Studio, Agent Gym, SILEX Runtime, SILEX Speedrun) on SILEX Foundry, three capabilities per product, three loops.
- Memo V3: thesis (forward-deployed engineers do not scale, execution knowledge must transfer), five outcomes, the Business Ontology and the Agent Execution Ontology, four layers, the product suite.
- The site: the Platform home view at 1440 px (screenshot and `index.html` source), plus a keyword search of the embedded apps. The inner views were not audited page by page.

## Findings and status

| # | Finding | Status |
|---|---|---|
| 1 | The second half of the home page (World Model evidence, V&V, Correspondence Problem, autonomy flywheel) tells the earlier assurance story. Memo V3 leads with transferable execution knowledge, and security is one outcome of five. | Done in this change. The four sections moved to their own view, `#view=assurance-case`. |
| 2 | The four hero KPIs (82 % coverage, 29.4K entities, 94 % fit, 8 blind spots) are illustrative world-model figures and do not support the thesis. | Done in this change. The strip now shows figures that are measured, each linked to its page. |
| 3 | The product cards fold the diagram's three capabilities into one sentence. The Agent Gym card uses the workbench wording, not the diagram's. | Done in this change. |
| 4 | Only one of the diagram's three loops is drawn. "Test optimizations" (Gym and Speedrun) and "Performance improvement spans design, testing, and production" are missing. | Done in this change. |
| 5 | Stage labels differ from the diagram: "Verify · Validate" and "Performance" against "Verification · Validation · Assurance" and "Performance Enhancement". | Done in this change. |
| 6 | The four layer names differ from the memo. The site has L1 General ("Reusable agent-security semantics"), L2 Domain packs, L3 Agentic-system, L4 Runtime graph. The memo has General concepts and rules, Domain and enterprise knowledge, Agent execution knowledge, Runtime knowledge graph. | Done on 2026-11-12. The names come from `LAYERS` in `swm/tools/silex-seed.mjs`, and the bundle was regenerated. The Ontology Graph tier buttons use a short form ("General concepts", "Domain knowledge", "Agent execution", "Runtime knowledge"). |
| 7 | "Business Ontology" and "Agent Execution Ontology" do not appear on the console pages. The Ontology Layers tab is the natural place. | Done on 2026-11-12. The Ontology Layers tab opens with the two ontologies. It does not say which layer belongs to which. |
| 8 | The forward-deployed-engineer argument is not on the home page. | Done on 2026-11-12. The hero carries the argument as a visible paragraph. The primary button is now "Explore the world model". |
| 9 | Agent Gym does not use the memo's wording: "flight simulator for agents", red and blue teams, findings that become regression tests. | Done on 2026-11-12, in the title notes of the four Gym views. The embedded app is unchanged. |
| 10 | SILEX Runtime does not say that it advises existing controls such as an MCP gateway. The page reads as if SILEX blocks the action itself. | Done on 2026-11-12, in the lead paragraph and title note of Runtime Observation. |
| 11 | Naming. The diagram says SILEX Foundry, the memo body says "shared Knowledge Library", and Foundry's only view is called Enterprise World Model. | Decided by the owner on 2026-11-12: the foundation is SILEX Foundry and its view stays Enterprise World Model. The site already says so. The memo body still says "shared Knowledge Library" and is the owner's to edit. |
| 12 | Status chips (Designed, Building, Roadmap) are not on the diagram. Speedrun is marked Roadmap and is one of the most complete parts of the demo. | Decided by the owner on 2026-11-12: remove the chips. Done the same day, on the product map and beside the four Agent Gym view titles. The `data-status` attribute, the `status` field and the chip styles are gone. |

## Decisions made in this change

- **Where the assurance sections went.** One view outside the sidebar, like Operations Overview, reached from a link on the home page. Splitting the four sections across Foundry, Gym and Runtime was not possible in one step, because the Gym views are a single embedded app. A later change can fold section 03 into the Enterprise World Model view.
- **Which hero figures.** Only figures with a data file or a pre-registered report behind them: the judge's p50 latency, the share of checks inside the gate budget, the fine-tuned small model's AUROC, and alert precision with ontology types. The strip is labelled as measured.
- **Capability icons.** The diagram draws an icon per capability. The cards use a plain list marker.

## Left for later, noticed on the way

All cleared on 2026-11-12, see the change log entry "Leftovers from the Memo V3 review, and repeated titles in the embedded apps".

- The model documents keep the earlier tier names and now say so in a note.
- "Planned for V2" no longer lists the Runtime Knowledge Graph or rich ontology exploration.
- Runtime Observation counts 12 reference scenarios in the KPI row and 34 situations in the picker, and names them apart.
- The Agent fleet intro lets the control in the path do the stopping.
- The product map has an icon per capability and arrowheads on the Test optimizations loop. The arrows up from the Foundry band were left out on purpose.
