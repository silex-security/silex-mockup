#!/usr/bin/env bash
# Probe every input the Security World Model bundle is built from.
# Reads swm/tools/sources/MANIFEST.json (no hard-coded URLs or pins).
#   check-sources.sh          -> reachability only (HEAD, falling back to a ranged GET)
#   check-sources.sh --full   -> also download each file and compare its sha256
# Exit 0 when all inputs are reachable (and, with --full, byte-identical to the pin).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/../../../tools/sources/MANIFEST.json"
FULL=0
[ "${1:-}" = "--full" ] && FULL=1

[ -f "$MANIFEST" ] || { echo "MANIFEST.json not found at $MANIFEST"; exit 1; }

entries="$(python3 - "$MANIFEST" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
for e in m.get('inputs', []):
    print(f"{e['name']}\t{e['url']}\t{e.get('sha256','')}")
PY
)"

fail=0
checked=0
printf "%-48s %-8s %s\n" "INPUT" "STATUS" "HASH/URL"
while IFS=$'\t' read -r name url sha; do
  [ -z "$name" ] && continue
  checked=$((checked + 1))
  code=$(curl -sIL --max-time 30 "$url" 2>/dev/null | awk '/^HTTP/{c=$2} END{print c}')
  if [ "$code" != "200" ]; then
    # some hosts reject HEAD; fall back to a ranged GET of the first byte
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -r 0-0 "$url" 2>/dev/null)
  fi
  hashok="-"
  if [ "$FULL" = "1" ]; then
    tmp="$(mktemp)"
    if curl -sL --max-time 120 "$url" -o "$tmp" 2>/dev/null; then
      got=$(shasum -a 256 "$tmp" | awk '{print $1}')
      if [ "$got" = "$sha" ]; then hashok="sha256-ok"; else hashok="sha256-MISMATCH"; fail=1; fi
    else
      hashok="download-failed"; fail=1
    fi
    rm -f "$tmp"
  fi
  [ "$code" = "200" ] || { fail=1; code="${code:-ERR}"; }
  printf "%-48s %-8s %s\n" "$name" "$code" "$hashok"
done <<< "$entries"

echo
echo "Checked $checked inputs from $MANIFEST."
if [ "$fail" -ne 0 ]; then
  echo "At least one input is unreachable or (with --full) does not match its pin. Options:"
  echo "  - rebuild from the verified cache:  node swm/tools/build-ontology.mjs --offline"
  echo "  - correct the URL/pin in swm/tools/sources/MANIFEST.json"
fi
exit $fail
