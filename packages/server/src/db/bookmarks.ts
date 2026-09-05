import { count, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import * as SQLiteNodeDrizzle from "drizzle-orm/effect-sqlite-node"
import { Context, Data, Effect, Layer } from "effect"
import { EMBED_DIMS } from "../config.ts"
import type { Bookmark } from "../schema.ts"
import { sqliteLayer } from "./db.ts"
import { bookmarkTags, bookmarks } from "./schema.ts"

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
  readonly stillPaths: ReadonlyArray<string>
  readonly embedding: Uint8Array | undefined
  readonly projX: number | undefined
  readonly projY: number | undefined
}

export type BookmarkListRow = Omit<BookmarkRow, "embedding"> & {
  readonly embedded: boolean
  readonly tagIds: ReadonlyArray<string>
}

const stillPathsJson = (paths: ReadonlyArray<string>): string | null =>
  paths.length === 0 ? null : JSON.stringify(paths)

export const embeddingVector = (bytes: Uint8Array): Float32Array | undefined => {
  if (bytes.byteLength !== EMBED_DIMS * 4) return undefined
  const aligned = bytes.byteOffset % 4 === 0 ? bytes : bytes.slice()
  if (aligned.byteLength !== EMBED_DIMS * 4) return undefined
  return new Float32Array(aligned.buffer, aligned.byteOffset, EMBED_DIMS)
}

const parseStillPaths = (value: string | null): ReadonlyArray<string> => {
  if (value === null) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => typeof item === "string")
  } catch {
    return []
  }
}

const contentUnchanged = sql`${bookmarks.text} = excluded.text
           AND ${bookmarks.mediaJson} = excluded.media_json
           AND COALESCE(excluded.still_paths, ${bookmarks.stillPaths}) IS ${bookmarks.stillPaths}`

const keepIfUnchanged = (column: typeof bookmarks.embedding | typeof bookmarks.projX | typeof bookmarks.projY) =>
  sql`CASE WHEN ${contentUnchanged} THEN ${column} ELSE NULL END`

const mapRow = (row: typeof bookmarks.$inferSelect): BookmarkRow => ({
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
  stillPaths: parseStillPaths(row.stillPaths),
  embedding: row.embedding ?? undefined,
  projX: row.projX ?? undefined,
  projY: row.projY ?? undefined,
})

export class EmbeddingDimsError extends Data.TaggedError("EmbeddingDimsError")<{
  readonly expected: number
  readonly actual: number
}> {}

export class Bookmarks extends Context.Service<
  Bookmarks,
  {
    readonly counts: () => Effect.Effect<
      { bookmarks: number; embedded: number },
      EffectDrizzleQueryError
    >
    readonly upsert: (
      bookmark: Bookmark,
      stillPaths: ReadonlyArray<string>,
    ) => Effect.Effect<"inserted" | "updated", EffectDrizzleQueryError>
    readonly setEmbedding: (
      id: string,
      embedding: Float32Array,
    ) => Effect.Effect<void, EffectDrizzleQueryError | EmbeddingDimsError>
    readonly setProjections: (
      points: ReadonlyArray<{ readonly id: string; readonly x: number; readonly y: number }>,
    ) => Effect.Effect<void, EffectDrizzleQueryError>
    readonly missingEmbeddings: () => Effect.Effect<
      ReadonlyArray<{
        readonly id: string
        readonly text: string
        readonly stillPaths: ReadonlyArray<string>
      }>,
      EffectDrizzleQueryError
    >
    readonly embedded: () => Effect.Effect<
      ReadonlyArray<{
        readonly id: string
        readonly handle: string
        readonly author: string
        readonly text: string
        readonly embedding: Uint8Array
      }>,
      EffectDrizzleQueryError
    >
    readonly get: (id: string) => Effect.Effect<BookmarkRow | undefined, EffectDrizzleQueryError>
    readonly list: () => Effect.Effect<ReadonlyArray<BookmarkListRow>, EffectDrizzleQueryError>
  }
>()("Bookmarks") {}

