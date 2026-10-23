"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Core = require("../circuit-core.js");
const root = path.resolve(__dirname, "..");
const escapeXML = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The library's draw functions only need these SVG construction primitives.
// Raw innerHTML here is the bundled, fixed symbol artwork, never project input.
class SVGNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.raw = ""; this.text = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  appendChild(n) { this.children.push(n); return n; }
  set innerHTML(v) { this.raw = v; this.children = []; }
  set textContent(v) { this.text = String(v); }
  toString() {
    const attrs = Object.entries(this.attrs).map(([k, v]) => ` ${k}="${escapeXML(v)}"`).join("");
    return `<${this.tag}${attrs}>${this.raw}${escapeXML(this.text)}${this.children.join("")}</${this.tag}>`;
  }
}
const sandbox = { document: { createElementNS: (_ns, tag) => new SVGNode(tag) }, console };
vm.createContext(sandbox);
const library = vm.runInContext(fs.readFileSync(path.join(root, "components.js"), "utf8") + "\nComponentLib", sandbox);
const templates = vm.runInContext(fs.readFileSync(path.join(root, "templates.js"), "utf8") + "\nTemplates", sandbox);

function normalize(project) { return Core.normalizeDocument(project, library); }
function load(filename) {
  if (typeof filename !== "string" || !path.isAbsolute(filename)) throw new Error("Project path must be absolute");
  return normalize(JSON.parse(fs.readFileSync(filename, "utf8")));
}
function netlist(project) {
  const App = { state: { ...project, circuitName: project.name }, transformPin: Core.transformPin, getDevice: id => project.devices.find(d => d.id === id) };
  const context = { App, ComponentLib: library };
  vm.createContext(context);
  return vm.runInContext(fs.readFileSync(path.join(root, "netlist.js"), "utf8") + "\nNetlist", context);
}
function save(filename, project, overwrite = false) {
  return writeOutput(filename, JSON.stringify(normalize(project), null, 2) + "\n", overwrite);
}
function writeOutput(filename, content, overwrite = false) {
  if (typeof filename !== "string" || !path.isAbsolute(filename)) throw new Error("Output path must be absolute");
  filename = path.resolve(filename);
  const exists = fs.existsSync(filename);
  if (exists && !overwrite) throw new Error("File exists; set overwrite=true to replace it with a backup");
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const stamp = Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  const temporary = filename + "." + stamp + ".tmp";
  let backup = null;
  try {
    fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    if (exists) { backup = filename + "." + stamp + ".bak"; fs.copyFileSync(filename, backup, fs.constants.COPYFILE_EXCL); }
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return { path: filename, backup, bytes: fs.statSync(filename).size };
}
function device(project, selector) {
  const byId = project.devices.find(d => d.id === selector);
  if (byId) return byId;
  const matches = project.devices.filter(d => d.label === selector);
  if (matches.length !== 1) throw new Error("Device id or unique label required: " + selector);
  return matches[0];
}
function pin(project, target) {
  if (!target || typeof target.device !== "string" || typeof target.pin !== "string") throw new Error("Pin target needs device and pin");
  const d = device(project, target.device);
  const p = library.byId(d.type).pins.find(p => p.name === target.pin);
  if (!p) throw new Error(`Unknown pin ${target.device}.${target.pin}`);
  const { x, y } = Core.transformPin(p, d);
  return { x, y };
}
function create(name, template) {
  if (template && template !== "ota5") throw new Error("Unknown template: " + template);
  if (!template) return normalize({ name: name || "New Circuit" });
  const t = templates.fiveTransistorOTA();
  return normalize({ name: name || t.name, devices: t.devices,
    wires: t.wires.map(points => ({ points })), texts: [], annotations: [] });
}

function renderSVG(project) {
  const p = normalize(project), chunks = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const bounds = (x1, y1, x2, y2) => { minX = Math.min(minX, x1); minY = Math.min(minY, y1); maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2); };
  const text = (str, x, y, size, anchor = "start", notation = false) => {
    // Conservative bounds support Chinese text and long user labels without clipping.
    const width = Array.from(str).length * size * 1.2;
    const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    bounds(left, y - size * 1.3, left + width, y + size * .4);
    const content = notation ? library.labelParts(str).map(part => `<tspan${part.sub ? ' font-size="76%" baseline-shift="sub"' : ' baseline-shift="baseline"'}>${escapeXML(part.text)}</tspan>`).join("") : escapeXML(str);
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" class="label">${content}</text>`;
  };
  for (const w of p.wires) {
    for (const pt of w.points) bounds(pt.x, pt.y, pt.x, pt.y);
    chunks.push(`<path d="${w.points.map((pt, i) => `${i ? "L" : "M"} ${pt.x} ${pt.y}`).join(" ")}" class="wire"/>`);
  }
  for (const d of p.devices) {
    const def = library.byId(d.type), g = new SVGNode("g");
    def.draw(g);
    g.setAttribute("transform", `translate(${d.x},${d.y}) scale(${d.mirrorX ? -1 : 1},${d.mirrorY ? -1 : 1}) rotate(${d.rot})`);
    chunks.push(library.scaleLeadMarkup(g.toString(), p.style.wireWidth));
    bounds(d.x - 64, d.y - 64, d.x + 64, d.y + 64);
    for (const pt of def.pins.map(pt => Core.transformPin(pt, d))) bounds(pt.x - 64, pt.y - 64, pt.x + 64, pt.y + 64);
    const spec = library.labelSpec(d.type);
    if (spec) {
      const off = d.labelOff || { x: spec.off[0], y: spec.off[1] };
      const str = spec.text ? d.params[spec.text] || d.label : d.label;
      // Same counter-transform as the browser keeps text upright after rotation/mirroring.
      chunks.push(text(str, d.x + off.x, d.y + off.y, p.style.fontSize, spec.anchor, spec.text === "display"));
    }
  }
  for (const t of p.texts) chunks.push(text(t.text, t.x, t.y, t.fontSize));
  for (const a of p.annotations) {
    if (a.type === "circle") {
      const cx = (a.x1 + a.x2) / 2, cy = (a.y1 + a.y2) / 2, r = Math.max(Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1)) / 2;
      bounds(cx - r, cy - r, cx + r, cy + r);
      chunks.push(`<circle cx="${cx}" cy="${cy}" r="${r}" class="wire"/>`);
    } else {
      bounds(Math.min(a.x1, a.x2), Math.min(a.y1, a.y2), Math.max(a.x1, a.x2), Math.max(a.y1, a.y2));
      if (a.type === "rect") chunks.push(`<rect x="${Math.min(a.x1, a.x2)}" y="${Math.min(a.y1, a.y2)}" width="${Math.abs(a.x2-a.x1)}" height="${Math.abs(a.y2-a.y1)}" class="wire"/>`);
      else chunks.push(`<path d="M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}" class="wire"${a.type === "arrow" ? ' marker-end="url(#arrow)"' : ""}/>`);
    }
  }
  for (const j of netlist(p).buildNetGraph().junctions) chunks.push(`<circle cx="${j.x}" cy="${j.y}" r="7.56" fill="#000"/>`);
  if (minX === Infinity) { minX = minY = -100; maxX = maxY = 100; }
  const pad = 40, width = maxX - minX + pad * 2, height = maxY - minY + pad * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX-pad} ${minY-pad} ${width} ${height}">
<title>${escapeXML(p.name)}</title><style>.wire{fill:none;stroke:#000;stroke-width:${p.style.wireWidth};stroke-linecap:butt;stroke-linejoin:miter}.label{font-family:'Times New Roman','SimSun',serif;font-style:italic;fill:#000}</style>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
<rect x="${minX-pad}" y="${minY-pad}" width="${width}" height="${height}" fill="white"/>${chunks.join("\n")}</svg>\n`;
}
module.exports = { Core, library, root, normalize, load, netlist, save, writeOutput, device, pin, create, renderSVG };
