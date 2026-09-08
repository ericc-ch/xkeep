import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { relative } from "node:path"

export default async () => {
  const dataDir = process.env.XKEEP_E2E_DATA_DIR
  if (dataDir === undefined) return
  const fromTmp = relative(tmpdir(), dataDir)
  if (fromTmp.startsWith("..") || !fromTmp.startsWith("xkeep-browser-e2e-")) {
    throw new Error(`Refusing to remove unexpected E2E directory: ${dataDir}`)
  }
  await rm(dataDir, { recursive: true, force: true })
}
