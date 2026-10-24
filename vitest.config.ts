import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // NOTE: Tests run without the workspace packages being built, so the
      // workspace dependencies are resolved to their sources instead of `dist/`
      {
        find: /^@gql\.tada\/internal$/,
        replacement: fileURLToPath(new URL('packages/internal/src/index.ts', import.meta.url)),
      },
      {
        find: /^@gql\.tada\/server$/,
        replacement: fileURLToPath(new URL('packages/server/src/index.ts', import.meta.url)),
      },
      {
        find: /^gql\.tada$/,
        replacement: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    benchmark: {},
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
    },
    globals: false,
    clearMocks: true,
  },
});
