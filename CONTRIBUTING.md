# Contributing to Schematic Canvas

Thanks for your interest in improving this project.

## The one rule: no build step, on purpose

This project is intentionally **dependency-free and build-free** — plain HTML/CSS/JS that the
browser loads directly. Please do not introduce:

- a bundler, transpiler, or framework
- runtime CDN imports
- npm dependencies required to *run* the app

Node.js runs the MCP server, CLI and automated tests; Python runs the optional dev server.

## Running it

```bash
# Option A — just open index.html in a browser (double-click, or drag into a tab)

# Option B — dev server, which adds no-cache headers so edits show up on refresh
python serve.py            # http://127.0.0.1:8642
python serve.py 8655       # pick a free port when 8642 is taken
npm start                  # == python serve.py
npm test                   # all topology, geometry and MCP regression tests
```

If the requested port is already serving, `serve.py` prints a clear message and exits instead
of silently sharing the port. Start another instance on the next port, or open the one already
running.

## After changing JS or CSS: bump the version counter

Browsers cache aggressively, and an already-open tab keeps running whatever it loaded — editing
a file on disk does **not** change a page you are looking at. `index.html` appends a
cache-busting query to every asset:

```html
<script src="app.js?v=15"></script>
```

When you change any JS or CSS file:

1. Bump `?v=N` for **all** script and style tags together — keeping them in sync avoids a
   half-stale page.
2. Bump `APP_VERSION` in `app.js` so the build stamp in the status bar matches.

That stamp is how you tell at a glance whether the browser is running your latest code or a
cached copy. If the status bar shows an older version, hard-refresh (`Ctrl+F5` / `Ctrl+Shift+R`).

## Tests

`netlist.test.js` covers netlist generation, topology recognition and the check report. Add a
test for any change to wiring or topology behaviour:

```bash
npm test
```

## Third-party assets

New artwork must be originally drawn or licensed for redistribution, with source and
license recorded in the README. Existing Analog Canvas artwork is distributed under
MIT with the maintainer-confirmed permission and attribution documented in
[README.md](./README.md).

## Pull requests

1. Open an issue first for anything non-trivial.
2. Keep changes focused — one concern per PR.
3. Run `npm test` and confirm it passes.
4. Say what you changed and how you verified it (browser + OS is helpful).

## Reporting bugs

Please include browser and OS, what you did, what you expected, and what happened. A
screenshot, or a saved schematic (`Export → JSON`), makes issues much faster to reproduce.
