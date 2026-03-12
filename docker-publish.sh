#!/usr/bin/env sh

set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: ./docker-publish.sh <version> [image]" >&2
  exit 1
fi

VERSION="$1"
IMAGE="${2:-whuanle/maomi-docs}"

LATEST_TAG="${IMAGE}:latest"
VERSION_TAG="${IMAGE}:${VERSION}"

run_docker() {
  echo ">> docker $*"
  docker "$@"
}

run_docker build -t "$LATEST_TAG" .
run_docker tag "$LATEST_TAG" "$VERSION_TAG"
run_docker push "$VERSION_TAG"
run_docker push "$LATEST_TAG"

echo "Published tags: $VERSION_TAG, $LATEST_TAG"