# GitHub tidy follow-ups: `demo/assurance-vv`, Dependabot fix PRs, docs links

**User request (2026-10-31):** "1. demo/assurance-vv 有 2 个没合并的 commit, 分析一下是否对 main 有用，如果有用可以合并。 2. 可以打开 dependabot 自动修复 PR 3. README 指向新的站点。" (Analyse whether the branch helps `main` and merge it if so; turn on Dependabot fix PRs; point the README at the new site.)

**Plan version:** v0.2
**Roster:** standard. Planner: Claude Code (claude-opus-5-5). coder-deepseek: OpenCode, `deepseek/deepseek-flash`. Third judge: reviewer-codex (Codex CLI). Orca.
**Scratch:** `$SCRATCH`, outside the repo; its machine path is not committed.
**Branch:** `readme-new-site` from `origin/main` = `63178e984ef6e22ddfca4f40802159c52c886c1e`.

## 1. `demo/assurance-vv`: analysis and decision (do not merge)

Head `a807fc058f97c699f5e2e84f863fce391ed7a340`, merge base `fe51c44` (2026-10-01). Computed with `git diff --name-status origin/main...origin/demo/assurance-vv` and `git ls-tree`:

| Part | Files | What it is |
|---|---|---|
| `demo/assurance-vv/site/baseline/` | 300 files, 67,564 added lines | a frozen copy of the whole site at `fe51c44` plus a 17-file Runtime Observation delta through `74ed19a` (branch README). `main` has carried the same files forward since, with three more weeks of work |
| `demo/assurance-vv/site/prototype/` | 7 files, 61,044 bytes | a review-demo wrapper (Assurance → Blueprint Studio intake → Pre-release → Runtime Observation). Its modules import from `../baseline/…` (e.g. `intake-model.js` imports `../baseline/blueprint_studio/js/io.js`), so it runs only against the frozen copy |
| `demo/assurance-vv/site/` root, `tests/`, `README.md`, `site.sha256.json` | 7 | three site-root files (entry page, `_headers`, `404.html`), two tests, the README and a SHA-256 manifest of the snapshot. Totals: 314 files under `demo/assurance-vv/` plus 3 skill files = 317 |
| `skills/silex-cloudflare-sync/` | 3 | a script that uploads `demo/assurance-vv/site/` to the Cloudflare Pages project `opensilex-demo`, label `review` |

Why it does not help `main`:
- Since `5885094` (2026-10-07) the deploy workflow publishes `main` itself to that same project and label (`.github/workflows/deploy-demo.yml`). The sync skill on `main` would be a second deploy path to one target, and running it would replace the live site with the 2026-10-01 snapshot.
- The baseline is a stale duplicate; merging adds 67k lines that the tests and tools of `main` do not cover, and that drift from the files they copy.
- The prototype is not portable as is: it is bound to the baseline's file layout. Its themes already exist on `main` in their later form: the Pre-release view (`index.html:543`, `index.html:1076`), the embedded Blueprint Studio (cutover 2026-09-24), Runtime Observation with the NEAR-MISS/KEEP/DISCARD history.

**Decision:** do not merge as a branch; leave it on GitHub untouched as the record of that review demo. One idea in it is not on `main`: the prototype's Blueprint intake, which lists unmapped entities and proposed relations as visible gaps. Porting that onto `main`'s current files would be its own planned change, offered to the user as a follow-up.

## 2. Dependabot security updates (done before this plan; settings only)

Turned on through the REST API on 2026-10-31: `PUT repos/silex-security/silex-mockup/vulnerability-alerts` and `PUT .../automated-security-fixes`. Read back: `automated-security-fixes` → `{"enabled":true,"paused":false}`; `security_and_analysis.dependabot_security_updates` → `enabled`. No file changes. The user asked for it directly; it is reversible from the same endpoint (`DELETE`).

## 3. Docs point at the new site

Every `silex-mockup.vercel.app` reference outside `logs/` (`git grep -n vercel -- ':!logs'`):

