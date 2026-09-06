import { mkdirSync, rmSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath } from "node:url"
import { SqliteClient, layer as sqliteClientLayer } from "@effect/sql-sqlite-node/SqliteClient"
import * as SQLiteNodeDrizzle from "drizzle-orm/effect-sqlite-node"
import { migrate } from "drizzle-orm/effect-sqlite-node/migrator"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

const dataDir = "/tmp/xkeep-mig-test"
const file = `${dataDir}/xkeep.sqlite`
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url))

const seedLegacy = () => {
  rmSync(dataDir, { recursive: true, force: true })
  mkdirSync(dataDir, { recursive: true })
  const legacy = new DatabaseSync(file)
  legacy.exec(`
    CREATE TABLE \`bookmarks\` (
      \`id\` text PRIMARY KEY,
      \`author\` text NOT NULL,
      \`handle\` text NOT NULL,
      \`avatar\` text NOT NULL,
      \`text\` text NOT NULL,
      \`timestamp\` text NOT NULL,
      \`media_json\` text NOT NULL,
      \`hashtags_json\` text NOT NULL,
      \`urls_json\` text NOT NULL,
      \`quoted_json\` text,
      \`still_path\` text,
      \`embedding\` blob
    );
    ALTER TABLE \`bookmarks\` RENAME COLUMN \`still_path\` TO \`still_paths\`;
    ALTER TABLE \`bookmarks\` ADD \`proj_x\` real;
    ALTER TABLE \`bookmarks\` ADD \`proj_y\` real;
    CREATE TABLE \`bookmark_tags\` (
      \`bookmark_id\` text NOT NULL,
      \`tag_id\` text NOT NULL,
      CONSTRAINT \`bookmark_tags_pk\` PRIMARY KEY(\`bookmark_id\`, \`tag_id\`)
    );
    CREATE TABLE \`tags\` (
      \`id\` text PRIMARY KEY,
      \`name\` text NOT NULL,
      \`parent_id\` text DEFAULT '' NOT NULL,
      CONSTRAINT \`tags_sibling_name\` UNIQUE(\`parent_id\`,\`name\`)
    );
    INSERT INTO bookmarks (id, author, handle, avatar, text, timestamp, media_json, hashtags_json, urls_json)
    VALUES ('111', 'Ada', 'ada', '', 'hello', '2026-01-01', '[]', '[]', '[]');
    INSERT INTO tags (id, name, parent_id) VALUES ('t-gpu', 'gpu', '');
    INSERT INTO tags (id, name, parent_id) VALUES ('t-gpu-2', 'gpu', 't-gpu');
    INSERT INTO tags (id, name, parent_id) VALUES ('t-ml', 'machine learning', '');
    INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ('111', 't-gpu');
    INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ('111', 't-gpu-2');
    INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ('111', 't-ml');
    CREATE TABLE \`__drizzle_migrations\` (
      id INTEGER PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric,
      name text,
      applied_at TEXT
    );
    INSERT INTO __drizzle_migrations (hash, created_at, name, applied_at) VALUES
      ('seed', 1785711688000, '20260902084128_powerful_deathbird', '2026-09-02'),
      ('seed', 1785890816000, '20260904082916_still-paths', '2026-09-04'),
      ('seed', 1786065515000, '20260905025515_cold_edwin_jarvis', '2026-09-05');
  `)
  legacy.close()
}

describe("string-tags migration", () => {
  it("remaps tag ids to names and drops the tags table", async () => {
    seedLegacy()
    await Effect.runPromise(
      Effect.gen(function* () {
        const db = yield* SQLiteNodeDrizzle.makeWithDefaults()
        yield* migrate(db, { migrationsFolder })
        const client = yield* SqliteClient
        const links = yield* client`SELECT tag FROM bookmark_tags ORDER BY tag`
        expect(links.map((row) => row.tag)).toEqual(["gpu", "machine learning"])
        const tables = yield* client`SELECT name FROM sqlite_master WHERE type = 'table'`
        expect(tables.map((row) => row.name)).not.toContain("tags")
      }).pipe(Effect.provide(sqliteClientLayer({ filename: file }))),
    )
  })
})
