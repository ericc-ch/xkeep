import { UMAP } from "umap-js"
import { Effect } from "effect"
import { kmeans } from "ml-kmeans"
import { Bookmarks, embeddingVector } from "../db/bookmarks.ts"

export const DEFAULT_CLUSTER_K = 12

let session: UMAP | undefined

const pairsOf = (
  fitted: ReadonlyArray<ReadonlyArray<number>>,
): ReadonlyArray<readonly [number, number]> =>
  fitted.map((pair) => [pair[0] ?? 0, pair[1] ?? 0] as const)

const umap = (n: number) =>
  new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(15, Math.max(1, n - 1)),
    minDist: 0.1,
  })

const projectFresh = (
  vectors: ReadonlyArray<Float32Array>,
): ReadonlyArray<readonly [number, number]> => {
  const n = vectors.length
  if (n === 0) return []
  if (n === 1) return [[0, 0]]
  const data = vectors.map((vec) => Array.from(vec))
  if (session === undefined) {
    session = umap(n)
    return pairsOf(session.fit(data))
  }
  try {
    return pairsOf(session.transform(data))
  } catch {
    session = umap(n)
    return pairsOf(session.fit(data))
  }
}

const loadEmbedded = Effect.fn("loadEmbedded")(function* () {
  const store = yield* Bookmarks
  const counts = yield* store.counts()
  const rows = yield* store.embedded()
  const embedded: Array<{
    readonly id: string
    readonly vec: Float32Array
    readonly x: number | undefined
    readonly y: number | undefined
  }> = []
  let skippedUnembedded = counts.bookmarks - rows.length
  for (const row of rows) {
    const vec = embeddingVector(row.embedding)
    if (vec === undefined) {
      skippedUnembedded += 1
      continue
    }
    embedded.push({ id: row.id, vec, x: row.projX, y: row.projY })
  }
  return { embedded, skippedUnembedded, store }
})

export const projectBookmarks = Effect.fn("projectBookmarks")(function* () {
  const { embedded, store } = yield* loadEmbedded()
  const fresh = embedded.filter((row) => row.x === undefined || row.y === undefined)
  if (fresh.length === 0) return
  const coords = projectFresh(fresh.map((row) => row.vec))
  const points: Array<{ readonly id: string; readonly x: number; readonly y: number }> = []
  for (let i = 0; i < fresh.length; i++) {
    const row = fresh[i]
    const xy = coords[i]
    if (row === undefined || xy === undefined) continue
    points.push({ id: row.id, x: xy[0], y: xy[1] })
  }
  yield* store.setProjections(points)
})

export const clusterBookmarks = Effect.fn("clusterBookmarks")(function* (input: {
  readonly k?: number | undefined
}) {
  const k = input.k ?? DEFAULT_CLUSTER_K
  const { embedded, skippedUnembedded } = yield* loadEmbedded()
  const groups =
    embedded.length === 0
      ? []
      : kmeans(
          embedded.map((row) => Array.from(row.vec)),
          Math.min(k, embedded.length),
          {},
        ).clusters
  const members: Array<{
    readonly id: string
    readonly x: number
    readonly y: number
    readonly groupId: number
  }> = []
  for (let i = 0; i < embedded.length; i++) {
    const row = embedded[i]
    const groupId = groups[i]
    if (row === undefined || groupId === undefined || row.x === undefined || row.y === undefined)
      continue
    members.push({ id: row.id, x: row.x, y: row.y, groupId })
  }
  return { members, skippedUnembedded }
})
