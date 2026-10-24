---
title: Schema Contract
description: How schema builders hand their schema's type to gql.tada, without introspection or code generation.
---

# Schema Contract

<section>
  The schema contract is a type-level schema format that
  <code>gql.tada</code> accepts in place of introspection data.
  When a schema is defined in TypeScript, its type can be
  passed to <code>gql.tada</code> directly, without generating
  an introspection file first.
</section>

Usually, `gql.tada` reads your schema from an introspection type, which
`gql.tada generate output` or the TypeScript plugin writes to a `.d.ts` file.
If your GraphQL API is in the same codebase, and is defined with a schema builder
that emits the contract, you can skip that step and type documents against the
schema's type instead. Changing the schema then updates the types of your
documents immediately.

This page is split in two halves. The first is for apps that use a schema
that carries the contract. The second is for authors of schema builders.

---

## Using a schema that carries the contract

A schema builder that emits the contract attaches the schema's type to the
schema object it returns. [`IntrospectionOf`](/reference/gql-tada-api#introspectionof)
reads this type back, and you pass it to `initGraphQLTada()` in place of
the introspection type:

::: code-group

```ts [src/graphql.ts]
import { initGraphQLTada, type IntrospectionOf } from 'gql.tada';
import type { schema } from './server/schema'; // [!code focus]

export const graphql = initGraphQLTada<{
  introspection: IntrospectionOf<typeof schema>; // [!code focus]
}>();
```

:::

Import the schema with `import type`. Only its type is used, so none of your
server's code ends up in your client's bundle.

Custom scalars are typed by the contract as well, so you don't need the
`scalars` option for them. Don't redefine them with it either: its types are
combined with the contract's, and a different type resolves to `never`.

::: warning
The contract only provides types. GraphQLSP and `gql.tada check` still
read your schema from a [schema file](/reference/config-format#schema) to
validate documents, for example to report a field that doesn't exist.
Write your schema's SDL to a file, e.g. with `printSchema()` from `graphql`,
and point your configuration at it.
:::

---

## Emitting the contract

If you're writing a schema builder, you can emit the contract from your
builder's types. `gql.tada` exports helper types for each kind of type
of a schema:

| Type                                                  | Description                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TadaSchema<Definition>`                              | The schema. `Definition` has `query`, and optionally `mutation`, `subscription`, and `name`, and a union of `types`. |
| `TadaObjectType<Name, Fields>`                        | An object type. `Fields` maps field names to type references.                                                        |
| `TadaInterfaceType<Name, Fields, PossibleTypes>`      | An interface type, with a union of the names of the object types implementing it.                                    |
| `TadaUnionType<Name, PossibleTypes>`                  | A union type, with a union of the names of its member object types.                                                  |
| `TadaEnumType<Name, Values>`                          | An enum type, with a union of its value names.                                                                       |
| `TadaScalarType<Name, Type>`                          | A custom scalar type, with the type of its serialized value.                                                         |
| `TadaInputObjectType<Name, Fields, Defaulted, OneOf>` | An input object type, with a union of the names of fields that have default values, and whether it's a OneOf input.  |
| `TadaNamedTypeRef<Kind, Name>`                        | A reference to a named type, e.g. `TadaNamedTypeRef<'SCALAR', 'String'>`.                                            |
| `TadaNonNullTypeRef<OfType>`                          | A Non-Null type reference.                                                                                           |
| `TadaListTypeRef<OfType>`                             | A List type reference.                                                                                               |
| `TadaSchemaCarrier<Schema>`                           | Attaches a schema type to a runtime schema object, for `IntrospectionOf` to read.                                    |

Built-in scalars (`ID`, `String`, `Int`, `Float`, and `Boolean`) are referenced,
but aren't part of `types`. Fields don't list their arguments, since `gql.tada`
types variables from the input types that documents reference.

```ts
import type {
  TadaSchema,
  TadaObjectType,
  TadaEnumType,
  TadaInputObjectType,
  TadaNamedTypeRef,
  TadaNonNullTypeRef,
  TadaListTypeRef,
} from 'gql.tada';

type ID = TadaNonNullTypeRef<TadaNamedTypeRef<'SCALAR', 'ID'>>;
type String = TadaNamedTypeRef<'SCALAR', 'String'>;
type Status = TadaNamedTypeRef<'ENUM', 'Status'>;

export type schema = TadaSchema<{
  query: 'Query';
  mutation: 'Mutation';
  types:
    | TadaEnumType<'Status', 'DRAFT' | 'PUBLISHED'>
    | TadaObjectType<'Article', { id: ID; title: TadaNonNullTypeRef<String>; status: Status }>
    | TadaInputObjectType<
        'ArticleInput',
        { title: TadaNonNullTypeRef<String>; status: Status },
        'status'
      >
    | TadaObjectType<
        'Query',
        { articles: TadaNonNullTypeRef<TadaListTypeRef<TadaNamedTypeRef<'OBJECT', 'Article'>>> }
      >
    | TadaObjectType<'Mutation', { createArticle: TadaNamedTypeRef<'OBJECT', 'Article'> }>;
}>;
```

A `TadaSchema` type can be passed to `initGraphQLTada()` as is. To let users
retrieve it from the schema object instead, intersect your schema object's
type with `TadaSchemaCarrier`:

```ts
import type { GraphQLSchema } from 'graphql';
import type { TadaSchemaCarrier } from 'gql.tada';

type BuiltSchema<Schema> = GraphQLSchema & TadaSchemaCarrier<Schema>;
```

Its `'~tada'` property is type-only, so it's never set at runtime. A schema
object that doesn't carry a schema type, such as a plain `GraphQLSchema`, is
rejected by `IntrospectionOf` with a type error.

::: tip
Use the helper types rather than writing the object types they produce.
The helpers are the contract's versioned surface, and `TadaContractVersion`
identifies the version that `TadaSchemaCarrier` uses.
:::

[`gql.tada/server`](/guides/schema-builder) is a schema builder that emits the contract.
Schemas built with `graphql`'s classes, or with builders that don't carry
field types at the type level, don't know their own types. Their contract has
to be written by hand, like the example above. For these schemas,
[`gql.tada generate output`](/reference/gql-tada-cli#generate-output) is
usually the better choice.
