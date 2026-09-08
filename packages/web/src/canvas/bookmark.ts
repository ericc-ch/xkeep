export const postUrl = (item: { readonly handle: string; readonly id: string }) =>
  "https://x.com/" + item.handle + "/status/" + item.id

export const short = (text: string, max: number) =>
  text.length <= max ? text : text.slice(0, max - 1) + "…"
