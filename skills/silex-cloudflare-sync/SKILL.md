---
name: silex-cloudflare-sync
description: Sync the Silex website from GitHub branch demo/assurance-vv to the existing Cloudflare Pages project and verify demo.opensilex.ai. Use when asked to publish or synchronize this demo; supports a check-only mode.
---

# Silex Cloudflare Sync

Publish the committed GitHub demo, with no changes to the original main/Vercel entry.

## Deployment contract

- Repository: `https://github.com/silex-security/silex-mockup.git`
- Source branch: `demo/assurance-vv`
- Static assets: `demo/assurance-vv/site/`; manifest: `demo/assurance-vv/site.sha256.json`.
- Cloudflare account: `968ee54d6c8f891edbf8a82fabd6a427`; existing Pages project: `opensilex-demo`.
- Pages production branch label: `review`. This is a Cloudflare label, not GitHub main.
- URLs: `https://opensilex-demo.pages.dev/`, `https://demo.opensilex.ai/`.
- DNS remains at GoDaddy: CNAME `demo` → `opensilex-demo.pages.dev`.

## Execute

An explicit request to sync/publish this website authorizes deployment. If the task only requests a review or status, use `--check` or read-only checks. Do not infer publication authorization just because this skill is selected.

Run the bundled helper with an absolute path resolved from this skill directory:

```bash
python3 scripts/sync.py --check  # fetch committed branch, verify manifest, run tests; no upload
python3 scripts/sync.py          # same validation, deploy, verify both live origins
```

Prerequisites: Git with repository read access, Node/npm, Python 3, curl, and Cloudflare login. The script fetches into a temporary bare repository, so the user's checkout, uncommitted changes and other branches are never changed. It uploads only the static `site/` directory, not plans, meeting notes, review prompts, skills or credentials. It records the deployed commit at `~/.cache/silex-cloudflare-sync/last-deployment.json`.

If authentication is absent/expired, use `npx --yes wrangler@4.145.0 login --scopes account:read user:read pages:write` and let the user complete the browser login. Never print tokens or copy OAuth credentials to GitHub. Do not buy a plan or create another Pages project as a fallback. Pages already exists; do not use the project-creation `--force` flag for deployments.

## Changes and failures

Default sync deploys remote commits only. If the user also asks to change or upload local code, perform that work separately in an isolated checkout of `demo/assurance-vv`, run relevant tests, regenerate the manifest after intentional site edits, then commit and push that branch. Do not include unrelated working changes. Never auto-accept a failed manifest by regenerating it from the downloaded remote payload; report the mismatch and fix the intended source.

Keep source claims intact: admission V&V remains required; runtime detection is Runtime Observation; intake is a read-only ontology sidecar, not a production release approval. Source UI changes may need renewed review when requested; a byte-identical deployment does not require another review gate.

On fetch, test, hash or authentication failure, stop before deployment and report the specific blocker. On upload failure, inspect the concrete error before retrying; at most one corrected retry per invocation. After successful upload but failed live verification, say “uploaded, verification failed”, retain the deployment URL/commit, and investigate before another upload. Do not silently roll back or repeatedly deploy. The script retries public reads up to three times, not uploads.

Report the source commit, public URLs and validation results. Main must never be pushed, merged or force-updated by this workflow. Domain records, nameservers and the old Vercel project are outside routine sync scope.

This is an on-demand automation skill. It does not install a scheduler or GitHub Actions trigger. An unattended push-to-deploy pipeline is a separate request requiring an appropriately scoped Cloudflare credential stored as a GitHub secret, not this machine's OAuth token.
