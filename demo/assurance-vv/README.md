# Assurance / V&V demo

Live: https://demo.opensilex.ai/ · Pages: https://opensilex-demo.pages.dev/

This isolated demo lives on branch `demo/assurance-vv`. `site/` is the complete static upload directory. The repository root and GitHub main entry are unchanged. `site/baseline/` started from commit fe51c441218008db1e9a982bae299dc03167b14c and now includes the complete Runtime Observation delta through 74ed19a (vendored JEV be8fda2); the new UI is in `site/prototype/`.

## Experience

Assurance → Blueprint Studio (ontology-driven intake and existing V&V engine) → Pre-release → Runtime Observation. Enterprise World Model is in More. Admission V&V and runtime detection are both retained; runtime detection is Runtime Observation.

Intake reads typed Blueprint JSON into memory only. Unmapped entities and proposed local relation predicates are visible gaps. Running an imported document still requires importing the same file manually into Studio. The three stages show separately labelled simulated examples; they do not share a production agent or release artifact.

## Validation and review

Plan v1.4 and prototype received independent Codex and Claude APPROVE with no blocking issues. Local checks: 7 prototype tests, 12 browser checks and 65 existing baseline site/template tests passed. After Cloudflare deployment, all 12 browser checks passed again. Private meeting notes and reviewer prompts are not committed here.

Run `node --test tests/prototype.test.mjs` from this directory. Serve `site/` with a static HTTP server to preview.

## Sync from GitHub

Use the `silex-cloudflare-sync` skill at `skills/silex-cloudflare-sync/` in this repository. It fetches the latest committed remote branch into an isolated directory, checks `site.sha256.json`, runs tests, uploads only `site/` to the existing Pages project and verifies HTTPS/content. It never pushes to main or deploys the repository root.

After intentional site changes, regenerate `site.sha256.json` from all site files with SHA-256 and commit both together. The manifest records reviewed content; it is not a signature or a substitute for code review.

The skill is invoked on request; no background GitHub Actions job is configured. Cloudflare authentication uses the local Wrangler OAuth login. No credentials belong in this repository.

## Runtime design sync · 2026-10-01

Read the upstream `skills/jev-work-plan/SKILL.md` and the final r2/build resolutions in `logs/2026-10-01_LINEAGE_GATE_PLAN.md`. Synced all 17 changed mockup files through 74ed19a into site/baseline without altering vendored bytes. New demo wrapper reads the two measured gate verdicts from the same generated JSON. The interactive engine now presents NEAR-MISS → KEEP → DISCARD model history in AP and SOC; only KEEP promotes inside the toy comparison. Live judge and production promotion are unchanged.

Runtime sync verification: 10 prototype/lineage tests and 65 baseline tests pass; 15 browser checks pass. Codex and Claude independently APPROVE this sync with no blockers. The original prototype review remains historical. Browser regression runner: `QA_ORIGIN=https://demo.opensilex.ai node demo/assurance-vv/tests/runtime-browser.mjs` from a scratch working directory using its absolute script path if needed; it launches an isolated headless Chrome profile and writes screenshots locally.
