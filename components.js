/* ============================================================
 * components.js — Schematic Canvas component library
 *
 * Symbol artwork adapted from analog-canvas.tokenzhang.com.
 * Credit: 张托肯, 清华大学 (Token Zhang, Tsinghua University).
 * The project maintainer confirmed permission to release this artwork
 * with the plugin under the MIT License on 2026-10-23.
 * Retain this attribution and the repository LICENSE on redistribution.
 * ============================================================ */

const ComponentLib = (() => {

  const G = 20;

  function el(tag, attrs) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Inject raw SVG from website, scaled by 2 so pins land on 20px grid.
  // Stroke widths scale with the transform so lines and filled shapes
  // keep the website's ink ratio (wire/symbol stroke = 1.6 @ pins ±20).
  function rawSVG(g, html) {
    const wrapper = el("g", { transform: "scale(2)" });
    const fixed = html
      .replace(/currentColor/g, "#000")
      .replace(/<[^>]+stroke-width="1\.6"[^>]*>/g, tag => {
        let lead = tag.replace('stroke-width="1.6"', 'stroke-width="1.6" data-connection-lead="2"');
        if (/stroke-linecap="[^"]*"/.test(lead)) lead = lead.replace(/stroke-linecap="[^"]*"/g, 'stroke-linecap="butt"');
        else lead = lead.replace(/\/?>$/, ending => ' stroke-linecap="butt"' + ending);
        return lead;
      });
    wrapper.innerHTML = fixed;
    g.appendChild(wrapper);
  }

  // The original electrical leads are 1.6 units inside scale(2).
  // Preserve thicker symbol bodies while matching leads to the world wire width.
  function setDeviceWireWidth(g, width = 3.2) {
    g.querySelectorAll('[data-connection-lead="2"]').forEach(n => {
      n.setAttribute("stroke-width", width / 2);
    });
  }

  function scaleLeadMarkup(markup, width = 3.2) {
    return markup.replace(/stroke-width="[^"]*" data-connection-lead="2"/g,
      `stroke-width="${width / 2}" data-connection-lead="2"`);
  }

  // Draw a stroked line at 2x coordinates (outside the scale wrapper)
  function sLine(g, x1, y1, x2, y2, w) {
    const a = { x1, y1, x2, y2, stroke: "#111", "stroke-width": w || 1.6, "stroke-linecap": "butt", fill: "none" };
    g.appendChild(el("line", a));
  }
  function sFillPoly(g, pts) {
    g.appendChild(el("polygon", { points: pts, fill: "#111", stroke: "none" }));
  }
  function sText(g, text, x, y, opts) {
    const a = Object.assign({ x, y, "font-size": 10, "text-anchor": "start", fill: "#111" }, opts);
    const t = el("text", a);
    t.textContent = text;
    g.appendChild(t);
  }

  // ============================================================
  // Raw SVG data from analog-canvas website
  // ============================================================

  const SVG_NMOS = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><polyline points="-4.244186,-6.976744 10,-6.976744 10,-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-11.802326,-9.593023 -11.802326,9.593023 -8.895349,9.593023 -8.895349,-9.593023" fill="#000" stroke="none"></polygon><polygon points="-6.569767,-12.5 -6.569767,12.5 -3.662791,12.5 -3.662791,-12.5" fill="#000" stroke="none"></polygon><line x1="-8.895349" y1="0" x2="-20" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polyline points="-3.662791,6.976744 10,6.976744 10,20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="10.581395,6.976744 1.27907,2.906977 1.27907,11.046512" fill="#000" stroke="none"></polygon></g>`;

  const SVG_PMOS = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><polyline points="-4.244186,6.976744 10,6.976744 10,20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-11.802326,-9.593023 -11.802326,9.593023 -8.895349,9.593023 -8.895349,-9.593023" fill="#000" stroke="none"></polygon><polygon points="-6.569767,-12.5 -6.569767,12.5 -3.662791,12.5 -3.662791,-12.5" fill="#000" stroke="none"></polygon><line x1="-8.895349" y1="0" x2="-20" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polyline points="5.639535,-7.122093 10,-7.122093 10,-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-3.662791,-7.122093 5.639535,-11.19186 5.639535,-3.052326" fill="#000" stroke="none"></polygon></g>`;

  const SVG_NPN = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-40" y1="0" x2="-16.868887" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-16.868887" y1="-13.345607" x2="-16.868887" y2="13.32954" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></line><polyline points="-16.868887,-6.401526 0,-13.379732 0,-30" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><line x1="-16.868887" y1="6.403673" x2="-7.30071" y2="10.358712" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polyline points="-0.936056,12.990761 0,13.377859 0,30" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-6.635095,6.792086 -9.952643,13.377859 0,13.377859" fill="#000" stroke="none"></polygon></g>`;

  const SVG_PNP = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-40" y1="0" x2="-16.868887" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-16.868887" y1="-13.333557" x2="-16.868887" y2="13.34159" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></line><polyline points="-8.575018,-9.694413 0,-13.379732 0,-30" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polyline points="-16.868887,6.401526 0,13.377859 0,30" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-10.233792,-12.987299 -6.916244,-6.401526 -16.868887,-6.401526" fill="#000" stroke="none"></polygon></g>`;

  const SVG_RES = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><path d="M 0 -20 L 0 -8.72093 L 5.372093 -6.395349 L -4.604651 -4.069767 L 5.372093 -1.162791 L -4.988372 1.744186 L 5.372093 4.651163 L -4.604651 7.55814 L 0 8.72093 L 0 20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="12"></path></g>`;

  const SVG_VAR_RES = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><path d="M 0 -20 L 0 -8.72093 L 5.372093 -6.395349 L -4.604651 -4.069767 L 5.372093 -1.162791 L -4.988372 1.744186 L 5.372093 4.651163 L -4.604651 7.55814 L 0 8.72093 L 0 20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="12"></path><line x1="-12" y1="12" x2="9" y2="-9" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="12,-12 6,-10 10,-6" fill="#000" stroke="none"></polygon></g>`;

  const SVG_CAP = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="8.05064" y1="-3.233605" x2="-8.05064" y2="-3.233605" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="8.05064" y1="3.233605" x2="-8.05064" y2="3.233605" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="0" y1="-3.233605" x2="0" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="0" y1="3.233605" x2="0" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_VAR_CAP = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="8.05064" y1="-3.233605" x2="-8.05064" y2="-3.233605" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="8.05064" y1="3.233605" x2="-8.05064" y2="3.233605" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="0" y1="-3.233605" x2="0" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="0" y1="3.233605" x2="0" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-12" y1="12" x2="9" y2="-9" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="12,-12 6,-10 10,-6" fill="#000" stroke="none"></polygon></g>`;

  const SVG_IND = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><path d="M 0 -20 L 0 -19.4953 C 0 -19.4953 0 -19.4953 0 -18.2174 C 0 -16.9409 0 -14.3851 0 -13.1087 C 0 -11.8308 0 -11.8308 0 -11.8308 C 0 -11.8308 0 -11.8308 1.2452 -11.5749 C 2.4889 -11.319 4.9763 -10.8087 6.1873 -9.7867 C 7.3983 -8.7647 7.3313 -7.2323 4.8439 -6.2088 C 2.355 -5.1868 -2.5543 -4.6765 -5.009 -5.4427 C -7.4637 -6.2088 -7.4637 -8.2544 -4.9763 -8.7201 C -2.4874 -9.1872 2.4889 -8.0759 5.0209 -6.3874 C 7.5545 -4.6988 7.6422 -2.4331 5.1548 -0.9439 C 2.6659 0.5437 -2.3996 1.2549 -4.9317 0.5884 C -7.4637 -0.0781 -7.4637 -2.1222 -4.9317 -2.6325 C -2.3996 -3.1442 2.6659 -2.1222 5.1325 -0.456 C 7.5991 1.2102 7.4652 3.5206 4.9317 5.0544 C 2.3996 6.5867 -2.532 7.3425 -4.9986 6.6983 C -7.4637 6.0541 -7.4637 4.01 -4.9986 3.3763 C -2.532 2.744 2.3996 3.5206 4.8885 4.7985 C 7.3759 6.0764 7.4205 7.8542 6.1992 8.9983 C 4.9763 10.1423 2.4889 10.6525 1.2452 10.9084 C 0 11.1643 0 11.1643 0 11.1643 C 0 11.1643 0 11.1643 0 12.5523 C 0 13.9403 0 16.7178 0 18.1073 C 0 19.4953 0 19.4953 0 19.4953 L 0 20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="round"></path></g>`;

  const SVG_VAR_IND = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><path d="M 0 -20 L 0 -19.4953 C 0 -19.4953 0 -19.4953 0 -18.2174 C 0 -16.9409 0 -14.3851 0 -13.1087 C 0 -11.8308 0 -11.8308 0 -11.8308 C 0 -11.8308 0 -11.8308 1.2452 -11.5749 C 2.4889 -11.319 4.9763 -10.8087 6.1873 -9.7867 C 7.3983 -8.7647 7.3313 -7.2323 4.8439 -6.2088 C 2.355 -5.1868 -2.5543 -4.6765 -5.009 -5.4427 C -7.4637 -6.2088 -7.4637 -8.2544 -4.9763 -8.7201 C -2.4874 -9.1872 2.4889 -8.0759 5.0209 -6.3874 C 7.5545 -4.6988 7.6422 -2.4331 5.1548 -0.9439 C 2.6659 0.5437 -2.3996 1.2549 -4.9317 0.5884 C -7.4637 -0.0781 -7.4637 -2.1222 -4.9317 -2.6325 C -2.3996 -3.1442 2.6659 -2.1222 5.1325 -0.456 C 7.5991 1.2102 7.4652 3.5206 4.9317 5.0544 C 2.3996 6.5867 -2.532 7.3425 -4.9986 6.6983 C -7.4637 6.0541 -7.4637 4.01 -4.9986 3.3763 C -2.532 2.744 2.3996 3.5206 4.8885 4.7985 C 7.3759 6.0764 7.4205 7.8542 6.1992 8.9983 C 4.9763 10.1423 2.4889 10.6525 1.2452 10.9084 C 0 11.1643 0 11.1643 0 11.1643 C 0 11.1643 0 11.1643 0 12.5523 C 0 13.9403 0 16.7178 0 18.1073 C 0 19.4953 0 19.4953 0 19.4953 L 0 20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="round"></path><line x1="-12" y1="12" x2="9" y2="-9" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="12,-12 6,-10 10,-6" fill="#000" stroke="none"></polygon></g>`;

  const SVG_TRANSFORMER = `<g fill="none" stroke="currentColor" stroke-linejoin="round"><path d="M -20 -20 H -14 V -12 C -4 -12 -4 -4 -14 -4 C -4 -4 -4 4 -14 4 C -4 4 -4 12 -14 12 V 20 H -20" stroke-width="1.6"/><path d="M 20 -20 H 14 V -12 C 4 -12 4 -4 14 -4 C 4 -4 4 4 14 4 C 4 4 4 12 14 12 V 20 H 20" stroke-width="1.6"/><circle cx="-9" cy="-17" r="1.8" fill="currentColor" stroke="none"/><circle cx="9" cy="-17" r="1.8" fill="currentColor" stroke="none"/><g fill="currentColor" stroke="none" font-family="Times New Roman,serif" font-style="italic" text-anchor="middle"><text x="0" y="-25" font-size="10">k</text><text x="-14" y="29" font-size="9">L<tspan baseline-shift="sub" font-size="76%">p</tspan></text><text x="14" y="29" font-size="9">L<tspan baseline-shift="sub" font-size="76%">s</tspan></text></g></g>`;

  const SVG_DIODE = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-20" y1="0" x2="-8.333334" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="-8.333334,-6.75 -8.333334,6.75 5.833334,0" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polygon><line x1="6.666666" y1="-7.333334" x2="6.666666" y2="7.333334" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="6.666666" y1="0" x2="20" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_VDD = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="0" y1="20" x2="0" y2="1.5" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="-10,-0.88 10,-0.88 10,2.36 -10,2.36" fill="#000" stroke="none"></polygon></g>`;

  const SVG_GND = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="0" y1="-10" x2="0" y2="-2" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-8" y1="-2" x2="8" y2="-2" stroke-width="2.906977" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-5.2" y1="2" x2="5.2" y2="2" stroke-width="2.906977" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-2.8" y1="6" x2="2.8" y2="6" stroke-width="2.906977" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_PIN = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><circle cx="-7.086614" cy="0" r="2.47907" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="10" y1="0" x2="-4.607544" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_PIN_DOT = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><circle cx="-7.086614" cy="0" r="2.47907" fill="#000" stroke="#000" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="10" y1="0" x2="-4.607544" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_V_SRC = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><circle cx="0" cy="0" r="10.755814" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="-3.5" y1="-4.5" x2="3.5" y2="-4.5" stroke-width="1.6" stroke-linecap="butt"></line><line x1="0" y1="-8" x2="0" y2="-1" stroke-width="1.6" stroke-linecap="butt"></line><line x1="-3.5" y1="4.5" x2="3.5" y2="4.5" stroke-width="1.6" stroke-linecap="butt"></line><line x1="0" y1="-10.755814" x2="0" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="0" y1="10.755814" x2="0" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_I_SRC = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><circle cx="0" cy="0" r="10.755814" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="0" y1="-6.976744" x2="0" y2="-2.325581" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="0,6.976744 -4.651163,-2.325581 4.651163,-2.325581" fill="#000" stroke="none"></polygon><line x1="0" y1="-10.755814" x2="0" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="0" y1="10.755814" x2="0" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_SW_CLOSED = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="0" x2="-13.562064" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><circle cx="-10.36318" cy="0" r="3.198884" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="-7.186611" y1="-1.496234" x2="13.608926" y2="-4.694003" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><circle cx="10.36318" cy="0" r="3.198884" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="13.562064" y1="0" x2="30" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_SW_OPEN = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="0" x2="-12.726917" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><circle cx="-9.524128" cy="-0.020084" r="3.202789" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="-6.953731" y1="-2.417959" x2="6.405579" y2="-12.806695" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><circle cx="11.201116" cy="-0.020084" r="3.202232" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></circle><line x1="14.403348" y1="0" x2="30" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_NDMOS = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><polyline points="-4.244186,-6.976744 10,-6.976744 10,-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-11.802326,-9.593023 -11.802326,9.593023 -8.895349,9.593023 -8.895349,-9.593023" fill="#000" stroke="none"></polygon><polygon points="-6.569767,-12.5 -6.569767,12.5 -3.662791,12.5 -3.662791,-12.5" fill="#000" stroke="none"></polygon><line x1="-8.895349" y1="0" x2="-20" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polyline points="-4.244186,-2.976744 10,-2.976744 10,-6.976744" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polyline points="-3.662791,6.976744 10,6.976744 10,20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="10.581395,6.976744 1.27907,2.906977 1.27907,11.046512" fill="#000" stroke="none"></polygon></g>`;

  const SVG_PDMOS = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><polyline points="-4.244186,6.976744 10,6.976744 10,20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-11.802326,-9.593023 -11.802326,9.593023 -8.895349,9.593023 -8.895349,-9.593023" fill="#000" stroke="none"></polygon><polygon points="-6.569767,-12.5 -6.569767,12.5 -3.662791,12.5 -3.662791,-12.5" fill="#000" stroke="none"></polygon><line x1="-8.895349" y1="0" x2="-20" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polyline points="-4.244186,2.976744 10,2.976744 10,6.976744" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polyline points="5.639535,-7.122093 10,-7.122093 10,-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline><polygon points="-3.662791,-7.122093 5.639535,-11.19186 5.639535,-3.052326" fill="#000" stroke="none"></polygon></g>`;

  const SVG_CIRCLE_ANNO = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><circle cx="0" cy="0" r="14" fill="none" stroke="#000"></circle></g>`;

  const SVG_ARROW_ANNO = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-18" y1="0" x2="13" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="20,0 12,-5 12,5" fill="#000" stroke="none"></polygon></g>`;


  const SVG_RECT_ANNO = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><polyline points="-18,-12 18,-12 18,12 -18,12 -18,-12" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></polyline></g>`;

  const SVG_OPAMP = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-50" y1="-10" x2="-26.952962" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-50" y1="10" x2="-26.797909" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="23.202091" y1="0" x2="40" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -26.7979 -24.9983 L -26.7979 25 L 23.2021 0 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="-18.047038" y1="8.749129" x2="-18.047038" y2="16.249129" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-21.796167" y1="12.5" x2="-14.296167" y2="12.5" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-21.796167" y1="-12.5" x2="-14.296167" y2="-12.5" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_COMP = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-50" y1="-10" x2="-26.952962" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-50" y1="10" x2="-26.797909" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="23.202091" y1="0" x2="40" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -26.7979 -24.9983 L -26.7979 25 L 23.2021 0 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="-18.047038" y1="8.749129" x2="-18.047038" y2="16.249129" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-21.796167" y1="12.5" x2="-14.296167" y2="12.5" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-21.796167" y1="-12.5" x2="-14.296167" y2="-12.5" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -8 7 L 0 7 L 0 -7 L 8 -7" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></path></g>`;

  const SVG_COMP_U = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-50" y1="-10" x2="-26.952962" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-50" y1="10" x2="-26.797909" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="23.202091" y1="0" x2="40" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -26.7979 -24.9983 L -26.7979 25 L 23.2021 0 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="-18.047038" y1="-8.749129" x2="-18.047038" y2="-16.249129" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-21.796167" y1="-12.5" x2="-14.296167" y2="-12.5" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-21.796167" y1="12.5" x2="-14.296167" y2="12.5" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -8 7 L 0 7 L 0 -7 L 8 -7" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></path></g>`;

  const SVG_FD_AMP = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-50" y1="-20" x2="-37.9479" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-50" y1="20" x2="-37.9479" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-13.468439157806387" y1="-20" x2="10" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-13.461716017666415" y1="20" x2="10" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -36.7979 -29.998821 L -36.7979 30.000521 L 33.2021 0.002622 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="-30.653576579339017" y1="18.391246526265867" x2="-30.653576579339017" y2="13.034150200001143" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-33.332849726715" y1="15.713321223835566" x2="-27.975754829029867" y2="15.713321223835566" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-33.33305067844888" y1="-15.713815502660013" x2="-27.97595578076375" y2="-15.713815502660013" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-20.61807623763181" y1="-15.713321223835566" x2="-15.26222563277121" y2="-15.713321223835566" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-17.93987471670441" y1="13.037135921633837" x2="-17.93987471670441" y2="18.394232247898557" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-20.618578581937502" y1="15.713815502660013" x2="-15.262727977076901" y2="15.713815502660013" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_FD_AMP_X = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-50" y1="-20" x2="-37.9479" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-50" y1="20" x2="-37.9479" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-13.468439157806387" y1="-20" x2="10" y2="-20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-13.461716017666415" y1="20" x2="10" y2="20" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -36.7979 -29.998821 L -36.7979 30.000521 L 33.2021 0.002622 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="-30.653576579339017" y1="18.391246526265867" x2="-30.653576579339017" y2="13.034150200001143" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-33.332849726715" y1="15.713321223835566" x2="-27.975754829029867" y2="15.713321223835566" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-33.33305067844888" y1="-15.713815502660013" x2="-27.97595578076375" y2="-15.713815502660013" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-20.61807623763181" y1="15.713321223835566" x2="-15.26222563277121" y2="15.713321223835566" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-17.93987471670441" y1="-13.037135921633837" x2="-17.93987471670441" y2="-18.394232247898557" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-20.618578581937502" y1="-15.713815502660013" x2="-15.262727977076901" y2="-15.713815502660013" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_V_AMP = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-40" y1="0" x2="-23.63" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -23.63 -28.62 L -23.63 28.62 L 23.63 0 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter"></path><line x1="23.63" y1="0" x2="40" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_INV = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="0" x2="-14.727526" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M 9.023455 0.0 L -14.727526 -15.000436 L -14.727526 13.748365 L 9.023455 0.0" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><circle cx="12.794489" cy="0.009591" r="3.750109" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></circle><line x1="16.525416" y1="0" x2="30" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_BUF = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="0" x2="-14.727526" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M 9.022751 -0.0 L -14.727526 14.998936 L -14.727526 -13.749865 L 9.022751 -0.0" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="9.022751" y1="0" x2="20" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_AND = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="-10" x2="-19.218764" y2="-9.999128" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-30" y1="10" x2="-19.218764" y2="9.999128" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M 0.155201 -15.077165 L -18.906618 -15.077165 L -18.906618 14.921964 L -1.016654 14.921964" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><path d="M 0.155201 -15.234109 C 0.155201 -15.234109 0.155201 -15.234109 0.312146 -15.194001 C 0.467347 -15.155637 0.781236 -15.077165 0.936437 -15.0388 C 1.093382 -14.998692 1.093382 -14.998692 1.769989 -14.895806 C 2.446595 -14.791176 3.801552 -14.58366 5.011771 -14.231406 C 6.223734 -13.879152 7.290958 -13.385648 8.450606 -12.590461 C 9.60851 -11.797018 10.858837 -10.701892 11.821432 -9.556195 C 12.78577 -8.410498 13.462377 -7.21423 13.983782 -5.988316 C 14.505188 -4.764147 14.869649 -3.515564 15.064958 -2.212922 C 15.260267 -0.912024 15.286424 0.442933 15.155637 1.707211 C 15.02485 2.969745 14.738861 4.141599 14.205249 5.43029 C 13.671637 6.718982 12.8904 8.126253 11.992327 9.284157 C 11.094254 10.443805 10.0776 11.354085 9.244049 12.030691 C 8.410498 12.709042 7.760049 13.153719 7.069492 13.502485 C 6.378935 13.854739 5.650013 14.116314 4.999564 14.323829 C 4.347371 14.533089 3.775395 14.690034 3.26794 14.777226 C 2.758741 14.869649 2.317552 14.89755 1.860668 14.909757 C 1.405528 14.921964 0.936437 14.921964 0.442933 14.921964 C -0.052315 14.921964 -0.57372 14.921964 -0.833551 14.921964 C -1.095126 14.921964 -1.095126 14.921964 -1.095126 14.921964" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="15.781672" y1="0" x2="30" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_NAND = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-40" y1="-10" x2="-23.437963" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-40" y1="10" x2="-23.437963" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -4.531345 15.07978 L -23.125817 15.07978 L -23.125817 -14.921092 L -5.234109 -14.921092" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><path d="M -4.609818 15.07978 C -4.609818 15.07978 -4.609818 15.07978 -4.362194 15.06583 C -4.11457 15.051879 -3.619322 15.025722 -3.371698 15.013515 C -3.124074 15.001308 -3.124074 15.001308 -2.447467 14.894934 C -1.770861 14.792048 -0.417648 14.582788 0.792571 14.234022 C 2.004534 13.880024 3.073502 13.38652 4.23315 12.591333 C 5.391054 11.79789 6.641381 10.704508 7.603976 9.558811 C 8.566571 8.413114 9.244921 7.213358 9.766327 5.990932 C 10.285988 4.766763 10.652193 3.516436 10.847502 2.213794 C 11.041067 0.911152 11.068969 -0.442061 10.936437 -1.706339 C 10.807394 -2.968873 10.523149 -4.140727 9.986049 -5.429418 C 9.452437 -6.71811 8.671201 -8.125381 7.773128 -9.283285 C 6.875054 -10.442933 5.860145 -11.354957 5.026593 -12.031563 C 4.193042 -12.70817 3.542593 -13.151103 2.85378 -13.503357 C 2.159735 -13.853867 1.434301 -14.115442 0.780364 -14.322958 C 0.131659 -14.530473 -0.442061 -14.687418 -0.949516 -14.778097 C -1.458715 -14.870521 -1.901648 -14.894934 -2.356788 -14.908885 C -2.811928 -14.921092 -3.281018 -14.921092 -3.776266 -14.921092 C -4.269771 -14.921092 -4.791176 -14.921092 -5.052751 -14.921092 C -5.312582 -14.921092 -5.312582 -14.921092 -5.312582 -14.921092" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><circle cx="16.52716" cy="0.010463" r="3.375185" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></circle><line x1="19.531781" y1="0.000872" x2="30" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_OR = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="-10" x2="-17.782719" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-30" y1="10" x2="-18.094864" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M 13.410934 0.002616 C 13.410934 0.002616 13.410934 0.002616 11.027117 2.213794 C 8.643299 4.426715 3.875665 8.849071 -2.083006 11.829279 C -8.043421 14.809486 -15.196617 16.345802 -18.771471 17.114831 C -22.346325 17.882117 -22.346325 17.882117 -22.346325 17.882117 C -22.346325 17.882117 -22.346325 17.882117 -20.485657 14.786817 C -18.621501 11.689772 -14.896678 5.497428 -14.896678 -0.438574 C -14.896678 -6.374575 -18.621501 -12.055977 -20.485657 -14.896678 C -22.346325 -17.735635 -22.346325 -17.735635 -22.346325 -17.735635 C -22.346325 -17.735635 -22.346325 -17.735635 -18.771471 -16.991019 C -15.196617 -16.246403 -8.043421 -14.757172 -2.083006 -11.799634 C 3.875665 -8.84384 8.643299 -4.41974 11.027117 -2.208562 C 13.410934 0.002616 13.410934 0.002616 13.410934 0.002616" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="13.410934" y1="0.002616" x2="30" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_NOR = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="-10" x2="-17.782719" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-30" y1="10" x2="-18.094864" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M 13.410934 0.002616 C 13.410934 0.002616 13.410934 0.002616 11.027117 2.213794 C 8.643299 4.426715 3.875665 8.849071 -2.083006 11.829279 C -8.043421 14.809486 -15.196617 16.345802 -18.771471 17.114831 C -22.346325 17.882117 -22.346325 17.882117 -22.346325 17.882117 C -22.346325 17.882117 -22.346325 17.882117 -20.485657 14.786817 C -18.621501 11.689772 -14.896678 5.497428 -14.896678 -0.438574 C -14.896678 -6.374575 -18.621501 -12.055977 -20.485657 -14.896678 C -22.346325 -17.735635 -22.346325 -17.735635 -22.346325 -17.735635 C -22.346325 -17.735635 -22.346325 -17.735635 -18.771471 -16.991019 C -15.196617 -16.246403 -8.043421 -14.757172 -2.083006 -11.799634 C 3.875665 -8.84384 8.643299 -4.41974 11.027117 -2.208562 C 13.410934 0.002616 13.410934 0.002616 13.410934 0.002616" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><circle cx="17.617055" cy="-0.121196" r="3.374313" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></circle><line x1="20.818729" y1="0.002616" x2="30" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_XOR = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="-10" x2="-14.420612" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-30" y1="10" x2="-14.106722" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M 23.63676 0.002616 C 23.63676 0.002616 23.63676 0.002616 21.252943 2.213794 C 18.869125 4.424972 14.101491 8.849071 8.141076 11.829279 C 2.182405 14.807743 -4.969047 16.344058 -8.545645 17.113087 C -12.122243 17.880373 -12.122243 17.880373 -12.122243 17.880373 C -12.122243 17.880373 -12.122243 17.880373 -10.259831 14.785073 C -8.397419 11.689772 -4.672596 5.497428 -4.672596 -0.440317 C -4.672596 -6.376319 -8.397419 -12.057721 -10.259831 -14.896678 C -12.122243 -17.737379 -12.122243 -17.737379 -12.122243 -17.737379 C -12.122243 -17.737379 -12.122243 -17.737379 -8.545645 -16.992763 C -4.969047 -16.248147 2.182405 -14.757172 8.141076 -11.801378 C 14.101491 -8.84384 18.869125 -4.421484 21.252943 -2.210306 C 23.63676 0.002616 23.63676 0.002616 23.63676 0.002616" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><path d="M -18.651147 -17.735635 C -18.651147 -17.735635 -18.651147 -17.735635 -16.828843 -14.910629 C -15.004796 -12.083878 -11.360188 -6.432121 -11.346238 -0.482169 C -11.334031 5.467783 -14.954224 11.717674 -16.762577 14.842619 C -18.572674 17.969309 -18.572674 17.969309 -18.572674 17.969309" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="23.63676" y1="0" x2="40" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_XNOR = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-30" y1="-10" x2="-14.420612" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-30" y1="10" x2="-14.106722" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M 23.63676 0.002616 C 23.63676 0.002616 23.63676 0.002616 21.252943 2.213794 C 18.869125 4.424972 14.101491 8.849071 8.141076 11.829279 C 2.182405 14.807743 -4.969047 16.344058 -8.545645 17.113087 C -12.122243 17.880373 -12.122243 17.880373 -12.122243 17.880373 C -12.122243 17.880373 -12.122243 17.880373 -10.259831 14.785073 C -8.397419 11.689772 -4.672596 5.497428 -4.672596 -0.440317 C -4.672596 -6.376319 -8.397419 -12.057721 -10.259831 -14.896678 C -12.122243 -17.737379 -12.122243 -17.737379 -12.122243 -17.737379 C -12.122243 -17.737379 -12.122243 -17.737379 -8.545645 -16.992763 C -4.969047 -16.248147 2.182405 -14.757172 8.141076 -11.801378 C 14.101491 -8.84384 18.869125 -4.421484 21.252943 -2.210306 C 23.63676 0.002616 23.63676 0.002616 23.63676 0.002616" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><path d="M -18.651147 -17.735635 C -18.651147 -17.735635 -18.651147 -17.735635 -16.828843 -14.910629 C -15.004796 -12.083878 -11.360188 -6.432121 -11.346238 -0.482169 C -11.334031 5.467783 -14.954224 11.717674 -16.762577 14.842619 C -18.572674 17.969309 -18.572674 17.969309 -18.572674 17.969309" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><circle cx="27.842881" cy="0.002616" r="3.374313" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></circle><line x1="31.217194" y1="0.002616" x2="40" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g>`;

  const SVG_DFF = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-40" y1="-10" x2="-25.000855" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="-40" y1="10" x2="-25.000855" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -25.000855 -25.0 L 25.000855 -25.0 L 25.000855 25.0 L -25.000855 25.0 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="25.000855" y1="-10" x2="40" y2="-10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="25.000855" y1="10" x2="40" y2="10" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><line x1="13.687" y1="4.24947" x2="22.354168" y2="4.24947" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line></g><g fill="currentColor" stroke="none" style="font-family: 'DejaVu Sans', Arial, 'Helvetica Neue', Helvetica, sans-serif;"><text data-pin-name="D" x="-21" y="-6" text-anchor="start" font-size="10.28"><tspan style="font-style:italic;font-weight:700">D</tspan></text><text data-pin-name="CK" x="-21" y="14" text-anchor="start" font-size="10.28"><tspan style="font-style:italic;font-weight:700">CK</tspan></text><text data-pin-name="Q" x="21" y="-6" text-anchor="end" font-size="10.28"><tspan style="font-style:italic;font-weight:700">Q</tspan></text><text data-pin-name="QBAR" x="21" y="14" text-anchor="end" font-size="10.28"><tspan style="font-style:italic;font-weight:700">Q\u0305</tspan></text></g>`;

  const SVG_DELAY = `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><line x1="-40" y1="0" x2="-24" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><path d="M -24 -12 L 24 -12 L 24 12 L -24 12 Z" stroke-width="2.4" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"></path><line x1="24" y1="0" x2="40" y2="0" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"></line><polygon points="-0.951005,-3.867967 -1.48366,-1.398387 -4.606953,5.332432 -5.551205,6.034567" fill="#000" stroke="none"></polygon><polygon points="-0.951005,-3.867967 3.092327,6.034567 1.300671,5.332432 -1.48366,-1.398387" fill="#000" stroke="none"></polygon><polygon points="-5.551205,6.034567 -4.606953,5.332432 1.300671,5.332432 3.092327,6.034567" fill="#000" stroke="none"></polygon><polygon points="6.610361,4.848793 4.842916,4.848793 6.319823,-2.293621 3.801819,-2.293621 4.116569,-3.722104 10.871599,-3.722104 10.581059,-2.293621 8.087267,-2.293621" fill="#000" stroke="none"></polygon></g>`;

  // ============================================================
  // Component definitions
  // Pin positions = 2x website coordinates (all on 20px grid)
  // ============================================================

  const defs = [];

  // --- Transistors ---
  defs.push({ id: "nmos", name: "NMOS", category: "Transistors", prefix: "M",
    defaultParams: { W: "10u", L: "1u", model: "nch" },
    pins: [{ name: "G", x: -40, y: 0 }, { name: "D", x: 20, y: -40 }, { name: "S", x: 20, y: 40 }],
    draw(g) { rawSVG(g, SVG_NMOS); } });

  defs.push({ id: "pmos", name: "PMOS", category: "Transistors", prefix: "M",
    defaultParams: { W: "10u", L: "1u", model: "pch" },
    pins: [{ name: "G", x: -40, y: 0 }, { name: "S", x: 20, y: -40 }, { name: "D", x: 20, y: 40 }],
    draw(g) { rawSVG(g, SVG_PMOS); } });

  defs.push({ id: "npn", name: "NPN", category: "Transistors", prefix: "Q",
    defaultParams: { model: "npn" },
    pins: [{ name: "B", x: -80, y: 0 }, { name: "C", x: 0, y: -60 }, { name: "E", x: 0, y: 60 }],
    draw(g) { rawSVG(g, SVG_NPN); } });

  defs.push({ id: "pnp", name: "PNP", category: "Transistors", prefix: "Q",
    defaultParams: { model: "pnp" },
    pins: [{ name: "B", x: -80, y: 0 }, { name: "E", x: 0, y: -60 }, { name: "C", x: 0, y: 60 }],
    draw(g) { rawSVG(g, SVG_PNP); } });

  // --- Passives ---
  defs.push({ id: "res", name: "Res", category: "Passives", prefix: "R",
    defaultParams: { value: "1k" },
    pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_RES); } });

  defs.push({ id: "var_res", name: "Var Res", category: "Passives", prefix: "R",
    defaultParams: { value: "10k" },
    pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_VAR_RES); } });

  defs.push({ id: "cap", name: "Cap", category: "Passives", prefix: "C",
    defaultParams: { value: "1p" },
    pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_CAP); } });

  defs.push({ id: "var_cap", name: "Var Cap", category: "Passives", prefix: "C",
    defaultParams: { value: "5p" },
    pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_VAR_CAP); } });

  defs.push({ id: "ind", name: "Ind", category: "Passives", prefix: "L",
    defaultParams: { value: "1n" },
    pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_IND); } });

  defs.push({ id: "var_ind", name: "Var Ind", category: "Passives", prefix: "L",
    defaultParams: { value: "10n" },
    pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_VAR_IND); } });

  defs.push({ id: "xfmr", name: "Transformer", category: "Passives", prefix: "T",
    defaultParams: { Lp: "1n", Ls: "1n", k: "0.9" },
    pins: [
      { name: "P1", x: -40, y: -40 }, { name: "P2", x: -40, y: 40 },
      { name: "S1", x: 40, y: -40 }, { name: "S2", x: 40, y: 40 },
    ],
    draw(g) { rawSVG(g, SVG_TRANSFORMER); } });

  defs.push({ id: "diode", name: "Diode", category: "Passives", prefix: "D",
    defaultParams: { model: "dio" },
    pins: [{ name: "A", x: -40, y: 0 }, { name: "K", x: 40, y: 0 }],
    draw(g) { rawSVG(g, SVG_DIODE); } });

  // --- Power and Ports ---
  defs.push({ id: "vdd", name: "VDD", category: "Power and Ports", prefix: "V",
    defaultParams: { value: "VDD", net: "vdd" },
    pins: [{ name: "1", x: 0, y: 40 }], isPort: true,
    draw(g) { rawSVG(g, SVG_VDD); } });

  defs.push({ id: "gnd", name: "Ground", category: "Power and Ports", prefix: "V",
    defaultParams: { value: "0", net: "gnd" },
    pins: [{ name: "1", x: 0, y: -20 }], isPort: true,
    draw(g) { rawSVG(g, SVG_GND); } });

  defs.push({ id: "pin", name: "Pin", category: "Power and Ports", prefix: "P",
    defaultParams: { net: "net" },
    pins: [{ name: "1", x: 20, y: 0 }], isPort: true,
    draw(g) { rawSVG(g, SVG_PIN); } });

  defs.push({ id: "pin_dot", name: "Pin•", category: "Power and Ports", prefix: "P",
    defaultParams: { net: "net" },
    pins: [{ name: "1", x: 20, y: 0 }], isPort: true,
    draw(g) { rawSVG(g, SVG_PIN_DOT); } });

  // --- Sources ---
  defs.push({ id: "v_src", name: "V Src", category: "Sources", prefix: "V",
    defaultParams: { value: "1V", type: "dc" },
    pins: [{ name: "+", x: 0, y: -40 }, { name: "-", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_V_SRC); } });

  defs.push({ id: "i_src", name: "I Src", category: "Sources", prefix: "I",
    defaultParams: { value: "10u", type: "dc" },
    pins: [{ name: "+", x: 0, y: -40 }, { name: "-", x: 0, y: 40 }],
    draw(g) { rawSVG(g, SVG_I_SRC); } });

  // --- Small-signal equivalents: original artwork, not website extracts. ---
  function drawDependent(g, voltage) {
    const output = voltage
      ? '<path d="M -3 -6 H 3 M 0 -9 V -3 M -3 6 H 3" stroke-width="1.6"/>'
      : '<path d="M 0 -8 V 7" stroke-width="1.6"/><polygon points="0,10 -3,4 3,4" fill="#000" stroke="none"/>';
    rawSVG(g, `<g fill="none" stroke="#000" stroke-linejoin="miter"><path d="M 0 -30 V -15 M 0 15 V 30" stroke-width="1.6"/><path d="M 0 -15 L 12 0 L 0 15 L -12 0 Z" stroke-width="1.6"/>${output}</g>`);
  }
  defs.push({ id: "gm", name: "gm · vgs", category: "Small Signal", prefix: "G",
    defaultParams: { gm: "1m", display: "g_m v_gs", controlPositive: "", controlNegative: "" },
    pins: [{ name: "D", x: 0, y: -60 }, { name: "S", x: 0, y: 60 }],
    draw(g) { drawDependent(g, false); } });
  defs.push({ id: "vccs", name: "VCCS", category: "Small Signal", prefix: "G",
    defaultParams: { gm: "1m", display: "g_m v_ctrl", controlPositive: "", controlNegative: "0" },
    pins: [{ name: "out+", x: 0, y: -60 }, { name: "out-", x: 0, y: 60 }],
    draw(g) { drawDependent(g, false); } });
  defs.push({ id: "vcvs", name: "VCVS", category: "Small Signal", prefix: "E",
    defaultParams: { gain: "10", display: "A_v v_ctrl", controlPositive: "", controlNegative: "0" },
    pins: [{ name: "out+", x: 0, y: -60 }, { name: "out-", x: 0, y: 60 }],
    draw(g) { drawDependent(g, true); } });
  for (const [id, name, prefix, value, display, artwork] of [
    ["ro", "ro", "R", "100k", "r_o", SVG_RES],
    ["rpi", "rπ", "R", "10k", "r_π", SVG_RES],
    ["cgs", "Cgs", "C", "1p", "C_gs", SVG_CAP],
    ["cgd", "Cgd", "C", "100f", "C_gd", SVG_CAP],
  ]) defs.push({ id, name, category: "Small Signal", prefix,
    defaultParams: { value, display }, pins: [{ name: "1", x: 0, y: -40 }, { name: "2", x: 0, y: 40 }],
    draw(g) { rawSVG(g, artwork); } });

  // --- Switches ---
  defs.push({ id: "sw_closed", name: "Closed", category: "Switches", prefix: "S",
    defaultParams: { value: "closed" },
    pins: [{ name: "1", x: -60, y: 0 }, { name: "2", x: 60, y: 0 }],
    draw(g) { rawSVG(g, SVG_SW_CLOSED); } });

  defs.push({ id: "sw_open", name: "Open", category: "Switches", prefix: "S",
    defaultParams: { value: "open" },
    pins: [{ name: "1", x: -60, y: 0 }, { name: "2", x: 60, y: 0 }],
    draw(g) { rawSVG(g, SVG_SW_OPEN); } });

  // --- Analog Blocks ---
  defs.push({ id: "opamp", name: "OpAmp", category: "Analog Blocks", prefix: "X",
    defaultParams: { model: "opamp" },
    pins: [{ name: "IN+", x: -100, y: 20 }, { name: "IN-", x: -100, y: -20 }, { name: "OUT", x: 80, y: 0 }],
    draw(g) { rawSVG(g, SVG_OPAMP); } });

  defs.push({ id: "comp", name: "Comp", category: "Analog Blocks", prefix: "X",
    defaultParams: { model: "comp" },
    pins: [{ name: "IN+", x: -100, y: 20 }, { name: "IN-", x: -100, y: -20 }, { name: "OUT", x: 80, y: 0 }],
    draw(g) { rawSVG(g, SVG_COMP); } });

  defs.push({ id: "comp_u", name: "Comp U", category: "Analog Blocks", prefix: "X",
    defaultParams: { model: "comp_u" },
    pins: [{ name: "IN+", x: -100, y: -20 }, { name: "IN-", x: -100, y: 20 }, { name: "OUT", x: 80, y: 0 }],
    draw(g) { rawSVG(g, SVG_COMP_U); } });

  defs.push({ id: "fd_amp", name: "FD Amp", category: "Analog Blocks", prefix: "X",
    defaultParams: { model: "fd_amp" },
    pins: [{ name: "IN+", x: -100, y: 40 }, { name: "IN-", x: -100, y: -40 }, { name: "OUT+", x: 20, y: 40 }, { name: "OUT-", x: 20, y: -40 }],
    draw(g) { rawSVG(g, SVG_FD_AMP); } });

  defs.push({ id: "fd_amp_x", name: "FD Amp X", category: "Analog Blocks", prefix: "X",
    defaultParams: { model: "fd_amp_x" },
    pins: [{ name: "IN+", x: -100, y: 40 }, { name: "IN-", x: -100, y: -40 }, { name: "OUT+", x: 20, y: -40 }, { name: "OUT-", x: 20, y: 40 }],
    draw(g) { rawSVG(g, SVG_FD_AMP_X); } });

  defs.push({ id: "v_amp", name: "V Amp", category: "Analog Blocks", prefix: "X",
    defaultParams: { model: "v_amp", gain: "10" },
    pins: [{ name: "IN", x: -80, y: 0 }, { name: "OUT", x: 80, y: 0 }],
    draw(g) { rawSVG(g, SVG_V_AMP); } });

  // --- Logic Gates ---
  defs.push({ id: "inv", name: "Inv", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "inv" },
    pins: [{ name: "A", x: -60, y: 0 }, { name: "Y", x: 60, y: 0 }],
    draw(g) { rawSVG(g, SVG_INV); } });

  defs.push({ id: "buf", name: "Buffer", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "buf" },
    pins: [{ name: "A", x: -60, y: 0 }, { name: "Y", x: 40, y: 0 }],
    draw(g) { rawSVG(g, SVG_BUF); } });

  defs.push({ id: "and", name: "AND", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "and2" },
    pins: [{ name: "A", x: -60, y: -20 }, { name: "B", x: -60, y: 20 }, { name: "Y", x: 60, y: 0 }],
    draw(g) { rawSVG(g, SVG_AND); } });

  defs.push({ id: "nand", name: "NAND", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "nand2" },
    pins: [{ name: "A", x: -80, y: -20 }, { name: "B", x: -80, y: 20 }, { name: "Y", x: 60, y: 0 }],
    draw(g) { rawSVG(g, SVG_NAND); } });

  defs.push({ id: "or", name: "OR", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "or2" },
    pins: [{ name: "A", x: -60, y: -20 }, { name: "B", x: -60, y: 20 }, { name: "Y", x: 60, y: 0 }],
    draw(g) { rawSVG(g, SVG_OR); } });

  defs.push({ id: "nor", name: "NOR", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "nor2" },
    pins: [{ name: "A", x: -60, y: -20 }, { name: "B", x: -60, y: 20 }, { name: "Y", x: 60, y: 0 }],
    draw(g) { rawSVG(g, SVG_NOR); } });

  defs.push({ id: "xor", name: "XOR", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "xor2" },
    pins: [{ name: "A", x: -60, y: -20 }, { name: "B", x: -60, y: 20 }, { name: "Y", x: 80, y: 0 }],
    draw(g) { rawSVG(g, SVG_XOR); } });

  defs.push({ id: "xnor", name: "XNOR", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "xnor2" },
    pins: [{ name: "A", x: -60, y: -20 }, { name: "B", x: -60, y: 20 }, { name: "Y", x: 80, y: 0 }],
    draw(g) { rawSVG(g, SVG_XNOR); } });

  defs.push({ id: "dff", name: "D Flip-Flop", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "dff" },
    pins: [{ name: "D", x: -80, y: -20 }, { name: "CLK", x: -80, y: 20 }, { name: "Q", x: 80, y: -20 }, { name: "QN", x: 80, y: 20 }],
    draw(g) { rawSVG(g, SVG_DFF); } });

  defs.push({ id: "delay", name: "Delay Cell", category: "Logic Gates", prefix: "X",
    defaultParams: { model: "delay", td: "100p" },
    pins: [{ name: "A", x: -80, y: 0 }, { name: "Y", x: 80, y: 0 }],
    draw(g) { rawSVG(g, SVG_DELAY); } });

  // --- Depletion MOS (site: nmos/pmos + drift-region polyline) ---
  defs.push({ id: "ndmos", name: "NDMOS", category: "Transistors", prefix: "M",
    defaultParams: { W: "10u", L: "1u", model: "ndch" },
    pins: [{ name: "G", x: -40, y: 0 }, { name: "D", x: 20, y: -40 }, { name: "S", x: 20, y: 40 }],
    draw(g) { rawSVG(g, SVG_NDMOS); } });

  defs.push({ id: "pdmos", name: "PDMOS", category: "Transistors", prefix: "M",
    defaultParams: { W: "10u", L: "1u", model: "pdch" },
    pins: [{ name: "G", x: -40, y: 0 }, { name: "S", x: 20, y: -40 }, { name: "D", x: 20, y: 40 }],
    draw(g) { rawSVG(g, SVG_PDMOS); } });

  // --- Drawing tools exposed as library entries (like the site) ---
  defs.push({ id: "tl_arrow", name: "Arrow", category: "Drawing", tool: "arrow",
    pins: [], draw(g) { rawSVG(g, SVG_ARROW_ANNO); } });
  defs.push({ id: "tl_rect", name: "Rect", category: "Drawing", tool: "rect",
    pins: [], draw(g) { rawSVG(g, SVG_RECT_ANNO); } });
  defs.push({ id: "tl_circle", name: "Circle", category: "Drawing", tool: "circle",
    pins: [], draw(g) { rawSVG(g, SVG_CIRCLE_ANNO); } });

  // ============================================================
  // Label placement (default offsets mirror the reference board:
  // serif-italic name beside the symbol, e.g. "M1" right of a MOS)
  // off: [dx, dy] in device-local coords · anchor: start|middle|end
  // ============================================================

  const LABEL_SPECS = {
    gm:        { off: [32, 6], anchor: "start", text: "display" },
    vccs:      { off: [32, 6], anchor: "start", text: "display" },
    vcvs:      { off: [32, 6], anchor: "start", text: "display" },
    ro:        { off: [24, 6], anchor: "start", text: "display" },
    rpi:       { off: [24, 6], anchor: "start", text: "display" },
    cgs:       { off: [24, 6], anchor: "start", text: "display" },
    cgd:       { off: [24, 6], anchor: "start", text: "display" },
    nmos:      { off: [48, 22],  anchor: "start" },
    pmos:      { off: [48, 22],  anchor: "start" },
    ndmos:     { off: [48, 22],  anchor: "start" },
    pdmos:     { off: [48, 22],  anchor: "start" },
    npn:       { off: [14, 26],  anchor: "start" },
    pnp:       { off: [14, 26],  anchor: "start" },
    res:       { off: [18, 6],   anchor: "start" },
    var_res:   { off: [18, 6],   anchor: "start" },
    cap:       { off: [24, 6],   anchor: "start" },
    var_cap:   { off: [24, 6],   anchor: "start" },
    ind:       { off: [24, 6],   anchor: "start" },
    var_ind:   { off: [24, 6],   anchor: "start" },
    xfmr:      { off: [0, -76],  anchor: "middle" },
    diode:     { off: [0, 36],   anchor: "middle" },
    vdd:       { off: [40, 5],   anchor: "start", text: "value" },
    gnd:       null,
    pin:       { off: [0, -20],  anchor: "middle", text: "net" },
    pin_dot:   { off: [0, -20],  anchor: "middle", text: "net" },
    v_src:     { off: [-38, 8],  anchor: "end" },
    i_src:     { off: [-38, 8],  anchor: "end" },
    sw_closed: { off: [0, -32],  anchor: "middle" },
    sw_open:   { off: [0, -32],  anchor: "middle" },
    opamp:     { off: [0, -62],  anchor: "middle" },
    comp:      { off: [0, -62],  anchor: "middle" },
    comp_u:    { off: [0, -62],  anchor: "middle" },
    fd_amp:    { off: [0, -74],  anchor: "middle" },
    fd_amp_x:  { off: [0, -74],  anchor: "middle" },
    v_amp:     { off: [0, -70],  anchor: "middle" },
    inv:       { off: [0, -44],  anchor: "middle" },
    buf:       { off: [0, -44],  anchor: "middle" },
    and:       { off: [0, -44],  anchor: "middle" },
    nand:      { off: [0, -44],  anchor: "middle" },
    or:        { off: [0, -44],  anchor: "middle" },
    nor:       { off: [0, -44],  anchor: "middle" },
    xor:       { off: [0, -44],  anchor: "middle" },
    xnor:      { off: [0, -44],  anchor: "middle" },
    dff:       { off: [0, -46],  anchor: "middle" },
    delay:     { off: [0, -36],  anchor: "middle" },
  };

  function labelSpec(id) {
    return LABEL_SPECS[id] !== undefined ? LABEL_SPECS[id] : { off: [0, -32], anchor: "middle" };
  }

  // ============================================================
  // Library API
  // ============================================================

  const categories = [
    "Transistors", "Passives", "Power and Ports",
    "Sources", "Small Signal", "Switches", "Analog Blocks", "Logic Gates", "Drawing",
  ];

  function all() { return defs; }

  function byId(id) {
    // Compatibility for projects saved before the large inductor was removed.
    if (id === "ind_l") id = "ind";
    // Old projects retain their pin positions while using the single VDD symbol.
    if (id === "vdd_rail") id = "vdd";
    return defs.find(d => d.id === id);
  }

  function byCategory(cat) {
    return defs.filter(d => d.category === cat);
  }

  function renderPreview(id, container, opts = {}) {
    const def = byId(id);
    if (!def) return;
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    if (def.pins.length > 0) {
      for (const p of def.pins) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    } else {
      minX = -24; minY = -24; maxX = 24; maxY = 24;
    }
    const pad = 30;
    const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
    const svg = el("svg", { viewBox: vb });
    const g = el("g", { class: "dev-sym" });
    def.draw(g);
    setDeviceWireWidth(g, opts.wireWidth || 3.2);
    svg.appendChild(g);
    if (opts.scale) svg.setAttribute("width", opts.scale * (maxX - minX + pad * 2));
    container.innerHTML = "";
    container.appendChild(svg);
    return svg;
  }

  function createDevice(id, wireWidth = 3.2) {
    const def = byId(id);
    if (!def) return null;
    const g = el("g", { class: "dev", "data-id": id });
    const symG = el("g", { class: "dev-sym" });
    def.draw(symG);
    setDeviceWireWidth(symG, wireWidth);
    g.appendChild(symG);
    const lblG = el("g", { class: "dev-label" });
    g.appendChild(lblG);
    const pinG = el("g", { class: "dev-pins" });
    for (const p of def.pins) {
      const dot = el("circle", {
        class: "pin-dot", cx: p.x, cy: p.y, r: 3.5,
        "data-pin": p.name
      });
      pinG.appendChild(dot);
    }
    g.appendChild(pinG);
    return g;
  }

  function getPins(id) {
    const def = byId(id);
    return def ? def.pins : [];
  }

  function getDefaultParams(id) {
    const def = byId(id);
    return def ? { ...def.defaultParams } : {};
  }

  // Plain text notation, not executable markup: g_m v_{gs} -> SVG subscripts.
  function labelParts(text) {
    const parts = [], re = /_\{([^{}]+)\}|_([\p{L}\p{N}]+)/gu;
    let end = 0;
    for (const m of String(text).matchAll(re)) {
      if (m.index > end) parts.push({ text: text.slice(end, m.index), sub: false });
      parts.push({ text: m[1] || m[2], sub: true }); end = m.index + m[0].length;
    }
    if (end < text.length) parts.push({ text: text.slice(end), sub: false });
    return parts;
  }

  return {
    G, categories, all, byId, byCategory, labelSpec,
    renderPreview, createDevice, getPins, getDefaultParams, setDeviceWireWidth, scaleLeadMarkup, labelParts,
  };

})();
