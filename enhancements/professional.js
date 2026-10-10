/* Additive modules inside the original closure. No screen or financial formula is replaced. */
const LedgerProfessional = (() => {
  const settingsKey = "ledger.professional.v1";
  const defaults = {
    design: true,
    fast: true,
    tables: true,
    charts: true,
    density: "comfortable",
    reading: "standard",
    motion: "quiet",
  };
  function clean(value) {
    const x = value && typeof value === "object" ? value : {};
    const next = { ...defaults };
    for (const k of ["design", "fast", "tables", "charts"])
      if (typeof x[k] === "boolean") next[k] = x[k];
    for (const [k, allowed] of Object.entries({
      density: ["comfortable", "compact"],
      reading: ["standard", "large"],
      motion: ["quiet", "original"],
    }))
      if (allowed.includes(x[k])) next[k] = x[k];
    return next;
  }
  let settings = clean(ls.get(settingsKey));
  const root = document.documentElement;
  function apply() {
    root.dataset.lpDesign = settings.design ? "on" : "off";
    root.dataset.lpDensity = settings.density;
    root.dataset.lpReading = settings.reading;
    root.dataset.lpMotion = settings.motion;
  }
  apply();

  // Cache only inside one synchronous route evaluation: never across edits or saves.
  let cache = null;
  const metrics = { hits: 0, misses: 0, passes: 0 };
  function memoize(fn, name) {
    return function (...args) {
      if (!cache || !settings.fast) return fn.apply(this, args);
      let byObject = cache.get(name);
      if (!byObject) cache.set(name, (byObject = new WeakMap()));
      const first = args[0];
      if (!first || typeof first !== "object") return fn.apply(this, args);
      let records = byObject.get(first);
      if (!records) byObject.set(first, (records = []));
      const existing = records.find(
        (x) =>
          (name !== "model" || (x.scenario === F.k && x.method === F.fm)) &&
          x.args.length === args.length &&
          x.args.every((a, i) => a === args[i]),
      );
      if (existing) {
        metrics.hits++;
        return existing.value;
      }
      metrics.misses++;
      const value = fn.apply(this, args);
      records.push({ args, value, scenario: F.k, method: F.fm });
      return value;
    };
  }
  model = memoize(model, "model");
  finAt = memoize(finAt, "finAt");
  reportRate = memoize(reportRate, "reportRate");
  for (const route of Object.keys(V)) {
    const original = V[route];
    V[route] = function (...args) {
      const parentCache = cache;
      cache = new Map();
      metrics.passes++;
      try {
        return original.apply(this, args);
      } finally {
        cache = parentCache;
      }
    };
  }
  // Preserve the exact original numeric values without spinning animation frames.
  const originalCount = count;
  count = function (fresh) {
    if (settings.motion === "original") return originalCount(fresh);
  };
  let searchTimer, rangeTimer, pendingSearch, pendingRange;
  function clearPending() {
    clearTimeout(searchTimer);
    clearTimeout(rangeTimer);
    pendingSearch = pendingRange = undefined;
  }
  function flush() {
    const q = pendingSearch,
      k = pendingRange;
    clearPending();
    if (q !== undefined) setF("q", q);
    if (k !== undefined) setF("k", k);
  }
  $("#fq").addEventListener(
    "input",
    (event) => {
      if (!settings.fast) return;
      event.stopImmediatePropagation();
      pendingSearch = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = pendingSearch;
        pendingSearch = undefined;
        if (q !== undefined) setF("q", q);
      }, 120);
    },
    true,
  );
  $("#fk").addEventListener(
    "input",
    (event) => {
      if (!settings.fast) return;
      event.stopImmediatePropagation();
      pendingRange = Number(event.target.value);
      $("#fkv").textContent =
        (pendingRange > 0 ? "+" : "") + pendingRange + "%";
      clearTimeout(rangeTimer);
      rangeTimer = setTimeout(() => {
        const k = pendingRange;
        pendingRange = undefined;
        if (k !== undefined) setF("k", k);
      }, 64);
    },
    true,
  );
  $("#fq").addEventListener("change", flush);
  $("#fk").addEventListener("change", flush);
  // Existing inline handlers cannot see undo/redo inside the original closure.
  $("#ubtn").onclick = () => {
    flush();
    undo();
  };
  $("#rbtn").onclick = () => {
    flush();
    redo();
  };
  window.addEventListener("hashchange", flush, true);
  $("#fpreset").addEventListener("change", (event) => {
    if (event.target.value && event.target.value !== "__del") clearPending();
  }, true);
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest('#freset,[data-act="reset"]')) clearPending();
      if (event.target.closest('[data-act="resetk"]')) {
        clearTimeout(rangeTimer);
        pendingRange = undefined;
      }
      if (event.target.closest("#fpsave")) flush();
    },
    true,
  );

  // Use the host's existing collapse control; explicit device choices take priority.
  const phone = matchMedia("(max-width: 640px)");
  function mobileFilters() {
    if (ls.get("ledger.baropen") === null) {
      barOpen = !phone.matches;
      syncBarVis();
    }
  }
  mobileFilters();
  phone.addEventListener("change", mobileFilters);

  const display = document.createElement("dialog");
  display.className = "lp-display";
  display.setAttribute("aria-labelledby", "lp-display-title");
  document.body.append(display);
  const displayButton = document.createElement("button");
  displayButton.type = "button";
  displayButton.className = "btn";
  displayButton.id = "lp-display-button";
  displayButton.textContent = "Display";
  displayButton.setAttribute("aria-haspopup", "dialog");
  $("#theme").after(displayButton);
  function displayForm() {
    const toggle = (key, label) =>
      `<label><span>${label}</span><input type="checkbox" data-lp-setting="${key}" ${settings[key] ? "checked" : ""}></label>`;
    const select = (key, label, options) =>
      `<label><span>${label}</span><select data-lp-setting="${key}">${options.map(([value, title]) => `<option value="${value}" ${settings[key] === value ? "selected" : ""}>${title}</option>`).join("")}</select></label>`;
    display.innerHTML = `<h2 id="lp-display-title">Your display preferences</h2><p>Choose the tools and reading style that suit your work.</p>${toggle("design", "Professional styling")}${toggle("fast", "Search batching and render reuse")}${toggle("tables", "Table search and visible-row CSV")}${toggle("charts", "Chart inspection, SVG and PNG downloads")}${select(
      "density",
      "Table spacing",
      [
        ["comfortable", "Comfortable"],
        ["compact", "Compact"],
      ],
    )}${select("reading", "Text size", [
      ["standard", "Standard"],
      ["large", "Larger"],
    ])}${select("motion", "Effects", [
      ["quiet", "Quiet"],
      ["original", "Original"],
    ])}<div class="lp-dialog-status" role="status">Preferences saved on this device</div><footer><button class="btn" data-lp-reset>Reset preferences</button><button class="btn pri" data-lp-close>Done</button></footer>`;
  }
  displayButton.addEventListener("click", () => {
    flush();
    displayForm();
    display.showModal();
  });
  function persist() {
    apply();
    const saved = ls.set(settingsKey, settings);
    display.querySelector(".lp-dialog-status").textContent = saved
      ? "Preferences saved on this device"
      : "Browser storage unavailable · preferences apply for this session";
    augment();
  }
  display.addEventListener("change", (event) => {
    const key = event.target.dataset.lpSetting;
    if (!Object.hasOwn(defaults, key)) return;
    flush();
    settings = clean({
      ...settings,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    });
    persist();
  });
  display.addEventListener("click", (event) => {
    if (event.target.closest("[data-lp-close]")) display.close();
    if (event.target.closest("[data-lp-reset]")) {
      settings = { ...defaults };
      displayForm();
      persist();
    }
  });

  const tableStates = new WeakMap();
  const tableQueries = new Map();
  function tableKey(table) {
    const card = table.closest(".card");
    return JSON.stringify([
      location.hash || "#/home",
      [...view.querySelectorAll("table")].indexOf(table),
      card?.querySelector("h2")?.textContent || "Table",
      [...table.tHead.querySelectorAll("th")].map((cell) => cell.dataset.sort || cell.textContent),
    ]);
  }
  function makeTableTools(table) {
    if (!table.tHead || !table.tBodies.length || tableStates.has(table)) return;
    const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
    // Interactive editors and merged hierarchical rows retain their original workflow.
    if (
      rows.length < 3 ||
      rows.some(
        (row) =>
          row.querySelector("input,select,textarea") ||
          [...row.cells].some((cell) => cell.rowSpan > 1 || cell.colSpan > 1),
      )
    )
      return;
    const tools = document.createElement("div");
    tools.className = "lp-table-tools";
    const heading =
      table.closest(".card")?.querySelector("h2")?.textContent || "Table";
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Find in this table";
    input.setAttribute("aria-label", `Find in ${heading}`);
    const key = tableKey(table);
    input.value = tableQueries.get(key) || "";
    const output = document.createElement("output");
    output.setAttribute("aria-live", "polite");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = "Visible rows CSV";
    const state = { tools, rows, input, output, query: "" };
    tableStates.set(table, state);
    const texts = rows.map((row) => row.textContent.toLocaleLowerCase());
    const originallyHidden = rows.map((row) => row.hidden);
    function filter() {
      state.query = input.value.trim().toLocaleLowerCase();
      tableQueries.delete(key);
      if (input.value) tableQueries.set(key, input.value);
      if (tableQueries.size > 64) tableQueries.delete(tableQueries.keys().next().value);
      let visible = 0;
      rows.forEach((row, i) => {
        const filtered =
          settings.tables && !!state.query && !texts[i].includes(state.query);
        const hidden = originallyHidden[i] || filtered;
        row.hidden = hidden;
        row.classList.toggle(
          "lp-filtered-row",
          filtered && !originallyHidden[i],
        );
        if (!hidden) visible++;
      });
      output.textContent = `${visible} / ${rows.length} rows · portfolio totals unchanged`;
    }
    state.filter = filter;
    input.addEventListener("input", filter);
    button.addEventListener("click", () => {
      const csvCell = (text) => {
        let value = text.replace(/\s+/g, " ").trim();
        if (/^[=+\-@]/.test(value)) value = "'" + value;
        return '"' + value.replace(/"/g, '""') + '"';
      };
      const records = [
        ...table.tHead.rows,
        ...rows.filter((row) => !row.hidden),
      ];
      const csv =
        "\ufeff" +
        records
          .map((row) =>
            [...row.cells].map((cell) => csvCell(cell.innerText)).join(","),
          )
          .join("\r\n");
      download("portfolio-table-visible.csv", csv, "text/csv;charset=utf-8");
    });
    tools.append(input, output, button);
    const hint = document.createElement("small");
    hint.className = "lp-table-hint";
    hint.textContent = "CSV contains matching displayed text. Original Print includes all rows.";
    tools.append(hint);
    (table.closest(".tw") || table).before(tools);
    filter();
  }
  function styledChart(svg) {
    const clone = svg.cloneNode(true);
    const originals = [svg, ...svg.querySelectorAll("*")],
      copies = [clone, ...clone.querySelectorAll("*")];
    const styleKeys = [
      "fill",
      "stroke",
      "stroke-width",
      "stroke-dasharray",
      "opacity",
      "fill-opacity",
      "stroke-opacity",
      "font-family",
      "font-size",
      "font-weight",
      "text-anchor",
      "dominant-baseline",
    ];
    originals.forEach((node, i) => {
      const style = getComputedStyle(node);
      for (const key of styleKeys) {
        const value = style
          .getPropertyValue(key)
          .replace(/url\(["']?[^)]*#([^\)"']+)["']?\)/g, "url(#$1)");
        copies[i].style.setProperty(key, value);
        if (copies[i].getAttribute(key)?.includes("var("))
          copies[i].setAttribute(key, value);
      }
    });
    return clone;
  }
  const svgNS = "http://www.w3.org/2000/svg";
  function svgElement(tag, attributes = {}, text) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function chartContext(svg) {
    const selected = (id, key) => {
      const value = F[key] || (key === "fm" ? "auto" : "all");
      return [...($(id)?.options || [])].find((option) => option.value === value)?.textContent || String(value);
    };
    const label = svg.getAttribute("aria-label") || "Portfolio chart";
    const route = location.hash || "#/home";
    const lines = [
      `${$("#title").textContent} · ${route}`,
      `Country: ${selected("#fc", "c")} · Sector: ${selected("#fs", "s")} · Signal: ${selected("#fg", "g")}`,
      `Search: ${F.q || "All projects"} · Selected date window: ${F.ds || "Unrestricted"} to ${F.de || "Unrestricted"}`,
      `Scenario: ${Number(F.k) > 0 ? "+" : ""}${Number(F.k) || 0}% · Forecast method: ${selected("#fm", "fm")}`,
    ];
    if (route.startsWith("#/project/")) lines.push("Project detail: global filters may not restrict this chart.");
    if (route.startsWith("#/country/")) lines.push(`Country detail scope: ${decodeURIComponent(route.split("/")[2])}`);
    const legend = [...(svg.closest(".card")?.querySelectorAll(".leg") || [])]
      .map((node) => node.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ");
    if (legend) lines.push(legend);
    lines.push(`Exported: ${new Date().toISOString()} (UTC). Source dates are retained per record; export time is not a source date.`);
    return { label, route, lines };
  }
  function rasterSize(width, height) {
    const scale = Math.min(1800 / width, 8192 / width, 8192 / height, Math.sqrt(8000000 / (width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
  }
  async function exportChart(svg, format) {
    flush();
    if (!svg.isConnected) throw Error("Selection changed. Download the updated chart.");
    const clone = styledChart(svg);
    const box = svg.viewBox.baseVal;
    const w = box.width || svg.clientWidth || 800,
      height = box.height || svg.clientHeight || 400;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", w);
    clone.setAttribute("height", height);
    if (!box.width) clone.setAttribute("viewBox", `0 0 ${w} ${height}`);
    const context = chartContext(svg);
    const width = Math.max(720, w + 40);
    const wrapped = context.lines.flatMap((line) => {
      const chunks = []; let rest = line;
      while (rest.length > 86) {
        const space = rest.lastIndexOf(" ", 86);
        const at = space > 0 ? space : 86;
        chunks.push(rest.slice(0, at)); rest = rest.slice(at).trimStart();
      }
      chunks.push(rest); return chunks;
    });
    const captionHeight = 65 + wrapped.length * 20;
    const fullHeight = captionHeight + height + 20;
    const exported = svgElement("svg", { xmlns: svgNS, width, height: fullHeight, viewBox: `0 0 ${width} ${fullHeight}`, role: "img", "aria-label": context.label });
    exported.append(svgElement("desc", {}, [context.label, ...context.lines].join("\n")));
    exported.append(svgElement("rect", { width, height: fullHeight, fill: getComputedStyle(document.body).getPropertyValue("--surface").trim() || "#fff" }));
    const ink = getComputedStyle(document.body).color;
    exported.append(svgElement("text", { x: 20, y: 30, fill: ink, "font-family": "sans-serif", "font-size": 18, "font-weight": 700 }, context.label));
    wrapped.forEach((line, i) => exported.append(svgElement("text", { x: 20, y: 57 + i * 20, fill: ink, "font-family": "sans-serif", "font-size": 13 }, line)));
    clone.setAttribute("x", 20); clone.setAttribute("y", captionHeight);
    exported.append(clone);
    const size = rasterSize(width, fullHeight);
    if (format === "png") {
      exported.setAttribute("width", size.width);
      exported.setAttribute("height", size.height);
    }
    const slug = `${context.label}-${context.route}-${F.c || "all"}-scenario-${F.k || 0}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160);
    const filename = `portfolio-${slug}`;
    const blob = new Blob([new XMLSerializer().serializeToString(exported)], {
      type: "image/svg+xml;charset=utf-8",
    });
    if (format === "svg") return download2(`${filename}.svg`, blob);
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(Error("Chart could not be rendered"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!png) throw Error("PNG export unavailable");
      download2(`${filename}.png`, png);
      if (size.width < 1799) toast("PNG size limited for this tall chart. Use SVG for full-scale detail.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const inspection = document.createElement("dialog");
  inspection.className = "lp-inspection";
  inspection.setAttribute("aria-labelledby", "lp-inspection-title");
  document.body.append(inspection);
  function inspectChart(svg) {
    inspection.replaceChildren();
    const title = document.createElement("h2");
    title.id = "lp-inspection-title";
    title.textContent = svg.getAttribute("aria-label") || "Chart inspection";
    const note = document.createElement("p");
    note.textContent = "Read-only enlarged chart. Scroll to inspect it; expand activities in the original chart.";
    const scroller = document.createElement("div");
    scroller.className = "lp-inspection-chart";
    scroller.tabIndex = 0;
    scroller.setAttribute("aria-label", "Enlarged chart, scroll horizontally and vertically");
    const clone = styledChart(svg);
    const box = svg.viewBox.baseVal;
    clone.style.width = `${Math.max(720, box.width)}px`;
    clone.style.maxWidth = "none";
    clone.style.height = `${box.height * Math.max(720, box.width) / box.width}px`;
    clone.querySelectorAll("[tabindex],[data-act]").forEach((node) => {
      node.removeAttribute("tabindex"); node.removeAttribute("role"); node.removeAttribute("data-act");
    });
    scroller.append(clone);
    const list = document.createElement("ul");
    list.className = "lp-inspection-values";
    svg.querySelectorAll("[data-tip]").forEach((node) => {
      const item = document.createElement("li");
      item.textContent = node.dataset.tip.split("|").join(" · ");
      list.append(item);
    });
    const close = document.createElement("button");
    close.className = "btn pri"; close.textContent = "Close chart";
    close.addEventListener("click", () => inspection.close());
    inspection.append(title, note, scroller, list, close);
    inspection.showModal();
  }
  const chartStates = new WeakMap();
  function makeChartTools(svg) {
    if (
      chartStates.has(svg) ||
      !svg.closest(".card") ||
      svg.closest("#map") ||
      svg.viewBox.baseVal.width < 200 ||
      svg.viewBox.baseVal.height < 80
    )
      return;
    const tools = document.createElement("div");
    tools.className = "lp-chart-tools";
    const label = document.createElement("span");
    label.textContent = "Download the visible chart";
    tools.append(label);
    const inspect = document.createElement("button");
    inspect.type = "button"; inspect.className = "btn"; inspect.textContent = "Inspect";
    inspect.setAttribute("aria-label", `Inspect ${svg.getAttribute("aria-label") || "chart"} at a larger size`);
    inspect.addEventListener("click", () => inspectChart(svg));
    tools.append(inspect);
    for (const format of ["svg", "png"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn";
      button.textContent = format.toUpperCase();
      button.setAttribute(
        "aria-label",
        `Download ${svg.getAttribute("aria-label") || "chart"} as ${format.toUpperCase()}`,
      );
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await exportChart(svg, format);
        } catch (error) {
          toast(error.message);
        } finally {
          button.disabled = false;
        }
      });
      tools.append(button);
    }
    svg.closest(".card").append(tools);
    chartStates.set(svg, tools);
  }
  let augmenting = false;
  function augment() {
    if (augmenting) return;
    augmenting = true;
    try {
      $("main").dataset.lpRoute = location.hash || "#/home";
      $("#ubtn").disabled = H.past.length === 0;
      $("#rbtn").disabled = H.fut.length === 0;
      document.querySelectorAll(".side a").forEach((a) => {
        if (a.classList.contains("on")) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      for (const table of view.querySelectorAll("table")) {
        if (settings.tables) makeTableTools(table);
        const state = tableStates.get(table);
        if (state) {
          state.tools.hidden = !settings.tables;
          state.filter();
        }
      }
      for (const th of view.querySelectorAll("th[data-sort]")) {
        th.tabIndex = 0;
        if (!th.dataset.lpKeyboard) {
          th.dataset.lpKeyboard = "on";
          th.addEventListener("keydown", (event) => {
            if (["Enter", " "].includes(event.key)) {
              event.preventDefault();
              th.click();
            }
          });
        }
      }
      for (const group of view.querySelectorAll('g[data-act="tlexp"]')) {
        group.setAttribute("tabindex", "0");
        group.setAttribute("role", "button");
        const expanded = TLEXP.has(group.dataset.id);
        group.setAttribute("aria-expanded", String(expanded));
        group.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} activities: ${group.dataset.tip.split("|")[0]}`);
        if (!group.dataset.lpKeyboard) {
          group.dataset.lpKeyboard = "on";
          group.addEventListener("keydown", (event) => {
            if (["Enter", " "].includes(event.key)) {
              event.preventDefault(); group.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            }
          });
        }
      }
      for (const svg of view.querySelectorAll(
        "svg[role='img'],svg[aria-label]",
      )) {
        if (settings.charts) makeChartTools(svg);
        const tools = chartStates.get(svg);
        if (tools) tools.hidden = !settings.charts;
      }
    } finally {
      augmenting = false;
    }
  }
  // Watch host rendering without replacing render() or changing its existing listeners.
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.target === view ||
          [...record.addedNodes].some(
            (node) =>
              node.nodeType === 1 &&
              !node.classList?.contains("lp-table-tools") &&
              !node.classList?.contains("lp-chart-tools"),
          ),
      )
    )
      augment();
  });
  observer.observe(view, { childList: true, subtree: true });
  const api = Object.freeze({
    version: "1.0.0",
    getSettings: () => ({ ...settings }),
    getMetrics: () => ({ ...metrics }),
    flush,
  });
  window.LedgerProfessional = api;
  return api;
})();
