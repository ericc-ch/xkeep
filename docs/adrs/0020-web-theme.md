# ADR 0020: Shared web theme module

## Status

Accepted (2026-09-09) — grilled with Erick. Amends ADR 0017 (minimap viewport) and ADR 0019 (StyleX UI). Amended 2026-09-09: tighter radius scale; pills only for circles.

## Context

Canvas UI used StyleX with a seven-value color/font var set. Radii, shadows, glass fills, danger, and hover were literals in each widget. Pixi copied a few of those colors as hex integers and drifted (minimap fill, plate fill). The minimap masked its viewport stroke with the plate round-rect, so the blue zoom rect sheared at the corners. The first token pass used `sm` 8 / `md` 12 / `lg` 16 and applied `pill` to buttons, chips, status, and fields, which fought the locked canvas-tool feel (dense, precise, not a rounded consumer feed).

## Decision

- `packages/web/src/theme.ts` is the source of truth for the locked X/Twitter dark skin: color, radius, shadow, glass blur, and the floating-menu gutter.
- Radius is four steps with roles, not a menu of similar roundness:
  - `sm` 4 — nested: menu items, search hits, in-panel fields, nested previews
  - `md` 8 — controls and floating surfaces: buttons, chips, search, brand, zoom, status, menus, popovers, bookmark marks, minimap
  - `lg` 12 — large panels: dialogs, empty and import cards, inspector media and quotes
  - `pill` 999 — circles only: avatars, status dots, slider track/thumb, circular icon buttons, search-clear disc
- StyleX `defineVars` only accepts compile-time literals, so `tokens.stylex.ts` repeats those CSS strings. DOM widgets read `tokens.*`. Pixi imports `theme` and `pixiColor` for the same numbers. When a token changes, edit both files. Do not add Tailwind, CVA, or a second theme.
- Surface recipes (`glass`, `floating`, `overlay`) stay in `surface.stylex.ts`. Layout sizes and type sizes stay at the component. Size variants must not change radius.
- The minimap plate uses `radius.md`. The mask clips sample points only. The viewport rect stays inside the plate. Corners that touch the plate use `radius.md` so the blue stroke follows the curve.

## Consequences

- `reset.css` still paints `html` / `body` / `#app` before StyleX. Those three colors and the font must match `theme.ts`.
- Radius 6 / 10 / 14 snap onto `sm` / `md` / `lg`. Glass opacities `.92` and `.94` snap to `glass` or `glassRaised`.
- Status stays a compact top-right pending indicator; it uses `radius.md` like the other controls.
