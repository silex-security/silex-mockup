# Security World Model skills

Two agent skills that carry the operational knowledge for the data behind the Security World Model
panels. They are written to be run by Claude Code on a host that has never seen this repo, but each
`SKILL.md` also reads as a plain runbook for a person.

| Skill | Use it when |
|---|---|
| [`swm-data-rebuild`](swm-data-rebuild/SKILL.md) | rebuilding `swm/data/*` from the public ontologies, a source URL moved, a build failed, or a bundle needs verifying before a commit |
| [`swm-simulation-data`](swm-simulation-data/SKILL.md) | changing the invented content — domains, capabilities, workflows, agentic components, the runtime graph, coverage numbers, gaps — or re-skinning the demo for another industry |

## Making them discoverable

Claude Code loads skills from `.claude/skills/` in the project, or `~/.claude/skills/` for the user.
This repo keeps them next to the code they describe, so link them once per host:

```bash
# project-level (recommended: travels with the checkout)
mkdir -p .claude/skills
ln -s ../../swm/skills/swm-data-rebuild    .claude/skills/swm-data-rebuild
ln -s ../../swm/skills/swm-simulation-data .claude/skills/swm-simulation-data

# or user-level, available in every project on this host
ln -s "$PWD/swm/skills/swm-data-rebuild"    ~/.claude/skills/swm-data-rebuild
ln -s "$PWD/swm/skills/swm-simulation-data" ~/.claude/skills/swm-simulation-data
```

Copy instead of linking if the host does not follow symlinks; then re-copy after pulling. Start a new
session afterwards — skills are read at session start. Without linking, nothing is lost: point an
agent at `swm/skills/<name>/SKILL.md`, or follow it yourself.

## The scripts, without the skills

Every script is standalone, dependency-free and safe to run from the repository root:

```bash
./swm/skills/swm-data-rebuild/scripts/check-sources.sh            # are the nine upstreams reachable
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs     # is the invented content consistent
node swm/tools/build-ontology.mjs [--offline]                     # build the bundles
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs        # is the built bundle sound
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs [dir] # headless screenshots of all three panels
```

`validate-seed.mjs` takes an optional path, so a candidate seed can be checked before it replaces the
real one. All four exit non-zero on failure, which makes them usable in CI.
