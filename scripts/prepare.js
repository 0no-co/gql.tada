const path = require('path');
const fs = require('fs');

const precommit = path.resolve(__dirname, '../.git/hooks/pre-commit');

const hook = `
#!/bin/sh
pnpm exec lint-staged --quiet --relative
`.trim();

fs.writeFileSync(precommit, hook);
fs.chmodSync(precommit, '755');
