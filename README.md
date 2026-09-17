# silex-mockup

Clickable demo of the SILEX agentic security platform, aligned with the V1 PRD (Web UX / Investor Demo) on 2026-09-15.

- **Page:** [`index.html`](index.html), a single self-contained HTML file. Live at [silex-mockup.vercel.app](https://silex-mockup.vercel.app/).
- **Demo story:** Agentic Blueprint Studio → Confirm → Validate → Optimize → Decide → Register → Workflow Library → Mark as deployed → Short-Term Validation → Long-Term Validation. Incidents enter the same flow from the Incident Queue.
- **What changed:** click **◆ 9/15 changes** in the top bar to list, jump to and outline every change. The same list, the defaults chosen for open questions, and the remaining to-dos are in [`CHANGES.md`](CHANGES.md).
- **Plan:** [`PRD_ALIGNMENT_PLAN.md`](PRD_ALIGNMENT_PLAN.md) compares the 9/14 page with the PRD and lays out the P0/P1/P2 work this revision implements.
- **Security World Model:** the *World Model Coverage* and *Security Ontology* tabs are D3 observatories with four levels of abstraction (L1 general → L2 domain → L3 agentic-system → L4 runtime). Code, data pipeline and provenance live in [`swm/`](swm/README.md); L1 classes are distilled from MITRE D3FEND, ATT&CK, ATLAS, UCO and the OWASP GenAI lists.
- **Figures are illustrative.** All agents are simulated; no engine runs behind the page.
