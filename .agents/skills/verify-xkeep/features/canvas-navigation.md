# Canvas navigation

## Sub-features

- Wheel zoom around the pointer.
- Space-drag and middle-button pan.
- Zoom in, zoom out, and Fit controls.
- Camera restoration after reload.
- Minimap navigation.

## How to get to it (user POV)

Open `/` after at least one bookmark has embedded. The canvas fills the window. Zoom controls sit at the lower left. The minimap sits above them.

## Driving it with Playwriter

Locate `getByRole("application", { name: "Bookmark canvas" })`. Set the viewport to `1440 × 960` before coordinate work. Move the mouse to the canvas center and call `page.mouse.wheel(0, -300)` to zoom in. Hold `Space`, drag with `page.mouse`, then release `Space` to pan. Click `getByRole("button", { name: "Fit" })` to restore the full view. Reload and compare the canvas screenshot to prove camera persistence.

## Gotchas

Pixi marks and the minimap are pixels inside one canvas element. Use coordinates relative to the canvas bounding box. The top toolbar and right inspector can cover canvas pixels even though the Pixi canvas spans the viewport.
