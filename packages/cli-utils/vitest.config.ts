import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // NOTE: Tests run without the workspace packages being built, so the
      // workspace dependency is resolved to its source instead of `dist/`
      '@gql.tada/internal': fileURLToPath(new URL('../internal/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: false,
    clearMocks: true,
  },
});
