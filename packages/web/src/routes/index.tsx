import { RegistryProvider } from "@effect/atom-solid"
import { Canvas } from "../canvas/canvas.tsx"

export const CanvasPage = () => (
  <RegistryProvider>
    <Canvas />
  </RegistryProvider>
)
