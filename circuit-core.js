/* Shared, dependency-free document and geometry rules for browser + MCP. */
const CircuitCore = (() => {
  const coordinate = v => Math.round(v * 1e6) / 1e6;
  const pointKey = p => coordinate(p.x) + "," + coordinate(p.y);

  function transformPin(pin, dev) {
    let x = pin.x, y = pin.y;
    const rotation = ((dev.rot || 0) % 360 + 360) % 360;
    switch (rotation) {
      case 0: break;
      case 90: [x, y] = [-y, x]; break;
      case 180: [x, y] = [-x, -y]; break;
      case 270: [x, y] = [y, -x]; break;
      default: {
        const r = rotation * Math.PI / 180;
        [x, y] = [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
      }
    }
    if (dev.mirrorX) x = -x;
    if (dev.mirrorY) y = -y;
    return { x: coordinate(x + dev.x), y: coordinate(y + dev.y), name: pin.name };
  }

  // Always rebuild from the gesture's original vertices, never the prior frame.
  function moveAnchoredPoints(points, anchors, dx, dy) {
    const moved = points.map(p => anchors.has(pointKey(p)));
    const result = [];
    const add = p => {
      if (!result.length || pointKey(result[result.length - 1]) !== pointKey(p)) result.push(p);
    };
    const shifted = (p, i) => ({ x: coordinate(p.x + (moved[i] ? dx : 0)), y: coordinate(p.y + (moved[i] ? dy : 0)) });
    if (!points.length) return result;
    add(shifted(points[0], 0));
    for (let i = 1; i < points.length; i++) {
      const a = shifted(points[i - 1], i - 1), b = shifted(points[i], i);
      if (moved[i - 1] !== moved[i] && a.x !== b.x && a.y !== b.y) {
        if (points[i - 1].y === points[i].y) {
          add(moved[i - 1] ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
        } else if (points[i - 1].x === points[i].x) {
          add(moved[i - 1] ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
        }
      }
      add(b);
    }
    return result;
  }

  function normalizeDocument(data, library) {
    const fail = message => { throw new Error("Invalid project: " + message); };
    const object = v => v && typeof v === "object" && !Array.isArray(v);
    if (!object(data)) fail("expected a JSON object");
    const number = (v, name, fallback) => {
      if (v === undefined && fallback !== undefined) return fallback;
      if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e7) fail(name + " must be a finite number");
      return coordinate(v);
    };
    const string = (v, name, fallback = "") => {
      if (v === undefined) return fallback;
      if (typeof v !== "string" || v.length > 10000) fail(name + " must be a string of at most 10000 characters");
      return v;
    };
    const array = name => {
      if (data[name] === undefined) return [];
      if (!Array.isArray(data[name]) || data[name].length > 10000) fail(name + " must be an array of at most 10000 items");
      return data[name];
    };
    const ids = new Set();
    let nextId = 1;
    const idFor = (value, prefix) => {
      const id = string(value, "id", prefix + "_" + nextId++);
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id) || ids.has(id)) fail("duplicate or invalid id: " + id);
      ids.add(id);
      const m = /_(\d+)$/.exec(id);
      if (m) nextId = Math.max(nextId, Number(m[1]) + 1);
      return id;
    };
    const counters = {};
    const devices = array("devices").map(d => {
      if (!object(d)) fail("device must be an object");
      const def = library.byId(d.type);
      if (!def || def.tool) fail("unknown electrical component: " + d.type);
      if (d.params !== undefined && !object(d.params)) fail("device params must be an object");
      const params = { ...def.defaultParams };
      for (const [key, value] of Object.entries(d.params || {})) {
        if (!Object.hasOwn(params, key)) fail("unknown parameter: " + key);
        params[key] = string(value, "parameter " + key);
      }
      const rot = number(d.rot, "rotation", 0);
      if (rot % 90 !== 0) fail("rotation must be a multiple of 90 degrees");
      for (const key of ["mirrorX", "mirrorY"]) {
        if (d[key] !== undefined && typeof d[key] !== "boolean") fail(key + " must be boolean");
      }
      const label = string(d.label, "label", def.prefix + ((counters[def.prefix] || 0) + 1));
      const m = /^(.*?)(\d+)$/.exec(label);
      if (m) counters[m[1]] = Math.max(counters[m[1]] || 0, Number(m[2]));
      let labelOff = null;
      if (d.labelOff !== undefined && d.labelOff !== null) {
        if (!object(d.labelOff)) fail("labelOff must be an object");
        labelOff = { x: number(d.labelOff.x, "labelOff.x"), y: number(d.labelOff.y, "labelOff.y") };
      }
      return { id: idFor(d.id, "dev"), type: def.id, x: number(d.x, "device.x"), y: number(d.y, "device.y"),
        rot: ((rot % 360) + 360) % 360, mirrorX: !!d.mirrorX, mirrorY: !!d.mirrorY, params, label, labelOff };
    });
    const wires = array("wires").map(w => {
      if (!object(w) || !Array.isArray(w.points) || w.points.length < 2 || w.points.length > 10000) fail("wire must have 2 to 10000 points");
      return { id: idFor(w.id, "wire"), points: w.points.map(p => {
        if (!object(p)) fail("wire point must be an object");
        return { x: number(p.x, "point.x"), y: number(p.y, "point.y") };
      }) };
    });
    const texts = array("texts").map(t => {
      if (!object(t)) fail("text must be an object");
      const fontSize = number(t.fontSize, "fontSize", 30);
      if (fontSize < 1 || fontSize > 200) fail("fontSize must be between 1 and 200");
      return { id: idFor(t.id, "txt"), x: number(t.x, "text.x"), y: number(t.y, "text.y"), text: string(t.text, "text"), fontSize };
    });
    const annotations = array("annotations").map(a => {
      if (!object(a) || !["arrow", "rect", "circle", "line"].includes(a.type)) fail("unknown annotation type");
      return { id: idFor(a.id, "a"), type: a.type, x1: number(a.x1, "x1"), y1: number(a.y1, "y1"), x2: number(a.x2, "x2"), y2: number(a.y2, "y2") };
    });
    if (data.style !== undefined && !object(data.style)) fail("style must be an object");
    const style = { wireWidth: 3.2, fontSize: 30, gridVisible: true, orthogonalWire: true, ...data.style };
    style.wireWidth = number(style.wireWidth, "wireWidth");
    style.fontSize = number(style.fontSize, "fontSize");
    if (style.wireWidth < 0.1 || style.wireWidth > 20 || style.fontSize < 1 || style.fontSize > 200) fail("style sizes out of range");
    if (typeof style.gridVisible !== "boolean" || typeof style.orthogonalWire !== "boolean") fail("style flags must be boolean");
    const providedNextId = number(data.nextId, "nextId", 1);
    if (!Number.isInteger(providedNextId) || providedNextId < 1) fail("nextId must be a positive integer");
    return { name: string(data.name, "name", "New Circuit"), devices, wires, texts, annotations,
      nextId: Math.max(nextId, providedNextId), labelCounters: counters, style };
  }
  return { coordinate, pointKey, transformPin, moveAnchoredPoints, normalizeDocument };
})();
if (typeof module !== "undefined") module.exports = CircuitCore;
