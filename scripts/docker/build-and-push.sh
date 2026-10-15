#!/usr/bin/env bash
# Run from the repo root (paths below are relative to it, e.g. api, app, db).
#
# Builds a fresh (--no-cache, --pull) ":latest" image for each of the three
# app directories and pushes it to Docker Hub — but skips any app whose
# directory hasn't changed since the last successful push, so you don't
# waste time/bandwidth rebuilding and re-pushing something unchanged.
#
# "Changed" is determined by hashing the contents of every file in the
# app's directory (excluding node_modules/.git, same as its .dockerignore)
# and comparing that hash against the one recorded after the last
# successful build+push, stored in .docker-build-state/<service>.sha256.
# The very first run always builds everything (no prior state to compare).
#
# Usage:
#   ./scripts/docker/build-and-push.sh                # build/push whatever changed, for all 3
#   ./scripts/docker/build-and-push.sh api app         # only consider these services
#   ./scripts/docker/build-and-push.sh --force         # rebuild/push all 3 regardless of hash
#   DOCKERHUB_USER=myuser ./scripts/docker/build-and-push.sh
#
# Env vars:
#   DOCKERHUB_USER  Docker Hub namespace to tag/push under (default: anilpandeyio)

set -uo pipefail

DOCKERHUB_USER="${DOCKERHUB_USER:-anilpandeyio}"
STATE_DIR=".docker-build-state"
IMAGE_PREFIX="k8s-three-tier-starter"

# name:directory
ALL_SERVICES=(
  "db:db"
  "api:api"
  "app:app"
)

FORCE=0
REQUESTED=()
for arg in "$@"; do
  case "$arg" in
    --force|-f)
      FORCE=1
      ;;
    -h|--help)
      # Print every leading "#"-prefixed comment line (after the shebang),
      # stopping at the first non-comment line — self-maintaining even if
      # this header comment block is edited later.
      awk 'NR==1 && /^#!/ { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
      exit 0
      ;;
    *)
      REQUESTED+=("$arg")
      ;;
  esac
done

# Repo-root sanity check: every path below is relative, so running this
# from the wrong directory would silently hash/build the wrong thing.
for d in api app db; do
  if [ ! -d "$d" ]; then
    echo "error: '$d' not found — run this script from the repository root." >&2
    exit 1
  fi
done

mkdir -p "$STATE_DIR"

# Portable SHA-256: prefer sha256sum (Linux), fall back to shasum -a 256 (macOS).
_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum
  else
    shasum -a 256
  fi
}

# One deterministic hash per directory: hash every file's contents, pair
# each with its path, sort by path, then hash that whole list. Any added,
# removed, renamed, or modified file changes the final hash. A plain loop
# is used instead of xargs so it works regardless of whether file hashing
# is a real binary (sha256sum) or a shell function (shasum fallback).
hash_dir() {
  local dir="$1" f
  find "$dir" \( -path '*/node_modules/*' -o -path '*/.git/*' \) -prune -o -type f -print \
    | LC_ALL=C sort \
    | while IFS= read -r f; do
        printf '%s  %s\n' "$(_sha256 <"$f" | awk '{print $1}')" "$f"
      done \
    | _sha256 \
    | awk '{print $1}'
}

# Decide which services to process: all 3 by default, or only the ones
# named on the command line (validated against ALL_SERVICES).
services_to_run=()
if [ "${#REQUESTED[@]}" -eq 0 ]; then
  services_to_run=("${ALL_SERVICES[@]}")
else
  for want in "${REQUESTED[@]}"; do
    found=0
    for entry in "${ALL_SERVICES[@]}"; do
      name="${entry%%:*}"
      if [ "$name" = "$want" ]; then
        services_to_run+=("$entry")
        found=1
        break
      fi
    done
    if [ "$found" -eq 0 ]; then
      echo "error: unknown service '$want' (expected one of: db, api, app)" >&2
      exit 1
    fi
  done
fi

echo "Logging in to Docker Hub (use a Personal Access Token, not your password)..."
docker login || exit 1

built=()
skipped=()
failed=()

for entry in "${services_to_run[@]}"; do
  name="${entry%%:*}"
  dir="${entry##*:}"
  image="docker.io/${DOCKERHUB_USER}/${IMAGE_PREFIX}-${name}:latest"
  state_file="${STATE_DIR}/${name}.sha256"

  echo
  echo "==> [$name] checking '$dir' for changes..."
  current_hash="$(hash_dir "$dir")"
  previous_hash=""
  [ -f "$state_file" ] && previous_hash="$(cat "$state_file")"

  if [ "$FORCE" -eq 0 ] && [ -n "$previous_hash" ] && [ "$current_hash" = "$previous_hash" ]; then
    echo "==> [$name] no changes since the last successful push — skipping build/push."
    skipped+=("$name")
    continue
  fi

  echo "==> [$name] building ${image} (--no-cache --pull)..."
  if ! docker build --no-cache --pull -t "$image" "$dir"; then
    echo "==> [$name] build FAILED — leaving recorded state untouched." >&2
    failed+=("$name")
    continue
  fi

  echo "==> [$name] pushing ${image}..."
  if ! docker push "$image"; then
    echo "==> [$name] push FAILED — leaving recorded state untouched (will retry next run)." >&2
    failed+=("$name")
    continue
  fi

  # Only record the new hash after a successful push, so a failed push
  # still gets retried (and rebuilt) on the next run.
  echo "$current_hash" > "$state_file"
  echo "==> [$name] done."
  built+=("$name")
done

echo
echo "===== Summary ====="
[ "${#built[@]}" -gt 0 ]   && echo "Built & pushed: ${built[*]}"
[ "${#skipped[@]}" -gt 0 ] && echo "Skipped (unchanged): ${skipped[*]}"
[ "${#failed[@]}" -gt 0 ]  && echo "Failed: ${failed[*]}"

if [ "${#failed[@]}" -gt 0 ]; then
  exit 1
fi
