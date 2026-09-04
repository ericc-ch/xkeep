# ADR 0007: Drizzle + Effect sqlite

## Status

Accepted (2026-09-02)

## Context

The bookmarks sqlite port talked to `node:sqlite` with a `CREATE TABLE` string, prepared statements, and Effect Schema on driver rows. Tags, clusters, and filters need more tables and real migrations. Drizzle ORM `1.0.0-rc.4` has `drizzle-orm/effect-sqlite-node` on `@effect/sql-sqlite-node`.

## Decision

- Effect `4.0.0-rc.112` with matching `@effect/platform-node` and `@effect/sql-sqlite-node`.
- Pin `drizzle-orm@1.0.0-rc.4`. `Bookmarks` is the port over the bookmarks table. HTTP/CLI do not import Drizzle.
- `sqliteTable` is the SQL shape. No Effect Schema decode of sqlite rows. `BookmarkRow` stays on `Bookmarks`.
- SQL failures leak as `EffectDrizzleQueryError` / `SqlError` / `MigratorInitError`. Wrong embedding length is `EmbeddingDimsError`. Handlers map those to HTTP 500. No wrapper error type.
- drizzle-kit generates into `packages/server/drizzle/`. `Bookmarks` boot runs `migrate()`. This cut wipes existing sqlite (e2e already wipes). Later schema changes are kit generate + migrate, not a baseline stamp.
- Re-import upsert still nulls `embedding` unless text, media JSON, and still paths are unchanged.

## Consequences

Devs run kit generate when the table changes. Server applies pending SQL on boot. Old sqlite files from before this ADR are deleted, not migrated.
