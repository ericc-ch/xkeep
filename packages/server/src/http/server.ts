import { createServer } from "node:http"
import { NodeFileSystem, NodeHttpClient, NodeHttpServer, NodePath } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { AppConfig, type AppConfigOverrides } from "../config.ts"
import { layer as loggerLayer } from "../log.ts"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"
import { drainLayer } from "../embed/drain.ts"
import { layer as llamaLayer } from "../embed/llama.ts"
import { layer as bookmarksLayer } from "../db/bookmarks.ts"
import { layer as tagsLayer } from "../db/tags.ts"
import { Bus } from "../bus.ts"
import { Import } from "../lib/import.ts"
import { DOCS_PATH, OPENAPI_PATH } from "./schema.ts"
import { Api } from "./api.ts"
import { handlers } from "./handlers.ts"

export { AppConfig, type AppConfigOverrides } from "../config.ts"

export const apiLayer = HttpApiBuilder.layer(Api, { openapiPath: OPENAPI_PATH }).pipe(
  Layer.provide(handlers),
)

export const serverLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    return HttpRouter.serve(
      Layer.mergeAll(apiLayer, HttpApiScalar.layer(Api, { path: DOCS_PATH }), drainLayer),
    ).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(tagsLayer),
      Layer.provide(Bus.layer),
      Layer.provide(Import.layer),
      Layer.provide(llamaLayer),
      Layer.provide(NodeHttpClient.layerNodeHttp),
      Layer.provide(NodePath.layer),
      Layer.provideMerge(
        NodeHttpServer.layer(() => createServer(), { host: config.host, port: config.port }),
      ),
    )
  }),
)

export const layer = (overrides: AppConfigOverrides) =>
  serverLayer.pipe(
    Layer.provideMerge(loggerLayer),
    Layer.provideMerge(AppConfig.layer(overrides).pipe(Layer.provideMerge(NodeFileSystem.layer))),
  )
