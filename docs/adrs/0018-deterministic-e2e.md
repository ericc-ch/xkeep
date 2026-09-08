# ADR 0018: Deterministic HTTP and browser E2E

## Status

Accepted (2026-09-08).

## Context

The HTTP suite downloaded a live X image on every run, while the verification skill hand-drove stable canvas workflows through an extension-connected browser. Those checks were useful during discovery but slow or environment-sensitive as permanent regression proof. Production packaging also lacked an executable artifact smoke test.

## Decision

- `nub run check` is the single deterministic verification gate. It runs typecheck, network-free Vitest, lint, format check, one production build, and `test:e2e:built`.
- Native Playwright E2E serves the production web build over the real Effect HTTP/SSE/SQLite stack. It replaces only llama.cpp with the deterministic test embedding layer and uses local no-media fixtures, a fixed browser clock/viewport, an ephemeral port, and a unique temporary data directory.
- The browser suite covers the graduated feature map: import/status, navigation and persistence, search/filters/overlays, selection/tags/copy/export, and deletion/tombstones. Browser errors and failing HTTP responses are test failures.
- Playwright resolves a local Chromium-family browser with `which`; `XKEEP_E2E_BROWSER` can override it. Helium is the expected browser on the current NixOS host, with an installed Playwright browser as fallback when present.
- The E2E gate also smoke-tests the built CLI entry point and executable bit, default server export resolution to `dist`, and the Vite HTML artifact.
- Default HTTP fixtures contain no remote media. The live pbs.twimg.com download canary is isolated behind `nub run test:integration:network` and is not part of `check`.
- The project verification skill remains for exploratory gaps and durable manual evidence. Graduated repeatable paths delegate to native E2E rather than keeping a parallel browser-driving script.

## Consequences

Local and CI checks no longer depend on X media availability, a browser extension relay, the production embedding model, or the normal xkeep data directory. Browser coverage adds roughly one minute to `check`, but replaces a longer manual verification workflow and validates the exact production build once. Network integration remains available on demand without weakening the deterministic gate.
