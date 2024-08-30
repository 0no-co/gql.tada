---
'@gql.tada/internal': patch
---

Update the tsconfig resolver to better handle an array of "extends" values in tsconfig.json files when trying to locate the GraphQLSP plugin entry. Before, if you were using an array for "extends", e.g. `"extends: ["./file1.json", "./file2.json"]`, the first file loaded that did not have a GraphQLSP plugin entry defined would throw an error and prevent subsequent files from being loaded and evaluated. The implemented change now allows for the resolver to continue iterating over `extends` values trying to locate a GraphQLSP plugin entry.
