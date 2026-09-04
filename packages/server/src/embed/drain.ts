import { Effect, Layer } from "effect"
import { Llama, LlamaEmbedError, LlamaState } from "./llama.ts"
import { Bookmarks } from "../bookmarks/bookmarks.ts"

const BATCH = 8

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
          yield* Effect.sleep("1 second")
          return
        }
        const chunk = missing.slice(0, BATCH)
        const vectors = yield* llama.embed(
          chunk.map((row) => ({ text: row.text, stillPath: row.stillPath })),
          "document",
        )
        if (vectors.length !== chunk.length) {
          return yield* new LlamaEmbedError({
            reason: `embed batch length mismatch: got ${String(vectors.length)} want ${String(chunk.length)}`,
          })
        }
        for (let i = 0; i < chunk.length; i++) {
          const row = chunk[i]
          const vec = vectors[i]
          if (row === undefined || vec === undefined) {
            return yield* new LlamaEmbedError({ reason: "embed batch index missing" })
          }
          yield* bookmarks.setEmbedding(row.id, vec)
        }
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
