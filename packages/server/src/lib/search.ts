import { Effect } from "effect"
import { EMBED_DIMS } from "../config.ts"
import { Bookmarks, embeddingVector } from "../db/bookmarks.ts"
import { Llama } from "../embed/llama.ts"

const cosine = (a: Float32Array, b: Float32Array): number => {
  let s = 0
  for (let i = 0; i < EMBED_DIMS; i++) {
    const av = a[i]
    const bv = b[i]
    if (av === undefined || bv === undefined) return 0
    s += av * bv
  }
  return s
}

export const search = Effect.fn("search")(function* (q: string) {
  const bookmarks = yield* Bookmarks
  const llama = yield* Llama
  const qvecs = yield* llama.embed([{ text: q, stillPaths: [] }], "query")
  const qvec = qvecs[0]
  if (qvec === undefined || qvec.length !== EMBED_DIMS) {
    return { hits: [] }
  }
  const hits: Array<{
    readonly id: string
    readonly handle: string
    readonly author: string
    readonly text: string
    readonly score: number
  }> = []
  const rows = yield* bookmarks.embedded()
  for (const row of rows) {
    const vec = embeddingVector(row.embedding)
    if (vec === undefined) continue
    hits.push({
      id: row.id,
      handle: row.handle,
      author: row.author,
      text: row.text,
      score: cosine(qvec, vec),
    })
  }
  hits.sort((a, b) => b.score - a.score)
  return { hits: hits.slice(0, 20) }
})
