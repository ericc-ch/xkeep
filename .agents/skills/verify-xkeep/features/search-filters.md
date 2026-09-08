# Search and filters

## Sub-features

- Enter-to-search semantic retrieval.
- Search result focus and selection.
- Media, tag, author, and date filters.
- Intersection of search and filter matches.
- Tag and cluster color overlays.

## How to get to it (user POV)

Open `/` with embedded bookmarks. Enter a phrase in `Search the canvas` and press Enter. Open `Filters` for media, tag, author, and saved-date controls. Toggle `Tags` or `Clusters` in the top toolbar.

## Driving it with Playwriter

Use `getByLabel("Search the canvas")`, fill a known fixture phrase, and press `Enter`. Select a result by its bookmark text. Open `getByRole("button", { name: "Filters" })` and drive the named select elements `Tag`, `Author`, and `Saved`. Capture the whole canvas before and after because matching changes Pixi alpha rather than DOM visibility.

## Gotchas

Search and filters dim nonmatches. They do not remove marks or change positions. The Tags and Clusters overlays are mutually exclusive. The cluster-count slider appears inside Filters only while Clusters is on.
