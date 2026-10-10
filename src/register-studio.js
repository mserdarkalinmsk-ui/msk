/* Register Studio: current financial values, personal views and source-aware exports. */
function normalizeRegisterSettings(value, definitions) {
  const valid = (key) => Object.prototype.hasOwnProperty.call(definitions, key);
  const arr = (v) => (Array.isArray(v) ? v : []);
  const unique = (v) => [...new Set(v)];
  const defaults = [
    "name",
    "country",
    "budget",
    "spent",
    "exposure",
    "available",
  ];
  function core(input) {
    const v = input && typeof input === "object" ? input : {};
    const columns = unique([
      "name",
      ...arr(v.columns || defaults).filter(valid),
    ]);
    const widths = {},
      filters = {};
    for (const [key, width] of Object.entries(v.widths || {}))
      if (valid(key) && Number.isFinite(Number(width)))
        widths[key] = Math.round(
          Math.max(
            key === "name" ? 180 : 88,
            Math.min(key === "name" ? 520 : 420, Number(width)),
          ),
        );
    for (const [key, filter] of Object.entries(v.filters || {})) {
      if (!valid(key) || !filter || typeof filter !== "object") continue;
      const f = {};
      if (typeof filter.text === "string" && filter.text.trim())
        f.text = filter.text.slice(0, 200);
      for (const bound of ["min", "max"])
        if (
          filter[bound] !== "" &&
          filter[bound] !== null &&
          filter[bound] !== undefined &&
          Number.isFinite(Number(filter[bound]))
        )
          f[bound] = Number(filter[bound]);
      for (const bound of ["from", "to"])
        if (
          typeof filter[bound] === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(filter[bound]) &&
          Number.isFinite(Date.parse(filter[bound])) &&
          new Date(Date.parse(filter[bound])).toISOString().slice(0, 10) ===
            filter[bound]
        )
          f[bound] = filter[bound];
      if (Object.keys(f).length) filters[key] = f;
    }
    const sorts = arr(v.sorts)
      .filter((s) => s && valid(s.key))
      .filter((s, i, a) => a.findIndex((x) => x.key === s.key) === i)
      .slice(0, 4)
      .map((s) => ({ key: s.key, direction: s.direction === 1 ? 1 : -1 }));
    if (!sorts.length)
      sorts.push({
        key: valid(v.sort) ? v.sort : "budget",
        direction: v.direction === 1 ? 1 : -1,
      });
    return {
      columns,
      order: unique([
        ...arr(v.order).filter(valid),
        ...columns,
        ...Object.keys(definitions),
      ]),
      widths,
      frozen: unique([
        "name",
        ...arr(v.frozen).filter((key) => valid(key) && columns.includes(key)),
      ]),
      filters,
      sorts,
      sort: sorts[0].key,
      direction: sorts[0].direction,
      density: v.density === "compact" ? "compact" : "comfortable",
      mobileView: v.mobileView === "table" ? "table" : "cards",
      group: ["country", "signal", "country-signal", "country-sector"].includes(
        v.group,
      )
        ? v.group
        : "none",
      pageSize: [10, 25, 50, 100].includes(Number(v.pageSize))
        ? Number(v.pageSize)
        : 10,
      evidence: ["recorded", "missing", "dated", "undated"].includes(v.evidence)
        ? v.evidence
        : "all",
    };
  }
  const v = value && typeof value === "object" ? value : {};
  const views = arr(v.views)
    .filter(
      (view) =>
        view && typeof view.id === "string" && typeof view.name === "string",
    )
    .slice(0, 24)
    .map((view) => ({
      id: view.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80),
      name: view.name.trim().slice(0, 80),
      query: typeof view.query === "string" ? view.query.slice(0, 200) : "",
      table: core(view.table),
    }))
    .filter(
      (view, i, all) =>
        view.id &&
        view.name &&
        all.findIndex((other) => other.id === view.id) === i,
    );
  return {
    ...core(v),
    views,
    activeView: views.some((view) => view.id === v.activeView)
      ? v.activeView
      : "",
  };
}

