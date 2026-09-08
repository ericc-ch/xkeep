import * as stylex from "@stylexjs/stylex"
import { For } from "solid-js"
import { ComboboxField } from "../ui/combobox.tsx"
import { SelectField } from "../ui/select.tsx"
import { surface } from "../ui/surface.stylex.ts"
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.tsx"
import { Button } from "../ui/button.tsx"
import type { TagCount } from "../api.ts"

const MEDIA_KINDS = ["photo", "video", "gif", "link", "text"] as const
const DATE_DAYS = [30, 90, 365] as const

const ui = stylex.create({
  foot: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 15,
  },
})

export const Filters = (props: {
  readonly mediaFilter: ReadonlySet<string>
  readonly tagFilter: string | undefined
  readonly authorFilter: string
  readonly dateDays: number | undefined
  readonly tagList: ReadonlyArray<TagCount>
  readonly authors: ReadonlyArray<string>
  readonly onMediaFilter: (kinds: ReadonlySet<string>) => void
  readonly onTagFilter: (tag: string | undefined) => void
  readonly onAuthorFilter: (author: string) => void
  readonly onDateDays: (days: number | undefined) => void
  readonly onClear: () => void
  readonly onDone: () => void
}) => (
  <>
    <h2 {...stylex.attrs(surface.heading)}>Filters</h2>
    <span {...stylex.attrs(surface.label)}>Media</span>
    <ToggleGroup
      multiple
      value={[...props.mediaFilter]}
      onChange={(value) => {
        props.onMediaFilter(new Set(Array.isArray(value) ? value : []))
      }}
    >
      <For each={[...MEDIA_KINDS]}>
        {(kind) => <ToggleGroupItem value={kind}>{kind}</ToggleGroupItem>}
      </For>
    </ToggleGroup>
    <SelectField
      label="Tag"
      placeholder="Any tag"
      options={props.tagList.map((entry) => ({
        value: entry.tag,
        label: entry.tag + " · " + String(entry.count),
      }))}
      value={props.tagFilter}
      onChange={props.onTagFilter}
    />
    <ComboboxField
      label="Author"
      placeholder="Any author"
      options={props.authors}
      value={props.authorFilter}
      onChange={props.onAuthorFilter}
    />
    <SelectField
      label="Saved"
      placeholder="Any time"
      options={DATE_DAYS.map((days) => ({
        value: String(days),
        label: "Last " + String(days) + " days",
      }))}
      value={props.dateDays === undefined ? undefined : String(props.dateDays)}
      onChange={(value) => props.onDateDays(value === undefined ? undefined : Number(value))}
    />
    <div {...stylex.attrs(ui.foot)}>
      <Button variant="ghost" onClick={props.onClear}>
        Clear all
      </Button>
      <Button variant="ghost" onClick={props.onDone}>
        Done
      </Button>
    </div>
  </>
)
