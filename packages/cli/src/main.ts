#!/usr/bin/env nub

import { NodeHttpClient, NodeRuntime, NodeServices } from "@effect/platform-node"
import { Api, BookmarkDump, HTTP_HOST_DEFAULT, HTTP_PORT_DEFAULT } from "@x-bookmarks/server/api"
import { Console, Data, Effect, FileSystem, Layer, Schema } from "effect"
import { Command, Flag } from "effect/unstable/cli"
import { HttpApiClient } from "effect/unstable/httpapi"
import packageJson from "../package.json" with { type: "json" }

class CliError extends Data.TaggedError("CliError")<{
  readonly reason: string
}> {}

const defaultUrl =
  process.env.X_BOOKMARKS_URL || `http://${HTTP_HOST_DEFAULT}:${HTTP_PORT_DEFAULT}`

const importCommand = Command.make(
  "import",
  {
    file: Flag.file("file", { mustExist: true }).pipe(Flag.withMetavar("FILE")),
    url: Flag.string("url").pipe(Flag.withDefault(defaultUrl), Flag.withMetavar("URL")),
  },
  Effect.fn("importCommand")(function* ({ file, url }) {
    const fs = yield* FileSystem.FileSystem
    const raw = yield* fs.readFileString(file)
    const json = yield* Effect.try({
      try: (): unknown => JSON.parse(raw),
      catch: () => new CliError({ reason: "dump is not json" }),
    })
    const dump = yield* Schema.decodeUnknownEffect(BookmarkDump)(json).pipe(
      Effect.mapError(() => new CliError({ reason: "dump failed schema checks" })),
    )
    const client = yield* HttpApiClient.make(Api, { baseUrl: url.replace(/\/$/, "") })
    const result = yield* client.importDump({ payload: dump })
    yield* Console.log(JSON.stringify(result))
  }),
).pipe(Command.withDescription("Import a bookmarks dump JSON file through the running server."))

const searchCommand = Command.make(
  "search",
  {
    q: Flag.string("q").pipe(Flag.withMetavar("QUERY")),
    url: Flag.string("url").pipe(Flag.withDefault(defaultUrl), Flag.withMetavar("URL")),
  },
  Effect.fn("searchCommand")(function* ({ q, url }) {
    const client = yield* HttpApiClient.make(Api, { baseUrl: url.replace(/\/$/, "") })
    const result = yield* client.search({ query: { q } })
    for (const hit of result.hits) {
      yield* Console.log(
        `${hit.score.toFixed(3)} @${hit.handle} ${hit.text.replaceAll("\n", " ").slice(0, 100)}`,
      )
    }
  }),
).pipe(Command.withDescription("Semantic search against the running server."))

const command = Command.make("x-bookmarks-cli").pipe(
  Command.withShortDescription("HTTP client for the local X bookmarks library"),
  Command.withDescription(
    "Talk to a running x-bookmarks server. import and search are HTTP clients.",
  ),
  Command.withSubcommands([importCommand, searchCommand]),
)

NodeRuntime.runMain(
  Command.run(command, { version: packageJson.version }).pipe(
    Effect.provide(Layer.merge(NodeServices.layer, NodeHttpClient.layerNodeHttp)),
  ),
)
