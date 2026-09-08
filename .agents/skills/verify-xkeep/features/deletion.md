# Deletion

## Sub-features

- Delete from the inspector or keyboard.
- Sequential confirmation for multiple bookmarks.
- Local bookmark, tag, embedding, projection, and media removal.
- Deletion tombstone creation.
- Stale import rejection.

## How to get to it (user POV)

Select one or more bookmarks. Click `Delete` or press Delete while the canvas has focus. Open each post on X, remove the upstream bookmark, then click `Removed on X` to delete the local record and continue.

## Driving it with Playwriter

Use only the isolated fixture. Select the fixture mark and click `getByRole("button", { name: "Delete" })`. Verify the dialog title. Do not follow the external X link. Click `getByRole("button", { name: "Removed on X" })`, then fetch `/api/bookmarks` and confirm the id is absent. Upload the same fixture again and confirm the notice reports one kept deletion and the API still omits the id.

## Gotchas

The verification harness cannot prove an upstream X bookmark was removed. It proves the user-assisted confirmation flow and all local effects. Never run destructive verification against the normal xkeep data directory.
