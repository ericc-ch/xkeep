# Search and filters

## Status

`graduated-to-e2e` — `tests/e2e/xkeep.spec.ts`

## Sub-features

- Enter-to-search semantic retrieval.
- Search result focus and selection.
- Media, tag, author, and date filters.
- Intersection of search and filter matches.
- Tag and cluster color overlays.

## How to get to it (user POV)

Open `/` with embedded bookmarks. Enter a phrase in `Search the canvas` and press Enter. Open `Filters` for media, tag, author, and saved-date controls. Toggle `Tags` or `Clusters` in the top toolbar.

## Driving it with native E2E

Run `nub run test:e2e:built`. The native browser test searches known fixture text, selects a result, applies link/tag/author/date filters, compares canvas pixels for search/filter intersections, and exercises the mutually exclusive tag and cluster overlays.

## Promotion Criteria

The fixed clock, fixture text, authors, tags, URLs, and pixel comparisons make the workflow repeatable. Cluster output is also decoded against the public response schema before the overlay assertion.

## Gotchas

Search and filters dim nonmatches. They do not remove marks or change positions. The Tags and Clusters overlays are mutually exclusive. The cluster-count slider appears inside Filters only while Clusters is on.
