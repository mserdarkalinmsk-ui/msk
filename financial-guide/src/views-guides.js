/* Navigation, home, hubs and the two lifecycle guides (procurement, grants). */
(function () {
  "use strict";
  const { C, esc, euro, slug, ui, route } = { ...FG, route: FG.route };
  const E = window.FG_ENGINES;

  // Sidebar follows the life of a project: plan → commit → pay → report → close, then tools and reference.
  // Same top-level structure as the original guide: Projects, FOMA, Tools, Decision Engines.
  FG.nav = [
    { title: "Start", items: [{ title: "Home", path: "home", icon: "⌂" }] },
    { title: "Projects · Project Team", items: [
      { title: "Projects overview", path: "projects", icon: "▤" },
      { title: "Procurement", path: "procurement", icon: "⚖" }, { title: "Grants", path: "grants", icon: "✦" },
      { title: "PO file", path: "po-file", icon: "↔" }, { title: "Payment file", path: "payment-file", icon: "€" },
      { title: "End of year", path: "year-end", icon: "◷" }, { title: "Petty cash", path: "petty-cash", icon: "¢" },
      { title: "VAT procedures", path: "vat", icon: "%" }, { title: "Events & GDD", path: "events", icon: "◈" },
      { title: "Filing management", path: "filing", icon: "▦" }, { title: "Useful links", path: "links", icon: "↗" } ] },
    { title: "FOMA · Field operations", items: [
      { title: "FOMA overview", path: "foma", icon: "▦" },
      { title: "PO request", path: "foma/po-request", icon: "🧾", section: "foma-po" }, { title: "Payment request", path: "foma/payment-request", icon: "💳", section: "foma-pay" },
      { title: "Mission order", path: "foma/mission-order", icon: "✈", section: "foma-mission" }, { title: "Expense claim", path: "foma/expense-claim", icon: "◎", section: "foma-claim" },
      { title: "Financial reports", path: "foma/reports", icon: "▥", section: "foma-reports" }, { title: "Forecast", path: "foma/forecast", icon: "↗", section: "foma-forecast" } ] },
    { title: "Tools", items: [{ title: "Tools & templates", path: "tools", icon: "▣" }, { title: "Rules at a glance", path: "rules", icon: "§" }, { title: "Glossary", path: "glossary", icon: "Aa" }, { title: "Scenario practice", path: "scenarios", icon: "◆" }, { title: "Roles & documents", path: "roles", icon: "◎" }] },
    { title: "Decision Engines", items: [{ title: "All engines", path: "engines", icon: "◇" }] },
  ];
  const HUBS = [
    ["01 / Project finance", "PROJECTS", "Project Team", "Procurement, grants, PO and payment files, year-end, petty cash and filing.", "projects", 1, "▤"],
    ["02 / Field operations", "FOMA", "Field offices", "PO and payment requests, missions, expense claims, reports and forecast.", "foma", 2, "▦"],
    ["03 / Practical resources", "TOOLS", "Templates & checklists", "Documents, checklists, calculators, rules, glossary and practice.", "tools", 3, "▣"],
    ["04 / Smart guidance", "DECISION ENGINES", "Your case → route", "Answer a few questions and get the route, controls and file pack.", "engines", 4, "◇"],
  ];
  const PROJECT_ITEMS = [
    ["⚖", "Procurement", "Tendering, thresholds, contracts, evaluation, award and contract execution.", "procurement"],
    ["✦", "Grant", "Grant procedures, calls, evaluation and agreement preparation.", "grants"],
    ["↔", "PO & payment files", "Prepare the PO, continue through delivery and complete the payment package.", "po-file"],
    ["◷", "End of year procedure", "Year-end closure, commitments, reporting and clean-up.", "year-end"],
    ["€", "Petty cash", "Petty cash rules, reconciliation and supporting evidence.", "petty-cash"],
    ["▤", "Filing management", "Evidence maps, DMS structure, naming and audit-ready filing.", "filing"],
    ["↗", "Useful links & guidelines", "Compact access to systems, controlled templates and guidance.", "links"],
    ["◈", "Events & GDD", "Event-related finance, logistics and GDD support.", "events"],
    ["%", "VAT procedures", "VAT checks, exemptions, supporting documents and follow-up.", "vat"],
  ];
  // Projects: the financial life cycle as three phases (commit → spend → close) with their modules.
  const PHASES = [
    ["01", "Commit", "Select the procedure and sign", 1, [["Procurement", "Thresholds, tender, evaluation and contract.", "procurement", "CORE"], ["Grant", "Call, criteria, evaluation and agreement.", "grants"]]],
    ["02", "Spend", "Order, receive and pay", 2, [["PO & payment files", "PO, delivery and payment package.", "po-file", "CORE"], ["Petty cash", "Limits, approval and reconciliation.", "petty-cash"], ["VAT procedures", "Exemptions and supporting documents.", "vat"], ["Events & GDD", "Event budget, logistics and GDD.", "events"]]],
    ["03", "Close", "Year-end and audit trail", 3, [["End of year", "Cut-off, allocation and closing checklist.", "year-end", "DEADLINE"], ["Filing management", "Evidence map, DMS and naming.", "filing"]]],
  ];
  route("projects", {
    crumbs: () => [["Projects", "projects"]],
    render: () => {
      const L = E.LIMITS;
      const lifecycle = { procurement: C.procurementStages.length, grants: C.grantStages.length };
      const done = (base) => Object.keys(FG.store.get(base + ":visited", {})).length;
      const pct = (base) => lifecycle[base] ? Math.round((done(base) / lifecycle[base]) * 100) : null;
      const steps = lifecycle.procurement + lifecycle.grants, completed = Math.round(((done("procurement") + done("grants")) / steps) * 100);
      const modules = PHASES.reduce((n, ph) => n + ph[4].length, 0);
      const card = ([t, d, p, badge], c) => { const v = pct(p); return `<a class="pj-mod${badge ? " key" : ""}" style="--c:var(--c${c})" href="#/${p}">
        <span class="pj-r"><b>${esc(t)}</b>${badge ? `<span class="pj-badge">${badge}</span>` : lifecycle[p] ? `<em>${lifecycle[p]} steps</em>` : ""}</span>
        <small>${esc(d)}</small>${v !== null ? `<span class="pj-bar" title="${v}% of steps opened"><i style="width:${v}%"></i></span>` : ""}</a>`; };
      const rules = [[L.lowGoods, "Direct award · goods & services"], [L.lowIntellectual, "Direct award · intellectual services"], [L.legalReview, "E-procurement · legal review (XB)"], [L.international, "International public call"]];
      return { html: `<header class="pj-head"><div>${FG.ui.head("01 / Project finance · Project Team", "Projects", "The financial life cycle of a project, from commitment to closure. Select a module to open its procedure, controls and documents.")}</div>
        <div class="pj-kpis"><div><small>MODULES</small><b>${modules}</b></div><div><small>PROCEDURE STEPS</small><b>${steps}</b></div><div><small>STEPS OPENED</small><b>${completed}%</b></div></div></header>
        <div class="pj-chev">${PHASES.map(([n, t, sub, c]) => `<div style="--c:var(--c${c})"><small>PHASE ${n}</small><b>${t}</b><span>${sub}</span></div>`).join("")}</div>
        <div class="pj-cols">${PHASES.map(([, , , c, mods]) => `<div class="pj-col${mods.length > 2 ? " two" : ""}">${mods.map((m) => card(m, c)).join("")}</div>`).join("")}
          <div class="pj-flow">CONTRACT SIGNED<i></i>PO RAISED → RECEIVED → INVOICE PAID<i></i>BOOKS CLOSED · FILE ARCHIVED</div></div>
        <div class="pj-bottom"><section class="pj-box"><h3>KEY THRESHOLDS · PROCUREMENT</h3><div class="pj-rules">${rules.map(([v, t]) => `<a href="#/rules"><b>${euro(v)}</b><span>${t}</span></a>`).join("")}</div></section>
          <section class="pj-box pj-links"><h3>RESOURCES</h3><a href="#/links">Useful links & guidelines →</a><a href="#/roles">Roles & documents →</a><a href="#/glossary">Glossary →</a></section></div>` };
    },
  });
  route("tools", {
    crumbs: () => [["Tools", "tools"]],
    render: () => {
      const groups = [
        ["Templates & documents", [["Roles & documents", "Who does what and which evidence each module expects.", "roles"], ["PO document builder", "Signed and supporting documents by service type.", "po-file"], ["Payment file builder", "Finance-ready payment package.", "payment-file"], ["Filing & DMS structure", "Evidence map and audit documents.", "filing"], ["Useful links & templates", "Manuals, templates and internal systems.", "links"]]],
        ["Checklists", [["Payment readiness", "Pre-flight check before sending the file.", "engines/payment-readiness"], ["Audit readiness", "Decision trail, approvals and evidence.", "engines/audit-readiness"], ["Year-end checklist", "2026 project-team closing list.", "year-end"], ["Petty cash check", "Limit and pre-spend approval.", "petty-cash"], ["Grant cost eligibility", "Core cost test before commitment.", "grants/costs"]]],
        ["Calculators", [["Procedure decision tree", "Value, type and funding → procedure.", "rules"], ["What-if simulator", "Budget Heading change → route.", "engines/what-if"], ["Which financial year?", "2026 allocation table.", "year-end"]]],
        ["Learn", [["Rules at a glance", "Every threshold with its source.", "rules"], ["Glossary", "Terms and abbreviations.", "glossary"], ["Scenario practice", "48 cases with feedback.", "scenarios"]]],
      ];
      return { html: `${FG.ui.head("03 / Practical resources", "Tools", "Templates, checklists, calculators and practical resources.")}
        ${groups.map(([g, items], k) => `<div class="section-title"><h2>${esc(g)}</h2></div><div class="modules">${items.map(([t, d, p]) => `<a class="module" style="--tone:var(--c${k + 1})" href="#/${p}"><span class="ico" aria-hidden="true">${esc(t[0])}</span><span><b>${esc(t)}</b><small>${esc(d)}</small></span></a>`).join("")}</div>`).join("")}` };
    },
  });


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
    ["SL", "Scenario practice", "48 realistic cases with feedback.", "scenarios", "48 cases"],
  ];
  route("home", {
    section: "home",
    render() {
      const modules = FG.routes.length, engines = FG.index.filter((x) => x.kind === "Engine").length;
      const meters = [90, 70, 80, 100], counts = ["09 modules", "06 workflows", "20+ tools", `${String(engines).padStart(2, "0")} engines`];
      return { html: `
        <section class="fx-hero">
          <span class="fx-status"><b aria-hidden="true"></b>Guide online · ${modules} pages · ${engines} engines</span>
          <h1>Guidance. Decisions.<br><span>Templates. One place.</span></h1>
          <p>Choose your space. Every path ends with the applicable rule, the route for your case and the documents to keep.</p>
        </section>
        <section class="fx-hubs">${HUBS.map(([k, t, sub, d, p, c, ic], i) => `<a class="fx-hub" style="--c:var(--c${c});animation-delay:${i * 0.08}s" href="#/${p}">
          <span class="fx-num">${esc(k)}</span><span class="fx-ico" aria-hidden="true">${ic}</span><h2>${esc(t)}</h2><em>// ${esc(sub.toLowerCase())}</em><p>${esc(d)}</p>
          <div class="fx-meter"><i style="--w:${meters[i]}%"></i></div><div class="fx-bar"><span>${counts[i].toUpperCase()}</span><u aria-hidden="true">→</u></div></a>`).join("")}</section>`,
        mount(root) {
          // Cards tilt toward the pointer; skipped when the user prefers reduced motion.
          if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          root.querySelectorAll(".fx-hub").forEach((h) => {
            h.addEventListener("mousemove", (e) => { const r = h.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; h.style.transform = `translateY(-8px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`; });
            h.addEventListener("mouseleave", () => { h.style.transform = ""; });
          });
        } };
    },
  });

  /* ---------- guided reader: numbered steps, one focused panel, read tracking ---------- */
  // Sentences are typed so obligations stand out: "must / mandatory / never" → rule, "recommended / good practice" → tip.
  const sentenceKind = (x) => (/\b(must|mandatory|required|never|may not|cannot|shall|prohibited|only if)\b/i.test(x) ? "rule" : /\b(recommend|good practice|best practice|advis|should|useful)\w*/i.test(x) ? "tip" : "");
  // Sentence split that respects abbreviations (e.g., i.e., Art., No., Ch., etc.) and numbered references (4.9.2).
  const ABBR = /\b(e\.g|i\.e|etc|No|Nos|Art|Arts|Ch|Chap|para|paras|p|pp|vs|cf|incl|excl|approx|min|max|Mr|Ms|Dr|St|Co|Ltd|[A-Z])\.$/;
  const splitSentences = (t) => String(t).replace(/([.!?])\s+(?=[A-Z€“"(])/g, "$1\u0001").split("\u0001").filter(Boolean).reduce((out, x) => { if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += " " + x; else out.push(x); return out; }, []);
  // Plain text of a section (structured or legacy prose) for search.
  const sectionText = (b) => (typeof b === "string" ? b : [b.lead, ...(b.items || []).map((x) => x.join(" ")), ...(b.must || []), b.tip].filter(Boolean).join(" "));
  // A section reads as: one lead idea → named items (numbered when ordered) → obligations → good practice.
  function sectionHtml(b) {
    if (typeof b === "string") {
      const parts = splitSentences(b), lead = parts.shift() || "", rules = parts.filter((x) => sentenceKind(x) === "rule"), rest = parts.filter((x) => sentenceKind(x) !== "rule");
      b = { lead, items: [], must: rules, body: rest.join(" ") };
    }
    const items = b.items || [];
    return `<p class="rd-lead">${esc(b.lead)}</p>${b.body ? `<p>${esc(b.body)}</p>` : ""}
      ${items.length ? `<div class="rd-items ${b.ordered ? "ordered" : ""}" style="--n:${items.length}"><small>${items.length} ${b.ordered ? "steps" : "points"}</small><ol>${items.map(([t, d], k) => `<li><span>${b.ordered ? k + 1 : esc(String(t).match(/^[a-z]\)/i) ? String(t).slice(0, 1) : k + 1)}</span><div><b>${esc(String(t).replace(/^[a-z]\)\s*/i, ""))}</b><p>${esc(d)}</p></div></li>`).join("")}</ol></div>` : ""}
      ${(b.must || []).length ? `<div class="rd-rules"><small>Rules to follow</small><ul>${b.must.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${b.tip ? `<div class="rd-tipbox"><small>Good practice</small><p>${esc(b.tip)}</p></div>` : ""}`;
  }
  function reader(key, sections) {
    const read = FG.store.get("read:" + key, {}), n = sections.length, done = sections.filter((_, k) => read[k]).length;
    const icon = { rule: "!", tip: "★" }, label = { rule: "Rule", tip: "Tip" };
    return `<div class="rd" data-rd="${esc(key)}">
      <div class="rd-side"><div class="rd-prog"><span><b data-rd-count>${done}</b> of ${n} read</span><i><u data-rd-bar style="width:${Math.round((done / n) * 100)}%"></u></i></div>
        <ol class="rd-nav" role="tablist">${sections.map(([t], k) => `<li><button type="button" role="tab" data-rd-go="${k}" aria-selected="${k === 0}" class="${read[k] ? "read" : ""}"><em>${read[k] ? "✓" : k + 1}</em><span>${esc(t)}</span></button></li>`).join("")}</ol></div>
      <div class="rd-stage">${sections.map(([t, body], k) => `<article class="rd-panel" data-rd-panel="${k}" ${k ? "hidden" : ""} role="tabpanel">
        <header><small>Step ${k + 1} of ${n}</small><h3>${esc(t)}</h3></header>
        <div class="rd-text">${sectionHtml(body)}</div>
        <footer>${k ? `<button type="button" class="btn sm ghost" data-rd-go="${k - 1}">← Previous</button>` : "<span></span>"}<button type="button" class="btn sm primary" data-rd-next="${k}">${k < n - 1 ? "Got it · next →" : "Got it ✓"}</button></footer></article>`).join("")}</div></div>`;
  }
  // Switches panels in place (no re-render), so the page never jumps.
  function mountReader(root) {
    root.querySelectorAll("[data-rd]").forEach((rd) => {
      const key = "read:" + rd.dataset.rd, n = rd.querySelectorAll("[data-rd-panel]").length;
      const show = (k) => {
        rd.querySelectorAll("[data-rd-panel]").forEach((p) => { p.hidden = +p.dataset.rdPanel !== k; });
        rd.querySelectorAll(".rd-nav [data-rd-go]").forEach((b) => b.setAttribute("aria-selected", +b.dataset.rdGo === k));
      };
      const mark = (k) => {
        const read = FG.store.get(key, {}); read[k] = 1; FG.store.set(key, read);
        const b = rd.querySelector(`.rd-nav [data-rd-go="${k}"]`); b.classList.add("read"); b.querySelector("em").textContent = "✓";
        const done = Object.keys(read).length; rd.querySelector("[data-rd-count]").textContent = done; rd.querySelector("[data-rd-bar]").style.width = `${Math.round((done / n) * 100)}%`;
      };
      rd.addEventListener("click", (e) => {
        const go = e.target.closest("[data-rd-go]"), next = e.target.closest("[data-rd-next]");
        if (go) show(+go.dataset.rdGo);
        if (next) { const k = +next.dataset.rdNext; mark(k); if (k < n - 1) show(k + 1); }
      });
      rd.addEventListener("keydown", (e) => {
        if (!e.target.closest(".rd-nav") || !/Arrow(Up|Down)/.test(e.key)) return;
        e.preventDefault(); const cur = +rd.querySelector('.rd-nav [aria-selected="true"]').dataset.rdGo, k = Math.max(0, Math.min(n - 1, cur + (e.key === "ArrowDown" ? 1 : -1)));
        show(k); rd.querySelector(`.rd-nav [data-rd-go="${k}"]`).focus();
      });
    });
  }

  /* ---------- fact details: everything the guide says about a key figure ---------- */
  const factTokens = (v) => { const t = String(v).match(/€?\d[\d,.]*\s?(%|h|days?|weeks?|months?|years?|points?|working days)?|G\d+(\.\d+)?[A-Z]?|Art\.\s?[\d.]+|Rule No\. \d+|MSA \d+/gi) || []; return t.map((x) => x.trim()).filter((x) => x.length > 1 || /\d/.test(x)); };
  function factSheet(btn) {
    const base = btn.dataset.base, v = btn.dataset.fact, label = btn.dataset.factLabel, stages = base === "procurement" ? C.procurementStages : C.grantStages;
    const R = base === "procurement" ? C.procurementReference : C.grantReference;
    const toks = factTokens(v), main = toks[0] || v, hits = [];
    const has = (t) => toks.some((k) => t.includes(k)) || t.includes(v);
    stages.forEach((st) => st.sections.forEach(([h, b]) => {
      const pieces = typeof b === "string" ? splitSentences(b) : [b.lead, ...(b.items || []).map(([a, d]) => `${a}: ${d}`), ...(b.must || []), b.tip].filter(Boolean);
      pieces.forEach((x) => { if (has(x)) hits.push([st.name, h, x]); });
    }));
    const limAll = ((R && R.limits) || []).filter((l) => has(`${l.value} ${l.rule}`)), limOwn = limAll.filter((l) => has(l.value));
    const lim = limOwn.length ? limOwn : limAll;
    const here = hits.filter((x) => x[0] === btn.dataset.stage), else_ = hits.filter((x) => x[0] !== btn.dataset.stage);
    const stagesWith = [...new Set(else_.map((x) => x[0]))];
    const list = (arr) => arr.slice(0, 6).map(([st, h, x]) => `<li><p>${esc(x)}</p><small>${esc(st)} · ${esc(h)}</small></li>`).join("");
    const html = `<div class="sh-fig"><b>${esc(v)}</b><span>${esc(label)}</span></div>
      ${lim.length ? `<section><h3>The rule</h3>${lim.map((l) => `<div class="sh-rule"><b>${esc(l.value)}</b><p>${esc(l.rule)}</p>${l.who ? `<small>Who: ${esc(l.who)}</small>` : ""}</div>`).join("")}</section>` : ""}
      ${here.length ? `<section><h3>What the guide says here</h3><ul class="sh-quotes">${list(here)}</ul></section>` : ""}
      ${else_.length ? `<section><h3>Also applies in</h3><ul class="sh-quotes">${list(else_)}</ul>${stagesWith.length ? `<div class="sh-links">${stagesWith.map((n) => `<a href="#/${base}/${slug(n)}">${esc(n)} →</a>`).join("")}</div>` : ""}</section>` : ""}
      ${!lim.length && !hits.length ? `<p class="muted">No further detail in the guide for this figure.</p>` : ""}`;
    FG.openSheet(`Key figure · ${btn.dataset.stage}`, label.charAt(0).toUpperCase() + label.slice(1), html);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-fact]"); if (b) factSheet(b); if (e.target.closest("#sheetBody a")) FG.closeOverlays(); });

  /* ---------- lifecycle guide (shared by procurement and grants) ---------- */
  function lifecycle(cfg) {
    const stages = cfg.stages;
    route(cfg.base, { section: cfg.base, crumbs: () => [["Projects", "projects"], [cfg.title, cfg.base]], render: () => ({ html: "", mount() { FG.go(`${cfg.base}/${slug(stages[FG.store.get(cfg.base + ":last", 0)].name)}`); } }) });
    route(`${cfg.base}/:stage`, {
      section: cfg.base,
      crumbs: (p) => [["Projects", "projects"], [cfg.title, cfg.base], [(stages.find((s) => slug(s.name) === p.stage) || stages[0]).name, `${cfg.base}/${p.stage}`]],
      render(p) {
        let i = stages.findIndex((s) => slug(s.name) === p.stage); if (i < 0) i = 0;
        FG.store.set(cfg.base + ":last", i);
        const s = stages[i], visited = FG.store.get(cfg.base + ":visited", {});
        visited[i] = 1; FG.store.set(cfg.base + ":visited", visited);
        const checks = cfg.checklist(s), best = cfg.bestPractice(s), roles = cfg.roles ? cfg.roles(s) : [];
        const widget = cfg.widgets[s.name] ? cfg.widgets[s.name]() : null;
        const related = (s.links || []).map((l) => cfg.link(l)).filter(Boolean);
        // Process map: phases as columns, stages as nodes coloured by checklist progress.
        const progress = (st) => { const items = cfg.checklist(st), t = FG.ticks(`${cfg.base}:${st.name}`); return items.length ? items.filter((_, k) => t[k]).length / items.length : 0; };
        const overall = Math.round((stages.reduce((a, st) => a + progress(st), 0) / stages.length) * 100);
        // Route track: phase chevrons sized by their stage count above one continuous numbered track.
        const order = cfg.phases.flatMap(([, names], pi) => names.map((nm) => [stages.findIndex((x) => x.name === nm), pi])).filter(([j]) => j >= 0);
        const phaseOf = (j) => (order.find(([k]) => k === j) || [0, 0])[1], pc = (pi) => `var(--c${(pi % 4) + 1})`;
        const pos = order.findIndex(([j]) => j === i), fill = order.length > 1 ? (pos / (order.length - 1)) * 100 : 0;
        const ph = phaseOf(i);
        const isP = cfg.base === "procurement", caseR = isP ? FG.procurementCase && FG.procurementCase() : FG.grantCase && FG.grantCase();
        const pcase = caseR && FG.store.get(isP ? "pcase" : "gcase", {}), caseUrl = isP ? "#/procurement/my-case" : "#/grants/my-grant";
        const caseBar = caseR
          ? `<a class="case-bar" href="${caseUrl}"><span class="case-dot"></span><span><small>${isP ? "My case" : "My grant"}</small><b>${esc(pcase.what || (isP ? "Your purchase" : "Your grant"))} · ${euro(isP ? caseR.value : caseR.budget)} → ${esc(caseR.route)}</b></span><span class="case-bar-note">${caseR.skip.includes(s.name) ? "This stage is not needed for your route" : caseR.keyStages.includes(s.name) ? "Key stage for your route" : "Applies to your route"}</span><u>Open →</u></a>`
          : `<a class="case-bar empty" href="${caseUrl}"><span class="case-dot"></span><span><small>Personalise</small><b>${isP ? "Plan my case: see only the stages, approvals and documents that apply to your purchase" : "Plan my grant: see only the stages, roles and templates that apply to your grant"}</b></span><u>Start →</u></a>`;
        const map = caseBar + `<section class="rt card" aria-label="${esc(cfg.title)} route" style="--n:${order.length}">
          <div class="rt-head"><div><span class="eyebrow">Your route</span><b>Stage ${i + 1} of ${stages.length} · ${esc(cfg.phases[ph][0])}</b></div>
            <div class="rt-tools"><div class="pmap-ring" style="--p:${overall}" title="Checklist progress across all stages"><span>${overall}%</span></div>
            ${i > 0 ? `<a class="rt-arrow" href="#/${cfg.base}/${slug(stages[i - 1].name)}" aria-label="Previous stage">←</a>` : `<span class="rt-arrow off">←</span>`}${i < stages.length - 1 ? `<a class="rt-arrow" href="#/${cfg.base}/${slug(stages[i + 1].name)}" aria-label="Next stage">→</a>` : `<span class="rt-arrow off">→</span>`}</div></div>
          <div class="rt-scroll"><div class="rt-grid">
            ${cfg.phases.map(([t, names], pi) => `<div class="rt-phase${pi === ph ? " on" : ""}" style="--c:${pc(pi)};grid-column:span ${names.length}"><small>Phase ${pi + 1}</small><b>${esc(t)}</b></div>`).join("")}
            <div class="rt-line" style="grid-column:1 / -1"><i style="width:calc(${fill}% * (1 - 1 / var(--n)))"></i></div>
            ${order.map(([j, pi]) => { const pr = progress(stages[j]), st = (j === i ? "on" : pr === 1 ? "done" : j < i ? "past" : "") + (caseR && caseR.skip.includes(stages[j].name) ? " skip" : caseR && caseR.keyStages.includes(stages[j].name) ? " key" : "");
              return `<a class="rt-node ${st}" style="--c:${pc(pi)}" href="#/${cfg.base}/${slug(stages[j].name)}" title="${esc(stages[j].title)}"><em>${pr === 1 && j !== i ? "✓" : j + 1}</em><span>${esc(stages[j].name)}</span>${pr > 0 && pr < 1 ? `<u style="width:${Math.round(pr * 100)}%"></u>` : ""}</a>`; }).join("")}
          </div></div></section>`;
        const guidance = `${s.example ? `<div class="example"><span aria-hidden="true">◆</span><div><small>In practice</small><p>${esc(s.example)}</p></div></div>` : ""}${reader(`${cfg.base}:${s.name}`, s.sections)}
          <div class="grid g2 mt">${s.warning ? ui.callout("warn", "Watch out", s.warning) : ""}${best ? ui.callout("good", "Best practice", best) : ""}</div>`;
        const people = roles.length ? `<div class="grid g2">${roles.map((r) => `<div class="card card-pad"><div class="row"><b>${esc(r.name)}</b>${ui.tag(r.tag, "accent")}</div><p class="small muted mt">${esc(r.summary)}</p>${r.does ? `<ul class="small mt">${r.does.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</div>` : "";
        const html = `
          ${ui.head(cfg.eyebrow, cfg.title, "", `${cfg.engine ? `<a class="btn primary" href="#/${cfg.engine[1]}">${esc(cfg.engine[0])}</a>` : ""}`)}
          ${map}
          <section class="card stage-card mt"><div class="card-body">
            <div class="sh"><div class="sh-chips"><span class="sh-phase" style="--c:${pc(ph)}">Phase ${ph + 1} · ${esc(cfg.phases[ph][0])}</span>${s.source ? `<span class="sh-src">${esc(s.source)}</span>` : ""}</div><h2>${esc(s.title)}</h2><p>${esc(s.lead)}</p></div>
            ${s.remember || (s.keyFacts || []).length ? `<div class="mem">${s.remember ? `<div class="mem-rule"><small>Remember</small><b>${esc(s.remember)}</b></div>` : ""}${(s.keyFacts || []).map(([v, l]) => `<button type="button" class="mem-fact" data-fact="${esc(v)}" data-fact-label="${esc(l)}" data-base="${cfg.base}" data-stage="${esc(s.name)}"><b>${esc(v)}</b><span>${esc(l)}</span><i aria-hidden="true">Details ›</i></button>`).join("")}</div>` : ""}
            <ol class="ucf">${[["Understand", s.understand, "◎"], ["Do", s.do, "▶"], ["Control", s.check, "✓"]].map(([t, x, ic], k) => `<li style="--c:var(--c${[1, 2, 3][k]})"><span class="ucf-ico" aria-hidden="true">${ic}</span><small>${k + 1} · ${t}</small><p>${esc(x)}</p></li>`).join("")}</ol>
          </div></section>
          <div class="mt">${ui.tabs(cfg.base + ":stage", [
            ["guide", "Guidance", guidance, s.sections.length],
            ["tool", "Interactive tool", widget || "", null],
            ["check", "Checklist", checks.length ? ui.checklist(`${cfg.base}:${s.name}`, checks, "Stage checklist") : "", checks.length],
            ["who", "Who is involved", people, roles.length || null],
            ["tpl", "Templates", (s.templates || []).length ? `<div class="docs">${s.templates.map(([c, d]) => `<div><b>${esc(c)}</b><span>${esc(d)}</span></div>`).join("")}</div>` : "", (s.templates || []).length || null],
          ])}</div>
          ${related.length ? `<div class="row mt"><span class="small muted">Related:</span>${related.map(([t, p]) => `<a class="tag" href="#/${p}">${esc(t)}</a>`).join("")}</div>` : ""}
          <div class="stage-nav mt">${i > 0 ? `<a class="btn" href="#/${cfg.base}/${slug(stages[i - 1].name)}">← ${esc(stages[i - 1].name)}</a>` : "<span></span>"}${i < stages.length - 1 ? `<a class="btn primary" href="#/${cfg.base}/${slug(stages[i + 1].name)}">${esc(stages[i + 1].name)} →</a>` : ""}</div>`;
        const widgetMount = widget && cfg.mount && cfg.mount[s.name];
        return { html, mount(root) {
          // Keep the current stage visible when the track scrolls (narrow screens).
          const sc = root.querySelector(".rt-scroll"), on = root.querySelector(".rt-node.on");
          if (sc && on && sc.scrollWidth > sc.clientWidth) {
            sc.scrollLeft = FG.trackScroll || 0;
            if (on.offsetLeft < sc.scrollLeft || on.offsetLeft + on.offsetWidth > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = on.offsetLeft - sc.clientWidth / 2 + on.offsetWidth / 2;
            sc.addEventListener("scroll", () => { FG.trackScroll = sc.scrollLeft; }, { passive: true });
          }
          mountReader(root);
          if (widgetMount) widgetMount(root);
        } };
      },
    });
    if (cfg.practice) FG.QUIZ_AT[`${cfg.base}/${slug(stages[stages.length - 1].name)}`] = cfg.practice;
    stages.forEach((s) => FG.addIndex(s.title, `${cfg.title} · stage: ${s.name}`, `${cfg.base}/${slug(s.name)}`, cfg.title, `${s.lead} ${s.understand} ${s.do} ${s.check} ${s.sections.map(([h, b]) => `${h} ${sectionText(b)}`).join(" ")}`));
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
  function procRuler(value, type, funding) {
    const L = E.LIMITS, low = type === "intellectual" ? L.lowIntellectual : L.lowGoods, xb = funding === "xb";
    return FG.ui.ruler({ value, max: 400000,
      marks: [[low, "Direct-award limit"], [L.legalReview, xb ? "Legal review (XB)" : "E-procurement"], [L.international, "Tenders Board"]],
      zones: [[0, low, "Direct award", "--c2"], [low, L.legalReview, "Competitive bidding", "--c1"], [L.legalReview, L.international, xb ? "Competitive + legal review" : "Competitive · e-procurement", "--c4"], [L.international, 400000, "International public call", "--c3"]] });
  }
  function mountSelector(root) {
    const form = root.querySelector("[data-selector]");
    const run = () => {
      const v = Object.fromEntries(new FormData(form));
      FG.store.set("selector", v);
      const out = root.querySelector("#selectorOut");
      out.innerHTML = procRuler(Number(v.amount) || 0, v.type, v.funding);
      if (!Number(v.amount)) { out.insertAdjacentHTML("beforeend", `<p class="small muted mt">Enter the estimated value to see the route.</p>`); return; }
      const r = E.procurement({ amount: v.amount, type: v.type, funding: v.funding });
      out.insertAdjacentHTML("beforeend", ui.callout(r.tone === "good" ? "good" : "warn", r.route, `${r.kpis[2][1]}. ${r.flags[r.flags.length - 1][0]}. `) + `<a class="btn sm mt" href="#/engines/procurement">Open the full Procurement Route engine →</a>`);
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

  const stageLinkMap = { "Threshold Matrix": "procurement/thresholds-and-procedure", "Risk & Controls": "roles", "Special Cases": "procurement/open-and-evaluate", "VAT Procedures": "vat", "How to Prepare a Payment File": "payment-file", "Filing Management": "filing", "Useful Links & Guidelines": "links" };
  lifecycle({
    base: "procurement", title: "Procurement", eyebrow: "Procurement · lifecycle guide",
    lead: "From defining the need through tendering, award, contract execution, payment and close-out, following the Council of Europe Procurement Guide.",
    stages: C.procurementStages, engine: ["Procurement Route engine", "engines/procurement"], practice: "procurement",
    phases: C.procurementPhases,
    checklist: (s) => s.checklist || [],
    bestPractice: (s) => s.best,
    roles: (s) => Object.values(C.procurementRoles).filter((r) => (r.stages || []).includes(s.name)),
    link: (l) => { const st = C.procurementStages.find((x) => x.name === l); return st ? [l, `procurement/${slug(l)}`] : stageLinkMap[l] ? [l, stageLinkMap[l]] : null; },
    widgets: { "Contract Types": contractMatrix, "Thresholds & Procedure": thresholdMatrix, "Tender Design": tenderDesign, "Open & Evaluate": procGates },
    mount: { "Thresholds & Procedure": mountSelector, "Tender Design": mountFlow("tender:i") },
  });

  /* ---------- grant widgets ---------- */
  function procGates() { return FG.ui.funnel("Evaluation gates", [
    ["Admissibility", "Offer received on time, complete and in the required form.", "inadmissible: not evaluated further", "formal"],
    ["Exclusion criteria", "Signed declaration; no exclusion ground applies (plus restrictive-measures check for EU funds).", "tenderer excluded", "pass / fail"],
    ["Eligibility criteria", "Minimum legal, financial and technical capacity requirements are met.", "offer is ineligible", "pass / fail"],
    ["Award criteria", "Published weighted criteria, with a written justification for every score.", null, "scored"],
    ["Award decision", "CCM, or the Tenders Board from €184,000, approves the proposed award.", null, "decision"]]); }
  function grantGates() { return FG.ui.funnel("Selection gates", [
    ["Receipt & opening", "Proposal received by the deadline in the required form, then opened and numbered.", "late proposals are rejected", "formal"],
    ["Exclusion & eligibility", "Co-ordinator prepares the draft report; the Evaluation Committee adopts it.", "applicant eliminated", "pass / fail"],
    ["Award criteria", "Committee members assess against the published weighted criteria and agree a consensus report.", null, "scored"],
    ["Decision", "The Commitments Officer decides on the award and applicants are informed.", null, "decision"]]); }
  function grantProcedureWidget() {
    const amount = FG.store.get("grantQuick", 18000), r = E.grantProcedure({ amount });
    return `<section class="card"><div class="card-head"><div><h3>Procedure route</h3><small>The €15,000 threshold applies to the total grant-award procedure budget, not to each grantee.</small></div><a class="btn sm" href="#/engines/grant-procedure">Full engine</a></div><div class="card-body grid g2">
      ${ui.number("grantQuick", amount, "Total procedure budget (€)")}
      <div>${FG.ui.ruler({ value: amount, max: 60000, marks: [[15000, "Call for proposals"]], zones: [[0, 15000, "Direct award (G9.2A)", "--c2"], [15000, 60000, "Call for proposals", "--c1"]] })}${ui.callout(r.tone === "good" ? "good" : "warn", r.route, `Template: ${r.kpis[2][1]}. ${amount >= 15000 ? "Direct award at or above €15,000 is possible only under strictly interpreted exceptions (G9.2B)." : "Below the threshold: direct award (G9.2A)."}`)}</div></div></section>`;
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
    phases: C.grantPhases,
    checklist: (s) => s.checklist || [],
    bestPractice: (s) => s.best,
    link: (l) => (C.grantStages.some((x) => x.name === l) ? [l, `grants/${slug(l)}`] : null),
    widgets: { Procedure: grantProcedureWidget, Costs: grantCostsWidget, Evaluation: grantGates },
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
    crumbs: () => [["Projects", "projects"], ["Useful links", "links"]],
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
