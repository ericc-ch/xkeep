# x bookmarks library

personal, local, foss. no paid x developer api.

cooked 2026-09-01. name still open. this is the shape, not an implementation spec.

the whole product is an `npx` server. ui, sqlite, embeddings, canvas, tags. intake is a json file. no chrome extension in v1.

---

## problem

x bookmarks are a graveyard. native search is exact-text only. the official archive download skips bookmarks. the public api caps you at 800 and costs money.

this is for one person (erick), on gl503ge (intel arc). qwen3-vl-embedding already runs there.

## wedge

pieces exist. this combo does not:

local **qwen3-vl-embedding** (tweet text + images in one space) + **cluster canvas** + **no saas**.

everybody else is some mix of: paid x api, sending text to their cloud, keyword-only, or a chrome store listing with a 150-item free cap.

## what already exists (don't rebuild these)

capture / export, no paid api:

- [siftly](https://github.com/viperrcrypto/Siftly) — bookmarklet or console paste on `x.com/i/bookmarks`, auto-scroll, `bookmarks.json` download, drop on the app. 3k stars. closest intake ux. vision tags go through a paid api. mindmap, not a vector canvas.
- [prinsss/twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter) — userscript. watches what the x web app already loaded. json/csv export. twillot credits this.
- [scrollmark](https://github.com/kmccleary3301/scrollmark) — fork of the above, rebuilt. userscript + optional local sqlite companion. research archive, not vl embeddings.
- [x-bookmark-archive](https://github.com/calebdshenk-a11y/x-bookmark-archive) / [quantummonkey exporter](https://github.com/QuantumMonkey/twitter-x-bookmarks-exporter-and-downloader) — console snippet → json.
- [xmarks](https://www.npmjs.com/package/xmarks) — cli that drives a browser with your session. `xmarks capture`. closest to one-command if you don't want devtools.
- [bookmark-eXport](https://github.com/pauljump/bookmark-eXport) — playwright + your cookies, jsonl. listens to the page's own requests.

store-listing managers (not the model):

- [twillot](https://github.com/twillot-app/twillot) — extension, local sync, folders, keyword, paid ai tags.
- [contextbolt](https://chromewebstore.google.com/detail/contextbolt-bookmarks/gdedbpfeefkfigdojgimaijolhpkdggn) — extension, semantic search, topic clusters, mcp. 150 free, $6/mo, tweet text goes to their ai.

canvas-ish, wrong stack:

- [spatial-twitter-search](https://github.com/lachlanjc/spatial-twitter-search) — openai embeddings + chromadb + umap + infinite canvas. you paste fetch headers by hand.
- [booked](https://github.com/Entrepenulian/Booked) — local embeddings, knowledge graph, dedicated chrome profile.

steal the intake pattern from siftly. steal "local companion owns sqlite" from scrollmark. do not steal their ui or their cloud.

---

## product

two verbs. only one of them is software you run every day.

**save** — you are already logged into x. paste a console snippet (or click a bookmarklet) on `x.com/i/bookmarks`. it scrolls, dumps an importable json, downloads it. this is a solved genre. do not invent an extension for it.

**think** — `npx <name>`. first run pulls the model, boots the server, opens the library. drop the json. semantic search, filters, tags, canvas.

re-drop later = sync. dedupe on tweet id. that is "future bookmarking" for a human who bookmarks in bursts. not a watcher on every star.

add a userscript or thin extension only when the re-export ritual starts to suck. not v1.

### onboarding (this is the product)

1. `npx <name>` — library opens. empty state explains the dump.
2. go to bookmarks, paste / bookmarklet, get json.
3. drop the file. embedding starts in the background.
4. search works first. canvas is one click away on the same vectors.

foss people will tolerate a model download. they will not tolerate clone / venv / drivers / then maybe it captures. `npx` is the install. gpu drivers are a one-time host problem (already done on gl503ge).

do not make chrome-extension storage the library. even with `unlimitedStorage`, that's a browser profile, not a folder you rsync. uninstall wipes it.

extension storage caps, if anyone asks later:

- `chrome.storage.sync`: ~100kb. ignore.
- `chrome.storage.local`: 10mb, lifted by `unlimitedStorage`.
- indexeddb + `unlimitedStorage`: basically disk, still trapped in the profile.

so: no extension in v1. if one appears later it is a thin wrapper (capture queue + "open library" = the npx origin). 10mb is plenty for a json queue without media.

---

## v1 cut

in:

- bookmarks only (not likes, not lists)
- shadow-copy: x still has them. we never unbookmark
- file intake (bookmarklet + console snippet + drag-drop). incremental import, dedupe on tweet id
- sqlite + media dir on disk, default `~/.local/share/<name>/`
- qwen3-vl-embedding-2b on gl503ge / intel arc, whatever stack already runs there (likely openvino/ipex; llama.cpp sycl still chokes the vision encoder)
- matryoshka: store 512 or 1024 dims, not full 2048/4096
- embed tweet text plus images / video thumbs so memes and papers actually separate
- search is the front door (semantic + keyword)
- filters: author, media type (text / image / video / article / link), date, tags
- auto tags from clusters. manual override. no llm pass
- canvas is a room: umap (or equivalent) + cluster blobs, click into a tweet. not the first screen
- localhost only

out of v1:

- chrome extension / userscript live capture
- taking over x's bookmark button
- likes / home timeline
- llm labeling
- tailnet so other machines talk to the sidecar (trivial later)
- 8b model
- cloud sync, accounts, mcp endpoint, chrome store

---

## architecture

```
x.com/i/bookmarks  --(bookmarklet/console)-->  bookmarks.json
                                                  |
                                                  v
npx <name>  =  http server on localhost
               ├── spa (search, filters, tags, canvas)
               ├── sqlite (tweets, users, tags, vectors)
               ├── media/ (optional local copies, urls always stored)
               └── embed worker (qwen3-vl-embedding on arc)
```

the server is the product. the browser tab is just the window (`http://127.0.0.1:<port>`). not a `chrome-extension://` page.

gl503ge is the brain. this is where embeddings run.

### storage

source of truth is files:

```
~/.local/share/<name>/
  library.sqlite
  media/
  models/          # or reuse the existing hf/openvino cache
  imports/         # raw json drops, keep them
```

sqlite holds: tweet id, author, text, created_at, media urls/types, quoted/thread bits we actually got, import batch, tags (auto + manual), embedding blob, cluster id.

raw json from each dump stays on disk so a parser change can re-ingest without going back to x.

backup = rsync that folder. that's the point of not living in chrome.

### embedding

- model: `Qwen/Qwen3-VL-Embedding-2B`
- instruction-aware, multimodal, mrl
- input: text + images (and video thumbs if cheap). one vector per bookmark
- dim: 512 or 1024 stored
- batch in the background after import. ui stays usable on keyword/filters while vectors catch up
- cluster (hdbscan or similar) after a batch; auto tags are cluster labels you can rename
- search: query text (and later an image) → embedding → cosine knn, then filters as metadata pre/post cut
- canvas: 2d projection of the same vectors. search can highlight a neighborhood instead of a list

if vl export/runtime is annoying on a given week, text-only `Qwen3-Embedding-0.6B` via openvino is a documented fallback. v1 should still try vl first; that's the wedge.

### ui

search bar is home. results are a list/masonry, not the canvas.

filters sit next to search: author, type, date, tag (auto or manual).

canvas is a second view on the same query. clusters labeled. click a point, see the tweet. no force-graph theatre.

tagging: click a cluster, name it. click a tweet, add/remove tags. auto tags never overwrite manual.

### capture quality

console/bookmarklet dump is good enough. it is what siftly ships.

richer capture (watching the page's own graphql, threads, articles) lives in twitter-web-exporter / scrollmark. if the json is too thin, borrow their parser, still ship a file. do not take on a userscript runtime in v1.

we are reading the user's own logged-in bookmarks, for the user, locally. not a public scraper, not a developer app.

---

## later (only when v1 sucks in a specific way)

- userscript or thin extension: live capture so you stop re-pasting. still not the product. queue in the extension, drain into sqlite.
- `npx <name> sync` that drives helium/chrome with the existing session (xmarks shape) if console paste is too fiddly
- tailnet bind so the library is reachable from the phone / another box
- llm pass for tag names if cluster labels are garbage
- likes, as a separate pile, same embed pipeline
- mcp tool that searches the local library (contextbolt's paid trick, but local)

---

## name

open. needs to read as the job. not a chrome-store adjective pile. not a random -boo (that's for agents).

working folder on gl503ge: `~/projects/x-bookmarks/`

---

## locked decisions

| thing | call |
| --- | --- |
| paid x api | no |
| v1 surface | npx server + file intake |
| extension | not v1 |
| storage | sqlite on disk, not chrome |
| machine | gl503ge, intel arc |
| model | qwen3-vl-embedding-2b, mrl 512/1024 |
| x bookmarks | shadow-copy, never delete |
| scope | bookmarks only |
| tags | clusters + manual, no llm |
| home screen | search, not canvas |
| network | localhost |

