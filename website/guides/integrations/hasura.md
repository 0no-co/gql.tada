---
title: Hasura
description: Making your introspection easier to understand for gql.tada when using Hasura.
---

# Hasura

By default Hasura exposes all entry-points which can make your schema
quite expensive to consume for `gql.tada`. We can use the
[Hasura authorization system](https://hasura.io/docs/latest/auth/overview/)
to output a smaller schema specifically for your front-end and `gql.tada`.

We'll expose only the fields and types that we need in our schema.

<img src="/hasura-control-panel.png" alt="" />

Then we can go into our `tsconfig.json` and add a header to reach out to
get our introspection as our new Hasura user.

```json [tsconfig.json]
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      {
        "name": "@0no-co/graphqlsp",
        "schema": {
            "url": "<your-hasura-url>",
            "headers": { // [!code ++]
                "x-hasura-admin-secret": "secret",  // [!code ++]
                "x-hasura-role": "gqltada"  // [!code ++]
            }, // [!code ++]
        },
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```

or use the CLI to get your schema by running

```sh
pnpm gql.tada generate-schema $hasuraUrl \
  --header 'x-hasura-admin-secret: secret' \
  --header 'x-hasura-role: gqltada'
```
