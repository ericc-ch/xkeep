import { execFile } from "node:child_process"
import { constants } from "node:fs"
import { access, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { expect, test } from "@playwright/test"

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url))
const cliDirectory = fileURLToPath(new URL("../../packages/cli/", import.meta.url))
const cliEntry = fileURLToPath(new URL("../../packages/cli/dist/main.js", import.meta.url))
const webEntry = fileURLToPath(new URL("../../packages/web/dist/index.html", import.meta.url))

test("the published package artifacts run with stock Node", async () => {
  await access(cliEntry, constants.X_OK)
  expect(await readFile(cliEntry, "utf8")).toMatch(/^#!\/usr\/bin\/env node\n/)

  const help = await execFileAsync(process.execPath, [cliEntry, "--help"], {
    cwd: repositoryRoot,
    env: { ...process.env, NODE_OPTIONS: "" },
  })
  expect(help.stdout).toContain("xkeep <subcommand>")

  const resolution = await execFileAsync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'console.log(import.meta.resolve("@xkeep/server/schema-http"))',
    ],
    {
      cwd: cliDirectory,
      env: { ...process.env, NODE_OPTIONS: "" },
    },
  )
  expect(resolution.stdout.trim()).toMatch(/\/packages\/server\/dist\/http\/schema\.js$/)

  const html = await readFile(webEntry, "utf8")
  expect(html).toContain('<div id="app"></div>')
})
