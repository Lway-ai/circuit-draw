/* ============================================================
 * netlist.test.js — unit tests for netlist.js
 * Run: node netlist.test.js   (Node 18+, no dependencies)
 *
 * netlist.js is an IIFE that closes over the global `App` and
 * `ComponentLib`, so each test builds a fresh sandbox with mocks
 * and executes the real source in it via node:vm.
 * ============================================================ */

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("./circuit-core.js");

const netlistSource = fs.readFileSync(path.join(__dirname, "netlist.js"), "utf8");

// ---- shared fake definitions ----
const DEFS = [
  { id: "res", name: "Res", prefix: "R", pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }] },
  { id: "cap", name: "Cap", prefix: "C", pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }] },
  { id: "ind", name: "Ind", prefix: "L", pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }] },
  { id: "xfmr", name: "Transformer", prefix: "T", pins: [
    { name: "P1", x: -40, y: -40 }, { name: "P2", x: -40, y: 40 },
    { name: "S1", x: 40, y: -40 }, { name: "S2", x: 40, y: 40 },
  ] },
  { id: "nmos", name: "NMOS", prefix: "M",
    pins: [{ name: "G", x: -40, y: 0 }, { name: "D", x: 20, y: -40 }, { name: "S", x: 20, y: 40 }] },
  { id: "diode", name: "Diode", prefix: "D",
    pins: [{ name: "A", x: -40, y: 0 }, { name: "K", x: 40, y: 0 }] },
  { id: "npn", name: "NPN", prefix: "Q",
    pins: [{ name: "B", x: -80, y: 0 }, { name: "C", x: 0, y: -60 }, { name: "E", x: 0, y: 60 }] },
  { id: "opamp", name: "OpAmp", prefix: "X",
    pins: [{ name: "IN+", x: -100, y: 20 }, { name: "IN-", x: -100, y: -20 }, { name: "OUT", x: 80, y: 0 }] },
  { id: "v_src", name: "V Src", prefix: "V",
    pins: [{ name: "+", x: 0, y: -40 }, { name: "-", x: 0, y: 40 }] },
  { id: "gnd", name: "Ground", prefix: "V", isPort: true, pins: [{ name: "1", x: 0, y: -20 }] },
  { id: "vdd", name: "VDD", prefix: "V", isPort: true, pins: [{ name: "1", x: 0, y: 40 }] },
  { id: "pin", name: "Pin", prefix: "P", isPort: true, pins: [{ name: "1", x: 20, y: 0 }] },
  { id: "sw_closed", name: "Closed", prefix: "S",
    pins: [{ name: "1", x: -60, y: 0 }, { name: "2", x: 60, y: 0 }] },
];

// ---- fresh sandbox per test ----
function makeEnv(devices, wires) {
  // real app instances always carry a label (prefix + counter); mirror that
  // so SPICE / instance-table output is deterministic
  const labelCount = {};
  for (const d of devices) {
    if (!d.label) {
      const def = DEFS.find(x => x.id === d.type);
      const p = def ? def.prefix : "X";
      labelCount[p] = (labelCount[p] || 0) + 1;
      d.label = p + labelCount[p];
    }
  }
  const state = { devices, wires };
  const App = {
    state,
    transformPin: Core.transformPin,
    getDevice(id) { return state.devices.find(d => d.id === id) || null; },
  };
  const ComponentLib = { byId(type) { return DEFS.find(d => d.id === type) || null; } };
  const sandbox = { App, ComponentLib, console };
  vm.createContext(sandbox);
  // the IIFE's top-level const is script-scoped, not a sandbox property;
  // grab the script completion value instead
  return vm.runInContext(netlistSource + "\n;Netlist;", sandbox);
}

function wire(points) { return { points }; }

// ============================================================
// Topology: buildNetGraph
// ============================================================

