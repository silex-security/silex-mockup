# silex-mockup

Clickable demo of the SILEX agentic security platform, aligned with the V1 PRD (Web UX / Investor Demo) on 2026-09-15.

- **Page:** [`index.html`](index.html), a single self-contained HTML file. Live at [silex-mockup.vercel.app](https://silex-mockup.vercel.app/).
- **Registers:** a top-bar toggle switches between **Assurance** (investor / technical — Continuous Production Assurance, the Agent V&V matrix, the Enterprise World Model) and **Operations** (the security-team dashboard). The left nav is an **Agent Lifecycle** rail: Blueprint Studio → Pre-release → PCP · Policy → Incident Queue.
- **Security World Model:** the *World Model Coverage*, *Security Ontology* and *Ontology Layers* tabs are D3 panels over one L1 → L2 → L3 → L4 chain, built from MITRE D3FEND, ATT&CK, ATLAS, UCO and the OWASP GenAI lists. What was built and why: [`SECURITY_WORLD_MODEL.md`](SECURITY_WORLD_MODEL.md). Code and data pipeline: [`swm/`](swm/README.md).
- **Change log & plans:** every change, with dated plans and audits, is archived in [`logs/`](logs/) — start with [`logs/README.md`](logs/README.md).
- **Figures are illustrative.** All agents are simulated; no engine runs behind the page.
