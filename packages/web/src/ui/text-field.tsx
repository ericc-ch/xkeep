import { TextField as Kobalte } from "@kobalte/core/text-field"
import * as stylex from "@stylexjs/stylex"
import { splitProps, type ComponentProps } from "solid-js"
import { tokens } from "../tokens.stylex.ts"
import { surface } from "./surface.stylex.ts"

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column" },
  input: {
    width: "100%",
    height: 36,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 8,
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontSize: 13,
    outline: "none",
    "::placeholder": { color: tokens.mute },
    ":focus": { borderColor: tokens.accent },
  },
  search: {
    height: 44,
    padding: "0 38px",
    borderRadius: 12,
    fontSize: 15,
    backgroundColor: "rgba(0,0,0,.9)",
    backdropFilter: "blur(18px)",
  },
  pill: {
    width: 112,
    height: 30,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
})

export const TextField = (props: ComponentProps<typeof Kobalte>) => (
  <Kobalte {...props} {...stylex.attrs(styles.root)} />
)
export const TextFieldLabel = (props: ComponentProps<typeof Kobalte.Label>) => (
  <Kobalte.Label {...props} {...stylex.attrs(surface.label)} />
)
export const TextFieldInput = (
  props: ComponentProps<typeof Kobalte.Input> & {
    variant?: "default" | "search" | "pill"
  },
) => {
  const [local, rest] = splitProps(props, ["variant"])
  return (
    <Kobalte.Input
      {...rest}
      {...stylex.attrs([
        styles.input,
        local.variant === "search" && styles.search,
        local.variant === "pill" && styles.pill,
      ])}
    />
  )
}
