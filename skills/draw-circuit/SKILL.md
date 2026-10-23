---
name: draw-circuit
description: Draw, edit or review editable analog and RF circuit schematics with the local Circuit Draw editor, SVG artwork and SPICE/Spectre netlists. Use two subagents so independent review precedes any revision of the first draft.
---

# Circuit Draw

Use two real subagents: a drawing agent and a read-only review agent. The coordinator owns user requirements, resolves conflicting findings and delivers the final files. Keep these roles throughout the task; reuse the drawing agent for revisions and the review agent for rechecks.

## Workflow

1. Establish the intended topology, ports, device labels, important values and output folder from the request. Inspect any supplied circuit before choosing a template. Preserve originals when editing an existing project.
2. Spawn the drawing subagent using [drawing-agent.md](agents/drawing-agent.md). Pass the actual requirements, source paths and a distinct draft output path. It writes editable JSON plus SVG and returns a topology report. **It stops after the first complete draft, before changing it in response to its own review.**
3. After the draft exists, spawn the review subagent using [review-agent.md](agents/review-agent.md). Pass requirements and the exact draft JSON/SVG. The reviewer reads the topology and inspects a rendered screenshot of that SVG or the editor. It writes a review report, never changes project/source files, and returns actionable findings.
4. Only after that review completes, send findings to the drawing agent. It writes a new revision with a change log; retain the reviewed draft. A clean review needs no artificial edits. For remaining findings, repeat drawing/review on new revision paths, up to three repair rounds; unresolved blockers remain explicitly blocked.
5. The review agent rechecks the final JSON, topology report and rendered artwork. Deliver the final editable JSON, SVG, review report and revision log. Identify any unresolved findings. Do not describe topology checks as a simulation or validation of electrical performance.

Use the host's collaboration tools (`spawn_agent`, `followup_task`, `wait_agent`) for actual subagents. Wait for each stage before dispatching the dependent stage. If the host lacks subagents, disclose that limitation and run the same roles sequentially; never claim two agents ran.

## Local tools and formats

- `list_components` returns exact pin names/coordinates and default params; use them rather than inventing symbols or anchors.
- `create_project`, `read_project`, `write_project` use absolute JSON paths. `template: "ota5"` is the built-in five-transistor OTA.
- `connect_pins` accepts `{device: id_or_unique_label, pin: exact_name}` and optional world-coordinate waypoints; electrical wires are independent from annotation lines.
- `move_device` preserves attached wires. `check_project` is read-only topology and instance review.
- `export_project` exports `svg`, `spice`, `spectre` or `json`. Give every reviewed draft and revision a separate output filename.
- `open_editor` returns a loopback URL. Show it with `open_in_codex` if available. The editor saves JSON by download; it does not overwrite the loaded source automatically. Use browser export for PNG/JPG/PDF.
- If MCP is not loaded yet, the same tools are available through `node <plugin-root>/scripts/circuit-cli.js <tool> --args-file <absolute-args.json>`; no packages or API keys are needed. Find plugin root two levels above this skill folder.

For visual review, open the exported SVG or editor in an available browser and capture/view a screenshot. Do not mark visual review passed by reading SVG strings alone. Orthogonal wires, correct junction dots, legible upright labels, visible polarity and unclipped content are required.

The plugin and component artwork are MIT licensed; preserve the attribution to 张托肯 of 清华大学 and Analog Canvas recorded in the root README. Netlists need user-provided model/subcircuit definitions for simulation; VDD labels alone are not voltage sources. Three-terminal MOS symbols imply bulk tied to source in the exported netlists.

Use the VDD symbol for all supply markers. VDD Rail is removed from the selectable library; legacy `vdd_rail` entries migrate to VDD with unchanged pin coordinates.

## Small-signal equivalents

The Small Signal category offers `gm`, `vccs`, `vcvs`, `ro`, `rpi`, `cgs`, and `cgd`. Controlled sources have only two output terminals (gm: D,S; VCCS/VCVS: out+,out-). Never add left-side control wires. The right-hand display notation defines the controlling variable, e.g. `g_m v_gs` or `g_mb v_bs`. Current flows D to S or out+ to out-; VCVS voltage follows its internal polarity marks. If netlist export is required, bind the displayed voltage variable to named schematic nets with controlPositive/controlNegative parameters; gm defaults controlNegative to S. An unbound variable intentionally emits a placeholder comment and check warning. Preserve existing reviewed originals when removing legacy control wires from a migrated project.

`gm`/`gain`/`value` are electrical numbers for netlist export; `display` is an editable drawing label such as `g_m v_gs`, `g_mb v_bs`, or `r_o`. Symbolic numeric parameters require matching simulator parameter definitions; no DC operating-point extraction or simulation is implied. Passive presets behave as ordinary resistors/capacitors. Transformers use rounded coil turns, upper polarity dots and k/Lp/Ls labels inspired by ISSCC 2010 figs.2.4.2/2.4.6; their four pins are unchanged.
