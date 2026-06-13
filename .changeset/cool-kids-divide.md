---
'gql.tada': patch
---

Unroll tokenizer type into batch of 4 steps, which extends its range. This allows us to parse slightly longer documents with a very slight impact on parser performance. This means we're now bound by the parser/selection type depth, instead of by the tokenizer
