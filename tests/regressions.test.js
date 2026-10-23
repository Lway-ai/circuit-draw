"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const R = require("../server/runtime.js");
const { callTool } = require("../server/mcp-server.js");
const C = R.Core;
const work = () => fs.mkdtempSync(path.join(os.tmpdir(), "circuit-draw-test-"));

test("variable-defined controlled sources have only output terminals and export named control nodes", () => {
  for (const type of ["gm", "vccs", "vcvs"]) {
    const def = R.library.byId(type);
    assert.equal(def.pins.length, 2);
    assert.ok(def.pins.every(pin=>pin.x===0));
    const devices = [{ id: "source", type, x: 0, y: 0, label: type === "vcvs" ? "E1" : "G1", params: { controlPositive: "vin", controlNegative: "node1" } }];
    const wires = [];
    for (const [i, pin] of def.pins.entries()) {
      const x = pin.x - 160;
      devices.push({ id: "port" + i, type: "pin", x: x - 20, y: pin.y, params: { net: "node" + i } });
      wires.push({ points: [{ x: pin.x, y: pin.y }, { x, y: pin.y }] });
    }
    const p = R.normalize({ devices, wires }), n = R.netlist(p);
    const expected = "node0 node1 vin node1";
    const label = type === "vcvs" ? "E1" : "G1";
    assert.ok(n.generateSPICE().includes(`${label} ${expected} ${type === "vcvs" ? "10" : "1m"}`));
    assert.ok(n.generateSpectre().includes(`${label} (${expected}) ${type === "vcvs" ? "vcvs gain=10" : "vccs gm=1m"}`));
  }
});

test("unbound symbolic sources warn instead of exporting undefined control pins", () => {
  const p=R.normalize({devices:[{type:"gm",x:0,y:0}]});
  const n=R.netlist(p);
  assert.ok(n.generateSPICE().includes('set controlPositive/controlNegative'));
  assert.ok(n.checkReport().includes('control variable has no valid node binding'));
  assert.ok(!n.generateSPICE().includes('undefined'));
});

test("transformer redraw retains all electrical terminals and positive dot polarity", () => {
  assert.equal(JSON.stringify(R.library.byId('xfmr').pins),JSON.stringify([{name:'P1',x:-40,y:-40},{name:'P2',x:-40,y:40},{name:'S1',x:40,y:-40},{name:'S2',x:40,y:40}]));
  const svg=R.renderSVG({devices:[{type:'xfmr',x:0,y:0}]});
  assert.ok(svg.includes('cx="-9" cy="-17"'));
  assert.ok(svg.includes('cx="9" cy="-17"'));
  assert.ok(!svg.includes('C -10 -30 10 -30'));
});

test("small-signal passive presets export native R/C elements and editable notation", () => {
  const p = R.normalize({ devices: ["ro", "rpi", "cgs", "cgd"].map((type,i)=>({type,x:i*200,y:0})) });
  const n = R.netlist(p), spice=n.generateSPICE(), spectre=n.generateSpectre();
  for (const d of p.devices) {
    assert.ok(spice.includes(`${d.label} `));
    assert.ok(spice.includes(d.params.value));
    assert.ok(spectre.includes(d.type.startsWith("c") ? `capacitor c=${d.params.value}` : `resistor r=${d.params.value}`));
    assert.ok(R.renderSVG(p).includes('baseline-shift="sub"'));
    assert.equal(R.library.labelParts(d.params.display).map(part=>part.text).join(""),d.params.display.replace(/_/g,""));
  }
});

test("every electrical symbol exports leads matching Normal and Bold wire widths", () => {
  for (const def of R.library.all().filter(d => !d.tool)) {
    for (const width of [3.2, 4.8]) {
      const svg = R.renderSVG({ devices: [{ type: def.id, x: 0, y: 0 }],
        wires: [{ points: [{x: -160, y: 0}, {x: -120, y: 0}] }], style: { wireWidth: width } });
      const leads = [...svg.matchAll(/<[^>]+stroke-width="([^"]+)" data-connection-lead="2"[^>]*>/g)];
      assert.ok(leads.length > 0, def.id + " has scalable electrical leads");
      for (const match of leads) {
        assert.equal(Number(match[1]) * 2, width, def.id + " world lead width");
        assert.ok(match[0].includes('stroke-linecap="butt"'), def.id + " flat lead cap");
      }
      assert.ok(svg.includes(`stroke-width:${width};stroke-linecap:butt`));
    }
  }
});

