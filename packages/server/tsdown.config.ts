import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    "http/api": "src/http/api.ts",
    "http/schema": "src/http/schema.ts",
    "http/server": "src/http/server.ts",
    schema: "src/schema.ts",
  },
  platform: "node",
  format: "esm",
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  unbundle: true,
  deps: {
    neverBundle: true,
  },
})
