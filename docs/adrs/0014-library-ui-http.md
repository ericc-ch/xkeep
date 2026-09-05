# ADR 0014: Library UI HTTP and canvas

## Status

Accepted (2026-09-05) — grilled with Erick. Amends ADR 0010 (events, open browser), ADR 0011 (projection, no auto-tag), and PLAN home-screen / auto-tag lines.

## Context

The daemon already has health, import, and semantic search. The library tab needs a pile read, live updates, tags, a spatial map, and stills over HTTP. PLAN said search was home and canvas was a second view. Grilling flipped that: the screen is the map of every bookmark.

## Decision

### UI

- Origin `/` is the library SPA. `/api` stays JSON. Scalar stays `/api/docs`.
- First paint is a **spatial map of the whole pile**. Each bookmark is a thumb (local still) or trimmed text if there is no still. Click opens the full bookmark.
- Search and filters only **highlight** ids the tab already drew. They do not replace the pile or hide rows (except a later real delete).
- Search is semantic only (`GET /api/search?q=`). No keyword/BM25. Response is ids + scores. The tab highlights those ids.
- Filters (author, media type, date, tag) run in the tab on the loaded pile. No filter query string on the server.
- Once the SPA exists, bare `xkeep` / ensure **opens the origin**.

### Pile HTTP

- `GET /api/bookmarks` — one shot, every row. Measure before paging.
- Fields: `id`, author, handle, avatar, text, timestamp, media types, tag ids, still URLs under the media route, `embedded`, optional cached `x`,`y`.
- `GET /api/bookmarks/:id` — quoted tweet and full media.
- `GET /api/media/...` — files inside `mediaDir` only.

### Cluster query

- `GET /api/clusters?k=` (required, default **12** if omitted). Optional `minSize`.
- k-means in 2048-d → `groupId` (not stored; `k` can change).
- UMAP (`umap-js`) → `x`, `y`. Write those onto the bookmark row as cache. Null `x`,`y` when the embedding is nulled. Next pile GET can draw without running UMAP. Recompute UMAP only when the tab asks for clusters (or coords are missing and the tab asks).
- Members: `id`, `x`, `y`, `groupId`. Plus `skippedUnembedded`.
- Rows with no `x`,`y`: the tab puts them on a **simple grid**. Not a server layout.
- Events do not run UMAP or k-means.

### Tags

- `GET` / `POST /api/tags`
- `PATCH` / `DELETE /api/tags/:id` (delete drops links, reparents children)
- `PUT /api/bookmarks/:id/tags` replace; `POST` / `DELETE /api/bookmarks/:id/tags/:tagId` add/remove
- **No auto-tag.** Tags exist only when applied through these routes.

### Events (amends ADR 0010)

Drop coarse `bookmarks.changed`. Publish ids:

- `bookmark.upserted` `{ ids }` after import
- `bookmark.embedded` `{ ids }` after the drain writes blobs

Keep `tag.*` and `bookmark.tagged` / `untagged`. Cluster reads still do not publish. The tab patches those ids. It does not refetch the scatter.

### Canvas kit

- Map: GPU sprites (Pixi-class). tldraw is **out** (license; 5k unique thumbs = 0–2 fps on gl503ge).
- Open bookmark: **one** HTML card in **world space**. Same camera matrix as the thumbs (translate + scale). Not a viewport modal. Not html-in-canvas (Firefox; Chrome OT only). The card paints above the whole map. One open at a time. Thumbs stay sprites. Tried in `/tmp/pixi-5k` (2026-09-05): feels right.
- Chrome (search, filters, drop) is still normal page HTML. FPS throwaways live under `/tmp` only.
- Package: `packages/web`. React for chrome + the in-world card. Pixi for the map. Server serves the built files at `/`.

## Consequences

- Search is no longer the home list. PLAN “search first / canvas one click away” is revoked.
- One-shot pile + 5k unique thumbs is a load we will measure (HTTP and GPU).
- Server work before the real SPA: bus + SSE, tags, cluster GET, bookmark GET/list, media GET, then static `/`.