test("two isolated wires become two nets", () => {
  const Netlist = makeEnv([], [
    wire([{ x: 0, y: 0 }, { x: 0, y: 100 }]),
    wire([{ x: 200, y: 0 }, { x: 200, y: 100 }]),
  ]);
  const g = Netlist.buildNetGraph();
  assert.equal(g.netNames.get("0,0"), "net1");
  assert.equal(g.netNames.get("0,100"), "net1");
  assert.equal(g.netNames.get("200,0"), "net2");
  assert.equal(g.netNames.get("200,100"), "net2");
  assert.equal(g.junctions.length, 0);
});

test("T-junction: endpoint landing on another wire's interior is one net + junction dot", () => {
  const Netlist = makeEnv([], [
    wire([{ x: 0, y: 0 }, { x: 0, y: 100 }]),
    wire([{ x: 0, y: 40 }, { x: 40, y: 40 }]),
  ]);
  const g = Netlist.buildNetGraph();
  assert.equal(g.netNames.get("40,40"), g.netNames.get("0,100"));
  assert.equal(JSON.stringify(g.junctions), JSON.stringify([{ x: 0, y: 40 }]));
});

test("pure crossing stays disconnected (no shared POI)", () => {
  const Netlist = makeEnv([], [
    wire([{ x: 0, y: 0 }, { x: 100, y: 0 }]),
    wire([{ x: 50, y: -50 }, { x: 50, y: 50 }]),
  ]);
  const g = Netlist.buildNetGraph();
  assert.notEqual(g.netNames.get("0,0"), g.netNames.get("50,-50"));
  assert.ok(!g.junctions.some(j => j.x === 50 && j.y === 0));
});

test("crossing where one wire ends (vertex) on another wire interior IS connected", () => {
  const Netlist = makeEnv([], [
    wire([{ x: 0, y: 0 }, { x: 100, y: 0 }]),
    wire([{ x: 50, y: 0 }, { x: 50, y: 50 }]),
  ]);
  const g = Netlist.buildNetGraph();
  assert.equal(g.netNames.get("0,0"), g.netNames.get("50,50"));
  assert.equal(JSON.stringify(g.junctions), JSON.stringify([{ x: 50, y: 0 }]));
});

test("device pin on a wire interior splits it; 3-way join gets a dot", () => {
  const Netlist = makeEnv([
    { id: "r1", type: "res", x: 0, y: 40, params: { value: "1k" } },
  ], [
    wire([{ x: 0, y: 0 }, { x: 0, y: 100 }]),
  ]);
  const g = Netlist.buildNetGraph();
  // res pins at (0,0) and (0,80); the latter lies mid-segment on the wire
  assert.equal(g.netNames.get("0,80"), g.netNames.get("0,0"));
  assert.equal(JSON.stringify(g.junctions), JSON.stringify([{ x: 0, y: 80 }]));
});

test("explicit port name wins over auto naming", () => {
  const Netlist = makeEnv([
    { id: "pin_vip", type: "pin", x: -100, y: 40, params: { net: "vinp" } },
    { id: "r1", type: "res", x: 0, y: 40, params: { value: "1k" } },
  ], [
    wire([{ x: 0, y: 0 }, { x: 0, y: 100 }]),
    wire([{ x: -100, y: 40 }, { x: 0, y: 40 }]), // ends at (0,40) on wire 1's interior
  ]);
  const g = Netlist.buildNetGraph();
  // wire 2 links wire 1 through (0,40); pin_vip sits at (-80,40) on wire 2
  assert.equal(g.netNames.get("0,0"), "vinp");
  assert.equal(g.netNames.get("0,80"), "vinp");
  assert.ok(g.junctions.some(j => j.x === 0 && j.y === 40));
  assert.ok(g.junctions.some(j => j.x === -80 && j.y === 40));
});

test("ground port forces the net name 0", () => {
  const Netlist = makeEnv([
    { id: "gnd1", type: "gnd", x: 0, y: 100, params: { net: "gnd" } },
    { id: "r1", type: "res", x: 0, y: 40, params: { value: "1k" } },
  ], [
    wire([{ x: 0, y: 0 }, { x: 0, y: 100 }]),
  ]);
  const g = Netlist.buildNetGraph();
  assert.equal(g.netNames.get("0,0"), "0");
});

