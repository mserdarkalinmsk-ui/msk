/* Workspace presentation layer. Portfolio records remain owned by the ledger engine. */
const Masterpiece = (() => {
  "use strict";
  const KEY = "ledger.workspace.v2";
  const PANELS = {
    allocation: {
      title: "Where the budget stands",
      eyebrow: "01 / Financial position",
      width: "half",
      desc: "Approved funding, expenditure and commitments on one scale.",
    },
    trend: {
      title: "The story in the reports",
      eyebrow: "02 / Report history",
      width: "half",
      desc: "Dated snapshots, with source coverage at every point.",
    },
    actions: {
      title: "Decisions that need attention",
      eyebrow: "03 / Action queue",
      width: "half",
      desc: "Recorded deadlines, financial pace and delivery observations.",
    },
    map: {
      title: "A portfolio without borders",
      eyebrow: "04 / Geography",
      width: "half",
      desc: "Explore the countries behind your project portfolio.",
    },
    pace: {
      title: "Financial pace, in context",
      eyebrow: "05 / Pace comparison",
      width: "half",
      desc: "Budget exposure against elapsed project time.",
    },
    composition: {
      title: "How the portfolio is shaped",
      eyebrow: "06 / Composition",
      width: "half",
      desc: "Compare current approved funding by country or sector.",
    },
    coverage: {
      title: "How much of the picture is known?",
      eyebrow: "07 / Evidence coverage",
      width: "half",
      desc: "Missing records are visible, rather than treated as zero.",
    },
    deadlines: {
      title: "What comes next",
      eyebrow: "08 / Recorded deadlines",
      width: "half",
      desc: "Upcoming dates and overdue items from project records.",
    },
    forecast: {
      title: "The outlook, with its assumptions",
      eyebrow: "09 / Forecast",
      width: "full",
      desc: "Estimates remain separate from approved budget and actuals.",
    },
    timeline: {
      title: "Projects on one time axis",
      eyebrow: "10 / Schedule",
      width: "full",
      desc: "Scheduled duration and financial utilization are different measures.",
    },
    register: {
      title: "The project register",
      eyebrow: "11 / Portfolio detail",
      width: "full",
      desc: "A searchable, sortable view with explicit source coverage.",
    },
    findings: {
      title: "Evidence into action",
      eyebrow: "12 / Source observations",
      width: "full",
      desc: "Review the findings linked to their underlying project records.",
    },
  };
  const PROFILES = {
    overview: {
      name: "Portfolio overview",
      visible: [
        "allocation",
        "trend",
        "actions",
        "map",
        "composition",
        "coverage",
        "timeline",
        "register",
      ],
    },
    finance: {
      name: "Finance focus",
      visible: [
        "allocation",
        "trend",
        "pace",
        "coverage",
        "forecast",
        "register",
      ],
    },
    delivery: {
      name: "Delivery focus",
      visible: [
        "actions",
        "deadlines",
        "map",
        "timeline",
        "findings",
        "register",
      ],
    },
  };
  const WIDTHS = ["third", "half", "wide", "full"];
  const DEFAULT_COLUMNS = [
    "name",
    "country",
    "budget",
    "spent",
    "exposure",
    "available",
    "used",
    "signal",
    "date",
  ];
  const COLUMNS = {
    name: { label: "Project", kind: "text" },
    country: { label: "Country", kind: "text" },
    budget: { label: "Approved", kind: "money" },
    spent: { label: "Spent", kind: "money" },
    committed: { label: "Committed", kind: "money" },
    exposure: { label: "Spent + committed", kind: "money" },
    available: { label: "Available", kind: "money" },
    used: { label: "Budget used", kind: "percent" },
    elapsed: { label: "Time elapsed", kind: "percent" },
    forecast: { label: "Estimate at end", kind: "money" },
    variance: { label: "Projected variance", kind: "money" },
    date: { label: "Report date", kind: "text" },
    signal: { label: "Financial signal", kind: "text" },
  };
  const uniq = (items) => [...new Set(items)];
  const own = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);
  const ids = Object.keys(PANELS);
  const list = (value) => (Array.isArray(value) ? value : []);
  const money = (n) => (Number.isFinite(n) ? cmMoney(n) : "—");
  const compact = (n) => (Number.isFinite(n) ? eur(n) : "—");
  const countText = (n, noun) =>
    n + " " + (n === 1 ? noun : noun === "country" ? "countries" : noun + "s");
  const url = (r, tab = "overview") =>
    "#/project/" +
    encodeURIComponent(r.p.id) +
    (tab === "overview" ? "" : "/" + tab);
  const icons = {
    people:
      '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
    project:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 5V3h8v2M3 11h18M10 11v3h4v-3"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15"/>',
    alert: '<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/>',
    staff:
      '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
    arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
    save: '<path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-8h10v8"/>',
    sliders: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
    drag: '<circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    expand: '<path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    export: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    print: '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    restore: '<path d="M4 9a8 8 0 1 1-1 7M4 3v6h6"/>',
    pin: '<path d="m8 3 8 0-1 6 3 3v2H6v-2l3-3-1-6ZM12 14v7"/>',
  };
  const icon = (key) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (icons[key] || icons.sliders) +
    "</svg>";
  function defaultLayout(profile = "overview") {
    return {
      order: uniq([...PROFILES[profile].visible, ...ids]),
      hidden: ids.filter((id) => !PROFILES[profile].visible.includes(id)),
      widths:
        profile === "delivery"
          ? {}
          : {
              allocation: "half",
              trend: "half",
              composition: "half",
              coverage: "half",
            },
      collapsed: [],
      pinned: [],
      density: "comfortable",
    };
  }
  function cleanLayout(value, profile) {
    const base = defaultLayout(profile),
      v = value && typeof value === "object" ? value : {};
    return {
      order: uniq([
        ...list(v.order).filter((id) => own(PANELS, id)),
        ...base.order,
      ]),
      hidden: uniq(
        list(v.hidden ?? base.hidden).filter((id) => own(PANELS, id)),
      ),
      widths: Object.fromEntries(
        Object.entries(v.widths || base.widths).filter(
          ([id, width]) => own(PANELS, id) && WIDTHS.includes(width),
        ),
      ),
      collapsed: uniq(list(v.collapsed).filter((id) => own(PANELS, id))),
      pinned: uniq(list(v.pinned).filter((id) => own(PANELS, id))),
      density: v.density === "compact" ? "compact" : "comfortable",
    };
  }
  function cleanSettings(value, nested = false) {
    const v = value && typeof value === "object" ? value : {},
      profile = own(PROFILES, v.profile) ? v.profile : "overview",
      profiles = {};
    for (const key of Object.keys(PROFILES))
      profiles[key] = cleanLayout(v.profiles?.[key], key);
    const charts = v.charts || {},
      appearance = v.appearance || {};
    const result = {
      version: 2,
      profile,
      profiles,
      charts: {
        allocation: charts.allocation === "percent" ? "percent" : "amount",
        composition: charts.composition === "sector" ? "sector" : "country",
        series: ["both", "spent", "exposure"].includes(charts.series)
          ? charts.series
          : "both",
        history:
          typeof charts.history === "string"
            ? charts.history.slice(0, 160)
            : "all",
        window: charts.window === "12" ? "12" : "all",
        mode: charts.mode === "interval" ? "interval" : "cumulative",
        style: charts.style === "columns" ? "columns" : "line",
        bridge: charts.bridge === "coverage" ? "coverage" : "waterfall",
      },
      table: normalizeRegisterSettings(v.table, COLUMNS),
      analysis: normalizeAnalysisScope(v.analysis),
      schedule: normalizeScheduleSettings(v.schedule),
      appearance: {
        palette: ["atelier", "executive", "contrast"].includes(
          appearance.palette,
        )
          ? appearance.palette
          : "atelier",
        effects: appearance.effects === "none" ? "none" : "subtle",
      },
      workspaces: [],
      activeWorkspace: "",
    };
    if (!nested) {
      result.workspaces = list(v.workspaces)
        .filter(
          (w) =>
            w &&
            /^ws-[a-z0-9-]{1,60}$/.test(w.id) &&
            typeof w.name === "string" &&
            w.name.trim() &&
            w.snapshot &&
            typeof w.snapshot === "object",
        )
        .slice(-12)
        .map((w) => {
          const clean = cleanSettings(w.snapshot, true);
          const {
            profile,
            profiles,
            charts,
            table,
            analysis,
            schedule,
            appearance,
          } = clean;
          const scenario = Number.isFinite(Number(w.snapshot.scenario))
            ? Math.max(-80, Math.min(80, Number(w.snapshot.scenario)))
            : 0;
          const registerState =
            w.snapshot.registerState &&
            typeof w.snapshot.registerState === "object"
              ? {
                  query:
                    typeof w.snapshot.registerState.query === "string"
                      ? w.snapshot.registerState.query.slice(0, 200)
                      : "",
                }
              : { query: "" };
          return {
            id: w.id,
            name: w.name.trim().slice(0, 64),
            snapshot: {
              profile,
              profiles,
              charts,
              table,
              analysis,
              schedule,
              appearance,
              scenario,
              registerState,
            },
          };
        })
        .filter((w, i, a) => a.findIndex((x) => x.id === w.id) === i);
      result.activeWorkspace = result.workspaces.some(
        (w) => w.id === v.activeWorkspace,
      )
        ? v.activeWorkspace
        : "";
    }
    return result;
  }

  let settings = cleanSettings(ls.get(KEY)),
    customizing = false,
    layoutSaved = true;
  const ui = {
    query: "",
    page: 0,
    selected: new Set(),
    expanded: new Set(),
    pickedDate: "",
    deadlineTab: "upcoming",
    actionTab: "all",
    exportPanel: "",
    managerReturn: null,
    drag: null,
  };
  const layout = () => settings.profiles[settings.profile];
  const visiblePanels = () => {
    const l = layout(),
      shown = l.order.filter((id) => !l.hidden.includes(id));
    return [
      ...shown.filter((id) => l.pinned.includes(id)),
      ...shown.filter((id) => !l.pinned.includes(id)),
    ];
  };
  function persist() {
    layoutSaved = ls.set(KEY, settings);
    return layoutSaved;
  }
  const live = document.createElement("div");
  live.className = "sr-only";
  live.id = "mp-live";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  document.body.append(live);
  function announce(message) {
    live.textContent = "";
    requestAnimationFrame(() => (live.textContent = message));
  }
  function empty(title, copy, link = "") {
    return `<div class="mp-empty"><span aria-hidden="true">${icon("search")}</span><b>${h(title)}</b><p>${h(copy)}</p>${link}</div>`;
  }
  function patchSettings(patch, rerender = true) {
    const changed =
      !Object.prototype.hasOwnProperty.call(patch, "activeWorkspace") &&
      !Object.prototype.hasOwnProperty.call(patch, "workspaces");
    settings = cleanSettings({
      ...settings,
      ...patch,
      ...(changed ? { activeWorkspace: "" } : {}),
    });
    persist();
    if (rerender) render();
  }
  function effectiveAnalysis() {
    const route = location.hash.replace(/^#\//, "").split("/")[0] || "home";
    return ["home", "overview"].includes(route)
      ? settings.analysis
      : normalizeAnalysisScope();
  }
  function sourceHistory(p) {
    const byDate = new Map();
    for (const report of reps(p)) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(report.date) ||
        !Number.isFinite(Date.parse(report.date)) ||
        !(
          cmSourceAmountKnown(report, "actual") ||
          cmSourceAmountKnown(report, "spentCommitted")
        )
      )
        continue;
      const old = byDate.get(report.date);
      if (
        !old ||
        String(report.updatedAt || report.registeredAt || "") >=
          String(old.updatedAt || old.registeredAt || "")
      )
        byDate.set(report.date, report);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  const common = {
    h,
    money,
    compact,
    pc,
    icon,
    empty,
    url,
    entityColor,
    SG,
    historyReports: sourceHistory,
    sourceReports: reps,
    finAt,
    cmSourceAmountKnown,
    tableEvidence,
    getSettings: () => settings,
    getBaseRows: () => rows(),
    getAnalysis: effectiveAnalysis,
    setAnalysis: (patch) => {
      const foreign = !["home", "overview"].includes(
        location.hash.replace(/^#\//, "").split("/")[0] || "home",
      );
      studio.setAnalysis(foreign ? { country: "all", ...patch } : patch);
      if (foreign) location.hash = "#/overview";
    },
    render,
    announce,
    download,
    download2,
  };
  const studio = createStudioShell({
    ...common,
    scenario: () => F.k,
    isDemo: () => DEMO_MODE,
    financialSummary,
    todayActions,
    toast,
    patchSettings,
    getRegisterState: () => registerStudio.getTransient(),
    restoreWorkspace: (w) => {
      const { scenario, registerState, ...snapshot } = w.snapshot;
      settings = cleanSettings({
        ...settings,
        ...snapshot,
        activeWorkspace: w.id,
      });
      registerStudio.resetTransient(registerState);
      ui.pickedDate = "";
      persist();
      $("#fk").value = scenario;
      setF("k", scenario);
    },
  });
  const chartStudio = createChartStudio({
    ...common,
    updateCharts: (patch) =>
      patchSettings(
        { charts: { ...settings.charts, ...patch }, activeWorkspace: "" },
        false,
      ),
    getPickedDate: () => ui.pickedDate,
    setPickedDate: (value) => {
      ui.pickedDate = value;
    },
  });
  const registerStudio = createRegisterStudio({
    ...common,
    COLUMNS,
    tableValue,
    tableCell,
    tableTotal,
    tableDetail,
    sourceRows,
    updateTable: (patch, opts = {}) =>
      patchSettings(
        { table: { ...settings.table, ...patch }, activeWorkspace: "" },
        opts.render === true,
      ),
    historyRows: (r) =>
      sourceHistory(r.p).map((q) => {
        const f = finAt(r.p, q);
        return {
          date: q.date,
          spent: cmSourceAmountKnown(q, "actual") ? f.actual : null,
          exposure: cmSourceAmountKnown(q, "spentCommitted") ? f.sc : null,
        };
      }),
  });
  const scheduleStudio = createScheduleStudio({
    ...common,
    portfolioEvents,
    updateSchedule: (patch) =>
      patchSettings(
        { schedule: { ...settings.schedule, ...patch }, activeWorkspace: "" },
        false,
      ),
  });
  const staffStudio = createStaffStudio({
    ...common,
    portfolioDocumentTeam,
    staffRoster,
    staffAvatar,
    n2,
    cname,
  });
  studio.afterRender();
  function chartMenu(id) {
    return `<button class="mp-icon-button" data-mp="chart-export" data-panel="${id}" aria-label="Export ${h(PANELS[id].title)} chart" title="Export chart">${icon("export")}</button>`;
  }
  function panel(id, body) {
    const spec = PANELS[id],
      l = layout(),
      collapsed = l.collapsed.includes(id),
      pinned = l.pinned.includes(id),
      width = l.widths[id] || spec.width;
    return `<section class="mp-panel mp-width-${width}${collapsed ? " mp-collapsed" : ""}${pinned ? " mp-pinned" : ""}" data-mp-panel="${id}" aria-labelledby="mp-title-${id}"><header class="mp-panel-head"><div><span class="mp-eyebrow">${spec.eyebrow}</span><h2 id="mp-title-${id}">${spec.title}</h2><p>${spec.desc}</p></div><div class="mp-panel-tools">${["allocation", "trend", "pace", "composition"].includes(id) ? chartMenu(id) : ""}<button class="mp-icon-button mp-collapse" data-mp="collapse" data-panel="${id}" aria-expanded="${!collapsed}" aria-controls="mp-body-${id}" aria-label="${collapsed ? "Expand" : "Collapse"} ${spec.title}" title="${collapsed ? "Expand" : "Collapse"} panel">${icon(collapsed ? "down" : "up")}</button><button class="mp-icon-button mp-handle" draggable="${customizing}" data-mp-handle="${id}" aria-label="Move ${spec.title}. Alt and arrow keys reorder this panel." title="Drag to move · Alt + ↑ / ↓" ${customizing ? "" : "hidden"}>${icon("drag")}</button></div></header><div class="mp-panel-edit" ${customizing ? "" : "hidden"}><button data-mp="move-up" data-panel="${id}" class="mp-mini">${icon("up")}Earlier</button><button data-mp="move-down" data-panel="${id}" class="mp-mini">${icon("down")}Later</button><label>Width<select data-mp-width="${id}" aria-label="Width of ${spec.title}">${WIDTHS.map((w) => `<option value="${w}" ${w === width ? "selected" : ""}>${w === "third" ? "Third" : w === "half" ? "Half" : w === "wide" ? "Wide" : "Full"}</option>`).join("")}</select></label><button class="mp-mini ${pinned ? "on" : ""}" data-mp="pin" data-panel="${id}" aria-pressed="${pinned}">${icon("pin")}${pinned ? "Pinned" : "Pin"}</button><button class="mp-mini" data-mp="hide" data-panel="${id}">Hide</button></div><div id="mp-body-${id}" class="mp-panel-body" ${collapsed ? "hidden" : ""}>${body}</div></section>`;
  }
  function toolbar(analysis = false) {
    return `<div class="mp-toolbar"><div class="mp-profile-switch" role="group" aria-label="Workspace profile">${Object.entries(
      PROFILES,
    )
      .map(
        ([id, p]) =>
          `<button data-mp="profile" data-profile="${id}" class="${settings.profile === id ? "on" : ""}" aria-pressed="${settings.profile === id}">${p.name}</button>`,
      )
      .join(
        "",
      )}</div><div class="mp-toolbar-actions"><span class="mp-layout-state">${customizing ? (layoutSaved ? "Layout saved on this device" : "Layout not saved · storage unavailable") : countText(visiblePanels().length, "panel")}</span><button class="btn ${customizing ? "pri" : ""}" data-mp="customize" aria-pressed="${customizing}">${icon("sliders")}${customizing ? "Done arranging" : "Customize"}</button><button class="btn mp-manager" data-mp="manage">Panels</button><details class="mp-more-tools"><summary class="btn" aria-label="Workspace tools">•••</summary><div><button data-mp="print">${icon("print")}Print / save PDF</button><button data-act="export">${icon("export")}Portfolio backup</button><button data-mp="export-layout">Export layout</button><button data-mp="import-layout">Import layout</button><button data-mp="reset-layout">${icon("restore")}Reset this layout</button><a href="#/data">Open data tools</a></div></details></div></div>${customizing ? '<div class="mp-edit-notice"><b>Make the workspace yours.</b> Drag a handle to reorder panels. On phones, drag vertically or use Earlier / Later. Alt + ↑ / ↓ works from a focused handle. Panel changes do not alter portfolio data.</div>' : ""}`;
  }
  function allocation(R) {
    return chartStudio.allocation(R);
  }

  function trend(R) {
    return chartStudio.trend(R);
  }

  function pace(R) {
    return chartStudio.pace(R);
  }

  function composition(R) {
    return chartStudio.composition(R);
  }

  function coverage(R) {
    const metrics = [
        ["Actuals", (r) => r.evidence.actual],
        ["Exposure", (r) => r.evidence.exposure],
        ["Forecast basis", (r) => tableEvidence(r).forecast],
        ["Dated report", (r) => !!r.evidence.latest?.date],
      ],
      n = R.length;
    return `<div class="mp-coverage-meters">${metrics
      .map(([l, test]) => {
        const k = R.filter(test).length;
        return `<div><span>${l}</span><b>${k}<small> / ${n}</small></b><i role="img" aria-label="${k} of ${n} projects with ${l.toLowerCase()}"><em style="width:${n ? (k / n) * 100 : 0}%"></em></i></div>`;
      })
      .join(
        "",
      )}</div><div class="mp-scroll" tabindex="0" role="region" aria-label="Source coverage by project"><table class="mp-coverage-table"><caption>Coverage records availability. It is not a quality or delivery score.</caption><thead><tr><th scope="col">Project</th>${metrics.map(([l]) => `<th scope="col">${l}</th>`).join("")}<th scope="col">Latest actuals</th></tr></thead><tbody>${R.map((r) => `<tr><td><a href="${url(r, "finance/reports")}">${h(r.p.code || r.p.name)}</a><small>${h(r.cn)}</small></td>${metrics.map(([label, test]) => `<td><span class="mp-source-status ${test(r) ? "known" : "missing"}" title="${label}: ${test(r) ? "recorded" : "not recorded"}">${test(r) ? icon("check") : "—"}<span class="sr-only">${test(r) ? "Recorded" : "Not recorded"}</span></span></td>`).join("")}<td>${h(r.evidence.latest?.date || (r.evidence.actual ? "Manual / undated" : "No actuals"))}</td></tr>`).join("")}</tbody></table></div><p class="mp-footnote">A blank value is not zero. Forecast availability can mean a model-derived estimate, not a team-approved forecast. Use the source link to inspect the method and reporting date.</p>`;
  }
  function actions(R) {
    const all = todayActions(R),
      filtered = all.filter(
        (a) => ui.actionTab === "all" || a[1] === ui.actionTab,
      ),
      shown = filtered.slice(0, 5);
    return `<div class="mp-chart-controls"><div class="mp-toggle" role="group" aria-label="Action severity">${[
      ["all", "All"],
      ["bad", "Act now"],
      ["warn", "Review"],
    ]
      .map(
        ([v, l]) =>
          `<button data-mp="action-tab" data-value="${v}" aria-pressed="${ui.actionTab === v}">${l}</button>`,
      )
      .join(
        "",
      )}</div><span>${filtered.length} observations</span></div>${shown.length ? `<ul class="mp-action-list">${shown.map(([, tone, text, p, link, date]) => `<li><span class="mp-action-symbol ${tone}" aria-hidden="true">${tone === "bad" ? "!" : tone === "warn" ? "↗" : "i"}</span><a href="${link}"><b>${h(text)}</b><small>${h(p.code)} · ${h(p.name)}${date ? " · " + h(date) : ""}</small></a><span class="mp-action-type ${tone}">${tone === "bad" ? "Act now" : tone === "warn" ? "Review" : "Update"}</span></li>`).join("")}</ul>` : empty("No matching observations", "Missing evidence is listed separately; absence of an observation does not confirm project performance.")}<div class="mp-panel-footer"><span>Showing ${shown.length} of ${filtered.length}</span><a href="#/calendar">Open calendar ↗</a><button data-mp="reveal" data-panel="findings" class="mp-text-button">Review all findings</button></div>`;
  }
  function deadlines(R) {
    const events = portfolioEvents(R).filter(
        (e) => !e.done && Number.isFinite(Date.parse(e.date)),
      ),
      overdue = events.filter((e) => e.date < TODAY()),
      upcoming = events.filter((e) => e.date >= TODAY() && dd(e.date) <= 90),
      list = (ui.deadlineTab === "overdue" ? overdue : upcoming).slice(0, 7);
    return `<div class="mp-chart-controls"><div class="mp-toggle" role="group" aria-label="Deadline range"><button data-mp="deadline-tab" data-value="upcoming" aria-pressed="${ui.deadlineTab === "upcoming"}">Next 90 days · ${upcoming.length}</button><button data-mp="deadline-tab" data-value="overdue" aria-pressed="${ui.deadlineTab === "overdue"}">Overdue · ${overdue.length}</button></div></div>${
      list.length
        ? `<ol class="mp-deadline-list">${list
            .map((e) => {
              const date = new Date(e.date + "T12:00:00Z"),
                days = dd(e.date);
              return `<li><time datetime="${e.date}"><b>${date.getUTCDate()}</b><span>${date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })} ${date.getUTCFullYear()}</span></time><a href="${e.link}"><b>${h(e.label)}</b><small>${h(e.p.code)} · ${h(e.kind)}</small></a><span class="${days < 0 ? "negative" : ""}">${days < 0 ? Math.abs(days) + "d overdue" : days === 0 ? "Today" : "In " + days + "d"}</span></li>`;
            })
            .join("")}</ol>`
        : empty(
            ui.deadlineTab === "overdue"
              ? "No recorded overdue dates"
              : "No recorded dates in the next 90 days",
            "These dates come from project records; they do not infer completion or confirm that an activity took place.",
          )
    }<p class="mp-footnote">Only dates marked complete in their source records are excluded. Dates alone do not confirm delivery or payment.</p>`;
  }
  function forecast(R) {
    const known = R.filter((r) => tableEvidence(r).forecast),
      budget = known.reduce((a, r) => a + r.b, 0),
      estimate = known.reduce((a, r) => a + r.eac, 0),
      max = Math.max(1, ...known.map((r) => Math.max(r.b, r.eac))),
      variance = budget - estimate;
    return `<div class="mp-forecast-overview"><div><span>Supported estimates</span><b>${known.length}/${R.length}</b></div><div><span>Estimate at completion</span><b>${known.length ? compact(estimate) : "—"}</b></div><div><span>Projected ${variance < 0 ? "overrun" : "unspent"}</span><b class="${variance < 0 ? "negative" : ""}">${known.length ? compact(Math.abs(variance)) : "—"}</b></div></div><div class="mp-scenario-control"><label for="mp-scenario">Spending pace scenario <b id="mp-scenario-value">${F.k > 0 ? "+" : ""}${F.k}%</b></label><input type="range" id="mp-scenario" min="-80" max="80" step="5" value="${F.k}" data-mp-scenario aria-describedby="mp-scenario-help"><button data-act="resetk" class="btn">Reset scenario</button></div><p id="mp-scenario-help" class="mp-footnote">Changes estimates using the current forecast method. Approved budget, spent and committed are unchanged. The engine may use a different supported method for each project.</p>${known.length ? `<div class="mp-forecast-list">${known.map((r) => `<a href="${url(r, "finance/budget")}"><div><b>${h(r.p.code || r.p.name)}</b><span>${h(BL[r.basis] || r.basis)}</span></div><div class="mp-forecast-track"><i style="width:${(Math.max(0, r.eac) / max) * 100}%;background:${r.eac > r.b ? "var(--bad)" : "var(--brand)"}"></i><em style="left:${(r.b / max) * 100}%"></em></div><div><span>Approved ${compact(r.b)}</span><strong>${compact(r.eac)} estimated</strong></div></a>`).join("")}</div>` : empty("No supported forecast basis", "Add dated expenditure, team forecasts or activity evidence.")}<p class="mp-footnote">Only ${known.length}/${R.length} projects contribute to these totals. Unspent estimates are not savings or approved budget revisions. The tick marks current approved budget.</p>`;
  }
  function tableValue(r, key) {
    const e = tableEvidence(r);
    switch (key) {
      case "name":
        return r.p.name;
      case "country":
        return r.cn;
      case "budget":
        return r.b;
      case "spent":
        return e.actual ? r.sp : null;
      case "committed":
        return e.committed ? r.co : null;
      case "exposure":
        return e.exposure ? r.u : null;
      case "available":
        return e.exposure ? r.b - r.u : null;
      case "used":
        return e.exposure && r.b > 0 ? r.u / r.b : null;
      case "elapsed":
        return Number.isFinite(r.s) && Number.isFinite(r.e) && r.s < r.e
          ? r.el
          : null;
      case "forecast":
        return e.forecast ? r.eac : null;
      case "variance":
        return e.forecast ? r.b - r.eac : null;
      case "date":
        return r.evidence.latest?.date || null;
      case "signal":
        return e.exposure && r.pace !== null ? SG[r.g][0] : null;
      default:
        return null;
    }
  }
  function filteredRows(R) {
    const q = ui.query.trim().toLocaleLowerCase(),
      t = settings.table;
    const filtered = R.filter(
      (r) =>
        !q ||
        [r.p.name, r.p.code, r.cn, r.p.sector, r.p.funding]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q),
    );
    return filtered.sort((a, b) => {
      if (t.group !== "none") {
        const x =
            t.group === "country"
              ? a.cn
              : tableValue(a, "signal") || "Not assessed",
          y =
            t.group === "country"
              ? b.cn
              : tableValue(b, "signal") || "Not assessed",
          group = x.localeCompare(y);
        if (group) return group;
      }
      const x = tableValue(a, t.sort),
        y = tableValue(b, t.sort);
      if (x === null || y === null)
        return x === null
          ? y === null
            ? a.p.name.localeCompare(b.p.name)
            : 1
          : -1;
      return (
        (typeof x === "string" ? x.localeCompare(String(y)) : x - y) *
          t.direction || a.p.name.localeCompare(b.p.name)
      );
    });
  }
  function tableCell(r, key) {
    const value = tableValue(r, key);
    if (key === "name")
      return `<div class="mp-register-name"><i style="background:${entityColor("project", r.p.id)}"></i><div><a href="${url(r)}">${h(r.p.name)}</a><small>${h(r.p.code)} · ${h(r.p.sector || "No sector")}</small></div></div>`;
    if (value === null)
      return '<span class="mp-missing" title="Required source evidence is not recorded">—<span class="sr-only">Not recorded</span></span>';
    if (key === "signal")
      return `<span class="tag ${SG[r.g][1]}">${h(value)}</span>`;
    if (COLUMNS[key].kind === "money")
      return `<span class="mp-money ${["available", "variance"].includes(key) && value < 0 ? "negative" : ""}">${money(value)}</span>`;
    if (key === "used")
      return `<span class="mp-use-cell"><b>${pc(value)}</b><i><em style="width:${cl(value, 0, 1) * 100}%;background:${r.g === "r" ? "var(--bad)" : r.g === "o" ? "var(--warn)" : "var(--brand)"}"></em></i></span>`;
    if (COLUMNS[key].kind === "percent") return pc(value);
    return h(value);
  }
  function tableTotal(R, key) {
    if (key === "name")
      return `<b>Filtered totals</b><small>${countText(R.length, "project")} · EUR</small>`;
    if (COLUMNS[key].kind === "money") {
      const known = R.map((r) => tableValue(r, key)).filter(Number.isFinite);
      return `<b>${known.length ? money(known.reduce((a, b) => a + b, 0)) : "—"}</b><small>${known.length}/${R.length} sources</small>`;
    }
    if (key === "used") {
      const complete =
          R.length && R.every((r) => tableValue(r, "used") !== null),
        budget = R.reduce((a, r) => a + r.b, 0);
      return complete && budget > 0
        ? pc(R.reduce((a, r) => a + r.u, 0) / budget)
        : "—";
    }
    return "—";
  }
  function tableDetail(r, columns) {
    const latest = r.evidence.latest,
      e = tableEvidence(r),
      source = latest?.fileName || latest?.name || "Manual project record";
    return `<tr class="mp-register-detail"><td colspan="${columns.length + 2}"><div><section><span>Source &amp; context</span><b>${h(source)}</b><p>${h(latest?.date || "No dated financial report")} · ${h(r.cn)} · ${h(r.p.funding || "Funding not recorded")}</p>${Object.keys(r.p.adminOverrides || {}).length ? '<p class="mp-adjustment">Current figures include administrator adjustments. Report history remains as recorded.</p>' : ""}</section><section><span>Financial evidence</span><p>Actuals ${e.actual ? "recorded" : "missing"} · commitments ${e.committed ? "recorded" : "missing"} · exposure ${e.exposure ? "recorded" : "missing"}</p><p>${e.forecast ? "Estimate: " + h(BL[r.basis] || r.basis) : "No supported estimate"}${F.k ? " · " + h(F.k) + "% scenario" : ""}</p></section><section><span>Inspect the source</span><a href="${url(r, "finance/reports")}">Financial reports ↗</a><a href="${url(r, "finance/budget")}">Budget &amp; comparisons ↗</a>${projectPmmLink(r.p)}</section></div></td></tr>`;
  }
  function table(R) {
    return registerStudio.table(R);
  }

  function panelBody(id, R) {
    switch (id) {
      case "allocation":
        return allocation(R);
      case "trend":
        return trend(R);
      case "pace":
        return pace(R);
      case "composition":
        return composition(R);
      case "coverage":
        return coverage(R);
      case "actions":
        return actions(R);
      case "deadlines":
        return deadlines(R);
      case "forecast":
        return forecast(R);
      case "map":
        return mapCard(R);
      case "timeline":
        return scheduleStudio.timeline(R);
      case "register":
        return table(R);
      case "findings":
        return (
          portfolioAutoRiskPanel(R) +
          `<details class="mp-data-disclosure"><summary>Financial observations &amp; methods</summary>${analyticsFindings(R)}</details>`
        );
      default:
        return "";
    }
  }
  function workspace(base, analysis = false) {
    const R = studio.scopeRows(base);
    const settingsOpen =
      customizing ||
      !!document.querySelector(".studio-workspace-settings")?.open;
    return `<div class="mp-workspace studio-shell ${customizing ? "mp-customizing" : ""} mp-workspace-${layout().density}">${studio.brief(R)}${strip(R, "home")}${studio.scope(base, R)}<details class="studio-workspace-settings" ${settingsOpen ? "open" : ""}><summary><span>${icon("sliders")}Workspace settings</span><span>${h(PROFILES[settings.profile].name)} · ${countText(visiblePanels().length, "panel")}</span><span class="studio-settings-chevron" aria-hidden="true">+</span></summary>${toolbar(analysis)}${studio.toolbarExtras()}</details><div class="mp-grid">${
      !base.length
        ? empty(
            "No projects match this selection",
            "Broaden the workspace filters to bring your projects back.",
            '<button class="btn" data-act="reset">Clear filters</button>',
          )
        : !R.length
          ? empty(
              "No projects in this analysis scope",
              "Clear the country or project selection to return to your portfolio.",
              '<button class="btn" data-studio-action="clear-scope">Clear analysis scope</button>',
            )
          : visiblePanels()
              .map((id) => panel(id, panelBody(id, R)))
              .join("") ||
            empty(
              "Your workspace is ready to arrange",
              "Choose the panels you want to see in this profile.",
              '<button class="btn" data-mp="manage">Choose panels</button>',
            )
    }</div><details class="mp-method"><summary>Understand the figures &amp; how this workspace works</summary><div><section><h3>Financial position</h3><p>Spent is cumulative expenditure. Committed excludes spent. Exposure adds both. Current approved budgets and latest reports can have different effective dates. Whole-portfolio availability is withheld when exposure evidence is incomplete.</p></section><section><h3>Historical reports &amp; estimates</h3><p>The history uses the latest known report per project at each date; snapshots are never added together. Interval changes compare matched sources and can include refunds or revisions. Date filtering affects history, not current funding or actuals. Forecasts remain estimates.</p></section><section><h3>Personal workspace</h3><p>Profiles, named workspaces and table views keep arrangements on this device. Customize to move or resize panels; Undo layout reverses the last panel change. Export your layout separately from a portfolio backup.</p></section></div></details></div>`;
  }

  function afterRender(route) {
    // The application frame belongs to every route, including detail screens.
    document.querySelector("main").classList.add("mp-page");
    if (route === "compare") {
      const projects = document.querySelector('.side a[data-r="projects"]');
      projects?.classList.add("on");
      projects?.setAttribute("aria-current", "page");
    }
    studio.afterRender();
    chartStudio.afterRender(view);
    registerStudio.afterRender(view);
    scheduleStudio.afterRender(view);
    staffStudio.afterRender(view);
  }

  function home(R) {
    return {
      t: "Portfolio overview",
      s:
        countText(R.length, "project") +
        " across " +
        countText(new Set(R.map((r) => r.p.country)).size, "country") +
        " · " +
        new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      html: workspace(R),
    };
  }
  function analytics(R) {
    return {
      t: "Analytics studio",
      s: "A workspace for financial evidence, comparisons and decisions",
      html: workspace(R, true),
    };
  }
  function sourceRows(root) {
    let recordIds;
    try {
      recordIds = JSON.parse(root.dataset.mpSource);
    } catch {
      return [];
    }
    return S.projects.filter((p) => recordIds.includes(p.id)).map(model);
  }
  function redrawTable(root, focusId = "") {
    const scroll = root.querySelector(".mp-register-scroll")?.scrollLeft || 0,
      active = document.activeElement,
      caret = active?.selectionStart,
      columnsOpen = !!root.querySelector(".mp-columns")?.open;
    const selector = focusId
      ? "#" + CSS.escape(focusId)
      : active && root.contains(active)
        ? [
            "data-mp-column",
            "data-mp-row-select",
            "data-mp-page-select",
            "data-mp-table",
            "data-mp",
          ]
            .filter((a) => active.hasAttribute(a))
            .map(
              (a) => "[" + a + '="' + CSS.escape(active.getAttribute(a)) + '"]',
            )[0]
        : "";
    root.outerHTML = table(sourceRows(root));
    const next = view.querySelector(".mp-table-root");
    if (next) {
      next.querySelector(".mp-register-scroll").scrollLeft = scroll;
      next.querySelector(".mp-columns").open = columnsOpen;
      afterRender(document.querySelector("main").dataset.page);
      if (selector) {
        const input = next.querySelector(selector);
        input?.focus({ preventScroll: true });
        if (Number.isFinite(caret) && input?.type === "search")
          input.setSelectionRange(caret, caret);
      }
    }
  }
  function setPanel(id, key, value) {
    const l = layout();
    studio.recordLayout();
    settings.activeWorkspace = "";
    if (key === "width") l.widths[id] = value;
    else {
      l[key] = l[key].filter((x) => x !== id);
      if (value) l[key].push(id);
    }
    persist();
    render();
  }
  function move(id, to, after = false) {
    const l = layout(),
      shown = visiblePanels();
    if (!own(PANELS, id) || !shown.includes(id)) return;
    if (typeof to === "number") after = to > 0;
    let target = typeof to === "number" ? shown[shown.indexOf(id) + to] : to;
    if (!target || id === target) return;
    // A move respects pinned / unpinned groups rather than silently unpinning.
    if (l.pinned.includes(id) !== l.pinned.includes(target)) {
      announce("Unpin the panel to move it between groups.");
      return;
    }
    studio.recordLayout();
    settings.activeWorkspace = "";
    const order = l.order.filter((x) => x !== id),
      at = order.indexOf(target);
    order.splice(at + (after ? 1 : 0), 0, id);
    l.order = order;
    persist();
    render();
    view
      .querySelector(`[data-mp-handle="${id}"]`)
      ?.focus({ preventScroll: true });
    announce(PANELS[id].title + " moved. Layout saved.");
  }
  const manager = document.createElement("dialog");
  manager.id = "mp-manager";
  manager.className = "mp-dialog";
  manager.setAttribute("aria-labelledby", "mp-manager-title");
  document.body.append(manager);
  const resetDialog = document.createElement("dialog");
  resetDialog.className = "mp-dialog mp-confirm-dialog";
  resetDialog.setAttribute("aria-labelledby", "mp-reset-title");
  resetDialog.innerHTML =
    '<h2 id="mp-reset-title">Restore the default layout?</h2><p>This resets panel order, widths, visibility and density for this profile. Portfolio records, source files and the other profiles are preserved.</p><div class="acts"><button class="btn" data-mp="cancel-reset">Keep my layout</button><button class="btn pri" data-mp="confirm-reset">Restore layout</button></div>';
  document.body.append(resetDialog);
  const exportDialog = document.createElement("dialog");
  exportDialog.className = "mp-dialog mp-export-dialog";
  exportDialog.setAttribute("aria-labelledby", "mp-export-title");
  exportDialog.innerHTML =
    '<header><div><span class="mp-eyebrow">A chart you can keep</span><h2 id="mp-export-title">Export chart</h2></div><button class="mp-icon-button" data-mp="close-export" aria-label="Close chart export">' +
    icon("close") +
    '</button></header><p>Export the current scope and theme. Data and source descriptions stay available in the workspace.</p><div class="mp-export-options"><button class="btn pri" data-mp="export-svg">SVG <small>Scalable vector</small></button><button class="btn" data-mp="export-png">PNG <small>High resolution image</small></button></div><p class="mp-export-status" role="status"></p>';
  document.body.append(exportDialog);
  const layoutInput = document.createElement("input");
  layoutInput.id = "mp-layout-import";
  layoutInput.type = "file";
  layoutInput.accept = ".json,application/json";
  layoutInput.hidden = true;
  document.body.append(layoutInput);
  function drawManager() {
    const l = layout();
    manager.innerHTML = `<header><div><span class="mp-eyebrow">${PROFILES[settings.profile].name}</span><h2 id="mp-manager-title">Make room for what matters</h2></div><button class="mp-icon-button" data-mp="close-manager" aria-label="Close panel manager">${icon("close")}</button></header><p>Choose the panels in this profile. Adjust their order and size with Customize.</p><div class="mp-manager-list">${l.order.map((id) => `<label><input type="checkbox" data-mp-visibility="${id}" ${!l.hidden.includes(id) ? "checked" : ""}><span><b>${PANELS[id].title}</b><small>${PANELS[id].desc}</small></span><em>${l.widths[id] || PANELS[id].width}</em></label>`).join("")}</div><footer><label>Workspace density<select data-mp-density><option value="comfortable" ${l.density === "comfortable" ? "selected" : ""}>Comfortable</option><option value="compact" ${l.density === "compact" ? "selected" : ""}>Compact</option></select></label><button class="btn pri" data-mp="close-manager">Done</button></footer>`;
  }
  manager.addEventListener("close", () =>
    view.querySelector('[data-mp="manage"]')?.focus({ preventScroll: true }),
  );
  resetDialog.addEventListener("close", () =>
    view.querySelector('[data-mp="customize"]')?.focus({ preventScroll: true }),
  );
  exportDialog.addEventListener("close", () =>
    view
      .querySelector(`[data-mp="chart-export"][data-panel="${ui.exportPanel}"]`)
      ?.focus({ preventScroll: true }),
  );
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || document.querySelector("dialog[open]"))
      return;
    const menus = [
      ...view.querySelectorAll(".mp-more-tools[open],.mp-columns[open]"),
    ];
    if (!menus.length) return;
    menus.forEach((menu) => (menu.open = false));
    menus[0].querySelector("summary")?.focus({ preventScroll: true });
    event.preventDefault();
  });
  for (const dlg of [manager, resetDialog, exportDialog])
    dlg.addEventListener("click", (event) => {
      if (event.target === dlg) dlg.close();
    });
  function csvExport(root) {
    const filtered = filteredRows(sourceRows(root)),
      selected = filtered.filter((r) => ui.selected.has(r.p.id)),
      R = selected.length ? selected : filtered,
      columns = settings.table.columns;
    const escape = (v) => {
      let text = String(v ?? "");
      if (typeof v === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [
      columns.map(
        (k) =>
          COLUMNS[k].label +
          (COLUMNS[k].kind === "percent"
            ? " (fraction)"
            : COLUMNS[k].kind === "money"
              ? " (EUR)"
              : ""),
      ),
      ...R.map((r) => columns.map((k) => tableValue(r, k))),
    ];
    download(
      "portfolio-register-" + TODAY() + ".csv",
      "\ufeff" + lines.map((row) => row.map(escape).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
    announce(countText(R.length, "project") + " exported.");
  }
  async function exportChart(format) {
    let svg = view.querySelector(
        `[data-mp-panel="${ui.exportPanel}"] svg.mp-chart`,
      ),
      temporary;
    const status = exportDialog.querySelector(".mp-export-status");
    if (!svg) {
      const markup = chartStudio.exportSVG?.(
        ui.exportPanel,
        studio.scopeRows(rows()),
      );
      if (!markup) {
        status.textContent = "No chart is available for this selection.";
        return;
      }
      temporary = document.createElement("div");
      temporary.className = "mp-panel";
      temporary.style.cssText =
        "position:fixed;left:-12000px;top:0;width:900px;visibility:hidden;pointer-events:none";
      temporary.setAttribute("aria-hidden", "true");
      temporary.innerHTML = markup;
      document.body.append(temporary);
      svg = temporary.querySelector("svg");
    }
    const buttons = exportDialog.querySelectorAll(
      '[data-mp="export-svg"],[data-mp="export-png"]',
    );
    buttons.forEach((b) => (b.disabled = true));
    status.textContent = "Preparing " + format.toUpperCase() + "…";
    let objectURL;
    try {
      const clone = svg.cloneNode(true),
        source = [svg, ...svg.querySelectorAll("*")],
        copies = [clone, ...clone.querySelectorAll("*")],
        box = svg.viewBox.baseVal;
      for (let i = 0; i < source.length; i++) {
        const style = getComputedStyle(source[i]);
        for (const property of [
          "fill",
          "stroke",
          "color",
          "font-family",
          "font-size",
          "font-weight",
          "opacity",
          "fill-opacity",
          "stroke-opacity",
          "stroke-width",
          "stroke-dasharray",
          "stop-color",
          "stop-opacity",
        ])
          copies[i].style.setProperty(
            property,
            style
              .getPropertyValue(property)
              .replace(/url\(["']?[^)"']*#([^)'"]+)["']?\)/g, "url(#$1)"),
          );
        copies[i].removeAttribute("tabindex");
        copies[i].removeAttribute("data-mp");
        copies[i].removeAttribute("role");
      }
      const ns = "http://www.w3.org/2000/svg",
        W = box.width + 80,
        H = box.height + 232;
      const frame = document.createElementNS(ns, "svg");
      frame.setAttribute("xmlns", ns);
      frame.setAttribute("viewBox", `0 0 ${W} ${H}`);
      frame.setAttribute("width", String(W));
      frame.setAttribute("height", String(H));
      const style = getComputedStyle(svg.closest(".mp-panel"));
      const bg = style.backgroundColor,
        ink = style.getPropertyValue("--ink").trim() || style.color,
        muted = style.getPropertyValue("--mute").trim() || ink;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("width", String(W));
      rect.setAttribute("height", String(H));
      rect.setAttribute("fill", bg);
      frame.append(rect);
      const addText = (value, x, y, size = 12, color = muted, bold = false) => {
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", String(x));
        t.setAttribute("y", String(y));
        t.setAttribute("fill", color);
        t.setAttribute("font-family", "Arial, sans-serif");
        t.setAttribute("font-size", String(size));
        if (bold) t.setAttribute("font-weight", "700");
        t.textContent = value;
        frame.append(t);
      };
      const R = studio.scopeRows(rows()),
        context = chartStudio.exportContext(ui.exportPanel, R);
      addText(
        "PORTFOLIO LEDGER  /  " +
          (DEMO_MODE ? "SAMPLE RECORDS" : "CURRENT PORTFOLIO"),
        40,
        30,
        10,
        muted,
        true,
      );
      addText(
        context.title || PANELS[ui.exportPanel].title,
        40,
        61,
        22,
        ink,
        true,
      );
      addText(context.scope || `${R.length} projects · EUR`, 40, 85, 12, ink);
      addText(
        (context.date || "Current records") + " · " + (context.coverage || ""),
        40,
        106,
        11,
        muted,
      );
      clone.setAttribute("x", "40");
      clone.setAttribute("y", "125");
      clone.setAttribute("width", String(box.width));
      clone.setAttribute("height", String(box.height));
      clone.style.removeProperty("aspect-ratio");
      frame.append(clone);
      const legendY = box.height + 154;
      const keys =
        ui.exportPanel === "trend"
          ? [
              ["Spent", "--mp-spent"],
              ["Spent + committed", "--mp-committed"],
            ].filter(
              ([label]) =>
                settings.charts.series === "both" ||
                (settings.charts.series === "spent"
                  ? label === "Spent"
                  : label !== "Spent"),
            )
          : ui.exportPanel === "allocation"
            ? [
                ["Approved", "--studio-budget"],
                ["Spent", "--mp-spent"],
                ["Committed", "--mp-committed"],
                ["Available", "--mp-available"],
              ]
            : [];
      keys.forEach(([label, token], i) => {
        const x = 40 + (i * (W - 80)) / Math.max(1, keys.length),
          c = document.createElementNS(ns, "rect");
        c.setAttribute("x", String(x));
        c.setAttribute("y", String(legendY - 9));
        c.setAttribute("width", "8");
        c.setAttribute("height", "8");
        c.setAttribute("rx", "2");
        c.setAttribute("fill", style.getPropertyValue(token).trim() || ink);
        frame.append(c);
        addText(label, x + 14, legendY, 10);
      });
      const maxChars = Math.max(42, Math.floor((W - 80) / 6.2)),
        words = String(
          context.caption ||
            "Source coverage records evidence availability, not delivery completion.",
        ).split(/\s+/),
        lines = [];
      let line = "";
      for (const word of words) {
        if ((line + " " + word).length > maxChars && line) {
          lines.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      if (line) lines.push(line);
      lines
        .slice(0, 3)
        .forEach((text, i) => addText(text, 40, legendY + 23 + i * 15, 11));
      addText(
        `EUR · Exported ${TODAY()}${F.k ? ` · Forecast scenario ${F.k > 0 ? "+" : ""}${F.k}%` : ""} · Financial pace does not measure delivery.`,
        40,
        H - 14,
        10,
      );
      const xml = new XMLSerializer().serializeToString(frame),
        blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        name = "portfolio-" + ui.exportPanel + "-" + TODAY();
      if (format === "svg") download2(name + ".svg", blob);
      else {
        objectURL = URL.createObjectURL(blob);
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () =>
            reject(
              new Error("The browser could not render this chart. Try SVG."),
            );
          image.src = objectURL;
        });
        const canvas = document.createElement("canvas");
        canvas.width = 1800;
        canvas.height = Math.round((1800 * H) / W);
        canvas
          .getContext("2d")
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        const png = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!png) throw new Error("PNG export is unavailable. Try SVG.");
        download2(name + ".png", png);
      }
      status.textContent = format.toUpperCase() + " exported.";
    } catch (error) {
      status.textContent = error.message || "Chart export failed. Try SVG.";
    } finally {
      if (objectURL) URL.revokeObjectURL(objectURL);
      temporary?.remove();
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  function reveal(id) {
    const l = layout();
    studio.recordLayout();
    settings.activeWorkspace = "";
    l.hidden = l.hidden.filter((x) => x !== id);
    l.collapsed = l.collapsed.filter((x) => x !== id);
    persist();
    render();
    const panel = view.querySelector(`[data-mp-panel="${id}"]`);
    panel?.scrollIntoView({
      block: "start",
      behavior: RM.matches ? "auto" : "smooth",
    });
    panel?.querySelector(".mp-collapse")?.focus({ preventScroll: true });
  }
  function control(action, button) {
    const id = button.dataset.panel,
      root = button.closest(".mp-table-root");
    switch (action) {
      case "customize":
        customizing = !customizing;
        render();
        view
          .querySelector('[data-mp="customize"]')
          ?.focus({ preventScroll: true });
        return;
      case "profile":
        if (!own(PROFILES, button.dataset.profile)) return;
        settings.profile = button.dataset.profile;
        settings.activeWorkspace = "";
        ui.page = 0;
        persist();
        render();
        announce(PROFILES[settings.profile].name + " opened.");
        return;
      case "manage":
        drawManager();
        manager.showModal();
        return;
      case "close-manager":
        manager.close();
        return;
      case "collapse":
        if (own(PANELS, id))
          setPanel(id, "collapsed", !layout().collapsed.includes(id));
        return;
      case "hide":
        if (own(PANELS, id)) {
          setPanel(id, "hidden", true);
          announce(PANELS[id].title + " hidden. Restore it from Panels.");
        }
        return;
      case "pin":
        if (own(PANELS, id))
          setPanel(id, "pinned", !layout().pinned.includes(id));
        return;
      case "move-up":
        return move(id, -1);
      case "move-down":
        return move(id, 1);
      case "reveal":
        return own(PANELS, id) ? reveal(id) : undefined;
      case "allocation-scale":
        settings.charts.allocation =
          button.dataset.value === "percent" ? "percent" : "amount";
        persist();
        render();
        return;
      case "composition":
        settings.charts.composition =
          button.dataset.value === "sector" ? "sector" : "country";
        persist();
        render();
        return;
      case "pick-date":
        ui.pickedDate = button.dataset.value;
        announce(
          button.getAttribute("aria-label") || "Report date " + ui.pickedDate,
        );
        render();
        view
          .querySelector(
            `[data-mp="pick-date"][data-value="${CSS.escape(ui.pickedDate)}"]`,
          )
          ?.focus({ preventScroll: true });
        return;
      case "action-tab":
        ui.actionTab = ["bad", "warn"].includes(button.dataset.value)
          ? button.dataset.value
          : "all";
        render();
        return;
      case "deadline-tab":
        ui.deadlineTab =
          button.dataset.value === "overdue" ? "overdue" : "upcoming";
        render();
        return;
      case "sort":
        if (!root || !own(COLUMNS, button.dataset.column)) return;
        settings.table.direction =
          settings.table.sort === button.dataset.column
            ? -settings.table.direction
            : 1;
        settings.table.sort = button.dataset.column;
        ui.page = 0;
        persist();
        redrawTable(root);
        view
          .querySelector(
            `[data-mp="sort"][data-column="${settings.table.sort}"]`,
          )
          ?.focus({ preventScroll: true });
        return;
      case "clear-table":
        if (root) {
          ui.query = "";
          ui.page = 0;
          redrawTable(root, "mp-register-query");
        }
        return;
      case "row-detail":
        if (root) {
          ui.expanded.has(button.dataset.row)
            ? ui.expanded.delete(button.dataset.row)
            : ui.expanded.add(button.dataset.row);
          redrawTable(root);
          view
            .querySelector(
              `[data-mp="row-detail"][data-row="${CSS.escape(button.dataset.row)}"]`,
            )
            ?.focus({ preventScroll: true });
        }
        return;
      case "table-density":
        if (root) {
          settings.table.density =
            settings.table.density === "compact" ? "comfortable" : "compact";
          persist();
          redrawTable(root);
        }
        return;
      case "table-export":
        return root ? csvExport(root) : undefined;
      case "page-prev":
        if (root) {
          ui.page = Math.max(0, ui.page - 1);
          redrawTable(root);
        }
        return;
      case "page-next":
        if (root) {
          ui.page++;
          redrawTable(root);
        }
        return;
      case "print":
        window.print();
        return;
      case "export-layout":
        download(
          "portfolio-layout.json",
          JSON.stringify(
            { app: "Portfolio Ledger workspace", ...settings },
            null,
            2,
          ),
          "application/json",
        );
        return;
      case "import-layout":
        layoutInput.click();
        return;
      case "reset-layout":
        resetDialog.showModal();
        return;
      case "cancel-reset":
        resetDialog.close();
        return;
      case "confirm-reset":
        studio.recordLayout();
        settings.activeWorkspace = "";
        settings.profiles[settings.profile] = defaultLayout(settings.profile);
        persist();
        resetDialog.close();
        render();
        announce(
          "This profile’s layout was reset. Portfolio records are unchanged.",
        );
        return;
      case "chart-export":
        if (own(PANELS, id)) {
          ui.exportPanel = id;
          exportDialog.querySelector(".mp-export-status").textContent = "";
          exportDialog.showModal();
        }
        return;
      case "close-export":
        exportDialog.close();
        return;
      case "export-svg":
        exportChart("svg");
        return;
      case "export-png":
        exportChart("png");
        return;
    }
  }
  document.addEventListener(
    "click",
    (event) => {
      for (const menu of view.querySelectorAll(
        ".mp-more-tools[open],.mp-columns[open]",
      )) {
        if (
          !menu.contains(event.target) ||
          (menu.matches(".mp-more-tools") && event.target.closest("button,a"))
        )
          menu.open = false;
      }
      const target = event.target;
      const rsButton =
        target.closest(".rs-studio") &&
        target.closest("[data-rs-action],[data-mp]");
      const csButton = target.closest("[data-cs-action]");
      const ssButton = target.closest("[data-ss-action]");
      const psButton = target.closest("[data-ps-action]");
      const shellButton = target.closest("[data-studio-action]");
      if (
        (rsButton && registerStudio.handleClick(rsButton, event)) ||
        (csButton && chartStudio.handleClick(csButton, event)) ||
        (ssButton && scheduleStudio.handleClick(ssButton, event)) ||
        (psButton && staffStudio.handleClick(psButton, event)) ||
        (shellButton && studio.handleClick(shellButton, event))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const button = event.target.closest("[data-mp]");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      control(button.dataset.mp, button);
    },
    true,
  );
  document.addEventListener("change", (event) => {
    const el = event.target,
      root = el.closest(".mp-table-root");
    if (
      registerStudio.handleChange(el, event) ||
      chartStudio.handleChange(el, event) ||
      scheduleStudio.handleChange(el, event) ||
      staffStudio.handleChange(el, event) ||
      studio.handleChange(el, event)
    ) {
      event.stopImmediatePropagation();
      return;
    }
    if (el.dataset.mpWidth) {
      if (own(PANELS, el.dataset.mpWidth) && WIDTHS.includes(el.value))
        setPanel(el.dataset.mpWidth, "width", el.value);
      return;
    }
    if (el.dataset.mpVisibility) {
      const id = el.dataset.mpVisibility;
      if (!own(PANELS, id)) return;
      studio.recordLayout();
      settings.activeWorkspace = "";
      const hidden = layout().hidden.filter((x) => x !== id);
      if (!el.checked) hidden.push(id);
      layout().hidden = hidden;
      persist();
      render();
      return;
    }
    if (el.hasAttribute("data-mp-density")) {
      studio.recordLayout();
      settings.activeWorkspace = "";
      layout().density = el.value === "compact" ? "compact" : "comfortable";
      persist();
      render();
      return;
    }
    if (el.dataset.mpChart) {
      const key = el.dataset.mpChart;
      settings = cleanSettings({
        ...settings,
        charts: { ...settings.charts, [key]: el.value },
      });
      ui.pickedDate = "";
      persist();
      render();
      return;
    }
    if (el.hasAttribute("data-mp-scenario")) {
      $("#fk").value = el.value;
      setF("k", Number(el.value));
      return;
    }
    if (root && el.dataset.mpColumn) {
      const key = el.dataset.mpColumn;
      if (key === "name" || !own(COLUMNS, key)) return;
      const chosen = new Set(settings.table.columns);
      el.checked ? chosen.add(key) : chosen.delete(key);
      settings.table.columns = Object.keys(COLUMNS).filter((k) =>
        chosen.has(k),
      );
      persist();
      redrawTable(root);
      return;
    }
    if (root && el.dataset.mpTable) {
      const key = el.dataset.mpTable;
      settings = cleanSettings({
        ...settings,
        table: { ...settings.table, [key]: el.value },
      });
      ui.page = 0;
      persist();
      redrawTable(root);
      return;
    }
    if (root && el.dataset.mpRowSelect) {
      el.checked
        ? ui.selected.add(el.dataset.mpRowSelect)
        : ui.selected.delete(el.dataset.mpRowSelect);
      redrawTable(root);
      return;
    }
    if (root && el.hasAttribute("data-mp-page-select")) {
      const filtered = filteredRows(sourceRows(root)),
        page = filtered.slice(
          ui.page * settings.table.pageSize,
          (ui.page + 1) * settings.table.pageSize,
        );
      page.forEach((r) =>
        el.checked ? ui.selected.add(r.p.id) : ui.selected.delete(r.p.id),
      );
      redrawTable(root);
      return;
    }
  });
  view.addEventListener("input", (event) => {
    const el = event.target;
    if (
      registerStudio.handleInput(el, event) ||
      staffStudio.handleInput(el, event)
    ) {
      event.stopImmediatePropagation();
      return;
    }
    if (el.hasAttribute("data-mp-table-query")) {
      ui.query = el.value;
      ui.page = 0;
      redrawTable(el.closest(".mp-table-root"), "mp-register-query");
    } else if (el.hasAttribute("data-mp-scenario"))
      $("#mp-scenario-value").textContent =
        (Number(el.value) > 0 ? "+" : "") + el.value + "%";
  });
  layoutInput.addEventListener("change", async () => {
    const file = layoutInput.files[0];
    if (!file) return;
    try {
      if (file.size > 256 * 1024)
        throw new Error(
          "This file is too large for a layout. Choose a layout export.",
        );
      const imported = JSON.parse(await file.text());
      if (
        imported.app !== "Portfolio Ledger workspace" ||
        imported.version !== 2 ||
        !imported.profiles
      )
        throw new Error(
          "Choose a Portfolio Ledger layout export. Portfolio backups belong in Data tools.",
        );
      settings = cleanSettings(imported);
      persist();
      render();
      toast("Workspace layout imported. Portfolio data is unchanged.");
    } catch (error) {
      toast(error.message || "The layout could not be imported.");
    } finally {
      layoutInput.value = "";
    }
  });
  view.addEventListener(
    "keydown",
    (event) => {
      const handle = event.target.closest("[data-mp-handle]");
      if (
        handle &&
        customizing &&
        event.altKey &&
        ["ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        move(handle.dataset.mpHandle, event.key === "ArrowUp" ? -1 : 1);
        return;
      }
      const point = event.target.closest(".mp-point[data-mp]");
      if (point && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        control(point.dataset.mp, point);
      }
    },
    true,
  );
  function dragTarget(x, y) {
    const target = document.elementFromPoint(x, y)?.closest("[data-mp-panel]");
    view
      .querySelectorAll(".mp-drop-before,.mp-drop-after")
      .forEach((e) => e.classList.remove("mp-drop-before", "mp-drop-after"));
    if (target && ui.drag && target.dataset.mpPanel !== ui.drag.id) {
      const rect = target.getBoundingClientRect(),
        after = y > rect.top + rect.height / 2;
      ui.drag.target = target.dataset.mpPanel;
      ui.drag.after = after;
      target.classList.add(after ? "mp-drop-after" : "mp-drop-before");
    } else if (ui.drag) ui.drag.target = null;
  }
  function endDrag(cancel = false) {
    const drag = ui.drag;
    if (!drag) return;
    ui.drag = null;
    cancelAnimationFrame(drag.raf);
    view
      .querySelectorAll(".mp-dragging,.mp-drop-before,.mp-drop-after")
      .forEach((e) =>
        e.classList.remove("mp-dragging", "mp-drop-before", "mp-drop-after"),
      );
    document.body.classList.remove("mp-is-dragging");
    if (!cancel && drag.target) move(drag.id, drag.target, drag.after);
  }
  view.addEventListener(
    "dragstart",
    (event) => {
      const handle = event.target.closest("[data-mp-handle]");
      if (!handle || !customizing) return;
      event.stopImmediatePropagation();
      ui.drag = { id: handle.dataset.mpHandle };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-portfolio-panel", ui.drag.id);
      event.dataTransfer.setData("text/plain", ui.drag.id);
      handle.closest(".mp-panel").classList.add("mp-dragging");
      document.body.classList.add("mp-is-dragging");
    },
    true,
  );
  view.addEventListener(
    "dragover",
    (event) => {
      if (!ui.drag) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.dataTransfer.dropEffect = "move";
      dragTarget(event.clientX, event.clientY);
    },
    true,
  );
  view.addEventListener(
    "drop",
    (event) => {
      if (!ui.drag) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dragTarget(event.clientX, event.clientY);
      endDrag();
    },
    true,
  );
  view.addEventListener("dragend", () => endDrag(true), true);
  view.addEventListener(
    "pointerdown",
    (event) => {
      const handle = event.target.closest("[data-mp-handle]");
      if (!handle || !customizing || event.pointerType === "mouse") return;
      event.preventDefault();
      ui.drag = {
        id: handle.dataset.mpHandle,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        originY: event.clientY,
        active: false,
      };
      handle.setPointerCapture(event.pointerId);
    },
    true,
  );
  window.addEventListener(
    "pointermove",
    (event) => {
      const drag = ui.drag;
      if (!drag || drag.pointer !== event.pointerId) return;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (!drag.active && Math.abs(event.clientY - drag.originY) < 7) return;
      event.preventDefault();
      if (!drag.active) {
        drag.active = true;
        view
          .querySelector(`[data-mp-panel="${drag.id}"]`)
          ?.classList.add("mp-dragging");
        document.body.classList.add("mp-is-dragging");
        const scroll = () => {
          if (ui.drag !== drag) return;
          if (drag.y < 80) window.scrollBy(0, -8);
          else if (drag.y > innerHeight - 120) window.scrollBy(0, 8);
          dragTarget(drag.x, drag.y);
          drag.raf = requestAnimationFrame(scroll);
        };
        drag.raf = requestAnimationFrame(scroll);
      }
      dragTarget(drag.x, drag.y);
    },
    { passive: false },
  );
  window.addEventListener("pointerup", (event) => {
    if (ui.drag?.pointer === event.pointerId) endDrag();
  });
  window.addEventListener("pointercancel", (event) => {
    if (ui.drag?.pointer === event.pointerId) endDrag(true);
  });
  return {
    home,
    analytics,
    table,
    afterRender,
    staff: (R) => staffStudio.page(R),
    scopeRows: (R) => studio.scopeRows(R),
  };
})();
V.home = () => Masterpiece.home(rows());
V.overview = () => Masterpiece.analytics(rows());
V.team = () => Masterpiece.staff(rows());
table = (R) => Masterpiece.table(R);
