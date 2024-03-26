---
layout: home

hero:
  name: gql.tada
  tagline: Magical GraphQL query engine for TypeScript
  actions:
    - theme: brand
      text: Get Started
      link: /get-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/0no-co/gql.tada
---

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

In short, **with `gql.tada` and [GraphQLSP](https://github.com/0no-co/graphqlsp) you get on-the-fly, automatically typed GraphQL documents
with full editor feedback, auto-completion, and type hints!**

## Sponsors

<div class="sponsor-item">
  <img src="https://avatars.githubusercontent.com/u/186342?s=200&v=4" width="150" alt="BigCommerce"/>
  <a href="https://bigcommerce.com/">BigCommerce</a>
</div>

<div class="sponsor-item">
  <img src="https://avatars.githubusercontent.com/u/51333382?s=200&v=4" width="150" alt="BeatGig"/>
  <a href="https://beatgig.com/">BeatGig</a>
</div>
