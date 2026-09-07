import { basename, resolve, sep } from "node:path"
import { Effect, FileSystem, Option, Schema, Stream } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { Bus } from "../bus.ts"
import { AppConfig } from "../config.ts"
import { Bookmarks, type BookmarkListRow, type BookmarkRow } from "../db/bookmarks.ts"
import { Tags } from "../db/tags.ts"
import { Llama } from "../embed/llama.ts"
import { clusterBookmarks, DEFAULT_CLUSTER_K } from "../lib/cluster.ts"
import { deleteBookmarks } from "../lib/delete.ts"
import { importDump, Import } from "../lib/import.ts"
import { search } from "../lib/search.ts"
import { BookmarkCodec, Media } from "../schema.ts"
import { BookmarkNotFound, ImportStatus, MediaNotFound } from "./schema.ts"
import { Api } from "./api.ts"

const mediaHref = (absPath: string): string => `/api/media/${basename(absPath)}`

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const decodeMedia = (value: string) =>
  Option.getOrElse(
    Schema.decodeUnknownOption(Schema.Array(Media))(parseJson(value) ?? []),
    () => [],
  )

const decodeStrings = (value: string) =>
  Option.getOrElse(
    Schema.decodeUnknownOption(Schema.Array(Schema.String))(parseJson(value) ?? []),
    () => [],
  )

const mediaTypesOf = (row: { readonly mediaJson: string; readonly urlsJson: string }) => {
  const media = decodeMedia(row.mediaJson)
  const urls = decodeStrings(row.urlsJson)
  const types = new Set<"text" | "photo" | "video" | "gif" | "link">()
  for (const item of media) types.add(item.type)
  if (urls.length > 0) types.add("link")
  if (types.size === 0) types.add("text")
  return [...types]
}

const listItem = (row: BookmarkListRow) => {
  const first = row.stillPaths[0]
  return {
    id: row.id,
    author: row.author,
    handle: row.handle,
    avatar: row.avatar,
    text: row.text,
    timestamp: row.timestamp,
    mediaTypes: mediaTypesOf(row),
    tags: row.tags,
    ...(first === undefined ? {} : { still: mediaHref(first) }),
    embedded: row.embedded,
    ...(row.projX === undefined || row.projY === undefined ? {} : { x: row.projX, y: row.projY }),
  }
}

const detail = (row: BookmarkRow, tags: ReadonlyArray<string>) => {
  const quoted =
    row.quotedJson === undefined
      ? undefined
      : Option.getOrUndefined(Schema.decodeUnknownOption(BookmarkCodec)(parseJson(row.quotedJson)))
  return {
    id: row.id,
    author: row.author,
    handle: row.handle,
    avatar: row.avatar,
    text: row.text,
    timestamp: row.timestamp,
    media: decodeMedia(row.mediaJson),
    hashtags: decodeStrings(row.hashtagsJson),
    urls: decodeStrings(row.urlsJson),
    ...(quoted === undefined ? {} : { quoted }),
    stills: row.stillPaths.map(mediaHref),
    tags,
    embedded: row.embedding !== undefined,
    ...(row.projX === undefined || row.projY === undefined ? {} : { x: row.projX, y: row.projY }),
  }
}

