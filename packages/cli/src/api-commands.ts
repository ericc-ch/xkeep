import { Api } from "@xkeep/server/api"
import { Console, Effect, FileSystem, Option, Predicate, Schema } from "effect"
import { Command, Flag } from "effect/unstable/cli"
import { HttpApi, type HttpApiEndpoint, type HttpApiGroup } from "effect/unstable/httpapi"
import { CliError, discoverServer } from "./ensure.ts"

const apiRoot = Command.make("api").pipe(
  Command.withSharedFlags({
    url: Flag.string("url").pipe(Flag.optional, Flag.withMetavar("URL")),
  }),
  Command.withDescription("Call the HTTP API. Does not start the server."),
)

const structFieldNames = (schema: Schema.Top | undefined): ReadonlyArray<string> => {
  if (schema === undefined) return []
  if (!("fields" in schema)) return []
  const fields = schema.fields
  if (fields === null || typeof fields !== "object") return []
  return Object.keys(fields)
}

const isStreaming = (endpoint: HttpApiEndpoint.Top): boolean => {
  for (const schema of endpoint.success) {
    if (Predicate.isTagged(schema, "StreamSse")) return true
    if ("sseMode" in schema) return true
  }
  return false
}

const isMultipart = (endpoint: HttpApiEndpoint.Top): boolean => {
  for (const entry of endpoint.payload.values()) {
    if (entry.encoding._tag === "Multipart") return true
  }
  return false
}

const hasPayload = (endpoint: HttpApiEndpoint.Top): boolean => endpoint.payload.size > 0

const flagString = (name: string) =>
  Flag.string(name).pipe(Flag.optional, Flag.withMetavar(name.toUpperCase()))

const stringsFromFlags = (names: ReadonlyArray<string>, config: Record<string, unknown>) => {
  const out: Record<string, string> = {}
  for (const name of names) {
    const value = config[name]
    if (Option.isOption(value)) {
      if (Option.isSome(value) && typeof value.value === "string") out[name] = value.value
      continue
    }
    if (typeof value === "string") out[name] = value
  }
  return out
}

const readJson = Effect.fn("readJson")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem
  const raw = file === "-" ? yield* fs.readFileString("/dev/stdin") : yield* fs.readFileString(file)
  return yield* Effect.try({
    try: (): unknown => JSON.parse(raw),
    catch: () => new CliError({ reason: "payload is not json" }),
  })
})

const fillPath = (path: string, params: Record<string, string>) => {
  let filled = path
  for (const [name, value] of Object.entries(params)) {
    filled = filled.replaceAll(`:${name}`, encodeURIComponent(value))
  }
  return filled
}

const callHttp = Effect.fn("callHttp")(function* (input: {
  readonly baseUrl: string
  readonly method: string
  readonly path: string
  readonly query: Record<string, string>
  readonly params: Record<string, string>
  readonly payload: unknown
}) {
  const url = new URL(fillPath(input.path, input.params), `${input.baseUrl.replace(/\/$/, "")}/`)
  for (const [name, value] of Object.entries(input.query)) {
    url.searchParams.set(name, value)
  }
  const init: RequestInit = { method: input.method.toUpperCase() }
  if (input.payload !== undefined) {
    init.headers = { "content-type": "application/json" }
    init.body = JSON.stringify(input.payload)
  }
  const response = yield* Effect.tryPromise({
    try: () => fetch(url, init),
    catch: (cause) => new CliError({ reason: String(cause) }),
  })
  const text = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) => new CliError({ reason: String(cause) }),
  })
  if (!response.ok) {
    return yield* new CliError({
      reason: `${String(response.status)} ${url.pathname}${text.length > 0 ? `\n${text}` : ""}`,
    })
  }
  if (text.length === 0) return undefined
  return yield* Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: () => new CliError({ reason: "response is not json" }),
  })
})

const endpointCommand = (group: HttpApiGroup.Top, endpoint: HttpApiEndpoint.Top) => {
  const queryNames = structFieldNames(endpoint.query)
  const paramNames = structFieldNames(endpoint.params)
  const body = hasPayload(endpoint)
  const flags: Record<string, ReturnType<typeof flagString>> = {}
  for (const name of queryNames) flags[name] = flagString(name)
  for (const name of paramNames) flags[name] = flagString(name)
  if (body) flags.file = flagString("file")
  return Command.make(
    endpoint.identifier,
    flags,
    Effect.fn(`api.${group.identifier}.${endpoint.identifier}`)(function* (
      config: Record<string, unknown>,
    ) {
      const parent = yield* apiRoot
      const baseUrl = yield* discoverServer(parent.url)
      const fileFlag = config.file
      const file =
        Option.isOption(fileFlag) && Option.isSome(fileFlag) && typeof fileFlag.value === "string"
          ? fileFlag.value
          : typeof fileFlag === "string"
            ? fileFlag
            : undefined
      if (body && file === undefined) {
        return yield* new CliError({ reason: "missing --file (use - for stdin)" })
      }
      const result = yield* callHttp({
        baseUrl,
        method: endpoint.method,
        path: endpoint.path,
        query: stringsFromFlags(queryNames, config),
        params: stringsFromFlags(paramNames, config),
        payload: body && file !== undefined ? yield* readJson(file) : undefined,
      })
      yield* Console.log(JSON.stringify(result))
    }),
  ).pipe(Command.withDescription(`${endpoint.method.toUpperCase()} ${endpoint.path}`))
}

const topLevel: Array<ReturnType<typeof endpointCommand>> = []
const nested = new Map<string, Array<ReturnType<typeof endpointCommand>>>()

HttpApi.reflect(Api, {
  onGroup: () => undefined,
  onEndpoint: ({ endpoint, group }) => {
    if (isStreaming(endpoint) || isMultipart(endpoint)) return
    const command = endpointCommand(group, endpoint)
    if (group.topLevel) {
      topLevel.push(command)
      return
    }
    const list = nested.get(group.identifier) ?? []
    list.push(command)
    nested.set(group.identifier, list)
  },
})

const children = [...topLevel]
for (const [id, commands] of nested) {
  const first = commands[0]
  if (first === undefined) continue
  children.push(
    Command.make(id).pipe(
      Command.withDescription(`HTTP API group ${id}`),
      Command.withSubcommands([first, ...commands.slice(1)]),
    ) as (typeof children)[number],
  )
}

const firstChild = children[0]
if (firstChild === undefined) {
  throw new Error("HttpApi has no CLI-callable endpoints")
}

export const apiCommand = apiRoot.pipe(Command.withSubcommands([firstChild, ...children.slice(1)]))
