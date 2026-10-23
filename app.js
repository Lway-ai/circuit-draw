/* ============================================================
 * app.js — Schematic Canvas main application
 * Handles canvas, tools, selection, wires, properties, undo/redo
 * ============================================================ */

const App = (() => {

  const G = ComponentLib.G; // grid = 20px
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---- state ----
  const state = {
    devices: [],      // { id, type, x, y, rot, mirrorX, mirrorY, params, label, gEl }
    wires: [],        // { id, points: [{x,y}], selected, el }
    texts: [],        // { id, x, y, text, fontSize, el }
    annotations: [],  // { id, type, x1, y1, x2, y2, el }
    junctions: [],    // { id, x, y, el }
    selection: new Set(), // ids of selected items
    tool: "select",
    placeId: null,    // component id being placed
    view: { x: 0, y: 0, scale: 1 },
    history: [],
    historyIdx: -1,
    nextId: 1,
    circuitName: "New Circuit",
    gridVisible: true,
    wireWidth: 3.2,
    fontSize: 30,
    orthogonalWire: true,
  };

  // Bump this together with the ?v=NN cache-busting query in index.html.
  // Shown in the status bar so it is always obvious which build the browser
  // is actually running — otherwise a stale tab looks identical to broken code.
  const APP_VERSION = "v31";

  // ---- DOM refs ----
  let canvas, viewport, gridRect, gWires, gDevices, gAnnos, gTexts, gNodes, gOverlay;
  let canvasWrap, statusLeft, zoomLabel, propsBody, buildLabel;
  let insertDialog, insertSearch, insertList, previewSymbol, previewName;
  let textDialog, textDialogTitle, textDialogBody;
  let fileInput;
  let emptyHint;
  let promptDialog, promptSub, promptInput, promptCb = null;

  function openPrompt(title, sub, initial, cb) {
    document.getElementById("prompt-dialog-title").textContent = title;
    promptSub.textContent = sub;
    promptInput.value = initial;
    promptCb = cb;
    promptDialog.classList.remove("hidden");
    setTimeout(() => { promptInput.focus(); promptInput.select(); }, 30);
  }

  function closePrompt(result) {
    if (!promptCb) return;
    const cb = promptCb;
    promptCb = null;
    promptDialog.classList.add("hidden");
    cb(result);
  }

  // ============================================================
  // Utility
  // ============================================================

  function uid(prefix = "n") {
    return prefix + "_" + (state.nextId++);
  }

  function snap(v, grid = G) {
    return Math.round(v / grid) * grid;
  }

  function snapPt(p, grid = G) {
    return { x: snap(p.x, grid), y: snap(p.y, grid) };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // screen -> world coordinates
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - state.view.x) / state.view.scale,
      y: (sy - state.view.y) / state.view.scale,
    };
  }

  // ============================================================
  // Init
  // ============================================================

  function init() {
    // cache DOM
    canvas = document.getElementById("canvas");
    viewport = document.getElementById("viewport");
    gridRect = document.getElementById("grid-rect");
    gWires = document.getElementById("g-wires");
    gDevices = document.getElementById("g-devices");
    gAnnos = document.getElementById("g-annotations");
    gTexts = document.getElementById("g-texts");
    gNodes = document.getElementById("g-nodes");
    gOverlay = document.getElementById("g-overlay");
    canvasWrap = document.getElementById("canvas-wrap");
    statusLeft = document.getElementById("status-left");
    zoomLabel = document.getElementById("zoom-label");
    propsBody = document.getElementById("props-body");
    insertDialog = document.getElementById("insert-dialog");
    insertSearch = document.getElementById("insert-search");
    insertList = document.getElementById("insert-list");
    previewSymbol = document.getElementById("preview-symbol");
    previewName = document.getElementById("preview-name");
    textDialog = document.getElementById("text-dialog");
    textDialogTitle = document.getElementById("text-dialog-title");
    textDialogBody = document.getElementById("text-dialog-body");
    fileInput = document.getElementById("file-input");
    emptyHint = document.getElementById("empty-hint");
    buildLabel = document.getElementById("build-label");
    // proves at a glance that the page is running current code, not a cached copy
    if (buildLabel) {
      buildLabel.textContent = APP_VERSION;
      buildLabel.title =
        "Loaded build. If this does not match the latest ?v=NN in index.html, press Ctrl+Shift+R to force a reload.";
    }
    // surface the build in the tab title and dev console too, so there is no
    // way to be unsure which version is actually running
    document.title = "Schematic Canvas " + APP_VERSION;
    console.log(
      "[Schematic Canvas] build " + APP_VERSION +
      " loaded — if you expected a newer build, hard-refresh (Ctrl+Shift+R)."
    );

    // ---- app-level prompt dialog (replaces window.prompt) ----
    promptDialog = document.getElementById("prompt-dialog");
    promptSub = document.getElementById("prompt-dialog-sub");
    promptInput = document.getElementById("prompt-dialog-input");
    document.getElementById("prompt-dialog-ok").addEventListener("click", () => closePrompt(promptInput.value));
    document.getElementById("prompt-dialog-cancel").addEventListener("click", () => closePrompt(null));
    document.getElementById("prompt-dialog-close").addEventListener("click", () => closePrompt(null));
    promptDialog.addEventListener("click", (e) => {
      if (e.target === promptDialog) closePrompt(null);
    });
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); closePrompt(promptInput.value); }
      else if (e.key === "Escape") { e.preventDefault(); closePrompt(null); }
    });

    buildLibrary();
    buildInsertDialog();
    bindToolbar();
    bindMenus();
    bindCanvas();
    bindStatusBar();
    bindDialogs();
    bindFileInput();

    // initial view
    fitView();
    updateZoomLabel();

    // Start empty, but keep the recovery copy until the user restores or replaces it.
    updateRecoveryButton();
    window.addEventListener("beforeunload", (e) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    });

    // initial history snapshot
    saveHistory();

    // A plugin editor URL loads an explicit snapshot, never an implicit autosave.
    const projectToken = new URLSearchParams(window.location.search).get("project");
    if (projectToken) {
      fetch("project.json?token=" + encodeURIComponent(projectToken))
        .then(r => { if (!r.ok) throw new Error("Project load failed: HTTP " + r.status); return r.json(); })
        .then(data => { deserialize(data); saveHistory(); fitView(); hasUnsavedChanges = false; })
        .catch(e => alert(e.message));
    }

    updateEmptyHint();
    updateStatus();
  }

  // ============================================================
  // Library panel
  // ============================================================

  function buildLibrary() {
    const container = document.getElementById("lib-groups");
    container.innerHTML = "";
    let total = 0;
    for (const cat of ComponentLib.categories) {
      const items = ComponentLib.byCategory(cat);
      total += items.length;
      const group = document.createElement("div");
      group.className = "lib-group";

      const title = document.createElement("div");
      title.className = "lib-group-title";
      title.innerHTML = `<span>${cat}</span><span>${items.length}</span>`;
      group.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "lib-grid";

      for (const d of items) {
        const item = document.createElement("div");
        item.className = "lib-item";
        item.title = d.name;
        item.dataset.id = d.id;
        const sym = document.createElement("div");
        sym.style.width = "34px";
        sym.style.height = "30px";
        ComponentLib.renderPreview(d.id, sym, { scale: 0.45 });
        const label = document.createElement("span");
        label.textContent = d.name;
        item.appendChild(sym);
        item.appendChild(label);

        // click to enter place mode (drawing-tool entries switch tool)
        item.addEventListener("click", () => {
          if (d.tool) setTool(d.tool); else startPlace(d.id);
        });
        // drag support
        item.draggable = true;
        item.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/component-id", d.id);
        });
        grid.appendChild(item);
      }
      group.appendChild(grid);
      container.appendChild(group);
    }
    document.getElementById("count-all").textContent = total;
  }

  // ============================================================
  // Insert dialog
  // ============================================================

  let insertItems = [];
  let insertHlIdx = 0;
  let insertFiltered = [];

  function buildInsertDialog() {
    insertItems = ComponentLib.all();
    insertFiltered = insertItems.slice();
    renderInsertList();

    insertSearch.addEventListener("input", () => {
      const q = insertSearch.value.toLowerCase().trim();
      if (!q) {
        insertFiltered = insertItems.slice();
      } else {
        insertFiltered = insertItems.filter(d =>
          d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
        );
      }
      insertHlIdx = 0;
      renderInsertList();
    });

    insertSearch.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        insertHlIdx = Math.min(insertHlIdx + 1, insertFiltered.length - 1);
        renderInsertList();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        insertHlIdx = Math.max(insertHlIdx - 1, 0);
        renderInsertList();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (insertFiltered[insertHlIdx]) {
          const d = insertFiltered[insertHlIdx];
          if (d.tool) setTool(d.tool); else startPlace(d.id);
          closeInsertDialog();
        }
      } else if (e.key === "Escape") {
        closeInsertDialog();
      }
    });

    document.getElementById("insert-place").addEventListener("click", () => {
      if (insertFiltered[insertHlIdx]) {
        const d = insertFiltered[insertHlIdx];
        if (d.tool) setTool(d.tool); else startPlace(d.id);
        closeInsertDialog();
      }
    });
  }

  function renderInsertList() {
    insertList.innerHTML = "";
    // group by category
    const byCat = {};
    for (const d of insertFiltered) {
      if (!byCat[d.category]) byCat[d.category] = [];
      byCat[d.category].push(d);
    }
    let flatIdx = 0;
    for (const cat of ComponentLib.categories) {
      if (!byCat[cat]) continue;
      const catEl = document.createElement("div");
      catEl.className = "ins-cat";
      catEl.textContent = cat;
      insertList.appendChild(catEl);
      for (const d of byCat[cat]) {
        const btn = document.createElement("button");
        btn.className = "ins-item" + (flatIdx === insertHlIdx ? " hl" : "");
        btn.innerHTML = `<span>${d.name}</span><span class="sym">${d.prefix}${(labelCounters[d.prefix] || 0) + 1}</span>`;
        const idx = flatIdx;
        btn.addEventListener("click", () => {
          insertHlIdx = idx;
          if (d.tool) setTool(d.tool); else startPlace(d.id);
          closeInsertDialog();
        });
        btn.addEventListener("mouseenter", () => {
          insertHlIdx = idx;
          renderInsertList();
          showInsertPreview(d.id);
        });
        insertList.appendChild(btn);
        flatIdx++;
      }
    }
    if (insertFiltered[insertHlIdx]) {
      showInsertPreview(insertFiltered[insertHlIdx].id);
    }
  }

  function showInsertPreview(id) {
    const def = ComponentLib.byId(id);
    if (!def) return;
    ComponentLib.renderPreview(id, previewSymbol, { scale: 1.4 });
    previewName.innerHTML = `${def.name}<small>${def.prefix} — ${def.category}</small>`;
  }

  function openInsertDialog() {
    insertDialog.classList.remove("hidden");
    insertSearch.value = "";
    insertFiltered = insertItems.slice();
    insertHlIdx = 0;
    renderInsertList();
    setTimeout(() => insertSearch.focus(), 50);
  }

  function closeInsertDialog() {
    insertDialog.classList.add("hidden");
  }

  // ============================================================
  // Toolbar
  // ============================================================

  function bindToolbar() {
    document.querySelectorAll(".tool[data-tool]").forEach(btn => {
      btn.addEventListener("click", () => setTool(btn.dataset.tool));
    });
    document.getElementById("btn-insert").addEventListener("click", openInsertDialog);
    // style pop
    const stylePop = document.getElementById("style-pop");
    document.getElementById("tool-style").addEventListener("click", (e) => {
      // without stopPropagation the document-level close-all handler
      // immediately re-hides the pop
      e.stopPropagation();
      stylePop.classList.toggle("hidden");
    });
    stylePop.addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("style-lw").addEventListener("change", (e) => {
      state.wireWidth = parseFloat(e.target.value);
      refreshWiresStyle();
      saveHistory();
      autosave();
    });
    document.getElementById("style-grid").addEventListener("change", (e) => {
      state.gridVisible = e.target.checked;
      gridRect.style.display = state.gridVisible ? "" : "none";
    });
    document.getElementById("style-fontsize").addEventListener("change", (e) => {
      state.fontSize = parseInt(e.target.value);
      refreshTextsStyle();
    });
  }

  // keep the style-pop controls in step with restored/undone state
  function syncStyleControls() {
    document.getElementById("style-lw").value = String(state.wireWidth);
    document.getElementById("style-fontsize").value = String(state.fontSize);
    document.getElementById("style-grid").checked = state.gridVisible;
  }

  function setTool(t) {
    state.tool = t;
    document.querySelectorAll(".tool[data-tool]").forEach(b => {
      b.classList.toggle("active", b.dataset.tool === t);
    });
    canvas.className = "";
    canvas.classList.add("tool-" + t);
    cancelPlace();
    cancelWire();
    cancelDrawAnno();
    updateStatus();
  }

  // ============================================================
  // Menus
  // ============================================================

  function bindMenus() {
    // toggle menu on click
    document.querySelectorAll(".menu").forEach(menu => {
      const btn = menu.querySelector(".menu-btn");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = menu.classList.contains("open");
        closeAllMenus();
        if (!wasOpen) menu.classList.add("open");
      });
    });
    document.addEventListener("click", closeAllMenus);

    // action buttons
    document.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.act;
        handleAction(act);
        closeAllMenus();
      });
    });

    // circuit name
    const nameInput = document.getElementById("circuit-name");
    nameInput.addEventListener("change", () => {
      state.circuitName = nameInput.value || "New Circuit";
      autosave();
    });

    // topbar Check and Save: run check report; save only when it passes
    document.getElementById("btn-check-save").addEventListener("click", () => {
      if (typeof Netlist === "undefined") return;
      const report = Netlist.checkReport();
      if (/^Status: PASS$/m.test(report)) {
        autosave();
        saveToFile();
      } else {
        showTextDialog("Check Report — fix warnings before saving", report);
      }
    });
  }

  function closeAllMenus() {
    document.querySelectorAll(".menu.open").forEach(m => m.classList.remove("open"));
    document.getElementById("style-pop").classList.add("hidden");
  }

  function handleAction(act) {
    switch (act) {
      case "new":
        if (confirm("Start a new project? Unsaved changes will be lost.")) {
          clearAll();
          state.circuitName = "New Circuit";
          document.getElementById("circuit-name").value = "New Circuit";
          saveHistory();
          autosave();
        }
        break;
      case "tpl-ota5":
        if (typeof Templates !== "undefined") {
          Templates.apply("ota5");
          saveHistory();
          autosave();
        }
        break;
      case "open":
        fileInput.value = "";
        fileInput.click();
        break;
      case "restore-autosave":
        if (hasUnsavedChanges && !confirm("Replace this drawing with the recovery copy?")) break;
        if (tryLoadAutosave()) { saveHistory(); fitView(); hasUnsavedChanges = true; }
        else alert("No valid recovery copy is available.");
        updateRecoveryButton();
        break;
      case "save-json":
        saveToFile();
        break;
      case "export-svg":
        if (typeof Exporter !== "undefined") Exporter.exportSVG();
        break;
      case "export-png":
        if (typeof Exporter !== "undefined") Exporter.exportPNG();
        break;
      case "export-jpg":
        if (typeof Exporter !== "undefined") Exporter.exportJPG();
        break;
      case "export-pdf":
        if (typeof Exporter !== "undefined") Exporter.exportPDF();
        break;
      case "export-spice":
        if (typeof Netlist !== "undefined") showTextDialog("SPICE Netlist", Netlist.generateSPICE());
        break;
      case "export-spectre":
        if (typeof Netlist !== "undefined") showTextDialog("Spectre Netlist", Netlist.generateSpectre());
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "delete":
        deleteSelection();
        break;
      case "duplicate":
        duplicateSelection();
        break;
      case "rotate":
        rotateSelection();
        break;
      case "mirror-x":
        mirrorSelection("x");
        break;
      case "mirror-y":
        mirrorSelection("y");
        break;
      case "clear":
        if (confirm("Clear entire drawing?")) {
          clearAll();
          saveHistory();
          autosave();
        }
        break;
      case "show-netlist":
        if (typeof Netlist !== "undefined") showTextDialog("SPICE Netlist", Netlist.generateSPICE());
        break;
      case "instance-table":
        if (typeof Netlist !== "undefined") showTextDialog("Instance Table", Netlist.instanceTable());
        break;
      case "check-report":
        if (typeof Netlist !== "undefined") showTextDialog("Check Report", Netlist.checkReport());
        break;
    }
  }

  // ============================================================
  // Canvas interactions
  // ============================================================

  let isPanning = false;
  let panStart = null;
  let spacePressed = false;
  let dragState = null; // { type, startX, startY, ... }

  function modalOpen() {
    return document.querySelector(".modal:not(.hidden)") !== null;
  }

  function bindCanvas() {
    // wheel zoom
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.12 : 1 / 1.12;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      zoomAt(mx, my, factor);
    }, { passive: false });

    // mouse down
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 1 || (e.button === 0 && spacePressed)) {
        // pan
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y };
        canvas.classList.add("panning");
        e.preventDefault();
        return;
      }
      // right-click while a wire is in progress: finish (or cancel when
      // it only has the start point) — standard EDA ending gesture
      if (e.button === 2) {
        if (state.tool === "wire" && wireState.active) {
          if (wireState.points.length >= 2) finishWire();
          else cancelWire();
        }
        return;
      }
      if (e.button !== 0) return;

      const world = toWorld(e.clientX, e.clientY);

      if (state.tool === "select") {
        handleSelectMouseDown(e, world);
      } else if (state.tool === "insert" && state.placeId) {
        handlePlaceClick(world);
      } else if (state.tool === "wire") {
        // Wire placement is handled by the completed `click` event below.
        // Prevent native SVG/image dragging while the button is held down.
        e.preventDefault();
      } else if (state.tool === "text") {
        handleTextClick(world);
      } else if (state.tool === "arrow" || state.tool === "rect" || state.tool === "circle") {
        handleAnnoMouseDown(world);
      }
    });

    // A wire advances only after a complete left click (press + release).
    // Therefore mouseup alone can never drop the live wire, and holding the
    // button down is neither required nor treated as a wiring gesture.
    canvas.addEventListener("click", (e) => {
      if (e.button !== 0 || spacePressed) return;
      const world = toWorld(e.clientX, e.clientY);
      if (state.tool === "wire") handleWireClick(world, e);
    });

    // mouse move
    window.addEventListener("mousemove", (e) => {
      if (isPanning) {
        state.view.x = panStart.vx + (e.clientX - panStart.x);
        state.view.y = panStart.vy + (e.clientY - panStart.y);
        applyViewTransform();
        return;
      }

      const world = toWorld(e.clientX, e.clientY);

      if (state.tool === "select" && dragState && dragState.type === "drag") {
        handleDragMove(world);
      } else if (state.tool === "select" && dragState && dragState.type === "box") {
        handleBoxMove(world);
      } else if (state.tool === "insert" && state.placeId) {
        handlePlaceMove(world);
      } else if (state.tool === "wire" && wireState.active) {
        handleWireMove(world);
      } else if (dragState && dragState.type === "anno") {
        handleAnnoMove(world);
      }
    });

    // mouse up
    window.addEventListener("mouseup", (e) => {
      if (isPanning) {
        isPanning = false;
        canvas.classList.remove("panning");
        return;
      }
      if (dragState) {
        if (dragState.type === "drag") {
          handleDragEnd();
        } else if (dragState.type === "box") {
          handleBoxEnd();
        } else if (dragState.type === "anno") {
          handleAnnoEnd();
        }
        dragState = null;
      }
      // Wiring is click-to-click. Releasing the left button must never commit,
      // finish or cancel a live wire; only the next left click does that.
    });

    // double click
    canvas.addEventListener("dblclick", (e) => {
      // In the wire tool a double-click is always a wire gesture, never an
      // "edit label" shortcut: two fast clicks on two different pins are
      // still reported as a dblclick (Chromium does not check the distance
      // between the clicks), so falling through to hitTest would pop the
      // rename dialog in the middle of a wiring run.
      if (state.tool === "wire" || wireState.active) {
        if (wireState.active && wireState.points.length >= 2) {
          const world = toWorld(e.clientX, e.clientY);
          const last = wireState.points[wireState.points.length - 1];
          // finish when the double-click lands within the pin-snap radius of
          // the current tip (screen-space, so it works at any zoom)
          if (dist(world, last) * state.view.scale <= PIN_SNAP_PX) finishWire();
        }
        return;
      }
      const world = toWorld(e.clientX, e.clientY);
      const hit = hitTest(world);
      if (hit) {
        if (hit.kind === "device") {
          editDeviceLabel(hit.id);
        } else if (hit.kind === "text") {
          editText(hit.id);
        }
      }
    });

    // drop support
    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/component-id");
      const def = id && ComponentLib.byId(id);
      if (def && def.tool) { setTool(def.tool); return; }
      if (id) {
        const world = toWorld(e.clientX, e.clientY);
        placeDevice(id, snap(world.x), snap(world.y));
        saveHistory();
        autosave();
      }
    });

    // keyboard
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.code === "Space") { spacePressed = true; e.preventDefault(); return; }

      if (e.key === "Escape") {
        const openModal = document.querySelector(".modal:not(.hidden)");
        if (openModal) {
          // the prompt dialog also has to fire its cancel callback
          if (openModal === promptDialog) closePrompt(null);
          else openModal.classList.add("hidden");
          return;
        }
        // staged exit: cancel the gesture in progress first, and only
        // leave the tool when nothing is in progress — Esc backs out
        // one level at a time
        if (state.tool === "wire" && wireState.active) { cancelWire(); return; }
        if (state.tool === "insert" && state.placeId) { cancelPlace(); return; }
        if (state.tool !== "select") setTool("select");
        cancelPlace();
        cancelWire();
        deselectAll();
        return;
      }
      if (modalOpen()) return;
      if (e.key === "v" || e.key === "V") { setTool("select"); return; }
      if (e.key === "i" || e.key === "I") { openInsertDialog(); return; }
      if (e.key === "w" || e.key === "W") { setTool("wire"); return; }
      if (e.key === "t" || e.key === "T") { setTool("text"); return; }
      if (e.key === "r" || e.key === "R") {
        if (state.placeId) {
          // rotate/mirror the placement ghost
          if (e.shiftKey) placeMX = !placeMX;
          else if (e.ctrlKey || e.metaKey) placeMY = !placeMY;
          else placeRot = (placeRot + 90) % 360;
          updateGhostTransform();
          e.preventDefault();
          return;
        }
        if (e.shiftKey) { mirrorSelection("x"); }
        else if (e.ctrlKey || e.metaKey) { mirrorSelection("y"); }
        else { rotateSelection(); }
        return;
      }
      if (e.key === "f" || e.key === "F") { fitView(); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelection();
        e.preventDefault();
        return;
      }
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (e.key === "F3") {
        state.orthogonalWire = !state.orthogonalWire;
        updateStatus();
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        if (wireState.active) {
          finishWire();
          e.preventDefault();
          return;
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") spacePressed = false;
    });

    // context menu
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ============================================================
  // Select tool
  // ============================================================

  function handleSelectMouseDown(e, world) {
    const hit = hitTest(world);

    if (hit) {
      // clicked on something
      if (!state.selection.has(hit.id)) {
        if (!e.shiftKey) deselectAll();
        addToSelection(hit.id);
      }
      // start drag
      dragState = {
        type: "drag",
        startX: world.x,
        startY: world.y,
        origPositions: {},
        moved: false,
        pinAnchors: [], // original world positions of dragged devices' pins
      };
      for (const id of state.selection) {
        const d = getDevice(id);
        if (d) {
          dragState.origPositions[id] = { x: d.x, y: d.y };
          for (const p of ComponentLib.getPins(d.type)) {
            const tp = transformPin(p, d);
            dragState.pinAnchors.push({ x: tp.x, y: tp.y });
          }
        }
        const w = getWire(id);
        if (w) dragState.origPositions[id] = { points: w.points.map(p => ({ ...p })) };
        const t = getText(id);
        if (t) dragState.origPositions[id] = { x: t.x, y: t.y };
        const a = getAnnotation(id);
        if (a) dragState.origPositions[id] = { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 };
      }
    } else {
      // clicked empty space - start selection box
      if (!e.shiftKey) deselectAll();
      dragState = {
        type: "box",
        startX: snap(world.x),
        startY: snap(world.y),
        endX: snap(world.x),
        endY: snap(world.y),
        boxEl: null,
      };
      const box = el("rect", {
        class: "sel-box",
        x: dragState.startX, y: dragState.startY,
        width: 0, height: 0,
        fill: "rgba(47,111,214,.12)",
        stroke: "#2f6fd6",
        "stroke-width": 1.2,
        "stroke-dasharray": "4 3",
      });
      gOverlay.appendChild(box);
      dragState.boxEl = box;
    }
  }

  // split axis-aligned wire segments at the given anchor points so
  // mid-segment (T-connected) pins become movable vertices
  function splitWiresAtAnchors(anchors) {
    if (!anchors.length) return;
    for (const w of state.wires) {
      if (state.selection.has(w.id)) continue;
      let split = false;
      for (let i = 0; i < w.points.length - 1; i++) {
        const a = w.points[i], b = w.points[i + 1];
        const horiz = a.y === b.y, vert = a.x === b.x;
        if (!horiz && !vert) continue;
        for (const pa of anchors) {
          const inside = horiz
            ? (pa.y === a.y && pa.x > Math.min(a.x, b.x) && pa.x < Math.max(a.x, b.x))
            : (pa.x === a.x && pa.y > Math.min(a.y, b.y) && pa.y < Math.max(a.y, b.y));
          if (inside) {
            w.points.splice(i + 1, 0, { x: pa.x, y: pa.y });
            split = true;
            i--; // re-examine the first half for further anchors
            break;
          }
        }
      }
      if (split) updateWirePath(w);
    }
  }

  function handleDragMove(world) {
    const dx = snap(world.x - dragState.startX);
    const dy = snap(world.y - dragState.startY);
    if (dx === 0 && dy === 0 && !dragState.moved) return;
    // split T-connected wires once, at first actual movement, so their
    // mid-segment pin contacts become vertices the drag can carry
    // (a plain click must not mutate wire geometry)
    if (!dragState.splitDone) {
      splitWiresAtAnchors(dragState.pinAnchors);
      dragState.origWirePoints = new Map(state.wires
        .filter(w => !state.selection.has(w.id))
        .map(w => [w.id, w.points.map(p => ({ ...p }))]));
      dragState.splitDone = true;
    }
    dragState.moved = true;

    for (const id of state.selection) {
      const orig = dragState.origPositions[id];
      const dev = getDevice(id);
      if (dev) {
        dev.x = orig.x + dx;
        dev.y = orig.y + dy;
        updateDeviceTransform(dev);
      }
      const w = getWire(id);
      if (w) {
        w.points = orig.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        updateWirePath(w);
      }
      const t = getText(id);
      if (t) {
        t.x = orig.x + dx;
        t.y = orig.y + dy;
        updateTextPos(t);
      }
      const a = getAnnotation(id);
      if (a) {
        a.x1 = orig.x1 + dx; a.y1 = orig.y1 + dy;
        a.x2 = orig.x2 + dx; a.y2 = orig.y2 + dy;
        updateAnnotation(a);
      }
    }

    // wires not in the selection still follow if a vertex sits on a
    // dragged device's original pin position (sticky wire ends)
    const anchors = new Set(dragState.pinAnchors.map(CircuitCore.pointKey));
    for (const w of state.wires) {
      if (state.selection.has(w.id)) continue;
      const original = dragState.origWirePoints.get(w.id);
      if (original && original.some(p => anchors.has(CircuitCore.pointKey(p)))) {
        w.points = CircuitCore.moveAnchoredPoints(original, anchors, dx, dy);
        updateWirePath(w);
      }
    }
    updateJunctions();
  }

  function handleDragEnd() {
    if (dragState && dragState.moved) {
      saveHistory();
      autosave();
    }
    updatePropsPanel();
  }

  function handleBoxMove(world) {
    dragState.endX = snap(world.x);
    dragState.endY = snap(world.y);
    const x = Math.min(dragState.startX, dragState.endX);
    const y = Math.min(dragState.startY, dragState.endY);
    const w = Math.abs(dragState.endX - dragState.startX);
    const h = Math.abs(dragState.endY - dragState.startY);
    dragState.boxEl.setAttribute("x", x);
    dragState.boxEl.setAttribute("y", y);
    dragState.boxEl.setAttribute("width", w);
    dragState.boxEl.setAttribute("height", h);
  }

  function rectsOverlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    return ax1 <= bx2 && ax2 >= bx1 && ay1 <= by2 && ay2 >= by1;
  }

  // Liang-Barsky clip: does segment a-b touch the axis-aligned rect?
  function segRectHit(a, b, x1, y1, x2, y2) {
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy];
    const q = [a.x - x1, x2 - a.x, a.y - y1, y2 - a.y];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  }

  function handleBoxEnd() {
    if (dragState.boxEl) dragState.boxEl.remove();
    const x1 = Math.min(dragState.startX, dragState.endX);
    const y1 = Math.min(dragState.startY, dragState.endY);
    const x2 = Math.max(dragState.startX, dragState.endX);
    const y2 = Math.max(dragState.startY, dragState.endY);
    // small box = treat as click (deselect)
    if (Math.abs(x2 - x1) < 3 && Math.abs(y2 - y1) < 3) {
      deselectAll();
      updatePropsPanel();
      return;
    }
    // intersect-style marquee: anything whose visible geometry touches the
    // box gets selected (matches common EDA behavior) — the old "fully
    // inside" rule missed wires with a tail outside and half-covered items
    for (const d of state.devices) {
      const b = deviceExtent(d);
      if (rectsOverlap(b.minX - 10, b.minY - 10, b.maxX + 10, b.maxY + 10, x1, y1, x2, y2)) {
        addToSelection(d.id);
      }
    }
    for (const w of state.wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        if (segRectHit(w.points[i], w.points[i + 1], x1, y1, x2, y2)) {
          addToSelection(w.id);
          break;
        }
      }
    }
    for (const t of state.texts) {
      const tw = Math.max(20, t.text.length * t.fontSize * 0.6);
      if (rectsOverlap(t.x - 4, t.y - t.fontSize * 0.7,
                       t.x + tw + 4, t.y + t.fontSize * 0.25, x1, y1, x2, y2)) {
        addToSelection(t.id);
      }
    }
    for (const a of state.annotations) {
      if (segRectHit({ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }, x1, y1, x2, y2)) {
        addToSelection(a.id);
      }
    }
    updatePropsPanel();
  }

  // ---- hit test ----
  // Selectable extent of a device: pin positions unioned with the rendered
  // artwork bounds (getBBox in device-local space, mapped through the same
  // rotate/mirror math as pins). A pin-only box leaves most of wide symbols
  // — op-amp triangles, v_amp, gates whose bodies are taller than their
  // pin spread — unclickable.
  function deviceExtent(d) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const consider = (lx, ly) => {
      const tp = CircuitCore.transformPin({ x: lx, y: ly, name: "" }, d);
      minX = Math.min(minX, tp.x); maxX = Math.max(maxX, tp.x);
      minY = Math.min(minY, tp.y); maxY = Math.max(maxY, tp.y);
    };
    for (const p of ComponentLib.getPins(d.type)) consider(p.x, p.y);
    const sym = d.gEl && d.gEl.querySelector(".dev-sym");
    if (sym && sym.getBBox) {
      const b = sym.getBBox();
      for (const [cx, cy] of [
        [b.x, b.y], [b.x + b.width, b.y],
        [b.x, b.y + b.height], [b.x + b.width, b.y + b.height],
      ]) consider(cx, cy);
    }
    if (minX === Infinity) { minX = d.x; minY = d.y; maxX = d.x; maxY = d.y; }
    return { minX, minY, maxX, maxY };
  }

  function hitTest(world, tolerance = 8 / state.view.scale) {
    // check devices
    for (let i = state.devices.length - 1; i >= 0; i--) {
      const d = state.devices[i];
      const b = deviceExtent(d);
      if (world.x >= b.minX - 10 && world.x <= b.maxX + 10 &&
          world.y >= b.minY - 10 && world.y <= b.maxY + 10) {
        return { kind: "device", id: d.id };
      }
    }
    // check wires
    for (let i = state.wires.length - 1; i >= 0; i--) {
      const w = state.wires[i];
      for (let j = 0; j < w.points.length - 1; j++) {
        const a = w.points[j], b = w.points[j + 1];
        if (pointToSegDist(world, a, b) < tolerance) {
          return { kind: "wire", id: w.id };
        }
      }
    }
    // check texts
    for (let i = state.texts.length - 1; i >= 0; i--) {
      const t = state.texts[i];
      const tw = Math.max(20, t.text.length * t.fontSize * 0.6);
      if (world.x >= t.x - 4 && world.x <= t.x + tw + 4 &&
          world.y >= t.y - t.fontSize * 0.8 && world.y <= t.y + t.fontSize * 0.25) {
        return { kind: "text", id: t.id };
      }
    }
    // check annotations
    for (let i = state.annotations.length - 1; i >= 0; i--) {
      const a = state.annotations[i];
      if (pointToSegDist(world, { x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }) < tolerance) {
        return { kind: "anno", id: a.id };
      }
    }
    return null;
  }

  function pointToSegDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx, py = a.y + t * dy;
    return Math.hypot(p.x - px, p.y - py);
  }

  // ---- selection ----
  function addToSelection(id) {
    state.selection.add(id);
    const dev = getDevice(id);
    if (dev) dev.gEl.classList.add("selected");
    const w = getWire(id);
    if (w) w.el.classList.add("selected");
    const t = getText(id);
    if (t) t.el.classList.add("selected");
    const a = getAnnotation(id);
    if (a) a.el.classList.add("selected");
    updatePropsPanel();
  }

  function removeFromSelection(id) {
    state.selection.delete(id);
    const dev = getDevice(id);
    if (dev) dev.gEl.classList.remove("selected");
    const w = getWire(id);
    if (w) w.el.classList.remove("selected");
    const t = getText(id);
    if (t) t.el.classList.remove("selected");
    const a = getAnnotation(id);
    if (a) a.el.classList.remove("selected");
    updatePropsPanel();
  }

  function deselectAll() {
    for (const id of state.selection) {
      const dev = getDevice(id);
      if (dev) dev.gEl.classList.remove("selected");
      const w = getWire(id);
      if (w) w.el.classList.remove("selected");
      const t = getText(id);
      if (t) t.el.classList.remove("selected");
      const a = getAnnotation(id);
      if (a) a.el.classList.remove("selected");
    }
    state.selection.clear();
    updatePropsPanel();
  }

  // ============================================================
  // Place (insert) mode
  // ============================================================

  let placeGhost = null;
  let placeX = 0, placeY = 0;
  let placeRot = 0, placeMX = false, placeMY = false;

  function startPlace(compId) {
    state.tool = "insert";
    state.placeId = compId;
    document.querySelectorAll(".tool[data-tool]").forEach(b => {
      b.classList.toggle("active", b.dataset.tool === "insert");
    });
    canvas.className = "place-mode";
    cancelWire();

    // create ghost
    if (placeGhost) placeGhost.remove();
    placeGhost = ComponentLib.createDevice(compId, state.wireWidth);
    placeGhost.classList.add("place-ghost");
    placeGhost.style.opacity = "0.7";
    gOverlay.appendChild(placeGhost);
    placeRot = 0; placeMX = false; placeMY = false;
    updateStatus();
  }

  function cancelPlace() {
    state.placeId = null;
    if (placeGhost) { placeGhost.remove(); placeGhost = null; }
    if (state.tool === "insert") {
      // keep insert tool active but no placeId
    }
  }

  function handlePlaceMove(world) {
    placeX = snap(world.x);
    placeY = snap(world.y);
    if (placeGhost) {
      placeGhost.setAttribute("transform",
        `translate(${placeX},${placeY}) scale(${placeMX ? -1 : 1},${placeMY ? -1 : 1}) rotate(${placeRot})`);
    }
  }

  function handlePlaceClick(world) {
    const id = state.placeId;
    if (!id) return;
    placeX = snap(world.x);
    placeY = snap(world.y);
    placeDevice(id, placeX, placeY, placeRot, placeMX, placeMY);
    saveHistory();
    autosave();
    updateEmptyHint();
    // stay in place mode for more placements
  }

  function placeDevice(type, x, y, rot = 0, mx = false, my = false, params = null, label = null, labelOff = null) {
    const def = ComponentLib.byId(type);
    if (!def) return null;
    const id = uid("dev");
    const g = ComponentLib.createDevice(type, state.wireWidth);
    gDevices.appendChild(g);

    const dev = {
      id, type, x, y, rot, mirrorX: mx, mirrorY: my,
      params: params || ComponentLib.getDefaultParams(type),
      label: label || nextLabel(def.prefix),
      labelOff: labelOff ? { ...labelOff } : null,
      gEl: g,
    };
    state.devices.push(dev);
    updateDeviceTransform(dev);
    updateDeviceLabel(dev);
    g.dataset.instanceId = id;
    // a placed pin can complete a T-junction on an existing wire — the dot
    // must appear with the placement, not after the next unrelated edit
    updateJunctions();
    return dev;
  }

  function updateDeviceTransform(dev) {
    dev.gEl.setAttribute("transform",
      `translate(${dev.x},${dev.y}) scale(${dev.mirrorX ? -1 : 1},${dev.mirrorY ? -1 : 1}) rotate(${dev.rot})`);
    // counter-transform so labels stay upright and un-mirrored
    const lblG = dev.gEl.querySelector(".dev-label");
    if (lblG) {
      lblG.setAttribute("transform",
        `rotate(${-dev.rot}) scale(${dev.mirrorX ? -1 : 1},${dev.mirrorY ? -1 : 1})`);
    }
  }

  function updateDeviceLabel(dev) {
    const lblG = dev.gEl.querySelector(".dev-label");
    if (!lblG) return;
    lblG.innerHTML = "";
    const def = ComponentLib.byId(dev.type);
    if (!def) return;
    const spec = ComponentLib.labelSpec(dev.type);
    if (!spec) return; // e.g. ground symbol needs no label
    if (!dev.labelOff) dev.labelOff = { x: spec.off[0], y: spec.off[1] };
    const text = spec.text ? (dev.params[spec.text] || dev.label) : dev.label;
    const txt = makeLabelText(text, {
      x: dev.labelOff.x, y: dev.labelOff.y,
      "font-size": state.fontSize,
      "text-anchor": spec.anchor,
      class: "lbl lbl-drag",
    }, spec.text === "display");
    txt.addEventListener("mousedown", (e) => startLabelDrag(e, dev));
    lblG.appendChild(txt);
  }

  // ---- label dragging ----
  // The device transform is translate·scale(±1)·rotate and the label group
  // carries rotate(-rot)·scale(±1); the two scales cancel, so the composite
  // for label content is a pure translation — labelOff is a world-space
  // offset and a world drag delta applies to it unchanged.
  let labelDrag = null;

  function startLabelDrag(e, dev) {
    e.stopPropagation();
    e.preventDefault();
    if (!state.selection.has(dev.id)) {
      if (!e.shiftKey) deselectAll();
      addToSelection(dev.id);
    }
    const world = toWorld(e.clientX, e.clientY);
    labelDrag = {
      dev,
      startX: world.x, startY: world.y,
      origX: dev.labelOff.x, origY: dev.labelOff.y,
      moved: false,
    };
  }

  window.addEventListener("mousemove", (e) => {
    if (!labelDrag) return;
    const world = toWorld(e.clientX, e.clientY);
    const dx = snap(world.x - labelDrag.startX);
    const dy = snap(world.y - labelDrag.startY);
    if (dx === 0 && dy === 0) return;
    labelDrag.moved = true;
    const dev = labelDrag.dev;
    dev.labelOff = { x: labelDrag.origX + dx, y: labelDrag.origY + dy };
    const txt = dev.gEl.querySelector(".dev-label .lbl-drag");
    if (txt) {
      txt.setAttribute("x", dev.labelOff.x);
      txt.setAttribute("y", dev.labelOff.y);
    }
  });

  window.addEventListener("mouseup", () => {
    if (labelDrag) {
      if (labelDrag.moved) { saveHistory(); autosave(); }
      labelDrag = null;
    }
  });

  // Build a <text> in textbook style: italic-bold serif base with an
  // upright bold subscript, e.g. "M1" -> M (italic) + 1 (subscript),
  // "VDD" -> V + DD. Matches the reference board's label typography.
  function makeLabelText(text, attrs, notation = false) {
    const t = el("text", attrs);
    if (notation) {
      for (const part of ComponentLib.labelParts(text)) {
        const span = el("tspan", part.sub ? { "font-size": "76%", "baseline-shift": "sub" } : { "baseline-shift": "baseline" });
        span.textContent = part.text; t.appendChild(span);
      }
      return t;
    }
    const m = /^(.*?)(\d+)$/.exec(text) || /^([A-Za-z](?:[a-z]*))([A-Z]{2,})$/.exec(text);
    if (m && m[1]) {
      const base = el("tspan", { style: "font-style:italic;font-weight:700" });
      base.textContent = m[1];
      const sub = el("tspan", {
        style: "font-style:normal;font-weight:700",
        "font-size": "76%", "baseline-shift": "-0.28em", dx: "0.046em",
      });
      sub.textContent = m[2];
      t.appendChild(base);
      t.appendChild(sub);
    } else {
      t.textContent = text;
    }
    return t;
  }

  function transformPin(pin, dev) {
    return CircuitCore.transformPin(pin, dev);
  }

  function getDevice(id) {
    return state.devices.find(d => d.id === id);
  }

  function getWire(id) {
    return state.wires.find(w => w.id === id);
  }

  function getText(id) {
    return state.texts.find(t => t.id === id);
  }

  function getAnnotation(id) {
    return state.annotations.find(a => a.id === id);
  }

  // label counter
  const labelCounters = {};
  function nextLabel(prefix) {
    if (!labelCounters[prefix]) labelCounters[prefix] = 0;
    labelCounters[prefix]++;
    return prefix + labelCounters[prefix];
  }

  // ============================================================
  // Wire tool
  // ============================================================

  // how close (in SCREEN pixels) a click must land to snap onto a pin or an
  // existing wire vertex. Expressed in screen space rather than world units
  // so the catch radius stays usable at any zoom — a world-unit tolerance
  // shrinks to a few pixels when zoomed out, which made off-centre clicks
  // miss the pin and the stroke never finish.
  const PIN_SNAP_PX = 20;

  let wireState = {
    active: false,
    points: [],
    previewEl: null,
    snapEl: null, // snap-target marker shown while the preview hovers a connection
    anchorEl: null, // marker on the last committed point of a live stroke
  };

  function cancelWire() {
    wireState.active = false;
    wireState.points = [];
    if (wireState.previewEl) { wireState.previewEl.remove(); wireState.previewEl = null; }
    if (wireState.snapEl) { wireState.snapEl.remove(); wireState.snapEl = null; }
    if (wireState.anchorEl) { wireState.anchorEl.remove(); wireState.anchorEl = null; }
    updateStatus();
  }

  // horizontal-first bend point between from and to (null when already axis-aligned)
  function orthoCorner(from, to) {
    if (from.x === to.x || from.y === to.y) return null;
    return { x: to.x, y: from.y };
  }

  // Connection candidate under a snapped grid point, in click priority:
  // pin > existing wire vertex > existing wire segment interior. Interior
  // hits let a wire terminate on the middle of an existing wire; the
  // netlist splits the segment there and the junction dot marks the T.
  function wireSnapTarget(pt) {
    const pinHit = findNearbyPin(pt);
    if (pinHit) return { x: pinHit.x, y: pinHit.y, kind: "pin" };
    const vHit = findNearbyWireVertex(pt);
    if (vHit) return { x: vHit.x, y: vHit.y, kind: "vertex" };
    const iHit = findWireInteriorPoint(pt);
    if (iHit) return { x: iHit.x, y: iHit.y, kind: "interior" };
    return null;
  }

  // snapped grid point lying strictly inside an axis-aligned wire segment
  // (wires are grid-aligned, so the snapped point is exactly on the wire)
  function findWireInteriorPoint(pt) {
    for (const w of state.wires) {
      for (let i = 0; i < w.points.length - 1; i++) {
        const a = w.points[i], b = w.points[i + 1];
        const inside = a.y === b.y
          ? (pt.y === a.y && pt.x > Math.min(a.x, b.x) && pt.x < Math.max(a.x, b.x))
          : (pt.x === a.x && pt.y > Math.min(a.y, b.y) && pt.y < Math.max(a.y, b.y));
        if (inside) return pt;
      }
    }
    return null;
  }

  // Click-driven routing — the button never has to stay down:
  //   1st click  : anchor the start point (snaps onto a pin / wire vertex /
  //                segment interior when the cursor is near one). The stroke
  //                is now live and survives mouseup, panning and zooming.
  //   next clicks: on empty space -> commit a corner vertex, stay live
  //                on a pin / vertex / segment -> commit and finish there
  //   finish also: Shift+click, Enter, right-click, double-click on the tip
  //   cancel     : Esc
  function handleWireClick(world, e) {
    e.preventDefault();
    if (!wireState.active) {
      const { x, y, t } = pickWirePoint(world);
      const pt = { x, y };
      wireState.active = true;
      wireState.points = [pt];
      wireState.previewEl = el("path", { class: "wire", d: "", "stroke-dasharray": "5 4" });
      wireState.previewEl.style.strokeWidth = state.wireWidth;
      gOverlay.appendChild(wireState.previewEl);
      showWireAnchor(pt);
      updateStatus();
      return;
    }
    commitWirePoint(world, e.shiftKey);
  }

  // Append one point to the live stroke; finish it when the point lands on a
  // connection (pin / wire vertex / segment) or when `force` asks for it.
  function commitWirePoint(world, force) {
    if (!wireState.active) return;
    const { x, y, t } = pickWirePoint(world);
    const endPt = { x, y };
    const last = wireState.points[wireState.points.length - 1];

    // clicking the current tip again closes the stroke there, but only once
    // a real segment exists — a stray double-click on the start pin must not
    // kill the wire before it has begun
    if (endPt.x === last.x && endPt.y === last.y) {
      if (force && wireState.points.length >= 2) finishWire();
      return;
    }

    if (state.orthogonalWire) {
      const corner = orthoCorner(last, endPt);
      if (corner && (corner.x !== last.x || corner.y !== last.y)) {
        wireState.points.push(corner);
      }
    }
    wireState.points.push(endPt);

    if (t || force) finishWire();
    else { showWireAnchor(endPt); updateStatus(); }
  }

  // square marker on the last committed point: the visual proof that the
  // stroke is still armed after the button came back up
  function showWireAnchor(pt) {
    if (!wireState.anchorEl) {
      wireState.anchorEl = el("rect", {
        class: "wire-anchor", x: 0, y: 0, width: 8, height: 8,
      });
      gOverlay.appendChild(wireState.anchorEl);
    }
    wireState.anchorEl.setAttribute("x", pt.x - 4);
    wireState.anchorEl.setAttribute("y", pt.y - 4);
    wireState.anchorEl.style.display = "";
  }

  // Resolve the point a wire click should land on: prefer snapping onto a
  // nearby connection (pin / wire vertex / segment) using the RAW world point
  // — NOT a grid-snapped one — because grid snapping can move the cursor up
  // to half a cell away from the pin and miss the tolerance. Only when there
  // is no connection nearby do we fall back to the grid.
  function pickWirePoint(world) {
    const t = wireSnapTarget(world);
    if (t) return { x: t.x, y: t.y, t };
    const g = snapPt(world);
    return { x: g.x, y: g.y, t: null };
  }

  function handleWireMove(world) {
    if (!wireState.active) return;
    // live-snap the preview endpoint onto pins/vertices/segments so the
    // dashed wire lands exactly where the click will terminate it
    const { x: ex, y: ey, t } = pickWirePoint(world);
    const endPt = { x: ex, y: ey };
    // ring the snappable target so "a click here finishes the wire" is
    // visible before the click
    if (t) {
      if (!wireState.snapEl) {
        wireState.snapEl = el("circle", { class: "snap-dot", r: 5 });
        gOverlay.appendChild(wireState.snapEl);
      }
      wireState.snapEl.setAttribute("cx", endPt.x);
      wireState.snapEl.setAttribute("cy", endPt.y);
      wireState.snapEl.style.display = "";
    } else if (wireState.snapEl) {
      wireState.snapEl.style.display = "none";
    }
    const last = wireState.points[wireState.points.length - 1];
    const pts = wireState.points.slice();
    if (state.orthogonalWire) {
      const corner = orthoCorner(last, endPt);
      if (corner) pts.push(corner);
    }
    if (endPt.x !== last.x || endPt.y !== last.y) pts.push(endPt);
    wireState.previewEl.setAttribute("d", pointsToPath(pts));
  }

  function finishWire() {
    // drop duplicate consecutive vertices, then merge collinear runs so
    // redundant waypoints (ortho corners, mode toggles) don't linger
    const pts = [];
    for (const p of wireState.points) {
      const last = pts[pts.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
    }
    for (let i = pts.length - 2; i > 0; i--) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const between = b.x >= Math.min(a.x, c.x) && b.x <= Math.max(a.x, c.x) &&
        b.y >= Math.min(a.y, c.y) && b.y <= Math.max(a.y, c.y);
      if (cross === 0 && between) pts.splice(i, 1);
    }
    if (pts.length < 2) {
      cancelWire();
      return;
    }
    const id = uid("wire");
    const path = el("path", { class: "wire", d: pointsToPath(pts) });
    path.style.strokeWidth = state.wireWidth;
    gWires.appendChild(path);
    const wire = { id, points: pts, el: path };
    state.wires.push(wire);
    cancelWire();
    updateJunctions();
    saveHistory();
    autosave();
    updateEmptyHint();
  }

  function findNearbyPin(pt, tolPx = PIN_SNAP_PX) {
    const tol = tolPx / state.view.scale;
    let best = null, bestDist = tol;
    for (const d of state.devices) {
      const pins = ComponentLib.getPins(d.type);
      for (const p of pins) {
        const tp = transformPin(p, d);
        const dd = dist(pt, tp);
        if (dd < bestDist) {
          bestDist = dd;
          best = { devId: d.id, pinName: p.name, x: tp.x, y: tp.y };
        }
      }
    }
    return best;
  }

  // nearest existing wire vertex within tol, so a new wire can join a
  // previous one at the exact same point instead of leaving a gap
  function findNearbyWireVertex(pt, tolPx = PIN_SNAP_PX) {
    const tol = tolPx / state.view.scale;
    let best = null, bestDist = tol;
    for (const w of state.wires) {
      for (const p of w.points) {
        const dd = dist(pt, p);
        if (dd < bestDist) {
          bestDist = dd;
          best = { x: p.x, y: p.y };
        }
      }
    }
    return best;
  }

  // unit vector from `from` toward `to` (null when degenerate)
  function segDir(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    return { x: dx / len, y: dy / len };
  }

  function pointsToPath(points) {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  function updateWirePath(w) {
    w.el.setAttribute("d", pointsToPath(w.points));
  }

  function refreshWiresStyle() {
    for (const d of state.devices) ComponentLib.setDeviceWireWidth(d.gEl, state.wireWidth);
    if (placeGhost) ComponentLib.setDeviceWireWidth(placeGhost, state.wireWidth);
    if (wireState.previewEl) wireState.previewEl.style.strokeWidth = state.wireWidth;
    for (const w of state.wires) {
      w.el.style.strokeWidth = state.wireWidth;
    }
    // rebuild patches: their leg length follows the stroke width
    gNodes.querySelectorAll(".joint-patch").forEach(n => n.remove());
    updateJointPatches();
  }

  function refreshTextsStyle() {
    // keep existing texts and device labels in sync with the style panel
    for (const t of state.texts) {
      t.fontSize = state.fontSize;
      t.el.setAttribute("font-size", state.fontSize);
    }
    for (const d of state.devices) updateDeviceLabel(d);
  }

  // ---- junctions ----
  // Delegates to Netlist.buildNetGraph(): a dot is drawn wherever
  // 3+ connections (wire ends after segment splitting + pins) meet.
  // junction dots are keyed by grid point: updateJunctions() diffs against
  // the previous set (keeps existing DOM nodes, only removes/creates what
  // changed) and is coalesced to one pass per animation frame, so dragging
  // a dense schematic does not relayout every node on each mousemove.
  let junctionRaf = 0;

  function updateJunctions() {
    if (junctionRaf) return;
    junctionRaf = requestAnimationFrame(() => {
      junctionRaf = 0;
      runUpdateJunctions();
    });
  }

  function runUpdateJunctions() {
    gNodes.querySelectorAll(".joint-patch").forEach(n => n.remove());
    if (typeof Netlist === "undefined") {
      for (const j of state.junctions) j.el.remove();
      state.junctions = [];
      return;
    }
    updateJointPatches();
    const topo = Netlist.buildNetGraph();
    const next = new Map(topo.junctions.map(p => [p.x + "," + p.y, p]));
    const kept = new Map();
    for (const j of state.junctions) {
      if (next.has(j.key)) kept.set(j.key, j);
      else j.el.remove();
    }
    state.junctions = [];
    for (const [k, p] of next) {
      const old = kept.get(k);
      if (old) {
        old.x = p.x; old.y = p.y;
        state.junctions.push(old);
      } else {
        const dot = el("circle", { class: "junction", cx: p.x, cy: p.y, r: 7.56 });
        gNodes.appendChild(dot);
        state.junctions.push({ id: `j_${p.x}_${p.y}`, key: k, x: p.x, y: p.y, el: dot });
      }
    }
  }

  // Two wires meeting where one ends and the other begins render as
  // separate strokes: their round end caps leave a wedge-shaped gap on
  // the outside of the corner. Redraw such corners as a tiny mitered
  // polyline (same width), which covers the joint exactly like a single
  // continuous path would. Points with 3+ ends get a junction dot and
  // need no patch. Endpoints that nearly coincide (legacy drawings,
  // off-grid pins) get a bridging patch so old gaps close too.
  function updateJointPatches() {
    const r = state.wireWidth / 2;
    const NEAR = 2.5;
    const ends = [];
    for (const w of state.wires) {
      const pts = w.points;
      if (pts.length < 2) continue;
      ends.push({ p: pts[0], dir: segDir(pts[1], pts[0]) });
      ends.push({ p: pts[pts.length - 1], dir: segDir(pts[pts.length - 2], pts[pts.length - 1]) });
    }
    const addPatch = (d, join) => {
      const patch = el("path", { class: "joint-patch", d, "stroke-miterlimit": 10 });
      patch.style.strokeWidth = state.wireWidth;
      if (join) patch.style.strokeLinejoin = join;
      gNodes.appendChild(patch);
    };
    const used = new Set();
    for (let i = 0; i < ends.length; i++) {
      const e1 = ends[i];
      if (!e1.dir || used.has(i)) continue;
      for (let j = i + 1; j < ends.length; j++) {
        const e2 = ends[j];
        if (!e2.dir || used.has(j)) continue;
        const dd = dist(e1.p, e2.p);
        if (dd > NEAR) continue;
        used.add(i); used.add(j);
        if (dd === 0 && e1.p.x === e2.p.x && e1.p.y === e2.p.y) {
          // exact joint: mitered corner identical to a merged path
          const d = `M ${e1.p.x - r * e1.dir.x} ${e1.p.y - r * e1.dir.y}`
            + ` L ${e1.p.x} ${e1.p.y}`
            + ` L ${e1.p.x - r * e2.dir.x} ${e1.p.y - r * e2.dir.y}`;
          addPatch(d);
        } else {
          // near joint: bridge both endpoints with one rounded stroke
          const d = `M ${e1.p.x - r * e1.dir.x} ${e1.p.y - r * e1.dir.y}`
            + ` L ${e1.p.x} ${e1.p.y} L ${e2.p.x} ${e2.p.y}`
            + ` L ${e2.p.x - r * e2.dir.x} ${e2.p.y - r * e2.dir.y}`;
          addPatch(d, "round");
        }
        break;
      }
    }
  }

  // ============================================================
  // Text tool
  // ============================================================

  function handleTextClick(world) {
    const pt = snapPt(world);
    openPrompt("Add Text", "Text:", "", (txt) => {
      if (txt === null || txt.trim() === "") return;
      addText(pt.x, pt.y, txt);
      saveHistory();
      autosave();
    });
  }

  function addText(x, y, text) {
    const id = uid("txt");
    const t = el("text", {
      class: "lbl-text", x, y, "font-size": state.fontSize,
      "text-anchor": "start"
    });
    t.textContent = text;
    gTexts.appendChild(t);
    state.texts.push({ id, x, y, text, fontSize: state.fontSize, el: t });
    return id;
  }

  function updateTextPos(t) {
    t.el.setAttribute("x", t.x);
    t.el.setAttribute("y", t.y);
  }

  function editText(id) {
    const t = getText(id);
    if (!t) return;
    openPrompt("Edit Text", "Text:", t.text, (nt) => {
      if (nt === null) return;
      t.text = nt;
      t.el.textContent = nt;
      saveHistory();
      autosave();
    });
  }

  function editDeviceLabel(id) {
    const d = getDevice(id);
    if (!d) return;
    openPrompt("Instance Name", "Instance name:", d.label, (nl) => {
      if (nl === null || nl.trim() === "") return;
      d.label = nl.trim();
      updateDeviceLabel(d);
      saveHistory();
      autosave();
      updatePropsPanel();
    });
  }

  // ============================================================
  // Annotation tools (arrow, rect, circle)
  // ============================================================

  function handleAnnoMouseDown(world) {
    const pt = snapPt(world);
    dragState = {
      type: "anno",
      annoType: state.tool, // arrow/rect/circle
      startX: pt.x, startY: pt.y,
      endX: pt.x, endY: pt.y,
      el: null,
    };
    // create preview in overlay
    dragState.el = createAnnotationEl({
      type: dragState.annoType, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y,
    });
    gOverlay.appendChild(dragState.el);
  }

  function circleFromBox(x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const r = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;
    return { cx, cy, r };
  }

  // geometry is defined by the annotation box endpoints; these two helpers
  // are the single source of truth for creating and updating the four shape
  // kinds (rect / circle / arrow / plain line)
  function applyAnnoShape(el2, a) {
    if (a.type === "rect") {
      const x = Math.min(a.x1, a.x2);
      const y = Math.min(a.y1, a.y2);
      el2.setAttribute("x", x);
      el2.setAttribute("y", y);
      el2.setAttribute("width", Math.abs(a.x2 - a.x1));
      el2.setAttribute("height", Math.abs(a.y2 - a.y1));
    } else if (a.type === "circle") {
      const c = circleFromBox(a.x1, a.y1, a.x2, a.y2);
      el2.setAttribute("cx", c.cx);
      el2.setAttribute("cy", c.cy);
      el2.setAttribute("r", c.r);
    } else if (a.type === "arrow") {
      el2.setAttribute("d", arrowPath(a.x1, a.y1, a.x2, a.y2));
    } else {
      el2.setAttribute("d", `M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}`);
    }
    return el2;
  }

  function createAnnotationEl(a) {
    const el2 = el(a.type === "rect" ? "rect" : a.type === "circle" ? "circle" : "path", { class: "anno" });
    return applyAnnoShape(el2, a);
  }

  function handleAnnoMove(world) {
    const pt = snapPt(world);
    dragState.endX = pt.x;
    dragState.endY = pt.y;
    applyAnnoShape(dragState.el, {
      type: dragState.annoType,
      x1: dragState.startX, y1: dragState.startY,
      x2: dragState.endX, y2: dragState.endY,
    });
  }

  function handleAnnoEnd() {
    if (dragState.el) dragState.el.remove();
    if (Math.abs(dragState.endX - dragState.startX) < 2 &&
        Math.abs(dragState.endY - dragState.startY) < 2) return;

    const id = uid("a");
    const anno = {
      id, type: dragState.annoType,
      x1: dragState.startX, y1: dragState.startY,
      x2: dragState.endX, y2: dragState.endY,
      el: null,
    };
    // create real element
    anno.el = createAnnotationEl(anno);
    gAnnos.appendChild(anno.el);
    state.annotations.push(anno);
    saveHistory();
    autosave();
    updateEmptyHint();
  }

  function cancelDrawAnno() {
    // annotation gestures are finalized on mouseup by handleAnnoEnd()
  }

  function arrowPath(x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const ah = 8; // arrow head size
    const hx1 = x2 - ah * Math.cos(angle - Math.PI / 6);
    const hy1 = y2 - ah * Math.sin(angle - Math.PI / 6);
    const hx2 = x2 - ah * Math.cos(angle + Math.PI / 6);
    const hy2 = y2 - ah * Math.sin(angle + Math.PI / 6);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${hx1} ${hy1} L ${x2} ${y2} L ${hx2} ${hy2}`;
  }

  function updateAnnotation(a) {
    applyAnnoShape(a.el, a);
  }

  // ============================================================
  // Properties panel
  // ============================================================

  function updatePropsPanel() {
    if (state.selection.size === 0) {
      propsBody.innerHTML = '<div class="props-empty">Nothing selected</div>';
      return;
    }
    if (state.selection.size > 1) {
      propsBody.innerHTML = `<div class="props-empty">${state.selection.size} items selected</div>`;
      return;
    }
    const id = [...state.selection][0];
    const dev = getDevice(id);
    if (dev) {
      renderDeviceProps(dev);
      return;
    }
    const w = getWire(id);
    if (w) {
      propsBody.innerHTML = `
        <div class="prop-row"><label>Wire</label><div style="font-size:12.5px">${w.points.length} segments</div></div>
        <div class="prop-btns"><button class="btn" onclick="App.deleteSelection()">Delete</button></div>
      `;
      return;
    }
    const t = getText(id);
    if (t) {
      propsBody.innerHTML = `
        <div class="prop-row"><label>Text</label><input type="text" id="prop-text" value="${escapeHtml(t.text)}"></div>
        <div class="prop-row"><label>Font size</label>
          <select id="prop-fs">
            <option value="24" ${t.fontSize===24?'selected':''}>S</option>
            <option value="30" ${t.fontSize===30?'selected':''}>M</option>
            <option value="38" ${t.fontSize===38?'selected':''}>L</option>
          </select>
        </div>
      `;
      document.getElementById("prop-text").addEventListener("change", (e) => {
        t.text = e.target.value; t.el.textContent = t.text; saveHistory(); autosave();
      });
      document.getElementById("prop-fs").addEventListener("change", (e) => {
        t.fontSize = parseInt(e.target.value);
        t.el.setAttribute("font-size", t.fontSize);
        saveHistory(); autosave();
      });
      return;
    }
    const a = getAnnotation(id);
    if (a) {
      const names = { arrow: "Arrow", rect: "Rectangle", circle: "Circle", line: "Line" };
      propsBody.innerHTML = `
        <div class="prop-row"><label>Annotation</label><div style="font-size:12.5px">${names[a.type] || a.type}</div></div>
        <div class="prop-btns"><button class="btn" style="color:#c33" onclick="App.deleteSelection()">Delete</button></div>
      `;
      return;
    }
    propsBody.innerHTML = '<div class="props-empty">Nothing selected</div>';
  }

  function renderDeviceProps(dev) {
    const def = ComponentLib.byId(dev.type);
    let html = `
      <div class="prop-row"><label>Component</label><div style="font-size:12.5px;font-weight:600">${def.name}</div></div>
      <div class="prop-row"><label>Instance</label><input type="text" id="prop-label" value="${escapeHtml(dev.label)}"></div>
    `;
    // params
    for (const k in dev.params) {
      html += `<div class="prop-row"><label>${k}</label><input type="text" id="prop-${k}" value="${escapeHtml(dev.params[k])}"></div>`;
    }
    html += `
      <div class="prop-btns">
        <button class="btn" onclick="App.rotateSelection()">Rotate</button>
        <button class="btn" onclick="App.mirrorSelection('x')">Mirror X</button>
      </div>
      <div class="prop-btns">
        <button class="btn" onclick="App.mirrorSelection('y')">Mirror Y</button>
        <button class="btn" onclick="App.duplicateSelection()">Dup</button>
      </div>
      <div class="prop-btns">
        <button class="btn" style="color:#c33" onclick="App.deleteSelection()">Delete</button>
      </div>
    `;
    propsBody.innerHTML = html;

    document.getElementById("prop-label").addEventListener("change", (e) => {
      dev.label = e.target.value; updateDeviceLabel(dev); saveHistory(); autosave();
    });
    for (const k in dev.params) {
      document.getElementById("prop-" + k).addEventListener("change", (e) => {
        dev.params[k] = e.target.value; updateDeviceLabel(dev); saveHistory(); autosave();
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ============================================================
  // Edit operations
  // ============================================================

  function deleteSelection() {
    if (state.selection.size === 0) return;
    for (const id of [...state.selection]) {
      const dev = getDevice(id);
      if (dev) { dev.gEl.remove(); state.devices = state.devices.filter(d => d.id !== id); continue; }
      const w = getWire(id);
      if (w) { w.el.remove(); state.wires = state.wires.filter(x => x.id !== id); continue; }
      const t = getText(id);
      if (t) { t.el.remove(); state.texts = state.texts.filter(x => x.id !== id); continue; }
      const a = getAnnotation(id);
      if (a) { a.el.remove(); state.annotations = state.annotations.filter(x => x.id !== id); continue; }
    }
    state.selection.clear();
    updateJunctions();
    updatePropsPanel();
    saveHistory();
    autosave();
    updateEmptyHint();
  }

  function duplicateSelection() {
    if (state.selection.size === 0) return;
    const newIds = [];
    const dx = 40, dy = 40;
    for (const id of [...state.selection]) {
      const dev = getDevice(id);
      if (dev) {
        const nd = placeDevice(dev.type, dev.x + dx, dev.y + dy, dev.rot, dev.mirrorX, dev.mirrorY,
          { ...dev.params }, null, dev.labelOff ? { ...dev.labelOff } : null);
        // placeDevice already assigns the next label and renders it
        if (nd) newIds.push(nd.id);
        continue;
      }
      const w = getWire(id);
      if (w) {
        const path = el("path", { class: "wire", d: pointsToPath(w.points.map(p => ({ x: p.x + dx, y: p.y + dy }))) });
        path.style.strokeWidth = state.wireWidth;
        gWires.appendChild(path);
        const nw = { id: uid("wire"), points: w.points.map(p => ({ x: p.x + dx, y: p.y + dy })), el: path };
        state.wires.push(nw);
        newIds.push(nw.id);
        continue;
      }
      const t = getText(id);
      if (t) {
        const nid = addText(t.x + dx, t.y + dy, t.text);
        newIds.push(nid);
        continue;
      }
      const a = getAnnotation(id);
      if (a) {
        const na = { id: uid("a"), type: a.type, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy, el: null };
        na.el = createAnnotationEl(na);
        gAnnos.appendChild(na.el);
        state.annotations.push(na);
        newIds.push(na.id);
      }
    }
    deselectAll();
    for (const id of newIds) addToSelection(id);
    updateJunctions();
    saveHistory();
    autosave();
  }

  function rotateSelection() {
    if (state.selection.size === 0) return;
    for (const id of state.selection) {
      const dev = getDevice(id);
      if (dev) { dev.rot = (dev.rot + 90) % 360; updateDeviceTransform(dev); }
    }
    updateJunctions();
    saveHistory();
    autosave();
    updatePropsPanel();
  }

  function mirrorSelection(axis) {
    if (state.selection.size === 0) return;
    for (const id of state.selection) {
      const dev = getDevice(id);
      if (!dev) continue;
      if (axis === "x") dev.mirrorX = !dev.mirrorX;
      else dev.mirrorY = !dev.mirrorY;
      updateDeviceTransform(dev);
    }
    updateJunctions();
    saveHistory();
    autosave();
    updatePropsPanel();
  }

  function clearAll() {
    for (const d of state.devices) d.gEl.remove();
    for (const w of state.wires) w.el.remove();
    for (const t of state.texts) t.el.remove();
    for (const a of state.annotations) a.el.remove();
    for (const j of state.junctions) j.el.remove();
    state.devices = [];
    state.wires = [];
    state.texts = [];
    state.annotations = [];
    state.junctions = [];
    state.selection.clear();
    for (const k in labelCounters) labelCounters[k] = 0;
    updatePropsPanel();
    updateEmptyHint();
  }

  // ============================================================
  // View / zoom / pan
  // ============================================================

  function applyViewTransform() {
    viewport.setAttribute("transform",
      `translate(${state.view.x},${state.view.y}) scale(${state.view.scale})`);
    updateZoomLabel();
  }

  function zoomAt(sx, sy, factor) {
    const newScale = Math.max(0.1, Math.min(4, state.view.scale * factor));
    const actualFactor = newScale / state.view.scale;
    state.view.x = sx - (sx - state.view.x) * actualFactor;
    state.view.y = sy - (sy - state.view.y) * actualFactor;
    state.view.scale = newScale;
    applyViewTransform();
  }

  function updateZoomLabel() {
    zoomLabel.textContent = Math.round(state.view.scale * 100) + "%";
  }

  function fitView() {
    const rect = canvas.getBoundingClientRect();
    const padding = 60;
    // compute bounding box of all content
    let minX = -100, minY = -100, maxX = 100, maxY = 100;
    if (state.devices.length > 0 || state.wires.length > 0) {
      minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
      for (const d of state.devices) {
        const pins = ComponentLib.getPins(d.type);
        for (const p of pins) {
          const tp = transformPin(p, d);
          minX = Math.min(minX, tp.x); maxX = Math.max(maxX, tp.x);
          minY = Math.min(minY, tp.y); maxY = Math.max(maxY, tp.y);
        }
      }
      for (const w of state.wires) {
        for (const p of w.points) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
      }
    }
    const w = maxX - minX || 200;
    const h = maxY - minY || 200;
    const scaleX = (rect.width - padding * 2) / w;
    const scaleY = (rect.height - padding * 2) / h;
    state.view.scale = Math.min(scaleX, scaleY, 1.5);
    state.view.x = rect.width / 2 - (minX + maxX) / 2 * state.view.scale;
    state.view.y = rect.height / 2 - (minY + maxY) / 2 * state.view.scale;
    applyViewTransform();
  }

  function bindStatusBar() {
    document.getElementById("btn-grid").addEventListener("click", () => {
      state.gridVisible = !state.gridVisible;
      gridRect.style.display = state.gridVisible ? "" : "none";
    });
    document.getElementById("btn-zoom-in").addEventListener("click", () => {
      const rect = canvas.getBoundingClientRect();
      zoomAt(rect.width / 2, rect.height / 2, 1.2);
    });
    document.getElementById("btn-zoom-out").addEventListener("click", () => {
      const rect = canvas.getBoundingClientRect();
      zoomAt(rect.width / 2, rect.height / 2, 1 / 1.2);
    });
    document.getElementById("btn-fit").addEventListener("click", fitView);
  }

  // ============================================================
  // Dialogs
  // ============================================================

  function bindDialogs() {
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.closest(".modal").classList.add("hidden");
      });
    });
    document.querySelectorAll(".modal").forEach(m => {
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.add("hidden");
      });
    });
    document.getElementById("text-dialog-copy").addEventListener("click", () => {
      navigator.clipboard.writeText(textDialogBody.value);
    });
    document.getElementById("text-dialog-download").addEventListener("click", () => {
      const blob = new Blob([textDialogBody.value], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = state.circuitName.replace(/\s+/g, "_") + ".txt";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function showTextDialog(title, text) {
    textDialogTitle.textContent = title;
    textDialogBody.value = text;
    textDialog.classList.remove("hidden");
  }

  // ============================================================
  // Save / Load / Undo / Redo
  // ============================================================

  function saveHistory() {
    // truncate forward history
    state.history = state.history.slice(0, state.historyIdx + 1);
    state.history.push(serialize());
    state.historyIdx++;
    if (state.history.length > 50) {
      state.history.shift();
      state.historyIdx--;
    }
  }

  function undo() {
    if (state.historyIdx <= 0) return;
    state.historyIdx--;
    deserialize(state.history[state.historyIdx]);
    updatePropsPanel();
    autosave();
  }

  function redo() {
    if (state.historyIdx >= state.history.length - 1) return;
    state.historyIdx++;
    deserialize(state.history[state.historyIdx]);
    updatePropsPanel();
    autosave();
  }

  function serialize() {
    return {
      name: state.circuitName,
      devices: state.devices.map(d => ({
        id: d.id, type: d.type, x: d.x, y: d.y,
        rot: d.rot, mirrorX: d.mirrorX, mirrorY: d.mirrorY,
        params: { ...d.params }, label: d.label,
        labelOff: d.labelOff ? { ...d.labelOff } : undefined,
      })),
      wires: state.wires.map(w => ({
        id: w.id, points: w.points.map(p => ({ ...p })),
      })),
      texts: state.texts.map(t => ({
        id: t.id, x: t.x, y: t.y, text: t.text, fontSize: t.fontSize,
      })),
      annotations: state.annotations.map(a => ({
        id: a.id, type: a.type, x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
      })),
      nextId: state.nextId,
      labelCounters: { ...labelCounters },
      style: {
        wireWidth: state.wireWidth,
        fontSize: state.fontSize,
        gridVisible: state.gridVisible,
        orthogonalWire: state.orthogonalWire,
      },
    };
  }

  function deserialize(data) {
    // Validate the entire document before touching the current drawing.
    data = CircuitCore.normalizeDocument(data, ComponentLib);
    const stagedDevices = data.devices.map(dd => ({ dd, g: ComponentLib.createDevice(dd.type, data.style.wireWidth) }));
    clearAll();
    state.circuitName = data.name || "New Circuit";
    document.getElementById("circuit-name").value = state.circuitName;
    state.nextId = data.nextId || 1;
    Object.assign(labelCounters, data.labelCounters || {});

    if (data.style) {
      state.wireWidth = data.style.wireWidth ?? state.wireWidth;
      state.fontSize = data.style.fontSize ?? state.fontSize;
      state.gridVisible = data.style.gridVisible ?? state.gridVisible;
      state.orthogonalWire = data.style.orthogonalWire ?? state.orthogonalWire;
      syncStyleControls();
      gridRect.style.display = state.gridVisible ? "" : "none";
    }

    for (const { dd, g } of stagedDevices) {
      gDevices.appendChild(g);
      const dev = {
        id: dd.id, type: dd.type, x: dd.x, y: dd.y,
        rot: dd.rot || 0, mirrorX: dd.mirrorX || false, mirrorY: dd.mirrorY || false,
        params: { ...dd.params }, label: dd.label,
        labelOff: dd.labelOff ? { ...dd.labelOff } : null,
        gEl: g,
      };
      g.dataset.instanceId = dd.id;
      state.devices.push(dev);
      updateDeviceTransform(dev);
      updateDeviceLabel(dev);
    }
    for (const wd of data.wires || []) {
      const path = el("path", { class: "wire", d: pointsToPath(wd.points) });
      path.style.strokeWidth = state.wireWidth;
      gWires.appendChild(path);
      state.wires.push({ id: wd.id, points: wd.points.map(p => ({ ...p })), el: path });
    }
    for (const td of data.texts || []) {
      const t = el("text", {
        class: "lbl-text", x: td.x, y: td.y,
        "font-size": td.fontSize || state.fontSize, "text-anchor": "start"
      });
      t.textContent = td.text;
      gTexts.appendChild(t);
      state.texts.push({ id: td.id, x: td.x, y: td.y, text: td.text, fontSize: td.fontSize || state.fontSize, el: t });
    }
    for (const ad of data.annotations || []) {
      const el2 = createAnnotationEl(ad);
      gAnnos.appendChild(el2);
      state.annotations.push({ id: ad.id, type: ad.type, x1: ad.x1, y1: ad.y1, x2: ad.x2, y2: ad.y2, el: el2 });
    }
    updateJunctions();
    updateEmptyHint();
  }

  function saveToFile() {
    const data = serialize();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.circuitName.replace(/\s+/g, "_") + ".json";
    a.click();
    URL.revokeObjectURL(url);
    setSaveStatus("Saved");
    hasUnsavedChanges = false;
  }

  function bindFileInput() {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          deserialize(data);
          saveHistory();
          hasUnsavedChanges = false;
          fitView();
        } catch (err) {
          alert("Failed to open file: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // ---- autosave to localStorage ----
  const STORAGE_KEY = "schematic_canvas_autosave";
  let hasUnsavedChanges = false;

  function updateRecoveryButton() {
    const button = document.querySelector('[data-act="restore-autosave"]');
    if (!button) return;
    try { button.disabled = !localStorage.getItem(STORAGE_KEY); }
    catch (e) { button.disabled = true; }
  }

  function autosave() {
    hasUnsavedChanges = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
      setSaveStatus("Recovery copy saved");
      updateRecoveryButton();
    } catch (e) { setSaveStatus("Recovery failed — save project to file"); }
  }

  function tryLoadAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const hasAny = data.devices?.length || data.wires?.length ||
        data.texts?.length || data.annotations?.length;
      if (!data || !hasAny) return false;
      deserialize(data);
      return true;
    } catch (e) { return false; }
  }

  function setSaveStatus(msg) {
    const el = document.getElementById("save-status");
    el.textContent = msg;
    clearTimeout(setSaveStatus._t);
    setSaveStatus._t = setTimeout(() => { el.textContent = ""; }, 2000);
  }

  // ============================================================
  // Status / misc
  // ============================================================

  function updateStatus() {
    if (!statusLeft) return;
    const toolNames = {
      select: "Select", insert: "Insert", wire: "Wire", text: "Text",
      arrow: "Arrow", rect: "Rectangle", circle: "Circle", style: "Style",
    };
    let s = toolNames[state.tool] || "Select";
    if (state.tool === "wire") {
      s += ` · Orthogonal: ${state.orthogonalWire ? "ON" : "OFF"} (F3)`;
      s += wireState.active
        ? " · <b>Routing</b>: click empty space for a corner, click a pin to finish · Esc cancel"
        : " · Click the start point, then click the endpoint to finish";
    }
    if (state.tool === "insert" && state.placeId) {
      const def = ComponentLib.byId(state.placeId);
      s = `Placing <b>${def.name}</b> · click to place · Esc cancel`;
    }
    statusLeft.innerHTML = s;
  }

  function updateEmptyHint() {
    const hasContent = state.devices.length > 0 || state.wires.length > 0 ||
      state.texts.length > 0 || state.annotations.length > 0;
    emptyHint.style.display = hasContent ? "none" : "flex";
  }

  // ---- resize handler ----
  window.addEventListener("resize", () => {
    // grid rect fills viewport
    if (gridRect) {
      const r = canvas.getBoundingClientRect();
      gridRect.setAttribute("width", r.width * 3);
      gridRect.setAttribute("height", r.height * 3);
      gridRect.setAttribute("x", -r.width);
      gridRect.setAttribute("y", -r.height);
    }
  });

  // initial grid size
  setTimeout(() => {
    const r = canvas.getBoundingClientRect();
    gridRect.setAttribute("width", r.width * 3);
    gridRect.setAttribute("height", r.height * 3);
    gridRect.setAttribute("x", -r.width);
    gridRect.setAttribute("y", -r.height);
  }, 10);

  // ============================================================
  // Public API (for HTML buttons and other modules)
  // ============================================================

  const api = {
    init: function() { init(); api._bindDomRefs(); },
    state,
    serialize,
    deserialize,
    deleteSelection,
    duplicateSelection,
    rotateSelection,
    mirrorSelection,
    fitView,
    showTextDialog,
    undo,
    redo,
    G,
    transformPin,
    getDevice,
    getWire,
    getText,
    getAnnotation,
    SVG_NS,
    el,
    updateJunctions,
    placeDevice,
    // DOM refs will be populated after init() runs
    gWires: null, gDevices: null, gAnnos: null, gTexts: null, gNodes: null, gOverlay: null,
    viewport: null, canvas: null,
    _bindDomRefs: function() {
      api.gWires = gWires;
      api.gDevices = gDevices;
      api.gAnnos = gAnnos;
      api.gTexts = gTexts;
      api.gNodes = gNodes;
      api.gOverlay = gOverlay;
      api.viewport = viewport;
      api.canvas = canvas;
    }
  };

  return api;

})();

// boot
window.addEventListener("DOMContentLoaded", () => App.init());
