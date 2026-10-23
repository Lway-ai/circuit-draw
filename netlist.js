/* ============================================================
 * netlist.js — SPICE / Spectre netlist generation
 * Topology: wires are split at "points of interest" (wire
 * vertices + device pins) lying strictly inside a segment, so
 * T-junctions and pins landing on a wire interior are real
 * electrical connections. Pure crossings (no endpoint/pin at
 * the intersection) stay disconnected, per schematic convention.
 * ============================================================ */

const Netlist = (() => {

  function transformerElementNames(label) {
    const clean = String(label || "T1").replace(/[^A-Za-z0-9_]/g, "_");
    const suffix = clean.replace(/^T/i, "") || "1";
    return { lp: `L${suffix}P`, ls: `L${suffix}S`, k: `K${suffix}` };
  }

  // returns t in (0,1) when point n lies strictly inside segment ab, else null
  function segParam(a, b, n) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return null;
    const cross = (n.x - a.x) * dy - (n.y - a.y) * dx;
    if (Math.abs(cross) > 1e-9) return null;
    const t = ((n.x - a.x) * dx + (n.y - a.y) * dy) / len2;
    if (t <= 1e-9 || t >= 1 - 1e-9) return null;
    return t;
  }

  function buildNetGraph() {
    const s = App.state;

    // points of interest: "x,y" -> {x, y, pins: [], wire: bool}
    const poi = new Map();
    function ensure(x, y) {
      const k = x + "," + y;
      if (!poi.has(k)) poi.set(k, { x, y, pins: [], wire: false });
      return poi.get(k);
    }

    // wire vertices (drop consecutive duplicates; degenerate wires kept as bare nodes)
    const wirePaths = [];
    for (const w of s.wires) {
      const pts = [];
      for (const p of w.points) {
        const last = pts[pts.length - 1];
        if (last && last.x === p.x && last.y === p.y) continue;
        pts.push(p);
      }
      for (const p of pts) ensure(p.x, p.y).wire = true;
      if (pts.length >= 2) wirePaths.push(pts);
    }

    // device pins
    for (const d of s.devices) {
      const def = ComponentLib.byId(d.type);
      if (!def) continue;
      for (const p of def.pins) {
        const tp = App.transformPin(p, d);
        ensure(tp.x, tp.y).pins.push({
          devId: d.id, label: d.label, pinName: p.name, port: !!def.isPort,
        });
      }
    }

    // split every segment at interior POIs -> electrical edges + junction degree
    const edges = [];
    const degree = new Map();
    function addEdge(a, b) {
      edges.push([a, b]);
      degree.set(a, (degree.get(a) || 0) + 1);
      degree.set(b, (degree.get(b) || 0) + 1);
    }
    for (const pts of wirePaths) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const cuts = [];
        for (const [k, n] of poi) {
          const t = segParam(a, b, n);
          if (t !== null) cuts.push({ k, t });
        }
        cuts.sort((p, q) => p.t - q.t);
        let prev = a.x + "," + a.y;
        for (const c of cuts) {
          addEdge(prev, c.k);
          poi.get(c.k).wire = true;
          prev = c.k;
        }
        addEdge(prev, b.x + "," + b.y);
      }
    }

    // union-find over edges
    const parent = new Map();
    function find(k) {
      if (!parent.has(k)) parent.set(k, k);
      const p = parent.get(k);
      if (p !== k) parent.set(k, find(p));
      return parent.get(k);
    }
    function union(a, b) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }
    for (const k of poi.keys()) find(k);
    for (const [a, b] of edges) union(a, b);

    const nodeRoot = new Map();
    for (const k of poi.keys()) nodeRoot.set(k, find(k));

    // nets that physically contain wire material
    const wireRoots = new Set();
    for (const [k, n] of poi) if (n.wire) wireRoots.add(nodeRoot.get(k));

    const groups = new Map();
    for (const [k] of nodeRoot) {
      const r = nodeRoot.get(k);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(k);
    }

    // net naming: explicit port names first (gnd -> "0"), then net1, net2, ...
    const netNames = new Map();
    let netCounter = 0;
    for (const [root, keys] of groups) {
      let name = null;
      for (const k of keys) {
        for (const item of poi.get(k).pins) {
          if (!item.port) continue;
          const dev = App.getDevice(item.devId);
          if (!dev) continue;
          if (dev.type === "gnd") { name = "0"; break; }
          if (dev.params.net) { name = dev.params.net; break; }
        }
        if (name) break;
      }
      if (name) for (const k of keys) netNames.set(k, name);
    }
    for (const [root, keys] of groups) {
      if (netNames.has(keys[0])) continue;
      netCounter++;
      const name = "net" + netCounter;
      for (const k of keys) netNames.set(k, name);
    }

    // junction dots: node degree >= 3 (wire ends + pins meeting at one point)
    const junctions = [];
    for (const [k, n] of poi) {
      const d = (degree.get(k) || 0) + n.pins.length;
      if (d >= 3) junctions.push({ x: n.x, y: n.y });
    }

    // wire endpoints that connect to nothing
    const danglingEnds = [];
    for (const [k, n] of poi) {
      if (n.wire && (degree.get(k) || 0) === 1 && n.pins.length === 0) {
        danglingEnds.push({ x: n.x, y: n.y });
      }
    }

    return { netNames, junctions, wireRoots, nodeRoot, danglingEnds };
  }

  function getPinNets(dev, graph) {
    const g = graph || buildNetGraph();
    const def = ComponentLib.byId(dev.type);
    const result = {};
    for (const p of def.pins) {
      const tp = App.transformPin(p, dev);
      result[p.name] = g.netNames.get(tp.x + "," + tp.y) || "?" + p.name;
    }
    return result;
  }

  // ============================================================
  // Generators
  // ============================================================

  function generateSPICE() {
    const s = App.state;
    const graph = buildNetGraph();
    let out = "* SPICE Netlist: " + s.circuitName + "\n";
    out += "* Generated by Schematic Canvas\n\n";

    for (const d of s.devices) {
      const def = ComponentLib.byId(d.type);
      if (!def || def.isPort) continue;
      const line = formatSPICELine(d, def, getPinNets(d, graph));
      if (line) out += line + "\n";
    }

    out += "\n.end\n";
    return out;
  }

  function generateSpectre() {
    const s = App.state;
    const graph = buildNetGraph();
    let out = "// Spectre Netlist: " + s.circuitName + "\n";
    out += "// Generated by Schematic Canvas\n\n";
    out += "simulator lang=spectre\n\n";

    for (const d of s.devices) {
      const def = ComponentLib.byId(d.type);
      if (!def || def.isPort) continue;
      const line = formatSpectreLine(d, def, getPinNets(d, graph));
      if (line) out += line + "\n";
    }

    return out;
  }

  // ---- SPICE line formatters ----

  function controlledNodes(dev, pinNets) {
    const positive = dev.params.controlPositive;
    const negative = dev.params.controlNegative || (dev.type === "gm" ? pinNets.S : "0");
    if (!positive || !/^[A-Za-z0-9_.!]+$/.test(positive) || !/^[A-Za-z0-9_.!]+$/.test(negative)) return null;
    return [dev.type === "gm" ? pinNets.D : pinNets["out+"], dev.type === "gm" ? pinNets.S : pinNets["out-"], positive, negative];
  }

  function formatSPICELine(dev, def, pinNets) {
    const p = dev.params;
    const lbl = dev.label;

    switch (dev.type) {
      case "res":
      case "ro":
      case "rpi":
      case "var_res":
        return `${lbl} ${pinNets["1"] || "?"} ${pinNets["2"] || "?"} ${p.value || "1k"}`;
      case "cap":
      case "cgs":
      case "cgd":
      case "var_cap":
        return `${lbl} ${pinNets["1"] || "?"} ${pinNets["2"] || "?"} ${p.value || "1p"}`;
      case "ind":
      case "ind_l":
      case "var_ind":
        return `${lbl} ${pinNets["1"] || "?"} ${pinNets["2"] || "?"} ${p.value || "1n"}`;
      case "xfmr": {
        const names = transformerElementNames(lbl);
        return `${names.lp} ${pinNets["P1"] || "?"} ${pinNets["P2"] || "?"} ${p.Lp || "1n"}\n` +
          `${names.ls} ${pinNets["S1"] || "?"} ${pinNets["S2"] || "?"} ${p.Ls || "1n"}\n` +
          `${names.k} ${names.lp} ${names.ls} ${p.k || "0.9"}`;
      }
      case "diode":
        return `${lbl} ${pinNets["A"] || "?"} ${pinNets["K"] || "?"} ${p.model || "dio"}`;
      case "nmos":
      case "pmos": {
        // 3-terminal symbols imply bulk tied to source
        const bulk = pinNets["B"] || pinNets["S"] || "?";
        return `${lbl} ${pinNets["D"] || "?"} ${pinNets["G"] || "?"} ${pinNets["S"] || "?"} ${bulk} ${p.model || "nch"} W=${p.W || "10u"} L=${p.L || "1u"}`;
      }
      case "npn":
      case "pnp":
        return `${lbl} ${pinNets["C"] || "?"} ${pinNets["B"] || "?"} ${pinNets["E"] || "?"} ${p.model || "npn"}`;
      case "v_src":
        return `${lbl} ${pinNets["+"] || "?"} ${pinNets["-"] || "?"} ${p.type || "dc"} ${p.value || "1V"}`;
      case "i_src":
        return `${lbl} ${pinNets["+"] || "?"} ${pinNets["-"] || "?"} ${p.type || "dc"} ${p.value || "10u"}`;
      case "gm":
      case "vccs":
      case "vcvs": {
        const nodes = controlledNodes(dev, pinNets);
        return nodes ? `${lbl} ${nodes.join(" ")} ${dev.type === "vcvs" ? p.gain || "10" : p.gm || "1m"}`
          : `* ${lbl}: ${p.display} — set controlPositive/controlNegative to export the variable-defined source`;
      }
      case "sw_open":
      case "sw_closed":
        // SPICE has no native two-terminal switch (the S element needs four
        // nodes plus a model), so emit a subcircuit call like the other
        // non-native blocks — the user's deck supplies the definition.
        {
          const nm = /^X/i.test(lbl) ? lbl : "X" + lbl;
          return `${nm} ${pinNets["1"] || "?"} ${pinNets["2"] || "?"} ${dev.type}`;
        }
      default:
        // subcircuit instances (opamp, gates, ...)
        if (def.prefix === "X") {
          const nm = /^X/i.test(lbl) ? lbl : "X" + lbl;
          return `${nm} ${Object.values(pinNets).join(" ")} ${p.model || def.id}`;
        }
        return `* ${lbl} (${def.name}) ${Object.values(pinNets).join(" ")}`;
    }
  }

  // ---- Spectre line formatters ----

  function formatSpectreLine(dev, def, pinNets) {
    const p = dev.params;
    const lbl = dev.label;
    const nets = Object.values(pinNets).join(" ");

    switch (dev.type) {
      case "res":
      case "ro":
      case "rpi":
      case "var_res":
        return `${lbl} (${nets}) resistor r=${p.value || "1k"}`;
      case "cap":
      case "cgs":
      case "cgd":
      case "var_cap":
        return `${lbl} (${nets}) capacitor c=${p.value || "1p"}`;
      case "ind":
      case "ind_l":
      case "var_ind":
        return `${lbl} (${nets}) inductor l=${p.value || "1n"}`;
      case "xfmr": {
        const names = transformerElementNames(lbl);
        return `${names.lp} (${pinNets["P1"] || "?"} ${pinNets["P2"] || "?"}) inductor l=${p.Lp || "1n"}\n` +
          `${names.ls} (${pinNets["S1"] || "?"} ${pinNets["S2"] || "?"}) inductor l=${p.Ls || "1n"}\n` +
          `${names.k} mutual_inductor coupling=${p.k || "0.9"} ind1=${names.lp} ind2=${names.ls}`;
      }
      case "diode":
        return `${lbl} (${nets}) diode model=${p.model || "dio"}`;
      case "nmos":
      case "pmos": {
        const bulk = pinNets["B"] || pinNets["S"] || "?";
        return `${lbl} (${pinNets["D"] || "?"} ${pinNets["G"] || "?"} ${pinNets["S"] || "?"} ${bulk}) ${p.model || "nch"} W=${p.W || "10u"} L=${p.L || "1u"}`;
      }
      case "npn":
      case "pnp":
        return `${lbl} (${pinNets["C"] || "?"} ${pinNets["B"] || "?"} ${pinNets["E"] || "?"}) ${p.model || "npn"}`;
      case "v_src":
        return `${lbl} (${nets}) vsource type=${p.type || "dc"} dc=${p.value || "1V"}`;
      case "i_src":
        return `${lbl} (${nets}) isource type=${p.type || "dc"} dc=${p.value || "10u"}`;
      case "gm":
      case "vccs":
      case "vcvs": {
        const nodes = controlledNodes(dev, pinNets);
        return nodes ? `${lbl} (${nodes.join(" ")}) ${dev.type === "vcvs" ? `vcvs gain=${p.gain || "10"}` : `vccs gm=${p.gm || "1m"}`}`
          : `// ${lbl}: ${p.display} — set controlPositive/controlNegative to export the variable-defined source`;
      }
      case "sw_open":
      case "sw_closed":
        // Same as SPICE: a switch is a subcircuit instance, not a native element.
        return `${lbl} (${nets}) ${dev.type}`;
      default:
        if (def.prefix === "X") {
          return `${lbl} (${nets}) ${p.model || def.id}`;
        }
        return `// ${lbl} (${def.name}) ${nets}`;
    }
  }

  // ---- Instance Table ----
  function instanceTable() {
    const s = App.state;
    const graph = buildNetGraph();
    let out = "Instance\tType\tValue/Model\tPins\n";
    out += "--------\t----\t-----------\t----\n";
    for (const d of s.devices) {
      const def = ComponentLib.byId(d.type);
      if (!def || def.isPort) continue;
      const pinNets = getPinNets(d, graph);
      const val = d.type === "xfmr"
        ? `Lp=${d.params.Lp || "1n"} Ls=${d.params.Ls || "1n"} k=${d.params.k || "0.9"}`
        : d.params.value || d.params.gm || d.params.gain || (d.params.W ? `${d.params.W}/${d.params.L}` : d.params.model) || "";
      const pinStr = Object.entries(pinNets).map(([k, v]) => `${k}=${v}`).join(" ");
      out += `${d.label}\t${def.name}\t${val}\t${pinStr}\n`;
    }
    return out;
  }

  // ---- Check Report ----
  function checkReport() {
    const s = App.state;
    const warnings = [];
    const infos = [];
    const graph = buildNetGraph();

    infos.push(`Devices: ${s.devices.length}`);
    infos.push(`Wires: ${s.wires.length}`);
    for (const d of s.devices.filter(d => ["gm", "vccs", "vcvs"].includes(d.type))) {
      const nodes = controlledNodes(d, getPinNets(d, graph));
      if (!nodes) warnings.push(`${d.label}: control variable has no valid node binding; netlist contains an explicit placeholder comment.`);
      else for (const name of nodes.slice(2)) if (!Array.from(graph.netNames.values()).includes(name)) warnings.push(`${d.label}: control node ${name} is not present in the schematic.`);
    }

    // floating pins: pin's net contains no wire material
    let floating = 0;
    for (const d of s.devices) {
      const def = ComponentLib.byId(d.type);
      if (!def || def.isPort) continue;
      for (const p of def.pins) {
        const tp = App.transformPin(p, d);
        const k = tp.x + "," + tp.y;
        if (!graph.wireRoots.has(graph.nodeRoot.get(k))) {
          floating++;
          warnings.push(`  ${d.label}.${p.name} — floating`);
        }
      }
    }
    if (floating > 0) warnings.unshift(`Floating pins: ${floating}`);
    else infos.push("All pins connected.");

    // disconnected power ports
    for (const d of s.devices) {
      const def = ComponentLib.byId(d.type);
      if (!def || !def.isPort) continue;
      for (const p of def.pins) {
        const tp = App.transformPin(p, d);
        const k = tp.x + "," + tp.y;
        if (!graph.wireRoots.has(graph.nodeRoot.get(k))) {
          warnings.push(`  Port ${d.label} (${def.name}) — not connected to any wire`);
        }
      }
    }

    // dangling wire endpoints
    if (graph.danglingEnds.length > 0) {
      warnings.push(`Dangling wire ends: ${graph.danglingEnds.length}` +
        graph.danglingEnds.slice(0, 8).map(e => `\n  (${e.x}, ${e.y})`).join(""));
    }

    // power / ground presence
    const ports = s.devices.filter(d => {
      const def = ComponentLib.byId(d.type);
      return def && def.isPort;
    });
    infos.push(`Ports: ${ports.length}`);
    const hasVdd = ports.some(p => p.type.startsWith("vdd"));
    const hasGnd = ports.some(p => p.type === "gnd");
    if (!hasVdd) warnings.push("No VDD port found.");
    if (!hasGnd) warnings.push("No Ground port found.");

    let out = `=== Check Report: ${s.circuitName} ===\n\n`;
    out += `Status: ${warnings.length === 0 ? "PASS" : "WARNINGS"}\n\n`;
    out += `--- Info ---\n${infos.join("\n")}\n\n`;
    if (warnings.length > 0) {
      out += `--- Warnings (${warnings.length}) ---\n${warnings.join("\n")}\n\n`;
    }
    out += `${warnings.length === 0 ? "PASS" : "WARN"} — ${warnings.length} warning(s).\n`;
    return out;
  }

  return {
    generateSPICE,
    generateSpectre,
    instanceTable,
    checkReport,
    buildNetGraph,
    getPinNets,
  };

})();
