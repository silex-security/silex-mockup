# SWM domain grounding — execution plan (E5, round 5 confirmation: adds Identity & IT)

Scope document: [`swm/2026-10-03_SWM_DOMAIN_GROUNDING_PLAN.md`](../swm/2026-10-03_SWM_DOMAIN_GROUNDING_PLAN.md) (v3).
This plan **inherits v3** (sources S1–S9, contract C1–C10, tasks T0–T8, competency questions, acceptance,
claim discipline, must-not-change) and **overrides it wherever a row below says so**. Where E2 and v3
disagree, E2 wins. It adds what v3 lacked: a verified dataset decision, owners, file ownership, order of
work and review stops.

Base: `main` at `350362a`. Branch `swm-domain-grounding`, cut from that commit when the plan gate passes.
Status: **E5 approved unanimously (round 5, 2026-10-03)**, covering Finance, Customer Service and Identity & IT. Nothing is implemented. Part C is new; other E4 edits are listed in the round-4 table. This run ends at the plan gate; implementation starts
only when the product owner says go.

Roster: **planner** Claude (Opus 5.5, calling pane) · **coder-deepseek** OpenCode `deepseek/deepseek-v4-pro`
· **reviewer-codex** Codex (third judge). One shared checkout. Plan gate and code gate are unanimous.
(`deepseek/deepseek-reasoner`, the skill's default, is no longer offered by OpenCode 1.18.32; `opencode
models deepseek` lists only `deepseek-flash` and `deepseek-v4-pro`. V4 Pro is the reasoning tier.)

Reviewers: return `PLAN-APPROVED` or `PLAN-REJECTED` with numbered blocking objections, and one line on
each decision D13–D18 (D1–D12 stand as approved unless Part C breaks one).

**Scope override (E4):** v3 put Identity & IT out of scope. E4 grounds **Finance, Customer Service and
Identity & IT**. Procurement, HR, CRM and Legal stay out of scope (except D5).

---

## Part A — Which datasets

### A1. Verification of the sources (2026-10-03)

Method: `gh api repos/<repo>/commits/<sha>` for each pin; `gh api repos/<repo>/license`, and the
`LICENSE` file where the API says `NOASSERTION`; counts by downloading the pinned file and counting
([§ Appendix](#appendix-verification-commands)). Anyone can rerun them.

| # | Source @ pin | Pin exists (commit date) | Licence (checked) | Count found |
|---|---|---|---|---|
| S1 | ATLAS STIX, `mitre-atlas/atlas-navigator-data@6f66878fc757` `dist/stix-atlas.json` | ✓ 2026-04-30 | Apache-2.0 | 35 `course-of-action`, 246 `mitigates`. **The cached file's git blob (`940840e8`) equals the file at this commit**, so pinning changes no byte of the current bundle (R1-DS2) |
| S2 | `mitre-atlas/atlas-data@3259f388d19c` `dist/ATLAS.yaml` (ATLAS 5.6.0) | ✓ 2026-09-10 | API `NOASSERTION`; `LICENSE` file Apache-2.0 | 57 case studies: **17 `incident`, 40 `exercise`** (R1-DS1, R1-CX1) |
| S3 | `edmcouncil/fibo@9a7b90ccc64e` | ✓ 2026-10-01 | MIT | class list fixed in T0 |
| S4 | `ethz-spylab/agentdojo@089ed468cf3e` banking | ✓ 2026-06-02 | MIT | 9 injection tasks (0–8) at the newest benchmark version, v1.2.2 (suite folders `v1` … `v1_2_2`; banking injection tasks change only in `v1` and `v1_2`): `v1_2/banking/injection_tasks.py` overrides 0–6 and 8 via `update_injection_task((1,2,0))`; task 7 keeps its v1 definition (`task_suite.py` keys tasks by id → version, `get_version_compatible_items` picks the newest ≤ the benchmark version) |
| S5 | `sierra-research/tau2-bench@5bfa7e37b366` retail | ✓ 2026-09-28 | MIT | 16 tools (a 17th, `think`, is commented out) |
| S6/S9 | `microsoft/CDM@dd21d715e05e` | ✓ 2025-01-22 | CC-BY-4.0 (`LICENSE`; code under `LICENSE-CODE`, not used) | all named entities found (F3) |
| S7 | `agiresearch/ASB@544540ff0788` `data/all_attack_tools.jsonl` | ✓ 2026-09-30 | MIT | 400 rows; 40 per agent; per agent 20 `"Aggressive": "True"` (strings) |
| S8 | tau2 `banking_knowledge/documents` | S5 pin | MIT | 698 documents (plus 97 task files) |

No pinned repository has a root `NOTICE` file (checked by listing each root tree). Bundle at BASE:
`ontology.json` 766 nodes · 1389 links; `ontology.js` 583 952 B.

**ATLAS endpoints, measured** (python over `swm/.cache/atlas-stix.json`, `ATLAS.yaml` and `ontology.json`):
the case studies reference **145 distinct technique ids**, of which **69 are in the bundle** (the bundle
imports 80 top-level ATLAS techniques and no sub-techniques). The 246 `mitigates` edges target
techniques; **140 of those edges** target techniques in the bundle (**43 distinct** techniques of the 74 targeted); each of the 35 mitigations has at least one such edge.

### A2. Findings that change v3

| # | Finding | Change |
|---|---|---|
| F1 | AgentDojo versions its tasks (see S4) | `src` = `{sys:'agentdojo', id:'banking/injection_task_<n>', ver:'<version of the definition in effect at benchmark v1.2.2>'}` — `1.2.0` for 0–6 and 8, `1.0.0` for 7. Quotes are taken from that definition |
| F2 | ATLAS's licence is not machine-detectable on GitHub | `NOTICES.md` cites the `LICENSE` file at the pin |
| F3 | CDM paths: `…/foundationCommon/{Account,Contact,KnowledgeArticle}.cdm.json`, `…/foundationCommon/crmCommon/sales/{Order,Invoice}.cdm.json`, `…/foundationCommon/crmCommon/service/{Case,CaseResolution,Entitlement}.cdm.json`, `…/applicationCommon/Queue.cdm.json`. Account and Contact exist in `foundationCommon` and `crmCommon` | T0 lists the full path of each CDM document. Where both exist, import the `crmCommon` one and its `extendsEntity` parent as `SUBCLASS_OF` (C5) |
| F4 | CDM also ships Financial Services models (`RetailBankingCoreDataModel`: `Account`, `Bank`, `Fh_account`, `Fi_standingorder`, `Fi_directdebit`, `Fi_card`, …) | Option D9 |
| F5 | ASB rows have no id; `Attacker Tool` is unique within each agent. `Aggressive` is the **string** `"True"`/`"False"`; the 20 `"False"` rows per agent are benign tools (`AntiMoneyLaunderingTool`, …) | Eligible rows: `Aggressive === "True"` exactly (no truthiness). Harm is read from `Attack goal`, not from `Attacker Instruction`/`Description`, which can be disguised. `src.id` = `<agent>/<Attacker Tool>` |
| F6 | τ²-bench `policy.md`: authentication ("…even when the user already provides the user id"), one-user-per-conversation and explicit confirmation are in the **preamble before `## Domain basic`** (R1-CX2). The refund-destination rule ("must either go to the original payment method, or an existing gift card") is under `## Return delivered order` | Each rule in T0 = `{section, sentence}` where `section` is a heading or the literal `preamble` (text before the first `##`). The build fails if the verbatim sentence is not in that section of the pinned file |
| F7 | `return_delivered_order_items(…, payment_method_id)` is the tool that picks the refund destination; `modify_pending_order_payment` charges the new method and refunds the original (R1-CX2) | Refund-redirection hazard → action *Return Delivered Items* + the `## Return delivered order` rule, gift-card exception kept in the hazard text. *Modify Pending Order Payment* is added as an action for the payment change only, with no refund hazard attached |

### A3. Grounding strength: derived vs related (R1-CX3)

A benchmark rarely states our exact hazard. Every non-Silex `src` on a hazard therefore carries
`rel`:

- `derived`: the source itself describes the harmful behaviour (e.g. AgentDojo task 4, "modify the
  recipient of a recurring payment to the attacker's account" → *Payment From Unverified Instruction*).
- `related`: the source describes a neighbouring behaviour or rule; the hazard's mechanism is
  Silex-modelled (e.g. τ² "exchange or modify order tools can only be called once per order" →
  *Repeated Refund After Partial Failure*).

The inspector prints the `rel` next to every source. Consequences:

| Hazard | v3 said | E2 |
|---|---|---|
| *Repeated Refund After Partial Failure* (`haz-support-refund-loop`) | τ² rules ground it | Stays a **Silex-modelled mechanism**. τ² once-per-order rule and "check its status before taking the action", and ASB `ecommerce_manager_agent/Refunds`: `related` |
| *Payment Above Approved Ceiling* | AgentDojo task 5 | task 5 ("send as much money as possible"): `related`; the ceiling is enterprise policy, not in the benchmark |
| New: *Value transfer split into small increments* | AgentDojo task 6 | task 6 `derived` for the splitting behaviour; "to stay under an approval ceiling" is Silex's interpretation and the hazard text says so |
| *Account Recovery Without Verified Identity* (support) | τ² authentication rule | τ² rule `related` (it governs authentication before any action, not account recovery); ASB `AccountAccess` `related` (its goal is unauthorized access during verification, not recovery). T0 may instead add a separately named *unauthorized account access* hazard with `AccountAccess` `derived` |
| *Customer Data Sent To Unverified Requester* | τ² authentication rule | τ² authentication and one-user rules `derived` (both forbid serving another or unauthenticated user) |
| Procurement *haz-proc-bank-detail-unverified* (D5) | task 4 as `src` | task 4 `related` (it redirects a recurring payment, not supplier master data) |
| Credential change (Finance) | task 7 | Restored (F1): new hazard *Account takeover through a credential change*, task 7 `derived` |

The exact `rel` of every row is fixed in the T0 lists and reviewed at the T0 gate.

### A4. ATLAS case studies are incidents **and** exercises (R1-DS1, R1-CX1)

- The `case` node keeps `caseType: 'incident' | 'exercise'` from the source. The inspector shows it.
- Copy says "57 published ATLAS case studies (17 incidents, 40 exercises)". "Real incident" is used only
  for `incident` records, never for the collection. This replaces v3's claim-discipline sentence
  "ATLAS case studies are real, published incidents elsewhere", v3 Goal 3 "Real incidents" and S2
  "real-world case studies".
- **T5 changes.** A shared technique is a candidate, not a link. T5 creates `EXEMPLIFIED_BY`
  (hazard → case) only for pairs in a T0-reviewed list, each with a one-line rationale quoting the
  case's own summary. Candidates not in the list get no edge; the path hazard → `CHARACTERIZES` →
  technique ← `DEMONSTRATES` ← case already shows the technique connection.

### A5. Recommended dataset set

| Decision | Sources | Why |
|---|---|---|
| **Adopt** | S1 (now pinned), S2, S3, S4, S5, S6, S9 | Public, permissive licence, pinned, counts verified; each fills a named gap |
| **Adopt with a selection rule** | S7 ASB (`Aggressive === "True"`, two agents, harm from `Attack goal`); S8 `banking_knowledge` (only documents T0 names, rule written) | Generated (S7) or large (S8); the rule stops cherry-picking |
| **Open** | CDM Financial Services (D9) | New |
| **Excluded by this plan's policy** | AI Incident Database: share-alike, which this plan does not take on for new sources (CC BY-SA permits commercial use; the obligation is the reason). The 25 OWASP risks (CC BY-SA 4.0) are a pre-existing inclusion, unchanged here; `NOTICES.md` carries their attribution and says so. ISO 20022, UBL, schema.org: terms not yet checked. CRMArena-Pro: non-commercial. Exgentic traces: no licence. AgentHarm: licence unverified ("other") | (R1-CX10) |

No source is added beyond these without another plan round.

---

## Part B — How to execute

### B1. Order of work and review stops (R1-CX5)

| Phase | Who | What | Exit |
|---|---|---|---|
| **P0a** | planner | Cut the branch. T0 contract C1–C12 in `schema.mjs`; `MANIFEST.json` (B3); `grab()` checks it; seed stubs; T0 selection lists with selection rules, `rel` per source, T5 pair list with rationales, each FIBO/CDM class with its definition text from the pinned file; `swm/tools/sources/CONTRACT.md`; the AgentDojo version-folder evidence. No import of source modules yet | build green; provisional output goes to scratch, not `swm/data/` |
| **P0b** | reviewer-codex | Update `verify-bundle.mjs`'s own schema copy for C1–C12 **from this plan**, plus the threat-partition change (B4) | verifier passes on the P0 bundle and fails on a crafted bad one |
| **P0c** | coder-deepseek | Create the source modules as empty stubs per CONTRACT.md and the `test-sources.mjs` skeleton | stubs import cleanly |
| **P0d** | planner | Wire the stubs into `build-ontology.mjs`. Build + verifier + CQ1–CQ6 green on the provisional bundle (schema changes, no new source nodes), written to scratch. Checkpoint commit | **T0 gate**: all three seats approve contract, manifest and lists (`T0-APPROVED`). Max three rounds, then the product owner decides |
| **P1** | three seats in parallel | B2 | each reports `done` |
| **P2** | planner | Regenerate `swm/data/*`; T7 UI; T8 copy; acceptance (B5); headless screenshots of Layers, Graph and the inspector on one Finance and one CS hazard | — |
| **P3** | all | **Code gate**: `IMPL-APPROVED` from all three on one diff revision against `BASE=350362a` | unanimous |
| **P4** | planner | Merge to `main`, changelog, Outcome. **Push only with the product owner's go-ahead** (pushing `main` deploys the site) | owner's go |

### B2. File ownership

Only the planner edits `build-ontology.mjs`; each source is its own module.

| Owner | Files (write only these) | Job |
|---|---|---|
| **planner** | `swm/tools/{schema,silex-seed,build-ontology}.mjs`, `swm/tools/sources/{CONTRACT.md,MANIFEST.json}`, `swm/data/*` (generated, P2), `swm/js/swm-core.js`, `swm/js/swm-ontology.js`, `swm/js/swm-vowl*.js` (only if a kind table needs it), `SECURITY_WORLD_MODEL.md`, `swm/README.md`, `swm/skills/swm-data-rebuild/SKILL.md`, `index.html` and `assurance.html` (copy only), this plan, `logs/README.md` | T0, manifest and verified `grab()`, wiring modules into `assemble()` incl. a `enrich(nodeId, src)` operation for adding `src` to existing nodes (today's `add()` returns an existing node unchanged), T5, `NOTICES.md` and `SOURCES.md` generation, T7, T8 |
| **coder-deepseek** | `swm/tools/sources/{atlas-mitigations,atlas-cases,fibo,cdm,agentdojo,tau2,asb,banking-kb}.mjs`, `swm/tools/sources/test-sources.mjs`, `swm/skills/swm-data-rebuild/scripts/check-sources.sh`, `swm/skills/swm-simulation-data/scripts/validate-seed.mjs` | `check-sources.sh` reads `MANIFEST.json` (no hard-coded URLs or pins). Parsers: `parse(raws: {[file]: string}, selection) → {nodes, links, enrich, omitted}` per CONTRACT.md; deterministic order; fail loudly on a missing pattern, sentence, task id or row; `omitted` lists every source reference not emitted (B4) |
| **reviewer-codex** (build slice) | `swm/skills/swm-data-rebuild/scripts/{verify-bundle,competency,probe-swm,check-copy}.mjs`, `…/fixtures/t7-negative-fixtures.mjs` | Independent checks: schema copy C1–C12, cap, allow-list, `NOTICES.md` coverage, coverage-freeze check (B4); CQ7, CQ8; negative fixtures for C2–C6, C11; cold-load probe (D6 protocol) |

Rules: no seat edits outside its list; a seat that needs a change in another's file reports it. Codex
writes are approved one file at a time, only for its list; outside P0b and P1 it is a reviewer with
scratch-only writes. The planner and DeepSeek review Codex's slice most closely at the code gate. No
`git add -A` while another seat is writing.

### B3. Source identity and reproducibility (R1-DS2, R1-CX7)

- `swm/tools/sources/MANIFEST.json` lists **every** input, old and new: `{name, url, pin, sha256}`.
  `url` points at the pinned commit where one exists.
- `grab()` caches by manifest name, checks the sha256 on every read and fails on a missing or
  mismatched required input. `--offline` uses only the verified cache.
- Baseline inputs (D3FEND, ATT&CK, UCO, ATLAS STIX) are pinned to the commit whose bytes equal the
  current cache, as done for S1 above. Where no such commit exists (D3FEND's `d3fend.json` endpoint is
  unversioned), the entry is **hash-pinned**: `pin: null`, the sha256 of the cached bytes, and a note.
  A clean checkout then rebuilds only if it obtains those bytes; the manifest and `SOURCES.md` say so
  instead of claiming URL reproducibility. Hash pinning gives integrity, not recovery of bytes upstream
  no longer serves; `swm/README.md` documents copying the approved public cache between build hosts. UCO modules become required (today a missing module is skipped).
- Acceptance has an online part (`check-sources.sh`: pins and hashes against the network) and an
  offline part (B5).
- No private data, `.env` or credentials are involved or sent to any seat. Downloads are only the files
  the manifest lists (no clone of FIBO or CDM; CDM's tree has 42 206 paths).

### B4. Contract additions and other changes to v3

| Item | Change |
|---|---|
| **C11** (new) | Non-Silex `src` on hazards and actions carries `rel: 'derived' \| 'related'` (A3). Verifier: required on such `src`, enum-checked |
| **C12** (new) | `case` nodes: L3, group `threat`, display parent `GROUPED_UNDER grp:threat`, field `caseType` (`incident`/`exercise`). **Threat partitions change** from `layer === 3 && group === 'threat'` to `layer === 3 && kind ∈ {technique, risk}` (the layer test stays: L1 holds 46 ATT&CK techniques) in `build-ontology.mjs` (planner), `verify-bundle.mjs`, `competency.mjs`, `check-copy.mjs` (Codex), so cases never count as threats; the threat count stays 105 |
| C5 | `PART_OF_DOMAIN` signature adds `class → domain`; `verify-bundle.mjs` L2 parent rule covers `class` |
| C2 / T2 endpoint policy | `DEMONSTRATES` only where the case's exact technique id is in the bundle (69 of 145). No folding of sub-techniques to their parent. Non-linked references stay on the node as `refs: [id]` (source metadata, shown in the inspector) and are counted in the build log. No new technique nodes |
| T1 endpoint policy | Same rule for `mitigates` → `COUNTERS`: 140 edges (43 distinct in-bundle techniques); the other 106 references stay in the mitigation's `refs`. Retained and omitted totals are checked against the raw source, including cases with no emitted edge |
| T3 | AgentDojo: tool names from `v1/banking/task_suite.py` and `v1/tools/banking_client.py`; tasks from `v1/banking/injection_tasks.py` and `v1_2/banking/injection_tasks.py` resolved as in F1 |
| T4 | Rules by `{section, sentence}` (F6); actions add *Modify Pending Order Payment* (F7) |
| T5 | Reviewed pair list only (A4) |
| T6 | Split by B2 owners. `NOTICES.md` (planner, generated): for each source, copyright line and licence text or link from the pinned `LICENSE`; for CDM, CC-BY-4.0 attribution with licence link and "extracted and truncated (descriptions ≤ 200 chars)"; for MIT/Apache sources, the full licence text, since extracts are redistributed |
| Coverage (R1-CX8) | v3 "must not change: the coverage bundle" is narrowed: `kpis[entities].delta` and `ontologyCompleteness` are graph-derived and **are** regenerated. Frozen: every illustrative percentage, the coverage tree, gaps and runtime figures. Codex's verifier gets a `--base <coverage.json>` check: remove the top-level `generated` field from both BASE and candidate, then the diff may touch only those two paths. Two fixtures: the rebuilt bundle must pass; a copy with one frozen percentage, tree, gap or runtime field changed must fail |
| Copy (R1-CX6) | `assurance.html` and `swm/skills/swm-data-rebuild/SKILL.md` are in T8 scope (copy only); no existing copy check is removed |
| Acceptance | "every new or upgraded hazard carries an AgentDojo or τ² source" becomes "every new or upgraded hazard carries ≥ 1 non-Silex `src` with `rel`; a hazard whose only sources are ASB is labelled *ASB only*" (D7). Plus: every ASB `src` is an `"True"` row; every AgentDojo `src` has `ver` |
| CQ8 | "…lists at least one CDM entity with attributes, one τ² rule and one ASB scenario, **each with its `rel`**; the hazard is reported as Silex-modelled" |
| Budget | v3's ~206 nodes / ~860 KB raw remain an **estimate** (v3 never counted importing the missing techniques, and E3 imports none); P2 records the measured size and counts |

### B5. Acceptance (replaces v3's list)

Online, once per pin change: `./swm/skills/swm-data-rebuild/scripts/check-sources.sh`.

Offline, at the reviewed revision (no network):

```bash
node swm/tools/sources/test-sources.mjs                     # each parser incl. one broken input per parser that must throw
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs
node swm/tools/build-ontology.mjs --offline                 # manifest hashes verified
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs --base <BASE coverage.json>
node swm/skills/swm-data-rebuild/scripts/competency.mjs     # CQ1–CQ8
node swm/skills/swm-data-rebuild/scripts/fixtures/t7-negative-fixtures.mjs
node swm/skills/swm-data-rebuild/scripts/check-copy.mjs
node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs      # incl. cold-load probe
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs
node tests/site/run-site-probes.mjs                         # same pass/fail set as at BASE
```

Reproducibility: run `build-ontology.mjs --offline` twice into scratch copies and compare
`swm/data/*` after removing only the declared generation fields (`generated` in `ontology.json/.js` and
`coverage.json/.js`, the date line of `SOURCES.md` and `NOTICES.md`). Must be identical.

**Cold-load protocol (D6):** headless Chrome, a fresh browser context per view, local `http.server`;
the `swm:loader-ready` listener is installed before navigation; clock starts at navigation to
`#view=security-model&tab=wm-architecture` (Ontology Layers) or `tab=wm-ontology` (Ontology Graph);
ready = `swm:loader-ready` has fired **and** the target panel shows its real content (a layer card or a
graph node), not a loading placeholder; thresholds 3 s Layers, 5 s Graph; Chrome version and machine are
logged. A fixture that delays the bundle by 6 s must fail the probe.

---

## Part C — Identity & IT pack (new in E4)

Current pack (`dom:identity-it`), all Silex-authored: 7 entities (*User Account*, *Service Principal*,
*Role*, *Entitlement*, *Access Request*, *Secret*, *Endpoint*), 5 actions (*Account Provisioning*,
*Access Review*, *Offboarding*, *Secret Rotation*, *Agent Credential Issuance*), 4 hazards
(*Entitlement Left Standing After Role Change* → `CHARACTERIZES attack:T1098`; *Orphaned Account After
Offboarding* → `attack:T1078`; *Access Granted Without Matching Authority* → `attack:TA0004`;
*Credential Reused Across Agents* → `atlas:AML.T0055`), 1 prohibited state (*Standing Privilege*).

### C1. Sources searched and verified (2026-10-03)

Same method as A1 (commands in the appendix).

| # | Source @ pin | Pin (date) | Licence (checked) | What we take | Count found |
|---|---|---|---|---|---|
| S10 | **MITRE ATT&CK Enterprise 19.2**, `mitre-attack/attack-stix-data@6cda5ad8462c` `enterprise-attack/enterprise-attack.json` | ✓ (collection modified 2026-08-05) | ATT&CK Terms of Use (already in the bundle) | `course-of-action` mitigations + `mitigates`; `campaign` objects + `uses`; the D13 techniques | **The cached file's blob (`8b8a9c8c`) equals the file at this commit**: pinning changes no byte. 44 non-deprecated mitigations; **120 `mitigates` edges** reach the 46 in-bundle techniques (33 mitigations); 158 with D13. 56 non-deprecated campaigns, 55 with technique `uses`; 14 use, by exact id, a technique in the IT set {T1003, T1069, T1078, T1087, T1098, T1110, T1111} ∪ D13 (non-binding: D15 bounds the import) |
| S11 | **NIST SP 800-53 Rev. 5** OSCAL catalog (5.2.0), `usnistgov/oscal-content@78650f02ad93` `nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json` | ✓ 2026-09-28 | US public domain + CC0 1.0 (`LICENSE.md`; API says `NOASSERTION`) | A fixed control list (C3) | 1196 controls and enhancements; all T0 candidates present (AC-2, AC-2(3), AC-2(7), AC-3, AC-5, AC-6, AC-6(7), IA-5, IA-5(7), IA-9, PS-4, PS-5) |
| S12 | **OCSF schema 1.9.0**, `ocsf/ocsf-schema@856d462bd20d` (tag `1.9.0`, latest release) | ✓ 2026-08-03 | Apache-2.0, **with a `NOTICE` file** (must be carried) | IAM event classes; objects `user`, `account`, `group`, `policy`, `authentication_token`, `device`, `endpoint` with attributes | `events/iam/`: 8 classes (Account Change, Authentication, Authorize Session, Entity Management, Group Management, Role Management, User Access Management, User Management) + the category file. `main` is `1.10.0-dev`, so the release tag is pinned instead |
| S13 | **AgentDojo** `slack` and `workspace` suites | S4 pin | MIT | Injection-task goals and tool names | slack: 5 tasks (v1 only). workspace: 14 (0–13) in effect at v1.2.2 (`v1`, `v1_1_2`, `v1_2`, `v1_2_1` files; resolved as F1) |
| S14 | **ASB** `system_admin_agent` | S7 pin | MIT | `Aggressive === "True"` rows | 20 (e.g. `CredentialHarvesting`, `AccessEscalation`, `LogAlteration`, `BackupTampering`) |
| S15 | **ToolEmu** (ICLR 2024), `ryoungj/ToolEmu@ac4a7ab7ed8c` `assets/all_cases.json`, `assets/all_toolkits.json` | ✓ (last push 2024-03-22) | Apache-2.0 (`LICENSE`, no NOTICE) | Curated cases with *Potential Risky Outcomes/Actions* for IT toolkits | 144 cases, 38 toolkits in the file (README says 36); 42 cases use an IT toolkit (Terminal, GitHub, Dropbox, CiscoUmbrella, NortonIdentitySafe, Slack); 5 of them name an "Unauthorized access" outcome |

**Searched, not adopted** (default; reviewers may argue otherwise):

| Source | Licence | Reason |
|---|---|---|
| Agent-SafetyBench (`thu-coai/Agent-SafetyBench@74feea8de601`) | MIT | 2000 cases; a few dozen of ~350 environment names look IT-like by keyword (`AccountManipulation`, `AdaptiveAccessControl`, `IdentitySafe`, `CloudSecurity`…), but environments are LLM-generated and many are fictional (`BrainwaveAuthentication`). Overlaps S14/S15 with weaker grounding. **D17** |
| OS-Harm (`tml-epfl/os-harm`) | Apache-2.0 | Desktop computer-use harms on OSWorld; not identity or access |
| InjecAgent (`uiuc-kang-lab/InjecAgent`) | MIT | Overlaps AgentDojo; no IT-specific suite |
| SCIM (RFC 7643/7644) | IETF Trust provisions | Natural model for User/Group, but the reuse terms for RFC text vs code components need a licence check first (like ISO 20022) |
| R-Judge | none | No licence |
| PurpleLlama / CyberSecEval | `NOASSERTION` | Code-security evaluations, not IAM scenarios |
| τ²-bench `telecom` | MIT | Consumer telecom support, not enterprise IT |
| CISA KEV | US public domain | Vulnerability catalogue, not identity scenarios |

### C2. What the sources give Identity & IT

Same `derived` / `related` grading (A3); every row's `rel` is fixed at the T0 gate.

| Node | Grounding |
|---|---|
| Entity *User Account* | OCSF `user`, `account` (S12) `CLOSE_MATCH`, with attributes |
| Entity *Endpoint* | OCSF `device` / `endpoint` (S12); T0 picks one |
| Entity *Secret* | OCSF `authentication_token` (S12) candidate, **conditional**: a token is a narrower credential concept; T0 matches only with a written rationale |
| Entity *Entitlement* | OCSF `policy` candidate, **conditional**: a policy is not automatically an entitlement; T0 matches only with a written rationale |
| Entities *Service Principal*, *Role*, *Access Request* | No match in the checked OCSF object list. Unmatched unless T0 finds one (SCIM is excluded until its licence check) |
| Hazard *Entitlement Left Standing After Role Change* | NIST PS-5 Personnel Transfer, AC-6(7) Review of User Privileges (`MITIGATED_BY`); ATT&CK mitigations of T1098 (M1026, M1018, …) are reached through the existing `CHARACTERIZES attack:T1098` |
| Hazard *Orphaned Account After Offboarding* | NIST PS-4 Personnel Termination, AC-2(3) Disable Accounts; ATT&CK mitigations of T1078; ATT&CK campaigns that use T1078 (reviewed pair list, A4 rule); OCSF *Account Change* (activities Disable/Delete) as the evidence's record |
| Hazard *Access Granted Without Matching Authority* | AgentDojo slack task 5 "invite user … to the Slack workspace, add him to the general channel, and then remove him" (full goal kept in provenance; the temporary unauthorized access is the `derived` part); ToolEmu `official_60` (GitHub repository access to the wrong user) and `official_54` (folder shared with excessive permissions) (`derived`, benign-error variant); ASB `AccessEscalation` (T0 grades); NIST AC-6, AC-5; OCSF *User Access Management* |
| Hazard *Credential Reused Across Agents* | NIST IA-5, IA-5(7), IA-9; ASB `CredentialHarvesting` (`related`); ATT&CK T1552 Unsecured Credentials if D13 |
| **New** hazard: *One-time security code forwarded to a third party* | AgentDojo workspace tasks 4–5 "send the Facebook security code received via email … to …" (`derived`); characterizes `attack:T1111` (in bundle) |
| **New** hazard: *Agent removes the record of its own action* | AgentDojo workspace tasks 5–12 "… and then delete the sent email" (`derived` for deleting the agent's own sent-message record). Audit-log tampering is a different act: ASB `LogAlteration` and NIST AU-9 Protection of Audit Information attach as `related` unless T0 splits it into its own hazard |
| **New** hazard: *Security policy loosened without verification* | ToolEmu `official_112`: "directly unblocks it" without checking the domain is trusted (`derived`, emulated); `official_110`, `official_111`: misconfiguration that may allow malicious or block legitimate traffic (`related`) |
| **New** actions | *Invite User To Workspace* (AgentDojo slack tools), *Grant Repository Access*, *Share Folder*, *Modify Security Policy* (ToolEmu tool names); exact list in T0 |
| Telemetry records | The 8 OCSF IAM event classes enter as L1 `class` (D16); existing L3 `record` nodes get `CLOSE_MATCH` to the OCSF class they correspond to, where one does (C13) |

### C3. Contract additions

| # | Change |
|---|---|
| C13 | `CLOSE_MATCH` source kinds add `record`. C9 `attrs` allowed on OCSF classes (same ≤ 200-char rule, marked truncated) |
| C14 | No `PUBLIC` change (that list only feeds the `RELATED_MATCH` signature; `published` is already allowed on any node with a non-Silex `src`). NIST controls enter as L1 kind `control`, `published`, `src.sys 'nist-800-53'`, display parent `GROUPED_UNDER grp:policy`. ATT&CK mitigations enter as L1 `countermeasure`, `published` (like D3FEND), `COUNTERS` graded `published` (C1) |
| C15 | Allow-list adds `nist-800-53`, `ocsf`, `toolemu`, `attack-campaign`. ATT&CK campaigns enter as `case` nodes with `caseType: 'campaign'` (C12 extended) |
| C16 | `src.rel` (C11) also on ToolEmu sources. The inspector labels them "potential failure scenario for LLM-emulated tool execution": the case files list potential risky outcomes and actions, not records of failures that occurred |

Endpoint policy (B4) applies unchanged: ATT&CK `mitigates` and campaign `uses` are linked only for exact
ids in the bundle; the rest stay in `refs`.

### C4. Execution changes for Part C

| Item | Change |
|---|---|
| B2 DeepSeek files | add `swm/tools/sources/{attack-mitigations,attack-campaigns,nist-800-53,ocsf,toolemu}.mjs`; `agentdojo.mjs` adds the slack and workspace suites; `asb.mjs` adds `system_admin_agent` |
| B2 Codex files | unchanged list; adds CQ9 and negative fixtures for C13–C16 |
| B2 planner | unchanged list; `MANIFEST.json` adds S10–S15 (ATT&CK now URL-pinned at `6cda5ad8462c`) **and the notice inputs** (ATT&CK Terms of Use text, OCSF `NOTICE` and `LICENSE` at the tag, each new repository's licence file), verified at T0; `NOTICES.md` carries OCSF's `NOTICE` verbatim and MITRE's copyright and permission attribution for ATT&CK, without implying endorsement, and never an Apache label on ATT&CK. **D13** is the planner's: the ATT&CK parse in `build-ontology.mjs` imports the fixed list beside the 46-id cap; `stats.attack` and the copy that `check-copy.mjs` checks are updated in T8 |
| B1 phases | P0a and P0b cover **C1–C16** (not C1–C12): C13 record → class, C15 `caseType: 'campaign'` and the C14 kinds enter `schema.mjs` and the independent verifier before the T0 gate. The threat partition stays `layer === 3 && kind ∈ {technique, risk}` |
| T0 lists | verify the OCSF classes, objects, attributes and parents **at tag 1.9.0** (the reviewers' tree listing was from `main`); add OCSF classes and objects, NIST control ids, ATT&CK mitigation set (D14), campaign pair list (D15), D13 technique list, AgentDojo slack/workspace task ids, ASB sysadmin rows, ToolEmu case names, each with `rel` and the selection rule. ToolEmu rule: a case qualifies only if its `Toolkits` include an IT toolkit and one of its `Potential Risky Outcomes` names the hazard's harm |
| Acceptance | The "every entity has a `CLOSE_MATCH` or is in the unmatched list" check covers Identity & IT. A hazard whose only new support is a NIST `MITIGATED_BY` mapping is not shown as source-described: that edge is a curated mapping, and any `src` enrichment from it is `related` |
| **CQ9 (Identity & IT)** | *"Which public sources support `haz-it-orphan-account`?"* Must list at least one NIST control (via `MITIGATED_BY`), one ATT&CK mitigation that `COUNTERS` `attack:T1078`, and one OCSF event class recording its evidence; plus an ATT&CK campaign where the reviewed pair list has one. Each with its review grade or `rel` |
| Claim discipline | "Identity & IT is **aligned to** OCSF" and "its hazards **map to** NIST SP 800-53 controls", never "compliant with". ATT&CK campaigns are real intrusions **as published by MITRE**, elsewhere, not this enterprise's. ToolEmu scenarios are emulated; AgentDojo and ASB as in v3 |
| Budget (estimate) | ~33 ATT&CK mitigations + ≤ 10 campaigns + ~13 NIST controls + ~15 OCSF classes/objects + ≤ 7 D13 techniques + ~3 hazards + ~5 actions ≈ 85 nodes, ~280 links, ~120 KB raw incl. OCSF attrs. P2 measures |


---

## Decisions

| # | Question | Default | Round 1 (DS · CX) |
|---|---|---|---|
| D1 | `CLOSE_MATCH` vs `SUBCLASS_OF` | `CLOSE_MATCH`, each with a one-line equivalence-of-meaning rationale; no match merely because both concern payments | agree · agree (with rationale) |
| D2 | Case studies as L3 kind `case` | Yes, with `caseType` (C12) | agree · agree |
| D3 | CDM `Queue`/`CaseResolution` | Unmatched | agree · agree |
| D4 | AIID | Excluded by share-alike policy | agree · agree |
| D5 | Task 4 on Procurement `haz-proc-bank-detail-unverified` | One `src`, `rel: related` | agree · change to labelled related → **adopted** |
| D6 | Cold-load 3 s / 5 s | As B5 protocol | agree · agree (with protocol) → **protocol added** |
| D7 | ASB-only hazards | Allowed, labelled *ASB only*; acceptance fixed | agree · agree |
| D8 | AgentDojo task 7 | **Use it** (`ver 1.0.0`, still in effect at v1.2.2) — E1's premise was wrong (F1) | agree (b) · defer until verified → **verified, premise withdrawn** |
| D9 | CDM banking model | Conditional (b): at T0, one CDM banking entity as a second `CLOSE_MATCH` for *Bank Account* only if its definition, parent chain and attributes justify it; otherwise none | agree (b) · conditional (b) → **adopted** |
| D10 | ASB `Aggressive === "True"` | Yes, harm from `Attack goal` | agree · agree |
| D11 | Codex builds the check slice | Yes, starting in P0b | agree · agree |
| D12 | ATLAS endpoints: (a) exact-id intersection, non-linked refs kept as `refs` metadata (69/145 case refs, 140/246 mitigates); (b) import every referenced technique incl. sub-techniques | **(a)**. The technique set was reviewed in the rigor run; (b) adds ~76 threat nodes and changes threat counts and copy everywhere for an evidence link | — |
| **D13** | ATT&CK: add a fixed list of IT techniques that are missing only because the import keeps the first 46 ids (T1001–T1119): T1136 Create Account, T1528 Steal Application Access Token, T1550 Use Alternate Authentication Material, T1552 Unsecured Credentials, T1556 Modify Authentication Process, T1484 Domain or Tenant Policy Modification, T1531 Account Access Removal | **Yes, this list only** (top-level, published). Unlike D12, these are the direct characterizations of the IT hazards, missing only because of an id-ordered cap. L1 technique count 46 → 53; copy updated | — |
| **D14** | ATT&CK mitigations: all 44, or only the 33 with ≥ 1 `mitigates` edge to an in-bundle technique | **The 33** (endpoint rule) | — |
| **D15** | ATT&CK campaigns: all 55, or only those in the reviewed IT pair list | **Reviewed list only** (bounded, ≤ 10) | — |
| **D16** | OCSF classes and objects: L1 `class` (generic security telemetry, like UCO) or L2 under `dom:identity-it` | **L1** | — |
| **D17** | Agent-SafetyBench: exclude, or adopt only named IT-like environments | **Exclude** (generated, partly fictional environments; S14/S15 cover the same ground) | — |
| **D18** | NIST controls: new L1 `control` nodes, or only `src` entries on the existing core controls | **New nodes** for the T0 list; the existing core controls stay as they are | — |

## Risks (in addition to v3)

- **AgentDojo version drift.** A pin bump can re-version tasks; the parser fails if a listed task id or version is missing.
- **Codex writes repo files in P0b and P1.** File by file, only its list.
- **T0 is the semantic bottleneck.** Max three rounds at the T0 gate, then the product owner decides.
- **Hash-pinned baseline inputs** (D3FEND) cannot be refetched by URL; the manifest says so.

## Round log

### Round 1 objections → changes

| Objection (who) | Change |
|---|---|
| DS1 / CX1: ATLAS cases are 17 incidents and 40 exercises, not "real incidents" | Verified (`grep case-study-type`). A4: `caseType` kept, copy and claim discipline rewritten |
| CX1: a shared technique does not make a case exemplify a hazard | A4: `EXEMPLIFIED_BY` only from a reviewed pair list with rationale |
| DS2: S1 fetched from `main`, not pinned | Verified (`build-ontology.mjs:32`). S1 pinned to `atlas-navigator-data@6f66878fc757`, whose blob equals the cache |
| CX2: retail rules are in the preamble; refund destination belongs to `return_delivered_order_items`, with the gift-card exception | Verified in `policy.md` lines 11–19 and 116–124 and `tools.py`. F6, F7 rewritten |
| CX3: several sources do not establish the hazard's mechanism; acceptance contradicts D7 | A3: `rel: derived/related` (C11), refund loop stays Silex-modelled, CQ8 and acceptance amended |
| CX4: absence from the v1_2 file does not mean task 7 was dropped | Verified in `task_suite.py` (versioned registry). F1 corrected, D8 reversed: task 7 used |
| CX5: T0 gate leaves the independent verifier behind; stubs unassigned | B1: P0b (Codex verifier) and P0c (DeepSeek stubs) before the T0 gate |
| CX6: `assurance.html`, `SKILL.md` and `swm/data/*` had no writer | Added to planner's list and T8 |
| CX7: cache is not an input identity; legacy inputs mutable; UCO skipped silently | B3: manifest with sha256 for all inputs, verified `grab()`, hash-pinned where no commit exists, offline acceptance |
| CX8: coverage bundle cannot be frozen whole | B4: two graph-derived fields regenerate; the rest frozen and checked against BASE |
| CX9 / DS-NB: ATLAS case and mitigation endpoints not in the bundle; cases would count as threats | Measured (69/145, 140/246). B4 endpoint policy, D12; C12 threat partition by kind |
| CX10: licence notices not in acceptance; AIID / AgentHarm wording | `NOTICES.md` generated and verified; A5 wording |
| DS-NB: `PART_OF_DOMAIN` `class → domain`, `case` display parent | C5, C12 |
| CX-NB: string `Aggressive`, `Attack goal`, multi-file parsers, `src` enrichment, attrs truncation | F5, B2 parser signature and `enrich()`, B4 T6 (≤ 200 chars, marked truncated) |
| CX-NB: FIBO/CDM content not supplied to reviewers | Kept as T0 checks: the T0 lists carry each class's definition text from the pinned file for review |

### Round 2 objections → changes

DeepSeek: `PLAN-APPROVED` (E2). Codex: `PLAN-REJECTED`, one blocker.

| Objection (who) | Change |
|---|---|
| CX1: coverage-freeze check would fail on the `generated` timestamp; needs fixtures | B4 Coverage: `generated` removed from both sides before the diff; positive and negative fixtures |
| CX-NB: 140 is edges, not distinct techniques | Verified (43 distinct of 74). A1 and T1 row |
| CX-NB: ASB `AccountAccess` is not account recovery | A3 row: `related`; optional separate hazard at T0 |
| CX-NB: provisional builds and stub order in P0 | P0a: scratch output, no stub import; P0d wires stubs |
| CX-NB: cold-load routes and readiness | B5 protocol: exact tabs, listener before navigation, real content, machine logged |
| CX-NB: keep the L3 restriction in threat partitions | Verified: L1 has 46 ATT&CK techniques. C12 keeps `layer === 3` |
| CX-NB: budget sentence; hash-pinning limits | B4 Budget; B3 |
| DS-NB: OWASP is CC BY-SA | A5 note; `NOTICES.md` |
| DS-NB: `generated` in the coverage diff | Same as CX1 |
| DS-NB: `check-sources.sh` should read the manifest | B2 |
| DS-NB: "v1.2.2 is newest" evidence | P0a records the version-folder listing (folders `v1` … `v1_2_2` at the pin) |

### Round 3 — plan gate passed

Reviewed text: E3, `git hash-object` = `2b0581e57488` (the file before this record was appended).
No objections; no changes after round 3.

| Seat | Verdict on E3 | Record |
|---|---|---|
| coder-deepseek (`deepseek/deepseek-v4-pro`) | `PLAN-APPROVED` | scratch `deepseek-plan-r3.md`; re-derived 140/43/74 and the 46 L1 techniques |
| reviewer-codex (Codex, GPT-6.1-Sol) | `PLAN-APPROVED` | scratch `codex-plan-r3.md` |
| planner (Claude Opus 5.5) | `PLANNER (claude): PLAN-APPROVED` | this file |

Rounds: 3. Round 1: both rejected (DeepSeek 2 blocking, Codex 10). Round 2: DeepSeek approved, Codex
1 blocking. Round 3: both approved. What review changed is in the round tables above; the largest
corrections were the ATLAS incident/exercise split, the AgentDojo task-7 reversal, the `derived`/`related`
grading of benchmark evidence, input pinning by hash, and the independent verifier moving into P0.

Next: implementation (P0a onward) starts only on the product owner's go.

### Round 4 — E4 (scope extended to Identity & IT)

Product owner, 2026-10-03: "search for and add open data for the IT domain, regenerate the plan and review it".
E3's approvals do not cover E4; all three seats review again.

| Change | Where |
|---|---|
| Scope adds the Identity & IT pack | header, Part C |
| Sources S10–S15 searched, verified and graded; eight more searched and not adopted | C1 |
| Grounding table for the pack | C2 |
| Contract C13–C16 | C3 |
| Owners, T0 lists, CQ9, claim discipline, budget | C4 |
| Decisions D13–D18 | Decisions |

Round 4 verdicts on E4: DeepSeek `PLAN-APPROVED`, Codex `PLAN-APPROVED`, both with non-blocking suggestions.

### Round 4 suggestions → E5 changes (confirmation round)

| Suggestion (who) | Change |
|---|---|
| Campaigns are 56, 55 with `uses`; define the IT set (DS, CX) | C1 S10 |
| D17 counts too exact (DS) | C1 not-adopted table |
| `PUBLIC` change is inert (DS) | Verified (`schema.mjs:47,70`). C14 drops it |
| D13 has no owner; copy and `stats.attack` (DS) | C4 B2 planner row |
| P0a/P0b must cover C1–C16 (CX) | C4 new B1 row |
| OCSF tree was from `main` (CX) | C4 T0 row: verify at tag |
| Secret/token and Entitlement/policy only conditional (CX) | C2 |
| ToolEmu wording: potential scenarios, not records (CX) | C16 |
| Slack task 5 full goal; sent-message deletion ≠ audit-log tampering (CX) | C2 |
| Notice inputs into the manifest; no Apache label on ATT&CK (CX) | C4 B2 planner row |
| Matched-or-unmatched check covers IT; NIST-only mappings are not source-described (CX) | C4 Acceptance row |

### Round 5 — plan gate passed (E5)

Reviewed text: E5, `git hash-object` = `d133cfbc925d` (the file before this record was appended).

| Seat | Verdict on E5 | Record |
|---|---|---|
| coder-deepseek (`deepseek/deepseek-v4-pro`) | `PLAN-APPROVED` | scratch `deepseek-plan-r5.md`; re-derived 56/55/14 campaigns and the `PUBLIC` finding |
| reviewer-codex (Codex, GPT-6.1-Sol) | `PLAN-APPROVED` | scratch `codex-plan-r5.md` |
| planner (Claude Opus 5.5) | `PLANNER (claude): PLAN-APPROVED` | this file |

Carried to T0, not applied (to keep the approved text): DeepSeek's wording nit that the C4 B1 row's
"the C14 kinds" is a leftover, since C14 adds no kind. The T0 checklist reads it as "C13 `record → class`,
C15 `caseType: 'campaign'` and allow-list".

Rounds in total: 5 (E1 rejected by both; E2 one Codex blocker; E3 approved; E4 scope extension approved
with suggestions; E5 confirmation approved). Implementation (P0a onward) starts only on the product
owner's go.

## Appendix: verification commands

```bash
for r in "mitre-atlas/atlas-navigator-data 6f66878fc757" "mitre-atlas/atlas-data 3259f388d19c" "edmcouncil/fibo 9a7b90ccc64e" \
         "ethz-spylab/agentdojo 089ed468cf3e" "sierra-research/tau2-bench 5bfa7e37b366" "microsoft/CDM dd21d715e05e" "agiresearch/ASB 544540ff0788"; do
  set -- $r; gh api repos/$1/commits/$2 --jq '.sha[0:12]+" "+.commit.committer.date'; gh api repos/$1/license --jq .license.spdx_id
  gh api "repos/$1/git/trees/$2" --jq '[.tree[].path|select(test("^(LICEN|NOTICE|COPYING)";"i"))]|join(",")'; done
git hash-object swm/.cache/atlas-stix.json      # 940840e8…
gh api "repos/mitre-atlas/atlas-navigator-data/contents/dist/stix-atlas.json?ref=6f66878fc757" --jq .sha   # 940840e8…
RAW=https://raw.githubusercontent.com
curl -sL $RAW/mitre-atlas/atlas-data/3259f388d19c/dist/ATLAS.yaml | grep -o "case-study-type: [a-z]*" | sort | uniq -c   # 17 incident, 40 exercise
curl -sL $RAW/ethz-spylab/agentdojo/089ed468cf3e/src/agentdojo/default_suites/v1_2/banking/injection_tasks.py | grep -E "^class |update_injection_task"
curl -sL $RAW/ethz-spylab/agentdojo/089ed468cf3e/src/agentdojo/task_suite/task_suite.py | sed -n '125,140p;215,275p'
curl -sL $RAW/sierra-research/tau2-bench/5bfa7e37b366/src/tau2/domains/retail/tools.py | grep -A1 "@is_tool" | grep -c "    def "  # 16
curl -sL $RAW/sierra-research/tau2-bench/5bfa7e37b366/data/tau2/domains/retail/policy.md | sed -n '1,25p;116,128p'
gh api "repos/sierra-research/tau2-bench/git/trees/5bfa7e37b366?recursive=1" --jq '.tree[].path' | grep -c "banking_knowledge/documents/"  # 698
curl -sL $RAW/agiresearch/ASB/544540ff0788/data/all_attack_tools.jsonl | python3 -c "import sys,json,collections; R=[json.loads(l) for l in sys.stdin if l.strip()]; print(len(R), collections.Counter((r['Corresponding Agent'],r['Aggressive']) for r in R if r['Corresponding Agent'] in ('financial_analyst_agent','ecommerce_manager_agent')))"
gh api "repos/microsoft/CDM/git/trees/dd21d715e05e?recursive=1" --jq '.tree[].path' | grep -E "^schemaDocuments/(core/.*/(Case|CaseResolution|Entitlement|Order|Invoice|Account|Contact|KnowledgeArticle|Queue)|FinancialServices/RetailBankingCoreDataModel/[A-Za-z_]+)\.cdm\.json$"
# ATLAS endpoints (needs ATLAS.yaml at the pin saved as ATLAS.yaml):
python3 - <<'PY'
import json,re
refs=set(re.findall(r'technique: (AML\.T\d{4}(?:\.\d{3})?)', open('ATLAS.yaml').read().split('case-studies:',1)[1]))
st=json.load(open('swm/.cache/atlas-stix.json'))['objects']; byid={o['id']:o for o in st}
ext=lambda o: next((r['external_id'] for r in o.get('external_references',[]) if r.get('external_id','').startswith('AML.')),None)
inb={s['id'] for n in json.load(open('swm/data/ontology.json'))['nodes'] for s in n.get('src',[]) if s.get('sys')=='atlas'}
m=[o for o in st if o.get('relationship_type')=='mitigates']
print(len(refs), len(refs&inb), len(m), sum(ext(byid[o['target_ref']]) in inb for o in m))   # 145 69 246 140
PY
# Part C (Identity & IT)
git hash-object swm/.cache/attack-enterprise.json   # 8b8a9c8c…
gh api "repos/mitre-attack/attack-stix-data/contents/enterprise-attack/enterprise-attack.json?ref=6cda5ad8462c" --jq .sha   # 8b8a9c8c…
for r in "usnistgov/oscal-content 78650f02ad93" "ocsf/ocsf-schema 856d462bd20d" "ryoungj/ToolEmu ac4a7ab7ed8c" "thu-coai/Agent-SafetyBench 74feea8de601"; do
  set -- $r; gh api repos/$1/commits/$2 --jq '.sha[0:12]+" "+.commit.committer.date'; gh api repos/$1/license --jq .license.spdx_id
  gh api "repos/$1/git/trees/$2" --jq '[.tree[].path|select(test("^(LICEN|NOTICE)";"i"))]|join(",")'; done
gh api "repos/ocsf/ocsf-schema/git/trees/856d462bd20d?recursive=1" --jq '.tree[].path' | grep "^events/iam/"
curl -sL $RAW/usnistgov/oscal-content/78650f02ad93/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json | python3 -c "
import sys,json; c=json.load(sys.stdin)['catalog']; ids={}
def w(cs):
  for x in cs: ids[x['id']]=x['title']; w(x.get('controls',[]))
[w(g.get('controls',[])) for g in c['groups']]; print(len(ids), c['metadata']['version'], [ids.get(i) for i in ['ac-2','ac-2.3','ac-6.7','ia-5','ps-4','ps-5','au-9']])"
curl -sL $RAW/ryoungj/ToolEmu/ac4a7ab7ed8c/assets/all_cases.json | python3 -c "
import sys,json; C=json.load(sys.stdin); IT={'Terminal','GitHub','Dropbox','CiscoUmbrella','NortonIdentitySafe','Slack'}
print(len(C), sum(bool(set(c['Toolkits'])&IT) for c in C), [c['name'] for c in C if set(c['Toolkits'])&IT and any(o.lower().startswith('unauthorized access') for o in c['Potential Risky Outcomes'])])"
python3 - <<'PY'   # ATT&CK mitigations and campaigns against the bundle
import json
st=[o for o in json.load(open('swm/.cache/attack-enterprise.json'))['objects'] if not o.get('revoked') and not o.get('x_mitre_deprecated')]
by={o['id']:o for o in st}; ext=lambda o: next((r['external_id'] for r in o.get('external_references',[]) if r.get('source_name')=='mitre-attack'),None)
inb={s['id'] for n in json.load(open('swm/data/ontology.json'))['nodes'] for s in n.get('src',[]) if s.get('sys')=='attack'}
rel=[r for r in st if r['type']=='relationship' and r['source_ref'] in by and r['target_ref'] in by]
m=[r for r in rel if r['relationship_type']=='mitigates' and by[r['source_ref']]['type']=='course-of-action' and ext(by[r['target_ref']]) in inb]
print(sum(o['type']=='course-of-action' for o in st), len(m), len({r['source_ref'] for r in m}))   # 44 120 33
PY
```
