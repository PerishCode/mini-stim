#!/usr/bin/env sh
set -eu

root=$(git rev-parse --show-toplevel)
cd "$root"

cargo run --quiet -p mini-stim-server-soma -- export-openapi > packages/contracts/openapi.json
python3 -m json.tool --indent 2 packages/contracts/openapi.json packages/contracts/openapi.json.tmp
mv packages/contracts/openapi.json.tmp packages/contracts/openapi.json
pnpm -C packages/contracts codegen
