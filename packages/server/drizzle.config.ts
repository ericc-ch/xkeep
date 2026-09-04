import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/bookmarks/schema.ts",
  out: "./drizzle",
})
