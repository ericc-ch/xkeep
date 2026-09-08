import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import {
  NodeFileSystem,
  NodeHttpClient,
  NodeHttpServer,
  NodePath,
  NodeRuntime,
} from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter, HttpStaticServer } from "effect/unstable/http"
import { Bus } from "../../packages/server/src/bus.ts"
import { AppConfig } from "../../packages/server/src/config.ts"
import { layer as bookmarksLayer } from "../../packages/server/src/db/bookmarks.ts"
import { layer as tagsLayer } from "../../packages/server/src/db/tags.ts"
import { drainLayer } from "../../packages/server/src/embed/drain.ts"
import { layerTest as llamaLayerTest } from "../../packages/server/src/embed/llama.ts"
import { apiLayer } from "../../packages/server/src/http/server.ts"
import { Import } from "../../packages/server/src/lib/import.ts"

const NonBlankString = Schema.String.check(
  Schema.makeFilter((value: string) => value.trim() !== "", { expected: "a non-blank string" }),
)
const Environment = Schema.Struct({
  port: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 65535 }),
  ),
  dataDir: NonBlankString,
})
const environment = Schema.decodeUnknownSync(Environment)({
  port: process.env.XKEEP_E2E_PORT,
  dataDir: process.env.XKEEP_E2E_DATA_DIR,
})
const webRoot = fileURLToPath(new URL("../../packages/web/dist", import.meta.url))

const serverLayer = Layer.unwrap(
  Effect.gen(function* () {
    const appConfig = yield* AppConfig
    return HttpRouter.serve(
      Layer.mergeAll(apiLayer, drainLayer, HttpStaticServer.layer({ root: webRoot, spa: true })),
    ).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(tagsLayer),
      Layer.provide(Bus.layer),
      Layer.provide(Import.layer),
      Layer.provide(llamaLayerTest),
      Layer.provide(NodeHttpClient.layerNodeHttp),
      Layer.provide(NodePath.layer),
      Layer.provideMerge(
        NodeHttpServer.layer(() => createServer(), {
          host: "127.0.0.1",
          port: appConfig.port,
        }),
      ),
    )
  }),
)

const configLayer = AppConfig.layer({
  host: "127.0.0.1",
  port: environment.port,
  dataDir: environment.dataDir,
  logDir: environment.dataDir,
}).pipe(Layer.provideMerge(NodeFileSystem.layer))

NodeRuntime.runMain(Layer.launch(serverLayer.pipe(Layer.provideMerge(configLayer))))
