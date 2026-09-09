import { TextField as Kobalte } from "@kobalte/core/text-field"
import * as stylex from "@stylexjs/stylex"
import { splitProps, type ComponentProps } from "solid-js"
import { tokens } from "../tokens.stylex.ts"

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column" },
  input: {
    width: "100%",
    height: 36,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: tokens.radiusSm,
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
    borderRadius: tokens.radiusMd,
    fontSize: 15,
    backgroundColor: tokens.glass,
    backdropFilter: tokens.blurGlass,
  },
  chip: {
    width: 112,
    height: 30,
    borderRadius: tokens.radiusMd,
    backgroundColor: "transparent",
  },
})

export const TextField = (props: ComponentProps<typeof Kobalte>) => (
  <Kobalte {...props} {...stylex.attrs(styles.root)} />
)
export const TextFieldInput = (
  props: ComponentProps<typeof Kobalte.Input> & {
    variant?: "default" | "search" | "chip"
  },
) => {
  const [local, rest] = splitProps(props, ["variant"])
  return (
    <Kobalte.Input
      {...rest}
      {...stylex.attrs([
        styles.input,
        local.variant === "search" && styles.search,
        local.variant === "chip" && styles.chip,
      ])}
    />
  )
}
