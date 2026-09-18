# Rebuild troubleshooting

Symptom → cause → what to do. Everything here was hit at least once while building the pipeline.

## Sources

### D3FEND returns 404 or HTML instead of JSON
`https://d3fend.mitre.org/ontologies/d3fend.json` is served from MITRE's site and has moved before.
Check the ontology downloads page at `https://d3fend.mitre.org/resources/ontology/`, then update
`SOURCES.d3fend.url` in `swm/tools/build-ontology.mjs`. The parser wants the **JSON-LD** form: an
object with an `@graph` array whose named classes have ids like `d3f:DigitalArtifact`. If only
Turtle or OWL/XML is offered, keep the cached copy (`swm/.cache/d3fend.json`) and rebuild with
`--offline` until a JSON-LD export is back; writing a Turtle parser is not worth it for a mockup.

### ATLAS: 404 on `stix-atlas.json`
The project publishes two repos. `mitre-atlas/atlas-navigator-data` carries `dist/stix-atlas.json`
(what we use); `mitre-atlas/atlas-data` carries `dist/ATLAS.yaml`. If the STIX file disappears, the
YAML is the fallback — but node has no YAML parser and this repo has no dependencies, so prefer
finding the STIX build over adding one. The parser only needs objects of type `x-mitre-tactic` and
`attack-pattern` with `external_references[].source_name === 'mitre-atlas'`.

### ATLAS techniques come back as 0
The technique filter drops sub-techniques with `t.id.split('.').length <= 2`, because ATLAS ids look
like `AML.T0051` (already containing a dot) and sub-techniques like `AML.T0051.000`. A filter written
as `!t.id.includes('.')` removes everything — that exact bug happened. Check the filter before
assuming the source changed.

### ATT&CK download is slow or times out
The Enterprise STIX bundle is ~53MB. It is fetched once and cached; subsequent builds read
`swm/.cache/attack-enterprise.json`. On a slow link, fetch it manually and drop it in the cache:

```bash
mkdir -p swm/.cache
curl -L -o swm/.cache/attack-enterprise.json \
  https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json
node swm/tools/build-ontology.mjs --offline
```

### UCO parses to 0 classes
The TTL files declare classes with the **module prefix**, not a `uco-` prefix: `core:Annotation`,
not `uco-core:Annotation`. The subject also sits alone on its line with `a owl:Class` on the next.
If UCO's serialisation changes, inspect a file before touching the regex:

```bash
grep -B2 -A8 "owl:Class" swm/.cache/uco-core.ttl | head -40
```

A module that 404s is skipped with a `skip uco/<module>` line and the build continues — losing one
module is not fatal, losing all six means the upstream layout moved.

## Environment

### `fetch is not defined`
node < 18. Upgrade node; the pipeline deliberately has no HTTP dependency.

### `This script needs node >= 22 (global WebSocket)`
Only `preview-panels.mjs` needs it. The build and both validators run on 18+.

### TLS or proxy failures behind a corporate network
`fetch` honours `NODE_EXTRA_CA_CERTS` and the standard proxy env vars via undici:

```bash
export NODE_EXTRA_CA_CERTS=/path/to/corp-root.pem
export HTTPS_PROXY=http://proxy.internal:8080
```

If egress is blocked entirely, copy `swm/.cache/` from a host that has it and use `--offline`.

### No Chrome for the preview
Set `CHROME=/path/to/chrome`, or skip step 5 and check in a normal browser. The screenshot script is
a convenience, not a gate.

## Build output

### `⚠ N chain violations` and a non-zero exit
A node's parent is more than one layer above it. The message names each offender as
`<id> (L<layer>) → <parent> (L<layer>) skips a layer`. This almost always follows a seed edit:
a runtime node whose `type` is not an L3 component, an OWASP entry pointing at a component that was
renamed, or a new component with no deployment. Run
`node swm/skills/swm-simulation-data/scripts/validate-seed.mjs` — it catches all three before the
build does, with a clearer message.

### Bundle grew past ~700KB
`verify-bundle.mjs` fails above 700KB. Lower the caps in `build-ontology.mjs` (`artifactCap`,
`techniqueCap`, the ATLAS/ATT&CK `cap`s, the UCO cap) rather than trimming fields — the inspector
needs `def`, `src` and `instances` on every node.

### Counts moved a lot since the last build
Expected: these are living ontologies. What matters is that the four layers are all non-empty, the
three hops are non-zero, and `verify-bundle.mjs` passes. If one source drops to 0, that source's
parser is broken, not the ontology.

### The page renders but every panel is empty
The bundles load as classic scripts that assign `window.SILEX_SWM_ONTOLOGY` / `window.SILEX_SWM_COVERAGE`.
Check the browser console for a 404 on `swm/data/ontology.js`, and check that the file still ends
with `window.SILEX_SWM_ONTOLOGY = {...};` — a truncated write (disk full) produces exactly this.
