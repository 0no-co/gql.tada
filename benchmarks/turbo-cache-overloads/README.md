# Turbo Cache Overloads Benchmark

Demonstrates that the turbo cache conditional type does not skip `parseDocument`
during batch typechecking (`tsc`), and that function overloads fix this.

## Setup

```bash
cd benchmarks/turbo-cache-overloads
npm install
npx gql-tada generate output   # generates graphql-env.d.ts
npx gql-tada turbo              # generates graphql-cache.d.ts (10 queries)
```

## Run

```bash
# Without turbo cache
npx tsc --noEmit --extendedDiagnostics -p tsconfig.no-cache.json

# With turbo cache
npx tsc --noEmit --extendedDiagnostics -p tsconfig.with-cache.json
```

To test with the patched gql.tada, build from root (`pnpm build`) and
symlink: `rm -rf node_modules/gql.tada && ln -s ../../.. node_modules/gql.tada`

## Results

Schema: Node interface (20 implementations) + Item interface (10 implementations).
Queries: 10 queries selecting fields from Node and Item.

| Configuration | Instantiations |
|---|---|
| No cache, unpatched | 76,822 |
| With cache, unpatched | 76,905 |
| No cache, patched | 76,847 |
| With cache, patched | 178 |

The turbo cache has zero effect on the unpatched version (76K → 76K).
With the overloads patch, cached queries skip `parseDocument` entirely (76K → 178).
Without the cache, the patched version behaves identically to unpatched (fallback works).
