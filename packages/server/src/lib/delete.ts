import { Clock, Effect, FileSystem, Path } from "effect"
import { Bus } from "../bus.ts"
import { AppConfig } from "../config.ts"
import { Bookmarks } from "../db/bookmarks.ts"
import { rungPath, STILL_RUNGS } from "./thumbs.ts"

export const deleteBookmarks = Effect.fn("deleteBookmarks")(function* (ids: ReadonlyArray<string>) {
  const bookmarks = yield* Bookmarks
  const config = yield* AppConfig
  const fs = yield* FileSystem.FileSystem
  const pathMod = yield* Path.Path
  const bus = yield* Bus
  const now = yield* Clock.currentTimeMillis
  const removed = yield* bookmarks.deleteMany(ids, new Date(now).toISOString())
  const mediaNames = yield* fs.readDirectory(config.mediaDir)
  for (const row of removed) {
    const paths = new Set(row.stillPaths)
    for (const stillPath of row.stillPaths) {
      for (const rung of STILL_RUNGS) paths.add(rungPath(stillPath, rung, pathMod))
    }
    for (const name of mediaNames) {
      if (name.startsWith(`${row.id}-`)) paths.add(pathMod.join(config.mediaDir, name))
    }
    for (const path of paths) yield* fs.remove(path, { force: true })
  }
  if (removed.length > 0) {
    yield* bus.publish({ event: "bookmark.deleted", data: { ids: removed.map((row) => row.id) } })
  }
  return { deleted: removed.length }
})
