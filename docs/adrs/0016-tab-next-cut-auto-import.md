# ADR 0016: Tab next cut (search, filters, clusters, card) and auto-import

## Status

Accepted (2026-09-06) — grilled with Erick. Amends ADR 0014 (first cut → next cut) and the Dump section of CONTEXT.md.

## Context

The first cut shipped: map, spread, drop, card from list fields. The tab's own empty state says "Search and tags come next." The dump flow still needs a downloaded file dropped by hand; the parked `postMessage` plan was never built.

## Decision

### Search

- Input in the chrome bar; **Enter** submits (each query is a llama embed; no debounced live search). Esc or clear resets.
- Highlight only: matched marks stay full, everything else dims. Count chip shows hits. No pile replacement, no hiding (ADR 0014).
- Hits panel under the input: top hits (author + text snippet); clicking one pans to the mark and opens the card.
- `503` (llama not ready) renders an inline "embedding not ready" message.

### Filters

- Client-side over the loaded pile, highlight-only: media-type chips (photo/video/gif/text/link), tag picker (`GET /api/tags`), author typeahead, date presets (any / 30d / 90d / 1y).
- Search ∩ filters: their intersection decides highlight. Everything composes; nothing hides.

### Clusters

- Chrome toggle + k stepper (default 12). On → `GET /api/clusters?k=`; plates tint by `groupId` (distinct hues, no legend); off → clear.
- In cluster mode the open card gets "tag this group" → `POST /api/bookmarks/tags` (ADR 0015).

### Card

- Picking a mark fetches `GET /api/bookmarks/:id`: full media list, hashtags, urls, quoted tweet as a nested block. Open-on-x link is derived: `https://x.com/{handle}/status/{id}`.
- Fetch on pick, no cache. Tags in the card apply/remove via the string-tag routes (ADR 0015).

### Live

- The tab additionally invalidates the pile on `bookmark.tagged` / `bookmark.untagged`. Tag list refetches on demand (no `tag.*` events — ADR 0015).

### Auto-import (was parked in Dump)

- New `/import` route (no Pixi mount). Listens for `message`: `origin` must be `https://x.com` or `https://twitter.com`; payload decodes as `BookmarkDump`; then same-origin `POST /api/imports`.
- Snippet: ask count → `confirm("Import N to xkeep?")` (the user click keeps the popup unblocked) → `window.open(origin + "/import")` → `postMessage({ bookmarks })`. Popup blocked or load failed → fall back to today's file download; the drop path stays.
- The popup renders import status; busy (`409`) says so; success auto-closes after ~1.5s, otherwise a close hint.

## Consequences

- First-cut card-from-list-fields is replaced by detail fetches; the pile list stays the map's source.
- The dump flow loses the download step in the happy path.
- Server work is one migration (ADR 0015), route reshapes, and the bulk endpoint; no new storage.
