# DOT Editor

A mobile-friendly Graphviz DOT viewer and editor. It runs entirely in the browser: React handles the single-screen interface and `@viz-js/viz` renders the graph locally. The DOT source remains the authoritative graph, including syntax and attributes not exposed by the forms.

## Run and build

Requires Node.js 20.19+ and npm.

```sh
npm install
npm run dev
npm test
npm run build
```

`npm run build` produces **`dist/index.html` only**. Vite's single-file plugin inlines the JavaScript, CSS, and Viz WebAssembly runtime, so the file can be deployed as a standalone HTML page. The file is sizable because it includes Graphviz. Web storage requires an accessible browser origin; clipboard access typically requires HTTPS or localhost and browser permission.

## Using the editor

On the first visit, Config opens automatically. Choose **New graph** to start with an empty digraph, or enter an API URL, graph name and optional API key and choose **Load**. The graph is stored locally after every successful edit or load. Config and Edit keep their actions together in a bottom-centered row that wraps on narrow screens; red **Back** returns to the previous view, and green **Apply** commits an edit. Config and Edit cover the viewer; when they are closed, six on-screen buttons pan and zoom the graph. Panning allows at least half a viewport of travel beyond the normal edge. Display defaults to a responsive layout; Config can persist a Mobile or Desktop override.

Edit has separate actions to create or edit nodes, groups and arrows, plus a **Raw DOT** card for arbitrary DOT source. Existing implicit nodes (nodes only mentioned by an edge) are selectable. Group means a Graphviz `subgraph cluster_*`; arrow means `->` in a digraph and `--` in an undirected graph. Structured forms edit only the selected declaration and leave unrelated source, comments and unknown attributes untouched. Chained, port and subgraph-endpoint edges should be edited in Raw DOT: the form will not rewrite them unsafely. Raw edits and loaded DOT must parse before replacing the current graph.

Each existing-element row has a smaller red **Del** button. It opens a confirmation showing how many distinct node IDs, arrow statements and groups will disappear; **Back** is focused by default and changes nothing. Deleting a node ID also deletes all its declarations and connected arrows, including arrows that define an implicit node. An arrow's Del removes only that arrow, even if it is too complex for the edit form. For groups, **Keep Elements** removes the group wrapper and moves its contained nodes, arrows and nested groups into the parent (without the deleted group's styling), while red **Delete Elements** removes the whole group subtree. Only a confirmed choice saves the changed graph.

| Element | Required | Optional editable attributes |
|---|---|---|
| Node | ID | Label, shape, style, outline color, fill color |
| Group | `cluster_*` ID | Label, style, outline color, background color |
| Arrow | Source and target IDs | Label, style, color, arrowhead (digraph only) |

In New arrow and Edit arrow, Source and Target suggest existing node and group IDs, including implicit nodes referenced by arrows. Suggestions are deduplicated and filtered as you type; you can also enter a new ID freely. Every New and Edit form has an optional **Parent group** field suggesting existing cluster IDs. Leave it empty to create or move an element at the top level; Edit starts with the element's current group selected. A typed parent ID must identify exactly one existing cluster. Moving a group carries its contents; groups cannot be moved into themselves or their descendants.

Optional values can be cleared; other DOT attributes remain intact. Editing a node ID changes that declaration, not references elsewhere in the graph; use Raw DOT to make coordinated identifier changes.

Color fields open a popup with the browser color selector and saved-color swatches. The final nonempty color is saved when the popup closes (Close, Escape, or outside click), not on every selection; selecting an already saved color leaves the tray unchanged. Restoring, loading, or applying a graph adds explicit `#RRGGBB` node, arrow, and group colors to available tray slots after existing saved colors. Named colors and graph/default attributes are not added automatically.

## Remote API and export

Edit `src/config.json` before building to change the `saveApi` and `loadApi` endpoint path names (defaults: `save` and `load`). For a base URL `https://example.com/api`, a graph name `my graph`, and API key `secret`, the requests are:

```text
POST https://example.com/api/save?key=my+graph&apiKey=secret
Content-Type: text/plain; charset=utf-8
Body: raw DOT text

GET https://example.com/api/load?key=my+graph&apiKey=secret
Response body: raw DOT text
```

Existing base-URL query parameters are preserved. Save/load require the API URL and graph name; failed requests do not replace the current graph. The key is passed in the URL as required by the API, so use HTTPS and a trusted endpoint. The API key remains in memory for the current page only; the graph name and API URL are stored locally. **Export** attempts to copy the DOT to the clipboard and displays a separate text-only page with Back. If copying is denied, the page displays the error and a Retry copy button; the DOT remains visible for manual copying.

Local storage keys use the `dotEditor:` prefix: `graph`, `graphName`, `layout`, `apiUrl`, and `colors` (up to eight saved colors). The API key is never stored. Browser storage can be cleared to start fresh.

Component and dialog tests live beside their `.jsx` files as `.spec.jsx`; graph, API, storage and viewport utilities have adjacent Vitest specs.
