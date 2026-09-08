import { Button as KobalteButton } from "@kobalte/core/button"
import * as stylex from "@stylexjs/stylex"
import { splitProps, type ComponentProps } from "solid-js"
import { tokens } from "../tokens.stylex.ts"

export type ButtonVariant = "glass" | "outline" | "solid" | "ghost" | "danger" | "chip" | "icon"
export type ButtonSize = "default" | "sm"

const styles = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    color: tokens.ink,
    backgroundColor: "transparent",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    textDecoration: "none",
    ":is([data-disabled])": { color: tokens.mute, cursor: "default" },
  },
  glass: {
    height: 44,
    padding: "0 14px",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,.9)",
    backdropFilter: "blur(18px)",
    ":hover": { backgroundColor: "#16181c" },
  },
  outline: {
    height: 44,
    padding: "0 15px",
    borderColor: tokens.accent,
    borderRadius: 9,
    color: tokens.accent,
    fontWeight: 700,
  },
  solid: {
    height: 40,
    padding: "0 15px",
    borderRadius: 999,
    color: tokens.bg,
    backgroundColor: tokens.ink,
    fontSize: 13,
    fontWeight: 700,
  },
  ghost: {
    height: "auto",
    padding: 0,
    borderWidth: 0,
    color: tokens.accent,
    backgroundColor: "transparent",
    fontSize: 13,
  },
  danger: {
    height: 44,
    padding: "0 15px",
    borderColor: "#f4212e",
    borderRadius: 9,
    color: "#f4212e",
    fontWeight: 700,
  },
  chip: {
    height: 30,
    padding: "0 10px",
    borderRadius: 999,
    color: tokens.mute,
    fontSize: 12,
    ":is([data-pressed])": {
      color: tokens.accent,
      borderColor: tokens.accent,
      backgroundColor: "rgba(29,155,240,.1)",
    },
  },
  icon: {
    width: 34,
    height: 34,
    padding: 0,
    borderWidth: 0,
    borderRadius: 999,
    color: tokens.mute,
    fontSize: 22,
    ":hover": { color: tokens.ink, backgroundColor: "#16181c" },
  },
  sm: { height: 40, padding: "0 15px", borderRadius: 999, fontSize: 13, fontWeight: 700 },
  pressed: { color: tokens.accent, borderColor: tokens.accent },
})

const variantStyle = (variant: ButtonVariant) => {
  switch (variant) {
    case "outline":
      return styles.outline
    case "solid":
      return styles.solid
    case "ghost":
      return styles.ghost
    case "danger":
      return styles.danger
    case "chip":
      return styles.chip
    case "icon":
      return styles.icon
    default:
      return styles.glass
  }
}

export const buttonAttrs = (
  variant: ButtonVariant = "glass",
  size: ButtonSize = "default",
  pressed = false,
) =>
  stylex.attrs([
    styles.base,
    variantStyle(variant),
    size === "sm" && styles.sm,
    pressed && styles.pressed,
  ])

export const Button = (
  props: ComponentProps<typeof KobalteButton> & {
    variant?: ButtonVariant
    size?: ButtonSize
    pressed?: boolean
  },
) => {
  const [local, rest] = splitProps(props, ["variant", "size", "pressed"])
  return (
    <KobalteButton
      {...(rest as ComponentProps<typeof KobalteButton>)}
      {...buttonAttrs(local.variant ?? "glass", local.size ?? "default", local.pressed === true)}
    />
  )
}
