import { spawn } from "node:child_process"
import { Console, Effect } from "effect"
import { API_PREFIX } from "@xkeep/server/schema-http"
import { readRegistration } from "./registration.ts"

const art = [
  "  ┌─┐",
  "  │x│  xkeep",
  "  └─┘  local x bookmarks",
].join("\n")

const row = (label: string, value: string) => `  ${label.padEnd(6)}  ${value}`

export const printReady = Effect.fn("printReady")(function* (baseUrl: string) {
  const url = baseUrl.replace(/\/$/, "")
  const info = yield* readRegistration()
  const lines = [art, ""]
  if (info !== undefined && info.url.replace(/\/$/, "") === url) {
    lines.push(row("daemon", `pid ${String(info.pid)}`))
  }
  lines.push(row("open", url))
  lines.push(row("api", `${url}${API_PREFIX}/`))
  lines.push(row("try", "xkeep api search --param q=hello"))
  lines.push(row("stop", "xkeep service stop"))
  yield* Console.log(lines.join("\n"))
  yield* Effect.sync(() => {
    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" })
    child.unref()
  }).pipe(Effect.ignore)
})
