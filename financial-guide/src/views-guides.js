/* Navigation, home, hubs and the two lifecycle guides (procurement, grants). */
(function () {
  "use strict";
  const { C, esc, euro, slug, ui, route } = { ...FG, route: FG.route };
  const E = window.FG_ENGINES;

  // Sidebar follows the life of a project: plan → commit → pay → report → close, then tools and reference.
  FG.nav = [
    { title: "Workspace", items: [{ title: "Overview", path: "home", icon: "⌂" }, { title: "Decision engines", path: "engines", icon: "◇" }, { title: "Financial analysis", path: "analysis", icon: "⌁" }] },
    { title: "1 · Plan & procure", items: [{ title: "Procurement", path: "procurement", icon: "⚖" }, { title: "Grants", path: "grants", icon: "✦" }] },
    { title: "2 · Commit", items: [{ title: "PO file", path: "po-file", icon: "▤" }, { title: "FOMA workflows", path: "foma", icon: "↹" }] },
    { title: "3 · Pay", items: [{ title: "Payment file", path: "payment-file", icon: "€" }, { title: "Petty cash", path: "petty-cash", icon: "¢" }] },
    { title: "4 · Report & forecast", items: [{ title: "Financial reporting", path: "foma/reports", icon: "▥", section: "foma-reports" }, { title: "Forecast & revision", path: "foma/forecast", icon: "↗", section: "foma-forecast" }] },
    { title: "5 · Close & file", items: [{ title: "Year-end closing", path: "year-end", icon: "◷" }, { title: "Filing & audit", path: "filing", icon: "▦" }] },
    { title: "Learn & reference", items: [{ title: "Scenario practice", path: "scenarios", icon: "◆" }, { title: "Roles & documents", path: "roles", icon: "◎" }, { title: "Links & guidelines", path: "links", icon: "↗" }] },
  ];

  /* ---------- home ---------- */
  const TASKS = [
    ["⚖", "Procure something", "Need, procedure, approvals and documents.", "engines/procurement"],
    ["±", "Revise a forecast or budget", "Assess the change and follow the route.", "engines/budget-revision"],
    ["▤", "Prepare a PO or payment", "File, approvals and payment controls.", "po-file"],
    ["◷", "Close the financial year", "Treatment and closing action.", "engines/year-end"],
    ["✦", "Manage a grant", "Procedure, documents and evaluation.", "grants"],
    ["✈", "Manage a mission or claim", "Authorisation, evidence and reimbursement.", "foma/mission-order"],
    ["▦", "Organise the project file", "Build an audit-ready evidence trail.", "filing"],
    ["▥", "Prepare a financial report", "Reconcile the position and finalise.", "foma/reports"],
  ];
  const MODULES = [
    ["PR", "Procurement", "13-stage lifecycle from need to filing, with thresholds and contract types.", "procurement", "13 stages"],
    ["GR", "Grants", "Procedure, criteria, cost eligibility, evaluation and agreement.", "grants", "12 stages"],
    ["PO", "PO file", "Steps, document package by service type and visa matrix.", "po-file", "5 service types"],
    ["PA", "Payment file", "Delivery, invoice match and finance-ready package.", "payment-file", "9 checkpoints"],
    ["YE", "Year-end closing", "Delivery cut-off, allocation table and closing checklist.", "year-end", "2026"],
    ["FO", "FOMA workflows", "PO and payment requests, missions, claims, reports, forecast.", "foma", "7 workflows"],
    ["DE", "Decision engines", "Route, structure, procedure and readiness in seconds.", "engines", "9 tools"],
    ["FA", "Financial analysis", "Budget vs actual from Excel, country portfolios and continuity.", "analysis", "Excel / CSV"],
    ["SL", "Scenario practice", "48 realistic cases with feedback.", "scenarios", "48 cases"],
  ];
  route("home", {
    section: "home",
    render() {
      const caseItems = FG.case.items(), practice = FG.store.get("scenarioAnswers", {}), answered = Object.keys(practice).length;
      const correct = Object.values(practice).filter((x) => x.ok).length;
      return { html: `
        <div class="hero">
          <section class="card hero-main">
            <div class="eyebrow">Financial & Procurement Guide</div>
            <h1>What do you need to do?</h1>
            <p>Start from the task. Each path leads to the applicable rule, the decision engine for your case and the documents to keep.</p>
            <div class="tasks">${TASKS.map(([i, t, s, p], k) => `<a class="task" style="--tone:var(--c${(k % 6) + 1})" href="#/${p}"><i aria-hidden="true">${i}</i><b>${esc(t)}</b><small>${esc(s)}</small></a>`).join("")}</div>
        <div class="section-title" style="margin-top:24px"><h2>The project finance journey</h2><span class="sub">The order a real case moves in</span></div>
        <ol class="journey">${FG.JOURNEY.map((j, k) => `<li style="--tone:var(--c${(k % 6) + 1})"><a href="#/${j.path}"><em>${k + 1}</em><b>${esc(j.title)}</b><small>${esc(j.sub)}</small></a></li>`).join("")}</ol>
          </section>
          <aside class="stack">
            <section class="card card-pad"><div class="eyebrow">Key thresholds</div>
              <table class="t" style="margin-top:6px"><tbody>
                <tr><td>Direct award · goods / services / works</td><td class="n">≤ ${euro(E.LIMITS.lowGoods)}</td></tr>
                <tr><td>Direct award · intellectual services</td><td class="n">≤ ${euro(E.LIMITS.lowIntellectual)}</td></tr>
                <tr><td>Legal Compliance Review · XB / mixed</td><td class="n">≥ ${euro(E.LIMITS.legalReview)}</td></tr>
                <tr><td>International public call</td><td class="n">≥ ${euro(E.LIMITS.international)}</td></tr>
                <tr><td>Grant competitive call</td><td class="n">≥ ${euro(E.LIMITS.grant)}</td></tr>
                <tr><td>JP Budget Heading variation → Addendum</td><td class="n">&gt; 25%</td></tr>
              </tbody></table></section>
            <section class="card card-pad"><div class="row"><div><div class="eyebrow">My Case</div><b>${caseItems.length ? `${caseItems.length} saved decision${caseItems.length > 1 ? "s" : ""}` : "No saved decisions"}</b></div><span class="spacer"></span><button class="btn sm" data-open-case>Open</button></div>
              ${caseItems[0] ? `<p class="small muted mt">Latest: ${esc(caseItems[0].route)} — ${esc(caseItems[0].kicker.toLowerCase())}</p>` : `<p class="small muted mt">Save engine results to keep your case context across modules.</p>`}</section>
            <section class="card card-pad"><div class="eyebrow">Practice</div><b>${answered ? `${correct} / ${answered} answered correctly` : "48 scenarios to practise"}</b>${ui.bar((answered / C.scenarios.length) * 100, "good")}<a class="btn sm mt" href="#/scenarios">Continue practising</a></section>
          </aside>
        </div>
        <div class="section-title"><h2>Modules</h2><span class="sub">Press Ctrl K anywhere to search</span></div>
        <div class="modules">${MODULES.map(([ic, t, s, p, tag], k) => `<a class="module" style="--tone:var(--c${(k % 6) + 1})" href="#/${p}"><span class="ico" aria-hidden="true">${ic}</span><span><b>${esc(t)}</b><small>${esc(s)}</small>${ui.tag(tag)}</span></a>`).join("")}</div>`,
        mount(root) { root.querySelector("[data-open-case]").onclick = () => FG.openCase(); } };
    },
  });

  /* ---------- lifecycle guide (shared by procurement and grants) ---------- */
  function lifecycle(cfg) {
    const stages = cfg.stages;
    route(cfg.base, { section: cfg.base, crumbs: () => [[cfg.title, cfg.base]], render: () => ({ html: "", mount() { FG.go(`${cfg.base}/${slug(stages[FG.store.get(cfg.base + ":last", 0)].name)}`); } }) });
    route(`${cfg.base}/:stage`, {
      section: cfg.base,
      crumbs: (p) => [[cfg.title, cfg.base], [(stages.find((s) => slug(s.name) === p.stage) || stages[0]).name, `${cfg.base}/${p.stage}`]],
      render(p) {
        let i = stages.findIndex((s) => slug(s.name) === p.stage); if (i < 0) i = 0;
        FG.store.set(cfg.base + ":last", i);
        const s = stages[i], visited = FG.store.get(cfg.base + ":visited", {});
        visited[i] = 1; FG.store.set(cfg.base + ":visited", visited);
        const checks = cfg.checklist(s), best = cfg.bestPractice(s), roles = cfg.roles ? cfg.roles(s) : [];
        const widget = cfg.widgets[s.name] ? cfg.widgets[s.name]() : null;
        const related = (s.links || []).map((l) => cfg.link(l)).filter(Boolean);
        const html = `
          ${ui.head(cfg.eyebrow, cfg.title, cfg.lead, `<a class="btn" href="#/roles">Roles & documents</a>${cfg.engine ? `<a class="btn primary" href="#/${cfg.engine[1]}">${esc(cfg.engine[0])}</a>` : ""}`)}
          <nav class="stepper" aria-label="${esc(cfg.title)} stages">${stages.map((x, j) => `<a class="step ${visited[j] && j !== i ? "done" : ""}" href="#/${cfg.base}/${slug(x.name)}" ${j === i ? 'aria-current="step"' : ""}><em>${j + 1}</em>${esc(x.name)}</a>`).join("")}</nav>
          <div class="split mt">
            <div class="stack">
              <section class="card"><div class="card-body stack">
                <div><div class="eyebrow">Stage ${i + 1} of ${stages.length}${s.source ? ` · ${esc(s.source)}` : ""}</div><h2 style="font-size:20px">${esc(s.title)}</h2><p class="muted mt">${esc(s.lead)}</p></div>
                <div class="uci"><div><small>UNDERSTAND</small>${esc(s.understand)}</div><div><small>DO</small>${esc(s.do)}</div><div><small>CONTROL</small>${esc(s.check)}</div></div>
              </div></section>
              ${widget || ""}
              <section class="card"><div class="card-head"><h3>Detailed guidance</h3><small>${s.sections.length} topics</small></div><div class="card-body accordion">
                ${s.sections.map(([t, body], k) => { const more = cfg.note && cfg.note(t); return `<details ${k === 0 ? "open" : ""}><summary>${esc(t)}</summary><div><p>${esc(body)}</p>${more && more !== body ? `<p class="mt muted">${esc(more)}</p>` : ""}</div></details>`; }).join("")}
              </div></section>
              ${s.warning ? ui.callout("warn", "Watch out", s.warning) : ""}
              ${best ? ui.callout("good", "Best practice", best) : ""}
              <div class="stage-nav">${i > 0 ? `<a class="btn" href="#/${cfg.base}/${slug(stages[i - 1].name)}">← ${esc(stages[i - 1].name)}</a>` : "<span></span>"}${i < stages.length - 1 ? `<a class="btn primary" href="#/${cfg.base}/${slug(stages[i + 1].name)}">${esc(stages[i + 1].name)} →</a>` : ""}</div>
            </div>
            <aside class="stack sticky">
              ${checks.length ? ui.checklist(`${cfg.base}:${s.name}`, checks, "Stage checklist") : ""}
              ${roles.length ? `<section class="card"><div class="card-head"><h3>Who is involved</h3></div><div class="card-body stack">${roles.map((r) => `<div><b>${esc(r.name)}</b> ${ui.tag(r.tag, "accent")}<p class="small muted">${esc(r.summary)}</p></div>`).join("")}</div></section>` : ""}
              ${related.length ? `<section class="card"><div class="card-head"><h3>Related</h3></div><div class="card-body row">${related.map(([t, p]) => `<a class="btn sm" href="#/${p}">${esc(t)}</a>`).join("")}</div></section>` : ""}
              ${cfg.practice ? `<a class="btn" href="#/scenarios?cat=${cfg.practice}">Practise this topic →</a>` : ""}
            </aside>
          </div>`;
        return { html, mount: widget && cfg.mount && cfg.mount[s.name] };
      },
    });
    stages.forEach((s) => FG.addIndex(s.title, `${cfg.title} · stage: ${s.name}`, `${cfg.base}/${slug(s.name)}`, cfg.title, `${s.lead} ${s.understand} ${s.do} ${s.check} ${s.sections.map((x) => x.join(" ")).join(" ")}`));
  }

  /* ---------- procurement widgets ---------- */
  const CONTRACT_ROWS = [
    ["One-off Contract", "Fixed need", "Clearly defined and quantifiable need; not expected to recur.", "One supplier (lots may be awarded separately)", "Direct contract; no additional competition after signature", "Until obligations are completed; no renewal", "Avoid repeated one-off contracts — consolidate foreseeable recurring needs."],
    ["Framework Contract", "Recurring · defined units", "Recurring need with definable units; total volume may remain uncertain.", "One or several suppliers", "Order forms; ranking or pooling fixed in advance when several suppliers are used", "Generally up to 4 years (5 only exceptionally)", "Control cumulative use; orders stay within framework scope and items."],
    ["Framework Agreement", "Variable / complex recurring need", "Regular but less predictable need; precise deliverables not known upfront.", "Multiple preselected suppliers (pool)", "Mini-competition for each call-off", "Generally up to 4 years (5 only exceptionally)", "Use only where the extra administration adds value; rarely recommended below €184,000."],
  ];
  function contractMatrix() {
    return `<section class="card"><div class="card-head"><div><h3>Contract type matrix</h3><small>Contract type ≠ procurement procedure. Choose the structure here, then determine the procedure from the thresholds.</small></div><a class="btn sm" href="#/engines/contract-strategy">Contract Strategy engine</a></div>
      <div class="card-body"><div class="table-wrap"><table class="t"><thead><tr><th>Type</th><th>Best fit</th><th>Suppliers</th><th>Ordering / competition</th><th>Duration</th><th>Key control</th></tr></thead><tbody>
      ${CONTRACT_ROWS.map((r) => `<tr><td><b>${esc(r[0])}</b><small>${esc(r[1])}</small></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td><td>${esc(r[6])}</td></tr>`).join("")}
      </tbody></table></div></div></section>`;
  }
  function thresholdMatrix() {
    const st = FG.store.get("selector", { amount: "", type: "general", funding: "ordinary" });
    const routes = C.thresholdRoutes;
    return `<section class="card"><div class="card-head"><div><h3>Threshold matrix</h3><small>Total foreseeable value of the need, excluding VAT, over the full period of reference.</small></div></div>
      <div class="card-body stack"><div class="table-wrap"><table class="t"><thead><tr><th>Value</th><th>Procedure</th><th>When to use it</th><th>Key control</th></tr></thead><tbody>
        <tr><td><b>≤ €2,000</b><small>Goods · general services · works</small><b>≤ €6,000</b><small>Intellectual services</small></td><td><b>Direct Award</b></td><td>Low-value, clearly defined need. Competition is not required solely because of value, provided the direct-award conditions are met.</td><td>Document the need, price / value-for-money basis and keep the procurement file.</td></tr>
        <tr><td><b>&gt; low-value limit and &lt; €184,000</b></td><td><b>Competitive Bidding</b></td><td>Default route above the direct-award limit. Invite at least three potential suppliers where applicable.</td><td>Assess the whole foreseeable need; never split purchases to stay below a threshold.</td></tr>
        <tr><td><b>≥ €184,000</b><small>Total foreseeable need</small></td><td><b>International Public Call</b></td><td>Estimated need reaches the international threshold. Plan the longer publication, evaluation and approval route.</td><td>International tender route and Tenders Board controls.</td></tr>
      </tbody></table></div>
      <div class="grid g2">${ui.callout("info", "Special option · buying at public prices below €10,000", "Within competitive bidding, publicly available prices from three or more suppliers may be compared instead of issuing invitations, where the conditions are met and screenshots are archived.")}
      ${ui.callout("warn", "Additional control · XB / mixed funding €55,000 to < €184,000", "Legal Compliance Review is required before CCM approval. It does not replace the procurement procedure; it is an additional validation step.")}</div>
      <form class="card card-pad" data-selector style="box-shadow:none;background:var(--panel-2)"><div class="eyebrow">Quick procedure check</div><div class="grid g3 mt">
        ${ui.number("amount", st.amount, "Estimated value (€, excl. VAT)")}
        ${ui.select("type", [["general", "Goods / general services / works"], ["intellectual", "Intellectual services"]], st.type, "Purchase type")}
        ${ui.select("funding", [["ordinary", "Ordinary Budget"], ["xb", "Extrabudgetary / mixed"]], st.funding, "Funding")}
      </div><div id="selectorOut" class="mt"></div></form>
      <div class="grid g3">${Object.values(routes).map((r) => `<details class="card card-pad" style="box-shadow:none"><summary style="cursor:pointer"><div class="eyebrow">${esc(r.k)}</div><b>${esc(r.title)}</b><p class="small muted">${esc(r.desc)}</p></summary>
        <div class="mt small"><div class="row">${ui.tag(r.authority, "accent")}${ui.tag(r.validation)}${ui.tag("Digital: " + r.digital)}</div>
        <ol class="mt">${r.steps.map((s) => `<li><b>${esc(s[0])}</b> — ${esc(s[1])}</li>`).join("")}</ol>
        <p class="mt"><b>Documents</b></p><ul>${r.docs.map((d) => `<li>${esc(d[0])}: <span class="muted">${esc(d[1])}</span></li>`).join("")}</ul></div></details>`).join("")}</div>
      </div></section>`;
  }
  function mountSelector(root) {
    const form = root.querySelector("[data-selector]");
    const run = () => {
      const v = Object.fromEntries(new FormData(form));
      FG.store.set("selector", v);
      const out = root.querySelector("#selectorOut");
      if (!Number(v.amount)) { out.innerHTML = `<p class="small muted">Enter the estimated value to see the route.</p>`; return; }
      const r = E.procurement({ amount: v.amount, type: v.type, funding: v.funding });
      out.innerHTML = ui.callout(r.tone === "good" ? "good" : "warn", r.route, `${r.kpis[2][1]}. ${r.flags[r.flags.length - 1][0]}. `) + `<a class="btn sm mt" href="#/engines/procurement">Open the full Procurement Route engine →</a>`;
    };
    form.addEventListener("input", run); form.addEventListener("submit", (e) => e.preventDefault()); run();
  }
  function tenderDesign() {
    const i = FG.store.get("tender:i", 0), s = C.tenderDesign[i];
    const list = (title, items) => items && items.length ? `<div><small>${esc(title)}</small><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    return `<section class="card"><div class="card-head"><h3>Tender design workflow</h3><small>Step ${i + 1} of ${C.tenderDesign.length}</small></div><div class="card-body stack">
      ${ui.flowHeader(C.tenderDesign, i, (x, j) => `<small>STEP ${j + 1}</small><b>${esc(x.short)}</b><span>${esc(x.micro)}</span>`)}
      <div><h3 style="font-size:16px">${esc(s.title)}</h3><p class="muted">${esc(s.lead)}</p></div>
      <div class="detail-grid">${list("Actions", s.actions)}${list("Controls", s.control)}${s.output ? `<div><small>Output</small>${esc(Array.isArray(s.output) ? s.output.join(", ") : s.output)}</div>` : ""}${s.mistakes || s.avoid ? list("Avoid", s.mistakes || s.avoid) : ""}</div>
    </div></section>`;
  }
  function mountFlow(key) {
    return (root) => root.addEventListener("click", (e) => { const b = e.target.closest("[data-flow]"); if (b) { FG.store.set(key, +b.dataset.flow); FG.refresh(); } });
  }

  const stageLinkMap = { "Threshold Matrix": "procurement/thresholds-and-procedure", "Risk & Controls": "roles", "Special Cases": "procurement/launch-and-publication", "VAT Procedures": "links", "How to Prepare a Payment File": "payment-file", "Filing Management": "filing", "Useful Links & Guidelines": "links" };
  lifecycle({
    base: "procurement", title: "Procurement", eyebrow: "Procurement · lifecycle guide",
    lead: "From defining the need through tendering, award, contract execution, payment and close-out, following the Council of Europe Procurement Guide.",
    stages: C.procurementStages, engine: ["Procurement Route engine", "engines/procurement"], practice: "procurement",
    checklist: (s) => C.procurementChecklists[s.name] || [],
    bestPractice: (s) => C.procurementBestPractice[s.name],
    roles: (s) => Object.values(C.procurementRoles).filter((r) => (r.stages || []).includes(s.name)),
    link: (l) => { const st = C.procurementStages.find((x) => x.name === l); return st ? [l, `procurement/${slug(l)}`] : stageLinkMap[l] ? [l, stageLinkMap[l]] : null; },
    widgets: { "Contract Types": contractMatrix, "Thresholds & Procedure": thresholdMatrix, "Tender Design": tenderDesign },
    mount: { "Thresholds & Procedure": mountSelector, "Tender Design": mountFlow("tender:i") },
  });

  /* ---------- grant widgets ---------- */
  function grantProcedureWidget() {
    const amount = FG.store.get("grantQuick", 18000), r = E.grantProcedure({ amount });
    return `<section class="card"><div class="card-head"><div><h3>Procedure route</h3><small>The €15,000 threshold applies to the total grant-award procedure budget, not to each grantee.</small></div><a class="btn sm" href="#/engines/grant-procedure">Full engine</a></div><div class="card-body grid g2">
      ${ui.number("grantQuick", amount, "Total procedure budget (€)")}
      <div>${ui.callout(r.tone === "good" ? "good" : "warn", r.route, `Template: ${r.kpis[2][1]}. ${amount >= 15000 ? "Direct award at or above €15,000 is possible only under strictly interpreted exceptions (G9.2B)." : "Below the threshold: direct award (G9.2A)."}`)}</div></div></section>`;
  }
  function grantCostsWidget() {
    const st = FG.store.get("grantCost", { necessary: 1, period: 1, budgeted: 1, verifiable: 1 }), r = E.grantCost(st);
    const cat = FG.store.get("grantCat", "staff"), c = C.grantCostCategories[cat];
    const labels = { staff: "Staff", travel: "Travel", equipment: "Equipment", indirect: "Indirect costs", renovation: "Renovation", land: "Land / buildings", fx: "Exchange losses", other: "Other" };
    return `<section class="card"><div class="card-head"><div><h3>Cost eligibility test</h3><small>Run before commitment and again before payment. Agreement and donor conditions still apply.</small></div></div><div class="card-body grid g2">
      <div class="checklist" data-costs>${r.tests.map(([k, t, d]) => `<label class="check ${st[k] ? "done" : ""}"><input type="checkbox" data-k="${k}" ${st[k] ? "checked" : ""}><div><b>${esc(t)}</b><small>${esc(d)}</small></div></label>`).join("")}${ui.callout(r.ok ? "good" : "risk", r.title, r.text)}</div>
      <div class="stack"><div class="chips" data-cats>${Object.keys(labels).map((k) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${k === cat}">${labels[k]}</button>`).join("")}</div>
        <div class="card card-pad" style="box-shadow:none">${ui.tag(c[0], /^Ineligible/.test(c[0]) ? "risk" : /Conditional|only/.test(c[0]) ? "warn" : "good")}<p class="mt">${esc(c[1])}</p></div></div>
    </div></section>`;
  }
  lifecycle({
    base: "grants", title: "Grants", eyebrow: "Grants · lifecycle & decision support",
    lead: "Confirm the grant route, choose the procedure, prepare the call and evaluation, formalise the agreement and keep implementation audit-ready (Rule 1374).",
    stages: C.grantStages, engine: ["Grant Procedure engine", "engines/grant-procedure"], practice: "grant",
    checklist: (s) => C.grantChecklists[s.name] || [],
    bestPractice: (s) => C.grantBestPractice[Object.keys(C.grantBestPractice).find((k) => k === s.name || k.startsWith(s.name + " "))],
    note: (t) => C.grantNotes[t] || C.grantNotes[Object.keys(C.grantNotes).find((k) => k.toLowerCase().startsWith(t.toLowerCase()))],
    link: () => null,
    widgets: { Procedure: grantProcedureWidget, Costs: grantCostsWidget },
    mount: {
      Procedure: (root) => root.querySelector("[name=grantQuick]").addEventListener("change", (e) => { FG.store.set("grantQuick", Number(e.target.value) || 0); FG.refresh(); }),
      Costs: (root) => {
        root.querySelector("[data-costs]").addEventListener("change", (e) => { const st = FG.store.get("grantCost", { necessary: 1, period: 1, budgeted: 1, verifiable: 1 }); st[e.target.dataset.k] = e.target.checked ? 1 : 0; FG.store.set("grantCost", st); FG.refresh(); });
        root.querySelector("[data-cats]").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (b) { FG.store.set("grantCat", b.dataset.cat); FG.refresh(); } });
      },
    },
  });

  /* ---------- roles & documents ---------- */
  route("roles", {
    crumbs: () => [["Roles & documents", "roles"]],
    render() {
      const ctx = C.moduleContexts, dir = C.procurementRoles;
      const pick = FG.store.get("roles:ctx", "procurement"), m = ctx[pick];
      return { html: `${ui.head("Reference", "Roles & documents", "Who does what, and which evidence each module expects in the file.")}
        <div class="chips" data-ctx>${Object.entries(ctx).map(([k, v]) => `<button class="chip" data-k="${k}" aria-pressed="${k === pick}">${esc(v.label)}</button>`).join("")}</div>
        <div class="grid g2 mt">
          <section class="card"><div class="card-head"><h3>Who does what · ${esc(m.label)}</h3></div><div class="card-body stack">${m.roles.map(([r, d]) => `<div><b>${esc(r)}</b><p class="small muted">${esc(d)}</p></div>`).join("")}</div></section>
          <section class="card"><div class="card-head"><h3>Documents & evidence · ${esc(m.label)}</h3></div><div class="card-body stack">${m.docs.map(([r, d]) => `<div><b>${esc(r)}</b><p class="small muted">${esc(d)}</p></div>`).join("")}</div></section>
        </div>
        <div class="section-title"><h2>Procurement role directory</h2></div>
        <div class="grid g2">${Object.values(dir).map((r) => `<section class="card card-pad"><div class="row"><b>${esc(r.name)}</b>${ui.tag(r.tag, "accent")}</div><p class="small muted mt">${esc(r.summary)}</p>
          <p class="small mt"><b>When:</b> ${esc(r.when)}</p><ul class="small mt">${r.does.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
          <p class="small mt muted">Receives from: ${esc(r.receives)} · Hands to: ${esc(r.hands)}</p><div class="row mt">${(r.stages || []).map((s) => `<a class="tag" href="#/procurement/${slug(s)}">${esc(s)}</a>`).join("")}</div></section>`).join("")}</div>`,
        mount(root) { root.querySelector("[data-ctx]").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) { FG.store.set("roles:ctx", b.dataset.k); FG.refresh(); } }); } };
    },
  });
  Object.values(C.procurementRoles).forEach((r) => FG.addIndex(r.name, `Role · ${r.summary}`, "roles", "Role", r.does.join(" ")));

  /* ---------- links ---------- */
  route("links", {
    crumbs: () => [["Links & guidelines", "links"]],
    render() {
      const cat = FG.store.get("links:cat", "All"), q = FG.store.get("links:q", "");
      const cats = ["All", ...new Set(C.usefulLinks.map((l) => l.cat))];
      const list = C.usefulLinks.filter((l) => (cat === "All" || l.cat === cat) && (!q || `${l.title} ${l.desc} ${l.use}`.toLowerCase().includes(q.toLowerCase())));
      return { html: `${ui.head("Reference", "Links & guidelines", "Guidance, templates and internal tools project teams use most often.")}
        <div class="row"><div class="chips" data-cat>${cats.map((c) => `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join("")}</div><span class="spacer"></span><input class="input" style="max-width:280px" type="search" placeholder="Filter resources" aria-label="Filter resources" value="${esc(q)}" data-q></div>
        <div class="tiles mt">${list.map((l) => `<div class="tile"><div class="row"><b>${esc(l.title)}</b><span class="spacer"></span>${ui.tag(l.cat)}</div><small>${esc(l.desc)}</small><small><b>Use for:</b> ${esc(l.use)}</small>${l.url ? `<a class="btn sm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>` : `<span class="tag warn">Link to be connected</span>`}</div>`).join("") || `<div class="empty"><b>No resources match</b>Clear the filter to see all ${C.usefulLinks.length} resources.</div>`}</div>`,
        mount(root) {
          root.querySelector("[data-cat]").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b) { FG.store.set("links:cat", b.dataset.c); FG.refresh(); } });
          const qi = root.querySelector("[data-q]"); qi.addEventListener("input", () => { FG.store.set("links:q", qi.value); FG.refresh(); root.ownerDocument.querySelector("[data-q]").focus(); const n = root.ownerDocument.querySelector("[data-q]"); n.setSelectionRange(n.value.length, n.value.length); });
        } };
    },
  });
  C.usefulLinks.forEach((l) => FG.addIndex(l.title, `${l.cat} · ${l.desc}`, "links", "Link", l.use));
  MODULES.forEach(([, t, s, p]) => FG.addIndex(t, s, p, "Module"));
  TASKS.forEach(([, t, s, p]) => FG.addIndex(`I need to ${t.toLowerCase()}`, s, p, "Task"));
})();
