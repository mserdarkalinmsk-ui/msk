/* Six task-oriented workspaces, connected through one host and selection. */
const Atelier = (() => {
  "use strict";
  const view = $("#view"),
    legacy = { ...V };
  const domain = createLedgerDomain({
    model,
    financialSummary,
    delivery,
    reports: reps,
    actions: todayActions,
    quality: dq,
    projectLink: PL,
    reviews: () => S.reviewWork || {},
    revision: () => [saveRevision, F.k, F.fm, TODAY()].join("|"),
  });
  const prefs = createLedgerPreferences(ls, () =>
    toast("Preferences could not be saved in this browser."),
  );
  const ui = {
    arranging: false,
    projectsPage: 0,
    queueCategory: "all",
    queueStatus: "active",
    queueQuery: "",
    queuePage: 0,
    sourcesQuery: "",
    sourcesPage: 0,
    comparisonPage: 0,
    agenda: "upcoming",
    agendaKind: "all",
    agendaPage: 0,
    peopleQuery: "",
    peoplePage: 0,
  };
  const coreRoutes = new Set([
    "home",
    "overview",
    "finance",
    "projects",
    "intel",
    "team",
    "people",
    "calendar",
    "planning",
    "continuity",
    "brief",
    "sources",
  ]);
  const emptyState = (title, description, action = "") =>
    `<div class="atelier-empty"><span aria-hidden="true">◇</span><h3>${h(title)}</h3><p>${h(description)}</p>${action}</div>`;
  const link = (href, label, cls = "") =>
    `<a class="${cls}" href="${h(href)}">${h(label)}<span aria-hidden="true" class="atelier-arrow"><svg viewBox="0 0 16 16"><path d="M4 12 12 4M4 4h8v8"/></svg></span></a>`;
  const label = (text, tone = "neutral") =>
    `<span class="atelier-label ${tone}">${h(text)}</span>`;
  const fmt = (n) => (n === null || n === undefined ? "—" : eur(n));
  const number = (n) =>
    new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(n);
  const date = (d) =>
    d
      ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : "Not recorded";
  const title = (eyebrow, name, note = "", action = "") =>
    `<header class="atelier-section-head"><div><span class="atelier-eyebrow">${h(eyebrow)}</span><h2>${h(name)}</h2>${note ? `<p>${h(note)}</p>` : ""}</div>${action}</header>`;
  const tabs = (items, active, attr = "href") =>
    `<nav class="atelier-tabs" aria-label="Workspace views">${items.map(([id, name]) => (attr === "href" ? `<a href="${h(id)}" ${active === id ? 'aria-current="page"' : ""}>${h(name)}</a>` : `<button type="button" data-at="${attr}" data-value="${id}" aria-pressed="${active === id}">${h(name)}</button>`)).join("")}</nav>`;
  const stat = (name, value, detail, cls = "", href = "") =>
    `<${href ? "a" : "div"} ${href ? `href="${href}"` : ""} class="atelier-stat ${cls}"><span class="metric-label">${h(name)}</span><b>${h(value)}</b><span class="ks">${h(detail)}</span></${href ? "a" : "div"}>`;
  const pagination = (count, page, size, action) =>
    `<div class="atelier-pagination"><span>${count ? `${page * size + 1}–${Math.min(count, (page + 1) * size)}` : "0"} of ${count}</span><div><button class="btn" data-at="${action}" data-value="${page - 1}" ${page === 0 ? "disabled" : ""}>Previous</button><button class="btn" data-at="${action}" data-value="${page + 1}" ${(page + 1) * size >= count ? "disabled" : ""}>Next</button></div></div>`;
  function scope(R) {
    const a = Masterpiece.getScope(),
      candidates = S.projects.filter((p) => F.c === "all" || p.country === F.c);
    return `<section class="atelier-scope" aria-label="Shared portfolio selection"><label class="atelier-search"><span class="sr-only">Search portfolio</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input data-ledger-scope="q" value="${h(F.q)}" placeholder="Search projects, codes, countries…" aria-label="Search portfolio"></label><label><span class="sr-only">Portfolio country</span><select data-ledger-scope="c" aria-label="Portfolio country"><option value="all">All countries</option>${S.countries.map((c) => `<option value="${h(c.id)}" ${F.c === c.id ? "selected" : ""}>${h(c.name)}</option>`).join("")}</select></label><label><span class="sr-only">Portfolio project</span><select data-ledger-scope="project" aria-label="Portfolio project"><option value="all">All projects</option>${candidates.map((p) => `<option value="${h(p.id)}" ${a.project === p.id ? "selected" : ""}>${h(p.code || p.name)}</option>`).join("")}</select></label><details class="atelier-filter-more"><summary class="btn">More filters${F.s !== "all" || F.g !== "all" || F.ds || F.de ? " · active" : ""}</summary><div><label>Sector<select data-ledger-scope="s"><option value="all">All sectors</option>${[
      ...new Set(S.projects.map((p) => p.sector).filter(Boolean)),
    ]
      .sort()
      .map((s) => `<option ${F.s === s ? "selected" : ""}>${h(s)}</option>`)
      .join(
        "",
      )}</select></label><label>Financial signal<select data-ledger-scope="g">${[
      ["all", "All signals"],
      ["off", "Off pace"],
      ["r", "Ahead of time"],
      ["o", "Slow absorption"],
      ["g", "Near time pace"],
      ["n", "Not assessed"],
    ]
      .map(
        ([id, name]) =>
          `<option value="${id}" ${F.g === id ? "selected" : ""}>${name}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Project starts from<input type="date" data-ledger-scope="ds" value="${F.ds}"></label><label>Project ends by<input type="date" data-ledger-scope="de" value="${F.de}"></label><p>Project dates select records. History dates in Finance restrict report history only.</p></div></details><button class="btn atelier-reset" data-at="reset-scope">Reset</button><span class="atelier-selection">${R.length} / ${S.projects.length} projects${DEMO_MODE ? " · Sample data" : ""}</span></section>`;
  }
  function shell(R, body, active = "") {
    return `<div class="atelier-page" data-workspace="${active}">${scope(R)}${R.length ? body : emptyState("No projects match this selection", "Broaden the selection to return to your portfolio.", '<button class="btn" data-act="reset">Clear filters</button>')}</div>`;
  }
  function kpis(R, home = false) {
    const f = domain.financial(R);
    return `<div class="atelier-kpis ${home ? "home-metrics" : ""}">${stat("Approved funding", fmt(f.budget), `${R.length} projects · EUR`, "metric-budget")} ${stat("Cumulative spent", fmt(f.spent.value), `${f.spent.covered}/${R.length} with actuals evidence`, "metric-spent")} ${home ? stat("Needs follow-up", number(domain.observations(R).filter((x) => x.status !== "reviewed" && x.status !== "resolved").length), "Recorded observations · open or in progress", "", "#/intel") : stat("Spent + committed", fmt(f.exposure), `${f.covered}/${R.length} with exposure evidence`, "metric-exposure")} ${home ? stat("Evidence coverage", `${f.covered}/${R.length}`, "Exposure sources available · verification separate", "", "#/sources") : stat("Available funding", fmt(f.available), f.complete ? "Current selection fully covered" : "Whole-selection total withheld · incomplete sources", "metric-available")}</div>`;
  }
  function decisionRows(items, max = 5) {
    return items
      .slice(0, max)
      .map(
        (x) =>
          `<article class="atelier-decision"><div class="atelier-decision-marker ${x.tone}" aria-hidden="true">${x.priority === 0 ? "!" : "↗"}</div><div><div class="atelier-decision-meta">${label(x.priority === 0 ? "Act now" : x.priority === 1 ? "Review soon" : "Evidence gap", x.tone)}<span>${h(x.p.code)}${x.due ? " · " + h(date(x.due)) : ""}</span></div><h3>${link(x.link, x.title)}</h3><p>${h(x.reason === x.title ? x.next : x.reason)}</p><small>${h(x.source)}${x.sourceDate ? " · " + h(x.sourceDate) : ""}</small></div></article>`,
      )
      .join("");
  }
  function compactPosition(R) {
    const f = domain.financial(R),
      spent = f.spent.value,
      committed = f.committed.value,
      coveredBudget = R.filter((r) => r.evidence.exposure).reduce(
        (n, r) => n + r.b,
        0,
      );
    const denom = Math.max(
        f.budget,
        Math.abs(spent || 0) + Math.abs(committed || 0),
        1,
      ),
      width = (n) => Math.max(0, Math.min(100, (n / denom) * 100));
    return `<div class="atelier-position-total"><span>Approved portfolio funding</span><b>${fmt(f.budget)}</b></div><div class="atelier-financial-track" role="img" aria-label="Approved funding ${h(fmt(f.budget))}, covered expenditure ${h(fmt(spent))}, covered commitments ${h(fmt(committed))}. Missing source values are unknown."><i class="spent" style="width:${width(spent || 0)}%"></i><i class="committed" style="width:${width(committed || 0)}%"></i></div><dl class="atelier-amounts"><div><dt><i class="spent"></i>Spent</dt><dd>${fmt(spent)}</dd><small>${f.spent.covered}/${R.length} covered</small></div><div><dt><i class="committed"></i>Committed</dt><dd>${fmt(committed)}</dd><small>${f.committed.covered}/${R.length} covered</small></div><div><dt><i class="unknown"></i>Available</dt><dd>${fmt(f.available)}</dd><small>${f.complete ? "Entire selection" : "Incomplete evidence"}</small></div></dl><p class="atelier-note">${f.complete ? "All selected projects have exposure evidence." : `Exposure evidence covers ${fmt(coveredBudget)} of approved funding. Missing expenditure is unknown.`} Current project sources can have different dates.</p>${link("#/overview", "Explore financial position", "atelier-text-link")}`;
  }
  function agendaItems(R, max = 5) {
    const events = portfolioEvents(R)
      .filter((e) => !e.done && e.date >= TODAY())
      .slice(0, max);
    return events.length
      ? events
          .map(
            (e) =>
              `<div class="atelier-date-row"><time datetime="${h(e.date)}"><b>${new Date(e.date + "T12:00:00Z").getUTCDate()}</b><span>${new Date(e.date + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span></time><div>${link(e.link, e.label)}<small>${h(e.p.code)} · ${h(e.kind)}</small></div><span>${h(e.date)}</span></div>`,
          )
          .join("")
      : emptyState(
          "No upcoming dates recorded",
          "Add contract and plan dates to populate this view.",
        );
  }
  function home() {
    const R = rows(),
      f = domain.financial(R),
      observations = domain
        .observations(R)
        .filter((x) => x.status !== "resolved" && x.status !== "reviewed");
    const content = {
      decisions:
        title(
          "01 / Your next decisions",
          "Focus on what matters",
          `${observations.length} open or in-progress observations`,
          link("#/intel", "View all", "atelier-text-link"),
        ) +
        (observations.length
          ? decisionRows(
              observations.filter(
                (x, i, all) => all.findIndex((v) => v.p.id === x.p.id) === i,
              ),
            )
          : emptyState(
              "No open observations",
              "This does not establish project performance; inspect evidence coverage separately.",
            )),
      position:
        title(
          "02 / Financial position",
          "Funding in perspective",
          "Current values · source coverage stays visible",
        ) + compactPosition(R),
      dates:
        title(
          "03 / Looking ahead",
          "Next recorded dates",
          "Project records · completion is recorded separately",
          link("#/calendar", "Planning", "atelier-text-link"),
        ) + agendaItems(R),
      changes:
        title(
          "04 / Portfolio activity",
          "Recent changes",
          "Changes saved in this portfolio",
        ) +
        ((S.log || [])
          .slice(0, 5)
          .map(
            (x) =>
              `<div class="atelier-change"><span aria-hidden="true">↗</span><div><b>${h(x.msg)}</b><time>${h(new Date(x.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}</time></div></div>`,
          )
          .join("") ||
          emptyState(
            "No changes recorded",
            "Saved project edits and document imports appear here.",
          )),
    };
    const panels = prefs
      .get()
      .homeOrder.map(
        (id, i) =>
          `<section class="atelier-home-panel" data-home-panel="${id}">${ui.arranging ? `<div class="atelier-arrange"><button class="btn" draggable="true" data-home-handle="${id}" aria-label="Move ${id}. Alt and arrow keys also reorder.">⠿ Move ${id}</button><button class="btn" data-at="home-up" data-value="${id}" ${i === 0 ? "disabled" : ""}>Earlier</button><button class="btn" data-at="home-down" data-value="${id}" ${i === 3 ? "disabled" : ""}>Later</button></div>` : ""}${content[id]}</section>`,
      )
      .join("");
    return {
      t: "Portfolio overview",
      s: "A clear view of funding, evidence and the decisions ahead",
      html: shell(
        R,
        `<div class="atelier-welcome"><div><span class="atelier-eyebrow">${DEMO_MODE ? "Sample portfolio" : "Your portfolio"} / ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span><h2>${R.length} projects.<br><span>${new Set(R.map((r) => r.p.country)).size} countries. One portfolio.</span></h2><p>${observations.filter((x) => x.priority === 0).length} urgent observations · ${f.covered}/${R.length} projects with exposure evidence.</p></div><div><a class="btn" href="#/brief">Management brief</a><button class="btn" data-at="arrange-home" aria-pressed="${ui.arranging}">${ui.arranging ? "Done arranging" : "Arrange overview"}</button></div></div>${kpis(R, true)}<div class="atelier-home-grid ${ui.arranging ? "arranging" : ""}">${panels}</div><details class="atelier-method operational-details"><summary>Understand coverage and financial measures</summary><div class="operational-metrics">${stat("Budget used", f.used === null ? "—" : pc(f.used), f.label, "metric-used")}<p>Financial pace compares expenditure and commitments with elapsed project time. It does not measure delivery. Missing actuals, FTE, dates or plans are unknown, even when no alert is recorded.</p></div></details>`,
        "home",
      ),
    };
  }
  function sourceComparison(R) {
    const latest = new Map();
    for (const q of S.countryReports || []) {
      const old = latest.get(q.country);
      if (!old || q.date > old.date) latest.set(q.country, q);
    }
    const comparisons = R.map((r) => {
      const report = latest.get(r.p.country),
        matches = (report?.rows || []).filter((x) => x.pid === r.p.id);
      const source = matches.length === 1 ? matches[0] : null;
      const aligned = !!(
        source &&
        r.evidence.actual &&
        r.evidence.latest?.date &&
        r.evidence.latest.date === report.date
      );
      return {
        r,
        report,
        source,
        aligned,
        delta: aligned ? source.spent - r.sp : null,
        ambiguous: matches.length > 1,
      };
    });
    const linked = comparisons.filter((x) => x.source),
      aligned = comparisons.filter((x) => x.aligned),
      different = aligned.filter((x) => Math.abs(x.delta) >= 1);
    ui.comparisonPage = Math.min(
      ui.comparisonPage,
      Math.max(0, Math.ceil(comparisons.length / 25) - 1),
    );
    return `${title("Independent source families", "Do the sources agree?", "Compare linked expenditure only when reporting dates align.", '<button class="btn" data-at="import">Add a source report</button>')}<div class="atelier-kpis">${stat("Selected projects", R.length, "Current portfolio selection")}${stat("Linked country rows", `${linked.length}/${R.length}`, "Unlinked or ambiguous rows stay unknown")}${stat("Comparable source dates", `${aligned.length}/${R.length}`, "A common reporting date is required")}${stat("Differences to inspect", different.length, "Among comparable linked rows only")}</div><div class="tw atelier-source-comparison" tabindex="0" role="region" aria-label="Independent project and country expenditure comparison"><table><caption>EUR · latest eligible project actuals and latest country report · independent sources</caption><thead><tr><th>Project</th><th>Project actuals</th><th>Project source date</th><th>Country PDF actuals</th><th>Country source date</th><th>Comparable difference</th><th>Evidence</th></tr></thead><tbody>${comparisons
      .slice(ui.comparisonPage * 25, (ui.comparisonPage + 1) * 25)
      .map(
        ({ r, report, source, aligned, delta, ambiguous }) =>
          `<tr><td><b>${h(r.p.code)}</b><small>${h(r.p.name)}</small></td><td>${r.evidence.actual ? fmt(r.sp) : "—"}</td><td>${h(r.evidence.latest?.date || "Undated / not established")}</td><td>${source ? fmt(source.spent) : "—"}<small>${ambiguous ? "Ambiguous links" : !report ? "No country report" : !source ? "Project not linked" : "Linked source row"}</small></td><td>${h(report?.date || "—")}</td><td>${aligned ? fmt(delta) : "—"}<small>${aligned ? (Math.abs(delta) < 1 ? "Agrees within €1" : "Inspect the source difference") : source ? "Dates differ or are unknown" : "No comparable linked source"}</small></td><td><button class="btn" data-at="source" data-value="${h(r.p.id)}">Project sources</button>${report ? link("#/country/" + encodeURIComponent(r.p.country) + "/sources", "Country source") : ""}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div>${pagination(comparisons.length, ui.comparisonPage, 25, "comparison-page")}<p class="atelier-note">Country reports and project files are independent source families. Their amounts are never added together. A numerical difference is withheld for different or unknown reporting dates. A matching total does not verify individual transactions.</p><div class="atelier-country-sources">${
      [...latest.values()]
        .filter((q) => F.c === "all" || q.country === F.c)
        .map(
          (q) =>
            `<article><b>${h(cname(q.country))}</b><span>${h(q.date)} · ${h(q.fileName)}</span><small>${q.rows.length} source projects · ${q.rows.filter((x) => x.pid).length} linked in the originating report</small>${link("#/country/" + encodeURIComponent(q.country) + "/sources", "Inspect all country rows", "btn")}</article>`,
        )
        .join("") ||
      emptyState(
        "No country reports registered",
        "Project evidence remains available. Add a country expenditure PDF to compare the independent sources.",
      )
    }</div>`;
  }
  function finance(id) {
    const R = rows(),
      mode = ["history", "forecast", "sources", "studio"].includes(id)
        ? id
        : "current";
    const nav = tabs(
      [
        ["#/overview", "Current position"],
        ["#/overview/history", "Report history"],
        ["#/overview/forecast", "Forecasts"],
        ["#/overview/sources", "Source comparison"],
        ["#/overview/studio", "Custom studio"],
      ],
      mode === "current" ? "#/overview" : "#/overview/" + mode,
    );
    let content = "";
    if (mode === "studio")
      content = Masterpiece.analytics(
        rows({ allCountries: true, allProjects: true }),
      ).html;
    else if (mode === "sources") content = sourceComparison(R);
    else if (mode === "history") {
      const a = Masterpiece.getScope();
      content = `<section class="atelier-history-controls"><label>Report history from<input type="date" value="${a.from}" data-at-history="from"></label><label>Report history to<input type="date" value="${a.to}" data-at-history="to"></label><button class="btn" data-at="reset-history">All history</button><p>Dates change historical charts; current figures retain their current basis.</p></section>${Masterpiece.panel("trend", R)}<details class="atelier-method"><summary>Evidence coverage and comparison methods</summary>${Masterpiece.panel("coverage", R)}</details>`;
    } else if (mode === "forecast")
      content = `<div class="atelier-history-controls"><label>Forecast method<select data-ledger-scope="fm" aria-label="Forecast method">${[
        ["auto", "Best supported evidence"],
        ["reports", "Dated report rate"],
        ["run-rate", "Monthly run rate"],
        ["plan", "Earned-value plan"],
        ["team", "Recorded team estimate"],
        ["pace", "Financial pace"],
        ["trend", "Recent report trend"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${F.fm === v ? "selected" : ""}>${t}</option>`,
        )
        .join(
          "",
        )}</select></label><p>A method needs its supporting evidence. When it cannot establish an estimate, the result stays unknown.</p></div><div class="atelier-two-col">${Masterpiece.panel("forecast", R)}${Masterpiece.panel("pace", R)}</div><details class="atelier-method"><summary>Reallocation simulation · changes budgets when applied</summary>${simCard(R)}</details>`;
    else
      content = `${kpis(R)}<div class="atelier-two-col">${Masterpiece.panel("allocation", R)}${Masterpiece.panel("composition", R)}</div><details class="atelier-method"><summary>View source coverage</summary>${Masterpiece.panel("coverage", R)}</details><section class="atelier-register-section">${title("Project finance", "Financial register", "Current selection · totals respect source coverage")}${Masterpiece.table(R)}</section>`;
    return {
      t: "Finance",
      s: "Current position, recorded history and supported estimates",
      html: shell(R, nav + content, "finance"),
    };
  }
  const tablePresets = () =>
    `<div class="atelier-table-presets" role="group" aria-label="Table task views"><span>Quick view</span>${[
      ["essential", "Essential"],
      ["finance", "Finance"],
      ["forecast", "Forecast"],
      ["evidence", "Evidence"],
    ]
      .map(
        ([id, name]) =>
          `<button class="btn" data-at="table-preset" data-value="${id}">${name}</button>`,
      )
      .join("")}</div>`;
  function projects(id) {
    const R = rows(),
      mode = ["directory", "cards", "countries", "compare"].includes(id)
        ? id
        : prefs.get().projectsView;
    const nav = tabs(
      [
        ["directory", "Directory"],
        ["cards", "Project cards"],
        ["countries", "By country"],
        ["compare", "Compare"],
      ],
      mode,
      "projects-view",
    );
    let content;
    if (mode === "directory") content = tablePresets() + Masterpiece.table(R);
    else if (mode === "compare") content = legacy.compare().html;
    else if (mode === "countries")
      content = `<div class="atelier-country-list">${S.countries
        .map((c) => {
          const X = R.filter((r) => r.p.country === c.id),
            f = domain.financial(X);
          return X.length
            ? `<details class="atelier-country" ${R.length < 12 ? "open" : ""}><summary><span><b>${h(c.name)}</b><small>${X.length} projects · ${h(c.region || "")}</small></span><strong>${fmt(f.budget)}</strong></summary><ul>${X.map((r) => `<li>${link(PL(r.p), r.p.name)}<span>${h(r.p.code)} · ${h(r.p.sector || "Sector not set")}</span><b>${fmt(r.b)}</b></li>`).join("")}</ul><footer>${link("#/country/" + encodeURIComponent(c.id), "Open country sources and details")}</footer></details>`
            : "";
        })
        .join("")}</div>`;
    else {
      const pages = Math.max(1, Math.ceil(R.length / 12));
      ui.projectsPage = Math.min(ui.projectsPage, pages - 1);
      content = `<div class="atelier-project-cards">${R.slice(
        ui.projectsPage * 12,
        (ui.projectsPage + 1) * 12,
      )
        .map((r, i) => pcard(r, i))
        .join(
          "",
        )}</div>${pagination(R.length, ui.projectsPage, 12, "projects-page")}`;
    }
    return {
      t: "Projects",
      s: "Find a project, compare records and inspect the evidence",
      html: shell(
        R,
        `<div class="atelier-directory-heading">${nav}<span>${R.length} selected · ${new Set(R.map((r) => r.p.country)).size} countries</span></div>${content}`,
        "projects",
      ),
    };
  }
  const categories = [
    ["all", "All observations"],
    ["finance", "Finance"],
    ["delivery", "Delivery"],
    ["evidence", "Evidence"],
    ["people", "People"],
    ["continuity", "Continuity"],
  ];
  function intelligence() {
    const R = rows(),
      all = domain.observations(R),
      query = ui.queueQuery.toLocaleLowerCase();
    const chosen = all.filter(
      (x) =>
        (ui.queueCategory === "all" || x.category === ui.queueCategory) &&
        (ui.queueStatus === "all" ||
          (ui.queueStatus === "active" &&
            !["resolved", "reviewed"].includes(x.status)) ||
          x.status === ui.queueStatus) &&
        (!query ||
          [x.title, x.reason, x.p.code, x.p.name, x.owner]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    );
    const pageCount = Math.max(1, Math.ceil(chosen.length / 15));
    ui.queuePage = Math.min(ui.queuePage, pageCount - 1);
    const f = domain.financial(R);
    const content = `<section class="atelier-intelligence-intro"><div><span class="atelier-eyebrow">Evidence into decisions</span><h2>Every signal deserves context.</h2><p>Review the reason, inspect its source and record who takes the next step.</p></div><div class="atelier-evidence-dimensions"><div><b>${f.pace}/${R.length}</b><span>Financial pace assessed</span></div><div><b>${f.delivery}/${R.length}</b><span>Recorded delivery plans</span></div><div><b>${f.covered}/${R.length}</b><span>Exposure evidence</span></div></div></section>${tabs(categories, ui.queueCategory, "queue-category")}<div class="atelier-list-toolbar"><label>Search observations<input data-at-input="queue" aria-label="Search observations" value="${h(ui.queueQuery)}" placeholder="Project, reason or owner"></label><label>Review state<select data-at-select="queue-status">${[
      ["active", "Open + in progress"],
      ["all", "All current conditions"],
      ["open", "Open"],
      ["progress", "In progress"],
      ["reviewed", "Reviewed"],
      ["resolved", "Resolution recorded"],
    ]
      .map(
        ([k, t]) =>
          `<option value="${k}" ${ui.queueStatus === k ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><span>${chosen.length} matching observations</span></div><div class="atelier-queue">${
      chosen
        .slice(ui.queuePage * 15, (ui.queuePage + 1) * 15)
        .map(
          (x) =>
            `<article class="atelier-queue-item ${x.tone}" data-observation="${h(x.key)}"><header>${label(x.priority === 0 ? "Act now" : x.priority === 1 ? "Review soon" : "Evidence gap", x.tone)}<span>${h(x.p.code)} · ${h(cname(x.p.country))}</span><span class="atelier-label">${h(x.category)}</span></header><div class="atelier-queue-body"><div><h3>${h(x.title)}</h3><p>${h(x.reason)}</p><dl><div><dt>Evidence</dt><dd>${h(x.source)}${x.sourceDate ? " · " + h(x.sourceDate) : ""}</dd></div>${x.due ? `<div><dt>Recorded due date</dt><dd>${h(date(x.due))}</dd></div>` : ""}<div><dt>Next action</dt><dd>${h(x.next)}</dd></div></dl>${x.status === "resolved" ? '<p class="atelier-condition">A resolution was recorded, but the source condition is still present. Verify the project record before closing the issue.</p>' : ""}${x.review.due ? `<p class="atelier-note">Follow-up ${h(x.review.due)}${x.review.due < TODAY() ? " · overdue" : ""}</p>` : ""}${x.review.note ? `<p class="atelier-review-note">${h(x.review.note)}</p>` : ""}</div><aside>${label({ open: "Open", progress: "In progress", reviewed: "Reviewed", resolved: "Resolution recorded" }[x.status] || "Open")}<span>Owner: ${h(x.owner || "Unassigned")}</span>${link(x.link, "Inspect project", "btn")}<button class="btn" data-at="review" data-value="${h(x.key)}">Record follow-up</button><button class="btn" data-at="source" data-value="${h(x.p.id)}">Source details</button></aside></div></article>`,
        )
        .join("") ||
      emptyState(
        "No observations match",
        "Change the category or review state. Missing evidence is never interpreted as a clean bill of health.",
      )
    }</div>${pagination(chosen.length, ui.queuePage, 15, "queue-page")}<p class="atelier-note">Coverage describes available evidence. Reviewed is separate from resolved; recording a resolution does not remove a source condition. No composite health score is used.</p>`;
    return {
      t: "Intelligence",
      s: "Explainable observations, evidence and accountable follow-up",
      html: shell(R, content, "intelligence"),
    };
  }
  function people() {
    const R = rows(),
      mode = prefs.get().peopleTab,
      nav = tabs(
        [
          ["assignments", "Assignments"],
          ["people", "Source names"],
          ["contracts", "Contracts"],
        ],
        mode,
        "people-tab",
      );
    let content;
    if (mode === "assignments") content = Masterpiece.staff(R).html;
    else {
      const assignments = portfolioDocumentTeam(R),
        groups = new Map();
      assignments.forEach((x) => {
        const key = x.name.normalize("NFKC").toLocaleLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(x);
      });
      const query = ui.peopleQuery.toLocaleLowerCase();
      const records =
        mode === "people"
          ? [...groups.values()].filter(
              (G) =>
                !query ||
                [G[0].name, ...G.map((x) => x.r.p.code)]
                  .join(" ")
                  .toLocaleLowerCase()
                  .includes(query),
            )
          : assignments.filter(
              (x) =>
                !query ||
                [x.name, x.r.p.code, x.a.position]
                  .join(" ")
                  .toLocaleLowerCase()
                  .includes(query),
            );
      ui.peoplePage = Math.min(
        ui.peoplePage,
        Math.max(0, Math.ceil(records.length / 24) - 1),
      );
      content = `${title("Source-backed people", mode === "people" ? "Names across the portfolio" : "Assignment contracts", mode === "people" ? "Matching names are grouped for navigation; shared identity is not verified." : "Contract records and payroll observations remain distinct.")}<div class="atelier-list-toolbar"><label>Search names and projects<input data-at-input="people" value="${h(ui.peopleQuery)}" aria-label="Search source names"></label><span>${records.length} ${mode === "people" ? "source-name groups" : "assignments"}</span></div><div class="atelier-person-directory">${
        records
          .slice(ui.peoplePage * 24, (ui.peoplePage + 1) * 24)
          .map((record) => {
            if (mode === "people") {
              const G = record,
                known = G.filter((x) => x.fte !== null);
              return `<article><span class="atelier-avatar">${h(
                G[0].name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join(""),
              )}</span><h3>${h(G[0].name)}</h3>${label("Identity not verified")}<p>${G.length} project assignments · ${known.length}/${G.length} FTE covered</p><div>${G.map((x) => link(PL(x.r.p, "finance/staff"), x.r.p.code)).join("")}</div><small>Equal source names can describe different people.</small></article>`;
            }
            const x = record;
            return `<article><span class="atelier-eyebrow">${h(x.r.p.code)} / ${h(x.a.base || "Base not established")}</span><h3>${h(x.name)}</h3><p>${h(x.a.position || "Position not recorded")}</p><dl><div><dt>Contract start</dt><dd>${h(x.a.start || "Not established")}</dd></div><div><dt>Contract end</dt><dd>${h(x.a.end || "Not established")}</dd></div><div><dt>Known assignment FTE</dt><dd>${x.fte === null ? "—" : number(x.fte)}</dd></div></dl>${link(PL(x.r.p, "finance/staff"), "Review original assignment", "btn")}</article>`;
          })
          .join("") ||
        emptyState(
          "No source records match",
          "Import a staffing source or broaden your search.",
        )
      }</div>${pagination(records.length, ui.peoplePage, 24, "people-page")}`;
    }
    return {
      t: "People",
      s: "Source names, project assignments and contract evidence",
      html: shell(R, nav + content, "people"),
    };
  }
  function planning(id) {
    const R = rows(),
      mode = ["agenda", "calendar", "timeline", "continuity"].includes(id)
        ? id
        : prefs.get().planningTab;
    const nav = tabs(
      [
        ["agenda", "Agenda"],
        ["calendar", "Calendar"],
        ["timeline", "Timeline"],
        ["continuity", "Continuity"],
      ],
      mode,
      "planning-tab",
    );
    let content;
    if (mode === "timeline") content = Masterpiece.timeline(R);
    else if (mode === "calendar") content = legacy.calendar().html;
    else if (mode === "continuity") content = legacy.continuity().html;
    else {
      const all = portfolioEvents(R),
        matches = all.filter(
          (e) =>
            (ui.agendaKind === "all" || e.kind === ui.agendaKind) &&
            (ui.agenda === "all" ||
              (ui.agenda === "complete" && e.done) ||
              (ui.agenda === "overdue" && !e.done && e.date < TODAY()) ||
              (ui.agenda === "upcoming" && !e.done && e.date >= TODAY())),
        );
      ui.agendaPage = Math.min(
        ui.agendaPage,
        Math.max(0, Math.ceil(matches.length / 30) - 1),
      );
      content = `<div class="atelier-kpis atelier-small-kpis">${stat("Overdue recorded dates", number(all.filter((e) => !e.done && e.date < TODAY()).length), "Completion follows project records")}${stat("Next 90 days", number(all.filter((e) => !e.done && e.date >= TODAY() && dd(e.date) <= 90).length), "Dates from contracts and plans")}${stat("Projects with dates", `${new Set(all.map((e) => e.p.id)).size}/${R.length}`, "No dates does not mean no obligations")}</div><div class="atelier-list-toolbar"><div class="atelier-segments" aria-label="Agenda range">${[
        ["upcoming", "Upcoming"],
        ["overdue", "Overdue"],
        ["all", "All dates"],
        ["complete", "Recorded complete"],
      ]
        .map(
          ([v, t]) =>
            `<button class="btn" data-at="agenda-range" data-value="${v}" aria-pressed="${ui.agenda === v}">${t}</button>`,
        )
        .join(
          "",
        )}</div><label>Event type<select data-at-select="agenda-kind">${[
        ["all", "All types"],
        ["report", "Reports"],
        ["payment", "Payments"],
        ["milestone", "Milestones"],
        ["decision", "Decisions"],
        ["end", "Project end"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${ui.agendaKind === v ? "selected" : ""}>${t}</option>`,
        )
        .join(
          "",
        )}</select></label></div><section class="atelier-agenda" aria-label="Recorded project agenda">${
        matches
          .slice(ui.agendaPage * 30, (ui.agendaPage + 1) * 30)
          .map(
            (e) =>
              `<article><time datetime="${h(e.date)}"><b>${h(date(e.date))}</b><span>${e.done ? "Recorded complete" : e.date < TODAY() ? `${Math.abs(dd(e.date))} days overdue` : dd(e.date) === 0 ? "Today" : `In ${dd(e.date)} days`}</span></time><div>${label(e.kind, e.done ? "good" : e.date < TODAY() ? "bad" : "neutral")}<h3>${link(e.link, e.label)}</h3><p>${h(e.p.code)} · ${h(e.p.name)}</p>${e.detail ? `<small>${h(e.detail)}</small>` : ""}</div><button class="btn" data-at="source" data-value="${h(e.p.id)}">Evidence</button></article>`,
          )
          .join("") ||
        emptyState(
          "No recorded dates in this view",
          "Change the range or import contract and plan dates.",
        )
      }</section>${pagination(matches.length, ui.agendaPage, 30, "agenda-page")}<p class="atelier-note">Planned dates do not establish delivery or receipt of a payment. Only completion recorded in the originating project is shown as complete.</p>`;
    }
    return {
      t: "Planning",
      s: "Recorded dates, delivery schedules and continuity decisions",
      html: shell(R, nav + content, "planning"),
    };
  }
  function sourceCenter() {
    const R = rows(),
      all = [
        ...domain.sources(R),
        ...(S.countryReports || [])
          .filter((q) => F.c === "all" || q.country === F.c)
          .map((q) => ({
            key: "country/" + q.id,
            p: { code: cname(q.country) },
            name: q.fileName,
            date: q.date,
            type: "Country expenditure PDF",
            state: q.originalStored ? "original retained" : "data registered",
            detail:
              q.rows.length +
              " source projects · country figures are a separate source family",
            href: "#/country/" + encodeURIComponent(q.country) + "/sources",
            countryOriginal: q.originalStored ? q.id : "",
            download: "",
          })),
      ],
      q = ui.sourcesQuery.toLocaleLowerCase(),
      selected = all.filter(
        (x) =>
          !q ||
          [x.name, x.p.code, x.type, x.detail]
            .join(" ")
            .toLocaleLowerCase()
            .includes(q),
      );
    ui.sourcesPage = Math.min(
      ui.sourcesPage,
      Math.max(0, Math.ceil(selected.length / 25) - 1),
    );
    return {
      t: "Source center",
      s: "Original documents, financial versions and a guided import review",
      html: shell(
        R,
        `${title("Traceable evidence", "From original to decision", "Inspect retained files and review every import before it changes records.", '<button class="btn pri" data-at="import">＋ Add source documents</button>')}<ol class="atelier-import-steps"><li><b>01</b>Select files</li><li><b>02</b>Match project</li><li><b>03</b>Recognize & preview</li><li><b>04</b>Review differences</li><li><b>05</b>Save source links</li></ol><div class="atelier-list-toolbar"><label>Search sources<input data-at-input="sources" aria-label="Search sources" value="${h(ui.sourcesQuery)}" placeholder="File, project, type…"></label><span>${selected.length} source records</span>${link("#/overview/sources", "Compare country and project sources", "btn")}</div><div class="atelier-source-list">${
          selected
            .slice(ui.sourcesPage * 25, (ui.sourcesPage + 1) * 25)
            .map(
              (x) =>
                `<article><span class="atelier-file-icon" aria-hidden="true">↳</span><div><h3>${h(x.name)}</h3><p>${h(x.p.code)} · ${h(x.type)} · ${h(x.date || "Date not recorded")}</p><small>${h(x.detail)}</small></div><div>${label(x.state, x.state === "review" ? "warn" : "neutral")}${x.p.id ? `<button class="btn" data-at="source" data-value="${h(x.p.id)}">Evidence</button>` : ""}${link(x.href, "Open record", "btn")}${x.countryOriginal ? `<button class="btn" data-act="cm-original" data-id="${h(x.countryOriginal)}">Original PDF</button>` : ""}${x.download ? `<button class="btn" data-act="docget" data-id="${h(x.download)}">Original</button>` : ""}</div></article>`,
            )
            .join("") ||
          emptyState(
            "No source records match",
            "Add files or change the search. Original financial readers remain available.",
          )
        }</div>${pagination(selected.length, ui.sourcesPage, 25, "sources-page")}`,
        "sources",
      ),
    };
  }
  function brief() {
    const R = rows();
    return {
      t: "Management brief",
      s: "Current selection, source coverage and recorded follow-up",
      html: shell(
        R,
        `<div class="atelier-brief-actions"><button class="btn pri" data-at="print">Print / save PDF</button><button class="btn" data-studio-action="open-brief">Open export preview</button></div><article class="atelier-management-brief">${Masterpiece.brief(R)}${title("Accountable follow-up", "Current review queue", "Recorded source conditions and their follow-up state")}<div>${
          domain
            .observations(R)
            .slice(0, 12)
            .map(
              (x) =>
                `<div class="atelier-brief-observation"><b>${h(x.p.code)} · ${h(x.title)}</b><p>${h(x.reason)}</p><small>${h(x.status)} · ${h(x.owner || "Unassigned")} · ${h(x.source)}${x.review.due ? " · follow-up " + h(x.review.due) : ""}</small></div>`,
            )
            .join("") || "<p>No current observations.</p>"
        }</div></article>`,
        "brief",
      ),
    };
  }
  // A shared evidence drawer, including retained file links and all financial versions.
  const drawer = document.createElement("dialog");
  drawer.className = "atelier-drawer";
  drawer.setAttribute("aria-labelledby", "atelier-drawer-title");
  document.body.append(drawer);
  const reviewDialog = document.createElement("dialog");
  reviewDialog.className = "atelier-review-dialog";
  reviewDialog.setAttribute("aria-labelledby", "atelier-review-title");
  document.body.append(reviewDialog);
  const importDialog = document.createElement("dialog");
  importDialog.className = "atelier-import-dialog";
  importDialog.setAttribute("aria-labelledby", "atelier-import-title");
  document.body.append(importDialog);
  function showSource(pid) {
    const p = S.projects.find((p) => p.id === pid);
    if (!p) return;
    const r = model(p),
      sources = domain.sources([r]),
      e = r.evidence;
    drawer.innerHTML = `<header>${title("Source details", p.code || p.name, "Original records and financial coverage")}<button class="btn" data-at="close-dialog" aria-label="Close source details">×</button></header><h3 id="atelier-drawer-title">${h(p.name)}</h3><div class="atelier-drawer-facts"><div><span>Approved</span><b>${fmt(r.b)}</b></div><div><span>Spent</span><b>${e.actual ? fmt(r.sp) : "—"}</b></div><div><span>Exposure</span><b>${e.exposure ? fmt(r.u) : "—"}</b></div><div><span>Actuals source date</span><b>${h(e.latest?.date || "Not established")}</b></div></div><p class="atelier-note">A dash means no usable evidence. Availability and source dates do not establish verification or delivery.</p><h4>Financial versions</h4>${
      (p.reportingPeriods || [])
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map(
          (q) =>
            `<article class="atelier-source-version"><b>${h(q.name || q.fileName)}</b><span>${h(q.type)} · ${h(q.date || "Undated")}</span>${link(PL(p, "finance/reports"), "Inspect version")}</article>`,
        )
        .join("") || "<p>No financial versions recorded.</p>"
    }<h4>Retained original files</h4>${
      sources
        .filter((x) => x.download)
        .map(
          (x) =>
            `<article class="atelier-source-version"><b>${h(x.name)}</b><small>${h(x.detail)}</small><button class="btn" data-act="docget" data-id="${h(x.download)}">Download original</button></article>`,
        )
        .join("") ||
      "<p>No original files listed. Inspect the project to review its inputs.</p>"
    }<footer>${link(PL(p, "documents/documents"), "Open project documents", "btn")}</footer>`;
    drawer.showModal();
    drawer.querySelector('[data-at="close-dialog"]').focus();
  }
  drawer.addEventListener("click", (event) => {
    const action = event.target.closest('[data-act="docget"]');
    if (action) {
      event.preventDefault();
      act("docget", action.dataset.id);
    }
    if (event.target.closest('a[href^="#/"]')) drawer.close();
  });
  let reviewKey = "";
  function showReview(key) {
    const x = domain.observations(rows()).find((x) => x.key === key);
    if (!x) return;
    reviewKey = key;
    reviewDialog.innerHTML = `<form><header><div><span class="atelier-eyebrow">${h(x.p.code)} / Follow-up</span><h2 id="atelier-review-title">Record the next step</h2></div><button type="button" class="btn" data-at="close-dialog" aria-label="Close follow-up">×</button></header><p>${h(x.title)}</p><label>Review state<select name="status">${[
      ["open", "Open"],
      ["progress", "In progress"],
      ["reviewed", "Reviewed"],
      ["resolved", "Resolution recorded"],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${x.status === v ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Responsible person<input name="owner" maxlength="120" value="${h(x.owner)}" placeholder="Name or team"></label><label>Follow-up date<input name="due" type="date" value="${h(x.review.due || "")}"></label><label>Decision and next action<textarea name="note" maxlength="2000" rows="4">${h(x.review.note || "")}</textarea></label><p class="atelier-note">Reviewed does not mean resolved. A recorded resolution remains visible while the originating source condition persists. This follow-up is included in portfolio backups and can be undone.</p><footer><button type="button" class="btn" data-at="close-dialog">Cancel</button><button class="btn pri" type="submit">Save follow-up</button></footer></form>`;
    reviewDialog.showModal();
    reviewDialog.querySelector("select").focus();
  }
  reviewDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const x = domain.observations(rows()).find((x) => x.key === reviewKey);
    if (!x) return;
    const f = new FormData(event.target),
      status = f.get("status");
    if (!["open", "progress", "reviewed", "resolved"].includes(status)) return;
    commit("Recorded follow-up for " + x.p.code + ": " + x.title);
    S.reviewWork =
      S.reviewWork &&
      typeof S.reviewWork === "object" &&
      !Array.isArray(S.reviewWork)
        ? S.reviewWork
        : {};
    S.reviewWork[x.key] = {
      fingerprint: x.fingerprint,
      status,
      owner: String(f.get("owner") || "")
        .trim()
        .slice(0, 120),
      due: String(f.get("due") || ""),
      note: String(f.get("note") || "")
        .trim()
        .slice(0, 2000),
      at: new Date().toISOString(),
    };
    save();
    reviewDialog.close();
    render();
    toast("Follow-up saved", { l: "Undo", f: undo });
  });
  let selectedFiles = [];
  function showImport() {
    selectedFiles = [];
    importDialog.innerHTML = `<form><header><div><span class="atelier-eyebrow">Source workflow / 01–02</span><h2 id="atelier-import-title">Bring the evidence in</h2></div><button type="button" class="btn" data-at="close-dialog" aria-label="Close source import">×</button></header><ol class="atelier-import-steps"><li><b>01</b>Select</li><li><b>02</b>Match</li><li><b>03–05</b>Review & save</li></ol><label class="atelier-drop" id="atelier-drop">Drop documents here or choose files<input type="file" id="atelier-import-files" multiple accept=".pdf,.docx,.xlsx,.csv"><small>PDF · Word · Excel · CSV. Scanned PDFs need a text layer.</small></label><label>Source family<select id="atelier-import-family"><option value="project">Project documents and financial files</option><option value="country">Country expenditure PDF</option></select></label><label id="atelier-project-match">Match to project<select id="atelier-import-project" required>${S.projects.map((p) => `<option value="${h(p.id)}">${h(p.code)} · ${h(p.name)}</option>`).join("")}</select></label><label id="atelier-country-match" hidden>Match to country<select id="atelier-import-country"><option value="">Recognize country from document</option>${S.countries.map((c) => `<option value="${h(c.id)}">${h(c.name)}</option>`).join("")}</select></label><div id="atelier-import-summary" role="status">No files selected.</div><p class="atelier-note">The existing readers will recognize columns, dates, source terms and differences. You will review their results before saving. File names alone never establish project identity.</p><footer><button type="button" class="btn" data-at="close-dialog">Cancel</button><button type="submit" class="btn pri">Recognize & preview</button></footer></form>`;
    const input = importDialog.querySelector('input[type="file"]'),
      drop = importDialog.querySelector(".atelier-drop");
    const update = (files) => {
      selectedFiles = [...files];
      importDialog.querySelector("#atelier-import-summary").textContent =
        selectedFiles.length
          ? selectedFiles.map((f) => f.name).join(" · ")
          : "No files selected.";
    };
    input.addEventListener("change", () => update(input.files));
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.add("dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.remove("dragging");
      update(e.dataTransfer.files);
    });
    importDialog
      .querySelector("#atelier-import-family")
      .addEventListener("change", (e) => {
        const country = e.target.value === "country";
        importDialog.querySelector("#atelier-project-match").hidden = country;
        importDialog.querySelector("#atelier-country-match").hidden = !country;
        importDialog.querySelector("#atelier-import-project").required =
          !country;
      });
    importDialog.showModal();
    input.focus();
  }
  importDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = importDialog.querySelector("#atelier-import-summary");
    if (!selectedFiles.length) {
      message.textContent = "Choose at least one file.";
      return;
    }
    const family = importDialog.querySelector("#atelier-import-family").value;
    if (
      family === "country" &&
      (selectedFiles.length !== 1 || !/\.pdf$/i.test(selectedFiles[0].name))
    ) {
      message.textContent =
        "Choose one country expenditure PDF for this review.";
      return;
    }
    const pid = importDialog.querySelector("#atelier-import-project").value,
      cid = importDialog.querySelector("#atelier-import-country").value,
      files = selectedFiles;
    if (family === "project" && !S.projects.some((p) => p.id === pid)) {
      message.textContent =
        "Choose an existing project, or add a project first.";
      return;
    }
    importDialog.close();
    if (family === "country") cmImport(files[0], cid);
    else routeFiles(files, pid);
  });
  function moveHome(id, delta) {
    const order = prefs.get().homeOrder.slice(),
      from = order.indexOf(id),
      to = Math.max(0, Math.min(order.length - 1, from + delta));
    if (from < 0 || from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    prefs.set({ homeOrder: order });
    render();
    view
      .querySelector(`[data-home-handle="${id}"]`)
      ?.focus({ preventScroll: true });
  }
  let dragHome = "",
    touchHome = null;
  view.addEventListener(
    "dragstart",
    (event) => {
      const node = event.target.closest("[data-home-handle]");
      if (!node) return;
      event.stopImmediatePropagation();
      dragHome = node.dataset.homeHandle;
      event.dataTransfer.setData("text/plain", dragHome);
      event.dataTransfer.effectAllowed = "move";
    },
    true,
  );
  view.addEventListener(
    "dragover",
    (event) => {
      if (!dragHome || !event.target.closest("[data-home-panel]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.dataTransfer.dropEffect = "move";
    },
    true,
  );
  view.addEventListener(
    "drop",
    (event) => {
      if (!dragHome) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const id = event.target.closest("[data-home-panel]")?.dataset.homePanel;
      if (id)
        moveHome(
          dragHome,
          prefs.get().homeOrder.indexOf(id) -
            prefs.get().homeOrder.indexOf(dragHome),
        );
      dragHome = "";
    },
    true,
  );
  view.addEventListener("dragend", () => {
    dragHome = "";
  });
  view.addEventListener("keydown", (event) => {
    const id = event.target.closest("[data-home-handle]")?.dataset.homeHandle;
    if (!id || !event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key))
      return;
    event.preventDefault();
    moveHome(id, event.key === "ArrowUp" ? -1 : 1);
  });
  view.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-home-handle]");
    if (!handle || event.pointerType === "mouse") return;
    event.preventDefault();
    const gesture = (touchHome = {
      id: handle.dataset.homeHandle,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startY: event.clientY,
      active: false,
    });
    const track = () => {
      if (touchHome !== gesture) return;
      if (gesture.active) {
        if (gesture.y < 70) window.scrollBy(0, -10);
        else if (gesture.y > innerHeight - 110) window.scrollBy(0, 10);
        const target = document
          .elementFromPoint(gesture.x, gesture.y)
          ?.closest("[data-home-panel]");
        gesture.target = target?.dataset.homePanel;
        view
          .querySelectorAll("[data-home-panel]")
          .forEach((p) => p.classList.toggle("drop-target", p === target));
      }
      gesture.raf = requestAnimationFrame(track);
    };
    gesture.raf = requestAnimationFrame(track);
    handle.setPointerCapture(event.pointerId);
  });
  window.addEventListener(
    "pointermove",
    (event) => {
      if (!touchHome || touchHome.pointer !== event.pointerId) return;
      event.preventDefault();
      touchHome.x = event.clientX;
      touchHome.y = event.clientY;
      touchHome.active = Math.abs(event.clientY - touchHome.startY) > 6;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-home-panel]");
      view
        .querySelectorAll("[data-home-panel]")
        .forEach((p) => p.classList.toggle("drop-target", p === target));
      touchHome.target = target?.dataset.homePanel;
    },
    { passive: false },
  );
  window.addEventListener("pointerup", (event) => {
    if (!touchHome || touchHome.pointer !== event.pointerId) return;
    const { id, target } = touchHome;
    cancelAnimationFrame(touchHome.raf);
    touchHome = null;
    if (target)
      moveHome(
        id,
        prefs.get().homeOrder.indexOf(target) -
          prefs.get().homeOrder.indexOf(id),
      );
    view
      .querySelectorAll(".drop-target")
      .forEach((p) => p.classList.remove("drop-target"));
  });
  window.addEventListener("pointercancel", () => {
    if (touchHome) cancelAnimationFrame(touchHome.raf);
    touchHome = null;
    view
      .querySelectorAll(".drop-target")
      .forEach((p) => p.classList.remove("drop-target"));
  });
  const handlers = {
    "table-preset": (id) => Masterpiece.tablePreset(id),
    "arrange-home": () => {
      ui.arranging = !ui.arranging;
      render();
    },
    "home-up": (id) => moveHome(id, -1),
    "home-down": (id) => moveHome(id, 1),
    "projects-view": (value) => {
      ui.projectsPage = 0;
      prefs.set({ projectsView: value });
      location.hash = "#/projects/" + value;
      render();
    },
    "people-tab": (value) => {
      prefs.set({ peopleTab: value });
      ui.peoplePage = 0;
      render();
    },
    "planning-tab": (value) => {
      prefs.set({ planningTab: value });
      ui.agendaPage = 0;
      location.hash = "#/calendar/" + value;
      render();
    },
    "queue-category": (value) => {
      ui.queueCategory = value;
      ui.queuePage = 0;
      render();
    },
    "agenda-range": (value) => {
      ui.agenda = value;
      ui.agendaPage = 0;
      render();
    },
    "projects-page": (v) => {
      ui.projectsPage = Math.max(0, +v || 0);
      render();
    },
    "queue-page": (v) => {
      ui.queuePage = Math.max(0, +v || 0);
      render();
    },
    "comparison-page": (v) => {
      ui.comparisonPage = Math.max(0, +v || 0);
      render();
    },
    "sources-page": (v) => {
      ui.sourcesPage = Math.max(0, +v || 0);
      render();
    },
    "agenda-page": (v) => {
      ui.agendaPage = Math.max(0, +v || 0);
      render();
    },
    "people-page": (v) => {
      ui.peoplePage = Math.max(0, +v || 0);
      render();
    },
    "reset-scope": () => resetF(),
    "reset-history": () => Masterpiece.setScope({ from: "", to: "" }),
    review: showReview,
    source: showSource,
    import: showImport,
    print: () => window.print(),
  };
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("[data-at]");
      if (!button) return;
      const action = button.dataset.at;
      if (action === "close-dialog") {
        event.preventDefault();
        button.closest("dialog").close();
        return;
      }
      if (!handlers[action]) return;
      event.preventDefault();
      handlers[action](button.dataset.value);
    },
    true,
  );
  view.addEventListener("change", (event) => {
    const target = event.target,
      k = target.dataset.ledgerScope;
    if (k) {
      if (k === "q") return;
      if (k === "project") Masterpiece.setScope({ project: target.value });
      else setF(k, target.value);
      ui.projectsPage = 0;
      return;
    }
    if (target.dataset.atHistory) {
      Masterpiece.setScope({ [target.dataset.atHistory]: target.value });
      return;
    }
    const key = target.dataset.atSelect;
    if (key === "queue-status") {
      ui.queueStatus = target.value;
      ui.queuePage = 0;
      render();
    } else if (key === "agenda-kind") {
      ui.agendaKind = target.value;
      ui.agendaPage = 0;
      render();
    }
  });
  let inputTimer;
  view.addEventListener("input", (event) => {
    const input = event.target,
      search = input.dataset.atInput,
      shared = input.dataset.ledgerScope === "q";
    if (!search && !shared) return;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      if (!input.isConnected) return;
      const start = input.selectionStart,
        end = input.selectionEnd;
      if (shared) {
        F.q = input.value;
        ui.projectsPage = 0;
        Masterpiece.syncFilters("q");
        ls.set(FKEY, F);
        syncBar();
      } else {
        ui[
          search === "queue"
            ? "queueQuery"
            : search === "people"
              ? "peopleQuery"
              : "sourcesQuery"
        ] = input.value;
        ui[search + "Page"] = 0;
      }
      render();
      const selector = shared
        ? '[data-ledger-scope="q"]'
        : `[data-at-input="${search}"]`;
      const restored = view.querySelector(selector);
      restored?.focus({ preventScroll: true });
      restored?.setSelectionRange(start, end);
    }, 160);
  });
  function navigation() {
    const side = $(".side"),
      original = new Map(
        [...side.querySelectorAll("a[data-r]")].map((a) => [a.dataset.r, a]),
      );
    const workspace = [
      ["home", "Home"],
      ["projects", "Projects"],
      ["overview", "Finance"],
      ["intel", "Intelligence"],
      ["team", "People"],
      ["calendar", "Planning"],
    ];
    const first = side.querySelector(".nav-label");
    first.textContent = "Workspace";
    side.querySelectorAll("a[data-r],.nav-label").forEach((a) => {
      if (a !== first) a.remove();
    });
    const fragment = document.createDocumentFragment();
    workspace.forEach(([route, name]) => {
      const a = original.get(route);
      a.classList.remove("mx");
      a.innerHTML = a.querySelector("svg").outerHTML + `<span>${name}</span>`;
      a.dataset.section = route;
      fragment.append(a);
    });
    const utility = document.createElement("div");
    utility.className = "nav-label";
    utility.textContent = "Tools";
    fragment.append(utility);
    const sources = document.createElement("a");
    sources.href = "#/sources";
    sources.dataset.r = "sources";
    sources.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8M8 17h6"/></svg><span>Source center</span>';
    fragment.append(sources);
    const data = original.get("data");
    data.innerHTML =
      data.querySelector("svg").outerHTML + "<span>Data & settings</span>";
    data.classList.remove("mx");
    fragment.append(data);
    first.after(fragment);
    side.dataset.ledgerNav = "six";
    $(".brand small").textContent = "Evidence into decisions";
    const sourceButton = document.createElement("a");
    sourceButton.href = "#/sources";
    sourceButton.className = "btn atelier-top-source";
    sourceButton.textContent = "Sources";
    $("#cmdk").before(sourceButton);
  }
  function afterRender(route) {
    Masterpiece.afterRender(route);
    const root = coreRoutes.has(route);
    $("main").classList.toggle("atelier-root", root);
    if (root) {
      $("#barwrap").hidden = true;
      $("#bar").hidden = true;
    }
    const active =
      {
        finance: "overview",
        people: "team",
        planning: "calendar",
        monitoring: "overview",
        continuity: "calendar",
        countries: "projects",
        country: "projects",
        compare: "projects",
        project: "projects",
        brief: "home",
      }[route] || route;
    $(".side")
      .querySelectorAll("a[data-r]")
      .forEach((a) => {
        const selected = a.dataset.r === active;
        a.classList.toggle("on", selected);
        if (selected) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    // Retained budget views share the same financial semantics as the studio.
    view
      .querySelectorAll(".budget-workspace")
      .forEach((root) => root.classList.add("atelier-budget"));
    if (route === "data") {
      if (!view.querySelector(".atelier-data-settings")) {
        const settings = document.createElement("section");
        settings.className = "atelier-data-settings";
        settings.innerHTML =
          title(
            "Display preferences",
            "Your working environment",
            "Palette, motion and saved contexts use device storage.",
          ) + Masterpiece.contextTools();
        view.prepend(settings);
      }
    }
  }
  LedgerHost.importPreview = (p, state) => {
    const changes = [];
    for (const entry of state.entries) {
      const facts = entry.contract?.facts || {};
      if (facts.period?.value) {
        const value = facts.period.value;
        changes.push([
          "Contract start",
          p.contract?.start || p.start,
          value.start,
          entry.file.name,
        ]);
        changes.push([
          "Contract months",
          p.contract?.months,
          value.months,
          entry.file.name,
        ]);
      }
      if (entry.D?.acts?.length)
        changes.push([
          "Plan activities",
          p.doa?.acts?.length || 0,
          entry.D.acts.length,
          entry.file.name,
        ]);
      if (entry.D?.inds?.length)
        changes.push([
          "Indicators",
          p.doa?.inds?.length || 0,
          entry.D.inds.length,
          entry.file.name,
        ]);
      const versions =
        entry.contract?.annex?.versions ||
        (entry.contract?.annex?.lines?.length ? [entry.contract.annex] : []);
      for (const v of versions)
        if (v.validation?.total !== undefined)
          changes.push([
            "Approved budget candidate",
            fmt(p.budget),
            fmt(v.validation.total),
            entry.file.name + " · " + (v.label || "Budget"),
          ]);
    }
    return `<section class="atelier-import-preview"><span class="atelier-eyebrow">03–04 / Recognized candidates and differences</span><p>Match: <b>${h(p.code)} · ${h(p.name)}</b>. Review the source dates and selectable versions below before saving.</p>${changes.length ? `<div class="tw"><table><thead><tr><th>Field</th><th>Current record</th><th>Recognized candidate</th><th>Source</th></tr></thead><tbody>${changes.map(([field, before, after, source]) => `<tr><td>${h(field)}</td><td>${h(before ?? "Not recorded")}</td><td>${h(after ?? "Not established")}</td><td>${h(source)}</td></tr>`).join("")}</tbody></table></div>` : "<p>No structured field differences recognized. Read the extraction notes and retained-file status below.</p>"}<p class="atelier-note">These are reader candidates; selecting plan dates, budget versions and effective dates below determines the changes applied. Counts alone do not establish equivalent content.</p></section>`;
  };
  navigation();
  V.home = home;
  V.overview = finance;
  V.finance = finance;
  V.projects = projects;
  V.intel = intelligence;
  V.team = people;
  V.people = people;
  V.calendar = planning;
  V.planning = planning;
  V.continuity = () => planning("continuity");
  V.sources = sourceCenter;
  V.brief = brief;
  LedgerHost.cleanReviews = cleanLedgerReviews;
  LedgerHost.owns = (route) => coreRoutes.has(route);
  LedgerHost.models = domain.models;
  LedgerHost.scopeRows = (R, scope = {}) => {
    const route = (location.hash || "#/home").split("/")[1],
      selection = Masterpiece.getScope();
    if (route === "project" || scope.c || scope.allProjects) return R;
    return R.filter(
      (r) => selection.project === "all" || r.p.id === selection.project,
    );
  };
  LedgerHost.filtersChanged = (key) => Masterpiece.syncFilters(key);
  LedgerHost.afterRender = afterRender;
  return { domain };
})();
