# reference-codex

Archive of pre-merge prior work done by the Codex agent in a parallel exploratory branch (`~/personal/unified-search-codex`, never committed).

Kept here for reference, not executed by the app.

## Files

- `search.js` — LRU cache + brand/size-stage grouping logic. Port target for issues #2 (fix grouping) and #7 (add LRU cache).
- `architecture.md` — full matching strategy (EAN → rules → embeddings), data model, caching, rate-limiting plan.
- `connectors.md` — connector contract and extraction checklist.

When these patterns get ported into `lib/`, this directory can be deleted.
