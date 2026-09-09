import { Select as Kobalte } from "@kobalte/core/select"
import * as stylex from "@stylexjs/stylex"
import { tokens } from "../tokens.stylex.ts"
import { surface } from "./surface.stylex.ts"

export type SelectOption = {
  readonly value: string
  readonly label: string
}

const styles = stylex.create({
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 36,
    padding: "0 10px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: tokens.radiusSm,
    color: tokens.ink,
    backgroundColor: tokens.bg,
    fontSize: 13,
    outline: "none",
    cursor: "pointer",
    ":is([data-placeholder-shown])": { color: tokens.mute },
  },
  content: { width: "var(--kb-select-content-width, 360px)", padding: 8 },
  listbox: { overflowY: "auto", maxHeight: 240, outline: "none" },
})

export const SelectField = (props: {
  readonly label: string
  readonly placeholder: string
  readonly options: ReadonlyArray<SelectOption>
  readonly value: string | undefined
  readonly onChange: (value: string | undefined) => void
}) => (
  <Kobalte<SelectOption>
    options={[...props.options]}
    optionValue="value"
    optionTextValue="label"
    placeholder={props.placeholder}
    value={props.options.find((option) => option.value === props.value) ?? null}
    onChange={(option) => props.onChange(option === null ? undefined : option.value)}
    itemComponent={(itemProps) => (
      <Kobalte.Item item={itemProps.item} {...stylex.attrs(surface.item)}>
        <Kobalte.ItemLabel>{itemProps.item.rawValue.label}</Kobalte.ItemLabel>
      </Kobalte.Item>
    )}
  >
    <Kobalte.Label {...stylex.attrs(surface.label)}>{props.label}</Kobalte.Label>
    <Kobalte.Trigger {...stylex.attrs(styles.trigger)}>
      <Kobalte.Value<SelectOption>>
        {(state) => {
          const selected = state.selectedOption()
          return selected === null || selected === undefined ? props.placeholder : selected.label
        }}
      </Kobalte.Value>
      <span aria-hidden="true">▾</span>
    </Kobalte.Trigger>
    <Kobalte.Portal>
      <Kobalte.Content {...stylex.attrs([surface.floating, styles.content])}>
        <Kobalte.Listbox {...stylex.attrs(styles.listbox)} />
      </Kobalte.Content>
    </Kobalte.Portal>
  </Kobalte>
)
