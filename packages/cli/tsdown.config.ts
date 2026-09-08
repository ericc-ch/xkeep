import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    main: "src/main.ts",
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
  outputOptions: {
    banner: "#!/usr/bin/env node",
  },
})
