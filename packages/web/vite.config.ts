import { fileURLToPath } from "node:url"
import { defineConfig, searchForWorkspaceRoot } from "vite"
import solid from "vite-plugin-solid"
import stylex from "@stylexjs/unplugin"

export default defineConfig({
  plugins: [
    stylex.vite({
      useCSSLayers: { before: ["reset"] },
      dev: process.env.NODE_ENV !== "production",
      runtimeInjection: false,
    }),
    solid(),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [searchForWorkspaceRoot(fileURLToPath(new URL(".", import.meta.url)))],
    },
    proxy: {
      "/api": "http://127.0.0.1:5337",
    },
  },
})
