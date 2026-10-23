# Script notes

- circuit-cli.js is a fallback adapter to the exact MCP tools, not a separate engine.
- Use --args-file for structured multiline input; do not interpolate JSON into shell commands.
- Tests are meaningful topology/geometry, file-preservation and stdio protocol checks.
