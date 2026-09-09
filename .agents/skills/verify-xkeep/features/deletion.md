# Deletion

## Status

`graduated-to-e2e` — `tests/e2e/xkeep.spec.ts` and `packages/server/test/http.e2e.test.ts`

## Sub-features

- Delete from the inspector or keyboard.
- Sequential confirmation for multiple bookmarks.
- Local bookmark, tag, embedding, projection, and media removal.
- Deletion tombstone creation.
- Stale import rejection.

## How to get to it (user POV)

Select one or more bookmarks. Click `Delete` or press Delete while the canvas has focus. Open each post on X, remove the upstream bookmark, then click `Removed on X` to delete the local record and continue.

## Driving it with native E2E

Run `nub run test:e2e:built`. The native browser test covers keyboard and inspector entry points, cancellation, sequential confirmation, empty-canvas state, re-import rejection, and final API absence. The HTTP suite separately proves bookmark, tag, projection, embedding, and media cleanup plus tombstone behavior.

## Promotion Criteria

All destructive work runs against a unique temporary data directory. Visible dialog assertions and public API reads prove each local side effect without touching normal xkeep data or following X links.

## Gotchas

The verification harness cannot prove an upstream X bookmark was removed. It proves the user-assisted confirmation flow and all local effects. Never run destructive verification against the normal xkeep data directory.
