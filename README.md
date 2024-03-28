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

In short, **with `gql.tada` and [GraphQLSP](https://github.com/0no-co/graphqlsp) you get on-the-fly, automatically typed GraphQL documents
with full editor feedback, auto-completion, and type hints!**

## 📃 [Documentation](https://gql-tada.0no.co)

Check out the [“Get Started” section’s Installation page](https://gql-tada.0no.co/get-started/installation/) in the documentation.

- Get Started
  - **[Introduction](https://gql-tada.0no.co)** — everything you need to know
  - **[Installation](https://gql-tada.0no.co/get-started/installation)** — an installation guide
  - **[Writing GraphQL](https://gql-tada.0no.co/get-started/writing-graphql/)** — how to write GraphQL documents
- API Reference
  - **[`gql.tada` API](https://gql-tada.0no.co/reference/gql-tada-api/)** — `gql.tada` API Reference docs
  - **[GraphQLSP Config](https://gql-tada.0no.co/reference/graphqlsp-config/)** — GraphQLSP Configuration Reference docs

Furthermore, all APIs and packages are self-documented using TSDocs. If you’re using a language
server for TypeScript, the documentation for each API should pop up in your editor when hovering
`gql.tada`’s code and APIs.

## 🔎 Let’s take a look!

<img width="100%" alt="Code Editor showing GraphQL queries being edited with gql.tada and GraphLSP" src="https://github.com/0no-co/gql.tada/blob/277ce424a747522ef2ca0d398b113f4f285eb595/website/public/demo-code.png?raw=true" />

## 💙 [Sponsors](https://github.com/sponsors/urql-graphql)

<table>
  <tr>
   <td align="center"><a href="https://bigcommerce.com/"><img src="https://avatars.githubusercontent.com/u/186342?s=200&v=4" width="150" alt="BigCommerce"/><br />BigCommerce</a></td>
   <td align="center"><a href="https://wundergraph.com/"><img src="https://avatars.githubusercontent.com/u/64281914?s=200&v=4" width="150" alt="WunderGraph"/><br />WunderGraph</a></td>
   <td align="center"><a href="https://the-guild.dev/"><img src="https://avatars.githubusercontent.com/u/42573040?s=200&v=4" width="150" alt="The Guild "/><br />The Guild</a></td>
  </tr>
</table>

<table>
  <tr>
   <td align="center"><a href="https://beatgig.com/"><img src="https://avatars.githubusercontent.com/u/51333382?s=200&v=4" width="100" alt="BeatGig"/><br />BeatGig</a></td>
  </tr>
</table>

## 📦 [Releases](https://github.com/0no-co/gql.tada/releases)

If you'd like to get involved, [check out our Contributor's guide.](https://github.com/0no-co/gql.tada/blob/main/CONTRIBUTING.md)

All new releases and updates are listed on GitHub with full changelogs.
The [`CHANGELOG.md` file](https://github.com/0no-co/gql.tada/blob/main/CHANGELOG.md) further documents all the historical changes for `gql.tada`.

New releases are prepared using
[changesets](https://github.com/0no-co/gql.tada/blob/main/CONTRIBUTING.md#how-do-i-document-a-change-for-the-changelog),
which are changelog entries added to each PR, and we have “Version Packages” PRs that once merged
will release new versions of the `gql.tada` package. You can use `@canary` releases from `npm` if you’d
like to get a preview of the merged changes.
