#!/usr/bin/env bash
# Usage: scripts/deploy-hosted.sh <path-to-hosted-skill-clone> [--push]
# Copies lambda/ and the interaction model into the clone made by `ask init --hosted-skill-id ...`.
set -euo pipefail

target="${1:-}"
push="${2:-}"
src="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$target" || ! -d "$target/.git" || ! -f "$target/ask-resources.json" ]]; then
  echo "Usage: $0 <hosted-skill-clone> [--push]" >&2
  echo "The folder must be a clone from 'ask init --hosted-skill-id <id>'." >&2
  exit 2
fi

# config.json and node_modules stay untouched in the target (excluded files are protected from --delete).
rsync -a --delete \
  --exclude node_modules --exclude config.json --exclude tests --exclude config.example.json \
  "$src/lambda/" "$target/lambda/"
# The manifest (skill.json) is owned by Amazon: pushing our own wipes the hosted endpoint.
if [[ ! -f "$target/skill-package/skill.json" ]]; then
  echo "skill-package/skill.json is missing in $target. Restore it from the template (git checkout) first." >&2
  exit 2
fi
rsync -a "$src/skill-package/interactionModels/" "$target/skill-package/interactionModels/"

if [[ ! -f "$target/lambda/config.json" ]]; then
  echo "Note: $target/lambda/config.json is missing. Create it from lambda/config.example.json before pushing." >&2
fi

if [[ "$push" == "--push" ]]; then
  git -C "$target" add -A
  git -C "$target" commit -m "deploy: sync from norish-alexa" || echo "Nothing to commit."
  git -C "$target" push
else
  echo "Copied. Review with 'git -C $target status', then commit and push there (or rerun with --push)."
fi
