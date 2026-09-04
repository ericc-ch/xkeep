#!/usr/bin/env nub

import { fileURLToPath } from "node:url"
import { NodeHttpClient, NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, Layer, Option } from "effect"
import { Command, Flag } from "effect/unstable/cli"
import { apiCommand } from "./api-commands.ts"
import { ensureServer, serverStatus, stopServer } from "./ensure.ts"
import packageJson from "../package.json" with { type: "json" }

const cliScript = fileURLToPath(import.meta.url)

const urlFlag = () => Flag.string("url").pipe(Flag.optional, Flag.withMetavar("URL"))

const serveFlags = {
  host: Flag.string("host").pipe(Flag.optional, Flag.withMetavar("HOST")),
  port: Flag.integer("port").pipe(Flag.optional, Flag.withMetavar("PORT")),
  dataDir: Flag.string("data-dir").pipe(Flag.optional, Flag.withMetavar("DIR")),
  cacheDir: Flag.string("cache-dir").pipe(Flag.optional, Flag.withMetavar("DIR")),
  llamaPort: Flag.integer("llama-port").pipe(Flag.optional, Flag.withMetavar("PORT")),
}

const serviceServe = Command.make(
  "serve",
  serveFlags,
  Effect.fn("serviceServe")(function* ({ cacheDir, dataDir, host, llamaPort, port }) {
    const { runServer } = yield* Effect.promise(() => import("@xkeep/server/run-server"))
    return yield* runServer({
      host: Option.getOrUndefined(host),
      port: Option.getOrUndefined(port),
      dataDir: Option.getOrUndefined(dataDir),
      cacheDir: Option.getOrUndefined(cacheDir),
      llamaPort: Option.getOrUndefined(llamaPort),
    })
  }),
).pipe(Command.withDescription("Run the HTTP server in the foreground."))

const serviceStart = Command.make(
  "start",
  { url: urlFlag() },
  Effect.fn("serviceStart")(function* ({ url }) {
    const baseUrl = yield* ensureServer({ url, cliScript })
    yield* Console.log(baseUrl)
  }),
).pipe(Command.withDescription("Ensure the detached server is running."))

const serviceStop = Command.make(
  "stop",
  {},
  Effect.fn("serviceStop")(function* () {
    yield* stopServer()
  }),
).pipe(Command.withDescription("Stop the registered server."))

const serviceRestart = Command.make(
  "restart",
  { url: urlFlag() },
  Effect.fn("serviceRestart")(function* ({ url }) {
    yield* stopServer()
    const baseUrl = yield* ensureServer({ url, cliScript })
    yield* Console.log(baseUrl)
  }),
).pipe(Command.withDescription("Stop the registered server, then start a new one."))

const serviceStatus = Command.make(
  "status",
  {},
  Effect.fn("serviceStatus")(function* () {
    yield* serverStatus()
  }),
).pipe(Command.withDescription("Print registration and health."))

const serviceCommand = Command.make("service").pipe(
  Command.withDescription("Manage the detached xkeep server."),
  Command.withSubcommands([serviceStart, serviceStop, serviceRestart, serviceStatus, serviceServe]),
)

const command = Command.make(
  "xkeep",
  { url: urlFlag() },
  Effect.fn("bareCommand")(function* ({ url }) {
    const baseUrl = yield* ensureServer({ url, cliScript })
    yield* Console.log(baseUrl)
  }),
).pipe(
  Command.withShortDescription("Local X bookmarks app"),
  Command.withDescription(
    "Bare invocation ensures the daemon and prints its url. service manages the process. api calls HTTP.",
  ),
  Command.withSubcommands([serviceCommand, apiCommand]),
)

NodeRuntime.runMain(
  Command.run(command, { version: packageJson.version }).pipe(
    Effect.provide(Layer.merge(NodeServices.layer, NodeHttpClient.layerNodeHttp)),
  ),
)
