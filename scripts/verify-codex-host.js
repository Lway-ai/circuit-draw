"use strict";
// Run with an absolute Codex executable path. No model call or chat is created.
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");
const executable = process.argv[2];
if (!executable || !path.isAbsolute(executable)) throw new Error("Pass an absolute Codex executable path");
const child = spawn(executable, ["app-server", "--stdio"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
const output = path.resolve("output/plugin-validation/codex-host.json");
let done = false;
const send = v => child.stdin.write(JSON.stringify(v) + "\n");
const timer = setTimeout(() => finish(new Error("Codex MCP discovery timeout")), 45000);
function finish(error, proof) {
  if (done) return;
  done = true; clearTimeout(timer);
  if (error) { console.error(error.message); process.exitCode = 1; }
  else { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(proof,null,2)); console.log(JSON.stringify(proof,null,2)); }
  child.stdin.end();
  const stop = setTimeout(() => child.kill(), 3000); stop.unref();
}
child.stderr.on("data", () => {}); // Do not expose unrelated server logs or config.
child.on("error", finish);
readline.createInterface({ input: child.stdout }).on("line", line => {
  let response; try { response = JSON.parse(line); } catch { return; }
  if (response.id === 1) {
    if (response.error) return finish(new Error(response.error.message));
    send({ method: "initialized" });
    send({ id: 2, method: "mcpServerStatus/list", params: { limit: 100 } });
  } else if (response.id === 2) {
    if (response.error) return finish(new Error(response.error.message));
    const server = response.result.data.find(s => s.name === "circuit_draw");
    if (!server && response.result.nextCursor) return send({ id: 2, method: "mcpServerStatus/list", params: { limit: 100, cursor: response.result.nextCursor } });
    if (!server) return finish(new Error("Circuit Draw not discovered by Codex"));
    const names = Object.keys(server.tools || {});
    if (names.length !== 9) return finish(new Error("Expected nine callable MCP tools, got " + names.length));
    finish(null, { server: server.name, serverInfo: server.serverInfo, tools: names, discoveredByCodex: true, modelCallMade: false });
  }
});
send({ id: 1, method: "initialize", params: { clientInfo: { name: "circuit_draw_validation", version: "0.1.0" }, capabilities: { experimentalApi: true } } });
