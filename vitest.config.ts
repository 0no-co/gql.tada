import { defineConfig } from 'vitest/config';

export default defineConfig({
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
