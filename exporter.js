/* ============================================================
 * exporter.js — SVG / PNG / JPG / PDF export
 * PDF export opens a print window (vector quality, no deps).
 * ============================================================ */

const Exporter = (() => {

  // schematic stroke styles, embedded into every exported SVG so the
  // file renders identically outside the app (style.css is not loaded)
  const EXPORT_CSS = `
    .wire { stroke: #000; stroke-width: 3.2; fill: none; stroke-linecap: butt; stroke-linejoin: miter; }
    .joint-patch { stroke: #000; fill: none; stroke-linecap: butt; stroke-linejoin: miter; }
    .dev-stroke { stroke: #000; stroke-width: 3.2; fill: none; stroke-linecap: butt; stroke-linejoin: miter; }
    .dev-fill { fill: #000; stroke: none; }
    .junction { fill: #000; }
    .dev-pins { display: none; }
    .lbl { font-family: "Times New Roman", Times, serif; font-style: italic; font-weight: 700; fill: #000; }
    .lbl-text { font-family: "Times New Roman", Times, serif; font-style: italic; fill: #000; }
    .anno { stroke: #333; stroke-width: 3.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .anno-fill { fill: #333; }
  `;

  function getBBox() {
    // SVG measures rendered artwork, dragged labels, font sizes and circle radii.
    const layers = [App.gWires, App.gDevices, App.gNodes, App.gAnnos, App.gTexts];
    const boxes = layers.filter(g => g && g.childElementCount).map(g => g.getBBox());
    if (boxes.length) {
      const minX = Math.min(...boxes.map(b => b.x));
      const minY = Math.min(...boxes.map(b => b.y));
      const maxX = Math.max(...boxes.map(b => b.x + b.width));
      const maxY = Math.max(...boxes.map(b => b.y + b.height));
      const pad = Math.max(40, App.state.wireWidth * 2);
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    const s = App.state;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasAny = false;
    for (const d of s.devices) {
      const pins = ComponentLib.getPins(d.type);
      for (const p of pins) {
        const tp = App.transformPin(p, d);
        minX = Math.min(minX, tp.x); maxX = Math.max(maxX, tp.x);
        minY = Math.min(minY, tp.y); maxY = Math.max(maxY, tp.y);
      }
      hasAny = true;
    }
    for (const w of s.wires) {
      for (const p of w.points) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      hasAny = true;
    }
    for (const t of s.texts) {
      minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x + 100);
      minY = Math.min(minY, t.y - 14); maxY = Math.max(maxY, t.y + 4);
      hasAny = true;
    }
    for (const a of s.annotations) {
      minX = Math.min(minX, a.x1, a.x2); maxX = Math.max(maxX, a.x1, a.x2);
      minY = Math.min(minY, a.y1, a.y2); maxY = Math.max(maxY, a.y1, a.y2);
      hasAny = true;
    }
    if (!hasAny) { minX = -100; minY = -100; maxX = 100; maxY = 100; }
    const pad = 40;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }

  function buildExportSVG() {
    const bbox = getBBox();
    const s = App.state;

    // clone the viewport contents into a fresh SVG
    const svg = document.createElementNS(App.SVG_NS, "svg");
    svg.setAttribute("xmlns", App.SVG_NS);
    svg.setAttribute("width", Math.round(bbox.w));
    svg.setAttribute("height", Math.round(bbox.h));
    svg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`);

    // embedded stylesheet (classes match style.css in-app rendering)
    const style = App.el("style");
    style.textContent = EXPORT_CSS;
    svg.appendChild(style);

    // white background
    const bg = App.el("rect", { x: bbox.x, y: bbox.y, width: bbox.w, height: bbox.h, fill: "#fff" });
    svg.appendChild(bg);

    // subtle grid dots
    const defs = App.el("defs");
    const pattern = App.el("pattern", {
      id: "exp-dots", width: 20, height: 20, patternUnits: "userSpaceOnUse"
    });
    pattern.appendChild(App.el("circle", { cx: 0, cy: 0, r: 1.1, fill: "#e6e6e0" }));
    defs.appendChild(pattern);
    svg.appendChild(defs);
    if (s.gridVisible) svg.appendChild(App.el("rect", {
      x: bbox.x, y: bbox.y, width: bbox.w, height: bbox.h, fill: "url(#exp-dots)"
    }));

    // layers (selection highlights stripped)
    for (const group of [App.gWires, App.gDevices, App.gNodes, App.gAnnos, App.gTexts]) {
      const g = group.cloneNode(true);
      g.querySelectorAll(".selected").forEach(n => n.classList.remove("selected"));
      svg.appendChild(g);
    }

    // title
    const title = App.el("text", {
      x: bbox.x + 10, y: bbox.y + 22,
      "font-family": "-apple-system, Segoe UI, sans-serif",
      "font-size": 14, fill: "#666", "font-weight": 600
    });
    title.textContent = s.circuitName;
    svg.appendChild(title);

    return svg;
  }

  function svgToString(svg) {
    const serializer = new XMLSerializer();
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svg);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fileBase() {
    return App.state.circuitName.replace(/\s+/g, "_");
  }

  // user text must be escaped before HTML interpolation (PDF export window)
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function exportSVG() {
    const str = svgToString(buildExportSVG());
    downloadBlob(new Blob([str], { type: "image/svg+xml;charset=utf-8" }), fileBase() + ".svg");
  }

  function exportRaster(type, extension, quality) {
    const str = svgToString(buildExportSVG());
    const url = URL.createObjectURL(new Blob([str], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const scale = 2; // 2x for crisp output
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          alert(extension.toUpperCase() + " export failed — try SVG export instead.");
          return;
        }
        downloadBlob(blob, fileBase() + "." + extension);
      }, type, quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert(extension.toUpperCase() + " export failed — try SVG export instead.");
    };
    img.src = url;
  }

  function exportPNG() {
    exportRaster("image/png", "png");
  }

  function exportJPG() {
    // JPEG has no transparency, so exportRaster paints a white background first.
    exportRaster("image/jpeg", "jpg", 0.92);
  }

  function exportPDF() {
    // print dialog: keeps vector quality and works in every browser
    const str = svgToString(buildExportSVG());
    const win = window.open("", "_blank");
    if (!win) {
      alert("PDF export needs one popup window — allow popups for this page and try again.");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(fileBase())}</title>
      <style>@page { size: auto; margin: 10mm; }
      body { margin: 0; display: flex; align-items: center; justify-content: center; }
      svg { max-width: 100%; height: auto; }</style></head><body>
      ${str.replace("<svg", '<svg style="max-width:100%;height:auto"')}
      <script>window.onload = function() { window.print(); }<\/script>
      </body></html>`);
    win.document.close();
  }

  return {
    exportSVG,
    exportPNG,
    exportJPG,
    exportPDF,
    buildExportSVG,
  };

})();
