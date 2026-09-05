import { Context, Data, Effect, FileSystem, Layer, Option, Path, Ref } from "effect"
import { Headers, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { AppConfig } from "../config.ts"
import { Bookmarks } from "../db/bookmarks.ts"
import { ImportBusy } from "../http/schema.ts"
import type { Bookmark, BookmarkDump } from "../schema.ts"
import { Bus } from "../bus.ts"

const stillUrls = (bookmark: Bookmark): ReadonlyArray<string> => {
  const urls: Array<string> = []
  for (const item of bookmark.media) {
    if (item.type === "photo") {
      urls.push(item.url)
      continue
    }
    if (item.poster !== undefined) urls.push(item.poster)
  }
  return urls
}

const stillExtension = (url: string): string => {
  const path = url.split("?")[0] ?? url
  const dot = path.lastIndexOf(".")
  if (dot < 0) return ".jpg"
  const ext = path.slice(dot).toLowerCase()
  if (ext === ".jpeg" || ext === ".jpg" || ext === ".png" || ext === ".webp" || ext === ".gif") {
    return ext
  }
  return ".jpg"
}

const isAllowedStillUrl = (url: string): boolean => {
  if (!URL.canParse(url)) return false
  const parsed = new URL(url)
  if (parsed.protocol !== "https:") return false
  const host = parsed.hostname
  return host === "pbs.twimg.com" || host === "video.twimg.com" || host.endsWith(".twimg.com")
}

export class ImportError extends Data.TaggedError("ImportError")<{
  readonly reason: string
}> {}

const TWIMG_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const MAX_STILL_REDIRECTS = 5

export class Import extends Context.Service<Import>()("Import", {
  make: Effect.fn("Import.make")(function* () {
    const busy = yield* Ref.make(false)
    return {
      running: Effect.fn("Import.running")(function* () {
        return yield* Ref.get(busy)
      }),
      begin: Effect.fn("Import.begin")(function* () {
        const acquired = yield* Ref.modify(busy, (on) => [!on, true] as const)
        if (!acquired) {
          return yield* new ImportBusy({ reason: "import already running" })
        }
      }),
      end: Effect.fn("Import.end")(function* () {
        yield* Ref.set(busy, false)
      }),
    }
  }),
}) {
  static layer = Layer.effect(this, this.make())
}

const downloadStill = Effect.fn("downloadStill")(function* (url: string, dest: string) {
  const fs = yield* FileSystem.FileSystem
  if (yield* fs.exists(dest)) return dest
  const client = yield* HttpClient.HttpClient
  let current = url
  for (let hop = 0; hop < MAX_STILL_REDIRECTS; hop++) {
    if (!isAllowedStillUrl(current)) {
      return yield* new ImportError({ reason: "still url host is not allowed" })
    }
    const request = HttpClientRequest.get(current).pipe(
      HttpClientRequest.setHeader("user-agent", TWIMG_UA),
    )
    const response = yield* client.execute(request)
    if (response.status >= 300 && response.status < 400) {
      const location = Headers.get(response.headers, "location")
      if (Option.isNone(location)) {
        return yield* new ImportError({ reason: "still redirect missing location" })
      }
      current = new URL(location.value, current).href
      continue
    }
    yield* HttpClientResponse.filterStatusOk(response)
    const bytes = yield* response.arrayBuffer
    yield* fs.writeFile(dest, new Uint8Array(bytes))
    return dest
  }
  return yield* new ImportError({ reason: "too many still redirects" })
})

const fillStills = Effect.fn("fillStills")(function* (bookmarksIn: ReadonlyArray<Bookmark>) {
  const config = yield* AppConfig
  const pathMod = yield* Path.Path
  const bookmarks = yield* Bookmarks
  let stills = 0
  let stillFailed = 0
  const filled: Array<string> = []
  for (const bookmark of bookmarksIn) {
    const stillPaths: Array<string> = []
    for (const [i, url] of stillUrls(bookmark).entries()) {
      const destStill = pathMod.join(
        config.mediaDir,
        `${bookmark.id}-${String(i)}${stillExtension(url)}`,
      )
      const downloaded = yield* downloadStill(url, destStill).pipe(
        Effect.tapError((error) =>
          Effect.logWarning(
            `still failed id=${bookmark.id} dest=${destStill} url=${url} error=${String(error)}`,
          ),
        ),
        Effect.option,
      )
      if (Option.isSome(downloaded)) {
        stillPaths.push(downloaded.value)
        stills += 1
      } else {
        stillFailed += 1
      }
    }
    if (stillPaths.length > 0) {
      yield* bookmarks.upsert(bookmark, stillPaths)
      filled.push(bookmark.id)
    }
  }
  if (filled.length > 0) {
    const bus = yield* Bus
    yield* bus.publish({ event: "bookmark.upserted", data: { ids: filled } })
  }
  yield* Effect.log(`import stills done stills=${String(stills)} stillFailed=${String(stillFailed)}`)
})

export const importDump = Effect.fn("importDump")(function* (dump: BookmarkDump) {
  const gate = yield* Import
  const config = yield* AppConfig
  const fs = yield* FileSystem.FileSystem
  const pathMod = yield* Path.Path
  const bookmarks = yield* Bookmarks
  yield* gate.begin()
  const fileName = `${dump.captured_at.replaceAll(":", "-")}.json`
  const dest = pathMod.join(config.importsDir, fileName)
  yield* Effect.log(
    `import start sqlite=${config.sqlitePath} copy=${dest} media=${config.mediaDir} bookmarks=${String(dump.bookmarks.length)}`,
  )
  const result = yield* Effect.gen(function* () {
    yield* fs
      .writeFileString(dest, JSON.stringify(dump))
      .pipe(Effect.mapError(() => new ImportError({ reason: "could not write import copy" })))
    yield* Effect.log(`import copy written ${dest}`)
    let imported = 0
    let updated = 0
    let stillsPending = 0
    const ids: Array<string> = []
    for (const bookmark of dump.bookmarks) {
      stillsPending += stillUrls(bookmark).length
      const outcome = yield* bookmarks.upsert(bookmark, [])
      ids.push(bookmark.id)
      if (outcome === "inserted") imported += 1
      else updated += 1
    }
    const bus = yield* Bus
    if (ids.length > 0) {
      yield* bus.publish({ event: "bookmark.upserted", data: { ids } })
    }
    const missing = yield* bookmarks.missingEmbeddings()
    yield* Effect.forkDetach(
      fillStills(dump.bookmarks).pipe(
        Effect.catchCause((cause) => Effect.logError(cause)),
        Effect.ensuring(gate.end()),
      ),
      { startImmediately: true },
    )
    yield* Effect.log(
      `import rows written copy=${dest} imported=${String(imported)} updated=${String(updated)} stillsPending=${String(stillsPending)} pendingEmbeddings=${String(missing.length)}`,
    )
    return {
      imported,
      updated,
      stillsPending,
      pendingEmbeddings: missing.length,
    }
  }).pipe(Effect.tapError(() => gate.end()))
  return result
})
