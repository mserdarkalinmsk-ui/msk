/* People intelligence: document assignments, evidence coverage and review context. */
function createStaffStudio(api) {
  "use strict";
  const h = api.h,
    KEY = "ledger.staff.studio.v1";
  const defaults = {
    base: "all",
    coverage: "all",
    project: "all",
    country: "all",
    view: innerWidth < 680 ? "cards" : "table",
    sort: "project",
    direction: 1,
    pageSize: 25,
  };
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch (_) {}
  const cfg = { ...defaults, ...saved };
  if (!["all", "Local", "HQ", "Unassigned"].includes(cfg.base))
    cfg.base = "all";
  if (
    ![
      "all",
      "missing",
      "end",
      "fte",
      "review",
      "verified",
      "complete",
    ].includes(cfg.coverage)
  )
    cfg.coverage = "all";
  if (!["table", "cards"].includes(cfg.view)) cfg.view = defaults.view;
  if (
    !["name", "project", "base", "end", "fte", "asOf", "coverage"].includes(
      cfg.sort,
    )
  )
    cfg.sort = defaults.sort;
  if (![10, 25, 50, 100].includes(Number(cfg.pageSize)))
    cfg.pageSize = defaults.pageSize;
  cfg.direction = cfg.direction === -1 ? -1 : 1;
  for (const key of ["project", "country"])
    if (typeof cfg[key] !== "string" || cfg[key].length > 160) cfg[key] = "all";
  const state = {
    query: "",
    page: 0,
    expanded: new Set(),
    rows: [],
    filtered: [],
    projects: [],
    focus: null,
    selection: null,
    scrollTop: null,
    tableScroll: 0,
    followup: "missing",
    printing: false,
  };
  const baseName = (value) =>
    value === "HQ" ? "SxB / HQ" : value || "Unassigned";
  const baseKey = (x) =>
    ["Local", "HQ"].includes(x.a.base) ? x.a.base : "Unassigned";
  const baseColor = (value) =>
    value === "Local"
      ? "var(--studio-spent,var(--good))"
      : value === "HQ"
        ? "var(--studio-budget,var(--brand))"
        : "var(--mute)";
  const num = (value) =>
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
      ? null
      : Number(value);
  const fteNumber = (value) =>
    value === null
      ? "—"
      : Number(value).toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const normal = (value) =>
    api.n2
      ? api.n2(String(value || ""))
      : String(value || "").toLocaleLowerCase();
  const link = (p) =>
    "#/project/" + encodeURIComponent(p.id) + "/finance/staff";
  const rowKey = (x) =>
    JSON.stringify([
      x.r.p.id,
      x.a.key || normal(x.a.name || x.name) + "|" + (x.a.code || ""),
    ]);
  const icon = (name) => (api.icon ? api.icon(name) : "");
  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
      ? value
      : null;
  const missingEnd = (x) => !x.a.end;
  const missingDetails = (x) => missingEnd(x) || x.fte === null;
  const followup = (x) => missingDetails(x) || !!x.a.review;
  const sourceRecords = (x) =>
    Array.isArray(x.a.contracts) ? x.a.contracts : [];
  const countryName = (r) => r.cn || api.cname(r.p.country);
  const report = (x) => x.a.latest?.report || {};
  const sourceName = (x) =>
    report(x).fileName || report(x).name || "Source not recorded";
  const sourceDate = (x) => validDate(x.a.asOf || report(x).date);
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch (_) {
      api.announce?.("Staff preferences could not be saved on this device");
    }
  }
  function rememberFocus() {
    const active = document.activeElement;
    if (active?.closest(".ps-studio")) {
      if (active.dataset.psField)
        state.focus = `[data-ps-field="${CSS.escape(active.dataset.psField)}"]`;
      else if (active.dataset.psAction)
        state.focus = `[data-ps-action="${CSS.escape(active.dataset.psAction)}"]${active.dataset.psValue ? `[data-ps-value="${CSS.escape(active.dataset.psValue)}"]` : ""}${active.dataset.psKey ? `[data-ps-key="${CSS.escape(active.dataset.psKey)}"]` : ""}`;
      if (active.type === "search")
        state.selection = [active.selectionStart, active.selectionEnd];
    }
    state.scrollTop = scrollY;
    state.tableScroll =
      document.querySelector(".ps-table-scroll")?.scrollLeft || 0;
  }
  function refresh(patch = {}, resetPage = true) {
    rememberFocus();
    Object.assign(cfg, patch);
    if (resetPage) state.page = 0;
    persist();
    api.render();
  }
  function coverageMatches(x) {
    return (
      cfg.coverage === "all" ||
      (cfg.coverage === "missing" && missingDetails(x)) ||
      (cfg.coverage === "end" && missingEnd(x)) ||
      (cfg.coverage === "fte" && x.fte === null) ||
      (cfg.coverage === "review" && !!x.a.review) ||
      (cfg.coverage === "verified" && !!x.a.override) ||
      (cfg.coverage === "complete" && !missingDetails(x))
    );
  }
  function value(x, key) {
    if (key === "name") return x.name;
    if (key === "project") return x.r.p.name;
    if (key === "base") return baseName(baseKey(x));
    if (key === "end") return validDate(x.a.end);
    if (key === "fte") return x.fte;
    if (key === "asOf") return sourceDate(x);
    return missingDetails(x) ? 0 : x.a.review ? 1 : 2;
  }
  function filtered(A) {
    const q = normal(state.query.trim());
    return A.filter(
      (x) =>
        (cfg.base === "all" || baseKey(x) === cfg.base) &&
        (cfg.project === "all" || x.r.p.id === cfg.project) &&
        (cfg.country === "all" || x.r.p.country === cfg.country) &&
        coverageMatches(x) &&
        (!q ||
          normal(
            [
              x.name,
              x.a.position,
              x.r.p.name,
              x.r.p.code,
              countryName(x.r),
              sourceName(x),
              x.a.code,
            ].join(" "),
          ).includes(q)),
    ).sort((a, b) => {
      const x = value(a, cfg.sort),
        y = value(b, cfg.sort);
      if (x === null || y === null)
        return x === y ? a.name.localeCompare(b.name) : x === null ? 1 : -1;
      return (
        cfg.direction *
          (typeof x === "number"
            ? x - y
            : String(x).localeCompare(String(y))) ||
        a.name.localeCompare(b.name) ||
        a.r.p.id.localeCompare(b.r.p.id)
      );
    });
  }
  function contractsButton(x, label) {
    const key = x.a.key || normal(x.a.name || x.name) + "|" + (x.a.code || "");
    return `<button type="button" class="btn ps-contract" data-act="staff-contract" data-id="${h(x.r.p.id)}|${h(encodeURIComponent(key))}">${h(label || (missingDetails(x) ? "Complete details" : "Contract details"))}</button>`;
  }
  function person(x) {
    return `<span class="ps-avatar" style="--ps-base:${baseColor(baseKey(x))}">${api.staffAvatar(x.name)}</span><span class="ps-person-copy"><a href="${link(x.r.p)}"><b>${h(x.name)}</b></a><small>${h(x.a.position || "Position not recorded")}</small>${x.a.review ? '<span class="ps-review-label">Source details need review</span>' : ""}</span>`;
  }
  function evidence(x) {
    const a = x.a,
      contracts = sourceRecords(x);
    return `<div class="ps-evidence"><div class="ps-evidence-header"><div><span class="ps-eyebrow">Assignment source trail</span><h4>${h(x.name)} · ${h(x.r.p.code)}</h4></div><a class="btn" href="${link(x.r.p)}">Open project staff ${icon("arrow")}</a></div><div class="ps-evidence-summary"><div><small>Classification basis</small><b>${h(a.baseSource || "Not recorded")}</b></div><div><small>Original names</small><b>${h((a.sourceNames || []).join(" · ") || a.name || x.name)}</b></div><div><small>Reporting lines</small><b>${h((a.codes || [a.code]).filter(Boolean).join(" · ") || "Not recorded")}</b></div></div>${a.identityReview ? '<p class="ps-evidence-warning">A likely spelling variant was grouped by the existing ledger. Review the original names; this does not establish a verified shared identity.</p>' : ""}${a.override ? `<div class="ps-supplement"><b>Verified supplement</b><p>${h(a.override.note || "No note recorded")} · ${h(a.override.updatedAt?.slice(0, 10) || "Date not recorded")}</p><p>Start ${h(a.override.start || "not recorded")} · End ${h(a.override.end || "not recorded")} · FTE ${num(a.override.fte) === null ? "not recorded" : fteNumber(num(a.override.fte))}</p></div>` : ""}<div class="ps-source-records">${
      contracts
        .slice()
        .sort((a, b) =>
          String(b.report?.date || "").localeCompare(
            String(a.report?.date || ""),
          ),
        )
        .map(
          (c) =>
            `<article><div><b>${h(c.report?.fileName || c.report?.name || "Report not recorded")}</b><span>${h(c.report?.date || "Date not recorded")}</span></div><p>${h(c.sourceSheet || "Sheet not recorded")} · row ${h(c.sourceRow ?? "—")} · ${h(c.code || a.code || "Line not recorded")}</p><p>${h(c.name || x.name)} · ${h(c.recordKind || "Contract record")}${c.po ? " · PO " + h(c.po) : ""}</p>${c.recordKind === "Payroll observation" ? `<p class="ps-payroll-note">${h(c.payrollPeriod || "Payroll period not recorded")} · ${num(c.units) === null ? "Units not recorded" : h(c.units) + " " + h(c.unit || "units")}. Payroll units do not establish contract dates or current FTE.</p>` : `<p>Start ${h(c.start || "not recorded")} · End ${h(c.end || "not recorded")} · Source FTE ${num(c.fte) === null ? "not recorded" : fteNumber(num(c.fte))}</p>`}</article>`,
        )
        .join("") ||
      "<p>No individual source records available. Open the project to review its reports.</p>"
    }</div></div>`;
  }
  function kpis(B, R) {
    const known = B.filter((x) => x.fte !== null),
      unique = new Set(B.map((x) => normal(x.name))).size,
      local = B.filter((x) => baseKey(x) === "Local").length,
      HQ = B.filter((x) => baseKey(x) === "HQ").length;
    const items = [
      [
        "Distinct source names",
        unique,
        "Names are not verified shared identities",
        "people",
      ],
      [
        "Project assignments",
        B.length,
        `${new Set(B.map((x) => x.r.p.id)).size} staffed / ${R.length} selected projects`,
        "project",
      ],
      [
        "Local / SxB · HQ",
        `${local} / ${HQ}`,
        `${B.length - local - HQ} unassigned base classifications`,
        "map",
      ],
      [
        "Known assignment FTE",
        known.length ? fteNumber(known.reduce((n, x) => n + x.fte, 0)) : "—",
        `${known.length} / ${B.length} assignments with known FTE`,
        "staff",
      ],
      [
        "Details to complete",
        B.filter(missingDetails).length,
        "Contract end or FTE not established",
        "alert",
      ],
    ];
    return `<div class="ps-kpis">${items.map(([label, v, note, i]) => `<article><span class="ps-kpi-icon">${icon(i)}</span><small>${h(label)}</small><strong>${h(v)}</strong><p>${h(note)}</p></article>`).join("")}</div>`;
  }
  function distribution(B) {
    const groups = ["Local", "HQ", "Unassigned"].map((base) => ({
        base,
        count: B.filter((x) => baseKey(x) === base).length,
      })),
      C = 2 * Math.PI * 54;
    let offset = 0;
    return `<article class="ps-panel ps-base-panel"><header><span class="ps-eyebrow">01 / Team composition</span><h2>Where the team is based</h2><p>Source classifications, by assignment.</p></header><div class="ps-base-chart"><svg viewBox="0 0 170 170" role="group" aria-label="Staff assignment distribution by base"><circle cx="85" cy="85" r="54" fill="none" stroke="var(--line)" stroke-width="15"/>${groups
      .filter((g) => g.count)
      .map((g) => {
        const arc = (g.count / B.length) * C,
          off = offset;
        offset += arc;
        return `<g role="button" tabindex="0" data-ps-action="base" data-ps-value="${g.base}" aria-label="Filter to ${baseName(g.base)}, ${g.count} assignments" aria-pressed="${cfg.base === g.base}"><title>${h(baseName(g.base))}: ${g.count} source assignments</title><circle cx="85" cy="85" r="54" fill="none" stroke="${baseColor(g.base)}" stroke-width="15" stroke-dasharray="${arc} ${C - arc}" stroke-dashoffset="${-off}" transform="rotate(-90 85 85)"/></g>`;
      })
      .join(
        "",
      )}<text x="85" y="82" text-anchor="middle" class="ps-ring-value">${B.length}</text><text x="85" y="103" text-anchor="middle" class="ps-ring-caption">assignments</text></svg><div class="ps-base-legend">${groups.map((g) => `<button type="button" data-ps-action="base" data-ps-value="${g.base}" aria-pressed="${cfg.base === g.base}"><i style="background:${baseColor(g.base)}"></i><span>${h(baseName(g.base))}</span><b>${g.count}</b><small>${B.length ? api.pc(g.count / B.length) : "—"}</small></button>`).join("")}</div></div><footer>Choose a segment or label to filter the whole people workspace.${cfg.base !== "all" ? '<button type="button" data-ps-action="clear-base">Show all bases</button>' : ""}</footer></article>`;
  }
  function projectMatrix(R, B, A) {
    const selected = R.filter(
      (r) =>
        (cfg.project === "all" || r.p.id === cfg.project) &&
        (cfg.country === "all" || r.p.country === cfg.country),
    );
    return `<article class="ps-panel ps-project-panel"><header><span class="ps-eyebrow">02 / Source coverage</span><h2>Staffing across projects</h2><p>Known FTE is partial when source coverage is incomplete.</p></header><div class="ps-matrix-scroll" tabindex="0" role="region" aria-label="Project staff and source coverage matrix"><table class="ps-matrix"><thead><tr><th>Project</th><th>Assignments</th><th>Known FTE</th><th>Source coverage</th><th>Review</th></tr></thead><tbody>${
      selected
        .map((r) => {
          const people = B.filter((x) => x.r.p.id === r.p.id),
            known = people.filter((x) => x.fte !== null),
            have = A.some((x) => x.r.p.id === r.p.id),
            incomplete = people.filter(followup).length,
            coverage = people.length ? known.length / people.length : null;
          return `<tr><td><button type="button" data-ps-action="project" data-ps-value="${h(r.p.id)}" aria-pressed="${cfg.project === r.p.id}" style="--ps-project:${api.entityColor("project", r.p.id)}"><i></i><span><b>${h(r.p.code)}</b><small>${h(countryName(r))}</small></span></button></td><td><b>${people.length}</b><small>${people.filter((x) => baseKey(x) === "Local").length} Local · ${people.filter((x) => baseKey(x) === "HQ").length} HQ</small></td><td><b>${known.length ? fteNumber(known.reduce((n, x) => n + x.fte, 0)) : "—"}</b><small>${known.length}/${people.length} assignments</small></td><td><span class="ps-coverage-track"><i style="width:${coverage === null ? 0 : coverage * 100}%"></i></span><small>${!have ? "No document roster" : !people.length ? "No filter matches" : known.length === people.length ? "FTE fully evidenced" : "FTE partially evidenced"}</small></td><td><a href="${link(r.p)}" class="ps-matrix-review${incomplete ? " attention" : ""}">${incomplete ? incomplete + " follow-up" + (incomplete === 1 ? "" : "s") : have ? "Open source" : "Add source"} ↗</a></td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="5">No projects match the selected staff filters.</td></tr>'
    }</tbody></table></div></article>`;
  }
  function queue(B) {
    const categories = [
        ["missing", "Missing details", B.filter(missingDetails)],
        ["review", "Source review", B.filter((x) => x.a.review)],
      ],
      active =
        categories.find(([key]) => key === state.followup) || categories[0],
      pending = active[2];
    return `<article class="ps-panel ps-queue-panel"><header><span class="ps-eyebrow">03 / Follow-up queue</span><h2>Complete the evidence</h2><p>Keep unknown values visible; add verified details at their source.</p></header><div class="ps-queue-tabs" role="group" aria-label="Staff follow-up categories">${categories.map(([key, label, people]) => `<button type="button" data-ps-action="queue" data-ps-value="${key}" aria-pressed="${state.followup === key}">${label}<b>${people.length}</b></button>`).join("")}</div><div class="ps-queue-items">${
      pending
        .slice(0, 5)
        .map(
          (x) =>
            `<article><span class="ps-avatar" style="--ps-base:${baseColor(baseKey(x))}">${api.staffAvatar(x.name)}</span><div><a href="${link(x.r.p)}"><b>${h(x.name)}</b></a><small>${h(x.r.p.code)} · ${h([missingEnd(x) ? "End date missing" : "", x.fte === null ? "FTE unknown" : "", x.a.review ? "Source review" : ""].filter(Boolean).join(" · "))}</small></div>${contractsButton(x, "Review")}</article>`,
        )
        .join("") ||
      '<p class="ps-queue-empty">No follow-ups in this category and selection. This does not establish complete delivery or employment information.</p>'
    }</div>${pending.length ? `<button type="button" class="ps-view-all" data-ps-action="coverage" data-ps-value="${active[0]}">View ${pending.length} assignment${pending.length === 1 ? "" : "s"} in the register ${icon("arrow")}</button>` : ""}${pending.length > 5 ? `<p class="ps-note">Showing 5 of ${pending.length} follow-ups.</p>` : ""}</article>`;
  }
  const columns = [
    ["name", "Person / position"],
    ["project", "Project / country"],
    ["base", "Staff base"],
    ["end", "Contract end"],
    ["fte", "Known FTE"],
    ["asOf", "Source / as of"],
  ];
  function cell(x, key) {
    if (key === "name") return `<div class="ps-person">${person(x)}</div>`;
    if (key === "project")
      return `<a href="${link(x.r.p)}" class="ps-project-link"><b>${h(x.r.p.code)}</b><small>${h(countryName(x.r))}</small></a>`;
    if (key === "base")
      return `<span class="ps-base-badge" style="--ps-base:${baseColor(baseKey(x))}">${h(baseName(baseKey(x)))}</span>`;
    if (key === "end")
      return x.a.end
        ? `<b>${h(x.a.end)}</b>${x.a.override?.end ? '<small class="ps-verified">Verified supplement</small>' : ""}`
        : '<span class="ps-unknown">Not in source</span>';
    if (key === "fte")
      return `<b class="${x.fte === null ? "ps-unknown" : ""}">${fteNumber(x.fte)}</b>${x.a.override?.fte != null ? '<small class="ps-verified">Verified supplement</small>' : ""}`;
    return `<span class="ps-source-file" title="${h(sourceName(x))}">${h(sourceName(x))}</span><small>${h(sourceDate(x) || "Date not recorded")} · ${sourceRecords(x).length} source records</small>`;
  }
  function table(B, printable = false) {
    const display = printable
        ? B
        : B.slice(state.page * cfg.pageSize, (state.page + 1) * cfg.pageSize),
      known = B.filter((x) => x.fte !== null);
    return `<table class="ps-table${printable ? " ps-print-table" : ""}"><caption class="sr-only">Source-backed project staff assignments. Unknown FTE is not estimated.</caption><thead><tr>${columns.map(([key, label]) => `<th scope="col"${cfg.sort === key ? ` aria-sort="${cfg.direction === 1 ? "ascending" : "descending"}"` : ""}>${printable ? h(label) : `<button type="button" data-ps-action="sort" data-ps-value="${key}">${h(label)}<span aria-hidden="true">${cfg.sort === key ? (cfg.direction === 1 ? "↑" : "↓") : "↕"}</span></button>`}</th>`).join("")}<th scope="col">${printable ? "Evidence" : "Review"}</th></tr></thead><tbody>${display.map((x) => `<tr data-ps-row="${h(rowKey(x))}">${columns.map(([key]) => `<td>${cell(x, key)}</td>`).join("")}<td>${printable ? `${sourceRecords(x).length} source records${x.a.review ? " · review needed" : ""}${x.a.override ? " · verified supplement" : ""}` : `<div class="ps-row-actions"><button type="button" class="btn" data-ps-action="evidence" data-ps-key="${h(rowKey(x))}" aria-expanded="${state.expanded.has(rowKey(x))}" aria-label="${state.expanded.has(rowKey(x)) ? "Hide" : "Show"} source evidence for ${h(x.name)}">${state.expanded.has(rowKey(x)) ? "Hide source" : "Source"}</button>${contractsButton(x)}</div>`}</td></tr>${!printable && state.expanded.has(rowKey(x)) ? `<tr class="ps-detail-row"><td colspan="7">${evidence(x)}</td></tr>` : ""}`).join("") || `<tr><td colspan="7" class="ps-no-results">No assignments match these filters.</td></tr>`}</tbody><tfoot><tr><td colspan="4"><b>All ${B.length} filtered assignments</b><small>Includes ${known.length} with known FTE; sums exclude unknown FTE.</small></td><td><b>${known.length ? fteNumber(known.reduce((n, x) => n + x.fte, 0)) : "—"}</b></td><td colspan="2">${new Set(B.map((x) => normal(x.name))).size} distinct source names</td></tr></tfoot></table>`;
  }
  function cards(B) {
    return `<div class="ps-person-grid">${
      B.slice(state.page * cfg.pageSize, (state.page + 1) * cfg.pageSize)
        .map(
          (x) =>
            `<article class="ps-person-card" data-ps-row="${h(rowKey(x))}" style="--ps-base:${baseColor(baseKey(x))}"><header><span class="ps-avatar">${api.staffAvatar(x.name)}</span><span class="ps-base-badge">${h(baseName(baseKey(x)))}</span></header><h3><a href="${link(x.r.p)}">${h(x.name)}</a></h3><p>${h(x.a.position || "Position not recorded")}</p><a class="ps-person-project" href="${link(x.r.p)}">${h(x.r.p.code)} · ${h(countryName(x.r))}</a><div class="ps-card-facts"><div><small>Contract end</small><b class="${missingEnd(x) ? "ps-unknown" : ""}">${h(x.a.end || "Not in source")}</b></div><div><small>Known FTE</small><b class="${x.fte === null ? "ps-unknown" : ""}">${fteNumber(x.fte)}</b></div></div>${x.a.review ? '<p class="ps-review-label">Source details need review</p>' : ""}${x.a.override ? '<p class="ps-verified">Verified supplement present</p>' : ""}<div class="ps-card-source"><span>${h(sourceName(x))}</span><small>${h(sourceDate(x) || "Date not recorded")} · ${sourceRecords(x).length} records</small></div><footer><button type="button" class="btn" data-ps-action="evidence" data-ps-key="${h(rowKey(x))}" aria-expanded="${state.expanded.has(rowKey(x))}">${state.expanded.has(rowKey(x)) ? "Hide source" : "Source evidence"}</button>${contractsButton(x)}</footer>${state.expanded.has(rowKey(x)) ? evidence(x) : ""}</article>`,
        )
        .join("") ||
      '<div class="ps-no-results">No assignments match these filters.</div>'
    }</div>`;
  }
  function registry(R, B, A) {
    const countries = [
        ...new Map(R.map((r) => [r.p.country, countryName(r)])).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1])),
      select = (field, options) =>
        `<select data-ps-field="${field}">${options.map(([v, label]) => `<option value="${h(v)}"${cfg[field] === v ? " selected" : ""}>${h(label)}</option>`).join("")}</select>`,
      pages = Math.max(1, Math.ceil(B.length / cfg.pageSize));
    state.page = Math.min(state.page, pages - 1);
    return `<section class="ps-panel ps-register"><header><div><span class="ps-eyebrow">04 / Assignment register</span><h2>Every assignment, with its source</h2><p>Search and sort across projects. Open a row to inspect the evidence.</p></div><div class="ps-register-tools"><div class="ps-view-switch" role="group" aria-label="Staff assignment presentation">${["table", "cards"].map((view) => `<button type="button" data-ps-action="view" data-ps-value="${view}" aria-pressed="${cfg.view === view}">${view === "table" ? "Table" : "Cards"}</button>`).join("")}</div><button type="button" class="btn" data-ps-action="export">${icon("download")}Export CSV</button><button type="button" class="btn" data-ps-action="print">${icon("print")}Print / PDF</button></div></header><div class="ps-filters"><label class="ps-search"><span>Search names, roles or sources</span><input type="search" id="ps-query" data-ps-field="query" value="${h(state.query)}" placeholder="Person, position, project or source file" autocomplete="off"></label><label><span>Staff base</span>${select(
      "base",
      [
        ["all", "All bases"],
        ["Local", "Local"],
        ["HQ", "SxB / HQ"],
        ["Unassigned", "Unassigned"],
      ],
    )}</label><label><span>Evidence</span>${select("coverage", [
      ["all", "All source records"],
      ["missing", "Missing end or FTE"],
      ["end", "End date missing"],
      ["fte", "FTE unknown"],
      ["review", "Source review"],
      ["verified", "Verified supplements"],
      ["complete", "End & FTE recorded"],
    ])}</label><label><span>Project</span>${select("project", [["all", "All projects"], ...R.map((r) => [r.p.id, r.p.code || r.p.name])])}</label><label><span>Country</span>${select("country", [["all", "All countries"], ...countries])}</label></div><div class="ps-register-status"><span><b>${B.length}</b> of ${A.length} source-backed assignments · unknown values sort last</span><div><label class="ps-sort-select"><span>Sort</span>${select(
      "sort",
      columns.map(([key, label]) => [key, label]),
    )}</label><button type="button" class="ps-direction" data-ps-action="direction" aria-label="Reverse staff sort direction">${cfg.direction === 1 ? "↑ Ascending" : "↓ Descending"}</button>${state.query || cfg.base !== "all" || cfg.coverage !== "all" || cfg.project !== "all" || cfg.country !== "all" ? '<button type="button" data-ps-action="reset-filters" class="ps-clear">Clear filters</button>' : ""}</div></div><div class="ps-register-content">${cfg.view === "table" ? `<div class="ps-table-scroll" tabindex="0" role="region" aria-label="Staff assignment table">${table(B)}</div>` : cards(B)}</div><div class="ps-pagination"><span>${B.length ? state.page * cfg.pageSize + 1 + "–" + Math.min((state.page + 1) * cfg.pageSize, B.length) : "0"} of ${B.length} assignments</span><label>Rows<select data-ps-field="pageSize">${[10, 25, 50, 100].map((n) => `<option value="${n}"${cfg.pageSize === n ? " selected" : ""}>${n}</option>`).join("")}</select></label><div><button type="button" class="btn" data-ps-action="previous"${state.page === 0 ? " disabled" : ""}>Previous</button><span>${state.page + 1} / ${pages}</span><button type="button" class="btn" data-ps-action="next"${state.page >= pages - 1 ? " disabled" : ""}>Next</button></div></div><p class="ps-register-method">One assignment per source name and project. The same name across projects is counted once in the name summary; this is not a verified shared identity. Known FTE is the sum of evidenced assignment FTE, not total headcount. Payroll units do not establish contract dates or current FTE.</p></section>`;
  }
  function manualRecords(R) {
    const manual = R.flatMap((r) => (r.p.people || []).map((x) => ({ r, x }))),
      noSource = R.filter((r) => !(api.staffRoster(r.p) || []).length);
    return `<details class="ps-panel ps-manual"><summary><span>Source coverage & separate manual records</span><b>${manual.length} manual · ${noSource.length} projects without document staff</b></summary><p>Manual records are preserved separately and excluded from the document roster, FTE totals and charts above.</p>${manual.length ? `<div class="ps-table-scroll"><table class="ps-manual-table"><thead><tr><th>Project</th><th>Person</th><th>Position</th><th>Origin</th></tr></thead><tbody>${manual.map(({ r, x }) => `<tr><td><a href="#/project/${encodeURIComponent(r.p.id)}/risks/people">${h(r.p.code)}</a></td><td>${h(x.name || "Name not recorded")}</td><td>${h(x.role || "Not recorded")}</td><td>Manual · not report verified</td></tr>`).join("")}</tbody></table></div>` : ""}${noSource.length ? `<div class="ps-no-source-projects">${noSource.map((r) => `<a href="#/project/${encodeURIComponent(r.p.id)}/finance/reports">${h(r.p.code)} · ${h(r.p.name)}<span>Review project reports ↗</span></a>`).join("")}</div>` : ""}</details>`;
  }
  function page(R) {
    const A = api
        .portfolioDocumentTeam(R)
        .map((x) => ({ ...x, fte: num(x.fte) })),
      B = filtered(A),
      known = B.filter((x) => x.fte !== null);
    state.rows = A;
    state.filtered = B;
    state.projects = R;
    const dates = B.map(sourceDate).filter(Boolean).sort();
    return {
      t: "Staff across projects",
      s: "People intelligence · document-led assignments and source coverage",
      html: `<div class="ps-studio"><section class="ps-hero"><div><span class="ps-eyebrow">People intelligence / Portfolio Ledger</span><h2>The team behind the portfolio.</h2><p>Understand project staffing, see what is evidenced, and complete the details that matter.</p></div><div class="ps-hero-context"><span>${icon("staff")}Document-led roster</span><b>${B.length} / ${A.length} assignments in view</b><small>${dates.length ? "Source dates " + h(dates[0]) + " — " + h(dates.at(-1)) : "No dated staff sources in this selection"}</small></div></section>${kpis(B, R)}<div class="ps-intelligence-grid">${distribution(B)}${projectMatrix(R, B, A)}${queue(B)}</div>${registry(R, B, A)}${manualRecords(R)}<div class="ps-print-only"><h2>Staff across projects</h2><p>Source-backed assignment register · generated ${h(new Date().toLocaleDateString("en-GB"))} · ${B.length} filtered assignments · ${known.length}/${B.length} with known FTE</p>${table(B, true)}<p>Distinct names are not verified shared identities. Unknown FTE is not estimated; manual records are excluded. Contract end dates do not establish employment departure.</p></div></div>`,
    };
  }
  function csvCell(value) {
    const safe =
      typeof value === "string" && /^[\s]*[=+@-]/.test(value)
        ? "'" + value
        : (value ?? "");
    return '"' + String(safe).replace(/"/g, '""') + '"';
  }
  function exportCSV() {
    const headings = [
      "Person",
      "Position",
      "Project code",
      "Project",
      "Country",
      "Staff base",
      "Contract end",
      "Known assignment FTE",
      "Source file",
      "Source date",
      "Source records",
      "Needs source review",
      "Verified supplement",
    ];
    const data = state.filtered.map((x) => [
      x.name,
      x.a.position || "",
      x.r.p.code,
      x.r.p.name,
      countryName(x.r),
      baseName(baseKey(x)),
      x.a.end || "",
      x.fte,
      sourceName(x),
      sourceDate(x) || "",
      sourceRecords(x).length,
      x.a.review ? "Yes" : "No",
      x.a.override ? "Yes" : "No",
    ]);
    api.download(
      "Portfolio_staff_" + new Date().toISOString().slice(0, 10) + ".csv",
      "\ufeff" +
        [headings, ...data]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
    api.announce?.(
      `Exported ${state.filtered.length} filtered staff assignments with source references`,
    );
  }
  function handleClick(button) {
    if (!button?.dataset.psAction) return false;
    const action = button.dataset.psAction,
      v = button.dataset.psValue;
    if (action === "base") refresh({ base: cfg.base === v ? "all" : v });
    else if (action === "clear-base") refresh({ base: "all" });
    else if (action === "project")
      refresh({ project: cfg.project === v ? "all" : v });
    else if (action === "coverage") {
      refresh({ coverage: v });
      document
        .querySelector(".ps-register")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    } else if (action === "queue") {
      rememberFocus();
      state.followup = v;
      api.render();
    } else if (action === "view") refresh({ view: v }, false);
    else if (action === "sort")
      refresh({ sort: v, direction: cfg.sort === v ? -cfg.direction : 1 });
    else if (action === "direction") refresh({ direction: -cfg.direction });
    else if (action === "reset-filters") {
      state.query = "";
      refresh({ base: "all", coverage: "all", project: "all", country: "all" });
    } else if (action === "evidence") {
      rememberFocus();
      const key = button.dataset.psKey;
      state.expanded.has(key)
        ? state.expanded.delete(key)
        : state.expanded.add(key);
      api.render();
    } else if (action === "previous" || action === "next") {
      rememberFocus();
      state.page = Math.max(0, state.page + (action === "next" ? 1 : -1));
      api.render();
    } else if (action === "export") exportCSV();
    else if (action === "print") {
      window.print();
    } else return false;
    return true;
  }
  function handleChange(el) {
    const key = el?.dataset.psField;
    if (!key) return false;
    if (key === "query") return true;
    if (["base", "coverage", "project", "country", "sort"].includes(key))
      refresh({ [key]: el.value });
    else if (key === "pageSize") refresh({ pageSize: Number(el.value) });
    else return false;
    return true;
  }
  function handleInput(el) {
    if (el?.dataset.psField !== "query") return false;
    rememberFocus();
    state.query = el.value;
    state.page = 0;
    api.render();
    return true;
  }
  function afterRender(view) {
    const root = view.querySelector(".ps-studio");
    if (!root) return;
    root.querySelectorAll("svg [data-ps-action][tabindex]").forEach((el) =>
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick(el);
        }
      }),
    );
    const scroller = root.querySelector(".ps-table-scroll");
    if (scroller) scroller.scrollLeft = state.tableScroll;
    if (state.focus) {
      const target = root.querySelector(state.focus);
      if (target) {
        target.focus({ preventScroll: true });
        if (target.type === "search" && state.selection)
          try {
            target.setSelectionRange(...state.selection);
          } catch (_) {}
      } else root.querySelector("#ps-query")?.focus({ preventScroll: true });
      state.focus = null;
      state.selection = null;
    }
    if (state.scrollTop !== null) {
      scrollTo(0, state.scrollTop);
      state.scrollTop = null;
    }
  }
  return { page, handleClick, handleChange, handleInput, afterRender };
}
