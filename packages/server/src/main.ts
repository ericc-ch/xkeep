#!/usr/bin/env nub

import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Option } from "effect"
import { Command, Flag } from "effect/unstable/cli"
import { runServer } from "./run-server.ts"
import packageJson from "../package.json" with { type: "json" }

const command = Command.make(
  "x-bookmarks",
  {
    host: Flag.string("host").pipe(Flag.optional, Flag.withMetavar("HOST")),
    port: Flag.integer("port").pipe(Flag.optional, Flag.withMetavar("PORT")),
    dataDir: Flag.string("data-dir").pipe(Flag.optional, Flag.withMetavar("DIR")),
    cacheDir: Flag.string("cache-dir").pipe(Flag.optional, Flag.withMetavar("DIR")),
    llamaPort: Flag.integer("llama-port").pipe(Flag.optional, Flag.withMetavar("PORT")),
  },
  Effect.fn("serveHandler")(function* ({ cacheDir, dataDir, host, llamaPort, port }) {
    return yield* runServer({
      host: Option.getOrUndefined(host),
      port: Option.getOrUndefined(port),
      dataDir: Option.getOrUndefined(dataDir),
      cacheDir: Option.getOrUndefined(cacheDir),
      llamaPort: Option.getOrUndefined(llamaPort),
    })
  }),
).pipe(
  Command.withShortDescription("Local X bookmarks HTTP server"),
  Command.withDescription(
    "Start the local bookmarks HTTP server (OpenAPI at /openapi.json, docs at /docs).",
  ),
)

NodeRuntime.runMain(
  Command.run(command, { version: packageJson.version }).pipe(Effect.provide(NodeServices.layer)),
)