test("rotate is applied to pin coordinates before net lookup", () => {
  const Netlist = makeEnv([
    { id: "m1", type: "nmos", x: 0, y: 0, rot: 90, params: { W: "10u", L: "1u" } },
  ], [
    wire([{ x: 40, y: 20 }, { x: 40, y: 60 }]),
  ]);
  const g = Netlist.buildNetGraph();
  // D(20,-40) rotated 90° -> (40,20); the wire starts exactly there
  assert.equal(g.netNames.get("40,20"), g.netNames.get("40,60"));
  assert.equal(Netlist.getPinNets({ id: "m1", type: "nmos", x: 0, y: 0, rot: 90 }, g).D, g.netNames.get("40,20"));
  // G(-40,0) rotated 90° -> (0,-40), not on any wire
  assert.ok(!g.wireRoots.has(g.nodeRoot.get("0,-40")));
});

test("dangling wire ends are reported", () => {
  const Netlist = makeEnv([
    { id: "gnd1", type: "gnd", x: 0, y: 100, params: { net: "gnd" } },
  ], [
    wire([{ x: 0, y: 0 }, { x: 0, y: 100 }]),
    wire([{ x: 300, y: 0 }, { x: 300, y: 100 }]),
  ]);
  const g = Netlist.buildNetGraph();
  const keys = g.danglingEnds.map(p => p.x + "," + p.y);
  assert.ok(keys.includes("0,0"));       // top end of w1 connects nothing
  assert.ok(keys.includes("300,0"));
  assert.ok(keys.includes("300,100"));
  assert.ok(!keys.includes("0,80"));     // gnd pin is on w1
});

// ============================================================
// Pin nets + floating detection
// ============================================================

test("unwired pins still get auto net names (pin-only groups are named too)", () => {
  const Netlist = makeEnv([
    { id: "r1", type: "res", x: 0, y: 40, params: { value: "1k" } },
  ], []);
  const g = Netlist.buildNetGraph();
  const nets = Netlist.getPinNets({ id: "r1", type: "res", x: 0, y: 40, params: { value: "1k" } }, g);
  assert.equal(JSON.stringify(nets), JSON.stringify({ 1: "net1", 2: "net2" }));
});

// ============================================================
// SPICE / Spectre generation
// ============================================================

test("SPICE output formats every device bucket and ends with .end", () => {
  const Netlist = makeEnv([
    { id: "r1", type: "res", x: 0, y: 0, params: { value: "2k" } },
    { id: "m1", type: "nmos", x: 200, y: 0, params: { W: "20u", L: "2u", model: "nch" } },
    { id: "q1", type: "npn", x: -200, y: 0, params: { model: "npn" } },
    { id: "d1", type: "diode", x: 0, y: 200, params: { model: "dio" } },
    { id: "v1", type: "v_src", x: 0, y: -200, params: { type: "dc", value: "1.8V" } },
    { id: "u1", type: "opamp", x: 300, y: 200, params: { model: "opamp" }, label: "U1" },
  ], []);
  const out = Netlist.generateSPICE();
  assert.ok(out.startsWith("* SPICE Netlist: "));
  assert.ok(out.includes("R1 net1 net2 2k\n"));
  assert.ok(out.includes("M1 net4 net3 net5 net5 nch W=20u L=2u\n")); // bulk tied to S
  assert.ok(out.includes("Q1 net7 net6 net8 npn\n"));
  assert.ok(out.includes("D1 net9 net10 dio\n"));
  assert.ok(out.includes("V1 net11 net12 dc 1.8V\n"));
  assert.ok(out.includes("XU1 net13 net14 net15 opamp\n")); // subcircuit prefix applied
  assert.ok(out.endsWith("\n.end\n"));
});

