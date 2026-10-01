#!/usr/bin/env bash
# Probe every upstream the Security World Model bundle is built from.
# Exit 0 when all reachable, 1 otherwise. Run before a rebuild on a new host.
set -uo pipefail

SOURCES=(
  "D3FEND|https://d3fend.mitre.org/ontologies/d3fend.json"
  "ATLAS|https://raw.githubusercontent.com/mitre-atlas/atlas-navigator-data/main/dist/stix-atlas.json"
  "ATT&CK|https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json"
)
for m in core action identity observable tool pattern; do
  SOURCES+=("UCO/$m|https://raw.githubusercontent.com/ucoProject/UCO/master/ontology/uco/$m/$m.ttl")
done

fail=0
printf "%-12s %-8s %-10s %s\n" "SOURCE" "STATUS" "SIZE" "URL"
for entry in "${SOURCES[@]}"; do
  name="${entry%%|*}"; url="${entry#*|}"
  headers=$(curl -sIL --max-time 30 "$url" 2>/dev/null)
  code=$(printf '%s' "$headers" | awk '/^HTTP/{c=$2} END{print c}')
  len=$(printf '%s' "$headers" | awk 'BEGIN{IGNORECASE=1} /^content-length:/{l=$2} END{print l}' | tr -d '\r')
  if [ -n "$len" ]; then size=$(( len / 1024 ))KB; else size="-"; fi
  [ "$code" = "200" ] || { fail=1; code="${code:-ERR}"; }
  printf "%-12s %-8s %-10s %s\n" "$name" "$code" "$size" "$url"
done

if [ "$fail" -ne 0 ]; then
  echo
  echo "At least one source is unreachable. Options:"
  echo "  - rebuild from the cache:  node swm/tools/build-ontology.mjs --offline"
  echo "  - find the new URL and update SOURCES in swm/tools/build-ontology.mjs"
  echo "  - see references/troubleshooting.md in this skill"
fi
exit $fail
