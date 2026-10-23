#!/usr/bin/env node
"use strict";
const readline = require("node:readline");
const { spawn } = require("node:child_process");
const path = require("node:path");
const R = require("./runtime.js");
const str = { type: "string" };
const absPath = { type: "string", description: "Absolute local filesystem path" };
const point = { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false };
const pin = { type: "object", properties: { device: { type: "string", description: "Device id or unique instance label" }, pin: str }, required: ["device", "pin"], additionalProperties: false };
const tool = (name, description, properties, required, readOnly = false) => ({ name, description,
  inputSchema: { type: "object", properties, required, additionalProperties: false },
  annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false } });
const tools = [
  tool("list_components", "List available circuit symbols with exact pins, defaults and coordinates. Query before choosing or wiring a symbol.", { query: str }, [], true),
  tool("create_project", "Create an editable JSON project; optionally start from the 5-transistor OTA template. Existing files require explicit overwrite=true and are backed up.", { path: absPath, name: str, template: { type: "string", enum: ["ota5"] }, overwrite: { type: "boolean", default: false } }, ["path"]),
  tool("read_project", "Read and validate an editable circuit project. Returns devices, wires, labels and style for drawing or read-only review.", { path: absPath }, ["path"], true),
  tool("write_project", "Validate and save an entire editable project atomically. For revisions use a new file path, preserving the reviewed draft. Existing targets require overwrite=true and are backed up.", { path: absPath, project: { type: "object", description: "Project: name; devices [{id,type,x,y,rot,mirrorX,mirrorY,label,params,labelOff}]; wires [{id,points:[{x,y}]}]; texts [{id,x,y,text,fontSize}]; annotations [{id,type,x1,y1,x2,y2}]. Missing ids/default params are filled." }, overwrite: { type: "boolean", default: false } }, ["path", "project"]),
  tool("connect_pins", "Connect two named device pins with orthogonal wiring, optionally through waypoint coordinates. Updates the project with a backup.", { path: absPath, from: pin, to: pin, waypoints: { type: "array", items: point } }, ["path", "from", "to"]),
  tool("move_device", "Move a device while preserving wires attached to its original pins, including T-junctions. Updates the project with a backup.", { path: absPath, device: str, x: { type: "number" }, y: { type: "number" } }, ["path", "device", "x", "y"]),
  tool("check_project", "Read-only topology review: floating pins, dangling wires, power ports and instance table. This does not validate circuit function or simulate the circuit.", { path: absPath }, ["path"], true),
  tool("export_project", "Export SVG artwork, SPICE, Spectre or normalized JSON. SVG uses the same symbols as the editor. Netlists require external model/subcircuit definitions for simulation.", { path: absPath, format: { type: "string", enum: ["svg", "spice", "spectre", "json"] }, output: absPath, overwrite: { type: "boolean", default: false } }, ["path", "format", "output"]),
  tool("open_editor", "Start the local browser editor with a project loaded. Returns a URL for open_in_codex. Browser Save Project downloads JSON; it does not write back to the source file. Server expires after 30 minutes.", { path: absPath }, ["path"]),
];

function validate(name, args) {
  const spec = tools.find(t => t.name === name);
  if (!spec) throw new Error("Unknown tool: " + name);
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("arguments must be an object");
  for (const key of spec.inputSchema.required) if (args[key] === undefined) throw new Error("Missing argument: " + key);
  for (const [key, value] of Object.entries(args)) {
    const field = spec.inputSchema.properties[key];
    if (!field) throw new Error("Unknown argument: " + key);
    const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    if (kind !== field.type || field.enum && !field.enum.includes(value)) throw new Error("Invalid argument: " + key);
    if (kind === "number" && !Number.isFinite(value)) throw new Error("Invalid number: " + key);
  }
}

