import { Data, Effect, FileSystem, Option, Path } from "effect"
import { Headers, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { AppConfig } from "../config.ts"
import type { BookmarkDump } from "../dump/parse-graphql.ts"
import { Bookmarks } from "../bookmarks/bookmarks.ts"
import { firstStillUrl, isAllowedStillUrl, stillExtension } from "../media/still.ts"

export class ImportError extends Data.TaggedError("ImportError")<{
  readonly reason: string
}> {}

const TWIMG_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const MAX_STILL_REDIRECTS = 5

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

export const importDump = Effect.fn("importDump")(function* (dump: BookmarkDump) {
  const config = yield* AppConfig
  const fs = yield* FileSystem.FileSystem
  const pathMod = yield* Path.Path
  const bookmarks = yield* Bookmarks
  const fileName = `${dump.captured_at.replaceAll(":", "-")}.json`
  const dest = pathMod.join(config.importsDir, fileName)
  yield* fs
    .writeFileString(dest, JSON.stringify(dump))
    .pipe(Effect.mapError(() => new ImportError({ reason: "could not write import copy" })))
  let imported = 0
  let updated = 0
  let stills = 0
  let stillFailed = 0
  for (const bookmark of dump.bookmarks) {
    const url = firstStillUrl(bookmark)
    let stillPath: string | undefined
    if (url !== undefined) {
      const destStill = pathMod.join(config.mediaDir, `${bookmark.id}${stillExtension(url)}`)
      const downloaded = yield* downloadStill(url, destStill).pipe(Effect.option)
      if (Option.isSome(downloaded)) {
        stillPath = downloaded.value
        stills += 1
      } else {
        stillFailed += 1
      }
    }
    const result = yield* bookmarks.upsert(bookmark, stillPath)
    if (result === "inserted") imported += 1
    else updated += 1
  }
  const missing = yield* bookmarks.missingEmbeddings()
  return {
    imported,
    updated,
    stills,
    stillFailed,
    pendingEmbeddings: missing.length,
  }
})
