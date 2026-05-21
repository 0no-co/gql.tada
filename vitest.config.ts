import { defineConfig, type Plugin } from 'vitest/config';

// @gql.tada/svelte-support and @gql.tada/vue-support are optional peer
// dependencies of @gql.tada/cli-utils. They are not installed in a source
// checkout (no dist/, not symlinked). Any test that loads a module chain
// ending at these packages needs them to be resolvable, even if the actual
// lazy-import code path is never executed. This plugin creates lightweight
// virtual stubs so Vite never hits the "Failed to resolve entry" error.
function stubOptionalPeerPlugin(): Plugin {
  const stubs = new Set(['@gql.tada/svelte-support', '@gql.tada/vue-support']);
  return {
    name: 'vitest:stub-optional-peers',
    resolveId(id) {
      if (stubs.has(id)) return '\0stub:' + id;
    },
    load(id) {
      if (id.startsWith('\0stub:')) return 'export default {}';
    },
  };
}

export default defineConfig({
  plugins: [stubOptionalPeerPlugin()],
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
