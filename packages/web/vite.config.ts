import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import stylex from "@stylexjs/unplugin"

export default defineConfig({
  plugins: [
    stylex.vite({
      useCSSLayers: true,
      dev: process.env.NODE_ENV !== "production",
      runtimeInjection: false,
    }),
    solid(),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
})
