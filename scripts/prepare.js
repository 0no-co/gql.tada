const path = require('path');
const fs = require('fs');

const precommit = path.resolve(__dirname, '../.git/hooks/pre-commit');

try {
  fs.mkdirSync(path.dirname(precommit), { recursive: true });
  const hook = ['#!/bin/sh', 'pnpm exec lint-staged --quiet --relative'].join('\n');
  fs.writeFileSync(precommit, hook);
  fs.chmodSync(precommit, '755');
} catch {
  // OK: no .git directory when installed as a dependency
}
