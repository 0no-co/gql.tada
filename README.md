<div align="center">
  <h2>@0no-co/graphql.ts</h2>
  <strong>The spec-compliant & magical GraphQL query language engine in the TypeScript type system</strong>
  <br />
  <br />
  <a href="https://github.com/0no-co/graphql.ts/actions/workflows/release.yml">
    <img alt="CI Status" src="https://github.com/0no-co/graphql.ts/actions/workflows/release.yml/badge.svg?branch=main" />
  </a>
  <a href="https://urql.dev/discord">
    <img alt="Discord" src="https://img.shields.io/discord/1082378892523864074?color=7389D8&label&logo=discord&logoColor=ffffff" />
  </a>
  <br />
  <br />
</div>

**Work in Progress**

## Shortcomings

- [ ] adjacent fragment merging when coming of union/interface types (same union types)
- [ ] not sure if interfaces are done completely right
- [ ] support `@include`/`@skip`/`@defer`
- [ ] support custom scalars
- [ ] Enum support (we could get this for free by using `Introspection<typeof query>` rather than `any`)
