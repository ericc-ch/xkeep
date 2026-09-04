#!/usr/bin/env nub

import { NodeFileSystem, NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer, Option } from "effect"
import { Command, Flag } from "effect/unstable/cli"
import { AppConfig } from "./config.ts"
import { serverLayer } from "./http/server.ts"
import packageJson from "../package.json" with { type: "json" }

const serveFlags = {
  host: Flag.string("host").pipe(Flag.optional, Flag.withMetavar("HOST")),
  port: Flag.integer("port").pipe(Flag.optional, Flag.withMetavar("PORT")),
  dataDir: Flag.string("data-dir").pipe(Flag.optional, Flag.withMetavar("DIR")),
  cacheDir: Flag.string("cache-dir").pipe(Flag.optional, Flag.withMetavar("DIR")),
  llamaPort: Flag.integer("llama-port").pipe(Flag.optional, Flag.withMetavar("PORT")),
}

const command = Command.make(
  "x-bookmarks",
  serveFlags,
  Effect.fn("serveHandler")(function* ({ cacheDir, dataDir, host, llamaPort, port }) {
    return yield* Effect.never.pipe(
      Effect.provide(
        serverLayer.pipe(
          Layer.provide(
            AppConfig.layer({
              host: Option.getOrUndefined(host),
              port: Option.getOrUndefined(port),
              dataDir: Option.getOrUndefined(dataDir),
              cacheDir: Option.getOrUndefined(cacheDir),
              llamaPort: Option.getOrUndefined(llamaPort),
            }).pipe(Layer.provide(NodeFileSystem.layer)),
          ),
        ),
      ),
    )
  }),
).pipe(
  Command.withShortDescription("Local X bookmarks library"),
  Command.withDescription(
    "Start the local library HTTP server (OpenAPI at /openapi.json, docs at /docs).",
  ),
)

NodeRuntime.runMain(
  Command.run(command, { version: packageJson.version }).pipe(Effect.provide(NodeServices.layer)),
)
