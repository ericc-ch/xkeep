import { DatabaseSync,  } from "node:sqlite"
import { Context, Data, Effect, FileSystem, Layer, Schema, Semaphore } from "effect"
import type { Bookmark } from "../dump/parse-graphql.ts"
import { AppConfig, EMBED_DIMS } from "../config.ts"

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

export class LibraryError extends Data.TaggedError("LibraryError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

export class Library extends Context.Service<
  Library,
  {
    readonly counts: () => Effect.Effect<{ bookmarks: number; embedded: number }, LibraryError>
    readonly upsert: (
      bookmark: Bookmark,
      stillPath: string | undefined,
    ) => Effect.Effect<"inserted" | "updated", LibraryError>
    readonly setEmbedding: (
      id: string,
      embedding: Float32Array,
    ) => Effect.Effect<void, LibraryError>
    readonly missingEmbeddings: () => Effect.Effect<
      ReadonlyArray<{
        readonly id: string
        readonly text: string
        readonly stillPath: string | undefined
      }>,
      LibraryError
    >
    readonly searchRows: () => Effect.Effect<ReadonlyArray<BookmarkRow>, LibraryError>
  }
>()("Library") {}

const schema = `
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  handle TEXT NOT NULL,
  avatar TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  media_json TEXT NOT NULL,
  hashtags_json TEXT NOT NULL,
  urls_json TEXT NOT NULL,
  quoted_json TEXT,
  still_path TEXT,
  embedding BLOB
);
`

const CountRow = Schema.Struct({ n: Schema.Number })
const MissingRow = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  still_path: Schema.NullOr(Schema.String),
})
const BookmarkSqlRow = Schema.Struct({
  id: Schema.String,
  author: Schema.String,
  handle: Schema.String,
  avatar: Schema.String,
  text: Schema.String,
  timestamp: Schema.String,
  media_json: Schema.String,
  hashtags_json: Schema.String,
  urls_json: Schema.String,
  quoted_json: Schema.NullOr(Schema.String),
  still_path: Schema.NullOr(Schema.String),
  embedding: Schema.NullOr(Schema.Uint8Array),
})
const ExistsRow = Schema.Struct({ n: Schema.Number })

const decodeRow = <A>(
  operation: string,
  schemaRow: Schema.Codec<A>,
  row: unknown,
): Effect.Effect<A, LibraryError> =>
  Schema.decodeUnknownEffect(schemaRow)(row).pipe(
    Effect.mapError((cause) => new LibraryError({ operation, cause })),
  )

const sqlite = <A>(operation: string, run: () => A): Effect.Effect<A, LibraryError> =>
  Effect.try({
    try: run,
    catch: (cause) => new LibraryError({ operation, cause }),
  })

