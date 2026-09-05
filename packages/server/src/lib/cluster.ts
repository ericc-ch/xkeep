import { UMAP } from "umap-js"
import { Effect } from "effect"
import { EMBED_DIMS } from "../config.ts"
import { Bookmarks, embeddingVector } from "../db/bookmarks.ts"

export const DEFAULT_CLUSTER_K = 12

const kmeans = (
  vectors: ReadonlyArray<Float32Array>,
  k: number,
  random: () => number,
): ReadonlyArray<number> => {
  const n = vectors.length
  if (n === 0) return []
  const groups = Math.min(k, n)
  const centroids: Array<Float32Array> = []
  const used = new Set<number>()
  while (centroids.length < groups) {
    const index = Math.floor(random() * n)
    if (used.has(index)) continue
    const source = vectors[index]
    if (source === undefined) continue
    used.add(index)
    centroids.push(new Float32Array(source))
  }
  const assign = Array.from({ length: n }, () => 0)
  for (let iter = 0; iter < 20; iter++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      const vec = vectors[i]
      if (vec === undefined) continue
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      for (let c = 0; c < centroids.length; c++) {
        const centroid = centroids[c]
        if (centroid === undefined) continue
        let dist = 0
        for (let d = 0; d < EMBED_DIMS; d++) {
          const a = vec[d] ?? 0
          const b = centroid[d] ?? 0
          const delta = a - b
          dist += delta * delta
        }
        if (dist < bestDist) {
          bestDist = dist
          best = c
        }
      }
      if (assign[i] !== best) {
        assign[i] = best
        moved = true
      }
    }
    const sums = centroids.map(() => new Float32Array(EMBED_DIMS))
    const counts = centroids.map(() => 0)
    for (let i = 0; i < n; i++) {
      const vec = vectors[i]
      const group = assign[i]
      const sum = group === undefined ? undefined : sums[group]
      if (vec === undefined || group === undefined || sum === undefined) continue
      counts[group] = (counts[group] ?? 0) + 1
      for (let d = 0; d < EMBED_DIMS; d++) {
        sum[d] = (sum[d] ?? 0) + (vec[d] ?? 0)
      }
    }
    for (let c = 0; c < centroids.length; c++) {
      const centroid = centroids[c]
      const sum = sums[c]
      const count = counts[c] ?? 0
      if (centroid === undefined || sum === undefined || count === 0) continue
      for (let d = 0; d < EMBED_DIMS; d++) {
        centroid[d] = (sum[d] ?? 0) / count
      }
    }
    if (!moved) break
  }
  return assign
}

let session: UMAP | undefined

const pairsOf = (fitted: ReadonlyArray<ReadonlyArray<number>>): ReadonlyArray<readonly [number, number]> =>
  fitted.map((pair) => [pair[0] ?? 0, pair[1] ?? 0] as const)

const umap = (n: number) =>
  new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(15, Math.max(1, n - 1)),
    minDist: 0.1,
  })

const projectFresh = (vectors: ReadonlyArray<Float32Array>): ReadonlyArray<readonly [number, number]> => {
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
  readonly random?: (() => number) | undefined
}) {
  const k = input.k ?? DEFAULT_CLUSTER_K
  const random = input.random ?? Math.random
  const { embedded, skippedUnembedded } = yield* loadEmbedded()
  const groups = kmeans(
    embedded.map((row) => row.vec),
    k,
    random,
  )
  const members: Array<{ readonly id: string; readonly x: number; readonly y: number; readonly groupId: number }> = []
  for (let i = 0; i < embedded.length; i++) {
    const row = embedded[i]
    const groupId = groups[i]
    if (row === undefined || groupId === undefined || row.x === undefined || row.y === undefined) continue
    members.push({ id: row.id, x: row.x, y: row.y, groupId })
  }
  return { members, skippedUnembedded }
})
