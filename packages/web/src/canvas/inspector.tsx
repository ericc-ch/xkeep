import * as stylex from "@stylexjs/stylex"
import { createSignal, For, onCleanup, Show, type Accessor, type Resource } from "solid-js"
import { postUrl } from "./bookmark.ts"
import { tokens } from "../tokens.stylex.ts"
import type { Detail, PileItem } from "../api.ts"
import { Button, buttonAttrs } from "../ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx"
import { TextField, TextFieldInput } from "../ui/text-field.tsx"
import { surface } from "../ui/surface.stylex.ts"

const ui = stylex.create({
  inspector: {
    position: "absolute",
    zIndex: 6,
    top: 0,
    right: 0,
    width: 384,
    maxWidth: "100vw",
    height: "100%",
    overflowY: "auto",
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: tokens.line,
    backgroundColor: tokens.pane,
    boxShadow: tokens.shadowPane,
  },
  inspectorHead: {
    position: "sticky",
    zIndex: 1,
    top: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: 62,
    padding: "0 20px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.line,
    backgroundColor: tokens.glass,
    backdropFilter: tokens.blurGlass,
  },
  inspectorTitle: { margin: 0, fontSize: 19, fontWeight: 700 },
  inspectorBody: { padding: 20 },
  authorRow: { display: "flex", gap: 11, alignItems: "center", marginBottom: 18 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: tokens.radiusPill,
    objectFit: "cover",
    backgroundColor: tokens.hover,
  },
  author: { margin: 0, fontSize: 15, fontWeight: 700 },
  handle: { margin: "2px 0 0", color: tokens.mute, fontSize: 14 },
  body: { margin: "0 0 16px", fontSize: 16, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  media: {
    display: "block",
    width: "100%",
    maxHeight: 390,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: tokens.radiusLg,
    objectFit: "contain",
    backgroundColor: tokens.card,
  },
  meta: { margin: "12px 0 0", color: tokens.mute, fontSize: 13, lineHeight: 1.5 },
  divider: { height: 1, margin: "18px 0", backgroundColor: tokens.line },
  quote: {
    marginTop: 14,
    padding: 13,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: tokens.radiusLg,
  },
  quoteBody: { margin: 0, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" },
  tag: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 30,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.accent,
    borderRadius: tokens.radiusMd,
    color: tokens.accent,
    fontSize: 13,
  },
  tagX: {
    padding: 0,
    borderWidth: 0,
    color: tokens.accent,
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  multiTitle: { margin: "4px 0 8px", fontSize: 22, fontWeight: 700 },
  multiCopy: { margin: "0 0 20px", color: tokens.mute, fontSize: 14, lineHeight: 1.5 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 },
  moreWrap: { marginTop: 16 },
  chips: { display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" },
})

export const Inspector = (props: {
  readonly selectedItems: Accessor<ReadonlyArray<PileItem>>
  readonly selectedOne: Accessor<PileItem | undefined>
  readonly detail: Resource<Detail>
  readonly tagDraft: Accessor<string>
  readonly onTagDraft: (value: string) => void
  readonly tagStates: Accessor<ReadonlyArray<{ readonly tag: string; readonly shared: boolean }>>
  readonly onAddTag: (raw: string) => void
  readonly onRemoveTag: (tag: string) => void
  readonly onClose: () => void
  readonly onDelete: () => void
  readonly onExport: () => Promise<string | undefined>
  readonly tagHint: Accessor<string | undefined>
}) => {
  const [moreOpen, setMoreOpen] = createSignal(false)
  const [moreHint, setMoreHint] = createSignal<string>()
  let moreHintTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => {
    if (moreHintTimer !== undefined) clearTimeout(moreHintTimer)
  })
  const visibleDetail = () => {
    const item = props.selectedOne()
    const value = props.detail()
    if (item === undefined || value === undefined || value.id !== item.id) return undefined
    return value
  }
  const copyLinks = () => {
    const items = props.selectedItems()
    void navigator.clipboard
      .writeText(items.map(postUrl).join("\n"))
      .then(
        () => setMoreHint(items.length === 1 ? "Link copied." : "Links copied."),
        () => setMoreHint("Could not copy the links."),
      )
      .then(() => {
        if (moreHintTimer !== undefined) clearTimeout(moreHintTimer)
        moreHintTimer = setTimeout(() => {
          moreHintTimer = undefined
          setMoreHint(undefined)
        }, 2000)
      })
  }

  return (
    <aside {...stylex.attrs(ui.inspector)}>
      <header {...stylex.attrs(ui.inspectorHead)}>
        <h2 {...stylex.attrs(ui.inspectorTitle)}>
          {props.selectedItems().length === 1 ? "Bookmark" : "Selection"}
        </h2>
        <Button variant="icon" aria-label="Close inspector" onClick={props.onClose}>
          ×
        </Button>
      </header>
      <div {...stylex.attrs(ui.inspectorBody)}>
        <Show
          when={props.selectedOne()}
          fallback={
            <>
              <p {...stylex.attrs(ui.multiTitle)}>
                {String(props.selectedItems().length)} bookmarks
              </p>
              <p {...stylex.attrs(ui.multiCopy)}>
                Edit shared tags, or step through a safe cleanup on X.
              </p>
            </>
          }
        >
          {(item) => (
            <>
              <div {...stylex.attrs(ui.authorRow)}>
                <img {...stylex.attrs(ui.avatar)} src={item().avatar} alt="" />
                <div>
                  <p {...stylex.attrs(ui.author)}>{item().author}</p>
                  <p {...stylex.attrs(ui.handle)}>@{item().handle}</p>
                </div>
              </div>
              <p {...stylex.attrs(ui.body)}>{item().text}</p>
              <Show when={props.detail.error}>
                <p {...stylex.attrs(surface.quiet)}>Could not load this bookmark.</p>
              </Show>
              <Show when={visibleDetail()}>
                {(current) => (
                  <>
                    <For each={current().stills}>
                      {(src) => <img {...stylex.attrs(ui.media)} src={src} alt="" />}
                    </For>
                    <Show when={current().quoted}>
                      {(quoted) => (
                        <div {...stylex.attrs(ui.quote)}>
                          <p {...stylex.attrs(surface.quiet)}>
                            {quoted().author} @{quoted().handle}
                          </p>
                          <p {...stylex.attrs(ui.quoteBody)}>{quoted().text}</p>
                        </div>
                      )}
                    </Show>
                    <Show when={current().hashtags.length > 0}>
                      <p {...stylex.attrs(ui.meta)}>
                        {current()
                          .hashtags.map((tag) => "#" + tag)
                          .join(" ")}
                      </p>
                    </Show>
                    <For each={current().urls}>
                      {(url) => (
                        <p {...stylex.attrs(ui.meta)}>
                          <a href={url} target="_blank" rel="noreferrer">
                            {url}
                          </a>
                        </p>
                      )}
                    </For>
                    <p {...stylex.attrs(ui.meta)}>
                      Saved locally · Posted {new Date(current().timestamp).toLocaleString()}
                    </p>
                  </>
                )}
              </Show>
            </>
          )}
        </Show>
        <div {...stylex.attrs(ui.divider)} />
        <span {...stylex.attrs(surface.label)}>
          {props.selectedItems().length === 1 ? "Tags" : "Shared tags"}
        </span>
        <Show when={props.tagHint()}>
          {(message) => (
            <p {...stylex.attrs(surface.hint)} aria-live="polite">
              {message()}
            </p>
          )}
        </Show>
        <div {...stylex.attrs(ui.chips)}>
          <For
            each={
              props.selectedItems().length === 1
                ? props.selectedItems()[0]?.tags.map((tag) => ({ tag, shared: true }))
                : props.tagStates()
            }
          >
            {(state) => (
              <span {...stylex.attrs(ui.tag)}>
                {state.tag}
                {state.shared ? "" : " · mixed"}
                <button
                  type="button"
                  aria-label={(state.shared ? "Remove " : "Apply ") + state.tag}
                  {...stylex.attrs(ui.tagX)}
                  onClick={() =>
                    state.shared ? props.onRemoveTag(state.tag) : props.onAddTag(state.tag)
                  }
                >
                  ×
                </button>
              </span>
            )}
          </For>
          <TextField value={props.tagDraft()} onChange={props.onTagDraft}>
            <TextFieldInput
              variant="chip"
              aria-label="Add tag"
              placeholder="+ Add tag"
              onKeyDown={(event: KeyboardEvent) =>
                event.key === "Enter" && props.onAddTag(props.tagDraft())
              }
            />
          </TextField>
        </div>
        <div {...stylex.attrs(ui.actions)}>
          <Show when={props.selectedOne()} fallback={<span />}>
            {(item) => (
              <Button
                as="a"
                variant="outline"
                href={postUrl(item())}
                target="_blank"
                rel="noreferrer"
              >
                Open on X
              </Button>
            )}
          </Show>
          <Button variant="danger" onClick={props.onDelete}>
            Delete
          </Button>
        </div>
        <div {...stylex.attrs(ui.moreWrap)}>
          <DropdownMenu
            open={moreOpen()}
            onOpenChange={(open) => {
              setMoreOpen(open)
              if (!open) setMoreHint(undefined)
            }}
          >
            <DropdownMenuTrigger {...buttonAttrs("ghost")}>More</DropdownMenuTrigger>
            <DropdownMenuContent>
              <Show when={moreHint()}>
                {(message) => (
                  <p {...stylex.attrs(surface.hint)} aria-live="polite">
                    {message()}
                  </p>
                )}
              </Show>
              <DropdownMenuItem closeOnSelect={false} onSelect={copyLinks}>
                Copy {props.selectedItems().length === 1 ? "link" : "links"}
              </DropdownMenuItem>
              <DropdownMenuItem
                closeOnSelect={false}
                onSelect={() => {
                  void props.onExport().then((error) => {
                    if (error === undefined) setMoreOpen(false)
                    else setMoreHint(error)
                  })
                }}
              >
                Export selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}
