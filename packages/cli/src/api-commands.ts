import { Console, Effect, FileSystem, Option } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"
import { CliError, discoverServer } from "./ensure.ts"

const methods = new Set(["delete", "get", "head", "options", "patch", "post", "put"])

type Operation = {
  operationId?: string
}

type OpenApi = {
  paths?: Record<string, Record<string, Operation>>
}

const interpolate = (path: string, params: Record<string, string>) => {
  const used = new Set<string>()
  const pathname = path.replaceAll(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`missing path parameter: ${name}`)
    used.add(name)
    return encodeURIComponent(value)
  })
  const query = new URLSearchParams(Object.entries(params).filter(([name]) => !used.has(name))).toString()
  return query ? `${pathname}?${query}` : pathname
}

export const rawRequest = (input: ReadonlyArray<string>) => {
  const method = input[0]
  const path = input[1]
  if (input.length !== 2 || method === undefined || path === undefined) return undefined
  if (!methods.has(method.toLowerCase()) || !path.startsWith("/")) return undefined
  return { method: method.toUpperCase(), path }
}

export const resolveOperation = (
  spec: OpenApi,
  operationId: string,
  params: Record<string, string>,
) => {
  for (const [path, operations] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!methods.has(method) || operation.operationId !== operationId) continue
      return { method: method.toUpperCase(), path: interpolate(path, params) }
    }
  }
  throw new Error(`operation not found: ${operationId}`)
}

const resolveRequest = Effect.fn("resolveRequest")(function* (
  baseUrl: string,
  input: ReadonlyArray<string>,
  params: Record<string, string>,
) {
  const raw = rawRequest(input)
  if (raw !== undefined) return raw
  if (input.length !== 1 || input[0] === undefined) {
    return yield* new CliError({
      reason: "expected an operation name or an HTTP method and path",
    })
  }
  const operationId = input[0]
  const response = yield* Effect.tryPromise({
    try: () => fetch(new URL("/openapi.json", `${baseUrl.replace(/\/$/, "")}/`)),
    catch: (cause) => new CliError({ reason: String(cause) }),
  })
  if (!response.ok) {
    return yield* new CliError({
      reason: `failed to load OpenAPI document: HTTP ${String(response.status)}`,
    })
  }
  const spec = yield* Effect.tryPromise({
    try: () => response.json() as Promise<OpenApi>,
    catch: (cause) => new CliError({ reason: String(cause) }),
  })
  return yield* Effect.try({
    try: () => resolveOperation(spec, operationId, params),
    catch: (cause) =>
      new CliError({ reason: cause instanceof Error ? cause.message : String(cause) }),
  })
})

const resolveBody = Effect.fn("resolveBody")(function* (data: Option.Option<string>) {
  if (Option.isNone(data)) return undefined
  const value = data.value
  if (!value.startsWith("@")) return value
  const fs = yield* FileSystem.FileSystem
  const path = value.slice(1)
  const file = path === "-" ? "/dev/stdin" : path
  return yield* fs.readFileString(file).pipe(
    Effect.mapError(() => new CliError({ reason: `could not read ${file}` })),
  )
})

export const apiCommand = Command.make(
  "api",
  {
    url: Flag.string("url").pipe(Flag.optional, Flag.withMetavar("URL")),
    request: Argument.string("operation | method path").pipe(
      Argument.withDescription("OpenAPI operation ID, or an HTTP method followed by a path"),
      Argument.variadic({ min: 1, max: 2 }),
    ),
    data: Flag.string("data").pipe(
      Flag.withAlias("d"),
      Flag.withDescription("Request body. @file or @- reads a file or stdin."),
      Flag.optional,
    ),
    header: Flag.string("header").pipe(
      Flag.withAlias("H"),
      Flag.withDescription("Request header in name:value form"),
      Flag.atMost(100),
    ),
    param: Flag.keyValuePair("param").pipe(
      Flag.withDescription("OpenAPI path or query parameter"),
      Flag.optional,
    ),
  },
  Effect.fn("api")(function* ({ data, header, param, request, url }) {
    const baseUrl = yield* discoverServer(url)
    const params = Option.getOrElse(param, () => ({}))
    const resolved = yield* resolveRequest(baseUrl, request, params)
    const headers = new Headers()
    for (const value of header) {
      const index = value.indexOf(":")
      if (index < 1) {
        return yield* new CliError({ reason: `invalid header, expected name:value: ${value}` })
      }
      headers.set(value.slice(0, index).trim(), value.slice(index + 1).trim())
    }
    const body = yield* resolveBody(data)
    if (body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json")
    }
    const init: RequestInit =
      body === undefined
        ? { method: resolved.method, headers }
        : { method: resolved.method, headers, body }
    const response = yield* Effect.tryPromise({
      try: () => fetch(new URL(resolved.path, `${baseUrl.replace(/\/$/, "")}/`), init),
      catch: (cause) => new CliError({ reason: String(cause) }),
    })
    const output = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) => new CliError({ reason: String(cause) }),
    })
    if (output.length > 0) yield* Console.log(output.replace(/\n$/, ""))
  }),
).pipe(Command.withDescription("Call the HTTP API. Does not start the server."))