const make = Effect.fn("Bookmarks.make")(function* () {
  const db = yield* SQLiteNodeDrizzle.makeWithDefaults()
  return Bookmarks.of({
    counts: Effect.fn("bookmarks.counts")(function* () {
      const nBookmarks = yield* db.$count(bookmarks)
      const embedded = yield* db.$count(bookmarks, isNotNull(bookmarks.embedding))
      return { bookmarks: nBookmarks, embedded }
    }),
    upsert: Effect.fn("bookmarks.upsert")(function* (
      bookmark: Bookmark,
      stillPaths: ReadonlyArray<string>,
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
          stillPaths: stillPathsJson(stillPaths),
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
            stillPaths: sql`COALESCE(excluded.still_paths, ${bookmarks.stillPaths})`,
            embedding: keepIfUnchanged(bookmarks.embedding),
            projX: keepIfUnchanged(bookmarks.projX),
            projY: keepIfUnchanged(bookmarks.projY),
          },
        })
      return existed > 0 ? ("updated" as const) : ("inserted" as const)
    }),
    setEmbedding: Effect.fn("bookmarks.setEmbedding")(function* (
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
          projX: null,
          projY: null,
        })
        .where(eq(bookmarks.id, id))
    }),
    setProjections: Effect.fn("bookmarks.setProjections")(function* (points) {
      if (points.length === 0) return
      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            for (const point of points) {
              yield* tx
                .update(bookmarks)
                .set({ projX: point.x, projY: point.y })
                .where(eq(bookmarks.id, point.id))
            }
          }),
        )
        .pipe(
          Effect.catchTag(
            "SqlError",
            (cause) => new EffectDrizzleQueryError({ query: "setProjections", params: [], cause }),
          ),
        )
    }),
    missingEmbeddings: Effect.fn("bookmarks.missingEmbeddings")(function* () {
      const rows = yield* db
        .select({
          id: bookmarks.id,
          text: bookmarks.text,
          stillPaths: bookmarks.stillPaths,
        })
        .from(bookmarks)
        .where(isNull(bookmarks.embedding))
      return rows.map((row) => ({
        id: row.id,
        text: row.text,
        stillPaths: parseStillPaths(row.stillPaths),
      }))
    }),
    embedded: Effect.fn("bookmarks.embedded")(function* () {
      const rows = yield* db
        .select({
          id: bookmarks.id,
          handle: bookmarks.handle,
          author: bookmarks.author,
          text: bookmarks.text,
          embedding: bookmarks.embedding,
        })
        .from(bookmarks)
        .where(isNotNull(bookmarks.embedding))
      return rows.flatMap((row) => {
        if (row.embedding === null) return []
        return [
          {
            id: row.id,
            handle: row.handle,
            author: row.author,
            text: row.text,
            embedding: row.embedding,
          },
        ]
      })
    }),
    get: Effect.fn("bookmarks.get")(function* (id: string) {
      const rows = yield* db.select().from(bookmarks).where(eq(bookmarks.id, id))
      const row = rows[0]
      return row === undefined ? undefined : mapRow(row)
    }),
    list: Effect.fn("bookmarks.list")(function* () {
      const rows = yield* db
        .select({
          id: bookmarks.id,
          author: bookmarks.author,
          handle: bookmarks.handle,
          avatar: bookmarks.avatar,
          text: bookmarks.text,
          timestamp: bookmarks.timestamp,
          mediaJson: bookmarks.mediaJson,
          hashtagsJson: bookmarks.hashtagsJson,
          urlsJson: bookmarks.urlsJson,
          quotedJson: bookmarks.quotedJson,
          stillPaths: bookmarks.stillPaths,
          projX: bookmarks.projX,
          projY: bookmarks.projY,
          embedded: sql<number>`CASE WHEN ${bookmarks.embedding} IS NULL THEN 0 ELSE 1 END`,
        })
        .from(bookmarks)
      const links = yield* db.select().from(bookmarkTags)
      const tagsByBookmark = new Map<string, Array<string>>()
      for (const link of links) {
        const current = tagsByBookmark.get(link.bookmarkId) ?? []
        current.push(link.tagId)
        tagsByBookmark.set(link.bookmarkId, current)
      }
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
        stillPaths: parseStillPaths(row.stillPaths),
        embedding: undefined,
        projX: row.projX ?? undefined,
        projY: row.projY ?? undefined,
        embedded: row.embedded === 1,
        tagIds: tagsByBookmark.get(row.id) ?? [],
      }))
    }),
  })
})

export const layer = Layer.effect(Bookmarks, make()).pipe(Layer.provide(sqliteLayer))
