import { Effect, FileSystem, Layer, Path } from "effect"
import { Llama, LlamaEmbedError, LlamaState } from "./llama.ts"
import { Bookmarks } from "../db/bookmarks.ts"
import { Bus } from "../bus.ts"
import { LLAMA_PARALLEL } from "../config.ts"
import { projectBookmarks } from "../lib/cluster.ts"
import { ensureStillRungs, rungPath } from "../lib/thumbs.ts"

const backfillRungs = Effect.fn("backfillRungs")(function* (limit: number) {
  const bookmarks = yield* Bookmarks
  const fs = yield* FileSystem.FileSystem
  const pathMod = yield* Path.Path
  const rows = yield* bookmarks.list()
  let wrote = 0
  for (const row of rows) {
    if (wrote >= limit) return
    for (const stillPath of row.stillPaths) {
      if (wrote >= limit) return
      const ready = rungPath(stillPath, 256, pathMod)
      if (yield* fs.exists(ready)) continue
      yield* ensureStillRungs(stillPath)
      wrote += 1
    }
  }
})

const drainOnce = Effect.fn("drainOnce")(function* () {
  const bookmarks = yield* Bookmarks
  const llama = yield* Llama
  const state = yield* llama.state()
  return yield* LlamaState.$match(state, {
    starting: () => Effect.sleep("500 millis"),
    unavailable: () => Effect.sleep("5 seconds"),
    ready: () =>
      Effect.gen(function* () {
        const missing = yield* bookmarks.missingEmbeddings()
        if (missing.length === 0) {
          yield* backfillRungs(16)
          yield* Effect.sleep("1 second")
          return
        }
        const chunk = missing.slice(0, LLAMA_PARALLEL)
        for (const row of chunk) {
          for (const stillPath of row.stillPaths) {
            yield* ensureStillRungs(stillPath)
          }
        }
        const vectors = yield* llama.embed(
          chunk.map((row) => ({ text: row.text, stillPaths: row.stillPaths })),
          "document",
        )
        if (vectors.length !== chunk.length) {
          return yield* new LlamaEmbedError({
            reason: `embed batch length mismatch: got ${String(vectors.length)} want ${String(chunk.length)}`,
          })
        }
        const ids: Array<string> = []
        for (let i = 0; i < chunk.length; i++) {
          const row = chunk[i]
          const vec = vectors[i]
          if (row === undefined || vec === undefined) {
            return yield* new LlamaEmbedError({ reason: "embed batch index missing" })
          }
          yield* bookmarks.setEmbedding(row.id, vec)
          ids.push(row.id)
        }
        yield* projectBookmarks()
        const bus = yield* Bus
        yield* bus.publish({ event: "bookmark.embedded", data: { ids } })
      }),
  })
})

export const drainEmbeddings = Effect.fn("drainEmbeddings")(function* () {
  return yield* Effect.forever(
    drainOnce().pipe(
      Effect.catchCause((cause) =>
        Effect.logError(cause).pipe(Effect.andThen(Effect.sleep("2 seconds"))),
      ),
    ),
  )
})

export const drainLayer = Layer.effectDiscard(Effect.forkScoped(drainEmbeddings()))
