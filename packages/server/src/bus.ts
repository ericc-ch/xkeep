import { Context, Effect, Layer, PubSub, Stream } from "effect"
import type { SseEvent } from "./http/schema.ts"

export class Bus extends Context.Service<Bus>()("Bus", {
  make: Effect.fn("Bus.make")(function* () {
    const pubsub = yield* PubSub.unbounded<SseEvent>()
    return {
      publish: Effect.fn("Bus.publish")(function* (event: SseEvent) {
        yield* PubSub.publish(pubsub, event)
      }),
      subscribe: () => Stream.fromPubSub(pubsub),
    }
  }),
}) {
  static layer = Layer.effect(this, this.make())
}
