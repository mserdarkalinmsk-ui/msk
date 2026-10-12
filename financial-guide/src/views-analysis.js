/* Financial analysis (country portfolios, Excel/CSV budget vs report) and scenario practice. */
(function () {
  "use strict";
  const { C, esc, euro, pct, ui, route, fmtDate } = FG;
  const A = window.FG_ANALYSIS;

  /* ---------- state ---------- */
  const DEFAULT = { countries: [{ id: "c1", name: "Türkiye", leadMonths: 12, horizon: 36 }], active: "c1", projects: [], seq: 1 };
  const state = () => FG.store.get("portfolio", null) || JSON.parse(JSON.stringify(DEFAULT));
  const save = (s) => FG.store.set("portfolio", s);
  const results = () => FG.store.get("analysis", {});
  const saveResult = (id, r) => { const all = results(); if (r) all[id] = r; else delete all[id]; FG.store.set("analysis", all); };
  const country = (s) => s.countries.find((c) => c.id === s.active) || s.countries[0];
  const projectsOf = (s) => s.projects.filter((p) => p.country === country(s).id);
  const tone = (risk) => (risk === "High" ? "risk" : risk === "Medium" ? "warn" : "good");
  const statusTag = { over: ["Over budget", "risk"], watch: ["≥ 90% used", "warn"], ok: ["On track", "good"], low: ["< 25% used", "info"], unbudgeted: ["Not in budget", "risk"], idle: ["No activity", ""] };

  /* ---------- workbook reading ---------- */
  const SHEETJS = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"];
  let sheetjs = null;
  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (sheetjs) return sheetjs;
    sheetjs = SHEETJS.reduce((p, src) => p.catch(() => new Promise((resolve, reject) => {
      const s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("load")));
      s.onerror = () => { s.remove(); reject(new Error("load")); };
      document.head.appendChild(s);
    })), Promise.reject(new Error("start"))).catch(() => { sheetjs = null; throw new Error("The Excel reader could not be loaded (no internet connection?). Save the sheet as CSV and upload that instead."); });
    return sheetjs;
  }
  async function readFile(file, kind) {
    const preferred = kind === "budget" ? "report" : "consolidation";
    let sheets;
    if (/\.(csv|txt)$/i.test(file.name)) sheets = [[file.name, A.parseCSV(await file.text())]];
    else {
      const XLSX = await loadSheetJS();
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      sheets = wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" })]);
    }
    let best = null, lastError = null;
    for (const [name, matrix] of sheets) {
      try {
        const parsed = A.parseSheet(matrix, C.columnAliases, kind);
        const score = parsed.lines.length + (A.norm(name) === preferred ? 10000 : A.norm(name).includes(preferred) ? 5000 : 0);
        if (parsed.lines.length && (!best || score > best.score)) best = { ...parsed, sheet: name, score };
      } catch (e) { lastError = e; }
    }
    if (!best) throw lastError || new Error("No usable financial rows were found in the file.");
    return { file: file.name, sheet: best.sheet, headerRow: best.headerRow, headers: best.headers, lines: best.lines, skipped: best.skipped };
  }

  /* ---------- sample data ---------- */
  function sampleProject(s) {
    const id = "p" + s.seq++, year = new Date().getFullYear();
    const budget = [["1.1", "Project manager", 96000, 24, "month"], ["1.2", "Project officer", 72000, 24, "month"], ["2.1", "International travel", 30000, 20, "trip"], ["2.2", "Local travel", 12000, 0, ""], ["3.1", "IT equipment", 15000, 0, ""], ["4.1", "Office rent", 24000, 24, "month"], ["5.1", "Expert consultancy", 60000, 120, "day"], ["5.2", "Conferences & events", 45000, 6, "event"], ["5.3", "Translation & interpretation", 18000, 0, ""], ["7.1", "Indirect costs (7%)", 26040, 0, ""]];
    const report = [["1.1", 58000, 4000, 15], ["1.2", 41000, 3000, 14], ["2.1", 21000, 6500, 15], ["2.2", 2100, 0, 0], ["3.1", 15800, 0, 0], ["4.1", 14000, 1000, 14], ["5.1", 22000, 30000, 128], ["5.2", 9000, 5000, 2], ["5.3", 3500, 2000, 0], ["7.1", 13000, 0, 0], ["6.9", 900, 0, 0]];
    const lines = (rows, kind) => rows.map((r) => kind === "budget" ? { key: r[0], desc: r[1], budget: r[2], spent: 0, committed: 0, units: r[3], unit: r[4] } : { key: r[0], desc: "", budget: 0, spent: r[1], committed: r[2], units: r[3], unit: "" });
    const p = { id, country: s.active, name: "Sample — Justice reform JP", donor: "EU / CoE Joint Programme", start: `${year - 1}-03-01`, end: `${year + 1}-02-28`, staff: 2.5, leadMonths: 12, budgetFile: "sample-budget.xlsx", reportFile: "sample-q3-report.xlsx", sample: true };
    return { p, budget: { file: p.budgetFile, sheet: "report", lines: lines(budget, "budget") }, report: { file: p.reportFile, sheet: "Consolidation", lines: lines(report, "report") } };
  }
  function analyse(p, budget, report) {
    const cmp = A.compare(budget, report);
    return { at: new Date().toISOString(), budgetFile: budget.file, reportFile: report.file, sheets: [budget.sheet, report.sheet], headerRows: [budget.headerRow, report.headerRow], ...cmp };
  }
  const pending = {}; // parsed files waiting for their pair (memory only)

  /* ---------- portfolio view ---------- */
  route("analysis", {
    crumbs: () => [["Financial analysis", "analysis"]],
    render() {
      const s = state(), c = country(s), list = projectsOf(s), res = results();
      const pf = A.portfolio(list, res);
      const used = new Set(s.countries.map((x) => x.name));
      const rows = pf.signals.map((sig) => {
        const p = sig.project, r = res[p.id];
        return `<div class="project-row"><div><a href="#/analysis/${p.id}"><b>${esc(p.name || "Untitled project")}</b></a><small>${esc(p.donor || "Funding source not set")} · ${p.start ? `${fmtDate(p.start)} – ${fmtDate(p.end)}` : "dates not set"}</small></div>
          <div><small>Budget</small><b class="num">${r ? euro(r.totals.budget) : "—"}</b></div>
          <div><small>Used (spent + committed)</small><b class="num">${r ? pct(r.totals.util) : "—"}</b>${r ? ui.bar(r.totals.util, r.totals.util > 100 ? "risk" : r.totals.util >= 90 ? "warn" : "") : ""}</div>
          <div><small>Time elapsed</small><b class="num">${pct(sig.timePct)}</b></div>
          <div><small>Next project preparation</small><b>${sig.daysToPrep == null ? "Set dates" : sig.daysToPrep <= 0 ? "Start now" : `${sig.daysToPrep} days`}</b></div>
          <div class="row">${ui.tag(sig.risk + " risk", tone(sig.risk))}<a class="btn sm" href="#/analysis/${p.id}">Open</a></div></div>`;
      }).join("");
      return { html: `${ui.head("Excel-driven financial control", "Financial analysis", "Compare the approved budget with extracted financial data, group projects by country and see continuity and pipeline signals. Files are read in your browser; nothing is uploaded.", `<button class="btn" data-sample>Load sample project</button><button class="btn primary" data-add>＋ Add project</button>`)}
        <div class="row"><div class="chips" data-countries>${s.countries.map((x) => `<span class="chip" aria-pressed="${x.id === c.id}"><button class="chip-btn" data-country="${x.id}" style="border:0;background:none;padding:0;cursor:pointer;color:inherit;font:inherit">${esc(x.name)} <span class="muted">${s.projects.filter((p) => p.country === x.id).length}</span></button>${s.countries.length > 1 ? `<button class="x" data-del-country="${x.id}" aria-label="Delete ${esc(x.name)} portfolio">×</button>` : ""}</span>`).join("")}</div>
          <select class="input" style="max-width:220px" data-new-country aria-label="Add a country portfolio"><option value="">＋ Add country…</option>${C.countries.filter((n) => !used.has(n)).map((n) => `<option>${esc(n)}</option>`).join("")}</select>
          <span class="spacer"></span><label class="row small">Preparation lead time <select class="input" style="width:110px" data-lead>${[6, 9, 12, 18, 24].map((m) => `<option value="${m}" ${m === (c.leadMonths || 12) ? "selected" : ""}>${m} months</option>`).join("")}</select></label></div>
        <div class="mt">${ui.kpis([["Active budget", pf.coverage[0] ? euro(pf.totals.budget) : "—", `${pf.coverage[0]}/${pf.coverage[1]} projects analysed`], ["Used (spent + committed)", pf.coverage[0] ? pct(pf.util) : "—", pf.coverage[0] ? euro(pf.totals.exposure) : "After analysis"], ["Staff / FTE", pf.staff.toFixed(1), `${pf.ending12} project(s) ending within 12 months`], ["Next pipeline action", pf.nextPrep ? fmtDate(pf.nextPrep.prepDate) : "—", pf.prepDue ? `${pf.prepDue} preparation(s) due now` : `${c.leadMonths || 12}-month preparation lead`]])}</div>
        <section class="card mt"><div class="card-head"><div><h3>Projects in ${esc(c.name)}</h3><small>Setup readiness ${pf.readiness}% · High risk: ${pf.risk.High || 0} · Medium: ${pf.risk.Medium || 0}</small></div></div>
          ${list.length ? rows : `<div class="empty"><b>No projects in this portfolio yet</b>Add a project with its dates and staff, then upload the approved budget and the latest financial report. Or load the sample project to explore.</div>`}</section>
        <div class="grid g2 mt">${ui.callout("info", "Expected files", "Approved budget: a sheet with a budget-line code and an approved amount column (e.g. “Budget Line”, “Approved Budget”, “Nb of Units”). Report: the same codes with “Actual Expenditure” and “Open Commitments”, or an amount with a transaction type. Excel (.xlsx) or CSV.")}
          ${ui.callout("warn", "Risk rule", "High: over budget, preparation date passed or ≤ 6 months remaining. Medium: preparation within 180 days or execution more than 20 points away from elapsed time.")}</div>`,
        mount(root) {
          root.addEventListener("click", (e) => {
            const s2 = state();
            const cb = e.target.closest("[data-country]"); if (cb) { s2.active = cb.dataset.country; save(s2); FG.refresh(); }
            const del = e.target.closest("[data-del-country]");
            if (del) { const cc = s2.countries.find((x) => x.id === del.dataset.delCountry), n = s2.projects.filter((p) => p.country === cc.id).length;
              if (confirm(`Delete the ${cc.name} portfolio${n ? ` and its ${n} project(s)` : ""}?`)) { s2.projects.filter((p) => p.country === cc.id).forEach((p) => saveResult(p.id, null)); s2.projects = s2.projects.filter((p) => p.country !== cc.id); s2.countries = s2.countries.filter((x) => x.id !== cc.id); s2.active = s2.countries[0].id; save(s2); FG.refresh(); } }
            if (e.target.closest("[data-add]")) { const p = { id: "p" + s2.seq++, country: s2.active, name: "", donor: "", start: "", end: "", staff: "", leadMonths: country(s2).leadMonths || 12 }; s2.projects.push(p); save(s2); FG.go(`analysis/${p.id}`); }
            if (e.target.closest("[data-sample]")) { const x = sampleProject(s2); s2.projects.push(x.p); save(s2); saveResult(x.p.id, analyse(x.p, x.budget, x.report)); FG.go(`analysis/${x.p.id}`); }
          });
          root.querySelector("[data-new-country]").addEventListener("change", (e) => { if (!e.target.value) return; const s2 = state(), id = "c" + Date.now(); s2.countries.push({ id, name: e.target.value, leadMonths: 12, horizon: 36 }); s2.active = id; save(s2); FG.toast(`${e.target.value} portfolio created`); FG.refresh(); });
          root.querySelector("[data-lead]").addEventListener("change", (e) => { const s2 = state(); country(s2).leadMonths = +e.target.value; projectsOf(s2).forEach((p) => { p.leadMonths = +e.target.value; }); save(s2); FG.refresh(); });
        } };
    },
  });

  // Line chart: ideal linear burn (time) against actual use today and the run-rate projection to the end date.
  function paceChart(sig, t) {
    if (sig.timePct == null) return `<div class="empty"><b>Add start and end dates</b>The chart compares budget use with elapsed time.</div>`;
    const W = 560, H = 230, P = 34, x = (v) => P + (v / 100) * (W - 2 * P), y = (v) => H - P - (Math.min(v, 130) / 130) * (H - 2 * P);
    const proj = t.budget ? Math.min(130, (sig.forecast / t.budget) * 100) : 0, now = Math.min(130, t.util), tx = sig.timePct;
    const over = proj > 100;
    return `<svg class="pace" viewBox="0 0 ${W} ${H}" role="img" aria-label="Used ${now.toFixed(0)}% after ${tx.toFixed(0)}% of time; projected ${proj.toFixed(0)}% at end">
      ${[0, 50, 100].map((g) => `<line x1="${P}" x2="${W - P}" y1="${y(g)}" y2="${y(g)}" class="grid"/><text x="${P - 6}" y="${y(g) + 4}" text-anchor="end">${g}%</text>`).join("")}
      <line x1="${x(0)}" y1="${y(0)}" x2="${x(100)}" y2="${y(100)}" class="ideal"/>
      <line x1="${x(tx)}" y1="${y(now)}" x2="${x(100)}" y2="${y(proj)}" class="proj ${over ? "bad" : ""}"/>
      <polyline points="${x(0)},${y(0)} ${x(tx)},${y(now)}" class="actual"/>
      <line x1="${x(tx)}" x2="${x(tx)}" y1="${y(0)}" y2="${y(130)}" class="today"/><text x="${x(tx)}" y="${P - 8}" text-anchor="middle" class="lbl">today</text>
      <circle cx="${x(tx)}" cy="${y(now)}" r="5" class="dot"/><circle cx="${x(100)}" cy="${y(proj)}" r="4" class="dot2 ${over ? "bad" : ""}"/>
      <text x="${x(100)}" y="${y(proj) - 9}" text-anchor="end" class="lbl">${proj.toFixed(0)}% at end</text>
      <text x="${P}" y="${H - 6}" class="axis">start</text><text x="${W - P}" y="${H - 6}" text-anchor="end" class="axis">end</text></svg>
      <div class="legend"><span><i style="background:var(--muted)"></i>Even pace</span><span><i style="background:var(--c1)"></i>Actual</span><span><i style="background:${over ? "var(--risk)" : "var(--c2)"}"></i>Projection</span></div>`;
  }

  /* ---------- project view ---------- */
  route("analysis/:id", {
    section: "analysis",
    crumbs: (p) => { const pr = state().projects.find((x) => x.id === p.id); return [["Financial analysis", "analysis"], [pr ? pr.name || "New project" : "Project", `analysis/${p.id}`]]; },
    render(params) {
      const s = state(), p = s.projects.find((x) => x.id === params.id);
      if (!p) return { html: `<div class="empty"><b>Project not found</b><a class="btn mt" href="#/analysis">Back to portfolio</a></div>` };
      const r = results()[p.id], sig = A.projectSignals(p, r && r.totals);
      const f = FG.store.get("lines:filter", { status: "all", q: "", sort: "key" });
      const pend = pending[p.id] || {};
      const drop = (kind, label, hint) => { const done = pend[kind] || (r && (kind === "budget" ? r.budgetFile : r.reportFile)); const err = pend[kind + "Error"];
        return `<label class="drop ${err ? "err" : done ? "ok" : ""}"><input type="file" accept=".xlsx,.xls,.xlsm,.csv" data-file="${kind}" aria-label="${esc(label)}"><b>${esc(label)}</b><small>${err ? esc(err) : done ? `✓ ${esc(typeof done === "string" ? done : done.file)}${done.lines ? ` · ${done.lines.length} lines · sheet “${esc(done.sheet)}”` : ""}` : esc(hint)}</small></label>`; };
      const editor = `<section class="card"><div class="card-head"><h3>Project profile</h3><button class="btn ghost sm" data-delete>Delete project</button></div><form class="card-body form" data-profile>
        <label class="field"><span>Project name</span><input class="input" name="name" value="${esc(p.name)}" placeholder="e.g. Strengthening judicial capacity"></label>
        <label class="field"><span>Funding / donor</span><input class="input" name="donor" value="${esc(p.donor)}" placeholder="e.g. EU / CoE Joint Programme"></label>
        <div class="grid g2"><label class="field"><span>Start date</span><input class="input" type="date" name="start" value="${esc(p.start)}"></label><label class="field"><span>End date</span><input class="input" type="date" name="end" value="${esc(p.end)}"></label></div>
        <div class="grid g2">${ui.number("staff", p.staff, "Staff / FTE")}<label class="field"><span>Preparation lead</span><select class="input" name="leadMonths">${[6, 9, 12, 18, 24].map((m) => `<option value="${m}" ${m === (+p.leadMonths || 12) ? "selected" : ""}>${m} months before end</option>`).join("")}</select></label></div>
      </form></section>
      <section class="card"><div class="card-head"><h3>Financial files</h3><small>Read locally</small></div><div class="card-body stack"><div class="upload">${drop("budget", "Approved budget", "Excel or CSV with budget lines")}${drop("report", "Latest financial report", "Q1–Q4 or final extract")}</div>
        <p class="small muted">Results are saved in this browser. Upload a new report each quarter to refresh the analysis.</p></div></section>`;

      if (!r) return { html: `${ui.head("Project", p.name || "New project", "Complete the profile and add both files to run the analysis.", `<a class="btn" href="#/analysis">← Portfolio</a>`)}<div class="split-l">${`<div class="stack">${editor}</div>`}<section class="card"><div class="empty"><b>No analysis yet</b>Upload the approved budget and a financial report. The analysis runs automatically once both are read.</div></section></div>`, mount };

      const t = r.totals;
      let lines = r.lines.filter((l) => (f.status === "all" || l.status === f.status || (f.status === "units" && l.unitsExceeded)) && (!f.q || `${l.key} ${l.desc}`.toLowerCase().includes(f.q.toLowerCase())));
      const sorters = { key: (a, b) => String(a.key).localeCompare(String(b.key), undefined, { numeric: true }), util: (a, b) => b.util - a.util, remaining: (a, b) => a.remaining - b.remaining, budget: (a, b) => b.budget - a.budget };
      lines = lines.sort(sorters[f.sort] || sorters.key);
      const maxH = Math.max(...r.headings.map((h) => Math.max(h.budget, h.exposure)), 1);
      const insights = [];
      if (r.counts.over) insights.push(["risk", `${r.counts.over} line(s) over budget`, "Spent + committed exceeds the approved amount. Assess a reallocation and the Budget Heading variation."]);
      if (r.unitsExceeded) insights.push(["risk", `${r.unitsExceeded} line(s) above approved units`, "Approved Nb of Units are exceeded — this is a formal revision trigger in the Budget Revision engine."]);
      if (r.unmatched) insights.push(["warn", `${r.unmatched} report line(s) not in the budget`, "Codes in the report that do not exist in the approved budget. Check coding or a new budget line."]);
      if (r.counts.watch) insights.push(["warn", `${r.counts.watch} line(s) at 90% or more`, "Approaching the approved amount; monitor before new commitments."]);
      if (sig.paceGap != null && Math.abs(sig.paceGap) > 20) insights.push(["warn", `Execution ${sig.paceGap > 0 ? "ahead of" : "behind"} time by ${Math.abs(sig.paceGap).toFixed(0)} points`, `${pct(t.util)} used after ${pct(sig.timePct)} of the implementation period.`]);
      if (sig.forecastGap != null && sig.forecastGap < 0) insights.push(["risk", `Run-rate forecast exceeds budget by ${euro(-sig.forecastGap)}`, "At the current monthly spending pace plus open commitments."]);
      else if (sig.forecastGap != null && t.budget && sig.forecastGap / t.budget > 0.15) insights.push(["info", `Possible underspend of ${euro(sig.forecastGap)}`, "At the current pace a material part of the budget would remain unused at project end."]);
      if (!insights.length) insights.push(["good", "No material signal", "Lines, units and pace are within the expected range."]);

      return { html: `${ui.head(`Project · ${country(s).name}`, p.name || "Untitled project", `${p.donor || "Funding not set"} · ${p.start ? `${fmtDate(p.start)} – ${fmtDate(p.end)}` : "dates not set"} · analysed ${fmtDate(r.at)}${p.sample ? " · sample data" : ""}`, `<a class="btn" href="#/analysis">← Portfolio</a><button class="btn" data-export>Export CSV</button><button class="btn" data-print>Print</button>`)}
        ${ui.kpis([["Approved budget", euro(t.budget), `${r.lines.length} budget lines`], ["Spent", euro(t.spent), `${pct(t.spentRate)} of budget`], ["Committed", euro(t.committed), `Used ${pct(t.util)} in total`], ["Available", euro(t.remaining), t.remaining < 0 ? "Over-committed" : "Budget − spent − committed"]])}
        <div class="viz-row mt"><section class="card card-pad"><div class="eyebrow">Budget use</div>${FG.ui.donut([["Spent", t.spent, "var(--c1)"], ["Committed", t.committed, "var(--c4)"], ["Available", Math.max(0, t.remaining), "var(--c2)"]], pct(t.util), "used")}${t.remaining < 0 ? ui.callout("risk", "Over-committed", `${euro(-t.remaining)} above the approved budget.`) : ""}</section>
        <section class="card card-pad"><div class="eyebrow">Execution vs time</div>${paceChart(sig, t)}</section></div>
        <div class="grid g4 mt">
          <div class="card card-pad"><small class="muted">Time elapsed</small><b class="num" style="display:block;font-size:18px">${pct(sig.timePct)}</b>${ui.bar(sig.timePct)}<small class="muted">${sig.monthsRemaining ?? "—"} months remaining</small></div>
          <div class="card card-pad"><small class="muted">Execution vs time</small><b class="num" style="display:block;font-size:18px">${sig.paceGap == null ? "—" : `${sig.paceGap >= 0 ? "+" : ""}${sig.paceGap.toFixed(0)} pts`}</b><small class="muted">Used % minus elapsed %</small></div>
          <div class="card card-pad"><small class="muted">Run-rate forecast at end</small><b class="num" style="display:block;font-size:18px">${sig.forecast == null ? "—" : euro(sig.forecast)}</b><small class="muted">${sig.burn ? `${euro(sig.burn)} spent per month` : "Needs a start date"}</small></div>
          <div class="card card-pad"><small class="muted">Continuity</small><b style="display:block;font-size:18px">${ui.tag(sig.risk + " risk", tone(sig.risk))}</b><small class="muted">${sig.prepDate ? `Prepare next phase by ${fmtDate(sig.prepDate)}` : "Set the end date"}</small></div>
        </div>
        <div class="split mt"><div class="stack">
          <section class="card"><div class="card-head"><div><h3>Budget headings</h3><small>Spent and committed against the approved amount</small></div><div class="legend"><span><i style="background:var(--accent)"></i>Spent</span><span><i style="background:color-mix(in srgb,var(--accent) 40%,transparent)"></i>Committed</span><span><i style="background:var(--ink);width:2px"></i>Budget</span></div></div><div class="card-body">
            ${r.headings.map((h) => `<div class="hbar ${h.status === "over" || h.status === "unbudgeted" ? "over" : ""}"><span title="${esc(h.name)}">${esc(h.id)} · ${esc(h.name)}</span><div class="track" role="img" aria-label="${esc(h.name)}: ${pct(h.util)} used of ${euro(h.budget)}"><i class="c" style="width:${(h.exposure / maxH) * 100}%"></i><i class="s" style="width:${(h.spent / maxH) * 100}%"></i><i style="left:${(h.budget / maxH) * 100}%;width:2px;background:var(--ink)"></i></div><em>${h.budget ? pct(h.util) : "—"}</em></div>`).join("")}
          </div></section>
          <section class="card"><div class="card-head"><h3>Budget lines</h3><small>${lines.length} of ${r.lines.length}</small></div><div class="card-body stack">
            <div class="row" data-filters><input class="input" style="max-width:240px" type="search" data-q placeholder="Search code or description" aria-label="Search budget lines" value="${esc(f.q)}">
              <div class="chips">${[["all", "All"], ["over", "Over"], ["watch", "≥ 90%"], ["low", "< 25%"], ["unbudgeted", "Not in budget"], ["units", "Units exceeded"]].map(([k, l]) => `<button class="chip" data-status="${k}" aria-pressed="${f.status === k}">${l}</button>`).join("")}</div>
              <span class="spacer"></span><select class="input" style="width:170px" data-sort aria-label="Sort lines">${[["key", "Sort by code"], ["util", "Highest use first"], ["remaining", "Lowest balance first"], ["budget", "Largest budget first"]].map(([k, l]) => `<option value="${k}" ${f.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
            <div class="table-wrap" style="max-height:560px"><table class="t"><thead><tr><th>Line</th><th class="n">Budget</th><th class="n">Spent</th><th class="n">Committed</th><th class="n">Available</th><th class="n">Used</th><th>Units</th><th>Status</th></tr></thead><tbody>
              ${lines.map((l) => `<tr><td><b>${esc(l.key)}</b><small>${esc(l.desc)}</small></td><td class="n">${euro(l.budget)}</td><td class="n">${euro(l.spent)}</td><td class="n">${euro(l.committed)}</td><td class="n" style="${l.remaining < 0 ? "color:var(--risk);font-weight:700" : ""}">${euro(l.remaining)}</td><td class="n">${l.budget ? pct(l.util) : "—"}</td><td>${l.unitsApproved ? `${l.unitsReported}/${l.unitsApproved} ${esc(l.unit)}${l.unitsExceeded ? " " + ui.tag("exceeded", "risk") : ""}` : '<span class="muted">—</span>'}</td><td>${ui.tag(...statusTag[l.status])}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">No line matches the filter.</td></tr>`}
            </tbody><tfoot><tr><td>Total</td><td class="n">${euro(t.budget)}</td><td class="n">${euro(t.spent)}</td><td class="n">${euro(t.committed)}</td><td class="n">${euro(t.remaining)}</td><td class="n">${pct(t.util)}</td><td colspan="2"></td></tr></tfoot></table></div>
            <p class="small muted">Budget sheet “${esc(r.sheets[0])}” (header row ${r.headerRows[0] ?? "—"}) · report sheet “${esc(r.sheets[1])}” (header row ${r.headerRows[1] ?? "—"}). Subtotal and total rows are excluded.</p>
          </div></section>
        </div>
        <aside class="stack sticky">
          <section class="card"><div class="card-head"><h3>Signals</h3></div><div class="card-body stack">${insights.map(([tn, a, b]) => ui.callout(tn, a, b)).join("")}
            <a class="btn" href="#/engines/budget-revision">Assess a budget revision →</a></div></section>
          ${editor}
        </aside></div>`, mount };

      function mount(root) {
        const form = root.querySelector("[data-profile]");
        form.addEventListener("change", () => { const s2 = state(), pr = s2.projects.find((x) => x.id === p.id); Object.assign(pr, Object.fromEntries(new FormData(form))); save(s2); FG.refresh(); });
        root.querySelector("[data-delete]").onclick = () => { if (!confirm(`Delete ${p.name || "this project"} and its analysis?`)) return; const s2 = state(); s2.projects = s2.projects.filter((x) => x.id !== p.id); save(s2); saveResult(p.id, null); FG.go("analysis"); };
        root.querySelectorAll("[data-file]").forEach((input) => {
          const zone = input.closest(".drop");
          zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
          zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
          zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("drag"); if (e.dataTransfer.files[0]) handle(input.dataset.file, e.dataTransfer.files[0]); });
          input.addEventListener("change", () => input.files[0] && handle(input.dataset.file, input.files[0]));
        });
        async function handle(kind, file) {
          const pend2 = (pending[p.id] = pending[p.id] || {});
          const zone = root.querySelector(`[data-file="${kind}"]`).closest(".drop"); zone.querySelector("small").textContent = "Reading…";
          try {
            pend2[kind] = await readFile(file, kind === "budget" ? "budget" : "extract"); delete pend2[kind + "Error"];
            const s2 = state(), pr = s2.projects.find((x) => x.id === p.id); pr[kind === "budget" ? "budgetFile" : "reportFile"] = file.name; pr.sample = false; save(s2);
            const prev = results()[p.id];
            const budget = pend2.budget || (prev && prev.budgetSource), report = pend2.report || (prev && prev.reportSource);
            if (budget && report) { const res = analyse(pr, budget, report); res.budgetSource = budget; res.reportSource = report; saveResult(p.id, res); FG.toast("Analysis updated"); }
            else FG.toast(`${kind === "budget" ? "Budget" : "Report"} read — add the ${kind === "budget" ? "financial report" : "approved budget"} to run the analysis`);
          } catch (e) { pend2[kind + "Error"] = e.message; }
          FG.refresh();
        }
        if (!r) return;
        const ff = () => FG.store.get("lines:filter", { status: "all", q: "", sort: "key" });
        root.querySelectorAll("[data-status]").forEach((b) => (b.onclick = () => { FG.store.set("lines:filter", { ...ff(), status: b.dataset.status }); FG.refresh(); }));
        root.querySelector("[data-sort]").onchange = (e) => { FG.store.set("lines:filter", { ...ff(), sort: e.target.value }); FG.refresh(); };
        const q = root.querySelector("[data-q]");
        q.addEventListener("input", () => { FG.store.set("lines:filter", { ...ff(), q: q.value }); FG.refresh(); const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
        root.querySelector("[data-print]").onclick = () => window.print();
        root.querySelector("[data-export]").onclick = () => {
          const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
          const csv = [["Line", "Description", "Budget", "Spent", "Committed", "Available", "Used %", "Approved units", "Reported units", "Status"].map(cell).join(","),
            ...r.lines.map((l) => [l.key, l.desc, l.budget, l.spent, l.committed, l.remaining, l.budget ? l.util.toFixed(1) : "", l.unitsApproved || "", l.unitsReported || "", statusTag[l.status][0]].map(cell).join(","))].join("\r\n");
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `${(p.name || "project").replace(/[^\w-]+/g, "_")}_analysis.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        };
      }
    },
  });
  FG.addIndex("Financial analysis", "Budget vs actual from Excel, country portfolios and continuity", "analysis", "Engine", "excel upload variance underspend overspend portfolio country fte staff pipeline");

  /* ---------- scenario practice ---------- */
  const CAT = { procurement: ["Procurement", "procurement/thresholds-and-procedure"], forecast: ["Forecast", "foma/forecast"], grant: ["Grant", "grants/procedure"], yearend: ["Year-end", "year-end"], payment: ["PO & payment", "payment-file"], reporting: ["Reporting", "foma/reports"], mission: ["Mission", "foma/mission-order"], filing: ["Filing", "filing"] };
  // Stable option order per scenario so the right answer is not always in the same place.
  const order = (n, i) => { const idx = [...Array(n).keys()]; let seed = i * 7919 + 17; for (let k = n - 1; k > 0; k--) { seed = (seed * 1103515245 + 12345) % 2147483648; const j = seed % (k + 1); [idx[k], idx[j]] = [idx[j], idx[k]]; } return idx; };
  route("scenarios", {
    crumbs: () => [["Scenario practice", "scenarios"]],
    render() {
      const qs = new URLSearchParams(location.hash.split("?")[1] || "");
      if (qs.get("cat")) FG.store.set("sc:cat", qs.get("cat"));
      const level = FG.store.get("sc:level", "basic"), cat = FG.store.get("sc:cat", "all"), answers = FG.store.get("scenarioAnswers", {});
      const list = C.scenarios.map((x, i) => ({ ...x, i })).filter((x) => (level === "all" || x.level === level) && (cat === "all" || x.cat === cat));
      const done = list.filter((x) => answers[x.i]), ok = done.filter((x) => answers[x.i].ok).length;
      return { html: `${ui.head("Practice · decide · learn", "Scenario practice", "Realistic decisions across procurement, finance, grants, reporting, year-end, missions and filing. Answers are kept in this browser.", `<button class="btn" data-reset-sc>Reset answers</button>`)}
        <div class="row">${ui.seg("level", [["basic", "Basic"], ["advanced", "Advanced"], ["all", "All levels"]], level)}<div class="chips">${[["all", "All topics"], ...Object.entries(CAT).map(([k, v]) => [k, v[0]])].map(([k, l]) => `<button class="chip" data-cat="${k}" aria-pressed="${k === cat}">${esc(l)}</button>`).join("")}</div></div>
        <div class="card card-pad mt"><div class="progress-head"><span>${done.length} of ${list.length} answered · ${ok} correct</span><span>${done.length ? pct((ok / done.length) * 100) : "—"} score</span></div>${ui.bar((done.length / Math.max(1, list.length)) * 100, "good")}</div>
        <div class="grid g2 mt">${list.map((x) => { const a = answers[x.i], o = order(x.opts.length, x.i);
          return `<article class="card scenario"><div class="row">${ui.tag(CAT[x.cat][0], "accent")}${ui.tag(x.level)}</div><h3>${esc(x.title)}</h3><p class="q">${esc(x.q)}</p>
            <div class="opts">${o.map((k) => `<button type="button" data-sc="${x.i}" data-opt="${k}" ${a ? "disabled" : ""} class="${a ? (k === x.correct ? "right" : k === a.choice ? "wrong" : "") : ""}">${esc(x.opts[k])}</button>`).join("")}</div>
            ${a ? `<div class="feedback">${ui.callout(a.ok ? "good" : "risk", a.ok ? "Correct" : "Not quite", x.feedback)}<a class="btn ghost sm mt" href="#/${CAT[x.cat][1]}">Review the rule →</a></div>` : ""}</article>`; }).join("")}</div>`,
        onSeg(name, v) { if (name === "level") { FG.store.set("sc:level", v); FG.refresh(); } },
        mount(root) {
          root.addEventListener("click", (e) => {
            const b = e.target.closest("[data-sc]");
            if (b) { const i = +b.dataset.sc, k = +b.dataset.opt, all = FG.store.get("scenarioAnswers", {}); all[i] = { choice: k, ok: k === C.scenarios[i].correct }; FG.store.set("scenarioAnswers", all); FG.refresh(); }
            const c = e.target.closest("[data-cat]"); if (c) { FG.store.set("sc:cat", c.dataset.cat); if (location.hash.includes("?")) FG.go("scenarios"); else FG.refresh(); }
            if (e.target.closest("[data-reset-sc]") && confirm("Clear all scenario answers?")) { FG.store.set("scenarioAnswers", {}); FG.refresh(); }
          });
        } };
    },
  });
  C.scenarios.forEach((x) => FG.addIndex(x.title, `Scenario · ${x.q}`, "scenarios", "Scenario", x.feedback));
})();
