#!/usr/bin/env nub

import { spawn, type ChildProcess } from "node:child_process"

const children: Array<ChildProcess> = []

const start = (filter: string, script: string) => {
  const child = spawn("nub", ["run", "--filter", filter, script], {
    stdio: "inherit",
    env: process.env,
  })
  children.push(child)
  child.once("error", (error) => {
    stop()
    console.error(error)
    process.exit(1)
  })
  child.once("exit", (code, signal) => {
    stop()
    if (signal !== null) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

const stop = () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM")
    }
  }
}

start("@xkeep/cli", "start")
start("@xkeep/web", "dev")

process.on("SIGINT", stop)
process.on("SIGTERM", stop)
