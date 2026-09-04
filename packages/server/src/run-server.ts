import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { AppConfig, type AppConfigOverrides } from "./config.ts"
import { clearRegistrationIfOwner, writeRegistration } from "./daemon/registration.ts"
import { serverLayer } from "./http/server.ts"

export const runServer = Effect.fn("runServer")(function* (overrides: AppConfigOverrides) {
  const configLayer = AppConfig.layer(overrides).pipe(Layer.provideMerge(NodeFileSystem.layer))
  return yield* Effect.gen(function* () {
    const config = yield* AppConfig
    yield* writeRegistration(config)
    return yield* Effect.never
  }).pipe(
    Effect.ensuring(clearRegistrationIfOwner()),
    Effect.provide(serverLayer.pipe(Layer.provideMerge(configLayer))),
  )
})
