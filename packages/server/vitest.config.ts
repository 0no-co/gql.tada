import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // NOTE: Tests run without the workspace packages being built, so workspace
      // dependencies are resolved to their sources instead of `dist/`
      {
        find: /^gql\.tada$/,
        replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      },
      {
        find: /^@gql\.tada\/internal$/,
        replacement: fileURLToPath(new URL('../internal/src/index.ts', import.meta.url)),
      },
      {
        find: /^@gql\.tada\/server$/,
        replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
    },
    globals: false,
    clearMocks: true,
  },
});
