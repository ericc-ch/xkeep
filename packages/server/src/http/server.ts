import { createServer } from "node:http"
import { NodeHttpClient, NodeHttpServer } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { AppConfig } from "../config.ts"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"
import { drainLayer } from "../embed/drain.ts"
import { layer as llamaLayer } from "../embed/llama.ts"
import { layer as bookmarksLayer } from "../bookmarks/bookmarks.ts"
import { Api } from "./api.ts"
import { handlers } from "./handlers.ts"

export const apiLayer = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(handlers),
)

export const serverLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    return HttpRouter.serve(
      Layer.mergeAll(apiLayer, HttpApiScalar.layer(Api, { path: "/docs" }), drainLayer),
    ).pipe(
      Layer.provide(bookmarksLayer),
      Layer.provide(llamaLayer),
      Layer.provide(NodeHttpClient.layerNodeHttp),
      Layer.provideMerge(
        NodeHttpServer.layer(() => createServer(), { host: config.host, port: config.port }),
      ),
    )
  }),
)
