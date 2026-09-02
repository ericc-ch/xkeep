import { fileURLToPath } from "node:url"
import { layer as sqliteClientLayer } from "@effect/sql-sqlite-node/SqliteClient"
import { count, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import * as SQLiteNodeDrizzle from "drizzle-orm/effect-sqlite-node"
import { migrate } from "drizzle-orm/effect-sqlite-node/migrator"
import { Context, Data, Effect, FileSystem, Layer } from "effect"
import type { Bookmark } from "../dump/parse-graphql.ts"
import { AppConfig, EMBED_DIMS } from "../config.ts"
import { bookmarks } from "./schema.ts"

export { EffectDrizzleQueryError }

export type BookmarkRow = {
  readonly id: string
  readonly author: string
  readonly handle: string
  readonly avatar: string
  readonly text: string
  readonly timestamp: string
  readonly mediaJson: string
  readonly hashtagsJson: string
  readonly urlsJson: string
  readonly quotedJson: string | undefined
  readonly stillPath: string | undefined
  readonly embedding: Uint8Array | undefined
}

export class EmbeddingDimsError extends Data.TaggedError("EmbeddingDimsError")<{
  readonly expected: number
  readonly actual: number
}> {}

export class Library extends Context.Service<
  Library,
  {
    readonly counts: () => Effect.Effect<
      { bookmarks: number; embedded: number },
      EffectDrizzleQueryError
    >
    readonly upsert: (
      bookmark: Bookmark,
      stillPath: string | undefined,
    ) => Effect.Effect<"inserted" | "updated", EffectDrizzleQueryError>
    readonly setEmbedding: (
      id: string,
      embedding: Float32Array,
    ) => Effect.Effect<void, EffectDrizzleQueryError | EmbeddingDimsError>
    readonly missingEmbeddings: () => Effect.Effect<
      ReadonlyArray<{
        readonly id: string
        readonly text: string
        readonly stillPath: string | undefined
      }>,
      EffectDrizzleQueryError
    >
    readonly searchRows: () => Effect.Effect<ReadonlyArray<BookmarkRow>, EffectDrizzleQueryError>
  }
>()("Library") {}

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url))

const sqliteLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(config.dataDir, { recursive: true })
    yield* fs.makeDirectory(config.mediaDir, { recursive: true })
    yield* fs.makeDirectory(config.importsDir, { recursive: true })
    return sqliteClientLayer({ filename: config.sqlitePath })
  }),
)

const make = Effect.fn("Library.make")(function* () {
  const db = yield* SQLiteNodeDrizzle.makeWithDefaults()
  yield* migrate(db, { migrationsFolder })
  return Library.of({
    counts: Effect.fn("library.counts")(function* () {
      const nBookmarks = yield* db.$count(bookmarks)
      const embedded = yield* db.$count(bookmarks, isNotNull(bookmarks.embedding))
      return { bookmarks: nBookmarks, embedded }
    }),
    upsert: Effect.fn("library.upsert")(function* (
      bookmark: Bookmark,
      stillPath: string | undefined,
    ) {
      const existing = yield* db
        .select({ n: count() })
        .from(bookmarks)
        .where(eq(bookmarks.id, bookmark.id))
      const existed = existing[0]?.n ?? 0
      yield* db
        .insert(bookmarks)
        .values({
          id: bookmark.id,
          author: bookmark.author,
          handle: bookmark.handle,
          avatar: bookmark.avatar,
          text: bookmark.text,
          timestamp: bookmark.timestamp,
          mediaJson: JSON.stringify(bookmark.media),
          hashtagsJson: JSON.stringify(bookmark.hashtags),
          urlsJson: JSON.stringify(bookmark.urls),
          quotedJson: bookmark.quoted === undefined ? null : JSON.stringify(bookmark.quoted),
          stillPath: stillPath ?? null,
        })
        .onConflictDoUpdate({
          target: bookmarks.id,
          set: {
            author: sql`excluded.author`,
            handle: sql`excluded.handle`,
            avatar: sql`excluded.avatar`,
            text: sql`excluded.text`,
            timestamp: sql`excluded.timestamp`,
            mediaJson: sql`excluded.media_json`,
            hashtagsJson: sql`excluded.hashtags_json`,
            urlsJson: sql`excluded.urls_json`,
            quotedJson: sql`excluded.quoted_json`,
            stillPath: sql`COALESCE(excluded.still_path, ${bookmarks.stillPath})`,
            embedding: sql`CASE
          WHEN ${bookmarks.text} = excluded.text
           AND ${bookmarks.mediaJson} = excluded.media_json
           AND COALESCE(excluded.still_path, ${bookmarks.stillPath}) IS ${bookmarks.stillPath}
          THEN ${bookmarks.embedding}
          ELSE NULL
        END`,
          },
        })
      return existed > 0 ? ("updated" as const) : ("inserted" as const)
    }),
    setEmbedding: Effect.fn("library.setEmbedding")(function* (
      id: string,
      embedding: Float32Array,
    ) {
      if (embedding.length !== EMBED_DIMS) {
        return yield* new EmbeddingDimsError({
          expected: EMBED_DIMS,
          actual: embedding.length,
        })
      }
      yield* db
        .update(bookmarks)
        .set({
          embedding: Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength),
        })
        .where(eq(bookmarks.id, id))
    }),
    missingEmbeddings: Effect.fn("library.missingEmbeddings")(function* () {
      const rows = yield* db
        .select({
          id: bookmarks.id,
          text: bookmarks.text,
          stillPath: bookmarks.stillPath,
        })
        .from(bookmarks)
        .where(isNull(bookmarks.embedding))
      return rows.map((row) => ({
        id: row.id,
        text: row.text,
        stillPath: row.stillPath ?? undefined,
      }))
    }),
    searchRows: Effect.fn("library.searchRows")(function* () {
      const rows = yield* db.select().from(bookmarks)
      return rows.map((row) => ({
        id: row.id,
        author: row.author,
        handle: row.handle,
        avatar: row.avatar,
        text: row.text,
        timestamp: row.timestamp,
        mediaJson: row.mediaJson,
        hashtagsJson: row.hashtagsJson,
        urlsJson: row.urlsJson,
        quotedJson: row.quotedJson ?? undefined,
        stillPath: row.stillPath ?? undefined,
        embedding: row.embedding ?? undefined,
      }))
    }),
  })
})

export const layer = Layer.effect(Library, make()).pipe(Layer.provide(sqliteLayer))
