import { AlertDialog as Kobalte } from "@kobalte/core/alert-dialog"
import * as stylex from "@stylexjs/stylex"
import { splitProps, type ComponentProps } from "solid-js"
import { tokens } from "../tokens.stylex.ts"
import { surface } from "./surface.stylex.ts"

const styles = stylex.create({
  content: {
    width: "min(460px,100%)",
    padding: 22,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 18,
    backgroundColor: tokens.bg,
    boxShadow: "0 24px 80px rgba(0,0,0,.8)",
    outline: "none",
  },
  title: { margin: "0 0 8px", fontSize: 21, fontWeight: 700 },
  description: { margin: "0 0 16px", color: tokens.mute, fontSize: 14, lineHeight: 1.5 },
})

export const AlertDialog = Kobalte
export const AlertDialogTitle = (props: ComponentProps<typeof Kobalte.Title>) => (
  <Kobalte.Title {...props} {...stylex.attrs(styles.title)} />
)
export const AlertDialogDescription = (props: ComponentProps<typeof Kobalte.Description>) => (
  <Kobalte.Description {...props} {...stylex.attrs(styles.description)} />
)

export const AlertDialogContent = (props: ComponentProps<typeof Kobalte.Content>) => {
  const [local, rest] = splitProps(props, ["children"])
  return (
    <Kobalte.Portal>
      <Kobalte.Overlay {...stylex.attrs(surface.overlay)} />
      <div {...stylex.attrs(surface.positioner)}>
        <Kobalte.Content {...rest} {...stylex.attrs(styles.content)}>
          {local.children}
        </Kobalte.Content>
      </div>
    </Kobalte.Portal>
  )
}
