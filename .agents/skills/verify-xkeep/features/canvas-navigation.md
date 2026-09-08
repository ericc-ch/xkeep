# Canvas navigation

## Status

`graduated-to-e2e` — `tests/e2e/xkeep.spec.ts`

## Sub-features

- Wheel zoom around the pointer.
- Space-drag and middle-button pan.
- Zoom in, zoom out, and Fit controls.
- Camera restoration after reload.
- Minimap navigation.

## How to get to it (user POV)

Open `/` after at least one bookmark has embedded. The canvas fills the window. Zoom controls sit at the lower left. The minimap sits above them.

## Driving it with native E2E

Run `nub run test:e2e:built`. The native browser test uses a fixed `1440 × 960` viewport and proves wheel zoom, Space-drag, middle-button pan, zoom controls, Fit, minimap navigation, and camera restoration through observable `localStorage` camera changes.

## Promotion Criteria

The flow is deterministic because it uses fixed fixtures, a fixed viewport, persisted camera state, and direct before/after assertions. Keep new camera gestures in the native test rather than adding a long-lived Playwriter script.

## Gotchas

Pixi marks and the minimap are pixels inside one canvas element. Use coordinates relative to the canvas bounding box. The top toolbar and right inspector can cover canvas pixels even though the Pixi canvas spans the viewport.
