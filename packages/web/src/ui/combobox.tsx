import { Combobox as Kobalte } from "@kobalte/core/combobox"
import * as stylex from "@stylexjs/stylex"
import { tokens } from "../tokens.stylex.ts"
import { surface } from "./surface.stylex.ts"

const styles = stylex.create({
  control: {
    display: "flex",
    width: "100%",
    height: 36,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 8,
    backgroundColor: tokens.bg,
  },
  input: {
    width: "100%",
    minWidth: 0,
    height: "100%",
    padding: "0 10px",
    borderWidth: 0,
    borderRadius: 8,
    color: tokens.ink,
    backgroundColor: "transparent",
    fontSize: 13,
    outline: "none",
    "::placeholder": { color: tokens.mute },
  },
  content: { width: "var(--kb-combobox-content-width, 360px)", padding: 8 },
  listbox: { overflowY: "auto", maxHeight: 240, outline: "none" },
})

export const ComboboxField = (props: {
  readonly label: string
  readonly placeholder: string
  readonly options: ReadonlyArray<string>
  readonly value: string
  readonly onChange: (value: string) => void
}) => (
  <Kobalte
    options={[...props.options]}
    placeholder={props.placeholder}
    triggerMode="manual"
    noResetInputOnBlur
    defaultFilter="contains"
    {...(props.value === ""
      ? { value: null }
      : props.options.includes(props.value)
        ? { value: props.value }
        : {})}
    onChange={(value) => props.onChange(value ?? "")}
    onInputChange={props.onChange}
    itemComponent={(itemProps) => (
      <Kobalte.Item item={itemProps.item} {...stylex.attrs(surface.item)}>
        <Kobalte.ItemLabel>{itemProps.item.rawValue}</Kobalte.ItemLabel>
      </Kobalte.Item>
    )}
  >
    <Kobalte.Label {...stylex.attrs(surface.label)}>{props.label}</Kobalte.Label>
    <Kobalte.Control {...stylex.attrs(styles.control)}>
      <Kobalte.Input {...stylex.attrs(styles.input)} />
    </Kobalte.Control>
    <Kobalte.Portal>
      <Kobalte.Content {...stylex.attrs([surface.floating, styles.content])}>
        <Kobalte.Listbox {...stylex.attrs(styles.listbox)} />
      </Kobalte.Content>
    </Kobalte.Portal>
  </Kobalte>
)
