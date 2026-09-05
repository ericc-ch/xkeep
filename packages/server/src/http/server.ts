import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import {
  NodeChildProcessSpawner,
  NodeFileSystem,
  NodeHttpClient,
  NodeHttpServer,
  NodePath,
} from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { AppConfig, type AppConfigOverrides } from "../config.ts"
import { layer as loggerLayer } from "../log.ts"
import { HttpMiddleware, HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/unstable/http"
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

const corsLayer = HttpRouter.middleware(
  (httpApp) =>
    HttpMiddleware.cors()(httpApp).pipe(
      Effect.map((response) =>
        HttpServerResponse.setHeader(response, "access-control-allow-private-network", "true"),
      ),
    ),
  { global: true },
)

export const serverLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    const webRoot = fileURLToPath(new URL("../../../web/dist", import.meta.url))
    return HttpRouter.serve(
      Layer.mergeAll(
        apiLayer,
        HttpApiScalar.layer(Api, { path: DOCS_PATH }),
        drainLayer,
        HttpStaticServer.layer({ root: webRoot, spa: true }),
        corsLayer,
      ),
    ).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(tagsLayer),
      Layer.provide(Bus.layer),
      Layer.provide(Import.layer),
      Layer.provide(llamaLayer),
      Layer.provide(NodeHttpClient.layerNodeHttp),
      Layer.provide(NodePath.layer),
      Layer.provide(NodeChildProcessSpawner.layer),
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
