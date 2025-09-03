#!/usr/bin/env bash
set -euo pipefail
JSON=$(node ./nexus-doctor.mjs --json "$@")
CODE=$(jq -r '
  def all_timeout:
    (.connectivity | length) > 0
    and (([.connectivity[] | select((.ok==false) and ((.error|tostring)|test("timeout")))] | length)
         == (.connectivity | length));
  if all_timeout then 10
  elif (.ntp.available == true and .ntp.status == "bad") then 21
  elif (.ntp.available == true and .ntp.status == "warn") then 20
  else 0 end
' <<<"$JSON")
echo "$JSON"
exit "$CODE"
