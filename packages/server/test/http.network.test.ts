import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  NodeChildProcessSpawner,
  NodeFileSystem,
  NodeHttpClient,
  NodeHttpServer,
  NodePath,
} from "@effect/platform-node"
import { afterAll, describe, expect, it } from "vitest"
import { Data, Effect, FileSystem, Layer, Schema } from "effect"
import { HttpApiClient, HttpApiTest } from "effect/unstable/httpapi"
import { AppConfig } from "../src/config.ts"
import { layer as bookmarksLayer } from "../src/db/bookmarks.ts"
import { layer as tagsLayer } from "../src/db/tags.ts"
import { drainLayer } from "../src/embed/drain.ts"
import { layerTest as llamaLayerTest } from "../src/embed/llama.ts"
import { Api } from "../src/http/api.ts"
import { handlers } from "../src/http/handlers.ts"
import { Bus } from "../src/bus.ts"
import { Import } from "../src/lib/import.ts"
import { BookmarkDump } from "../src/schema.ts"
import dumpJson from "./fixtures/media-dump.json" with { type: "json" }

const dataDir = mkdtempSync(join(tmpdir(), "xkeep-network-e2e-"))
const canaryId = "1890000000000000123"
const dump = Schema.decodeUnknownSync(BookmarkDump)(dumpJson)

const appConfigLayer = AppConfig.layer({
  dataDir,
  logDir: dataDir,
  configPath: `${dataDir}/config.json`,
}).pipe(Layer.provide(NodeFileSystem.layer))

const networkLayer = Layer.mergeAll(handlers, drainLayer).pipe(
  Layer.provide(bookmarksLayer),
  Layer.provide(tagsLayer),
  Layer.provide(Bus.layer),
  Layer.provide(Import.layer),
  Layer.provide(llamaLayerTest),
  Layer.provide(NodeHttpClient.layerNodeHttp),
  Layer.provide(NodePath.layer),
  Layer.provide(NodeChildProcessSpawner.layer),
  Layer.provide(appConfigLayer),
  Layer.provideMerge(NodeFileSystem.layer),
  Layer.provideMerge(NodeHttpServer.layerHttpServices),
)

const run = <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(Layer.fresh(networkLayer)))) as Effect.Effect<A, E>,
  )

class ImportTimeout extends Data.TaggedError("ImportTimeout")<{
  readonly reason: string
}> {}

const waitUntilImportIdle = Effect.fn("waitUntilImportIdle")(function* (
  client: HttpApiClient.ForApi<typeof Api>,
) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const health = yield* client.health()
    if (health.import._tag === "idle") return
    yield* Effect.sleep("100 millis")
  }
  return yield* new ImportTimeout({ reason: "media download did not finish" })
})

afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

describe("live media integration", () => {
  it("downloads a still from pbs.twimg.com", async () => {
    rmSync(dataDir, { recursive: true, force: true })
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["xkeep"])
        const result = yield* client.importDump({ payload: dump })
        expect(result).toMatchObject({ imported: 1, stillsPending: 1 })
        yield* waitUntilImportIdle(client)
        const fs = yield* FileSystem.FileSystem
        expect(yield* fs.exists(`${dataDir}/media/${canaryId}-0.jpg`)).toBe(true)
      }),
    )
  }, 30_000)
})
