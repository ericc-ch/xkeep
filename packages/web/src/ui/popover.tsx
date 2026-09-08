import { Popover as Kobalte } from "@kobalte/core/popover"
import * as stylex from "@stylexjs/stylex"
import { splitProps, type ComponentProps } from "solid-js"
import { surface } from "./surface.stylex.ts"

const styles = stylex.create({
  content: {
    width: 360,
    padding: 16,
    borderRadius: 16,
  },
})

export const Popover = Kobalte
export const PopoverTrigger = Kobalte.Trigger

export const PopoverContent = (props: ComponentProps<typeof Kobalte.Content>) => {
  const [local, rest] = splitProps(props, ["children"])
  return (
    <Kobalte.Portal>
      <Kobalte.Content
        {...rest}
        {...stylex.attrs([surface.floating, styles.content])}
        style={{ "transform-origin": "var(--kb-popover-content-transform-origin)" }}
      >
        {local.children}
      </Kobalte.Content>
    </Kobalte.Portal>
  )
}
