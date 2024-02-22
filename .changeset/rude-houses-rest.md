---
'gql.tada': patch
---

Add `disableMasking` flag to allow fragment masking to be disabled. When this is set to `true` on the `setupSchema` interface, fragments won’t be masked, which imitates the behaviour you’d see when adding `@_unmask` to every single one of your fragments. This is currently considered a preview feature.
