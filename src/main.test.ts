import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const root = fileURLToPath(new URL("../", import.meta.url))

describe("greet CLI", () => {
  it("prints a greeting", async () => {
    const { stdout } = await execFileAsync("bun", ["src/main.ts", "--name", "Ada"], { cwd: root })
    expect(stdout.trim()).toBe("Hello, Ada!")
  })

  it("shouts when --shout is set", async () => {
    const { stdout } = await execFileAsync("bun", ["src/main.ts", "--name", "Ada", "--shout"], {
      cwd: root,
    })
    expect(stdout.trim()).toBe("HELLO, ADA!")
  })
})
