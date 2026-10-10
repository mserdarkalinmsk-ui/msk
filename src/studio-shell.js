/* Shared analysis scope, named workspaces and source-backed decision briefs. */
function normalizeAnalysisScope(value) {
  const v = value && typeof value === "object" ? value : {};
  const iso = (input) =>
    typeof input === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(input) &&
    Number.isFinite(Date.parse(input)) &&
    new Date(input).toISOString().slice(0, 10) === input
      ? input
      : "";
  const id = (input) =>
    typeof input === "string" &&
    input.length <= 160 &&
    !/[\u0000-\u001f]/.test(input)
      ? input
      : "all";
  const from = iso(v.from),
    to = iso(v.to);
  return {
    country: id(v.country) || "all",
    project: id(v.project) || "all",
    from,
    to: from && to && from > to ? "" : to,
  };
}
function normalizeScheduleSettings(value) {
  const v = value && typeof value === "object" ? value : {},
    range = normalizeAnalysisScope(v);
  return {
    zoom: ["quarter", "month", "week"].includes(v.zoom) ? v.zoom : "quarter",
    window: v.window === "focus" ? "focus" : "all",
    focus: typeof v.focus === "string" ? v.focus.slice(0, 160) : "",
    milestones: v.milestones !== false,
    financial: v.financial !== false,
    from: range.from,
    to: range.to,
  };
}
function createStudioShell(api) {
  const { h, money, compact, icon, announce, render } = api;
  const layoutHistory = [];
  const saved = () => api.getSettings();
  const activeAnalysis = () => saved().analysis;
  function scopeRows(R) {
    const a = activeAnalysis();
    return R.filter(
      (r) =>
        (a.country === "all" || r.p.country === a.country) &&
        (a.project === "all" || r.p.id === a.project),
    );
  }
  function setAnalysis(patch) {
    const next = { ...activeAnalysis(), ...patch };
    if (
      Object.prototype.hasOwnProperty.call(patch, "country") &&
      !Object.prototype.hasOwnProperty.call(patch, "project")
    )
      next.project = "all";
    if (next.from && next.to && next.from > next.to) {
      api.toast("The history start date must be on or before its end date.");
      render();
      return false;
    }
    api.patchSettings({
      analysis: normalizeAnalysisScope(next),
      activeWorkspace: "",
    });
    announce(
      "Analysis selection updated. Current financial figures follow the project selection; dates restrict report history.",
    );
    return true;
  }
  function scope(base, R) {
    const a = activeAnalysis(),
      countries = [
        ...new Map(base.map((r) => [r.p.country, r.cn])).entries(),
      ].sort((x, y) => x[1].localeCompare(y[1]));
    const projects = base.filter(
      (r) => a.country === "all" || r.p.country === a.country,
    );
    const dates = base
      .flatMap((r) => api.historyReports(r.p).map((q) => q.date))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    const chip = (label, key) =>
      `<button class="studio-filter-chip" data-studio-action="clear-${key}">${h(label)} <span aria-hidden="true">×</span><span class="sr-only">Remove selection</span></button>`;
    const countryName =
      countries.find(([id]) => id === a.country)?.[1] || a.country;
    const projectName =
      base.find((r) => r.p.id === a.project)?.p.code || a.project;
    return `<section class="studio-scope studio-context" aria-labelledby="studio-scope-title"><div class="studio-scope-heading"><div><span class="studio-eyebrow">Connected analysis</span><h2 id="studio-scope-title">One selection. Every perspective.</h2></div><span class="studio-selection-count"><b>${R.length}</b> / ${base.length} projects</span></div><div class="studio-scope-controls"><label>Country<select data-studio-scope="country" aria-label="Analysis country"><option value="all">All selected countries</option>${countries.map(([id, name]) => `<option value="${h(id)}" ${a.country === id ? "selected" : ""}>${h(name)}</option>`).join("")}</select></label><label>Project<select data-studio-scope="project" aria-label="Analysis project"><option value="all">All selected projects</option>${projects.map((r) => `<option value="${h(r.p.id)}" ${a.project === r.p.id ? "selected" : ""}>${h(r.p.code)} · ${h(r.p.name)}</option>`).join("")}</select></label><label>Report history from<input type="date" data-studio-scope="from" aria-label="Report history from" value="${a.from}"></label><label>Report history to<input type="date" data-studio-scope="to" aria-label="Report history to" value="${a.to}"></label><button class="btn studio-scope-reset" data-studio-action="clear-scope">Reset selection</button></div><div class="studio-filter-chips">${a.country !== "all" ? chip(countryName, "country") : ""}${a.project !== "all" ? chip(projectName, "project") : ""}${a.from || a.to ? chip((a.from || "First report") + " → " + (a.to || "Latest report"), "history") : ""}<span>${a.from || a.to ? "History window selected" : "All recorded history"}${dates.length ? " · " + dates[0] + " — " + dates.at(-1) : " · no dated financial reports"}</span></div><p class="studio-scope-note">Country and project scope connects all panels. Report dates filter history; current budgets, actuals and register totals keep their current basis.</p></section>`;
  }
  function toolbarExtras() {
    const s = saved(),
      active = s.workspaces.find((w) => w.id === s.activeWorkspace);
    return `<div class="studio-workbench-toolbar"><div class="studio-workbench-identity"><span class="studio-eyebrow">Your working context</span><b>${h(active?.name || "Unsaved workspace")}</b></div><div class="studio-workbench-controls"><label><span class="sr-only">Saved workspace</span><select data-studio-workspaces aria-label="Saved workspace"><option value="">Choose a saved workspace</option>${s.workspaces.map((w) => `<option value="${w.id}" ${s.activeWorkspace === w.id ? "selected" : ""}>${h(w.name)}</option>`).join("")}</select></label><button class="btn" data-studio-action="save-workspace">${icon("save")}Save workspace</button>${active ? '<button class="btn" data-studio-action="delete-workspace" aria-label="Delete selected saved workspace">Remove saved view</button>' : ""}<button class="btn" data-studio-action="layout-undo" ${layoutHistory.length ? "" : "disabled"} title="Undo the last panel layout change">${icon("restore")}Undo layout</button><label class="studio-appearance-select">Palette<select data-studio-palette-select aria-label="Color palette">${[
      ["atelier", "Atelier"],
      ["executive", "Executive"],
      ["contrast", "High contrast"],
    ]
      .map(
        ([v, label]) =>
          `<option value="${v}" ${s.appearance.palette === v ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="studio-appearance-select">Motion<select data-studio-effects-select aria-label="Interface motion"><option value="subtle" ${s.appearance.effects === "subtle" ? "selected" : ""}>Subtle</option><option value="none" ${s.appearance.effects === "none" ? "selected" : ""}>None</option></select></label></div></div>`;
  }
  function brief(R) {
    const covered = R.filter((r) => r.evidence.exposure).length,
      assessable = R.filter((r) => r.pace !== null),
      off = assessable.filter((r) => r.g === "r" || r.g === "o").length,
      dates = R.map((r) => r.evidence.latest?.date)
        .filter(Boolean)
        .sort();
    const oldest = dates[0] || "No dated reports",
      newest = dates.at(-1) || "—";
    return `<section class="studio-brief" aria-labelledby="studio-brief-title"><div class="studio-brief-copy"><span class="studio-eyebrow">Portfolio intelligence · ${api.isDemo() ? "sample records" : "current records"}</span><h2 id="studio-brief-title">${off ? off + " project" + (off === 1 ? " needs" : "s need") + " a closer look." : "Your portfolio, in perspective."}</h2><p>${off ? "Financial exposure differs from elapsed project time. Inspect the source and project context before deciding." : "Read current financial position alongside dated evidence and recorded project schedules."}</p><button class="btn" data-studio-action="open-brief">${icon("expand")}Open decision brief</button></div><div class="studio-brief-facts"><div><span>Selected projects</span><strong>${R.length}</strong><small>${new Set(R.map((r) => r.p.country)).size} countries</small></div><div><span>Exposure evidence</span><strong>${covered}<small> / ${R.length}</small></strong><small>${R.length - covered ? R.length - covered + " awaiting evidence" : "Complete source coverage"}</small></div><div><span>Latest reports span</span><strong class="studio-date-fact">${h(newest)}</strong><small>Oldest latest report ${h(oldest)}</small></div></div></section>`;
  }
  function decisionContent(R) {
    const summary = api.financialSummary(R),
      actual = R.filter((r) => r.evidence.actual),
      spent = actual.length ? actual.reduce((sum, r) => sum + r.sp, 0) : null,
      observations = api.todayActions(R).slice(0, 6),
      dates = R.map((r) => r.evidence.latest?.date)
        .filter(Boolean)
        .sort(),
      a = activeAnalysis();
    return `<div class="studio-report-heading"><span class="studio-eyebrow">Portfolio Ledger · decision brief</span><h2>Evidence into decisions</h2><p>${R.length} selected projects · EUR · generated ${h(new Date().toLocaleDateString("en-GB"))}${api.isDemo() ? " · SAMPLE PORTFOLIO" : ""}</p></div><div class="studio-report-kpis"><div><span>Current approved funding</span><b>${money(summary.budget)}</b><small>${R.length}/${R.length} project records</small></div><div><span>Cumulative spent</span><b>${money(spent)}</b><small>${actual.length}/${R.length} with actuals evidence</small></div><div><span>Spent + committed</span><b>${money(summary.exposure)}</b><small>${summary.covered}/${R.length} with exposure evidence</small></div><div><span>Current availability</span><b>${money(summary.available)}</b><small>${summary.complete ? "All selected exposure covered" : "Whole-selection total withheld: incomplete coverage"}</small></div></div><div class="studio-report-context"><p><b>Current source dates:</b> ${dates.length ? h(dates[0] + " — " + dates.at(-1)) : "No dated financial reports"}. Latest reports can have different dates; these are current project figures, not a uniform historical cut-off.</p><p><b>History display:</b> ${h((a.from || "First report") + " → " + (a.to || "Latest report"))}. This window changes historical charts, not current financial values.${api.scenario() ? " Forecast scenario " + api.scenario() + "%; actuals and approved budgets are unchanged." : ""}</p></div><h3>Current project evidence</h3><div class="studio-report-scroll"><table class="studio-report-table"><thead><tr><th>Project</th><th>Approved EUR</th><th>Spent EUR</th><th>Exposure EUR</th><th>Latest actuals report</th></tr></thead><tbody>${R.map((r) => `<tr><td><a href="${api.url(r, "finance/reports")}"><b>${h(r.p.code)}</b><span>${h(r.p.name)}</span></a></td><td>${money(r.b)}</td><td>${r.evidence.actual ? money(r.sp) : "—"}</td><td>${r.evidence.exposure ? money(r.u) : "—"}</td><td>${h(r.evidence.latest?.date || (r.evidence.actual ? "Manual / undated" : "Not recorded"))}</td></tr>`).join("")}</tbody></table></div><h3>Recorded observations</h3>${observations.length ? `<ol class="studio-report-observations">${observations.map(([, tone, text, p, link]) => `<li><span class="studio-report-tone ${h(tone)}">${tone === "bad" ? "Act now" : tone === "warn" ? "Review" : "Update"}</span><a href="${h(link)}"><b>${h(text)}</b><small>${h(p.code)} · ${h(p.name)}</small></a></li>`).join("")}</ol>` : "<p>No observations in this selection. Absence of an observation does not establish delivery performance.</p>"}<p class="studio-report-method">Committed excludes spent. Source coverage records availability, not verification or delivery quality. Financial pace compares exposure with elapsed time; it does not measure project completion. Forecasts remain estimates. A dash means insufficient evidence, not zero.</p>`;
  }
  const workspaceDialog = document.createElement("dialog");
  workspaceDialog.id = "studio-workspace-dialog";
  workspaceDialog.className = "mp-dialog studio-workspace-dialog";
  workspaceDialog.setAttribute("aria-labelledby", "studio-workspace-title");
  workspaceDialog.innerHTML = `<form id="studio-workspace-form"><header><div><span class="studio-eyebrow">A context worth keeping</span><h2 id="studio-workspace-title">Save this workspace</h2></div><button type="button" class="mp-icon-button" data-studio-action="close-workspace" aria-label="Close workspace save">${icon("close")}</button></header><label for="studio-workspace-name">Workspace name</label><input id="studio-workspace-name" name="workspace" required maxlength="64" placeholder="Quarterly finance review" autocomplete="off"><p>Keep the selection, panels, charts, register preferences, palette and forecast scenario together. Saving an existing name updates that workspace; portfolio records are preserved.</p><div class="acts"><button type="button" class="btn" data-studio-action="close-workspace">Cancel</button><button type="submit" class="btn pri">Save workspace</button></div></form>`;
  document.body.append(workspaceDialog);
  const briefDialog = document.createElement("dialog");
  briefDialog.id = "studio-brief-dialog";
  briefDialog.className = "mp-dialog studio-brief-dialog";
  briefDialog.setAttribute("aria-labelledby", "studio-brief-dialog-title");
  document.body.append(briefDialog);
  function snapshot() {
    const s = saved();
    return {
      profile: s.profile,
      profiles: s.profiles,
      charts: s.charts,
      table: s.table,
      schedule: s.schedule,
      analysis: s.analysis,
      appearance: s.appearance,
      scenario: api.scenario(),
      registerState: api.getRegisterState?.() || { query: "" },
    };
  }
  workspaceDialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = workspaceDialog.querySelector("input"),
      name = input.value.trim();
    if (!name) {
      input.setCustomValidity("Enter a workspace name.");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    const s = saved(),
      existing = s.workspaces.find(
        (w) => w.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
      id =
        existing?.id ||
        "ws-" +
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 7),
      entry = { id, name, snapshot: JSON.parse(JSON.stringify(snapshot())) };
    const workspaces = s.workspaces.filter((w) => w.id !== id);
    if (workspaces.length >= 12) workspaces.shift();
    workspaces.push(entry);
    api.patchSettings({ workspaces, activeWorkspace: id });
    workspaceDialog.close();
    announce("Workspace " + name + " saved on this device.");
  });
  workspaceDialog
    .querySelector("input")
    .addEventListener("input", (event) => event.target.setCustomValidity(""));
  workspaceDialog.addEventListener("close", () =>
    document
      .querySelector('[data-studio-action="save-workspace"]')
      ?.focus({ preventScroll: true }),
  );
  briefDialog.addEventListener("close", () =>
    document
      .querySelector('[data-studio-action="open-brief"]')
      ?.focus({ preventScroll: true }),
  );
  briefDialog.addEventListener("click", (event) => {
    if (event.target === briefDialog || event.target.closest('a[href^="#/"]'))
      briefDialog.close();
  });
  function recordLayout() {
    const s = saved();
    layoutHistory.push({
      profile: s.profile,
      layout: JSON.parse(JSON.stringify(s.profiles[s.profile])),
    });
    if (layoutHistory.length > 20) layoutHistory.shift();
  }
  function printBrief() {
    const content = briefDialog.querySelector(
      "#studio-brief-content",
    )?.innerHTML;
    if (!content) return;
    const frame = document.createElement("iframe");
    frame.title = "Decision brief print";
    frame.style.cssText =
      "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0";
    frame.onload = () => {
      frame.contentWindow.addEventListener("afterprint", () => frame.remove(), {
        once: true,
      });
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 120000);
    };
    frame.srcdoc =
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Portfolio decision brief</title><style>@page{size:A4;margin:14mm}body{font:11px system-ui,sans-serif;color:#17253c}h2{font-size:28px;margin:7px 0}h3{font-size:15px;margin:22px 0 10px}.studio-eyebrow{font-size:9px;letter-spacing:1px;color:#375db3}.studio-report-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.studio-report-kpis span,.studio-report-kpis small{display:block;font-size:9px;color:#53647b}.studio-report-kpis b{display:block;font-size:19px;margin:8px 0}.studio-report-context{padding:10px;background:#f1f4f9;line-height:1.6}table{width:100%;border-collapse:collapse}th,td{padding:9px 5px;text-align:right;border-bottom:1px solid #dde3ed;font-size:10px}th:first-child,td:first-child{text-align:left}td span{display:block;font-size:9px;margin-top:3px}a{color:inherit;text-decoration:none}.studio-report-observations{padding-left:18px}.studio-report-observations li{padding:6px 0;break-inside:avoid}.studio-report-tone{font-size:9px;margin-right:8px}.studio-report-observations small{display:block;color:#53647b;margin-top:3px}.studio-report-method{font-size:9px;line-height:1.6;border-top:1px solid #dde3ed;padding-top:12px}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body>' +
      content +
      "</body></html>";
    document.body.append(frame);
  }
  function handleClick(button, event) {
    const action = button.dataset.studioAction;
    if (!action) return false;
    if (action === "clear-scope")
      setAnalysis({ country: "all", project: "all", from: "", to: "" });
    else if (action === "clear-country")
      setAnalysis({ country: "all", project: "all" });
    else if (action === "clear-project") setAnalysis({ project: "all" });
    else if (action === "clear-history") setAnalysis({ from: "", to: "" });
    else if (action === "save-workspace") {
      workspaceDialog.querySelector("input").value =
        saved().workspaces.find((w) => w.id === saved().activeWorkspace)
          ?.name || "";
      workspaceDialog.showModal();
    } else if (action === "close-workspace") workspaceDialog.close();
    else if (action === "delete-workspace") {
      api.patchSettings({
        workspaces: saved().workspaces.filter(
          (w) => w.id !== saved().activeWorkspace,
        ),
        activeWorkspace: "",
      });
      announce("Saved workspace removed. Portfolio records are unchanged.");
    } else if (action === "layout-undo") {
      const previous = layoutHistory.pop();
      if (previous) {
        const s = saved();
        api.patchSettings({
          profile: previous.profile,
          profiles: { ...s.profiles, [previous.profile]: previous.layout },
          activeWorkspace: "",
        });
        announce("Last panel layout change undone.");
      }
    } else if (action === "open-brief") {
      const R = scopeRows(api.getBaseRows());
      briefDialog.innerHTML = `<header><div><span class="studio-eyebrow">Selected evidence</span><h2 id="studio-brief-dialog-title">Decision brief</h2></div><button class="mp-icon-button" data-studio-action="close-brief" aria-label="Close decision brief">${icon("close")}</button></header><div id="studio-brief-content">${decisionContent(R)}</div><footer><span>Current scope · source coverage included</span><button class="btn pri" data-studio-action="print-brief">${icon("print")}Print / save PDF</button></footer>`;
      briefDialog.showModal();
    } else if (action === "close-brief") briefDialog.close();
    else if (action === "print-brief") printBrief();
    else return false;
    return true;
  }
  function handleChange(el) {
    if (el.dataset.studioScope) {
      setAnalysis({ [el.dataset.studioScope]: el.value });
      return true;
    }
    if (el.hasAttribute("data-studio-palette-select")) {
      api.patchSettings({
        appearance: { ...saved().appearance, palette: el.value },
      });
      announce("Color palette updated.");
      return true;
    }
    if (el.hasAttribute("data-studio-effects-select")) {
      api.patchSettings({
        appearance: { ...saved().appearance, effects: el.value },
      });
      return true;
    }
    if (el.hasAttribute("data-studio-workspaces")) {
      const w = saved().workspaces.find((w) => w.id === el.value);
      if (w) {
        api.restoreWorkspace(w);
        announce("Workspace " + w.name + " restored.");
      }
      return true;
    }
    return false;
  }
  function afterRender() {
    for (const node of [document.documentElement, document.body]) {
      node.dataset.studioPalette = saved().appearance.palette;
      node.dataset.studioEffects = saved().appearance.effects;
    }
  }
  return {
    scopeRows,
    scope,
    toolbarExtras,
    brief,
    setAnalysis,
    recordLayout,
    afterRender,
    handleClick,
    handleChange,
    snapshot,
  };
}