function createRegisterStudio(api) {
  "use strict";
  const {
    h,
    money,
    pc,
    icon,
    empty,
    url,
    COLUMNS,
    tableValue,
    tableCell,
    tableTotal,
    tableDetail,
  } = api;
  const state = {
    query: "",
    page: 0,
    selected: new Set(),
    expanded: new Set(),
    collapsed: new Set(),
    dragging: null,
    resizing: null,
    bound: false,
  };
  const exports =
    typeof createRegisterExports === "function"
      ? createRegisterExports(api)
      : null;
  const cfg = () => api.getSettings().table;
  const patch = (update) => api.updateTable(update);
  const defaults = (key) =>
    key === "name"
      ? 240
      : key === "country"
        ? 152
        : key === "signal"
          ? 176
          : key === "date"
            ? 144
            : ["used", "elapsed"].includes(key)
              ? 126
              : 156;
  const width = (key) => cfg().widths?.[key] || defaults(key);
  const columns = () => {
    const t = cfg(),
      ordered = [
        "name",
        ...t.order.filter((key) => key !== "name" && t.columns.includes(key)),
      ];
    return [
      ...ordered.filter((key) => t.frozen.includes(key)),
      ...ordered.filter((key) => !t.frozen.includes(key)),
    ];
  };
  const label = (key) => COLUMNS[key].label;
  const num = (value) => typeof value === "number" && Number.isFinite(value);
  const values = (r, key) => tableValue(r, key);
  const groupKeys = () =>
    cfg().group === "country-signal"
      ? ["country", "signal"]
      : cfg().group === "country-sector"
        ? ["country", "sector"]
        : cfg().group === "none"
          ? []
          : [cfg().group];
  const groupValue = (r, key) =>
    key === "sector"
      ? r.p.sector || "Sector not recorded"
      : key === "signal"
        ? values(r, key) || "Not assessed"
        : String(values(r, key) || "Not recorded");
  const groupId = (path) => JSON.stringify(path);
  function filteredRows(R) {
    const t = cfg(),
      q = state.query.trim().toLocaleLowerCase(),
      a = api.getAnalysis?.() || {};
    return R.filter((r) => {
      if (
        a.country &&
        a.country !== "all" &&
        ![r.cn, r.p.country, r.p.countryId].includes(a.country)
      )
        return false;
      if (a.project && a.project !== "all" && r.p.id !== a.project)
        return false;
      if (
        q &&
        ![r.p.name, r.p.code, r.cn, r.p.sector, r.p.funding]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q)
      )
        return false;
      if (
        (t.evidence === "recorded" && values(r, "exposure") === null) ||
        (t.evidence === "missing" && values(r, "exposure") !== null) ||
        (t.evidence === "dated" && !values(r, "date")) ||
        (t.evidence === "undated" && values(r, "date"))
      )
        return false;
      for (const [key, f] of Object.entries(t.filters)) {
        let value = values(r, key);
        if (value === null || value === undefined) return false;
        if (
          f.text &&
          !String(value)
            .toLocaleLowerCase()
            .includes(f.text.trim().toLocaleLowerCase())
        )
          return false;
        if (COLUMNS[key].kind === "percent" && num(value)) value *= 100;
        if (f.min !== undefined && (!num(value) || value < f.min)) return false;
        if (f.max !== undefined && (!num(value) || value > f.max)) return false;
        if (
          (f.from && String(value) < f.from) ||
          (f.to && String(value) > f.to)
        )
          return false;
      }
      return true;
    }).sort((a, b) => {
      for (const key of groupKeys()) {
        const difference = groupValue(a, key).localeCompare(groupValue(b, key));
        if (difference) return difference;
      }
      for (const { key, direction } of t.sorts) {
        const x = values(a, key),
          y = values(b, key),
          missingX = x === null || x === undefined,
          missingY = y === null || y === undefined;
        if (missingX !== missingY) return missingX ? 1 : -1;
        if (missingX) continue;
        const difference =
          typeof x === "string"
            ? x.localeCompare(String(y), undefined, { numeric: true })
            : x - y;
        if (difference) return difference * direction;
      }
      return (
        String(a.p.name).localeCompare(String(b.p.name)) ||
        String(a.p.id).localeCompare(String(b.p.id))
      );
    });
  }
  function history(r) {
    const byDate = new Map();
    for (const point of api.historyRows?.(r) || [])
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
        Number.isFinite(Date.parse(point.date)) &&
        new Date(Date.parse(point.date)).toISOString().slice(0, 10) ===
          point.date
      )
        byDate.set(point.date, point);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  function sparkline(r) {
    const points = history(r),
      valid = points.filter((point) => num(point.exposure));
    if (valid.length < 2)
      return '<span class="rs-history-empty">History needs 2 dated sources</span>';
    const min = Math.min(0, ...valid.map((p) => p.exposure)),
      max = Math.max(1, ...valid.map((p) => p.exposure)),
      start = Date.parse(points[0].date),
      span = Date.parse(points.at(-1).date) - start || 1;
    const sx = (date) => 3 + ((Date.parse(date) - start) / span) * 74,
      sy = (value) => 22 - ((value - min) / (max - min || 1)) * 18;
    let path = "",
      open = false;
    for (const point of points) {
      if (!num(point.exposure)) {
        open = false;
        continue;
      }
      path +=
        (open ? "L" : "M") +
        sx(point.date).toFixed(2) +
        " " +
        sy(point.exposure).toFixed(2) +
        " ";
      open = true;
    }
    const first = valid[0],
      last = valid.at(-1),
      delta = last.exposure - first.exposure;
    return `<span class="rs-history" title="${h(first.date)} to ${h(last.date)} · exposure change ${h(money(delta))}"><svg viewBox="0 0 80 26" role="img" aria-label="Exposure history: ${h(money(first.exposure))} to ${h(money(last.exposure))}, ${valid.length} dated sources"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.7" vector-effect="non-scaling-stroke"/><circle cx="${sx(last.date).toFixed(2)}" cy="${sy(last.exposure).toFixed(2)}" r="2"/></svg><small>${h(delta >= 0 ? "+" : "")}${h(money(delta))}</small></span>`;
  }
  function periodDetail(r, count) {
    const a = api.getAnalysis?.() || {},
      selected = history(r).filter(
        (point) =>
          (!a.from || point.date >= a.from) && (!a.to || point.date <= a.to),
      );
    if (!a.from && !a.to) return "";
    const points = selected.filter((point) => num(point.exposure));
    return `<tr class="rs-period-detail"><td colspan="${count + 2}"><b>Inspected report interval</b><span>${h(a.from || "First source")} — ${h(a.to || "Latest source")}</span><p>${points.length ? `${points.length} recorded exposure source${points.length === 1 ? "" : "s"}; first ${h(points[0].date)}: ${h(money(points[0].exposure))}; last ${h(points.at(-1).date)}: ${h(money(points.at(-1).exposure))}.` : "No recorded exposure source lies inside this interval."} Current table figures retain each project's latest available basis. Snapshot differences can include revisions and signed corrections; they are not automatically period expenditure.</p></td></tr>`;
  }
  function frozen(key) {
    const list = columns(),
      t = cfg();
    if (!t.frozen.includes(key)) return "";
    const left =
      44 +
      list
        .slice(0, list.indexOf(key))
        .filter((id) => t.frozen.includes(id))
        .reduce((total, id) => total + width(id), 0);
    return ` class="mp-col-${key} rs-frozen${list.filter((id) => t.frozen.includes(id)).at(-1) === key ? " rs-frozen-last" : ""}" style="--rs-left:${left}px"`;
  }
  function cellAttrs(key) {
    return frozen(key) || ` class="mp-col-${key}"`;
  }
  function filtersUI() {
    const t = cfg();
    return `<details class="rs-popover rs-filters"><summary class="btn">Filters${Object.keys(t.filters).length || t.evidence !== "all" ? `<span class="rs-count">${Object.keys(t.filters).length + (t.evidence !== "all" ? 1 : 0)}</span>` : ""}</summary><div class="rs-popover-body"><div class="rs-popover-title"><b>Column filters</b><button data-rs-action="clear-filters" class="mp-mini">Clear all</button></div><p class="rs-help">Filters combine. Unknown values never satisfy a numeric range. Percentages use 0–100.</p><div class="rs-filter-grid">${columns()
      .map((key) => {
        const f = t.filters[key] || {},
          definition = COLUMNS[key];
        const input = (bound, type, placeholder) =>
          `<input type="${type}" ${type === "number" ? 'step="any"' : ""} data-rs-filter="${key}" data-rs-bound="${bound}" aria-label="${h(label(key))} ${bound}" value="${h(f[bound] ?? "")}" placeholder="${placeholder}">`;
        return `<label class="rs-filter-field"><span>${h(label(key))}${definition.kind === "money" ? " <small>EUR</small>" : definition.kind === "percent" ? " <small>%</small>" : ""}</span>${["money", "percent"].includes(definition.kind) ? `<span class="rs-range">${input("min", "number", "Min")}${input("max", "number", "Max")}</span>` : key === "date" ? `<span class="rs-range">${input("from", "date", "")}${input("to", "date", "")}</span>` : input("text", "search", "Contains…")}</label>`;
      })
      .join(
        "",
      )}<label class="rs-filter-field"><span>Source evidence</span><select data-rs-evidence aria-label="Filter source evidence">${[
      ["all", "All source states"],
      ["recorded", "Exposure recorded"],
      ["missing", "Exposure missing"],
      ["dated", "Dated financial report"],
      ["undated", "No dated report"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${t.evidence === v ? "selected" : ""}>${l}</option>`,
      )
      .join("")}</select></label></div></div></details>`;
  }
  function columnUI() {
    const t = cfg();
    return `<details class="mp-columns rs-popover rs-column-menu"><summary class="btn">Columns <span class="rs-count">${t.columns.length}</span></summary><div class="rs-popover-body"><div class="rs-popover-title"><b>Arrange &amp; freeze</b><span>${t.frozen.length} frozen</span></div><p class="rs-help">Drag a handle, use the arrows, or press Alt + ← / →. Project identity stays visible.</p><div class="rs-column-list">${t.order.map((key, i) => `<div class="rs-column-item" data-rs-column-item="${key}"><button class="mp-icon-button rs-column-drag" data-rs-drag="${key}" draggable="${key !== "name"}" ${key === "name" ? "disabled" : ""} aria-label="Move ${h(label(key))} column. Alt and arrow keys reorder." title="Drag column">${icon("drag")}</button><label class="rs-column-visibility"><input type="checkbox" data-mp-column="${key}" ${t.columns.includes(key) ? "checked" : ""} ${key === "name" ? "disabled" : ""}>${h(label(key))}</label><div class="rs-column-adjust"><button class="mp-icon-button" data-rs-action="column-earlier" data-column="${key}" aria-label="Move ${h(label(key))} earlier" ${key === "name" || i === 1 ? "disabled" : ""}>←</button><button class="mp-icon-button" data-rs-action="column-later" data-column="${key}" aria-label="Move ${h(label(key))} later" ${key === "name" || i === t.order.length - 1 ? "disabled" : ""}>→</button></div><label class="rs-freeze-label" title="Keep visible while scrolling"><input type="checkbox" data-rs-freeze="${key}" ${t.frozen.includes(key) ? "checked" : ""} ${key === "name" || !t.columns.includes(key) ? "disabled" : ""}>Freeze</label></div>`).join("")}</div><p class="rs-help">Drag the header edge to resize. A focused edge supports ← / → in 16 px steps.</p></div></details>`;
  }
  function sortsUI() {
    const t = cfg();
    return `<details class="rs-popover rs-sorts"><summary class="btn">Sort <span class="rs-count">${t.sorts.length}</span></summary><div class="rs-popover-body"><div class="rs-popover-title"><b>Sort priorities</b><span>Unknown values last</span></div><p class="rs-help">Click a header to sort. Shift + click adds a priority, up to four.</p>${t.sorts.map((sort, i) => `<div class="rs-sort-rule"><b>${i + 1}</b><span>${h(label(sort.key))}</span><button class="mp-mini" data-rs-action="sort-direction" data-column="${sort.key}" aria-label="Reverse ${h(label(sort.key))} sort">${sort.direction === 1 ? "↑ Ascending" : "↓ Descending"}</button><button class="mp-icon-button" data-rs-action="sort-earlier" data-column="${sort.key}" aria-label="Move ${h(label(sort.key))} sort earlier" ${i === 0 ? "disabled" : ""}>↑</button><button class="mp-icon-button" data-rs-action="sort-remove" data-column="${sort.key}" aria-label="Remove ${h(label(sort.key))} sort" ${t.sorts.length === 1 ? "disabled" : ""}>×</button></div>`).join("")}<label class="rs-sort-add">Add priority<select data-rs-sort-add aria-label="Add sort priority" ${t.sorts.length >= 4 ? "disabled" : ""}><option value="">Choose a column…</option>${Object.keys(
      COLUMNS,
    )
      .filter((key) => !t.sorts.some((s) => s.key === key))
      .map((key) => `<option value="${key}">${h(label(key))}</option>`)
      .join("")}</select></label></div></details>`;
  }
  function viewsUI() {
    const t = cfg();
    return `<details class="rs-popover rs-views"><summary class="btn">Views${t.activeView ? '<i class="mp-status-dot"></i>' : ""}</summary><div class="rs-popover-body"><div class="rs-popover-title"><b>Your table views</b><span>This device</span></div><p class="rs-help">A view saves columns, widths, filters, groups and sort priorities. Portfolio records are unchanged.</p><label class="rs-view-select">Saved view<select data-rs-view-select aria-label="Load saved table view"><option value="">Current / unsaved arrangement</option>${t.views.map((view) => `<option value="${h(view.id)}" ${view.id === t.activeView ? "selected" : ""}>${h(view.name)}</option>`).join("")}</select></label><div class="rs-view-save"><input data-rs-view-name maxlength="80" placeholder="Name this view…" aria-label="Name this table view" value="${h(t.views.find((v) => v.id === t.activeView)?.name || "")}"><button class="btn pri" data-rs-action="view-save">Save view</button></div><div class="rs-view-actions"><button class="mp-mini" data-rs-action="view-delete" ${!t.activeView ? "disabled" : ""}>Delete saved view</button><button class="mp-mini" data-rs-action="view-default">Restore default table</button></div><span class="rs-view-feedback" role="status"></span></div></details>`;
  }
  function exportUI(filtered) {
    const selected = filtered.filter((r) => state.selected.has(r.p.id));
    return `<details class="rs-popover rs-export-menu"><summary class="btn">${icon("export")}Export${selected.length ? ` <span class="rs-count">${selected.length}</span>` : ""}</summary><div class="rs-popover-body"><div class="rs-popover-title"><b>${selected.length ? "Selected records" : "Filtered records"}</b><span>${selected.length || filtered.length} projects</span></div><p class="rs-help">Exports include all matching records, independently of the displayed page.</p><button class="btn" data-mp="table-export" ${!filtered.length ? "disabled" : ""}>CSV · raw values</button><button class="btn" data-rs-action="export-xlsx" ${!filtered.length ? "disabled" : ""}>Excel · formatted workbook</button><button class="btn" data-rs-action="print-register" ${!filtered.length ? "disabled" : ""}>Print / save PDF · full register</button></div></details>`;
  }
  function filterChips() {
    const t = cfg(),
      chips = [];
    if (state.query)
      chips.push(
        `<button data-rs-action="clear-query" class="rs-filter-chip">Search: ${h(state.query)} <span aria-hidden="true">×</span></button>`,
      );
    for (const [key, f] of Object.entries(t.filters))
      chips.push(
        `<button data-rs-action="remove-filter" data-column="${key}" class="rs-filter-chip">${h(label(key))}: ${h(f.text || [f.min !== undefined ? "≥ " + f.min : "", f.max !== undefined ? "≤ " + f.max : "", f.from ? "from " + f.from : "", f.to ? "to " + f.to : ""].filter(Boolean).join(" · "))} <span aria-hidden="true">×</span></button>`,
      );
    if (t.evidence !== "all")
      chips.push(
        `<button data-rs-action="clear-evidence" class="rs-filter-chip">Source: ${h(t.evidence)} <span aria-hidden="true">×</span></button>`,
      );
    return chips.length
      ? `<div class="rs-active-filters" aria-label="Active table filters">${chips.join("")}<button class="mp-mini" data-rs-action="clear-filters">Clear all</button></div>`
      : "";
  }
  function groupHeader(path, filtered, level) {
    const keys = groupKeys(),
      key = groupId(path),
      matching = filtered.filter((r) =>
        path.every((value, i) => groupValue(r, keys[i]) === value),
      );
    const budget = matching.map((r) => values(r, "budget")).filter(num),
      exposure = matching.map((r) => values(r, "exposure")).filter(num),
      folded = state.collapsed.has(key);
    return `<tr class="mp-register-group rs-group-row rs-group-level-${level}"><th colspan="${columns().length + 2}" scope="rowgroup"><div class="rs-group-inner" style="--rs-level:${level}"><button data-rs-action="group-toggle" data-group="${h(key)}" aria-expanded="${!folded}" class="rs-group-toggle">${icon(folded ? "down" : "up")}<b>${h(path.at(-1))}</b><span>${matching.length} projects</span></button><div class="rs-group-metrics"><span>Approved <b>${h(budget.length ? money(budget.reduce((a, b) => a + b, 0)) : "—")}</b><small>${budget.length}/${matching.length} sources</small></span><span>Exposure <b>${h(exposure.length ? money(exposure.reduce((a, b) => a + b, 0)) : "—")}</b><small>${exposure.length}/${matching.length} sources</small></span></div></div></th></tr>`;
  }
  function table(R) {
    const t = cfg(),
      filtered = filteredRows(R),
      cols = columns(),
      pages = Math.max(1, Math.ceil(filtered.length / t.pageSize));
    state.page = Math.min(state.page, pages - 1);
    const page = filtered.slice(
        state.page * t.pageSize,
        (state.page + 1) * t.pageSize,
      ),
      ids = new Set(filtered.map((r) => r.p.id));
    state.selected = new Set([...state.selected].filter((id) => ids.has(id)));
    const selected = filtered.filter((r) => state.selected.has(r.p.id)),
      pageVisible = [],
      group = groupKeys();
    let previous = [],
      body = "";
    for (const r of page) {
      const path = group.map((key) => groupValue(r, key));
      for (let i = 0; i < path.length; i++) {
        if (
          previous[i] !== path[i] ||
          path.slice(0, i).some((part, j) => previous[j] !== part)
        ) {
          if (
            !path
              .slice(0, i)
              .some((_, j) =>
                state.collapsed.has(groupId(path.slice(0, j + 1))),
              )
          )
            body += groupHeader(path.slice(0, i + 1), filtered, i);
        }
      }
      previous = path;
      if (
        path.some((_, i) => state.collapsed.has(groupId(path.slice(0, i + 1))))
      )
        continue;
      pageVisible.push(r);
      body += `<tr class="rs-data-row ${state.selected.has(r.p.id) ? "mp-selected-row" : ""}" data-rs-row="${h(r.p.id)}"><td class="mp-select-cell rs-select-frozen"><input type="checkbox" data-mp-row-select="${h(r.p.id)}" aria-label="Select ${h(r.p.name)}" ${state.selected.has(r.p.id) ? "checked" : ""}></td>${cols.map((key) => `<td${cellAttrs(key)}>${tableCell(r, key)}${key === "name" ? sparkline(r) : ""}</td>`).join("")}<td class="mp-detail-cell"><button class="mp-icon-button" data-mp="row-detail" data-row="${h(r.p.id)}" aria-expanded="${state.expanded.has(r.p.id)}" aria-label="${state.expanded.has(r.p.id) ? "Hide" : "Show"} source details for ${h(r.p.name)}">${icon(state.expanded.has(r.p.id) ? "up" : "down")}</button><button class="mp-icon-button rs-analyse-row" data-rs-action="analyse-project" data-row="${h(r.p.id)}" aria-label="Analyse ${h(r.p.name)}" title="Analyse this project">${icon("search")}</button></td></tr>`;
      if (state.expanded.has(r.p.id))
        body += tableDetail(r, cols) + periodDetail(r, cols.length);
    }
    const known = filtered.map((r) => values(r, "exposure")).filter(num),
      budgets = filtered.map((r) => values(r, "budget")).filter(num),
      allSelected =
        pageVisible.length > 0 &&
        pageVisible.every((r) => state.selected.has(r.p.id)),
      a = api.getAnalysis?.() || {};
    const filterCount =
      Object.keys(t.filters).length + (t.evidence !== "all" ? 1 : 0);
    const mobileCards = `<div class="rs-mobile-cards">${page
      .filter((r) => pageVisible.some((v) => v.p.id === r.p.id))
      .map(
        (r) =>
          `<article data-mobile-project="${h(r.p.id)}"><header><span>${h(r.p.code)} · ${h(r.cn)}</span><input type="checkbox" data-rs-mobile-select="${h(r.p.id)}" aria-label="Select ${h(r.p.name)}" ${state.selected.has(r.p.id) ? "checked" : ""}></header><h3><a href="#/project/${encodeURIComponent(r.p.id)}">${h(r.p.name)}</a></h3><dl>${["budget", "spent", "exposure"].map((key) => `<div><dt>${h(label(key))}</dt><dd>${values(r, key) === null ? "—" : money(values(r, key))}</dd></div>`).join("")}</dl><footer><span>${h(r.evidence.latest?.date || "Source date not established")}</span><button class="btn" data-at="source" data-value="${h(r.p.id)}">Evidence</button></footer></article>`,
      )
      .join(
        "",
      )}<div class="rs-mobile-total">All ${filtered.length} matching projects · ${known.length}/${filtered.length} exposure sources<br>Approved ${money(budgets.reduce((a, b) => a + b, 0))} · Recorded exposure ${known.length ? money(known.reduce((a, b) => a + b, 0)) : "—"}</div></div>`;
    return `<div class="mp-table-root rs-studio mp-density-${t.density} rs-display-${t.mobileView}" data-rs="register" data-mp-source="${h(JSON.stringify(R.map((r) => r.p.id)))}"><div class="rs-register-stats"><div><span>Projects in view</span><b>${filtered.length}<small> / ${R.length}</small></b></div><div><span>Approved funding</span><b>${h(budgets.length ? money(budgets.reduce((a, b) => a + b, 0)) : "—")}</b></div><div><span>Recorded exposure</span><b>${h(known.length ? money(known.reduce((a, b) => a + b, 0)) : "—")}</b></div><div><span>Exposure coverage</span><b>${known.length}<small> / ${filtered.length} sources</small></b></div></div><div class="mp-table-toolbar rs-table-toolbar"><label class="mp-register-search"><span class="sr-only">Search this table</span>${icon("search")}<input id="mp-register-query" type="search" placeholder="Find a project, code, country or sector…" value="${h(state.query)}" data-mp-table-query></label><div class="rs-table-actions">${filtersUI()}${sortsUI()}${columnUI()}${viewsUI()}${exportUI(filtered)}<button class="btn rs-density" data-mp="table-density" aria-label="Switch to ${t.density === "compact" ? "comfortable" : "compact"} table density" title="Table density">${icon("sliders")}</button></div></div><div class="rs-register-context"><label class="mp-table-control">Group<select data-mp-table="group" aria-label="Group table rows">${[
      ["none", "No grouping"],
      ["country", "Country"],
      ["signal", "Financial signal"],
      ["country-signal", "Country → financial signal"],
      ["country-sector", "Country → sector"],
    ]
      .map(
        ([value, title]) =>
          `<option value="${value}" ${t.group === value ? "selected" : ""}>${title}</option>`,
      )
      .join(
        "",
      )}</select></label><span class="rs-current-basis"><i class="mp-status-dot"></i>Current financial basis${a.from || a.to ? " · history window does not replace latest figures" : ""}</span>${selected.length ? `<span class="rs-selection-status">${selected.length} selected <button class="mp-mini" data-rs-action="clear-selection">Clear</button></span>` : ""}</div>${filterChips()}<div class="mp-table-info" role="status"><span>${filtered.length} project${filtered.length === 1 ? "" : "s"}${filterCount || state.query ? " match your table filters" : " in this view"}${filtered.length !== R.length ? ` · ${R.length} in workspace selection` : ""}</span><span>Shift + click: multi-sort · drag header edge: resize · unknown values stay last</span></div><div class="rs-mobile-switch" role="group" aria-label="Mobile register display"><button class="btn" data-rs-action="mobile-view" data-value="cards" aria-pressed="${t.mobileView === "cards"}">Project cards</button><button class="btn" data-rs-action="mobile-view" data-value="table" aria-pressed="${t.mobileView === "table"}">Full table</button></div>${mobileCards}<p class="mp-mobile-hint">Swipe horizontally. Frozen project names retain your place.</p><div class="mp-scroll mp-register-scroll" tabindex="0" role="region" aria-label="Project register, scroll horizontally for more columns"><table class="mp-register rs-table" style="width:${44 + cols.reduce((total, key) => total + width(key), 0) + 88}px"><caption class="sr-only">Current project register in EUR. Totals and grouped subtotals cover all matching records, independently of pagination. Source coverage is indicated.</caption><colgroup><col style="width:44px">${cols.map((key) => `<col data-rs-col="${key}" style="width:${width(key)}px">`).join("")}<col style="width:88px"></colgroup><thead><tr><th class="mp-select-cell rs-select-frozen" scope="col"><input type="checkbox" data-mp-page-select aria-label="Select all visible projects on this page" ${allSelected ? "checked" : ""} ${!pageVisible.length ? "disabled" : ""}></th>${cols
      .map((key) => {
        const sortIndex = t.sorts.findIndex((sort) => sort.key === key),
          sort = t.sorts[sortIndex];
        return `<th${cellAttrs(key)} scope="col" aria-sort="${sortIndex === 0 ? (sort.direction === 1 ? "ascending" : "descending") : "none"}" data-rs-header="${key}" data-rs-drag="${key}" draggable="${key !== "name"}"><button data-mp="sort" data-column="${key}" aria-label="Sort by ${h(label(key))}${sortIndex >= 0 ? `, priority ${sortIndex + 1}, ${sort.direction === 1 ? "ascending" : "descending"}` : ""}">${h(label(key))}<span aria-hidden="true">${sort ? `${sort.direction === 1 ? "↑" : "↓"}<sup>${t.sorts.length > 1 ? sortIndex + 1 : ""}</sup>` : "↕"}</span></button><span role="separator" aria-orientation="vertical" aria-label="Resize ${h(label(key))} column" aria-valuenow="${width(key)}" aria-valuemin="${key === "name" ? 180 : 88}" aria-valuemax="${key === "name" ? 520 : 420}" data-rs-resize="${key}" tabindex="0" title="Drag to resize · Arrow keys change by 16 px"></span></th>`;
      })
      .join(
        "",
      )}<th scope="col"><span class="sr-only">Source details and analysis</span></th></tr></thead><tbody>${body || `<tr><td colspan="${cols.length + 2}">${empty("No matching projects", "Adjust the column filters or clear the table search.", '<button class="btn" data-mp="clear-table">Clear table filters</button>')}</td></tr>`}</tbody><tfoot><tr><td class="rs-select-frozen"></td>${cols.map((key) => `<td${cellAttrs(key)}>${tableTotal(filtered, key)}</td>`).join("")}<td></td></tr></tfoot></table></div><div class="mp-table-pagination"><label>Rows per page<select data-mp-table="pageSize">${[10, 25, 50, 100].map((n) => `<option ${t.pageSize === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><span>${filtered.length ? state.page * t.pageSize + 1 : 0}–${Math.min((state.page + 1) * t.pageSize, filtered.length)} of ${filtered.length}</span><div><button class="btn" data-mp="page-prev" ${state.page === 0 ? "disabled" : ""} aria-label="Previous table page">←</button><span>Page ${state.page + 1} / ${pages}</span><button class="btn" data-mp="page-next" ${state.page >= pages - 1 ? "disabled" : ""} aria-label="Next table page">→</button></div></div><p class="mp-footnote">Available = approved − spent − committed. Current figures can have different reporting dates; each total states its own source coverage. A dash means insufficient evidence and differs from recorded zero. Row histories show dated exposure snapshots, including revisions and signed corrections. Estimates and financial pace do not measure delivery.</p></div>`;
  }
  function redraw(root, focus = null) {
    if (!root?.isConnected || root.dataset.rsRedrawing === "true") return;
    const active = document.activeElement,
      activeInfo =
        focus ||
        (active && root.contains(active)
          ? {
              query: active.hasAttribute("data-mp-table-query"),
              filter: active.dataset.rsFilter,
              bound: active.dataset.rsBound,
              col: active.dataset.mpColumn,
              freeze: active.dataset.rsFreeze,
              resize: active.dataset.rsResize,
              row: active.dataset.mpRowSelect,
              page: active.hasAttribute("data-mp-page-select"),
              table: active.dataset.mpTable,
              action: active.dataset.rsAction,
              column: active.dataset.column,
              viewName: active.hasAttribute("data-rs-view-name"),
            }
          : null);
    const cursor = active?.selectionStart,
      scroll = root.querySelector(".mp-register-scroll")?.scrollLeft || 0,
      open = [...root.querySelectorAll("details[open]")].map((el) =>
        [...el.classList].find((c) =>
          [
            "rs-filters",
            "rs-sorts",
            "rs-column-menu",
            "rs-views",
            "rs-export-menu",
          ].includes(c),
        ),
      ),
      R = api.sourceRows(root);
    root.dataset.rsRedrawing = "true";
    root.outerHTML = table(R);
    const next =
      [...document.querySelectorAll(".rs-studio")].find(
        (el) => el.dataset.mpSource === JSON.stringify(R.map((r) => r.p.id)),
      ) || document.querySelector(".rs-studio");
    if (!next) return;
    for (const name of open)
      if (name) {
        const details = next.querySelector("details." + name);
        if (details) details.open = true;
      }
    const region = next.querySelector(".mp-register-scroll");
    if (region) region.scrollLeft = scroll;
    if (activeInfo) {
      const controls = [
        ...next.querySelectorAll("input,select,button,[data-rs-resize]"),
      ];
      const target = controls.find((el) =>
        activeInfo.query
          ? el.hasAttribute("data-mp-table-query")
          : activeInfo.filter
            ? el.dataset.rsFilter === activeInfo.filter &&
              el.dataset.rsBound === activeInfo.bound
            : activeInfo.col
              ? el.dataset.mpColumn === activeInfo.col
              : activeInfo.freeze
                ? el.dataset.rsFreeze === activeInfo.freeze
                : activeInfo.resize
                  ? el.dataset.rsResize === activeInfo.resize
                  : activeInfo.row
                    ? el.dataset.mpRowSelect === activeInfo.row
                    : activeInfo.page
                      ? el.hasAttribute("data-mp-page-select")
                      : activeInfo.table
                        ? el.dataset.mpTable === activeInfo.table
                        : activeInfo.viewName
                          ? el.hasAttribute("data-rs-view-name")
                          : activeInfo.action
                            ? el.dataset.rsAction === activeInfo.action &&
                              (!activeInfo.column ||
                                el.dataset.column === activeInfo.column)
                            : false,
      );
      target?.focus({ preventScroll: true });
      if (target && cursor !== null && cursor !== undefined)
        try {
          target.setSelectionRange(cursor, cursor);
        } catch (_) {}
    }
    afterRender(next);
  }
  function changeConfig(root, update, resetPage = true) {
    patch({ ...update, activeView: update.activeView ?? "" });
    if (resetPage) state.page = 0;
    redraw(root);
  }
  function reorder(key, before, root) {
    if (key === "name" || before === "name" || key === before) return;
    const order = cfg().order.filter((item) => item !== key),
      target = order.indexOf(before);
    if (target < 0) return;
    order.splice(target, 0, key);
    changeConfig(root, { order });
    api.announce(label(key) + " column moved before " + label(before));
  }
  function moveColumn(key, direction, root) {
    const order = [...cfg().order],
      from = order.indexOf(key),
      to = Math.max(1, Math.min(order.length - 1, from + direction));
    if (from < 1 || to === from) return;
    order.splice(from, 1);
    order.splice(to, 0, key);
    changeConfig(root, { order });
    api.announce(
      label(key) + " column moved " + (direction < 0 ? "earlier" : "later"),
    );
  }
  function csv(R, cols) {
    const safe = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "string" && /^[\s]*[=+@-]/.test(value))
        value = "'" + value;
      return '"' + String(value).replace(/"/g, '""') + '"';
    };
    const headers = cols.map(
      (key) =>
        label(key) +
        (COLUMNS[key].kind === "money"
          ? " (EUR)"
          : COLUMNS[key].kind === "percent"
            ? " (fraction)"
            : ""),
    );
    return (
      "\uFEFF" +
      [headers, ...R.map((r) => cols.map((key) => values(r, key)))]
        .map((line) => line.map(safe).join(","))
        .join("\r\n")
    );
  }
  function exportContext(R) {
    const a = api.getAnalysis?.() || {},
      t = cfg();
    return {
      title: "Portfolio register",
      scope: state.selected.size
        ? "Selected records in the current filtered view"
        : "All records in the current filtered view",
      filters: {
        query: state.query,
        columnFilters: t.filters,
        evidence: t.evidence,
        group: t.group,
        analysis: a,
      },
      reportDates: R.map((r) => values(r, "date")).filter(Boolean),
      calculations: [
        "Figures retain each project's current financial basis; date-window selection inspects report history.",
        "Available = approved − spent − committed. Totals use recorded values and show independent source counts.",
        "Unknown values differ from recorded zero. Percentages are fractions in CSV and formatted percentages in Excel.",
        "Snapshot changes can include revisions and signed corrections; financial pace does not measure delivery.",
      ],
      history: Object.fromEntries(
        R.map((r) => [
          r.p.id,
          history(r).map((p) => ({ date: p.date, value: p.exposure })),
        ]),
      ),
    };
  }
  function handleClick(button, event) {
    const root = button?.closest(".rs-studio");
    if (!root) return false;
    const action = button.dataset.rsAction || button.dataset.mp,
      key = button.dataset.column,
      t = cfg(),
      R = api.sourceRows(root);
    switch (action) {
      case "mobile-view":
        changeConfig(root, { mobileView: button.dataset.value });
        break;
      case "sort": {
        const existing = t.sorts.find((s) => s.key === key),
          direction = existing ? existing.direction * -1 : 1;
        let sorts = event?.shiftKey ? [...t.sorts] : [];
        const index = sorts.findIndex((s) => s.key === key);
        if (index >= 0) sorts[index] = { key, direction };
        else if (sorts.length < 4) sorts.push({ key, direction });
        changeConfig(root, { sorts });
        break;
      }
      case "sort-direction":
        changeConfig(root, {
          sorts: t.sorts.map((s) =>
            s.key === key ? { ...s, direction: -s.direction } : s,
          ),
        });
        break;
      case "sort-remove":
        changeConfig(root, { sorts: t.sorts.filter((s) => s.key !== key) });
        break;
      case "sort-earlier": {
        const sorts = [...t.sorts],
          i = sorts.findIndex((s) => s.key === key);
        if (i > 0) [sorts[i - 1], sorts[i]] = [sorts[i], sorts[i - 1]];
        changeConfig(root, { sorts });
        break;
      }
      case "column-earlier":
        moveColumn(key, -1, root);
        break;
      case "column-later":
        moveColumn(key, 1, root);
        break;
      case "row-detail": {
        const id = button.dataset.row;
        state.expanded.has(id)
          ? state.expanded.delete(id)
          : state.expanded.add(id);
        redraw(root);
        const btn = [
          ...document.querySelectorAll('.rs-studio [data-mp="row-detail"]'),
        ].find((el) => el.dataset.row === id);
        btn?.focus({ preventScroll: true });
        break;
      }
      case "table-density":
        changeConfig(
          root,
          { density: t.density === "compact" ? "comfortable" : "compact" },
          false,
        );
        break;
      case "page-prev":
        state.page = Math.max(0, state.page - 1);
        redraw(root);
        break;
      case "page-next":
        state.page++;
        redraw(root);
        break;
      case "clear-table":
      case "clear-filters":
        state.query = "";
        changeConfig(root, { filters: {}, evidence: "all" });
        break;
      case "clear-query":
        state.query = "";
        state.page = 0;
        redraw(root);
        break;
      case "clear-evidence":
        changeConfig(root, { evidence: "all" });
        break;
      case "remove-filter": {
        const filters = { ...t.filters };
        delete filters[key];
        changeConfig(root, { filters });
        break;
      }
      case "clear-selection":
        state.selected.clear();
        redraw(root);
        break;
      case "group-toggle": {
        const id = button.dataset.group;
        state.collapsed.has(id)
          ? state.collapsed.delete(id)
          : state.collapsed.add(id);
        redraw(root);
        break;
      }
      case "analyse-project":
        api.setAnalysis({ project: button.dataset.row });
        break;
      case "view-save": {
        const input = root.querySelector("[data-rs-view-name]"),
          name = input.value.trim();
        if (!name) {
          input.setCustomValidity("Give this view a name.");
          input.reportValidity();
          input.focus();
          return true;
        }
        input.setCustomValidity("");
        const existing = t.views.find(
            (v) => v.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
          ),
          id =
            existing?.id ||
            "view-" +
              Date.now().toString(36) +
              "-" +
              Math.random().toString(36).slice(2, 7),
          snapshot = { ...t };
        delete snapshot.views;
        delete snapshot.activeView;
        const views = t.views.filter((v) => v.id !== id);
        if (views.length >= 24) {
          root.querySelector(".rs-view-feedback").textContent =
            "24 views saved. Delete a view before adding another.";
          return true;
        }
        views.push({ id, name, query: state.query, table: snapshot });
        changeConfig(root, { views, activeView: id }, false);
        api.announce(name + " table view saved");
        break;
      }
      case "view-delete":
        changeConfig(
          root,
          {
            views: t.views.filter((v) => v.id !== t.activeView),
            activeView: "",
          },
          false,
        );
        break;
      case "view-default": {
        const clean = normalizeRegisterSettings({}, COLUMNS);
        state.query = "";
        state.collapsed.clear();
        changeConfig(root, { ...clean, views: t.views });
        break;
      }
      case "table-export":
      case "export-xlsx":
      case "print-register": {
        const filtered = filteredRows(R),
          selected = filtered.filter((r) => state.selected.has(r.p.id)),
          records = selected.length ? selected : filtered,
          cols = columns();
        if (!records.length) return true;
        if (action === "table-export")
          api.download(
            "portfolio-register-" +
              new Date().toISOString().slice(0, 10) +
              ".csv",
            csv(records, cols),
            "text/csv;charset=utf-8",
          );
        else if (exports)
          action === "export-xlsx"
            ? exports.xlsx(records, cols, exportContext(records))
            : exports.print(records, cols, exportContext(records));
        else api.announce("Register export is unavailable.");
        break;
      }
      default:
        return false;
    }
    return true;
  }
  function handleChange(el) {
    const root = el?.closest(".rs-studio");
    if (!root) return false;
    if (root.dataset.rsRedrawing === "true") return true;
    const t = cfg();
    if (el.dataset.rsMobileSelect) {
      el.checked
        ? state.selected.add(el.dataset.rsMobileSelect)
        : state.selected.delete(el.dataset.rsMobileSelect);
      redraw(root);
    } else if (el.dataset.mpColumn) {
      const key = el.dataset.mpColumn,
        columns = el.checked
          ? [...t.columns, key]
          : t.columns.filter((id) => id !== key);
      changeConfig(root, {
        columns,
        frozen: t.frozen.filter((id) => columns.includes(id)),
      });
    } else if (el.dataset.rsFreeze) {
      const key = el.dataset.rsFreeze;
      changeConfig(
        root,
        {
          frozen: el.checked
            ? [...t.frozen, key]
            : t.frozen.filter((id) => id !== key),
        },
        false,
      );
    } else if (el.dataset.mpTable)
      changeConfig(root, {
        [el.dataset.mpTable]:
          el.dataset.mpTable === "pageSize" ? Number(el.value) : el.value,
      });
    else if (el.dataset.rsFilter) {
      const key = el.dataset.rsFilter,
        bound = el.dataset.rsBound,
        filters = { ...t.filters },
        f = { ...(filters[key] || {}) };
      if (el.value === "") delete f[bound];
      else
        f[bound] = ["min", "max"].includes(bound) ? Number(el.value) : el.value;
      if (Object.keys(f).length) filters[key] = f;
      else delete filters[key];
      changeConfig(root, { filters });
    } else if (el.hasAttribute("data-rs-evidence"))
      changeConfig(root, { evidence: el.value });
    else if (el.hasAttribute("data-rs-sort-add")) {
      if (el.value)
        changeConfig(root, {
          sorts: [...t.sorts, { key: el.value, direction: 1 }],
        });
    } else if (el.hasAttribute("data-rs-view-select")) {
      const saved = t.views.find((v) => v.id === el.value);
      if (saved) {
        state.query = saved.query || "";
        state.collapsed.clear();
        changeConfig(root, {
          ...saved.table,
          views: t.views,
          activeView: saved.id,
        });
      } else changeConfig(root, { activeView: "" }, false);
    } else if (el.hasAttribute("data-mp-row-select")) {
      el.checked
        ? state.selected.add(el.dataset.mpRowSelect)
        : state.selected.delete(el.dataset.mpRowSelect);
      redraw(root);
    } else if (el.hasAttribute("data-mp-page-select")) {
      for (const checkbox of root.querySelectorAll("[data-mp-row-select]"))
        el.checked
          ? state.selected.add(checkbox.dataset.mpRowSelect)
          : state.selected.delete(checkbox.dataset.mpRowSelect);
      redraw(root);
    } else return false;
    return true;
  }
  function handleInput(el) {
    const root = el?.closest(".rs-studio");
    if (!root) return false;
    if (root.dataset.rsRedrawing === "true") return true;
    if (el.hasAttribute("data-mp-table-query")) {
      state.query = el.value;
      state.page = 0;
      redraw(root);
      return true;
    }
    if (el.hasAttribute("data-rs-view-name")) {
      el.setCustomValidity("");
      return true;
    }
    return el.hasAttribute("data-rs-filter");
  }
  function liveResize(root, key, value) {
    const col = [...root.querySelectorAll("col[data-rs-col]")].find(
      (el) => el.dataset.rsCol === key,
    );
    if (col) col.style.width = value + "px";
    const cols = columns(),
      map = { ...cfg().widths, [key]: value };
    const tableEl = root.querySelector("table.rs-table");
    if (tableEl)
      tableEl.style.width =
        132 +
        cols.reduce((total, id) => total + (map[id] || defaults(id)), 0) +
        "px";
    for (const cell of root.querySelectorAll(".rs-frozen")) {
      const colKey = [...cell.classList]
          .find((c) => c.startsWith("mp-col-"))
          ?.slice(7),
        left =
          44 +
          cols
            .slice(0, cols.indexOf(colKey))
            .filter((id) => cfg().frozen.includes(id))
            .reduce((total, id) => total + (map[id] || defaults(id)), 0);
      cell.style.setProperty("--rs-left", left + "px");
    }
    const handle = [...root.querySelectorAll("[data-rs-resize]")].find(
      (el) => el.dataset.rsResize === key,
    );
    handle?.setAttribute("aria-valuenow", String(value));
  }
  function bind() {
    if (state.bound) return;
    state.bound = true;
    document.addEventListener(
      "keydown",
      (event) => {
        const el = event.target,
          root = el.closest?.(".rs-studio");
        if (!root) return;
        if (event.key === "Escape") {
          const open =
            el.closest("details.rs-popover[open]") ||
            root.querySelector("details.rs-popover[open]");
          if (open) {
            event.preventDefault();
            event.stopPropagation();
            open.open = false;
            open.querySelector("summary")?.focus();
            return;
          }
        }
        if (event.key === "Enter" && el.hasAttribute("data-rs-filter")) {
          event.preventDefault();
          handleChange(el);
          return;
        }
        if (event.key === "Enter" && el.hasAttribute("data-rs-view-name")) {
          event.preventDefault();
          handleClick(
            root.querySelector('[data-rs-action="view-save"]'),
            event,
          );
          return;
        }
        if (
          el.dataset.rsResize &&
          ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          const key = el.dataset.rsResize,
            min = key === "name" ? 180 : 88,
            max = key === "name" ? 520 : 420,
            next =
              event.key === "Home"
                ? min
                : event.key === "End"
                  ? max
                  : Math.max(
                      min,
                      Math.min(
                        max,
                        width(key) + (event.key === "ArrowLeft" ? -16 : 16),
                      ),
                    );
          changeConfig(
            root,
            { widths: { ...cfg().widths, [key]: next } },
            false,
          );
          api.announce(label(key) + " width " + next + " pixels");
        }
        if (
          el.dataset.rsDrag &&
          event.altKey &&
          ["ArrowLeft", "ArrowRight"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          moveColumn(
            el.dataset.rsDrag,
            event.key === "ArrowLeft" ? -1 : 1,
            root,
          );
        }
      },
      true,
    );
    document.addEventListener(
      "pointerdown",
      (event) => {
        for (const menu of document.querySelectorAll(
          ".rs-studio details.rs-popover[open]",
        ))
          if (!menu.contains(event.target)) menu.open = false;
        const handle = event.target.closest?.("[data-rs-resize]"),
          root = handle?.closest(".rs-studio");
        if (!root) return;
        event.preventDefault();
        event.stopPropagation();
        const key = handle.dataset.rsResize;
        state.resizing = {
          root,
          key,
          pointer: event.pointerId,
          x: event.clientX,
          start: width(key),
          value: width(key),
        };
        handle.setPointerCapture?.(event.pointerId);
        root.classList.add("rs-resizing");
      },
      true,
    );
    document.addEventListener(
      "pointermove",
      (event) => {
        const drag = state.resizing;
        if (!drag || drag.pointer !== event.pointerId) return;
        event.preventDefault();
        const min = drag.key === "name" ? 180 : 88,
          max = drag.key === "name" ? 520 : 420;
        drag.value = Math.round(
          Math.max(min, Math.min(max, drag.start + event.clientX - drag.x)),
        );
        liveResize(drag.root, drag.key, drag.value);
      },
      true,
    );
    const finish = (event, cancel) => {
      const drag = state.resizing;
      if (!drag || drag.pointer !== event.pointerId) return;
      state.resizing = null;
      drag.root.classList.remove("rs-resizing");
      if (!cancel)
        patch({
          widths: { ...cfg().widths, [drag.key]: drag.value },
          activeView: "",
        });
      redraw(drag.root, { resize: drag.key });
    };
    document.addEventListener(
      "pointerup",
      (event) => finish(event, false),
      true,
    );
    document.addEventListener(
      "pointercancel",
      (event) => finish(event, true),
      true,
    );
    document.addEventListener(
      "dragstart",
      (event) => {
        const handle = event.target.closest?.("[data-rs-drag]"),
          root = handle?.closest(".rs-studio");
        if (!root || handle.dataset.rsDrag === "name") return;
        event.stopPropagation();
        state.dragging = { key: handle.dataset.rsDrag, root };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/x-ledger-column",
          handle.dataset.rsDrag,
        );
        root.classList.add("rs-column-dragging");
      },
      true,
    );
    document.addEventListener(
      "dragover",
      (event) => {
        if (!state.dragging) return;
        const target = event.target.closest?.(
          "[data-rs-column-item],[data-rs-header]",
        );
        if (!target || target.closest(".rs-studio") !== state.dragging.root)
          return;
        event.preventDefault();
        event.stopPropagation();
        state.dragging.root
          .querySelectorAll(".rs-column-drop")
          .forEach((el) => el.classList.remove("rs-column-drop"));
        target.classList.add("rs-column-drop");
      },
      true,
    );
    document.addEventListener(
      "drop",
      (event) => {
        const drag = state.dragging;
        if (!drag) return;
        const target = event.target.closest?.(
          "[data-rs-column-item],[data-rs-header]",
        );
        event.preventDefault();
        event.stopPropagation();
        state.dragging = null;
        drag.root.classList.remove("rs-column-dragging");
        drag.root
          .querySelectorAll(".rs-column-drop")
          .forEach((el) => el.classList.remove("rs-column-drop"));
        if (target && target.closest(".rs-studio") === drag.root)
          reorder(
            drag.key,
            target.dataset.rsColumnItem || target.dataset.rsHeader,
            drag.root,
          );
      },
      true,
    );
    document.addEventListener(
      "dragend",
      () => {
        if (state.dragging) {
          state.dragging.root.classList.remove("rs-column-dragging");
          state.dragging.root
            .querySelectorAll(".rs-column-drop")
            .forEach((el) => el.classList.remove("rs-column-drop"));
          state.dragging = null;
        }
      },
      true,
    );
    document.addEventListener(
      "toggle",
      (event) => {
        const menu = event.target;
        if (menu.matches?.(".rs-studio details.rs-popover") && menu.open)
          for (const other of menu
            .closest(".rs-studio")
            .querySelectorAll("details.rs-popover[open]"))
            if (other !== menu) other.open = false;
      },
      true,
    );
  }
  function afterRender(view) {
    bind();
    const roots = view.matches?.(".rs-studio")
      ? [view]
      : [...view.querySelectorAll(".rs-studio")];
    for (const root of roots) {
      const checkboxes = [...root.querySelectorAll("[data-mp-row-select]")],
        all = root.querySelector("[data-mp-page-select]");
      if (all) {
        const selected = checkboxes.filter((el) => el.checked).length;
        all.indeterminate = selected > 0 && selected < checkboxes.length;
      }
    }
  }
  function getTransient() {
    return {
      query: state.query,
      page: state.page,
      selected: [...state.selected],
      expanded: [...state.expanded],
      collapsed: [...state.collapsed],
    };
  }
  function resetTransient(value = {}) {
    state.query =
      typeof value.query === "string" ? value.query.slice(0, 200) : "";
    state.page =
      Number.isInteger(value.page) && value.page >= 0 ? value.page : 0;
    for (const key of ["selected", "expanded", "collapsed"])
      state[key] = new Set(
        Array.isArray(value[key])
          ? value[key].filter((v) => typeof v === "string").slice(0, 1000)
          : [],
      );
  }
  return {
    table,
    handleClick,
    handleChange,
    handleInput,
    afterRender,
    filteredRows,
    getTransient,
    resetTransient,
    cleanTableSettings: (value) => normalizeRegisterSettings(value, COLUMNS),
  };
}
