# ADR 0015: String tags

## Status

Accepted (2026-09-06) — grilled with Erick. Amends ADR 0011 (durable domain: tag), ADR 0010 (events), and ADR 0014 (tag routes, cluster tag apply).

## Context

The tag tree never found a consumer: no subtree ops, no path display, and the tab does not render hierarchy. Every piece of tree machinery (`parentId` rules, sibling uniqueness, reparent-on-delete, uuid tag ids in payloads) is cost with no buyer. The pile is one user's bookmarks; the filter UI wants names, not ids.

## Decision

- **A tag is a string.** No `tags` table, no tag ids, no hierarchy. Rename/reparent/delete-of-node semantics are gone.
- **Storage:** `bookmark_tags(bookmark_id, tag)` with `tag` the literal string, unique per bookmark. Per-tag counts stay SQL (`GROUP BY tag`).
- **Casing:** exact-string identity, case-sensitive (matches X hashtag casing). No normalization.
- **Routes:**
  - `GET /api/tags` → `{ tags: [{ tag, count }] }` — distinct names + counts.
  - `PUT /api/bookmarks/:id/tags` `{ tags: string[] }` full replace (names now).
  - `POST` / `DELETE /api/bookmarks/:id/tags/:tag` add/remove one (tag URL-encoded in the path).
  - `PUT /api/tags/:tag` `{ tag }` rename — one bulk `UPDATE bookmark_tags SET tag = ?`; publishes per-bookmark `bookmark.untagged` + `bookmark.tagged` pairs.
  - `POST /api/bookmarks/tags` `{ memberIds, tag }` bulk apply — the cluster path. Amends ADR 0014's client-loop note; still user-triggered, still no auto-tag.
  - Dropped: `POST` / `PATCH` / `DELETE /api/tags`, `TagNotFound`, `TagConflict`. A tag disappears when its last link is removed.
- **Payloads:** `tagIds` becomes `tags: string[]` on list + detail items.
- **Events:** `tag.created` / `tag.updated` / `tag.deleted` are gone. `bookmark.tagged` / `bookmark.untagged` carry `{ id, tag }`.
- **Migration:** one migration maps existing tag ids to names through the old tables, rewrites `bookmark_tags`, drops the `tags` table.

## Consequences

- No 404/409 tag errors anywhere; applying an unknown tag is just a string.
- Tag UI shrinks to apply/remove + create-by-typing; no tree panel.
- CLI `xkeep api` examples using tag ids are gone; tag arguments are names.
