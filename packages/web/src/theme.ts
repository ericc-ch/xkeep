export const theme = {
  color: {
    bg: "#000000",
    card: "#050505",
    ink: "#e7e9ea",
    mute: "#71767b",
    line: "#2f3336",
    accent: "#1d9bf0",
    danger: "#f4212e",
    hover: "#16181c",
    glass: "rgba(0,0,0,.9)",
    glassRaised: "rgba(0,0,0,.97)",
    pane: "rgba(0,0,0,.98)",
    overlay: "rgba(0,0,0,.72)",
    accentWash: "rgba(29,155,240,.1)",
    gridAxis: "#3a3d44",
    gridMajor: "#23262c",
    origin: "#8a8680",
  },
  /** Nested 4 · controls 8 · large panels 12 · circles 999. */
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    pill: 999,
  },
  shadow: {
    floating: "0 14px 48px rgba(0,0,0,.68)",
    dialog: "0 24px 80px rgba(0,0,0,.8)",
    pane: "-18px 0 44px rgba(0,0,0,.34)",
  },
  blur: {
    glass: 18,
    overlay: 5,
  },
  space: {
    gutter: 8,
  },
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const

/** Parse `#rrggbb` into a Pixi RGB integer. */
export const pixiColor = (hex: string): number => {
  if (hex.length !== 7 || !hex.startsWith("#")) throw new Error("expected #rrggbb")
  return Number.parseInt(hex.slice(1), 16)
}
