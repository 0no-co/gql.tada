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

- [ ] support having parsed parts in a document, like a fragment reference
- [ ] support defining custom scalars
- [ ] support `defer`/... on FragmentSpread to make it `| undefined`
- [ ] handle interfaces that are always implemented, remove the `| {}`
- [ ] `__typename` should be an object-type for interfaces
- [ ] add tests for interfaces