test("Spectre output uses (nets) + keyword style", () => {
  const Netlist = makeEnv([
    { id: "r1", type: "res", x: 0, y: 0, params: { value: "2k" } },
    { id: "m1", type: "nmos", x: 200, y: 0, params: { W: "20u", L: "2u", model: "nch" } },
  ], []);
  const out = Netlist.generateSpectre();
  assert.ok(out.includes("simulator lang=spectre\n"));
  assert.ok(out.includes("R1 (net1 net2) resistor r=2k\n"));
  assert.ok(out.includes("M1 (net4 net3 net5 net5) nch W=20u L=2u\n"));
});

test("transformer expands to two inductors and one coupling element in SPICE", () => {
  const Netlist = makeEnv([
    { id: "t1", type: "xfmr", x: 0, y: 0, label: "T1", params: { Lp: "2n", Ls: "8n", k: "0.95" } },
  ], []);
  const out = Netlist.generateSPICE();
  assert.ok(out.includes("L1P net1 net2 2n\n"));
  assert.ok(out.includes("L1S net3 net4 8n\n"));
  assert.ok(out.includes("K1 L1P L1S 0.95\n"));
});

test("switches emit subcircuit calls instead of invalid native SPICE", () => {
  const Netlist = makeEnv([
    { id: "s1", type: "sw_closed", x: 0, y: 0, label: "S1", params: { value: "closed" } },
  ], []);
  // "S1 net1 net2 closed" is not legal SPICE (the S element needs four nodes
  // plus a model), so the switch must come out as a subcircuit instance.
  assert.ok(Netlist.generateSPICE().includes("XS1 net1 net2 sw_closed\n"));
  assert.ok(Netlist.generateSpectre().includes("S1 (net1 net2) sw_closed\n"));
});

test("transformer expands to Spectre inductors plus mutual_inductor", () => {
  const Netlist = makeEnv([
    { id: "t1", type: "xfmr", x: 0, y: 0, label: "T1", params: { Lp: "2n", Ls: "8n", k: "0.95" } },
  ], []);
  const out = Netlist.generateSpectre();
  assert.ok(out.includes("L1P (net1 net2) inductor l=2n\n"));
  assert.ok(out.includes("L1S (net3 net4) inductor l=8n\n"));
  assert.ok(out.includes("K1 mutual_inductor coupling=0.95 ind1=L1P ind2=L1S\n"));
});

test("instance table lists value/model column", () => {
  const Netlist = makeEnv([
    { id: "r1", type: "res", x: 0, y: 0, params: { value: "2k" } },
    { id: "m1", type: "nmos", x: 200, y: 0, params: { W: "20u", L: "2u", model: "nch" } },
  ], []);
  const out = Netlist.instanceTable();
  assert.ok(out.includes("R1\tRes\t2k\t"));
  assert.ok(out.includes("M1\tNMOS\t20u/2u\t"));
});

// ============================================================
// Check report
// ============================================================

test("check report PASSes when every pin is wired and power ports exist", () => {
  const Netlist = makeEnv([
    { id: "vdd1", type: "vdd", x: -100, y: 0, params: { net: "vdd" } },
    { id: "r1", type: "res", x: 0, y: 40, params: { value: "1k" } },
    { id: "gnd1", type: "gnd", x: 0, y: 100, params: { net: "gnd" } },
  ], [
    wire([{ x: -100, y: 40 }, { x: 0, y: 80 }]), // vdd rail pin -> gnd/res pin point
    wire([{ x: 0, y: 80 }, { x: 0, y: 0 }]),     // down to res pin 1
  ]);
  const out = Netlist.checkReport();
  assert.ok(out.includes("Status: PASS"), out);
  assert.ok(out.includes("PASS — 0 warning"));
});

test("check report WARNs on floating pins and missing power", () => {
  const Netlist = makeEnv([
    { id: "r1", type: "res", x: 0, y: 40, params: { value: "1k" } },
  ], []);
  const out = Netlist.checkReport();
  assert.ok(out.includes("Status: WARNINGS"), out);
  assert.ok(out.includes("Floating pins: 2"));
  assert.ok(out.includes("No VDD port found."));
  assert.ok(out.includes("No Ground port found."));
});
