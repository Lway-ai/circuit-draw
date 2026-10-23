#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const { callTool, tools } = require("../server/mcp-server.js");
async function main() {
  const [name, flag, filename] = process.argv.slice(2);
  if (!name || name === "--help") {
    console.log("Usage: node scripts/circuit-cli.js <tool> --args-file <absolute-json-path>\n" + tools.map(t => t.name + ": " + t.description).join("\n"));
    return;
  }
  if (flag !== "--args-file" || !filename) throw new Error("Use --args-file to provide the tool arguments");
  console.log(JSON.stringify(await callTool(name, JSON.parse(fs.readFileSync(filename, "utf8"))), null, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
