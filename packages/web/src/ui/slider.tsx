import { Slider as Kobalte } from "@kobalte/core/slider"
import * as stylex from "@stylexjs/stylex"
import { tokens } from "../tokens.stylex.ts"

const styles = stylex.create({
  root: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    height: 44,
    padding: "0 12px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,.9)",
    backdropFilter: "blur(18px)",
  },
  label: {
    margin: 0,
    color: tokens.mute,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  track: {
    position: "relative",
    width: 88,
    height: 6,
    borderRadius: 999,
    backgroundColor: tokens.line,
  },
  fill: {
    position: "absolute",
    height: "100%",
    borderRadius: 999,
    backgroundColor: tokens.accent,
  },
  thumb: {
    display: "block",
    width: 14,
    height: 14,
    top: -4,
    borderRadius: 999,
    backgroundColor: tokens.accent,
    outline: "none",
  },
})

export const ClusterSlider = (props: {
  readonly value: number
  readonly onChange: (value: number) => void
}) => (
  <Kobalte
    minValue={2}
    maxValue={40}
    step={1}
    value={[props.value]}
    onChange={(values) => {
      const next = values[0]
      if (next !== undefined) props.onChange(next)
    }}
    getValueLabel={(params) => "Cluster count · " + String(params.values[0])}
    {...stylex.attrs(styles.root)}
  >
    <Kobalte.Label {...stylex.attrs(styles.label)}>
      Cluster count · {String(props.value)}
    </Kobalte.Label>
    <Kobalte.Track {...stylex.attrs(styles.track)}>
      <Kobalte.Fill {...stylex.attrs(styles.fill)} />
      <Kobalte.Thumb {...stylex.attrs(styles.thumb)}>
        <Kobalte.Input />
      </Kobalte.Thumb>
    </Kobalte.Track>
  </Kobalte>
)
