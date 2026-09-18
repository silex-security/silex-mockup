# silex-mockup

Clickable demo of the SILEX agentic security platform, aligned with the V1 PRD (Web UX / Investor Demo) on 2026-09-15.

- **Page:** [`index.html`](index.html), a single self-contained HTML file. Live at [silex-mockup.vercel.app](https://silex-mockup.vercel.app/).
- **Demo story:** Agentic Blueprint Studio → Confirm → Validate → Optimize → Decide → Register → Workflow Library → Mark as deployed → Short-Term Validation → Long-Term Validation. Incidents enter the same flow from the Incident Queue.
- **What changed:** click **◆ 9/15 changes** in the top bar to list, jump to and outline every change. The same list, the defaults chosen for open questions, and the remaining to-dos are in [`docs/CHANGES.md`](docs/CHANGES.md).
- **Plan:** [`docs/PRD_ALIGNMENT_PLAN.md`](docs/PRD_ALIGNMENT_PLAN.md) compares the 9/14 page with the PRD and lays out the P0/P1/P2 work this revision implements.
- **Security World Model:** the *World Model Coverage*, *Security Ontology* and *Ontology Layers* tabs are D3 panels over one L1 → L2 → L3 → L4 chain, built from MITRE D3FEND, ATT&CK, ATLAS, UCO and the OWASP GenAI lists. What was built and why: [`SECURITY_WORLD_MODEL.md`](SECURITY_WORLD_MODEL.md). Code and data pipeline: [`swm/`](swm/README.md).
- **Earlier plans and audits** live in [`docs/`](docs/).
- **Figures are illustrative.** All agents are simulated; no engine runs behind the page.
