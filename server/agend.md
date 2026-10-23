# MCP server notes

- Stdio stdout is exclusively JSON-RPC; diagnostic logging belongs on stderr.
- The server loads the same component definitions and netlist code as the browser.
- Tools use absolute paths, validate before writes, and back up overwritten files.
- Review calls must use read_project, list_components and check_project only; rendering goes to a separate output path.
- open_editor serves a snapshot at loopback with a token and an expiry, not an API that overwrites the project.
- SVG export is vector artwork. Netlist checks do not establish circuit function or model availability.
