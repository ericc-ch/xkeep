import { spawn } from "node:child_process"
import { Socket } from "node:net"
import { Console, Data, Effect, FileSystem, Option, Schedule, Schema } from "effect"
import { HEALTH_PATH, Health } from "@xkeep/server/schema-http"
import { readRegistration, serviceRegistrationPath } from "./registration.ts"

const HTTP_HOST_DEFAULT = "127.0.0.1"
const HTTP_PORT_DEFAULT = 8787

export class CliError extends Data.TaggedError("CliError")<{
  readonly reason: string
}> {}

export const defaultUrl = `http://${HTTP_HOST_DEFAULT}:${HTTP_PORT_DEFAULT}`

const healthTimeoutMs = 2_000

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const probeHealth = Effect.fn("probeHealth")(function* (url: string) {
  const base = url.replace(/\/$/, "")
  const result = yield* Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${base}${HEALTH_PATH}`, {
        signal: AbortSignal.timeout(healthTimeoutMs),
      })
      if (!response.ok) return undefined
      return (await response.json()) as unknown
    },
    catch: (cause) => new CliError({ reason: String(cause) }),
  }).pipe(Effect.orElseSucceed(() => undefined))
  if (result === undefined) return undefined
  return yield* Schema.decodeUnknownEffect(Health)(result).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined),
  )
})

const isHttpUp = Effect.fn("isHttpUp")(function* (url: string) {
  const health = yield* probeHealth(url)
  return health !== undefined && health.status === "ok"
})

const spawnDetachedServe = (cliScript: string) =>
  Effect.sync(() => {
    const child = spawn(process.execPath, [...process.execArgv, cliScript, "service", "serve"], {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
      env: process.env,
    })
    let stderr = ""
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-8 * 1024)
    })
    if (child.stderr instanceof Socket) child.stderr.unref()
    let closed = false
    let error: Error | undefined
    child.once("error", (cause) => {
      error = cause
    })
    child.once("close", () => {
      closed = true
    })
    child.unref()
    return {
      stderr: () => stderr.trim(),
      failed: () => {
        if (error !== undefined) return error.message
        if (!closed) return undefined
        if (child.exitCode !== null && child.exitCode !== 0) {
          const tail = stderr.trim()
          return tail.length > 0
            ? `server exited with code ${String(child.exitCode)}\n${tail}`
            : `server exited with code ${String(child.exitCode)}`
        }
        if (child.signalCode !== null) return `server terminated by ${child.signalCode}`
        return undefined
      },
    }
  })

const registeredHealthy = Effect.fn("registeredHealthy")(function* () {
  const info = yield* readRegistration()
  if (info === undefined) return undefined
  if (!pidAlive(info.pid)) return undefined
  if (!(yield* isHttpUp(info.url))) return undefined
  return info
})

export const discoverServer = Effect.fn("discoverServer")(function* (url: Option.Option<string>) {
  if (Option.isSome(url)) {
    const target = url.value.replace(/\/$/, "")
    if (yield* isHttpUp(target)) return target
    return yield* new CliError({ reason: `server is not healthy at ${target}` })
  }
  const registered = yield* registeredHealthy()
  if (registered !== undefined) return registered.url
  if (yield* isHttpUp(defaultUrl)) return defaultUrl
  return yield* new CliError({ reason: "server is not running; run xkeep service start" })
})

export const ensureServer = Effect.fn("ensureServer")(function* (input: {
  readonly url: Option.Option<string>
  readonly cliScript: string
}) {
  const discovered = yield* discoverServer(input.url).pipe(Effect.option)
  if (Option.isSome(discovered)) return discovered.value
  if (Option.isSome(input.url)) {
    return yield* new CliError({
      reason: `server is not healthy at ${input.url.value.replace(/\/$/, "")}`,
    })
  }

  const child = yield* spawnDetachedServe(input.cliScript)
  const found = yield* Effect.gen(function* () {
    const fail = child.failed()
    if (fail !== undefined) {
      if (yield* isHttpUp(defaultUrl)) return Option.some(defaultUrl)
      const afterCrash = yield* registeredHealthy()
      if (afterCrash !== undefined) return Option.some(afterCrash.url)
      return yield* new CliError({
        reason:
          fail.includes("EADDRINUSE") || fail.toLowerCase().includes("address already in use")
            ? `port is already in use by another process (not xkeep). ${fail}`
            : fail,
      })
    }
    const ready = yield* registeredHealthy()
    if (ready !== undefined) return Option.some(ready.url)
    if (yield* isHttpUp(defaultUrl)) return Option.some(defaultUrl)
    return Option.none<string>()
  }).pipe(
    Effect.repeat({
      until: Option.isSome,
      schedule: Schedule.max([Schedule.spaced("100 millis"), Schedule.recurs(300)]),
    }),
  )

  if (Option.isSome(found)) return found.value
  const tail = child.stderr()
  return yield* new CliError({
    reason:
      tail.length > 0
        ? `timed out waiting for the server to start\n${tail}`
        : "timed out waiting for the server to start",
  })
})

const signalPid = (pid: number, signal: NodeJS.Signals) =>
  Effect.try({
    try: () => process.kill(pid, signal),
    catch: (cause) => new CliError({ reason: String(cause) }),
  }).pipe(Effect.ignore)

const waitUntilStopped = Effect.fn("waitUntilStopped")(function* (pid: number) {
  return yield* Effect.sync(() => pidAlive(pid)).pipe(
    Effect.filterOrFail(
      (alive) => !alive,
      () => new CliError({ reason: `process ${String(pid)} is still running` }),
    ),
    Effect.retry(Schedule.max([Schedule.spaced("50 millis"), Schedule.recurs(100)])),
  )
})

export const stopServer = Effect.fn("stopServer")(function* () {
  const fs = yield* FileSystem.FileSystem
  const info = yield* readRegistration()
  if (info === undefined) {
    yield* Console.log("no registered server")
    return
  }
  if (pidAlive(info.pid)) {
    yield* signalPid(info.pid, "SIGTERM")
    const stopped = yield* waitUntilStopped(info.pid).pipe(Effect.option)
    if (Option.isNone(stopped) && pidAlive(info.pid)) {
      yield* signalPid(info.pid, "SIGKILL")
      yield* waitUntilStopped(info.pid)
    }
  }
  const latest = yield* readRegistration()
  if (latest !== undefined && latest.pid === info.pid) {
    yield* fs.remove(serviceRegistrationPath()).pipe(Effect.ignore)
  }
})

export const serverStatus = Effect.fn("serverStatus")(function* () {
  const info = yield* readRegistration()
  if (info === undefined) {
    const defaultUp = yield* isHttpUp(defaultUrl)
    yield* Console.log(
      JSON.stringify({
        registered: false,
        file: serviceRegistrationPath(),
        defaultUrl,
        defaultHealthy: defaultUp,
      }),
    )
    return
  }
  const health = yield* probeHealth(info.url)
  yield* Console.log(
    JSON.stringify({
      registered: true,
      file: serviceRegistrationPath(),
      pid: info.pid,
      pidAlive: pidAlive(info.pid),
      url: info.url,
      startedAt: info.startedAt,
      health: health ?? null,
    }),
  )
})
