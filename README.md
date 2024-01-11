<div align="center">
  <h2>gql.tada 🪄</h2>
  <strong>Magical GraphQL query engine for TypeScript</strong>
  <br />
  <br />
  <a href="https://github.com/0no-co/gql.tada/actions/workflows/release.yml"><img alt="CI Status" src="https://github.com/0no-co/gql.tada/actions/workflows/release.yml/badge.svg?branch=main" /></a>
  <a href="https://urql.dev/discord"><img alt="Discord" src="https://img.shields.io/discord/1082378892523864074?color=7389D8&label&logo=discord&logoColor=ffffff" /></a>
  <br />
  <br />
</div>

`gql.tada` is a GraphQL document authoring library, inferring the result and variables types
of GraphQL queries and fragments in the TypeScript type system. It derives the types for your
GraphQL queries on the fly allowing you to write type-safe GraphQL documents quickly.

In short, `gql.tada`,

- parses your GraphQL documents in the TypeScript type system
- uses your introspected schema and scalar configuration to derive a schema
- maps your GraphQL queries and fragments with the schema to result and variables types
- creates fragment masks and enforces unwrapping fragments gradually

Since this is all done in the TypeScript type system and type checker, this all happens
while you edit your GraphQL front-end code and is always accurate.

### Let’s take a look!

```ts
import { graphql } from 'gql.tada';
import { myIntrospectionQuery } from './fixtures/introspection';

// We can declare our introspected schema once globally
declare module 'gql.tada' {
  interface setupSchema {
    introspection: typeof myIntrospectionQuery;
  }
}

// Creates fragment documents
const fragment = graphql(`
  fragment HelloWorld extends Query {
    hello
    world
  }
`);

// Creates queries, optionally accepting a list of fragments for fragment spreads
const query = graphql(
  `
    {
      hello
      ...HelloWorld
    }
  `,
  [fragment]
);
```

## 💾 Setup

Install `gql.tada` using your project’s package manager,

```sh
npm i gql.tada
pnpm add graphql
yarn add gql.tada
bun add graphql
```

`gql.tada` infers the types of your queries. However, it can’t provide you with editor feedback,
like autocompletion, diagnostics & errors, and hover information inside GraphQL queries.
For the best experience, it’s recommended to install [GraphQLSP](https://github.com/0no-co/graphqlsp)
to supplement these features.

Install `@0no-co/graphqlsp` as a dev dependency,

```sh
npm i -D gql.tada
pnpm add -D graphql
yarn add --dev gql.tada
bun add --dev graphql
```

Then, update your `tsconfig.json` to enable the `graphqlsp` plugin in your TypeScript server,

**tsconfig.json**

```diff
{
  "compilerOptions": {
+    "plugins": [
+      {
+        "name": "@0no-co/graphqlsp",
+        "schema": "./schema.graphql"
+      }
+    ]
  }
}
```

> **Note:**
> If you are using VSCode, you may want to update your `.vscode/config.json` file to use the
> [use the **workspace version** of TypeScript](https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript)
> automatically.
>
> **.vscode/config.json**
>
> ```diff
> {
> +  "typescript.tsdk": "node_modules/typescript/lib",
> +  "typescript.enablePromptUseWorkspaceTsdk": true
> }
> ```

<!-- TODO -->