export const handlers = HttpApiBuilder.group(Api, "xkeep", (group) =>
  group
    .handle(
      "health",
      Effect.fn("health")(
        function* () {
          const bookmarks = yield* Bookmarks
          const llama = yield* Llama
          const counts = yield* bookmarks.counts()
          const gate = yield* Import
          const llamaState = yield* llama.state()
          const importRunning = yield* gate.running()
          return {
            status: "ok" as const,
            bookmarks: counts.bookmarks,
            embedded: counts.embedded,
            llama: llamaState,
            import: importRunning ? ImportStatus.running() : ImportStatus.idle(),
          }
        },
        Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
      ),
    )
    .handle(
      "importDump",
      Effect.fn("importDump")(
        function* (ctx) {
          return yield* importDump(ctx.payload)
        },
        Effect.catchTags({
          ImportBusy: (error) => error,
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "search",
      Effect.fn("search")(
        function* (ctx) {
          return yield* search(ctx.query.q)
        },
        Effect.catchTags({
          LlamaUnavailable: () => new HttpApiError.ServiceUnavailable(),
          LlamaEmbedError: () => new HttpApiError.ServiceUnavailable(),
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "events",
      Effect.fn("events")(function* () {
        const bus = yield* Bus
        return Stream.make({ event: "server.connected" as const, data: {} }).pipe(
          Stream.concat(
            Stream.merge(
              bus.subscribe(),
              Stream.tick("15 seconds").pipe(
                Stream.map(() => ({ event: "heartbeat" as const, data: {} })),
              ),
            ),
          ),
        )
      }),
    )
    .handle(
      "listBookmarks",
      Effect.fn("listBookmarks")(
        function* () {
          const bookmarks = yield* Bookmarks
          const rows = yield* bookmarks.list()
          return { bookmarks: rows.map(listItem) }
        },
        Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
      ),
    )
    .handle(
      "getBookmark",
      Effect.fn("getBookmark")(
        function* (ctx) {
          const bookmarks = yield* Bookmarks
          const tags = yield* Tags
          const row = yield* bookmarks.get(ctx.params.id)
          if (row === undefined) return yield* new BookmarkNotFound({ id: ctx.params.id })
          const tagNames = yield* tags.tagsFor(ctx.params.id)
          return detail(row, tagNames)
        },
        Effect.catchTags({
          BookmarkNotFound: (error) => error,
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "deleteBookmarks",
      Effect.fn("deleteBookmarks")(
        function* (ctx) {
          return yield* deleteBookmarks(ctx.payload.ids)
        },
        Effect.catchTags({
          BookmarkNotFound: (error) => error,
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
        Effect.catch(() => new HttpApiError.InternalServerError()),
      ),
    )
    .handle(
      "getMedia",
      Effect.fn("getMedia")(
        function* (ctx) {
          const config = yield* AppConfig
          const fs = yield* FileSystem.FileSystem
          const root = resolve(config.mediaDir)
          const dest = resolve(config.mediaDir, ctx.params.name)
          if (dest === root || !dest.startsWith(`${root}${sep}`)) {
            return yield* new MediaNotFound({ name: ctx.params.name })
          }
          if (!(yield* fs.exists(dest))) return yield* new MediaNotFound({ name: ctx.params.name })
          const bytes = yield* fs.readFile(dest)
          if (bytes === undefined) return yield* new MediaNotFound({ name: ctx.params.name })
          return bytes
        },
        Effect.catchTags({
          MediaNotFound: (error) => error,
        }),
        Effect.catch(() => new HttpApiError.InternalServerError()),
      ),
    )
    .handle(
      "listTags",
      Effect.fn("listTags")(
        function* () {
          const tags = yield* Tags
          return { tags: yield* tags.list() }
        },
        Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
      ),
    )
    .handle(
      "renameTag",
      Effect.fn("renameTag")(
        function* (ctx) {
          const tags = yield* Tags
          return yield* tags.renameTag(ctx.params.tag, ctx.payload.tag)
        },
        Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
      ),
    )
    .handle(
      "replaceBookmarkTags",
      Effect.fn("replaceBookmarkTags")(
        function* (ctx) {
          const tags = yield* Tags
          yield* tags.replaceBookmarkTags(ctx.params.id, ctx.payload.tags)
          return { tags: ctx.payload.tags }
        },
        Effect.catchTags({
          BookmarkNotFound: (error) => error,
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "addBookmarkTag",
      Effect.fn("addBookmarkTag")(
        function* (ctx) {
          const tags = yield* Tags
          yield* tags.addBookmarkTag(ctx.params.id, ctx.params.tag)
        },
        Effect.catchTags({
          BookmarkNotFound: (error) => error,
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "removeBookmarkTag",
      Effect.fn("removeBookmarkTag")(
        function* (ctx) {
          const tags = yield* Tags
          yield* tags.removeBookmarkTag(ctx.params.id, ctx.params.tag)
        },
        Effect.catchTags({
          BookmarkNotFound: (error) => error,
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "bulkApplyTag",
      Effect.fn("bulkApplyTag")(
        function* (ctx) {
          const tags = yield* Tags
          return yield* tags.applyToMembers(ctx.payload.memberIds, ctx.payload.tag)
        },
        Effect.catchTags({
          BookmarkNotFound: (error) => error,
          EffectDrizzleQueryError: () => new HttpApiError.InternalServerError(),
        }),
      ),
    )
    .handle(
      "cluster",
      Effect.fn("cluster")(
        function* (ctx) {
          return yield* clusterBookmarks({ k: ctx.query.k ?? DEFAULT_CLUSTER_K })
        },
        Effect.catchTag("EffectDrizzleQueryError", () => new HttpApiError.InternalServerError()),
      ),
    ),
)
