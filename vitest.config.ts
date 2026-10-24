import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // NOTE: Tests run without the workspace packages being built, so the
    // workspace dependency is resolved to its source instead of `dist/`
    alias: [
      {
        find: '@gql.tada/internal/introspection',
        replacement: fileURLToPath(
          new URL('packages/internal/src/introspection/index.ts', import.meta.url)
        ),
      },
      {
        find: '@gql.tada/internal',
        replacement: fileURLToPath(new URL('packages/internal/src/index.ts', import.meta.url)),
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
