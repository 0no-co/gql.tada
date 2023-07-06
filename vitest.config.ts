import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: 'c8',
      100: true,
    },
    globals: false,
    clearMocks: true,
  },
});
