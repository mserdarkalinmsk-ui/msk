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
          x.args.length === args.length &&
          x.args.every((a, i) => a === args[i]),
      );
      if (existing) {
        metrics.hits++;
        return existing.value;
      }
      metrics.misses++;
      const value = fn.apply(this, args);
      records.push({ args, value });
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
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest('#freset,[data-act="reset"]')) clearPending();
    },
    true,
  );

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
    display.innerHTML = `<h2 id="lp-display-title">Your display preferences</h2><p>Choose the tools and reading style that suit your work.</p>${toggle("design", "Professional styling")}${toggle("fast", "Faster search and rendering")}${toggle("tables", "Table search and visible-row CSV")}${toggle("charts", "SVG and PNG chart downloads")}${select(
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
            [...row.cells].map((cell) => csvCell(cell.textContent)).join(","),
          )
          .join("\r\n");
      download("portfolio-table-visible.csv", csv, "text/csv;charset=utf-8");
    });
    tools.append(input, output, button);
    (table.closest(".tw") || table).before(tools);
    filter();
  }
  async function exportChart(svg, format) {
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
    const box = svg.viewBox.baseVal;
    const w = box.width || svg.clientWidth || 800,
      height = box.height || svg.clientHeight || 400;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", w);
    clone.setAttribute("height", height);
    if (!box.width) clone.setAttribute("viewBox", `0 0 ${w} ${height}`);
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    background.setAttribute("x", box.x || 0);
    background.setAttribute("y", box.y || 0);
    background.setAttribute("width", w);
    background.setAttribute("height", height);
    background.setAttribute(
      "fill",
      getComputedStyle(document.body).getPropertyValue("--surface").trim() ||
        "#fff",
    );
    clone.prepend(background);
    const description = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "desc",
    );
    description.textContent = `${svg.getAttribute("aria-label") || "Portfolio chart"} · ${$("#title").textContent} · ${new Date().toISOString()} · current visible chart`;
    clone.prepend(description);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
    if (format === "svg") return download2("portfolio-chart.svg", blob);
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(Error("Chart could not be rendered"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = Math.max(1, Math.round((height / w) * 1800));
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!png) throw Error("PNG export unavailable");
      download2("portfolio-chart.png", png);
    } finally {
      URL.revokeObjectURL(url);
    }
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
