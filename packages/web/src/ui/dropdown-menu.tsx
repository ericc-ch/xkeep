import { DropdownMenu as Kobalte } from "@kobalte/core/dropdown-menu"
import * as stylex from "@stylexjs/stylex"
import { splitProps, type ComponentProps } from "solid-js"
import { theme } from "../theme.ts"
import { surface } from "./surface.stylex.ts"

const styles = stylex.create({
  content: {
    minWidth: 180,
    padding: 8,
  },
})

export const DropdownMenu = Kobalte
export const DropdownMenuTrigger = Kobalte.Trigger
export const DropdownMenuItem = (props: ComponentProps<typeof Kobalte.Item>) => (
  <Kobalte.Item {...props} {...stylex.attrs(surface.item)} />
)

export const DropdownMenuContent = (props: ComponentProps<typeof Kobalte.Content>) => {
  const [local, rest] = splitProps(props, ["children"])
  return (
    <Kobalte.Portal>
      <Kobalte.Content
        gutter={theme.space.gutter}
        {...rest}
        {...stylex.attrs([surface.floating, styles.content])}
      >
        {local.children}
      </Kobalte.Content>
    </Kobalte.Portal>
  )
}
