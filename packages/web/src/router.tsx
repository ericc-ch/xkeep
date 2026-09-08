import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/solid-router"
import { CanvasPage } from "./routes/index.tsx"
import { ImportPage } from "./routes/import.tsx"

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: CanvasPage,
})

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: ImportPage,
})

const routeTree = rootRoute.addChildren([indexRoute, importRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
})

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router
  }
}
