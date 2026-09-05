import { RouterProvider } from "@tanstack/solid-router"
import { render } from "solid-js/web"
import { router } from "./app.tsx"
import "./reset.css"

const root = document.getElementById("app")
if (root === null) throw new Error("missing #app")
render(() => <RouterProvider router={router} />, root)
