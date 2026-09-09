# ADR 0017: Direct-manipulation bookmark canvas

## Status

Accepted (2026-09-07) — grilled with Erick. Amends ADR 0014 and ADR 0016 for the next web cut. Amended 2026-09-09: empty-canvas Copy snippet (see ADR 0016). Amended 2026-09-09: real camera zoom, no overview, infinite grid, clipped minimap, top-right status, `xkeep ▾` app menu. Amended 2026-09-09: cards counter-scale above 100% zoom so stacks separate. Amended 2026-09-09: status pill is pending-only, not expandable. Amended 2026-09-09: minimap viewport follows plate radius (ADR 0020).

## Context

The first canvas proved the semantic map, GPU thumbs, search, filters, clusters, tags, and an in-world detail card. The next cut must support 5,000–25,000 bookmarks as a precise canvas tool. The goal is to prevent useful bookmarks from becoming buried through spatial browsing and retrieval, not through recommendations, queues, or review state.

## Decision

- The app is the **canvas**. "Library" is not user-facing product language. Bookmark positions remain the automatic embedding/UMAP layout; users do not manually move or resize marks.
- Interaction is Figma-like direct manipulation: click selection, Shift additive selection, background marquee, and Cmd/Ctrl-click cycling through overlapping marks. Search and filters dim nonmatches without hiding or moving them.
- The camera is a real zoom (`0.05`–`64`). Below 100% cards shrink with the view. Above 100% they keep a steady screen size while positions spread, so overlapping stacks open up. Marks stay cards with images at every zoom; they do not collapse into overview dots or drop their stills. Media bookmarks use image-led cards and text-only bookmarks use compact post cards. Tags and k-means clusters are optional color overlays.
- Solid owns the page UI and a fixed right inspector. Pixi owns the canvas. Single selection shows full detail; multiple selection shows shared tag controls, Delete, and secondary copy/export actions.
- The camera is restored on launch. The world grid is infinite (redrawn from the camera). A minimap is always visible; its viewport rect is clipped to the plate, and corners that touch the plate use the plate radius. First-run import is Copy snippet on the empty canvas card, with Import JSON and drop as file fallbacks; Copy snippet stays in the `xkeep ▾` app menu after the canvas has bookmarks. Pending import/embed work uses a compact status pill at the top right, hidden when idle, and shifted left while the inspector is open.
- Deletion is user-assisted: xkeep opens selected posts on X one at a time. After confirmation, the server permanently deletes the bookmark, tags, embedding, projection, and bookmark-owned stills. It retains only an id/timestamp tombstone so stale dumps cannot resurrect the bookmark.
- Visual styling follows X/Twitter's current dark design language while retaining xkeep's canvas information architecture.

## Consequences

- `packages/web` needs an explicit canvas controller, selection model, spatial index, minimap, viewport-aware rendering, and bounded media/text texture ownership.
- The HTTP API needs bulk deletion plus a `bookmark.deleted` event. Import must report and skip tombstoned ids.
- The sqlite schema gains deletion tombstones. Their ids are deliberately retained even though bookmark content is destroyed.
- The 25,000-bookmark target requires a synthetic performance check before the design is considered shipped. Off-screen marks are culled. The minimap still samples to 4,000 points. There is no overview substitute; on-screen cards keep their smallest thumbnail rung when tiny.
