# ADR 0019: Kobalte + StyleX canvas UI

## Status

Accepted (2026-09-08) — grilled with Erick. Amends ADR 0014 (canvas kit). Amended 2026-09-09: `reset.css` is `@layer reset` under StyleX layers; action-adjacent hint copy; Toast banned. Tooltip is not in the catalog. Amended 2026-09-09: top-right status pill; `xkeep ▾` app menu with an 8px gutter. Amended 2026-09-09: status pill is pending-only, not expandable. Amended 2026-09-09: theme tokens come from `theme.ts` (ADR 0020). Amended 2026-09-09: radius roles in ADR 0020 (`pill` is circles only).

## Context

Menus, delete confirm, filters, search, and inspector actions were hand-rolled: `role="dialog"` with a home-grown focus trap, `role="menu"` without keyboard nav, native `<select>` / datalist, and per-widget StyleX. That duplicated WAI-ARIA work and drifted from a shared control language. shadcn/ui is the right _shape_ (owned files, composed parts, variants) but it is Radix + Tailwind. xkeep is Solid + StyleX with a locked X/Twitter dark skin.

## Decision

- Own a small kit in `packages/web/src/ui/`. Copy the shadcn composition pattern. Do not install solid-ui, solidcn, CVA, `cn()`, Lucide, or a registry CLI. Do not take shadcn's zinc/New York look.
- Primitives are `@kobalte/core` parts wrapped with StyleX (`stylex.attrs`). Variants are StyleX style objects, not CVA. Call sites import the wrappers, not `@kobalte/core/*`.
- Catalog is only what the canvas uses: Button, AlertDialog, DropdownMenu, Popover, TextField, Select, Combobox, ToggleGroup, Slider. Grow the folder when a screen needs a new primitive. No barrel `index.ts`. Do not add Toast or Tooltip.
- Visual language stays the locked X/Twitter dark skin (near-black, charcoal lines, system sans, Twitter-blue accents). Do not use X branding (𝕏 / Chirp). Pixi stays the map. Color, radius, shadow, glass blur, and the menu gutter live in `src/theme.ts`. StyleX `defineVars` in `tokens.stylex.ts` repeats those CSS strings because the compiler requires literals. Pixi imports `theme.ts`. Toolbar, inspector, zoom, minimap, empty states, and the top-right status pill stay layout in `canvas/`. The app menu trigger is `xkeep` plus a chevron (`radius.md`, not a pill); the menu panel floats with `space.gutter`. The status pill sits top-right only while import or embedding work is pending, and shifts left when the inspector is open.
- Form controls in that UI are Kobalte (Select, Combobox, TextField, ToggleGroup, Slider), not native `<select>` / datalist.

## Consequences

- `@kobalte/core` is a `@xkeep/web` dependency (`^0.13.13`). Peer `solid-js ^1.9.8` matches Solid 1.9.15.
- Playwright locators that assumed native `<select>` (`selectOption`) must use listbox options. Dialog, menu, and labeled search/tag handles stay the same roles and names.
- Overlay positioning uses Kobalte's Floating UI portals instead of page-absolute panels. Action feedback sits on the control that caused it (a hint line above a button or menu item, empty-card or app-menu import results, dialog errors). Do not add Toast, Tooltip, or any corner/global alert.
- StyleX emits CSS layers (`priority1`, …). Unlayered `reset.css` would beat those layers, so `button { color: inherit }` painted ink on solid buttons (white on white) and stole outline/danger colors. `reset.css` is `@layer reset`. Vite `useCSSLayers.before` is `["reset"]` so StyleX owns color, font, and border.
