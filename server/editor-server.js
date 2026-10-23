"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const R = require("./runtime.js");
const project = R.load(process.argv[2]);
const token = crypto.randomBytes(18).toString("hex");
const allowed = new Set(["index.html", "style.css", "circuit-core.js", "components.js", "templates.js", "netlist.js", "exporter.js", "app.js"]);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" || req.headers.origin && req.headers.origin !== `http://127.0.0.1:${server.address().port}`) { res.writeHead(403).end(); return; }
  if (url.pathname === "/project.json") {
    if (url.searchParams.get("token") !== token) { res.writeHead(403).end(); return; }
    res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(project)); return;
  }
  const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (!allowed.has(name)) { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", mime[path.extname(name)]);
  res.end(fs.readFileSync(path.join(R.root, name)));
});
server.listen(0, "127.0.0.1", () => {
  process.stdout.write(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}/index.html?project=${token}`, pid: process.pid, expiresInMinutes: 30 }) + "\n");
});
setTimeout(() => server.close(() => process.exit(0)), 30 * 60 * 1000).unref();