export const layer = Layer.effect(
  Library,
  Effect.gen(function* () {
    const config = yield* AppConfig
    const fs = yield* FileSystem.FileSystem
    const lock = yield* Semaphore.make(1)
    yield* fs.makeDirectory(config.dataDir, { recursive: true })
    yield* fs.makeDirectory(config.mediaDir, { recursive: true })
    yield* fs.makeDirectory(config.importsDir, { recursive: true })
    const db = new DatabaseSync(config.sqlitePath)
    yield* sqlite("pragma", () => {
      db.exec("PRAGMA journal_mode = WAL")
      db.exec(schema)
    })
    yield* Effect.addFinalizer(() => Effect.sync(() => db.close()))

    const existsStmt = db.prepare(`SELECT COUNT(*) AS n FROM bookmarks WHERE id = ?`)
    const upsertStmt = db.prepare(`
      INSERT INTO bookmarks (
        id, author, handle, avatar, text, timestamp,
        media_json, hashtags_json, urls_json, quoted_json, still_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        author = excluded.author,
        handle = excluded.handle,
        avatar = excluded.avatar,
        text = excluded.text,
        timestamp = excluded.timestamp,
        media_json = excluded.media_json,
        hashtags_json = excluded.hashtags_json,
        urls_json = excluded.urls_json,
        quoted_json = excluded.quoted_json,
        still_path = COALESCE(excluded.still_path, bookmarks.still_path),
        embedding = CASE
          WHEN bookmarks.text = excluded.text
           AND bookmarks.media_json = excluded.media_json
           AND COALESCE(excluded.still_path, bookmarks.still_path) IS bookmarks.still_path
          THEN bookmarks.embedding
          ELSE NULL
        END
    `)
    const embedStmt = db.prepare(`UPDATE bookmarks SET embedding = ? WHERE id = ?`)
    const countStmt = db.prepare(`SELECT COUNT(*) AS n FROM bookmarks`)
    const embeddedStmt = db.prepare(
      `SELECT COUNT(*) AS n FROM bookmarks WHERE embedding IS NOT NULL`,
    )
    const missingStmt = db.prepare(
      `SELECT id, text, still_path FROM bookmarks WHERE embedding IS NULL`,
    )
    const allStmt = db.prepare(
      `SELECT id, author, handle, avatar, text, timestamp, media_json, hashtags_json, urls_json, quoted_json, still_path, embedding FROM bookmarks`,
    )

    const withLock = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      lock.withPermits(1)(effect)

    return {
      counts: Effect.fn("library.counts")(function* () {
        return yield* withLock(
          Effect.gen(function* () {
            const bookmarksRow = yield* sqlite("counts", () => countStmt.get())
            const bookmarks = yield* decodeRow("counts", CountRow, bookmarksRow)
            const embeddedRow = yield* sqlite("embedded", () => embeddedStmt.get())
            const embedded = yield* decodeRow("embedded", CountRow, embeddedRow)
            return { bookmarks: bookmarks.n, embedded: embedded.n }
          }),
        )
      }),
      upsert: Effect.fn("library.upsert")(function* (
        bookmark: Bookmark,
        stillPath: string | undefined,
      ) {
        return yield* withLock(
          Effect.gen(function* () {
            const existedRow = yield* sqlite("exists", () => existsStmt.get(bookmark.id))
            const existed = yield* decodeRow("exists", ExistsRow, existedRow)
            yield* sqlite("upsert", () =>
              upsertStmt.run(
                bookmark.id,
                bookmark.author,
                bookmark.handle,
                bookmark.avatar,
                bookmark.text,
                bookmark.timestamp,
                JSON.stringify(bookmark.media),
                JSON.stringify(bookmark.hashtags),
                JSON.stringify(bookmark.urls),
                bookmark.quoted === undefined ? null : JSON.stringify(bookmark.quoted),
                stillPath ?? null,
              ),
            )
            return existed.n > 0 ? ("updated" as const) : ("inserted" as const)
          }),
        )
      }),
      setEmbedding: Effect.fn("library.setEmbedding")(function* (
        id: string,
        embedding: Float32Array,
      ) {
        return yield* withLock(
          Effect.gen(function* () {
            if (embedding.length !== EMBED_DIMS) {
              return yield* new LibraryError({
                operation: "setEmbedding",
                cause: `expected ${String(EMBED_DIMS)} dims, got ${String(embedding.length)}`,
              })
            }
            yield* sqlite("setEmbedding", () =>
              embedStmt.run(
                Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength),
                id,
              ),
            )
          }),
        )
      }),
      missingEmbeddings: Effect.fn("library.missingEmbeddings")(function* () {
        return yield* withLock(
          Effect.gen(function* () {
            const rows = yield* sqlite("missing", () => missingStmt.all())
            const decoded = yield* decodeRow("missing", Schema.Array(MissingRow), rows)
            return decoded.map((row) => ({
              id: row.id,
              text: row.text,
              stillPath: row.still_path ?? undefined,
            }))
          }),
        )
      }),
      searchRows: Effect.fn("library.searchRows")(function* () {
        return yield* withLock(
          Effect.gen(function* () {
            const rows = yield* sqlite("searchRows", () => allStmt.all())
            const decoded = yield* decodeRow("searchRows", Schema.Array(BookmarkSqlRow), rows)
            return decoded.map((row) => ({
              id: row.id,
              author: row.author,
              handle: row.handle,
              avatar: row.avatar,
              text: row.text,
              timestamp: row.timestamp,
              mediaJson: row.media_json,
              hashtagsJson: row.hashtags_json,
              urlsJson: row.urls_json,
              quotedJson: row.quoted_json ?? undefined,
              stillPath: row.still_path ?? undefined,
              embedding: row.embedding ?? undefined,
            }))
          }),
        )
      }),
    }
  }),
)
