import { rmSync } from "node:fs"
import { NodeFileSystem, NodeHttpClient, NodeHttpServer } from "@effect/platform-node"
import { describe, expect, it } from "vitest"
import { Data, Effect, FileSystem, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http"
import { HttpApiClient, HttpApiTest } from "effect/unstable/httpapi"
import { AppConfig } from "../src/config.ts"
import { BookmarkDump } from "../src/dump/parse-graphql.ts"
import { drainLayer } from "../src/embed/drain.ts"
import { layerTest as llamaLayerTest } from "../src/embed/llama.ts"
import { Api } from "../src/http/api.ts"
import { handlers } from "../src/http/handlers.ts"
import { apiLayer } from "../src/http/server.ts"
import { layer as bookmarksLayer } from "../src/bookmarks/bookmarks.ts"
import dumpJson from "./fixtures/dump.json" with { type: "json" }

const dataDir = "/tmp/xkeep-e2e"
const canaryId = "1890000000000000123"
const canaryText = "xkeep e2e canary quartz-vector-7"

const dump = Schema.decodeUnknownSync(BookmarkDump)(dumpJson)

const appConfigLayer = AppConfig.layer({
  dataDir,
  configPath: `${dataDir}/config.json`,
}).pipe(Layer.provide(NodeFileSystem.layer))

const e2eLayer = Layer.mergeAll(handlers, drainLayer).pipe(
  Layer.provide(bookmarksLayer),
  Layer.provide(llamaLayerTest),
  Layer.provide(NodeHttpClient.layerNodeHttp),
  Layer.provide(appConfigLayer),
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
  it("GET /health is ready with no bookmarks", async () => {
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
        })
      }),
    )
  }, 30_000)

  it("POST /imports downloads a still", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        const result = yield* client.importDump({ payload: dump })
        expect(result.imported).toBe(1)
        expect(result.stills).toBe(1)
        expect(result.stillFailed).toBe(0)
        const fs = yield* FileSystem.FileSystem
        expect(yield* fs.exists(`${dataDir}/media/${canaryId}.jpg`)).toBe(true)
      }),
    )
  }, 30_000)

  it("polls /health until embeddings catch up", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        const health = yield* waitUntilEmbedded(client)
        expect(health.embedded).toBe(health.bookmarks)
      }),
    )
  }, 30_000)

  it("GET /search ranks the imported tweet first", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        yield* waitUntilEmbedded(client)
        const result = yield* client.search({ query: { q: canaryText } })
        const first = result.hits[0]
        expect(first?.id).toBe(canaryId)
      }),
    )
  }, 30_000)

  it("POST /imports of the same ids reports updated", async () => {
    resetDataDir()
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        yield* client.importDump({ payload: dump })
        const again = yield* client.importDump({ payload: dump })
        expect(again.imported).toBe(0)
        expect(again.updated).toBe(1)
      }),
    )
  }, 30_000)

  it("POST /imports with a bad payload returns 400", async () => {
    resetDataDir()
    const listenLayer = HttpRouter.serve(apiLayer, {
      disableListenLog: true,
      disableLogger: true,
    }).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(llamaLayerTest),
      Layer.provide(appConfigLayer),
      Layer.provideMerge(NodeHttpServer.layerTest),
    )
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient
          const response = yield* client.execute(
            HttpClientRequest.post("/imports").pipe(
              HttpClientRequest.bodyText("{}", "application/json"),
            ),
          )
          expect(response.status).toBe(400)
        }).pipe(Effect.provide(Layer.fresh(listenLayer))),
      ) as Effect.Effect<void>,
    )
  }, 30_000)
})
