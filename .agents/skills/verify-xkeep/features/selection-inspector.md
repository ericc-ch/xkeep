# Selection and inspector

## Sub-features

- Click selection.
- Shift-click additive selection.
- Background marquee selection.
- Cmd/Ctrl-click overlap cycling.
- Single-bookmark detail inspector.
- Shared and mixed tags for multiple bookmarks.
- Link copy and JSON export.

## How to get to it (user POV)

Click a bookmark mark on the canvas. The right inspector opens with the full post. Shift-click or marquee more marks to switch the inspector to Selection mode.

## Driving it with Playwriter

Set a fixed viewport and inspect a screenshot before coordinate clicks. For the one-bookmark fixture, click the center of the `Bookmark canvas` bounding box. Wait for `getByRole("heading", { name: "Bookmark" })`. Use `getByLabel("Add tag")` for tag changes and `getByRole("button", { name: "Close inspector" })` to clear selection.

For marquee selection, start on empty canvas space. Hold the primary mouse button, move across the marks in steps, and release. For overlap cycling, repeat a click at the same coordinates with `Control` on Linux and Windows or `Meta` on macOS.

## Gotchas

Bookmark marks have no DOM nodes. Selection evidence needs the visible inspector and a screenshot of the Pixi selection outline. Browser downloads from Export selection need explicit download handling in Playwriter.
