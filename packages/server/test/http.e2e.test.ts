import { rmSync } from "node:fs"
import { NodeFileSystem, NodeHttpClient, NodeHttpServer, NodePath } from "@effect/platform-node"
import { describe, expect, it } from "vitest"
import { Data, Effect, FileSystem, Layer, Option, Schema, Stream } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http"
import { HttpApiClient, HttpApiTest } from "effect/unstable/httpapi"
import { AppConfig } from "../src/config.ts"
import { BookmarkDump } from "../src/schema.ts"
import { drainLayer } from "../src/embed/drain.ts"
import { layerTest as llamaLayerTest } from "../src/embed/llama.ts"
import { Api } from "../src/http/api.ts"
import { handlers } from "../src/http/handlers.ts"
import { apiLayer } from "../src/http/server.ts"
import { layer as bookmarksLayer } from "../src/db/bookmarks.ts"
import { layer as tagsLayer } from "../src/db/tags.ts"
import { Bus } from "../src/bus.ts"
import { Import } from "../src/lib/import.ts"
import dumpJson from "./fixtures/dump.json" with { type: "json" }

const dataDir = "/tmp/xkeep-e2e"
const canaryId = "1890000000000000123"
const canaryText = "xkeep e2e canary quartz-vector-7"

const dump = Schema.decodeUnknownSync(BookmarkDump)(dumpJson)

const appConfigLayer = AppConfig.layer({
  dataDir,
  logDir: dataDir,
  configPath: `${dataDir}/config.json`,
}).pipe(Layer.provide(NodeFileSystem.layer))

const e2eLayer = Layer.mergeAll(handlers, drainLayer).pipe(
  Layer.provide(bookmarksLayer),
  Layer.provide(tagsLayer),
  Layer.provide(Bus.layer),
  Layer.provide(Import.layer),
  Layer.provide(llamaLayerTest),
  Layer.provide(NodeHttpClient.layerNodeHttp),
  Layer.provide(NodePath.layer),
  Layer.provide(appConfigLayer),
  Layer.provideMerge(NodeFileSystem.layer),
  Layer.provideMerge(NodeHttpServer.layerHttpServices),
)

const run = <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(Layer.fresh(e2eLayer)))) as Effect.Effect<A, E>,
  )

const resetDataDir = () => {
  rmSync(dataDir, { recursive: true, force: true })
}

class EmbedTimeout extends Data.TaggedError("EmbedTimeout")<{
  readonly reason: string
}> {}

class ImportTimeout extends Data.TaggedError("ImportTimeout")<{
  readonly reason: string
}> {}

const waitUntilImportIdle = Effect.fn("waitUntilImportIdle")(function* (
  client: HttpApiClient.ForApi<typeof Api>,
) {
  for (let i = 0; i < 80; i++) {
    const health = yield* client.health()
    if (health.import._tag === "idle") return health
    yield* Effect.sleep("50 millis")
  }
  return yield* new ImportTimeout({ reason: "import stills did not finish" })
})

const waitUntilEmbedded = Effect.fn("waitUntilEmbedded")(function* (
  client: HttpApiClient.ForApi<typeof Api>,
) {
  for (let i = 0; i < 80; i++) {
    const health = yield* client.health()
    if (health.bookmarks > 0 && health.embedded === health.bookmarks) return health
    yield* Effect.sleep("50 millis")
  }
  return yield* new EmbedTimeout({ reason: "embeddings did not catch up" })
})

