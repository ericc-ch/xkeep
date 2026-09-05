# ADR 0011: Bookmarks, tags, and ephemeral clusters

## Status

Accepted (2026-09-04) — grilled with Erick. Amended 2026-09-05: UMAP (not PCA) for 2d; no auto-tag; canvas is the library view; no `minSize`; no coarse `bookmarks.changed`. See ADR 0014.

## Context

Plan.md talked about tags, clusters, and a canvas. Main only persisted `bookmarks`. A throwaway `canvas` branch invented stored `clusters`, `bookmark_tags`, and `cluster_id` / projection columns, and rebuilt clusters by deleting rows and reminting ids. That made "cluster" look like a durable entity and blurred it with tags. Grilling reset the nouns.

The pile is bookmarks. The running process is the app/daemon. The sqlite port for bookmark rows is the Effect service `Bookmarks`. It is not an OpenAPI resource.

## Decision

### Durable domain

- **Bookmark** — one saved X post. Primary key is the tweet snowflake id (text). Author/handle/avatar/text/media/etc. live on the row. No separate users table in v1.
- **Tag** — durable label. Stored as rows: `id`, `name`, `parentId` (nullable). Hierarchy is a tree via parent pointers, not path strings (rename must not rewrite every join by string). Names are unique among siblings (same `parentId`), case-sensitive.
- **Bookmark ↔ tag** — many-to-many. No `source` / manual-vs-auto column: a tag applied by a human or by an auto sampler is the same row relationship. Auto is just who called the API.
- **Tag delete** — delete that node only: drop its bookmark links, reparent children to its parent. Do not cascade-wipe the subtree.

Hashtags from the X dump stay on the bookmark as imported metadata (`hashtags_json`). They are not tags until the user (or auto flow) promotes them.

### Ephemeral: cluster query

- **Cluster is not saved.** There is no `clusters` table and no `cluster_id` on bookmarks.
- A **cluster query** is a read-only k-means over bookmarks that already have embeddings (2048-d) for `groupId`. `x`,`y` are not computed here: the drain writes UMAP (`umap-js`) onto a row once; later rows transform into the same space. Import cannot project (no vectors yet).
- Query params that matter: `k` only (default 12). No `minSize`. Not a free "dimensions" knob for the embedding space (fixed by the model).
- Response: `members` with `id`, cached `x`,`y`, ephemeral `groupId`, plus `skippedUnembedded`. Next call may return different groupings.
- Bookmarks still embedding: **skip** them and return `skippedUnembedded: n`. Do not block on the drain; do not pretend they were clustered.
- **Tagging from a cluster** is client-composed: take `members[].id` and call the normal tag-apply APIs. The server does not accept "cluster id" or keep a short-lived cluster cache.

No auto-tag. The client may still take `memberIds` and call tag APIs.

### Not domain objects

- **Canvas** — not an entity. The library UI places thumbs from cached UMAP `x`,`y` on the bookmark row. Still not a table. Cluster GET is not used to place marks.
- **Stored projection** — `proj_x`/`proj_y` are cache written by the drain, not source of truth.

### HTTP surface

- Tag tree CRUD on tag rows.
- Bookmark tags: **both** full replace (`PUT …/tags`) and add/remove one.
- Cluster: `GET /api/clusters?k=` read-only; no write routes named cluster.
- Import/search/health unchanged in role.

### Events (bus)

See ADR 0010 / 0014. Fine events for tag tree + bookmark tag membership; `bookmark.upserted` / `bookmark.embedded` with ids for import/embed. Cluster queries do not publish (read-only, ephemeral).

## Consequences

- Throwaway canvas schema (`clusters`, `cluster_id`, treating cluster rename as the main write) is rejected for main.
- CLI mental model: `xkeep api cluster` (inspect) → tag-apply HTTP (persist).
- Hierarchical tags cost real tree APIs (move/rename/delete rules) instead of path-string hacks.
- UI can show a scatter from cached UMAP without persisting cluster groups.
