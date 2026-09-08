import { ToggleGroup as Kobalte } from "@kobalte/core/toggle-group"
import * as stylex from "@stylexjs/stylex"
import type { ComponentProps } from "solid-js"
import { buttonAttrs } from "./button.tsx"

const styles = stylex.create({
  group: { display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" },
})

export const ToggleGroup = (props: ComponentProps<typeof Kobalte>) => (
  <Kobalte {...props} {...stylex.attrs(styles.group)} />
)

export const ToggleGroupItem = (props: ComponentProps<typeof Kobalte.Item>) => (
  <Kobalte.Item {...props} {...buttonAttrs("chip")} />
)
