#!/usr/bin/env node

(async function main() {
  try {
    await import('../dist/gql-tada-cli.mjs');
  } catch (_error) {
    require('../dist/gql-tada-cli.js');
  }
})();
