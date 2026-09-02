import { Effect } from "effect"
import { EMBED_DIMS } from "../config.ts"
import { Llama } from "../embed/llama.ts"
import { Library } from "../library/library.ts"

export type SearchHit = {
  readonly id: string
  readonly handle: string
  readonly author: string
  readonly text: string
  readonly score: number
  readonly stillPath?: string
}

const asFloat32 = (bytes: Uint8Array): Float32Array | undefined => {
  if (bytes.byteLength !== EMBED_DIMS * 4) return undefined
  const aligned = bytes.byteOffset % 4 === 0 ? bytes : bytes.slice()
  if (aligned.byteLength !== EMBED_DIMS * 4) return undefined
  return new Float32Array(aligned.buffer, aligned.byteOffset, EMBED_DIMS)
}

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
  const library = yield* Library
  const llama = yield* Llama
  const qvecs = yield* llama.embed([{ text: q, stillPath: undefined }], "query")
  const qvec = qvecs[0]
  if (qvec === undefined || qvec.length !== EMBED_DIMS) {
    return { hits: [] as Array<SearchHit> }
  }
  const scored: Array<SearchHit> = []
  const rows = yield* library.searchRows()
  for (const row of rows) {
    if (row.embedding === undefined) continue
    const vec = asFloat32(row.embedding)
    if (vec === undefined) continue
    const hit: SearchHit = {
      id: row.id,
      handle: row.handle,
      author: row.author,
      text: row.text,
      score: cosine(qvec, vec),
    }
    if (row.stillPath !== undefined) {
      scored.push({ ...hit, stillPath: row.stillPath })
    } else {
      scored.push(hit)
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return { hits: scored.slice(0, 20) }
})
