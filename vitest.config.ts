import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // NOTE: Tests run without the workspace packages being built, so the
      // workspace dependency is resolved to its source instead of `dist/`
      '@gql.tada/internal': fileURLToPath(
        new URL('packages/internal/src/index.ts', import.meta.url)
      ),
      '@gql.tada/svelte-support': fileURLToPath(
        new URL('packages/svelte-support/src/index.ts', import.meta.url)
      ),
      '@gql.tada/vue-support': fileURLToPath(
        new URL('packages/vue-support/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    // cli-utils has its own workspace project; exclude it here to avoid running its tests twice.
    exclude: [...configDefaults.exclude, 'packages/cli-utils/**'],
    benchmark: {},
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
    },
    globals: false,
    clearMocks: true,
  },
});
