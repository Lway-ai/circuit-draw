/* ============================================================
 * templates.js — Built-in schematic templates
 * Updated for new pin positions (2x website coordinates)
 * ============================================================ */

const Templates = (() => {

  // Pin positions (relative, at 2x website scale):
  //   NMOS: G(-40,0) D(20,-40) S(20,40)
  //   PMOS: G(-40,0) S(20,-40) D(20,40)
  //   NMOS mirrored: G(40,0) D(-20,-40) S(-20,40)
  //   VDD: pin at (0,40)
  //   GND: pin at (0,-20)
  //   Pin: connection at (20,0)
  function fiveTransistorOTA() {
    const devices = [];
    const wires = [];
    const D = (type, x, y, label, params, opt = {}) =>
      devices.push(Object.assign({ type, x, y, rot: 0, mirrorX: false, mirrorY: false, label, params }, opt));

    // --- devices ---
    // M3/M4 PMOS pair: placed so D pins align with M1/M2 NMOS D pins
    D("pmos", -100, -100, "M3", { W: "10u", L: "1u", model: "pch" });
    D("pmos",   60, -100, "M4", { W: "10u", L: "1u", model: "pch" });

    D("nmos", -100,   20, "M1", { W: "20u", L: "1u", model: "nch" });
    D("nmos",  100,   20, "M2", { W: "20u", L: "1u", model: "nch" }, { mirrorX: true });

    D("nmos",    0,  160, "M5", { W: "10u", L: "1u", model: "nch" });

    D("vdd", 0, -160, "VDD", { value: "VDD", net: "vdd" });
    D("gnd",      0,  240, "GND", { value: "0",    net: "gnd" });

    // Pin connection point = position + (20, 0)
    D("pin", -160,  160, "VB",   { net: "vb" });
    D("pin", -220,   20, "VIP",  { net: "vinp" });
    D("pin",  200,   20, "VIN",  { net: "vinn" });
    D("pin",  200,  -20, "VOUT", { net: "vout" });

    // --- wires ---
    // VDD rail: M3.S(-80,-140) → M4.S(80,-140)
    wires.push([{ x: -80, y: -140 }, { x: 80, y: -140 }]);
    // VDD pin(0,-120) up to rail
    wires.push([{ x: 0, y: -120 }, { x: 0, y: -140 }]);

    // Mirror gate line: M3.G(-140,-100) → down → right through M3.D(-80,-60) → up to M4.G(20,-100)
    wires.push([{ x: -140, y: -100 }, { x: -140, y: -60 }, { x: 20, y: -60 }, { x: 20, y: -100 }]);

    // M3.D(-80,-60) → M1.D(-80,-20)
    wires.push([{ x: -80, y: -60 }, { x: -80, y: -20 }]);
    // M4.D(80,-60) → M2.D(80,-20)
    wires.push([{ x: 80, y: -60 }, { x: 80, y: -20 }]);

    // Tail node: M1.S(-80,60) → down → right → up to M2.S(80,60)
    wires.push([{ x: -80, y: 60 }, { x: -80, y: 120 }, { x: 80, y: 120 }, { x: 80, y: 60 }]);

    // M5.S(20,200) → down → left to GND(0,220)
    wires.push([{ x: 20, y: 200 }, { x: 20, y: 220 }, { x: 0, y: 220 }]);

    // M5.G(-40,160) → left to VB(-140,160)
    wires.push([{ x: -40, y: 160 }, { x: -140, y: 160 }]);
    // M1.G(-140,20) → left to VIP(-200,20)
    wires.push([{ x: -140, y: 20 }, { x: -200, y: 20 }]);
    // M2.G(140,20) → right to VIN(220,20)
    wires.push([{ x: 140, y: 20 }, { x: 220, y: 20 }]);
    // Output: M2.D(80,-20) → right to VOUT(220,-20)
    wires.push([{ x: 80, y: -20 }, { x: 220, y: -20 }]);

    return { devices, wires, name: "5T OTA" };
  }

  function applyTemplate(name) {
    let tpl;
    if (name === "ota5") tpl = fiveTransistorOTA();
    if (!tpl) return false;

    const devices = tpl.devices.map((d, i) => ({
      id: "dev_" + (i + 1),
      type: d.type, x: d.x, y: d.y,
      rot: d.rot || 0, mirrorX: d.mirrorX || false, mirrorY: d.mirrorY || false,
      params: d.params, label: d.label,
    }));

    const wires = tpl.wires.map((pts, i) => ({
      id: "wire_" + (i + 1),
      points: pts.map(p => ({ ...p })),
    }));

    const texts = [{
      id: "txt_1", x: -220, y: -200, text: tpl.name, fontSize: 22,
    }];

    const counters = {};
    for (const d of devices) {
      const prefix = d.label.replace(/[0-9].*$/, "");
      const num = parseInt(d.label.replace(/^[^0-9]+/, ""));
      if (!isNaN(num)) {
        counters[prefix] = Math.max(counters[prefix] || 0, num);
      }
    }

    App.deserialize({
      name: tpl.name,
      devices, wires, texts, annotations: [],
      nextId: devices.length + wires.length + texts.length + 10,
      labelCounters: counters,
    });

    App.updateJunctions();
    App.fitView();
    return true;
  }

  const list = [
    { id: "ota5", name: "5-Transistor OTA", category: "Analog" },
  ];

  return { list, apply: applyTemplate, fiveTransistorOTA };

})();