async function callTool(name, a) {
  validate(name, a);
  if (name === "list_components") return R.library.all().filter(d => !d.tool && (!a.query || (d.id + " " + d.name + " " + d.category).toLowerCase().includes(a.query.toLowerCase())))
    .map(d => ({ id: d.id, name: d.name, category: d.category, prefix: d.prefix, pins: d.pins, defaultParams: d.defaultParams, isPort: !!d.isPort }));
  if (name === "create_project") return R.save(a.path, R.create(a.name, a.template), a.overwrite);
  if (name === "write_project") return R.save(a.path, a.project, a.overwrite);
  if (name === "read_project") return R.load(a.path);
  if (name === "connect_pins") {
    const p = R.load(a.path), start = R.pin(p, a.from), end = R.pin(p, a.to);
    const points = [start];
    for (const next of [...(a.waypoints || []), end]) {
      if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) throw new Error("Invalid waypoint");
      const last = points[points.length - 1];
      if (last.x !== next.x && last.y !== next.y) points.push({ x: next.x, y: last.y });
      if (R.Core.pointKey(points[points.length - 1]) !== R.Core.pointKey(next)) points.push(next);
    }
    if (points.length < 2) throw new Error("Pins already coincide; no wire needed");
    p.wires.push({ id: "wire_" + p.nextId++, points });
    return R.save(a.path, p, true);
  }
  if (name === "move_device") {
    const p = R.load(a.path), d = R.device(p, a.device);
    const pinPositions = R.library.getPins(d.type).map(pin => R.Core.transformPin(pin, d));
    const anchors = new Set(pinPositions.map(R.Core.pointKey));
    const dx = a.x - d.x, dy = a.y - d.y;
    for (const w of p.wires) {
      // Split T-junctions before applying the same geometry rule as the editor.
      const pts = [];
      for (let i = 0; i < w.points.length - 1; i++) {
        const u = w.points[i], v = w.points[i + 1];
        pts.push(u);
        const interior = pinPositions.filter(t => u.y === v.y ? t.y === u.y && t.x > Math.min(u.x,v.x) && t.x < Math.max(u.x,v.x)
          : u.x === v.x && t.x === u.x && t.y > Math.min(u.y,v.y) && t.y < Math.max(u.y,v.y));
        interior.sort((a,b) => ((a.x-u.x)*(v.x-u.x)+(a.y-u.y)*(v.y-u.y))-((b.x-u.x)*(v.x-u.x)+(b.y-u.y)*(v.y-u.y)));
        pts.push(...interior);
      }
      pts.push(w.points[w.points.length - 1]);
      w.points = R.Core.moveAnchoredPoints(pts, anchors, dx, dy);
    }
    d.x = a.x; d.y = a.y;
    return R.save(a.path, p, true);
  }
  if (name === "check_project") {
    const n = R.netlist(R.load(a.path));
    return { report: n.checkReport(), instances: n.instanceTable(), simulationRun: false };
  }
  if (name === "export_project") {
    if (path.resolve(a.path) === path.resolve(a.output)) throw new Error("Export output must differ from project source");
    const p = R.load(a.path), n = R.netlist(p);
    const content = a.format === "svg" ? R.renderSVG(p) : a.format === "spice" ? n.generateSPICE()
      : a.format === "spectre" ? n.generateSpectre() : JSON.stringify(p, null, 2) + "\n";
    return R.writeOutput(a.output, content, a.overwrite);
  }
  if (name === "open_editor") {
    R.load(a.path);
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname, "editor-server.js"), a.path], { detached: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let output = "", errors = "", settled = false;
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
      const timer = setTimeout(() => { child.kill(); finish(new Error("Editor startup timeout")); }, 10000);
      child.stdout.on("data", chunk => {
        output += chunk;
        if (output.includes("\n")) {
          try { const result = JSON.parse(output.trim()); child.stdout.destroy(); child.stderr.destroy(); child.unref(); finish(null, result); }
          catch (e) { child.kill(); finish(e); }
        }
      });
      child.stderr.on("data", chunk => { errors += chunk; });
      child.on("error", e => finish(e));
      child.on("exit", code => { if (!settled) finish(new Error("Editor failed: " + code + " " + errors)); });
    });
  }
}

function result(value) { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], isError: false }; }
async function handle(request) {
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") return { jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
  if (request.id === undefined) return null;
  let response;
  if (request.method === "initialize") response = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "circuit-draw", version: "0.1.4" } };
  else if (request.method === "ping") response = {};
  else if (request.method === "tools/list") response = { tools };
  else if (request.method === "tools/call") {
    try { response = result(await callTool(request.params?.name, request.params?.arguments || {})); }
    catch (e) { response = { content: [{ type: "text", text: e.message }], isError: true }; }
  } else return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } };
  return { jsonrpc: "2.0", id: request.id, result: response };
}
if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  // Ordered calls make read-after-write deterministic even for eager clients.
  let queue = Promise.resolve();
  rl.on("line", line => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
      let response;
      try { response = await handle(JSON.parse(line)); }
      catch (e) { response = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }; }
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    });
  });
}
module.exports = { tools, callTool, handle };
