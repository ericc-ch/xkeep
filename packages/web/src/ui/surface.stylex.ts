import * as stylex from "@stylexjs/stylex"
import { tokens } from "../tokens.stylex.ts"

const show = stylex.keyframes({
  from: { opacity: 0, transform: "scale(0.96)" },
  to: { opacity: 1, transform: "scale(1)" },
})
const hide = stylex.keyframes({
  from: { opacity: 1, transform: "scale(1)" },
  to: { opacity: 0, transform: "scale(0.96)" },
})
const overlayShow = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})
const overlayHide = stylex.keyframes({
  from: { opacity: 1 },
  to: { opacity: 0 },
})

export const surface = stylex.create({
  glass: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    backgroundColor: "rgba(0,0,0,.9)",
    backdropFilter: "blur(18px)",
  },
  overlay: {
    position: "fixed",
    zIndex: 40,
    inset: 0,
    backgroundColor: "rgba(0,0,0,.72)",
    backdropFilter: "blur(5px)",
    animationName: overlayHide,
    animationDuration: "180ms",
    animationFillMode: "forwards",
    animationTimingFunction: "ease-in",
    ":is([data-expanded])": {
      animationName: overlayShow,
      animationTimingFunction: "ease-out",
    },
    ":is([data-closed])": { pointerEvents: "none" },
    "@media (prefers-reduced-motion: reduce)": { animationDuration: "0ms" },
  },
  positioner: {
    position: "fixed",
    zIndex: 41,
    inset: 0,
    display: "grid",
    placeItems: "center",
    padding: 20,
    ":is(:has([data-closed]))": { pointerEvents: "none" },
  },
  floating: {
    position: "absolute",
    zIndex: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,.97)",
    boxShadow: "0 14px 48px rgba(0,0,0,.68)",
    outline: "none",
    transformOrigin: "var(--kb-menu-content-transform-origin)",
    animationName: hide,
    animationDuration: "180ms",
    animationFillMode: "forwards",
    animationTimingFunction: "ease-in",
    ":is([data-expanded])": {
      animationName: show,
      animationTimingFunction: "ease-out",
    },
    ":is([data-closed])": { pointerEvents: "none" },
    "@media (prefers-reduced-motion: reduce)": { animationDuration: "0ms" },
  },
  item: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "10px 12px",
    borderWidth: 0,
    borderRadius: 8,
    color: tokens.ink,
    backgroundColor: {
      default: "transparent",
      ":is([data-highlighted])": "#16181c",
    },
    fontSize: 13,
    fontWeight: 600,
    textAlign: "left",
    cursor: "pointer",
    outline: "none",
    userSelect: "none",
    ":is([data-disabled])": { color: tokens.mute, cursor: "default" },
  },
  label: {
    display: "block",
    margin: "12px 0 6px",
    color: tokens.mute,
    fontSize: 12,
    fontWeight: 600,
  },
  heading: { margin: "0 0 12px", fontSize: 16, fontWeight: 700 },
  quiet: { margin: "0 0 4px", color: tokens.mute, fontSize: 12 },
})
