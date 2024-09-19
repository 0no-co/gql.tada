---
'gql.tada': patch
---

Add `loc` getter to parsed `DocumentNode` fragment outputs to ensure that using fragments created by `gql.tada`'s `graphql()` function with `graphql-tag` doesn't crash. `graphql-tag` does not treat the `DocumentNode.loc` property as optional on interpolations, which leads to intercompatibility issues.
