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

Edit has separate actions to create or edit nodes, groups and arrows, **Top Config** (shortcut **T**), plus a **Raw DOT** card for arbitrary DOT source. Top Config edits the root graph's rankdir, rank, fontname, fontcolor, splines and compound options. Each **Edit group** row offers **Items** for that group's contents and **Cfg** for its rankdir, rank, fontname and fontcolor, followed by **Del**. Cfg leaves the existing group form's label, style and colors unchanged. Rankdir, rank, splines and compound have common-value dropdowns; fontname accepts free text with font suggestions, and fontcolor uses the color picker. **None** or an empty font field removes that option from the selected graph or cluster on Apply. Back/Escape discards edits; Items/Cfg return to the Edit group list after Back or a successful Submit/Apply. Graphviz may ignore root-level rank or cluster-level rankdir depending on the layout engine, but these settings remain editable in DOT.

Existing implicit nodes (nodes only mentioned by an edge) are selectable. Group means a Graphviz `subgraph cluster_*`; arrow means `->` in a digraph and `--` in an undirected graph. Structured forms edit only the selected declaration and leave unrelated source, comments and unknown attributes untouched. Chained, port and subgraph-endpoint edges should be edited in Raw DOT: the form will not rewrite them unsafely. Raw edits and loaded DOT must parse before replacing the current graph.

**Items** opens rearrangement for the chosen group and lets you toggle the direct membership of each node declaration, arrow statement (including complex arrows), and eligible group. The selected group and its ancestor groups are excluded. Each row shows "In the group" when selected, the name of its current group when it belongs to a different group, or "Not in the group" when it is at the top level. Filter rows by name, or use **Change** (Enter in the filter) to add all visible rows when at least one is outside the group, or remove all visible rows when all are inside. Removing a row moves it to the top-level graph; moving a group retains its untoggled contents. An implicit node becomes an explicit node declaration in its chosen group without moving its arrow. When a node changes clusters (including through a moved group), connected arrows whose clipping refers to its old cluster are updated to the new cluster or cleared. **Submit** must be clicked to save all pending changes together; Back/Escape discards pending changes and returns to Edit group. Duplicate group IDs block Submit rather than choosing an ambiguous destination.

Each existing-element row has a smaller red **Del** button. It opens a confirmation showing how many distinct node IDs, arrow statements and groups will disappear; **Back** is focused by default and changes nothing. Deleting a node ID also deletes all its declarations and connected arrows, including arrows that define an implicit node. An arrow's Del removes only that arrow, even if it is too complex for the edit form. For groups, **Keep Elements** removes the group wrapper and moves its contained nodes, arrows and nested groups into the parent (without the deleted group's styling), updating surviving clipping references to the new enclosing cluster or clearing them. Red **Delete Elements** removes the whole group subtree and arrows anywhere in the graph connected to its nodes or nested group IDs, clearing references to removed clusters on surviving arrows. Node declarations outside the group remain, including nodes with IDs also declared inside it; outside implicit endpoints of removed arrows are preserved as node declarations. Only a confirmed choice saves the changed graph.

| Element | Required | Optional editable attributes |
|---|---|---|
| Node | ID | Label, shape, style, outline color, fill color |
| Group | `cluster_*` ID | Label, style, outline color, background color |
| Arrow | Source and target IDs | Label, style, color, arrowhead (digraph only) |

In New arrow and Edit arrow, Source and Target suggest existing node IDs, including implicit nodes referenced by arrows, but not group IDs. Suggestions are deduplicated and filtered as you type; you can also enter a new ID freely. Edit arrow offers **Clipping**: **keep** (the default on opening) leaves `ltail` and `lhead` unchanged; **none** removes both; **start** sets `ltail` from the source node's closest enclosing cluster and removes `lhead`; **end** sets `lhead` from the target node's closest enclosing cluster and removes `ltail`; **both** sets both. A selected endpoint outside any cluster has its clipping attribute removed. Set Top Config **Compound** to `true` for Graphviz to render cluster clipping. Edit node changes to the parent group also update connected arrows whose clipping refers to the node's old cluster; unrelated clipping values are preserved. Every New and Edit form has an optional **Parent group** field suggesting existing cluster IDs. Leave it empty to create or move an element at the top level; Edit starts with the element's current group selected. A typed parent ID must identify exactly one existing cluster. Moving a group carries its contents; groups cannot be moved into themselves or their descendants.

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