| File:line | Kind | Plan |
|---|---|---|
| `README.md:5` | "Live at" link | change to `https://demo.opensilex.ai/` |
| `SECURITY_WORLD_MODEL.md:5` | "live at" link | change to `https://demo.opensilex.ai/` |
| `docs/jev-runtime-guide/README.md:161` | live address with `#view=runtime-observation` | change to `https://demo.opensilex.ai/#view=runtime-observation` (returns 200) |
| `blueprint_studio/web/src/App.jsx:92` and its built bundle `blueprint_studio/app/assets/index-jyIW_U9_.js` | the studio's brand link (hidden when embedded) | left: changing it changes a shipped file (`app/` must match a fresh build, `npm run check`) and needs the studio's own build and review; a follow-up decision, not an omission |
| `tests/site/run-site-probes.mjs:4` | comment describing a `--base` option | left on purpose: a test tool's example, and both hosts still serve the current build; on the follow-up list with the studio link |

`logs/` stays as written: dated records of where things were deployed then.

## Tasks

| # | Owner | Depends on | Change | Files | Acceptance |
|---|---|---|---|---|---|
| 1 | planner | — | The three link changes above, nothing else (one owner: three one-line edits) | `README.md`, `SECURITY_WORLD_MODEL.md`, `docs/jev-runtime-guide/README.md` | `git grep -n 'silex-mockup.vercel.app' -- README.md SECURITY_WORLD_MODEL.md docs/` prints nothing; `git diff --stat` shows 3 files, 1 line each; `node --test tests/site/no-real-brand.test.mjs` passes |
| 2 | planner | code gate | Change-log entry (this plan's outcome) and push | `logs/README.md`, this plan | push guard: `origin/main` equals the base and is an ancestor of the reviewed commit; normal non-force push; the deploy run for that SHA has `Verify live content` executed and passing |

coder-deepseek and reviewer-codex review this plan, including the section-1 decision, and the diff.

## Review record

### Round-1 objections → changes

| Objection (who) | Change |
|---|---|
| 1. The "internal account identifier" bullet invents a rule violation: the same identifier is already on `main` in the deploy workflow, and it is not a secret (deepseek) | Bullet deleted. The reasons not to merge are the second deploy path to one target and the stale 300-file copy |
| Non-blocking (deepseek), folded in | Third table row gives the seven files and the 317 total; the decision names the intake gap list as the one idea `main` lacks; the two left-alone items say why |
| Not taken: rename the branch to `docs-site-links` (deepseek) | The branch is local and never pushed; the push goes straight to `main` |
| reviewer-codex round 1: no verdict | Codex stopped on its usage limit before writing a reply (its pane shows the limit until 2026-11-03). Roster decision taken to the user |

**Roster change (user, 2026-10-31):** reviewer-codex hit its usage limit; the user chose Claude Fable 5.1 (`claude-fable-5-1`) as the third judge, reviewer-fable.

**Plan gate (v0.2):** coder-deepseek PLAN-APPROVED (round 2), reviewer-fable PLAN-APPROVED (round 2), PLANNER (claude): PLAN-APPROVED.

### Code review round 1 → changes

| Note (who) | Change |
|---|---|
| Both IMPL-APPROVED on `9007a2b`. The change-log entry was written before the gate (task 2 placed it after) so it is reviewed with the edits (deepseek, recorded) | Deviation noted here |
| "300 frozen files" is 283 identical plus a 17-file delta (fable, deepseek) | Entry says "carried to `74ed19a` (283 unchanged, 17 updated or added)" |
| Carry the Dependabot read-back; say why the branch `_headers` does not transfer (deepseek) | Both added to the entry |
| The plan file must ship with the entry it links (fable) | Committed together |
| Project README's plan index stops at 2026-10-07 (fable) | Not this change; noted as a later tidy |

**Code gate (diff revision `8bbb7a876afda5e123e197f8ffc8b46c33b0f98b`, base `63178e984ef6e22ddfca4f40802159c52c886c1e`):** coder-deepseek IMPL-APPROVED (round 2), reviewer-fable IMPL-APPROVED (round 2), PLANNER (claude): IMPL-APPROVED. Plan 2 rounds, code 2 rounds. Seats left open in the Orca tab; reviewer-codex left at its usage-limit prompt, untouched.
