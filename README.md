# Circuit Draw

## Noise-source symbols

**Sources → V Noise / I Noise** adds Razavi-style voltage/current noise sources,
with editable `v_n` / `i_n` labels. See [reference and export behavior](docs/noise-symbols.md).
These are diagram symbols; simulation requires a simulator-specific noise model.

## Small-signal circuits

Small Signal offers two-terminal `gm · vgs`, VCCS and VCVS sources plus ro, rπ, Cgs and Cgd. Only output terminals are drawn; the right-side `display` notation defines the controlling variable. Edit display as `g_m v_gs`, `g_mb v_bs`, or `A_v v_ctrl`, with SVG subscripts. gm current flows D to S, VCCS current out+ to out-, and VCVS output voltage follows its internal polarity marks.

For optional SPICE/Spectre export, bind the displayed voltage variable to named circuit nodes with `controlPositive` and `controlNegative`; gm defaults its negative reference to its S net. These fields add no graphic pins. Missing binding produces an explicit netlist comment and a check warning instead of invented nodes. gm/gain/value are numeric electrical values independent of display notation. Existing drawings with left control wires must remove those wires and bind the controlling voltage by name when migrating. No simulation or operating-point extraction is implied.

Transformer artwork is an original simplified rendition informed by actual schematic figures 2.4.2 and 2.4.6 in [ISSCC 2010 Hua et al.](https://chic.caltech.edu/wp-content/uploads/2010/02/Hua-ISSCC2010.pdf), also compared with [ISSCC 2013 Brown et al. figure 25.2.4](https://wics.engin.umich.edu/wp-content/uploads/sites/35/2018/06/Brown_ISSCC2013.pdf). It uses three rounded turns per winding, upper positive-polarity dots and concise k/Lp/Ls notation, with unchanged four-terminal coordinates and netlist semantics.

**Schematic Canvas** is a dependency-free, single-page web app for drawing analog / RF
circuit schematics and turning them into real EDA output. It runs entirely in the browser,
needs no build step and no external libraries, and can export your drawing as vector or
raster graphics and as a runnable **SPICE** or **Spectre** netlist.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Zero dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)
![Node](https://img.shields.io/badge/tested%20on-Node%2018%2B-3c873a.svg)

---

## Features

- **Analog/RF schematic editor** — place and wire transistors, resistors, caps, inductors, transformers,
  op-amps, diodes, voltage sources, and supply/ground ports on a clean grid canvas.
- **Fast, keyboard-first interaction** — insert (`I`), wire (`W`), text (`T`), arrow/line/
  rect/circle annotations, rotate (`R`), mirror (`Shift+R` / `Ctrl+R`), undo/redo (`Ctrl+Z`).
- **Smart wiring** — T-junctions and device pins landing on a wire interior are recognized
  as real connections; pure crossings stay disconnected, per schematic convention.
- **One-click export** — `SVG`, `PNG`, `JPG`, `PDF` (vector via a print window), plus **SPICE** and
  **Spectre** netlists with correct pin ordering and subcircuit prefixes.
- **Built-in component library** — a broad set of analog symbol primitives, plus templates
  such as a **5-transistor OTA**.
- **Design-rule check** — a netlist check report flags floating pins, dangling wires, and
  missing supply/ground ports before you export.
- **Vendor-neutral formats** — generated netlists work with Spectre and generic SPICE simulators.

## Getting started

No installation, no build.

**Easiest (Windows): double-click `start-dev.bat`** — it starts the no-cache dev server and
opens the app in your browser.

Or manually:

```bash
# Recommended — local dev server (sends no-cache headers, so you always get the latest code)
python serve.py            # serves http://127.0.0.1:8642
python serve.py 8655       # any port
```

> **Why not just double-click `index.html`?** Opening the file directly (`file://`) works, but
> the browser can keep serving a **cached copy of `app.js`**, so edits look like they never
> took effect. The dev server sends `no-store` headers, which makes that impossible — and the
> build stamp in the status bar tells you at a glance which version is running. If you do open
> `index.html` directly and changes don't show, hard-refresh (`Ctrl+F5`).

If that port is already serving, `serve.py` tells you so and exits rather than silently
sharing the port — start the next one up, or just open the instance already running.

With Node.js you can also run it through npm:

```bash
npm start        # == python serve.py
npm test         # all topology, geometry and MCP regression tests
```

> When you change JS/CSS during development and the browser seems to keep the old code,
> hard-refresh (`Ctrl+F5`). The `?v=N` query strings on the `index.html` script/style tags
> are a cache-busting version counter, and `APP_VERSION` in `app.js` keeps the on-screen
> build stamp in sync.

## Usage

| Action | Shortcut |
| --- | --- |
| Select    | `V` / `Esc` |
| Insert component | `I` |
| Wire      | `W` |
| Finish wire | click a pin/wire · `Shift`+click · right-click |
| Text      | `T` |
| Rotate / Mirror | `R` · `Shift+R` · `Ctrl+R` |
| Orthogonal wire | `F3` |
| Fit document | `F` |
| Undo / Redo | `Ctrl+Z` · `Ctrl+Shift+Z` |
| Pan / Zoom | `Space`+drag / middle-drag · wheel |

Use the **File ▾** menu for new/open/save projects and for **Export**. Use **Netlist ▾** to
view the netlist, the instance table, or the check report.

## Export

- **SVG** — vector, self-contained (styles are embedded so it renders identically outside the app).
- **PNG** — raster snapshot of the canvas.
- **JPG** — high-quality raster snapshot with a white background.
- **PDF** — vector quality; opens a print window (no dependencies).
- **SPICE / Spectre** — netlists with correct pin ordering, port/ground naming, and subcircuit
  prefix conventions.

## Testing

The netlist engine ships with a dependency-free unit suite driven by Node's built-in test runner:

```bash
npm test
```

Tests cover topology (T-junctions, crossings, splits), pin/net naming, floating detection,
and SPICE/Spectre/instance-table output. Requires Node 18+.

Regression tests also cover exact 90-degree pin transforms, multi-frame wire dragging,
safe imports, old VDD Rail migration, MCP stdio calls, backups and local-editor startup.
Run all tests with `npm test`.

## Recovery and safe imports

The canvas starts empty on ordinary page loads. It retains the last recovery copy:
use **File → Restore Recovery Copy** to restore it after refresh or reopening the page
at the same origin. The status says **Recovery copy saved**, distinguishing it from
**Save Project**, which downloads JSON. Unsaved edits trigger a browser close warning.
Recovery is scoped to the browser origin; save JSON for durable copies or changing ports.
Invalid JSON projects are validated before the current drawing is replaced.

The power library contains a single **VDD** symbol. Old `vdd_rail` entries load as VDD
with the same electrical pin position. New templates use VDD.

## Circuit Draw Codex plugin

The plugin bundles the existing editor, a dependency-free Node.js stdio MCP server and
the `draw-circuit` skill. It needs Node 18+ on PATH, no API key and no npm install.
The plugin and its bundled component artwork are released under the MIT License.

The skill uses **two actual subagents** in this order:

1. Drawing agent writes the first editable JSON + SVG, then stops.
2. Review agent checks exact pin/net topology and inspects a real rendered screenshot.
3. After review completes, the drawing agent writes a separate revision and change log.
4. Review agent rechecks the revision. The coordinator delivers only after both topology
   and visual gates pass, or explicitly reports remaining blockers.

Reviewed drafts are kept. The reviewer never edits the circuit. The two role instructions
are in `skills/draw-circuit/agents/`. Hosts without subagent support must disclose the
limitation instead of claiming independent agents ran.

Build the source-only package and install from the local marketplace:

```powershell
node scripts/package-plugin.js
codex plugin marketplace add .
codex plugin add circuit-draw@circuit-tools
codex plugin list
```

Restart Codex or start a fresh local chat if the new plugin tools are not yet visible.
Example request:

> 使用 $draw-circuit 绘制五管 OTA，让校验 agent review 完再由绘图 agent 修改，电源统一用 VDD。

The nine MCP tools are:

| Tool | Purpose |
| --- | --- |
| `list_components` | Inspect exact symbol pins and defaults |
| `create_project` | Create blank JSON or a five-transistor OTA |
| `read_project` | Read validated editable JSON |
| `write_project` | Validate and atomically write a project |
| `connect_pins` | Wire named device pins with optional waypoints |
| `move_device` | Move a device with attached wires |
| `check_project` | Read-only topology report and instance table |
| `export_project` | Export SVG, SPICE, Spectre or normalized JSON |
| `open_editor` | Return a loopback editor URL with the project snapshot loaded |

All paths are absolute. Existing output files require `overwrite: true`; overwritten
files receive timestamped backups. Browser Save Project downloads JSON and does not
write back to the loaded source file. MCP export is SVG/netlist/JSON; use browser export
for PNG/JPG/PDF. The local editor URL expires after 30 minutes.

If the MCP is not loaded, the skill can call the same engine through a structured args file:

```powershell
node scripts/circuit-cli.js create_project --args-file D:\work\create-args.json
```

Example args: `{"path":"D:/work/ota.json","name":"Five-transistor OTA","template":"ota5"}`.
Netlist generation does not simulate the circuit. Models/subcircuit definitions are external;
VDD markers name a net but do not create a voltage source. Three-terminal MOS bulk is
tied to source in the generated netlists.

## Project structure

```
.
├── index.html          # app shell (menus, toolbars, dialogs)
├── app.js              # main app: canvas, tools, selection, wires, undo/redo
├── components.js       # component symbol library (SVG primitives)
├── templates.js        # built-in schematic templates (e.g. 5-transistor OTA)
├── netlist.js          # SPICE / Spectre netlist generation + check report
├── exporter.js         # SVG / PNG / JPG / PDF export
├── netlist.test.js     # unit tests (Node 18+, no dependencies)
├── style.css           # styling
├── serve.py            # optional no-cache dev server
├── package.json        # metadata + npm scripts
└── LICENSE             # MIT
```

## Publishing note

The three binary Visio stencils (`Analog Circuit.vss`, `RFIC_lib.vss`, `RFsys_lib.vss`),
the `verify_ota.png.jpg` screenshot, and `_site_extra_chips.json` were source/scrape artifacts
used while building the component library. They are **not** part of the runtime app and are
intentionally excluded from this repository via `.gitignore`. If you want to publish a demo
screenshot, add your own image under `docs/` and link it above.

## Contributing

Contributions are welcome — please read [CONTRIBUTING.md](./CONTRIBUTING.md) first. The short
version:

1. Open an issue first for anything non-trivial.
2. Keep the app dependency-free — no build step, no CDN/framework imports.
3. Add a test for any netlist/topology change (`netlist.test.js`).
4. Bump the `?v=N` cache-busting query and `APP_VERSION` when you touch JS/CSS.

Release history lives in [CHANGELOG.md](./CHANGELOG.md).

## License

This repository, including the editor, MCP server, CLI, skills and bundled component
artwork, is released under the [MIT License](./LICENSE).

The symbol artwork in components.js originated from
[Analog Canvas](https://analog-canvas.tokenzhang.com/) by 张托肯, 清华大学.
On 2026-10-23, the project maintainer confirmed permission to release these symbols
with this plugin under MIT. This records the maintainer's confirmation; an original
authorization document is not included in this repository. Preserve the source
attribution and MIT license notice when redistributing.

## 致谢 / Acknowledgements

致谢清华大学张托肯。感谢其提供的 [Analog Canvas](https://analog-canvas.tokenzhang.com/) 电路符号与绘图工作，为本项目提供了重要基础。
