/* Task-specific refinements reuse existing nodes, event handlers and source records. */
const LedgerWorkspaceRefinements = (() => {
  const preferenceKey = "ledger.refinements.v1";
  let preferences = ls.get(preferenceKey) || {};
  const indicatorQueries = new Map();
  function added(node) { node.dataset.lpAdded = "true"; return node; }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action) {
    const node = element("button", "btn", text); node.type = "button";
    node.addEventListener("click", action); return node;
  }
  function headingCard(title) {
    return [...view.querySelectorAll(".card")].find((card) => card.querySelector("h2")?.textContent === title);
  }
  function currentProject() {
    const id = decodeURIComponent((location.hash || "").split("/")[2] || "");
    return S.projects.find((p) => p.id === id);
  }
  const deadlineDialog = element("dialog", "lp-deadlines");
  deadlineDialog.setAttribute("aria-labelledby", "lp-deadlines-title");
  document.body.append(deadlineDialog);
  deadlineDialog.addEventListener("click", (event) => {
    if (event.target.closest("a[href]")) deadlineDialog.close();
  });
  function deadlines(kind) {
    const events = calAll().filter((event) => event.kind === "report" && !event.done &&
      (kind === "overdue" ? event.date < TODAY() : event.date >= TODAY() && dd(event.date) <= 60));
    deadlineDialog.innerHTML = `<h2 id="lp-deadlines-title">${kind === "overdue" ? "Overdue reports" : "Reports due within 60 days"}</h2><p>${events.length} in the current portfolio selection. Completion/receipt has not been marked in the contract schedule. These dates may be outside the displayed month.</p><div class="lp-deadline-list">${events.map((event) => agItem(event, true)).join("") || "<p>No matching deadlines.</p>"}</div>`;
    deadlineDialog.append(button("Close deadlines", () => deadlineDialog.close()));
    deadlineDialog.showModal();
  }
  function calendar() {
    const nav = view.querySelector(".cal-nav"), rail = view.querySelector(".cal-rail");
    if (nav && !nav.querySelector(".lp-month-picker")) {
      const picker = added(element("label", "lp-month-picker", "Jump to month"));
      const input = element("input"); input.type = "month"; input.value = CAL.m;
      input.setAttribute("aria-label", "Jump to calendar month");
      input.addEventListener("change", () => {
        if (!/^\d{4}-\d{2}$/.test(input.value)) return;
        CAL.m = input.value; CAL.sel = ""; render();
      });
      picker.append(input); nav.append(picker);
    }
    if (rail && !rail.closest(".lp-month-browser")) {
      const browser = element("details", "lp-month-browser");
      const summary = added(element("summary", "", "Browse all months and event counts"));
      rail.before(browser); browser.append(summary, rail);
      browser.addEventListener("toggle", () => {
        if (browser.open) rail.querySelector(".on")?.scrollIntoView({ block: "nearest", inline: "center" });
      });
    }
    const exportButton = view.querySelector('[data-act="calics"]');
    if (exportButton && !view.querySelector(".lp-calendar-export-note")) {
      const note = added(element("small", "lp-calendar-export-note", `ICS export uses the original list range: ${CAL.range === "all" ? "all dates" : `next ${CAL.range} days`}${CAL.past ? ", including past dates" : ", plus open overdue report deadlines"}. It does not export only the displayed month.`));
      view.querySelector(".ptool")?.after(note);
    }
    for (const bar of view.querySelectorAll(".alert-bar")) {
      if (bar.querySelector(".lp-deadline-action")) continue;
      const kind = bar.classList.contains("bad") ? "overdue" : "soon";
      const action = added(button(kind === "overdue" ? "Review overdue reports" : "Review upcoming reports", () => deadlines(kind)));
      action.classList.add("lp-deadline-action");
      const context = added(element("small", "lp-alert-context", "Across the current selection · not limited to the displayed month"));
      bar.append(action, context); bar.setAttribute("role", "note");
    }
    for (const cell of view.querySelectorAll('.cal-cell[data-act="calday"]')) {
      if (cell.dataset.lpDayKeyboard) continue;
      cell.dataset.lpDayKeyboard = "on";
      cell.addEventListener("keydown", (event) => {
        if (event.target === cell && ["Enter", " "].includes(event.key)) {
          event.preventDefault(); cell.click();
        }
      });
    }
  }
  function data() {
    const grid = view.querySelector(":scope > .grid");
    if (!grid) return;
    if (grid.classList.contains("lp-data-groups")) {
      if (PREV) grid.querySelector('[data-lp-data-group="records"]').open = true;
      return;
    }
    grid.classList.add("lp-data-groups");
    const groups = [
      ["reports", "Financial reports", "Upload approved budgets and project reports", ["Financial report inbox"]],
      ["records", "Bulk records and templates", "Review Excel/CSV rows before importing", ["Import from Excel or CSV"]],
      ["backups", "Backups and transfer", "Export or restore portfolio records", ["Back up and restore"]],
      ["countries", "Country register", "Maintain countries before adding projects", ["Countries"]],
      ["history", "History and recovery", "Review changes and recover deleted projects", ["Recycle bin", "Change log"]],
      ["reset", "Replace data with demo portfolio", "Destructive action · open only when needed", ["Start over"]],
    ];
    for (const [key, title, note, titles] of groups) {
      const cards = titles.map(headingCard).filter(Boolean);
      if (!cards.length) continue;
      const group = element("details", `lp-data-section${key === "reset" ? " lp-danger-section" : ""}`);
      group.dataset.lpDataGroup = key;
      const summary = added(element("summary"));
      summary.append(element("strong", "", title), element("span", "", note));
      group.append(summary, ...cards); grid.append(group);
      group.open = !!preferences.data?.[key] || (key === "records" && !!PREV);
      group.addEventListener("toggle", () => {
        preferences = { ...preferences, data: { ...preferences.data, [key]: group.open } };
        ls.set(preferenceKey, preferences);
      });
    }
  }
  function brief() {
    const brief = view.querySelector(".brief");
    if (!brief || brief.querySelector(".lp-brief-evidence")) return;
    const R = rows(), quality = dq(R).filter((check) => check.items.length);
    const indicators = R.flatMap((row) => row.p.doa?.inds || []);
    const measured = indicators.filter((indicator) => String(indicator.current ?? "").trim() !== "");
    const actions = todayActions(R);
    const sourceRows = R.map((row) => {
      const report = reps(row.p).at(-1), budget = effB(row.p, report?.date);
      return `<tr><td><a href="${PL(row.p, "finance/reports")}">${h(row.p.code)}</a><br>${h(row.p.name)}</td><td>${report ? `${h(report.name)}<br><small>${h(report.date)} · ${h(report.fileName || "File not recorded")}</small>` : "No report registered"}</td><td>${budget ? `${h(budget.name)}<br><small>${h(budget.date)}${report && budget.date > report.date ? " · Dated after report; original engine fallback needs source review" : ""}</small>` : "No budget version registered"}</td><td>${h(BL[row.basis] || "No supported method")}</td></tr>`;
    }).join("");
    const teams = R.flatMap((row) => (row.p.people || []).map((person) => ({ person, p: row.p })));
    const panel = added(element("section", "lp-brief-evidence grid sec"));
    panel.innerHTML = `${card("Evidence and briefing scope", "Generation date is not the source date", `<div class="lp-evidence-counts"><span>${R.filter((row) => reps(row.p).length).length}/${R.length} projects with financial reports</span><span>${R.filter((row) => row.p.doa).length}/${R.length} with action plans</span><span>${measured.length}/${indicators.length} indicators with current values</span></div><p class="note">Country: ${h(F.c === "all" ? "All countries" : cname(F.c))} · Sector: ${h(F.s)} · Signal: ${h(F.g === "all" ? "All signals" : SG[F.g]?.[0] || F.g)} · Search: ${h(F.q || "All projects")}<br>Scenario ${F.k > 0 ? "+" : ""}${h(F.k)}% · Requested forecast: ${h(F.fm || "auto")} · Project date filter: ${h(F.ds || "Unrestricted")} to ${h(F.de || "Unrestricted")} (project dates, not report dates).</p><div class="tw"><table class="lp-evidence-table"><thead><tr><th>Project</th><th>Latest financial report</th><th>Effective approved budget</th><th>Forecast basis used</th></tr></thead><tbody>${sourceRows}</tbody></table></div>`, "wide")}${card("Recorded updates and quality findings", "Original action rules; affected projects remain accessible", `<p class="note">The original management section shows up to 10 non-neutral actions and 5 top risks. This appendix exposes every current action, including status updates.</p><details class="lp-brief-details"><summary>All ${actions.length} current management/update points</summary>${actionList(actions)}</details>${quality.length ? `<details class="lp-brief-details"><summary>${quality.length} data-quality checks with affected records</summary>${quality.map((check) => `<h3>${h(check.label)}</h3><ul>${check.items.map((item) => `<li><a href="${PL(item.r.p, check.tab)}">${h(item.r.p.code)}</a>: ${h(item.t)}</li>`).join("")}</ul>`).join("")}</details>` : "<p>No outstanding quality findings in the original checks.</p>"}`, "wide")}${card("Named team and risk responsibilities", "Recorded names; budget-line assignments are not inferred", `<details class="lp-brief-details"><summary>${teams.length} recorded team assignments</summary>${teams.length ? `<ul>${teams.map(({person, p}) => `<li><a href="${PL(p, "risks/people")}">${h(p.code)}</a> · <b>${h(person.name)}</b> · ${h(person.role || "Role not recorded")} · Contract until ${h(person.until || "Not recorded")}</li>`).join("")}</ul>` : "<p>No named team records available.</p>"}</details><details class="lp-brief-details"><summary>Recorded open risk owners and mitigation</summary><ul>${R.flatMap((row) => (row.p.riskRegister || []).filter((risk) => risk.status !== "Closed").map((risk) => `<li><a href="${PL(row.p, "risks/risks")}">${h(row.p.code)}</a> · ${h(risk.title)}<br>Owner: ${h(risk.owner || "Not recorded")} · Mitigation: ${h(risk.mitigation || "Not recorded")}</li>`)).join("") || "<li>No open risks recorded.</li>"}</ul></details>`, "wide")}`;
    brief.append(panel);
  }
  function logframe() {
    const card = headingCard("Logframe indicators"), p = currentProject();
    const table = card?.querySelector("table");
    if (!table || !p?.doa || table.dataset.lpLogframe) return;
    table.dataset.lpLogframe = "on"; table.classList.add("lp-logframe-table");
    table.closest(".tw").classList.add("lp-logframe-viewport");
    const state = indicatorQueries.get(p.id) || { query: "", mode: "all", collapsed: new Set() };
    indicatorQueries.delete(p.id); indicatorQueries.set(p.id, state);
    if (indicatorQueries.size > 32) indicatorQueries.delete(indicatorQueries.keys().next().value);
    const tools = added(element("div", "lp-indicator-tools"));
    const search = element("input"); search.type = "search"; search.value = state.query;
    search.placeholder = "Find indicator or result"; search.setAttribute("aria-label", "Find logframe indicator or result");
    const mode = element("select"); mode.setAttribute("aria-label", "Indicator value coverage");
    mode.innerHTML = '<option value="all">All indicators</option><option value="blank">Blank current values</option><option value="measured">With current values</option>';
    mode.value = state.mode;
    const count = element("output"); count.setAttribute("aria-live", "polite");
    const groups = []; let group;
    for (const row of table.tBodies[0].rows) {
      const input = row.querySelector("[data-ind]");
      if (!input) {
        group = { header: row, rows: [], index: groups.length }; groups.push(group);
      } else {
        const id = input.dataset.ind.split("|")[1], indicator = p.doa.inds.find((item) => item.id === id);
        if (!group) { group = { header: null, rows: [], index: 0 }; groups.push(group); }
        group.rows.push({ row, input, indicator });
        const detail = added(element("details", "lp-indicator-detail"));
        detail.append(element("summary", "", "Source and full result"));
        const text = element("div"); text.textContent = `Result: ${indicator?.result || "Not recorded"}\nSource: ${indicator?.sources || "Not recorded"}\nAssumptions: ${indicator?.assumptions || "Not recorded"}\nAs of: ${indicator?.asOf || "Not recorded"}`;
        detail.append(text); row.cells[0].append(detail);
        input.setAttribute("aria-label", `Current value: ${indicator?.text || input.dataset.ind}`);
      }
    }
    function filter() {
      state.query = search.value; state.mode = mode.value;
      let visible = 0, matched = 0;
      groups.forEach((group) => {
        let groupMatches = 0;
        for (const item of group.rows) {
          const value = String(item.input.value ?? "").trim();
          const matching = `${item.indicator?.text || item.row.cells[0].textContent} ${item.indicator?.result || ""}`.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase()) && (state.mode === "all" || (state.mode === "blank" ? value === "" : value !== ""));
          item.row.hidden = !matching || state.collapsed.has(group.index);
          item.row.classList.toggle("lp-indicator-hidden", item.row.hidden);
          if (matching) { groupMatches++; matched++; }
          if (!item.row.hidden) visible++;
        }
        if (group.header) {
          group.header.hidden = groupMatches === 0;
          group.header.classList.toggle("lp-indicator-hidden", group.header.hidden);
          const toggle = group.header.querySelector("button");
          toggle?.setAttribute("aria-expanded", String(!state.collapsed.has(group.index)));
        }
      });
      count.textContent = `${visible} visible · ${matched} matching · ${p.doa.inds.length} total. KPIs and Excel include all indicators. Scroll sideways for baseline, target, current value and progress.`;
    }
    for (const group of groups) {
      if (!group.header) continue;
      const toggle = added(button("Collapse / expand result", () => {
        state.collapsed.has(group.index) ? state.collapsed.delete(group.index) : state.collapsed.add(group.index);
        filter();
      }));
      toggle.classList.add("lp-result-toggle"); group.header.cells[0].append(toggle);
    }
    search.addEventListener("input", filter); mode.addEventListener("change", filter);
    tools.append(search, mode, button("Expand all results", () => { state.collapsed.clear(); filter(); }), count);
    table.closest(".tw").before(tools); filter();
  }
  function budgetReport() {
    const card = headingCard("Budget lines at the latest report"), p = currentProject();
    const table = card?.querySelector("table");
    if (!table || !p || table.dataset.lpReportDetails) return;
    table.dataset.lpReportDetails = "on"; table.classList.add("lp-report-details-table");
    table.closest(".tw").classList.add("lp-report-details-viewport");
    const projection = LedgerReportDetails.project(p);
    const columns = [
      ["approvedUnit", "Approved unit"], ["approvedUnits", "Approved units"], ["unitRate", "Approved unit cost"],
      ["actualUnit", "Spent unit"], ["actualUnits", "Spent units"], ["actualUnitCost", "Spent unit cost"], ["remainingUnits", "Remaining units"], ["staffNames", "Staff names (source)"],
    ];
    const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function measureCell(field, key) {
      const cell = added(element("td", `lp-unit-detail lp-unit-${key}`));
      if (!field || field.value === null) {
        cell.textContent = "—"; cell.title = field?.label || "Not applicable; unit values are not aggregated";
      } else {
        cell.textContent = Array.isArray(field.value) ? field.value.join("; ") : key === "unitRate" || key === "actualUnitCost" ? money.format(field.value) : typeof field.value === "number" ? field.value.toLocaleString("en-GB", { maximumFractionDigits: 6 }) : String(field.value);
        if (field.state === "derived") cell.append(element("small", "lp-derived", "Derived"));
        cell.title = `${field.label}\n${field.provenance.map((source) => `${source.reportName || ""} ${source.reportDate || ""} · ${source.fileName || ""}${source.sheet ? ` / ${source.sheet} row ${source.row} ${source.column}` : ""}`).join("\n")}`;
      }
      return cell;
    }
    const head = table.tHead.rows[0], anchor = head.cells[1];
    for (const [, title] of columns) { const cell = added(element("th", "ns lp-unit-detail", title)); head.insertBefore(cell, anchor); }
    [...table.tBodies[0].rows].forEach((row, index) => {
      const fields = projection.lines[index]?.fields;
      const anchor = row.cells[1];
      for (const [key] of columns) row.insertBefore(measureCell(fields?.[key], key), anchor);
    });
    const controls = added(element("div", "lp-report-controls"));
    const mode = button("Financial overview", () => {
      const compact = table.classList.toggle("lp-report-compact");
      mode.textContent = compact ? "Full source details" : "Financial overview";
      mode.setAttribute("aria-pressed", String(compact));
    });
    mode.setAttribute("aria-pressed", "false");
    const restore = button("Read details from stored originals", async () => {
      restore.disabled = true;
      try {
        const sourceState = S, sourceFingerprint = JSON.stringify(p);
        const sourceReports = RP(p).map((report) => ({ report, snapshot: report.snapshot }));
        const result = await LedgerReportDetails.hydrate(p, { force: true });
        const current = S.projects.find((project) => project.id === p.id);
        if (S !== sourceState || current !== p || JSON.stringify(p) !== sourceFingerprint ||
            sourceReports.some(({ report, snapshot }) => !RP(p).includes(report) || report.snapshot !== snapshot)) {
          const message = "Project or source changed during the read. No details were applied; retry with the current originals.";
          status.textContent = message; toast(message);
          return;
        }
        const updates = result.updates.filter((update) => ["recognized", "partial"].includes(update.details.status) && RP(current || {}).some((report) => report.id === update.reportId));
        if (!current || !updates.length) {
          status.textContent = "No readable linked original supplied extra fields. Upload the original report or approved budget again; unavailable fields remain —.";
          return;
        }
        commit(`Read source unit details for ${current.name}`);
        for (const update of updates) RP(current).find((report) => report.id === update.reportId).snapshot.ledgerDetails = update.details;
        save(); render(); toast("Source details refreshed. Original financial amounts remain unchanged.");
      } catch (error) { status.textContent = error.message; }
      finally { restore.disabled = false; }
    });
    const status = element("output", "lp-report-source-status"); status.setAttribute("aria-live", "polite");
    status.textContent = `Report: ${projection.report?.name || "Not registered"} (${projection.report?.date || "date unavailable"}) · Budget selected by original engine: ${projection.budget?.name || "Not registered"} (${projection.budget?.date || "date unavailable"}).${projection.budgetAfterReport ? " Budget is dated after this report; derived unit balances are unavailable pending source review." : ""}`;
    const note = element("p", "note", "Full source details: scroll sideways for all financial columns. — means the source does not establish a value. Spent units never use approved quantities as a fallback. Derived costs use actual expenditure ÷ explicit spent units. Remaining units require compatible unit types. Unit quantities/rates are not totalled across lines.");
    controls.append(mode, restore, status, note); table.closest(".tw").before(controls);
    const team = added(element("details", "lp-report-team"));
    team.append(element("summary", "", `${(p.people || []).length} recorded project team members · separate from budget-line assignments`));
    const list = element("ul");
    for (const person of p.people || []) list.append(element("li", "", `${person.name} · ${person.role || "Role not recorded"} · ${person.base || "Base not recorded"}${person.until ? ` · Until ${person.until}` : ""}`));
    if (!list.childElementCount) list.append(element("li", "", "No named project team records. Names explicitly read from a report appear in the source column; line assignments are not inferred."));
    team.append(list); card.append(team);
  }
  function augment() {
    const route = (location.hash || "#/home").split("/")[1];
    if (route === "calendar") calendar();
    if (route === "data") data();
    if (route === "brief") brief();
    if (route === "project") { logframe(); budgetReport(); }
  }
  return Object.freeze({ augment });
})();
