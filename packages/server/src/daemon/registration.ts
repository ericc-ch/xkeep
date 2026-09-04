import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { Effect, FileSystem, Option, Schema } from "effect"

const Port = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 }))

export const ServiceRegistration = Schema.Struct({
  pid: Schema.Int.check(Schema.isGreaterThan(0)),
  host: Schema.String,
  port: Port,
  url: Schema.String,
  startedAt: Schema.String,
})

export type ServiceRegistration = typeof ServiceRegistration.Type

const registrationJson = Schema.fromJsonString(ServiceRegistration)
const encodeRegistration = Schema.encodeEffect(registrationJson)
const decodeRegistration = Schema.decodeUnknownEffect(registrationJson)

export const serviceRegistrationPath = (): string => {
  const state = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
  return join(state, "xkeep", "service.json")
}

export const serviceUrl = (host: string, port: number): string => {
  if (host === "0.0.0.0" || host === "::" || host === "[::]") {
    return `http://127.0.0.1:${String(port)}`
  }
  const connect = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host
  return `http://${connect}:${String(port)}`
}

export const readRegistration = Effect.fn("readRegistration")(function* (file?: string) {
  const fs = yield* FileSystem.FileSystem
  const path = file ?? serviceRegistrationPath()
  const text = yield* fs.readFileString(path).pipe(Effect.option)
  if (Option.isNone(text)) return undefined
  return yield* decodeRegistration(text.value).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined),
  )
})

export const writeRegistration = Effect.fn("writeRegistration")(function* (config: {
  readonly host: string
  readonly port: number
}) {
  const fs = yield* FileSystem.FileSystem
  const file = serviceRegistrationPath()
  const startedAt = yield* Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
    Effect.map((millis) => new Date(millis).toISOString()),
  )
  const info: ServiceRegistration = {
    pid: process.pid,
    host: config.host,
    port: config.port,
    url: serviceUrl(config.host, config.port),
    startedAt,
  }
  const encoded = yield* encodeRegistration(info)
  yield* fs.makeDirectory(dirname(file), { recursive: true })
  const temp = `${file}.${String(process.pid)}.tmp`
  yield* fs.writeFileString(temp, encoded, { mode: 0o600 })
  yield* fs.rename(temp, file)
  return info
})

export const clearRegistrationIfOwner = Effect.fn("clearRegistrationIfOwner")(function* () {
  const fs = yield* FileSystem.FileSystem
  const file = serviceRegistrationPath()
  const info = yield* readRegistration(file)
  if (info === undefined || info.pid !== process.pid) return
  yield* fs.remove(file).pipe(Effect.ignore)
})
