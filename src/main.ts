#!/usr/bin/env bun

import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { Command, Flag } from "effect/unstable/cli"

const greet = Command.make(
  "greet",
  {
    name: Flag.string("name"),
    shout: Flag.boolean("shout").pipe(Flag.withDefault(false)),
  },
  (config) => {
    const message = `Hello, ${config.name}!`
    return Console.log(config.shout ? message.toUpperCase() : message)
  },
)

if (import.meta.main) {
  NodeRuntime.runMain(
    Command.run(greet, { version: "0.0.0" }).pipe(Effect.provide(NodeServices.layer)),
  )
}
