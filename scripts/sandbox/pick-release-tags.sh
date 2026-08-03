#!/usr/bin/env bash
# Pick the release tags the install/update E2E should update FROM.
#
# Emits a JSON array of tag names on stdout, suitable for a GitHub Actions
# matrix (`fromJSON`). Choosing at runtime rather than hardcoding keeps the
# matrix honest as releases land: a pinned list silently stops covering the
# newest release the day after it ships, and pins the "oldest" forever even
# after it stops being a version anyone still runs.
#
# Selection: the newest tag, the oldest tag, and evenly spaced tags in between.
# Newest catches "did the last release break updating?", oldest is the longest
# upgrade jump anyone can still make, and the spread samples the migrations in
# between (config-schema bumps, venv layout changes, dependency floors).
#
# Usage:
#   scripts/sandbox/pick-release-tags.sh [--count N] [--remote URL]
#
#   --count   how many tags to emit (default 5, minimum 1). Fewer tags than
#             requested emits all of them.
#   --remote  repository to read tags from (default: the canonical upstream).
#
# Only vYYYY.M.D[.N] release tags are considered; the repo also carries
# backup/* and one-off tags that are not releases.

set -euo pipefail

COUNT=5
REMOTE="https://github.com/NousResearch/hermes-agent.git"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --count)
      [ "$#" -ge 2 ] || { echo 'error: --count needs a value' >&2; exit 1; }
      COUNT="$2"; shift 2 ;;
    --remote)
      [ "$#" -ge 2 ] || { echo 'error: --remote needs a value' >&2; exit 1; }
      REMOTE="$2"; shift 2 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "error: unknown argument: $1" >&2; exit 1 ;;
  esac
done
case "$COUNT" in
  ''|*[!0-9]*) echo "error: --count must be a positive integer: $COUNT" >&2; exit 1 ;;
esac
[ "$COUNT" -ge 1 ] || { echo 'error: --count must be at least 1' >&2; exit 1; }

# sort -V orders v2026.4.8 before v2026.4.13 (numeric), which a plain
# lexicographic sort gets wrong.
mapfile -t tags < <(
  git ls-remote --tags --refs "$REMOTE" 2>/dev/null \
    | awk '{print $2}' \
    | sed 's|refs/tags/||' \
    | grep -E '^v[0-9]{4}\.[0-9]+\.[0-9]+(\.[0-9]+)?$' \
    | sort -V
)

total="${#tags[@]}"
if [ "$total" -eq 0 ]; then
  echo "error: no release tags found at $REMOTE" >&2
  exit 1
fi

if [ "$total" -le "$COUNT" ]; then
  picked=("${tags[@]}")
elif [ "$COUNT" -eq 1 ]; then
  # One slot means the newest release; there is no span to spread across.
  picked=("${tags[$((total - 1))]}")
else
  # Evenly spaced indices across [0, total-1], endpoints included, so the
  # oldest and newest are always present and the rest are spread between them.
  picked=()
  for slot in $(seq 0 $((COUNT - 1))); do
    # Round to nearest rather than truncate, so the spacing does not bunch
    # toward the oldest end.
    index=$(( (slot * (total - 1) * 2 + (COUNT - 1)) / ((COUNT - 1) * 2) ))
    candidate="${tags[$index]}"
    # Guard against a duplicate if rounding lands twice on the same tag.
    case " ${picked[*]-} " in
      *" $candidate "*) continue ;;
    esac
    picked+=("$candidate")
  done
fi

printf '['
for i in "${!picked[@]}"; do
  [ "$i" -eq 0 ] || printf ','
  printf '"%s"' "${picked[$i]}"
done
printf ']\n'
