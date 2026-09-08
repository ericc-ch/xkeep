import { existsSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, defineConfig } from "@playwright/test"
import getPort from "get-port"
import which from "which"

const browserNames = ["helium", "chromium", "google-chrome-stable", "google-chrome"]
let executablePath = process.env.XKEEP_E2E_BROWSER
for (const name of browserNames) {
  if (executablePath !== undefined) break
  executablePath = which.sync(name, { nothrow: true }) ?? undefined
}
if (executablePath === undefined) {
  const bundled = chromium.executablePath()
  if (existsSync(bundled)) executablePath = bundled
}
if (executablePath === undefined) {
  throw new Error("No Chromium browser found; set XKEEP_E2E_BROWSER to an executable path")
}

const port =
  process.env.XKEEP_E2E_PORT === undefined ? await getPort() : Number(process.env.XKEEP_E2E_PORT)
const dataDir =
  process.env.XKEEP_E2E_DATA_DIR ?? (await mkdtemp(join(tmpdir(), "xkeep-browser-e2e-")))
process.env.XKEEP_E2E_PORT = String(port)
process.env.XKEEP_E2E_DATA_DIR = dataDir

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".audit/e2e-results",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    baseURL: `http://127.0.0.1:${String(port)}`,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    launchOptions: { executablePath },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "nub tests/e2e/server.ts",
    url: `http://127.0.0.1:${String(port)}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      XKEEP_E2E_PORT: String(port),
      XKEEP_E2E_DATA_DIR: dataDir,
    },
  },
})
