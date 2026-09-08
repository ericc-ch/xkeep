# ADR 0019: Kobalte + StyleX canvas chrome

## Status

Accepted (2026-09-08) — grilled with Erick. Amends ADR 0014 (canvas kit).

## Context

Canvas chrome (menus, delete confirm, filters, search, inspector actions) was hand-rolled: `role="dialog"` with a home-grown focus trap, `role="menu"` without keyboard nav, native `<select>` / datalist, and per-widget StyleX. That duplicated WAI-ARIA work and drifted from a shared control language. shadcn/ui is the right _shape_ (owned files, composed parts, variants) but it is Radix + Tailwind. xkeep is Solid + StyleX with a locked X/Twitter dark skin.

## Decision

- Own a small kit in `packages/web/src/ui/`. Copy the shadcn composition pattern. Do not install solid-ui, solidcn, CVA, `cn()`, Lucide, or a registry CLI. Do not take shadcn's zinc/New York look.
- Primitives are `@kobalte/core` parts wrapped with StyleX (`stylex.attrs`). Variants are StyleX style objects, not CVA. Call sites import the wrappers, not `@kobalte/core/*`.
- Catalog is only what the canvas uses: Button, AlertDialog, DropdownMenu, Popover, TextField, Select, Combobox, ToggleGroup, Slider. Grow the folder when a screen needs a new primitive. No barrel `index.ts`.
- Visual language stays the locked X/Twitter dark chrome (near-black, charcoal lines, Chirp, Twitter-blue accents). Pixi stays the map. Toolbar, inspector, zoom, minimap, and empty states stay layout in `canvas/`.
- Form controls in that chrome are Kobalte (Select, Combobox, TextField, ToggleGroup, Slider), not native `<select>` / datalist.

## Consequences

- `@kobalte/core` is a `@xkeep/web` dependency (`^0.13.13`). Peer `solid-js ^1.9.8` matches Solid 1.9.15.
- Playwright locators that assumed native `<select>` (`selectOption`) must use listbox options. Dialog, menu, and labeled search/tag handles stay the same roles and names.
- Overlay positioning uses Kobalte's Floating UI portals instead of page-absolute panels.