test("only VDD is offered; old VDD Rail projects retain exact pin connectivity", () => {
  assert.equal(R.library.all().filter(d => d.id === "vdd_rail").length, 0);
  const p = R.normalize({ devices: [{ type: "vdd_rail", x: 0, y: 0, label: "VDD" }], wires: [{ points: [{ x: 0, y: 40 }, { x: 0, y: 100 }] }] });
  assert.equal(p.devices[0].type, "vdd");
  const n = R.netlist(p), g = n.buildNetGraph();
  assert.equal(n.getPinNets(p.devices[0], g)["1"], "vdd");
  assert.ok(!R.create("OTA", "ota5").devices.some(d => d.type === "vdd_rail"));
});

test("right-angle transforms stay exact through rotations and mirrors", () => {
  for (const rot of [0, 90, 180, 270, 360, -90]) {
    for (const mirrorX of [false, true]) {
      const q = C.transformPin({ x: 20, y: -40, name: "D" }, { x: 100, y: 80, rot, mirrorX });
      assert.equal(q.x % 20, 0); assert.equal(q.y % 20, 0);
    }
  }
});
test("a rotated NMOS drain is actually on the integer-coordinate wire net", () => {
  const p = R.normalize({ devices: [{ type: "nmos", x: 0, y: 0, rot: 90, label: "M1" }], wires: [{ points: [{ x: 40, y: 20 }, { x: 40, y: 60 }] }] });
  const n = R.netlist(p), g = n.buildNetGraph();
  assert.equal(n.getPinNets(p.devices[0], g).D, g.netNames.get("40,20"));
  assert.ok(g.wireRoots.has(g.nodeRoot.get("40,20")));
});
test("sticky wire follows multiple drag frames and returns to the origin", () => {
  const original = [{ x: 0, y: 0 }, { x: 100, y: 0 }], anchors = new Set(["0,0"]);
  for (const [dx, dy] of [[20, 20], [60, 40], [0, 0]]) {
    const points = C.moveAnchoredPoints(original, anchors, dx, dy);
    assert.deepEqual(points[0], { x: dx, y: dy });
    assert.deepEqual(points.at(-1), { x: 100, y: 0 });
    for (let i = 1; i < points.length; i++) assert.ok(points[i-1].x === points[i].x || points[i-1].y === points[i].y);
  }
});
test("moving both endpoints translates their segment without changing topology", () => {
  const points = C.moveAnchoredPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }], new Set(["0,0", "100,0"]), 20, 40);
  assert.deepEqual(points, [{ x: 20, y: 40 }, { x: 120, y: 40 }]);
});
test("invalid project imports fail before files are overwritten", async () => {
  const folder = work(), file = path.join(folder, "original.json");
  R.save(file, R.create("Original", "ota5"));
  const before = fs.readFileSync(file, "utf8");
  await assert.rejects(callTool("write_project", { path: file, overwrite: true, project: { devices: [{ type: "unknown", x: 0, y: 0 }] } }), /unknown electrical component/);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});
