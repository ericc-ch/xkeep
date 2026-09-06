import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/solid-router"
import { Import } from "./import.tsx"
import { Library } from "./library.tsx"

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Library,
})

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: Import,
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
