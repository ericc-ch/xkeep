# Selection and inspector

## Status

`graduated-to-e2e` — `tests/e2e/xkeep.spec.ts`

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

## Driving it with native E2E

Run `nub run test:e2e:built`. The native browser test covers single selection and detail, additive overlap cycling, full-canvas marquee, single/shared/mixed tags, copied links, and a schema-decoded selection export.

## Promotion Criteria

The workflow uses deliberately overlapping deterministic fixtures, a fixed viewport, inspector assertions, clipboard permission, download capture, and API confirmation for bulk tags.

## Gotchas

Bookmark marks have no DOM nodes. Selection evidence needs the visible inspector and a screenshot of the Pixi selection outline. Browser downloads from Export selection need explicit download handling in Playwriter.