test("normalization repairs missing defaults and regenerates counters from actual labels", () => {
  const p = R.normalize({ devices: [{ id: "dev_90", type: "pmos", x: 0, y: 0, label: "M23" }], nextId: 1, labelCounters: { M: 1 } });
  assert.equal(p.devices[0].params.model, "pch");
  assert.equal(p.labelCounters.M, 23);
  assert.ok(p.nextId > 90);
});
test("duplicate ids, arbitrary param markup and nonfinite coordinates are rejected", () => {
  assert.throws(() => R.normalize({ devices: [{ id: "dev_1", type: "res", x: 0, y: 0 }, { id: "dev_1", type: "cap", x: 20, y: 0 }] }), /duplicate/);
  assert.throws(() => R.normalize({ devices: [{ type: "res", x: 0, y: 0, params: { '<img onerror="x">': "x" } }] }), /unknown parameter/);
  assert.throws(() => R.normalize({ devices: [{ type: "res", x: NaN, y: 0 }] }), /finite number/);
});
test("MCP create, inspect, connect, move and export preserve the source with backups", async () => {
  const folder = work(), file = path.join(folder, "circuit.json");
  await callTool("write_project", { path: file, project: { name: "Test", devices: [{ type: "res", x: 0, y: 0, label: "R1" }, { type: "res", x: 100, y: 100, label: "R2" }] } });
  await callTool("connect_pins", { path: file, from: { device: "R1", pin: "2" }, to: { device: "R2", pin: "1" } });
  const moved = await callTool("move_device", { path: file, device: "R1", x: 40, y: 20 });
  assert.ok(fs.existsSync(moved.backup));
  const p = await callTool("read_project", { path: file }), n = R.netlist(p), g = n.buildNetGraph();
  assert.equal(n.getPinNets(p.devices[0], g)["2"], n.getPinNets(p.devices[1], g)["1"]);
  const review = await callTool("check_project", { path: file });
  assert.equal(review.simulationRun, false);
  const out = path.join(folder, "drawing.svg");
  await callTool("export_project", { path: file, format: "svg", output: out });
  assert.ok(fs.readFileSync(out, "utf8").includes("<svg"));
  await assert.rejects(callTool("export_project", { path: file, format: "json", output: file, overwrite: true }), /must differ/);
});
test("headless SVG includes far-away labels, long text and the full circular annotation", () => {
  const p = R.normalize({ name: "<&", devices: [{ type: "nmos", x: 0, y: 0, label: "M1", labelOff: { x: 1000, y: -500 } }],
    texts: [{ x: -1000, y: 800, text: "Long 中文 label with < & >", fontSize: 38 }], annotations: [{ type: "circle", x1: 0, y1: 0, x2: 400, y2: 20 }] });
  const svg = R.renderSVG(p);
  assert.ok(svg.includes("&lt;&amp;"));
  assert.ok(!svg.includes("Long 中文 label with <"));
  const [x,y,w,h] = /viewBox="([^"]+)"/.exec(svg)[1].split(" ").map(Number);
  assert.ok(x <= -1000 && y <= -500 && x+w > 1000 && y+h > 800);
});
test("MCP stdio negotiates and calls a real tool without stdout pollution", async () => {
  const child = spawn(process.execPath, [path.join(R.root, "server", "mcp-server.js")], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", c => stdout += c); child.stderr.on("data", c => stderr += c);
  const done = new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", resolve); });
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_components", arguments: { query: "NMOS" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "read_project", arguments: { path: "relative.json" } } }
  ];
  child.stdin.end(messages.map(x => JSON.stringify(x)).join("\n") + "\n");
  assert.equal(await done, 0);
  const responses = stdout.trim().split("\n").map(x => JSON.parse(x));
  assert.equal(responses.length, 4);
  assert.equal(responses[0].result.serverInfo.name, "circuit-draw");
  assert.equal(responses[1].result.tools.length, 9);
  assert.equal(responses[2].result.isError, false);
  assert.equal(responses[3].result.isError, true);
  assert.equal(stderr, "");
});
test("editor serves the requested snapshot and refuses unrelated project file access", async () => {
  const folder = work(), file = path.join(folder, "demo.json");
  R.save(file, R.create("Editor test", "ota5"));
  const { url, pid } = await callTool("open_editor", { path: file });
  try {
    const u = new URL(url);
    const response = await fetch(u.origin + "/project.json?token=" + u.searchParams.get("project"));
    assert.equal((await response.json()).name, "Editor test");
    assert.equal((await fetch(u.origin + "/project.json")).status, 403);
    assert.equal((await fetch(u.origin + "/.git/config")).status, 404);
    assert.equal((await fetch(url)).status, 200);
  } finally { process.kill(pid); }
});
