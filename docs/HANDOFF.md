# Handoff (2026-09-07)

State: The xkeep canvas redesign is present in the working tree on `main`.
The changes include the X-style canvas UI, Pixi interaction/performance work,
bookmark deletion tombstones, import status events, and the accepted canvas ADR.
The latest edits have not been re-verified, per the user's request.

Done:

- None claimed for the latest work; no post-edit verification was run.

In flight:

- Review findings were addressed across `packages/web/src/library.tsx`,
  `packages/web/src/map.ts`, `packages/server/src/db/bookmarks.ts`,
  `packages/server/src/lib/delete.ts`, and related API/import files, but the
  result remains unverified.
- `docs/CONTEXT.md` still needs a follow-up pass for any stale sections that
  describe the old library/realtime UI.

Next:

1. Run `nub run check` and fix any type, lint, format, test, or build failures.
2. Exercise `nub run dev` or `nub run start` and inspect the canvas with the
   large bookmark dataset, deletion flow, import flow, and selection/export.
3. Reconcile the remaining context documentation, then review the final diff.

Decisions made:

- The primary surface is a semantic canvas with automatic layout; tags and
  clusters are overlays, not alternate primary modes.
- Deletion is safe-by-default: unbookmark on X first, confirm locally, and keep
  tombstones so stale imports cannot resurrect removed bookmarks.
- The visual language follows X/Twitter dark UI conventions while retaining
  Figma-like selection, marquee, inspector, and minimap controls.

Gotchas:

- Do not treat a green check from before the latest patches as proof for the
  current tree.
- The app uses Nub; use the repository commands in `AGENTS.md`, not npm/pnpm.
- `packages/web/src/map.ts` owns camera persistence, culling, gesture state,
  and lazy thumbnail loading; changes there can affect both interaction and
  large-dataset performance.
