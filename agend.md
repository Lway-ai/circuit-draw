# Project notes

- Small Signal controlled sources have only two output pins; display defines the right-side variable. Optional controlPositive/controlNegative bind it to named nets for export (gm negative defaults to S); unset bindings are warned and exported as comments. Original rounded transformer artwork follows inspected ISSCC2010 figures2.4.2/2.4.6, upper dotted P1/S1 polarity, no curved coupling arrow; all four old pin coordinates remain unchanged.

- The interactive schematic editor is loaded from `index.html`; canvas and wire event logic lives in `app.js`.
- Wire creation is driven by completed `click` events: the first press-and-release anchors a live wire, mouseup by itself never commits or cancels it, and a later click on a pin/wire endpoint completes it.
- The toolbar exposes Wire for electrical connections; the Draw/Line annotation tool and its library entry are intentionally unavailable.
- The File menu exports SVG, PNG, JPG, and PDF; JPG uses a white background at 92% quality.
- The Sources category intentionally contains only electrically valid V Src and I Src symbols; polarity marks are not electrical devices or ports.
- The Passives category uses a four-terminal Transformer (`Lp`, `Ls`, `k`) instead of the removed oversized inductor; old `ind_l` project entries load as ordinary inductors.
- The Transformer symbol uses three rounded turns per winding, upper same-polarity dots, k at the top and Lp/Ls below; no iron-core bars or decorative curved arrow.
- Every ordinary HTML load starts empty and retains the recovery copy; File > Restore Recovery Copy restores it explicitly. Unsaved changes warn before closing.
- circuit-core.js shares exact right-angle pin transforms, validated JSON and wire-drag geometry between browser and MCP.
- Plugin entry points are plugin.json, .codex-plugin/plugin.json, mcp.json and .mcp.json; local marketplace name is circuit-tools.
- Drawing and read-only review agents run in order: draft, completed independent review, drawing revision, independent recheck.
- Only VDD is offered as the power symbol; legacy vdd_rail entries load as VDD with the same pin coordinates.
- Ground artwork is wider and shorter: 32px top bar, compact 8px bar spacing, unchanged pin at (0,-20).
- Electrical lead strokes (inside the artwork's scale(2)) follow wireWidth/2 in editor, placement ghosts and all exports. Preserve distinct thicker device-body strokes. Electrical wires use butt caps like the leads to avoid a rounded bump at a connection.
- When browser-side JavaScript changes, increment the `?v=` query in `index.html` to prevent stale cached behavior.
- Public source snapshot target: Lway-ai/circuit-draw. Exclude original Git history, local outputs, backups, scraped artifacts and Visio binaries. MIT artwork permission was confirmed by the maintainer on 2026-10-23; retain Analog Canvas attribution and final README acknowledgements.

- v_noise/i_noise follow Razavi Analog CMOS 2e Ch7 official slides 22/26. Sources has editable labels and two pins; exports are explicit placeholders, not simulator noise models. See docs/noise-symbols.md.
