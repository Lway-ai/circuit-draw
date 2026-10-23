// Run with playwright-cli run-code --filename scripts/browser-qa.js.
// This is a browser interaction check, not an @playwright/test dependency.
async (page) => {
  const folder = "output/browser-qa";
  const results = [];
  const check = (condition, name) => { if (!condition) throw new Error(name); results.push({ name, passed: true }); };
  // Save this disposable QA fixture so beforeunload does not interrupt the runner.
  await page.evaluate(() => document.querySelector('[data-act="save-json"]').click());
  await page.reload();
  await page.waitForFunction(() => !!App.canvas);
  check(await page.evaluate(() => {
    App.deserialize({ devices: [{ type: "vdd_rail", x: 0, y: 0, label: "VDD" }] });
    return !ComponentLib.all().some(d => d.id === "vdd_rail") && App.state.devices[0].type === "vdd";
  }), "VDD Rail removed and old project migrated");
  await page.evaluate(() => {
    App.deserialize({ name: "Interaction QA", devices: [
      { id: "dev_1", type: "res", x: 0, y: 0, label: "R1" },
      { id: "dev_2", type: "res", x: 120, y: 0, label: "R2" },
      { id: "dev_3", type: "vdd", x: 0, y: -120, label: "VDD" },
      { id: "dev_4", type: "gnd", x: 120, y: 80, label: "GND" }
    ], wires: [
      { id: "wire_5", points: [{ x: 0, y: -80 }, { x: 0, y: -40 }] },
      { id: "wire_6", points: [{ x: 0, y: 40 }, { x: 60, y: 40 }, { x: 60, y: -40 }, { x: 120, y: -40 }] },
      { id: "wire_7", points: [{ x: 120, y: 40 }, { x: 120, y: 60 }] }
    ] });
    App.fitView();
  });
  const screen = await page.evaluate(() => {
    const r = document.getElementById("canvas").getBoundingClientRect(), v = App.state.view;
    return { x: r.left + v.x, y: r.top + v.y, scale: v.scale };
  });
  await page.mouse.move(screen.x, screen.y);
  await page.mouse.down();
  await page.mouse.move(screen.x + 20 * screen.scale, screen.y + 20 * screen.scale);
  await page.mouse.move(screen.x + 40 * screen.scale, screen.y + 40 * screen.scale);
  await page.mouse.up();
  const drag = await page.evaluate(() => {
    const d = App.state.devices.find(d => d.label === "R1"), n = Netlist.getPinNets(d);
    const r = App.state.devices.find(d => d.label === "R2"), rn = Netlist.getPinNets(r);
    return { x: d.x, y: d.y, connected: n["2"] === rn["1"], pass: Netlist.checkReport().includes("PASS — 0 warning"),
      orthogonal: App.state.wires.every(w => w.points.slice(1).every((p,i) => p.x === w.points[i].x || p.y === w.points[i].y)) };
  });
  check(drag.x === 40 && drag.y === 40 && drag.connected && drag.pass && drag.orthogonal, "multi-frame real mouse drag preserves wire connectivity and orthogonality");

  const old = await page.evaluate(() => JSON.stringify(App.serialize()));
  const invalid = folder + "/invalid-import.json";
  await page.evaluate(() => { window.__lastImportError = null; window.alert = message => { window.__lastImportError = message; }; });
  await page.locator("#file-input").setInputFiles(invalid);
  await page.waitForFunction(() => !!window.__lastImportError);
  check(await page.evaluate(() => window.__lastImportError.includes("unknown electrical component")), "invalid import produces a clear error");
  check(await page.evaluate(() => JSON.stringify(App.serialize())) === old, "failed import keeps current document intact");

  const recovery = await page.evaluate(() => localStorage.getItem("schematic_canvas_autosave"));
  check(!!recovery, "editing writes a recovery copy");
  // Explicitly remove plugin snapshot parameter, so this is an ordinary fresh load.
  await page.evaluate(() => document.querySelector('[data-act="save-json"]').click());
  await page.goto(new URL(page.url()).origin + "/index.html");
  await page.waitForFunction(() => !!App.canvas);
  check(await page.evaluate(() => App.state.devices.length === 0 && !!localStorage.getItem("schematic_canvas_autosave")), "refresh starts empty and retains recovery copy");
  await page.locator("#menu-file .menu-btn").click();
  await page.locator('[data-act="restore-autosave"]').click();
  check(await page.evaluate(() => App.state.devices.length === 4 && Netlist.checkReport().includes("PASS — 0 warning")), "File menu restores editable circuit and its topology");
  await page.evaluate(() => {
    const p = App.serialize(); p.devices[0].labelOff = { x: 600, y: -500 };
    p.texts.push({ id: "txt_100", x: -300, y: 300, text: "Long label 中文 & text beyond the original canvas", fontSize: 38 });
    p.annotations.push({ id: "a_101", type: "circle", x1: 0, y1: 0, x2: 400, y2: 20 });
    p.style.gridVisible = false; App.deserialize(p);
  });
  const exported = await page.evaluate(() => {
    const svg = Exporter.buildExportSVG(), [x,y,w,h] = svg.getAttribute("viewBox").split(" ").map(Number);
    return { str: new XMLSerializer().serializeToString(svg), x,y,w,h,
      boxes: [App.gDevices,App.gTexts,App.gAnnos].map(g => { const b=g.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height}; }),
      grid: !!svg.querySelector('rect[fill="url(#exp-dots)"]') };
  });
  check(exported.boxes.every(b => b.x >= exported.x && b.y >= exported.y && b.x+b.w <= exported.x+exported.w && b.y+b.h <= exported.y+exported.h), "SVG export encompasses moved labels, long text and full circles");
  check(!exported.grid, "hidden editor grid stays hidden in SVG export");
  const svgDownloadWait = page.waitForEvent("download");
  await page.evaluate(str => { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([str],{type:"image/svg+xml"})); a.download="exported.svg"; a.click(); }, exported.str);
  await (await svgDownloadWait).saveAs(folder + "/exported.svg");
  // Download through the actual browser exporter, then inspect PNG/JPG signatures.
  for (const extension of ["png", "jpg"]) {
    const downloadWait = page.waitForEvent("download");
    await page.evaluate(ext => ext === "png" ? Exporter.exportPNG() : Exporter.exportJPG(), extension);
    const download = await downloadWait, filename = folder + "/exported." + extension;
    await download.saveAs(filename);
    check(await download.failure() === null, extension.toUpperCase() + " browser export downloads successfully");
  }
  const report = { results, count: results.length, allPassed: true };
  const reportDownload = page.waitForEvent("download");
  await page.evaluate(report => { window.__circuitQaResults = report; const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"})); a.download="results.json"; a.click(); }, report);
  await (await reportDownload).saveAs(folder + "/results.json");
  await page.screenshot({ path: folder + "/editor.png", fullPage: true });
  console.log(JSON.stringify(report,null,2));
}
