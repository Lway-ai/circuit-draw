# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.6] — 2026-10-23

- Add V Noise / I Noise symbols following Razavi Analog CMOS 2e Chapter 7 official slides 22/26, with editable subscript labels and two connectable pins.
- Export explicit SPICE/Spectre placeholder comments and model warnings for noise symbols; no random waveform or simulator noise model is implied.
- Include source-reference documentation in plugin packages. Plugin version 0.1.5, browser build v32.

## Open-source packaging — 2026-10-23

- Publish the editor, plugin manifests, MCP server, CLI, tests and skill as a clean source snapshot.
- Release the bundled symbols under MIT based on the maintainer's confirmation of permission.
- Credit 张托肯 of 清华大学 and Analog Canvas in the final README section.
- Add Windows/Linux CI and portable test file arguments; include the ZCode manifest in packages.

## [1.1.5] — 2026-10-14

- Remove graphical control terminals from gm/VCCS/VCVS; define control variables by right-side display notation, with optional named-node binding for export and explicit warnings when unbound.
- Redraw transformer with clean rounded windings, polarity dots and k/Lp/Ls notation, referencing inspected ISSCC 2010/2013 figures; retain its existing terminals and export topology. Plugin version 0.1.4.

## [1.1.4] — 2026-10-14

- Add Small Signal library with three-terminal gm·vgs, four-terminal VCCS/VCVS, ro/rpi and Cgs/Cgd presets, editable notation, and native SPICE/Spectre exports. Plugin version 0.1.3.

## [1.1.3] — 2026-10-14

- Match device electrical lead widths to Normal/Bold wires in editor, placement, restored projects and MCP SVG exports; use matching butt caps at connections.
- Persist wire width changes in history and recovery; update Circuit Draw plugin to 0.1.2.

## [1.1.2] — 2026-10-14

- Emit switches as subcircuit calls (`XS1 n1 n2 sw_closed`) in SPICE and Spectre; the previous SPICE form was syntactically invalid and Spectre silently dropped the element.
- Fix inverted label dragging on mirrored devices (the label counter-transform already cancels the mirror, so offsets are world-space).
- Hit testing and marquee selection now cover full rendered artwork, not just pin bounding boxes (op-amp triangles, v_amp, gate bodies were partly unclickable).
- Text hit area scales with font size and text length instead of a fixed 40×14 box.
- Refresh junction dots immediately when a device is placed (click or drag-drop) onto an existing wire.
- Duplicate keeps the source label offset; annotations show type and Delete in the properties panel.
- Headless SVG export uses the same junction dot radius (7.56) as the editor.

## [1.1.1] — 2026-10-14

- Widen and shorten the Ground symbol while keeping its connection pin unchanged; update Circuit Draw plugin to 0.1.1.

## [1.1.0] — 2026-10-14

- Use exact right-angle pin transforms to avoid visually connected but electrically split nets.
- Preserve attached wire endpoints through every drag frame, retaining orthogonal routing.
- Validate entire project imports before replacing the canvas; fill defaults and repair id/counter state.
- Retain recovery copies across page loads and add explicit restoration and unsaved-close warnings.
- Measure actual SVG artwork/labels/circles when exporting; respect hidden grids.
- Remove VDD Rail from the library and use VDD in new templates; migrate old projects.
- Add local Codex plugin manifests, source-only packaging, nine stdio MCP tools and a drawing/review two-agent skill.
- Add geometry, file-preservation, legacy migration, MCP and local-editor regression tests.

## [1.0.0] — 2026-08-29

First public release.

### Added

- **Analog/RF schematic editor** — place and wire transistors, resistors, capacitors,
  inductors, op-amps, diodes, voltage sources, and supply/ground ports on a grid canvas.
- **Click-driven wiring** — click the start point, release the button (the stroke stays
  armed), then click the endpoint to finish. Click empty space to add corners. T-junctions and
  device pins landing on a wire interior are recognised as real connections, while plain
  crossings stay disconnected.
- **Export** — `SVG`, `PNG`, `JPG`, `PDF` (vector, via a print window), plus runnable **SPICE** and
  **Spectre** netlists with correct pin ordering and subcircuit prefixes.
- **Component library** — a broad set of analog symbol primitives plus templates, including a
  5-transistor OTA.
- **Design-rule check** — flags floating pins, dangling wires, and missing supply/ground ports
  before export.
- **Keyboard-first interaction** — insert (`I`), wire (`W`), text (`T`), annotations,
  rotate (`R`), mirror (`Shift+R` / `Ctrl+R`), undo/redo (`Ctrl+Z`), autosave.
- **Test suite** — `npm test` runs the netlist/topology tests.
- **Dev server** — `python serve.py` (or `npm start`), with no-cache headers and a clear error
  when the port is already in use.
- **Build stamp** — the status bar shows the running build version, so a stale cached tab is
  obvious at a glance.

### Known issues

- At the time of version 1.0.0, permission for the third-party symbol artwork had not
  been confirmed. The maintainer confirmed permission for MIT distribution on 2026-10-23;
  see the current [README.md](./README.md) for provenance and attribution.
