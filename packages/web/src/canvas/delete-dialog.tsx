import * as stylex from "@stylexjs/stylex"
import { Show, type Accessor } from "solid-js"
import { postUrl, short } from "./bookmark.ts"
import { tokens } from "../tokens.stylex.ts"
import type { PileItem } from "../api.ts"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "../ui/alert-dialog.tsx"
import { Button } from "../ui/button.tsx"
import { surface } from "../ui/surface.stylex.ts"

export type DeleteRun = {
  readonly ids: ReadonlyArray<string>
  readonly index: number
  readonly deleting: boolean
}

const ui = stylex.create({
  item: {
    padding: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: tokens.radiusSm,
    fontSize: 14,
    lineHeight: 1.45,
  },
  actions: { display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 },
})

export const DeleteDialog = (props: {
  readonly run: Accessor<DeleteRun>
  readonly item: Accessor<PileItem | undefined>
  readonly error: Accessor<string | undefined>
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) => {
  const busy = () => props.run().deleting
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy()) props.onCancel()
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (busy()) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (busy()) event.preventDefault()
        }}
      >
        <AlertDialogTitle>
          Remove bookmark {String(props.run().index + 1)} of {String(props.run().ids.length)}
        </AlertDialogTitle>
        <AlertDialogDescription>
          Open the post and remove its bookmark on X. Then confirm here so xkeep forgets it and will
          not re-import it.
        </AlertDialogDescription>
        <Show when={props.item()}>
          {(item) => (
            <div {...stylex.attrs(ui.item)}>
              <strong>@{item().handle}</strong>
              <br />
              {short(item().text, 180)}
            </div>
          )}
        </Show>
        <Show when={props.error()}>
          {(message) => (
            <p {...stylex.attrs(surface.hint)} aria-live="assertive">
              {message()}
            </p>
          )}
        </Show>
        <div {...stylex.attrs(ui.actions)}>
          <Button size="sm" disabled={busy()} onClick={props.onCancel}>
            Cancel
          </Button>
          <Show when={props.item()}>
            {(item) => (
              <Button
                as="a"
                variant="outline"
                size="sm"
                href={postUrl(item())}
                target="_blank"
                rel="noreferrer"
              >
                Open on X
              </Button>
            )}
          </Show>
          <Button variant="solid" disabled={busy()} onClick={props.onConfirm}>
            {busy() ? "Removing…" : "Removed on X"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
