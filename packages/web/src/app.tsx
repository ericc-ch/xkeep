import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/solid-router"
import { Library } from "./library.tsx"

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Library,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
})

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router
  }
}