describe.sequential("HttpApi", () => {
  it("GET /api/health is ready with no bookmarks", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        const health = yield* client.health()
        expect(health).toEqual({
          status: "ok",
          bookmarks: 0,
          embedded: 0,
          llama: { _tag: "ready" },
          import: { _tag: "idle" },
        })
      }),
    )
  }, 30_000)

  it("POST /api/imports downloads a still", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        const result = yield* client.importDump({ payload: dump })
        expect(result.imported).toBe(1)
        expect(result.stillsPending).toBe(1)
        yield* waitUntilImportIdle(client)
        const fs = yield* FileSystem.FileSystem
        expect(yield* fs.exists(`${dataDir}/media/${canaryId}-0.jpg`)).toBe(true)
      }),
    )
  }, 30_000)

  it("polls /api/health until embeddings catch up", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        yield* waitUntilImportIdle(client)
        const health = yield* waitUntilEmbedded(client)
        expect(health.embedded).toBe(health.bookmarks)
      }),
    )
  }, 30_000)

  it("GET /api/search ranks the imported tweet first", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        yield* waitUntilImportIdle(client)
        yield* waitUntilEmbedded(client)
        const result = yield* client.search({ query: { q: canaryText } })
        const first = result.hits[0]
        expect(first?.id).toBe(canaryId)
      }),
    )
  }, 30_000)

  it("POST /api/imports of the same ids reports updated", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        yield* waitUntilImportIdle(client)
        const again = yield* client.importDump({ payload: dump })
        expect(again.imported).toBe(0)
        expect(again.updated).toBe(1)
      }),
    )
  }, 30_000)

  it("POST /api/imports of a second dump while stills run returns 409", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        const second = yield* client.importDump({ payload: dump }).pipe(Effect.exit)
        expect(second._tag).toBe("Failure")
      }),
    )
  }, 30_000)

  it("GET /api/bookmarks lists the imported tweet", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        yield* waitUntilImportIdle(client)
        const listed = yield* client.listBookmarks()
        expect(listed.bookmarks).toHaveLength(1)
        expect(listed.bookmarks[0]?.id).toBe(canaryId)
        expect(listed.bookmarks[0]?.still).toBe(`/api/media/${canaryId}-0.jpg`)
        const bytes = yield* client.getMedia({ params: { name: `${canaryId}-0.jpg` } })
        expect(bytes.byteLength).toBeGreaterThan(0)
      }),
    )
  }, 30_000)

  it("GET /api/events names the first event server.connected", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        const first = yield* Stream.runHead(yield* client.events())
        expect(Option.getOrThrow(first).event).toBe("server.connected")
      }),
    )
  }, 30_000)

  it("rejects duplicate root tag names and tag cycles", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        const parent = yield* client.createTag({ payload: { name: "gpu" } })
        const clash = yield* client.createTag({ payload: { name: "gpu" } }).pipe(Effect.exit)
        expect(clash._tag).toBe("Failure")
        const child = yield* client.createTag({ payload: { name: "kernels", parentId: parent.id } })
        const cycle = yield* client
          .updateTag({ params: { id: parent.id }, payload: { parentId: child.id } })
          .pipe(Effect.exit)
        expect(cycle._tag).toBe("Failure")
        yield* client.deleteTag({ params: { id: parent.id } })
        const listed = yield* client.listTags()
        expect(listed.tags).toHaveLength(1)
        expect(listed.tags[0]?.id).toBe(child.id)
        expect(listed.tags[0]?.parentId).toBeUndefined()
      }),
    )
  }, 30_000)

  it("PUT /api/bookmarks/:id/tags rejects duplicate ids", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        yield* waitUntilImportIdle(client)
        const tag = yield* client.createTag({ payload: { name: "gpu" } })
        const dup = yield* client
          .replaceBookmarkTags({
            params: { id: canaryId },
            payload: { tagIds: [tag.id, tag.id] },
          })
          .pipe(Effect.exit)
        expect(dup._tag).toBe("Failure")
      }),
    )
  }, 30_000)

  it("tags apply and cluster after embed", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        yield* waitUntilImportIdle(client)
        yield* waitUntilEmbedded(client)
        const tag = yield* client.createTag({ payload: { name: "gpu" } })
        yield* client.addBookmarkTag({ params: { id: canaryId, tagId: tag.id } })
        const one = yield* client.getBookmark({ params: { id: canaryId } })
        expect(one.tagIds).toEqual([tag.id])
        const clustered = yield* client.cluster({ query: {} })
        expect(clustered.skippedUnembedded).toBe(0)
        expect(clustered.members).toHaveLength(1)
        expect(clustered.members[0]?.id).toBe(canaryId)
        const listed = yield* client.listBookmarks()
        expect(listed.bookmarks[0]?.x).toBeTypeOf("number")
        expect(listed.bookmarks[0]?.tagIds).toEqual([tag.id])
      }),
    )
  }, 30_000)

  it("POST /api/imports with a bad payload returns 400", async () => {
    resetDataDir()
    const listenLayer = HttpRouter.serve(apiLayer, {
      disableListenLog: true,
      disableLogger: true,
    }).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(tagsLayer),
      Layer.provide(Bus.layer),
      Layer.provide(Import.layer),
      Layer.provide(llamaLayerTest),
      Layer.provide(NodePath.layer),
      Layer.provide(appConfigLayer),
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient
          const response = yield* client.execute(
            HttpClientRequest.post("/api/imports").pipe(
              HttpClientRequest.bodyText("{}", "application/json"),
            ),
          )
          expect(response.status).toBe(400)
        }).pipe(Effect.provide(Layer.fresh(listenLayer))),
      ) as Effect.Effect<void>,
    )
  }, 30_000)

  it("GET /api/media/.. is rejected", async () => {
    resetDataDir()
    const listenLayer = HttpRouter.serve(apiLayer, {
      disableListenLog: true,
      disableLogger: true,
    }).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(tagsLayer),
      Layer.provide(Bus.layer),
      Layer.provide(Import.layer),
      Layer.provide(llamaLayerTest),
      Layer.provide(NodePath.layer),
      Layer.provide(appConfigLayer),
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient
          const response = yield* client.execute(HttpClientRequest.get("/api/media/.."))
          expect(response.status).toBe(404)
        }).pipe(Effect.provide(Layer.fresh(listenLayer))),
      ) as Effect.Effect<void>,
    )
  }, 30_000)

  it("GET /api/clusters?k=nope returns 400", async () => {
    resetDataDir()
    const listenLayer = HttpRouter.serve(apiLayer, {
      disableListenLog: true,
      disableLogger: true,
    }).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(tagsLayer),
      Layer.provide(Bus.layer),
      Layer.provide(Import.layer),
      Layer.provide(llamaLayerTest),
      Layer.provide(NodePath.layer),
      Layer.provide(appConfigLayer),
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient
          const bad = yield* client.execute(HttpClientRequest.get("/api/clusters?k=nope"))
          expect(bad.status).toBe(400)
          const zero = yield* client.execute(HttpClientRequest.get("/api/clusters?k=0"))
          expect(zero.status).toBe(400)
        }).pipe(Effect.provide(Layer.fresh(listenLayer))),
      ) as Effect.Effect<void>,
    )
  }, 30_000)
})
