#!/usr/bin/env bash
set -Eeuo pipefail

npx javascript-obfuscator app.js --output app.secured.js \
  --compact true \
  --control-flow-flattening false \
  --dead-code-injection false \
  --string-array true \
  --string-array-encoding 'none'