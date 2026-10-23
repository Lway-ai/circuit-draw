"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const target = path.join(root, "output", "plugin", "circuit-draw");
const files = ["plugin.json", "mcp.json", ".mcp.json", ".codex-plugin/plugin.json", "index.html", "style.css", "circuit-core.js", "app.js", "components.js", "templates.js", "netlist.js", "exporter.js", "README.md", "CONTRIBUTING.md", "CHANGELOG.md", "LICENSE", "package.json", "netlist.test.js", "serve.py", "start-dev.bat", "agend.md"];
function includeTree(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) includeTree(relative); else files.push(relative);
  }
}
files.push(".zcode-plugin/plugin.json");
for (const dir of ["server", "skills", "scripts", "tests"]) includeTree(dir);
for (const file of files) {
  const dest = path.join(target, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, file), dest);
}
console.log(JSON.stringify({ path: target, files: files.length, excludes: [".git", ".workbuddy", "*.vss", "output artifacts", "source scrape artifacts"] }, null, 2));
