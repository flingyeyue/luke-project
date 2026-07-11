#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="/home/lucas/code/luke"
readonly STUDY_CONTRACT="${ROOT}/study/topics/visual-data-pipeline/03-contracts.md"
readonly PROJECT_CONTRACT="${ROOT}/project/docs/contracts.md"

[[ -f "$STUDY_CONTRACT" ]] || { printf 'missing: %s\n' "$STUDY_CONTRACT" >&2; exit 1; }
[[ -f "$PROJECT_CONTRACT" ]] || { printf 'missing: %s\n' "$PROJECT_CONTRACT" >&2; exit 1; }

if ! cmp -s "$STUDY_CONTRACT" "$PROJECT_CONTRACT"; then
  printf 'contract copies differ:\n- %s\n- %s\n' "$STUDY_CONTRACT" "$PROJECT_CONTRACT" >&2
  diff -u "$STUDY_CONTRACT" "$PROJECT_CONTRACT" || true
  exit 1
fi

printf 'contracts synchronized: %s\n' "$(sha256sum "$STUDY_CONTRACT" | awk '{print $1}')"
