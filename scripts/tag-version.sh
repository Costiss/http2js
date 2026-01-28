#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f package.json ]]; then
  echo "package.json not found" >&2
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")

if [[ -z "$VERSION" ]]; then
  echo "Unable to determine version from package.json" >&2
  exit 1
fi

TAG="v$VERSION"

git tag "$TAG"
git push origin "$TAG"
echo "Tagged and pushed $TAG"
