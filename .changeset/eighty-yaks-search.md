---
'@gql.tada/internal': minor
---

Propagate schema loader errors instead of swallowing them. `SchemaLoader.notifyOnUpdate` and `SchemaRef.autoupdate` accept an optional `onError` callback that's called with per-schema attribution when a watched SDL file fails to reload (e.g. it's temporarily invalid mid-edit), when a URL schema fails to re-poll, or when a loader's initial load fails during `autoupdate` setup. Failing SDL reloads no longer kill the `fs.watch` fallback watcher, and reset the loader's cached result so subsequent loads retry. `SchemaRef.load` additionally accepts a `reload` option to force re-reading schemas, e.g. when a file watcher may have missed events
