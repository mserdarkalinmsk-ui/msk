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
    ["◆", "DPC financial management", "Delegation, roles, commitments and payments, visa route, VAT, petty cash and audit lessons (DPC manual, 2024).", "dpc-manual"],
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
    ["01", "Commit", "Select the procedure and sign", 1, [["Procurement", "Thresholds, tender, evaluation and contract.", "procurement", "CORE"], ["DPC financial management", "Who decides, visa route, payments and controls.", "dpc-manual", "MANUAL"], ["Grant", "Call, criteria, evaluation and agreement.", "grants"]]],
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
    ["PR", "Procurement", "15-stage lifecycle from need to filing, with thresholds and contract types.", "procurement", "15 stages"],
    ["GR", "Grants", "Procedure, criteria, cost eligibility, evaluation and agreement.", "grants", "13 stages"],
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
      const last = FG.store.get("last", null), counts = ["9 modules", "6 workflows", "20+ tools", `${engines} engines`];
      const quick = [["Procurement guide", "15 stages, need to filing", "procurement"], ["Plan my purchase", "Route, approvals, timeline", "procurement/my-case"], ["Grants guide", "13 stages, call to agreement", "grants"], ["Test yourself", "20 questions per module", "procurement/test"]];
      return { html: `
        <section class="hx-hero"><div><span class="eyebrow">Council of Europe · Financial Guide</span>
          <h1>Find the rule, plan your case, keep the right documents.</h1>
          <p>Procurement, grants, payment files, year-end and field operations, in one guided place.</p></div>
          ${last ? `<a class="hx-last" href="${esc(last.href)}"><small>Continue where you left off</small><b>${esc(last.title)}</b><span>${esc(last.sub)}</span><u>Resume →</u></a>` : `<a class="hx-last" href="#/procurement"><small>New here?</small><b>Start with procurement</b><span>The most used guide: 15 stages from need to filing</span><u>Start →</u></a>`}
        </section>
        <section class="hx-quick">${quick.map(([t, d, h]) => `<a href="#/${h}"><b>${t}</b><span>${d}</span></a>`).join("")}</section>
        <h2 class="hx-h">All spaces</h2>
        <section class="hx-hubs">${HUBS.map(([k, t, sub, d, p, c, ic], i) => `<a class="hx-hub" style="--c:var(--c${c})" href="#/${p}"><span class="hx-ico" aria-hidden="true">${ic}</span><div><small>${esc(sub)}</small><h3>${esc({ PROJECTS: "Projects", FOMA: "FOMA field operations", TOOLS: "Tools", "DECISION ENGINES": "Decision engines" }[t] || t)}</h3><p>${esc(d)}</p><em>${counts[i]} →</em></div></a>`).join("")}</section>` };
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

  /* ---------- item icons: picked from the term, so every list gets a meaningful pictogram ---------- */
  const ICONS = [
    [/compet|tender|bid|offer/i, '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'],
    [/object|impartial|neutral|bias/i, '<path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>'],
    [/transparen|publi|disclos|open/i, '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'],
    [/exclusiv|rotat|period|recurr|renew/i, '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'],
    [/equal|same|fair/i, '<path d="M5 9h14M5 15h14"/>'],
    [/discrimin|group|divers|people|staff|member/i, '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 8 0"/>'],
    [/fraud|corrupt|ethic|interest|gift|conflict/i, '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'],
    [/budget|cost|fund|pay|price|value|financ|€|invoice/i, '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M6 10v.01M18 15v.01"/>'],
    [/contract|agreement|sign|legal|rule|instruction|law/i, '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>'],
    [/time|deadline|day|date|durat|year|month/i, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    [/evaluat|criteri|score|assess|check|review|audit|control/i, '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/>'],
    [/supplier|market|vendor|company|partner/i, '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>'],
    [/risk|warn|sanction|complain|appeal/i, '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'],
    [/document|file|record|archiv|template|form/i, '<path d="M4 4h6l2 2h8v14H4z"/>'],
    [/need|specif|scope|requir|object/i, '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'],
    [/approv|author|board|committee|decision|validat/i, '<path d="M4 21h16M6 21V10M10 21V10M14 21V10M18 21V10M3 10l9-6 9 6z"/>'],
    [/communicat|email|notif|inform|letter/i, '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
    [/deliver|goods|ship|works|service/i, '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'],
  ];
  const iconFor = (t) => { const m = ICONS.find(([r]) => r.test(t)); return m ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m[1]}</svg>` : ""; };
  function sectionHtml(b) {
    if (typeof b === "string") {
      const parts = splitSentences(b), lead = parts.shift() || "", rules = parts.filter((x) => sentenceKind(x) === "rule"), rest = parts.filter((x) => sentenceKind(x) !== "rule");
      b = { lead, items: [], must: rules, body: rest.join(" ") };
    }
    const items = b.items || [];
    return `<p class="rd-lead">${esc(b.lead)}</p>${b.body ? `<p>${esc(b.body)}</p>` : ""}
      ${items.length ? `<div class="rd-items ${b.ordered ? "ordered" : ""}" style="--n:${items.length}"><div class="rd-ih"><small>${items.length} ${b.ordered ? "steps" : "points"}</small>${items.length > 2 ? `<button type="button" class="rd-recall" data-recall>Test my recall</button>` : ""}</div><ol>${items.map(([t, d], k) => { const ic = b.ordered ? "" : iconFor(String(t)); return `<li${ic ? ' class="has-ic"' : ""}><span>${ic ? `${ic}<i>${k + 1}</i>` : b.ordered ? k + 1 : esc(String(t).match(/^[a-z]\)/i) ? String(t).slice(0, 1) : k + 1)}</span><div><b>${esc(String(t).replace(/^[a-z]\)\s*/i, ""))}</b><p>${esc(d)}</p></div></li>`; }).join("")}</ol></div>` : ""}
      ${(b.must || []).length ? `<div class="rd-rules"><small>Rules to follow</small><ul>${b.must.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${b.tip ? `<div class="rd-tipbox"><small>Good practice</small><p>${esc(b.tip)}</p></div>` : ""}`;
  }
  function reader(key, sections) {
    const read = FG.store.get("read:" + key, {}), n = sections.length, done = sections.filter((_, k) => read[k]).length;
    const icon = { rule: "!", tip: "★" }, label = { rule: "Rule", tip: "Tip" };
    return `<div class="rd" data-rd="${esc(key)}">
      <div class="rd-side">
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
        const done = Object.keys(read).length, mt = document.querySelector('.sb-meter[data-go-tab="guide"]');
        if (mt) { mt.style.setProperty("--p", Math.round((done / n) * 100)); mt.querySelector("b").firstChild.textContent = done; }
        if (done === n) { const fin = rd.parentElement.querySelector(".rd-done"); if (fin) fin.hidden = false; }
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


  /* ---------- stage brief: rule, steps, key figures and every must-not-miss rule ---------- */
  function factInfo(base, stage, v) {
    const g = FG.guide(base), stages = g.stages, R = g.reference;
    const toks = factTokens(v), has = (t) => toks.some((k) => t.includes(k)) || t.includes(v);
    const st = stages.find((x) => x.name === stage), hits = [];
    (st ? st.sections : []).forEach(([h, b]) => {
      const pieces = typeof b === "string" ? splitSentences(b) : [b.lead, ...(b.items || []).map(([a, d]) => `${a}: ${d}`), ...(b.must || []), b.tip].filter(Boolean);
      pieces.forEach((x) => { if (has(x)) hits.push(x); });
    });
    const lim = ((R && R.limits) || []).filter((l) => has(String(l.value)));
    return { text: hits.sort((a, b) => a.length - b.length).find((x) => x.length > 40) || hits[0] || "", lim: lim.length > 0 };
  }
  function briefHtml(cfg, s, ph, pc, idx) {
    const musts = s.sections.flatMap(([h, b], k) => ((b && b.must) || []).map((m) => [k, h, m]));
    const steps = [["Understand", s.understand, "Why this stage exists"], ["Do", s.do, "What you actually do"], ["Control", s.check, "How you know it is done"]];
    const mustLi = ([k, h, m]) => `<li><p>${esc(m)}</p><button type="button" class="sb-src" data-rd-jump="${k}">${esc(h)} →</button></li>`;
    return `<div class="sb">
      <div class="sb-hero" style="--c:${pc(ph)}"><span class="sb-num" aria-hidden="true">${String(idx + 1).padStart(2, "0")}</span>
        <div class="sb-top"><div class="sh-chips"><span class="sh-phase" style="--c:${pc(ph)}">Phase ${ph + 1} · ${esc(cfg.phases[ph][0])}</span>${s.source ? `<span class="sh-src">Guide ${esc(s.source)}</span>` : ""}</div>
          <h2>${esc(s.title)}</h2><p>${esc(s.lead)}</p></div>
        ${(() => { const rd = Object.keys(FG.store.get(`read:${cfg.base}:${s.name}`, {})).length, cl = cfg.checklist(s), t = FG.ticks(`${cfg.base}:${s.name}`), ck = cl.filter((_, k) => t[k]).length;
          const m = (lab, a, b, tab) => `<button type="button" class="sb-meter" data-go-tab="${tab}" style="--p:${b ? Math.round((a / b) * 100) : 0}"><i></i><b>${a}<small>/${b}</small></b><span>${lab}</span></button>`;
          return `<div class="sb-meters">${m("topics read", rd, s.sections.length, "guide")}${m("checks done", ck, cl.length, "check")}<button type="button" class="sb-meter rules" data-go-tab="rules"><b>${musts.length}</b><span>key rules</span></button><button type="button" class="sb-meter print" data-print title="Print a one-page summary of this stage"><b>⎙</b><span>summary</span></button></div>`; })()}
      </div>
      <div class="sb-grid${(s.keyFacts || []).length ? "" : " solo"}">
        <div class="sb-main">
          ${s.remember ? `<div class="sb-rule"><small>If you remember one thing</small><b>${esc(s.remember)}</b></div>` : ""}
          <ol class="sb-flow">${steps.map(([t, x, sub], k) => `<li style="--c:var(--c${k + 1})"><em>${k + 1}</em><div><small>${t} <i>· ${sub}</i></small><p>${esc(x)}</p></div></li>`).join("")}</ol>
        </div>
        ${(s.keyFacts || []).length ? `<aside class="sb-facts"><h4>Key figures</h4>${s.keyFacts.map(([v, l], k) => { const f = factInfo(cfg.base, s.name, v);
          return `<details class="sb-fact"${k ? "" : " open"}><summary><b>${esc(v)}</b><span>${esc(l)}</span></summary>${(() => { const n = ((C.factNotes || {})[cfg.base] || {})[s.name], fn = n && (n[`${v}|${l}`] || n[v]); return fn ? `<div class="sb-note"><p>${esc(fn.what)}</p><div class="sb-why"><small>Why it matters</small><p>${esc(fn.why)}</p></div>${fn.ref ? `<span class="sb-ref">Guide § ${esc(fn.ref)}</span>` : ""}</div>` : f.text ? `<p>${esc(f.text)}</p>` : ""; })()}${f.lim ? `<button type="button" class="sb-more" data-fact="${esc(v)}" data-fact-label="${esc(l)}" data-base="${cfg.base}" data-stage="${esc(s.name)}">Full rule &amp; where else it applies ›</button>` : ""}</details>`; }).join("")}</aside>` : ""}
      </div>
    </div>`;
  }
  function keyRulesHtml(s, best) {
    const musts = s.sections.flatMap(([h, b], k) => ((b && b.must) || []).map((m) => [k, h, m]));
    // The first obligation in the sentence decides: "must not / never / cannot …" is a don't, "must / should …" a do.
    const isDont = (m) => { const f = m.match(/\b(must not|may not|should not|shall not|cannot|never|prohibited|must|should|shall|may|are|is)\b/i); return !!f && /not|never|cannot|prohibited/i.test(f[1]); };
    const dos = musts.filter((x) => !isDont(x[2])), donts = musts.filter((x) => isDont(x[2]));
    const li = ([k, h, m]) => `<li><p>${esc(m)}</p><button type="button" class="sb-src" data-rd-jump="${k}">${esc(h)} →</button></li>`;
    const col = (cls, icon, title, list) => list.length ? `<div class="sm-col ${cls}"><h4><span>${icon}</span>${title}<small>${list.length}</small></h4><ol>${list.map(li).join("")}</ol></div>` : "";
    return `<div class="sm">
      <div class="sm-head">${s.remember ? `<div class="sm-rule"><small>The rule of this stage</small><b>${esc(s.remember)}</b></div>` : ""}
        ${(s.keyFacts || []).length ? `<div class="sm-figs">${s.keyFacts.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>` : ""}</div>
      ${musts.length ? `<div class="sm-cols">${col("do", "✓", "Always do", dos)}${col("dont", "✕", "Never do", donts)}</div>` : ""}
      ${s.warning || best ? `<div class="sm-cols">${s.warning ? `<div class="sb-warn"><h4>Common pitfall</h4><p>${esc(s.warning)}</p></div>` : ""}${best ? `<div class="sb-good"><h4>Best practice</h4><p>${esc(best)}</p></div>` : ""}</div>` : ""}
    </div>`;
  }
  FG.reviewChip = () => { const n = FG.store.get("recall:review", []).length; return n ? `<button type="button" class="hub-ref" data-review><span>↻</span><div><b>Cards to review</b><small>${n} point${n > 1 ? "s" : ""} you marked "review later"</small></div><u>Open →</u></button>` : ""; };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-review-clear]")) { FG.store.set("recall:review", []); FG.closeOverlays(); FG.refresh(true); return; }
    if (!e.target.closest("[data-review]")) return;
    const list = FG.store.get("recall:review", []);
    FG.openSheet("Recall", "Cards to review", `<ul class="rv">${list.map(([t, d, h]) => `<li><details><summary>${esc(t)}</summary><p>${esc(d)}</p><a href="${esc(h)}">Open in the guide →</a></details></li>`).join("")}</ul><button type="button" class="btn sm mt" data-review-clear>Clear the list</button>`);
  });

  /* ---------- module brief: the stage-page header for operational modules ---------- */
  FG.modHead = function (key, eyebrow, title, lead, actions) {
    const b = (C.moduleBriefs || {})[key];
    if (!b) return ui.head(eyebrow, title, lead, actions);
    const steps = [["Understand", b.understand, "Why it matters"], ["Do", b.do, "What you actually do"], ["Control", b.check, "How you know it is done"]];
    return `<section class="card stage-card mod-brief"><div class="card-body"><div class="sb">
      <div class="sb-hero" style="--c:var(--c1)"><div class="sb-top"><div class="sh-chips"><span class="sh-phase" style="--c:var(--c1)">${esc(eyebrow)}</span></div><h2>${esc(b.title || title)}</h2><p>${esc(b.lead || lead)}</p></div>
        ${actions ? `<div class="mod-actions">${actions}</div>` : ""}</div>
      <div class="sb-grid${(b.figures || []).length ? "" : " solo"}"><div class="sb-main">
        ${b.remember ? `<div class="sb-rule"><small>If you remember one thing</small><b>${esc(b.remember)}</b></div>` : ""}
        <ol class="sb-flow">${steps.map(([t, x, sub], k) => `<li style="--c:var(--c${k + 1})"><em>${k + 1}</em><div><small>${t} <i>· ${sub}</i></small><p>${esc(x)}</p></div></li>`).join("")}</ol></div>
        ${(b.figures || []).length ? `<aside class="sb-facts"><h4>Key figures</h4>${b.figures.map(([v, l, w], k) => `<details class="sb-fact"${k ? "" : " open"}><summary><b>${esc(v)}</b><span>${esc(l)}</span></summary><div class="sb-note"><p>${esc(w)}</p></div></details>`).join("")}</aside>` : ""}
      </div></div></div></section><div class="mt"></div>`;
  };
  /* ---------- fact details: everything the guide says about a key figure ---------- */
  const factTokens = (v) => { const t = String(v).match(/€?\d[\d,.]*\s?(%|h|days?|weeks?|months?|years?|points?|working days)?|G\d+(\.\d+)?[A-Z]?|Art\.\s?[\d.]+|Rule No\. \d+|MSA \d+/gi) || []; return t.map((x) => x.trim()).filter((x) => x.length > 1 || /\d/.test(x)); };
  function factSheet(btn) {
    const base = btn.dataset.base, v = btn.dataset.fact, label = btn.dataset.factLabel, stages = FG.guide(base).stages;
    const R = FG.guide(base).reference;
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
  document.addEventListener("click", (e) => {
    const gt = e.target.closest("[data-go-tab]");
    if (gt) { const tab = document.querySelector(`.tablist [data-tab="${gt.dataset.goTab}"]`); if (tab) { tab.click(); const box = tab.closest(".tabs"); window.scrollTo({ top: box.getBoundingClientRect().top + scrollY - 70, behavior: "smooth" }); } return; }
    const r = e.target.closest("[data-recall]");
    if (r) { const box = r.closest(".rd-items"), on = box.classList.toggle("recall"); box.querySelectorAll("li").forEach((li) => li.classList.remove("shown")); r.textContent = on ? "Show all" : "Test my recall"; return; }
    const rate = e.target.closest("[data-rate]");
    if (rate) { const li = rate.closest("li"), term = li.querySelector("b").textContent, list = FG.store.get("recall:review", []).filter((x) => x[0] !== term);
      if (rate.dataset.rate === "later") list.push([term, li.querySelector("p").textContent, location.hash]);
      FG.store.set("recall:review", list); li.classList.add("rated"); li.dataset.rated = rate.dataset.rate; return; }
    const li = e.target.closest(".rd-items.recall li");
    if (li && !li.classList.contains("shown")) { li.classList.add("shown"); if (!li.querySelector(".rd-rate")) li.querySelector("div").insertAdjacentHTML("beforeend", `<div class="rd-rate"><button type="button" data-rate="knew">✓ Knew it</button><button type="button" data-rate="later">↻ Review later</button></div>`); }
    if (e.target.closest("[data-print]")) {
      const box = document.createElement("div"); box.id = "printSum";
      const sb = document.querySelector(".sb").cloneNode(true), rules = document.querySelector('[data-panel="rules"]');
      sb.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")); sb.querySelectorAll("button").forEach((x) => x.remove());
      box.append(sb); if (rules) { const r = rules.cloneNode(true); r.hidden = false; r.querySelectorAll("button").forEach((x) => x.remove()); box.append(r); }
      document.body.append(box); document.documentElement.classList.add("print-sum");
      const done = () => { box.remove(); document.documentElement.classList.remove("print-sum"); window.removeEventListener("afterprint", done); };
      window.addEventListener("afterprint", done); window.print(); setTimeout(done, 1500);
    }
    const j = e.target.closest("[data-rd-jump]");
    if (j) { const tab = document.querySelector('[data-tab="guide"],[role="tab"][data-id="guide"]'); if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
      const go = document.querySelector(`.rd-nav [data-rd-go="${j.dataset.rdJump}"]`); if (go) { go.click(); document.querySelector(".rd").scrollIntoView({ behavior: "smooth", block: "start" }); } }
  });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-fact]"); if (b) factSheet(b); if (e.target.closest("#sheetBody a")) FG.closeOverlays(); });

  /* ---------- lifecycle guide (shared by procurement and grants) ---------- */
  FG.lifecycle = (cfg) => lifecycle(cfg);
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
        FG.store.set("last", { href: `#/${cfg.base}/${slug(s.name)}`, title: s.title, sub: `${cfg.title} · stage ${i + 1} of ${stages.length}` });
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
        const isP = cfg.base === "procurement", hasCase = isP || cfg.base === "grants", caseR = !hasCase ? null : isP ? FG.procurementCase && FG.procurementCase() : FG.grantCase && FG.grantCase();
        const pcase = caseR && FG.store.get(isP ? "pcase" : "gcase", {}), caseUrl = isP ? "#/procurement/my-case" : "#/grants/my-grant";
        const caseBar = caseR
          ? `<a class="case-chip" href="${caseUrl}" title="${esc(pcase.what || "")}"><i></i><span>${isP ? "My case" : "My grant"}: <b>${euro(isP ? caseR.value : caseR.budget)} → ${esc(caseR.route)}</b> · ${caseR.skip.includes(s.name) ? "not needed for your route" : caseR.keyStages.includes(s.name) ? "key stage" : "applies"}</span></a>`
          : !hasCase ? "" : `<a class="case-chip empty" href="${caseUrl}"><i></i><span>${isP ? "Plan my case" : "Plan my grant"} <b>→</b></span></a>`;
        const map = `<section class="rt card" aria-label="${esc(cfg.title)} route" style="--n:${order.length}">
          <div class="rt-head"><div class="rt-title"><b>Stage ${i + 1}<small> of ${stages.length}</small></b>${caseBar}</div>
            <div class="rt-tools">
            ${i > 0 ? `<a class="rt-arrow" href="#/${cfg.base}/${slug(stages[i - 1].name)}" aria-label="Previous stage">←</a>` : `<span class="rt-arrow off">←</span>`}${i < stages.length - 1 ? `<a class="rt-arrow" href="#/${cfg.base}/${slug(stages[i + 1].name)}" aria-label="Next stage">→</a>` : `<span class="rt-arrow off">→</span>`}</div></div>
          <div class="rt-scroll"><div class="rt-grid">
            ${cfg.phases.map(([t, names], pi) => `<div class="rt-phase${pi === ph ? " on" : ""}" style="--c:${pc(pi)};grid-column:span ${names.length}"><b><small>${pi + 1}</small>${esc(t)}</b></div>`).join("")}
            <div class="rt-line" style="grid-column:1 / -1"><i style="width:calc(${fill}% * (1 - 1 / var(--n)))"></i></div>
            ${order.map(([j, pi]) => { const pr = progress(stages[j]), st = (j === i ? "on" : pr === 1 ? "done" : j < i ? "past" : "") + (caseR && caseR.skip.includes(stages[j].name) ? " skip" : caseR && caseR.keyStages.includes(stages[j].name) ? " key" : "");
              return `<a class="rt-node ${st}" style="--c:${pc(pi)}" href="#/${cfg.base}/${slug(stages[j].name)}" title="${esc(stages[j].title)}"><em>${pr === 1 && j !== i ? "✓" : j + 1}</em><span>${esc(stages[j].name)}</span>${pr > 0 && pr < 1 ? `<u style="width:${Math.round(pr * 100)}%"></u>` : ""}</a>`; }).join("")}
          </div></div></section>`;
        const allRead = Object.keys(FG.store.get(`read:${cfg.base}:${s.name}`, {})).length >= s.sections.length, nxt = stages[i + 1];
        const doneCard = `<div class="rd-done" ${allRead ? "" : "hidden"}><span aria-hidden="true">✓</span><div><b>You have read every topic of this stage.</b><small>${checks.length ? `Tick the ${checks.length} checks, then move on.` : "Move on when you are ready."}</small></div>${checks.length ? `<button type="button" class="btn sm" data-go-tab="check">Open checklist</button>` : ""}${nxt ? `<a class="btn sm primary" href="#/${cfg.base}/${slug(nxt.name)}">Next: ${esc(nxt.name)} →</a>` : ""}</div>`;
        const guidance = `${reader(`${cfg.base}:${s.name}`, s.sections)}${doneCard}${s.example ? `<div class="example mt"><span aria-hidden="true">◆</span><div><small>In practice</small><p>${esc(s.example)}</p></div></div>` : ""}`;
        const nMust = s.sections.reduce((a, [, b]) => a + (((b && b.must) || []).length), 0);
        const people = roles.length ? `<div class="grid g2">${roles.map((r) => `<div class="card card-pad"><div class="row"><b>${esc(r.name)}</b>${ui.tag(r.tag, "accent")}</div><p class="small muted mt">${esc(r.summary)}</p>${r.does ? `<ul class="small mt">${r.does.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</div>` : "";
        const html = `
          <div class="sb-mini" aria-hidden="true"><span class="sb-mini-n" style="--c:${pc(ph)}">${i + 1}<small>/${stages.length}</small></span><b>${esc(s.title)}</b>
            <nav>${[["guide", "Guidance"], ["rules", "Summary"], ["check", "Checklist"]].map(([k, t]) => `<button type="button" data-go-tab="${k}">${t}</button>`).join("")}</nav>
            <span class="sb-mini-arrows">${i > 0 ? `<a href="#/${cfg.base}/${slug(stages[i - 1].name)}" aria-label="Previous stage" tabindex="-1">←</a>` : ""}${i < stages.length - 1 ? `<a href="#/${cfg.base}/${slug(stages[i + 1].name)}" aria-label="Next stage" tabindex="-1">→</a>` : ""}</span></div>
          ${map}
          <section class="card stage-card mt"><div class="card-body">
            ${briefHtml(cfg, s, ph, pc, i)}
          </div></section>${cfg.hero && cfg.hero[s.name] ? `<div class="mt">${cfg.hero[s.name]()}</div>` : ""}
          <div class="mt">${ui.tabs(cfg.base + ":stage", [
            ["guide", "Guidance", guidance, s.sections.length],
            ["rules", "Summary", keyRulesHtml(s, best), null],
            ["tool", "Interactive tool", widget || "", null],
            ["check", "Checklist", checks.length ? ui.checklist(`${cfg.base}:${s.name}`, checks, "Stage checklist") : "", checks.length],
            ["who", "Who is involved", people, roles.length || null],
            ["tpl", "Templates", (s.templates || []).length ? `<div class="docs">${s.templates.map(([c, d]) => `<div><b>${esc(c)}</b><span>${esc(d)}</span></div>`).join("")}</div>` : "", (s.templates || []).length || null],
          ])}</div>
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
          document.querySelectorAll("body > .sb-mini").forEach((x) => x.remove());
          const mini = root.querySelector(".sb-mini"), hero = root.querySelector(".sb-hero"); if (mini) document.body.append(mini);
          if (mini && hero && "IntersectionObserver" in window) { if (FG.miniObs) FG.miniObs.disconnect(); FG.miniObs = new IntersectionObserver(([en]) => mini.classList.toggle("show", !en.isIntersecting && en.boundingClientRect.top < 0)); FG.miniObs.observe(hero); }
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
    const need = [["Fixed", "One-off, clearly defined need"], ["Recurring", "Recurring need with definable units"], ["Variable", "Regular but unpredictable or complex need"]];
    const ico = ["①", "∞", "↻"], rows = [["Best fit", 2, "◎"], ["Suppliers", 3, "◫"], ["Ordering & competition", 4, "⇄"], ["Duration", 5, "◷"], ["Key control", 6, "✓"]];
    const sel = FG.store.get("ct:k", 0);
    const cell = (i, html, extra) => `<div class="cx-c${i === sel ? " on" : ""}${extra || ""}" data-ct-col="${i}" style="--c:var(--c${i + 1})">${html}</div>`;
    return `<section class="cx card" data-ct>
      <div class="cx-head"><div><span class="eyebrow">Contract structure · quick comparison</span><h3>Which contract type fits the need?</h3><p>Choose the structure from how predictable and recurrent the need is. The procedure is decided separately, by value.</p></div>
        <div class="rc-seg" role="group" aria-label="Your need">${need.map(([k, t], i) => `<button type="button" aria-pressed="${i === sel}" data-ct-k="${i}" title="${esc(t)}">${k}</button>`).join("")}</div></div>
      <div class="cx-spec"><span>Defined, one-off</span><i></i><span>Recurring, defined units</span><i></i><span>Variable or complex</span></div>
      <div class="cx-grid">
        <div class="cx-corner"></div>${CONTRACT_ROWS.map((r, i) => cell(i, `<em>${ico[i]}</em><b>${esc(r[0])}</b><small>${esc(r[1])}</small><u>Fits your need</u>`, " cx-top")).join("")}
        ${rows.map(([lab, k, ic]) => `<div class="cx-l"><span>${ic}</span>${lab}</div>${CONTRACT_ROWS.map((r, i) => cell(i, `<p>${esc(r[k])}</p>`)).join("")}`).join("")}
      </div>
      <div class="cx-foot"><div><b>Contract type ≠ procedure</b><span>This chart chooses the structure. The total value over the whole period decides how it is awarded.</span></div>
        <a class="btn sm" href="#/procurement/thresholds-and-procedure">Check the procedure →</a><a class="btn sm" href="#/procurement/tender-design">Tender design →</a></div>
    </section>`;
  }
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-ct-k]"); if (!t) return; const b = t.closest("[data-ct]");
    b.querySelectorAll("[data-ct-k]").forEach((x) => x.setAttribute("aria-pressed", x === t)); FG.store.set("ct:k", +t.dataset.ctK); b.querySelectorAll("[data-ct-col]").forEach((c) => c.classList.toggle("on", c.dataset.ctCol === t.dataset.ctK)); });

  // Route finder: value, type and funding in → the matching lane lights up with its approvals, controls, steps and documents.
  const LANES = [
    ["direct", "◆", 2, "Direct award", (lo) => `Up to ${euro(lo)}`, "Low-value, clearly defined need. Competition is not required solely because of value, provided the direct-award conditions are met.", ["Buyer entity", "CCM validation"], "Document the need and the value-for-money basis; keep the file."],
    ["competitive", "◇", 1, "Competitive bidding", (lo) => `${euro(lo)} – €184,000`, "Default route above the direct-award limit. Invite at least three potential suppliers.", ["Buyer entity", "DLAPIL review if extrabudgetary ≥ €55,000", "CCM approval"], "Assess the whole foreseeable need; never split to stay below a threshold."],
    ["international", "✦", 3, "International public call", () => "From €184,000", "The total foreseeable need reaches the international threshold. Plan the longer publication, evaluation and approval route.", ["Buyer entity", "CCM", "Tenders Board"], "Tenders Board authorises the launch and the award; at least three weeks' publication."],
  ];
  function thresholdMatrix() {
    const st = FG.store.get("selector", { amount: "", type: "general", funding: "ordinary" }), routes = C.thresholdRoutes;
    const lo = st.type === "intellectual" ? E.LIMITS.lowIntellectual : E.LIMITS.lowGoods;
    return `<section class="rf" data-selector-wrap>
      <form class="rf-in" data-selector>
        <div class="eyebrow">Route finder</div><h3>Where does your purchase fall?</h3>
        <label class="rf-amount"><span>Total foreseeable value, excl. VAT</span><div><em>€</em><input type="number" inputmode="decimal" min="0" step="any" name="amount" value="${esc(st.amount)}" placeholder="e.g. 90000"></div></label>
        <div class="rf-segs"><div><span>Purchase type</span>${["general", "intellectual"].map((v) => `<label class="rf-seg"><input type="radio" name="type" value="${v}" ${st.type === v ? "checked" : ""}><b>${v === "general" ? "Goods / services / works" : "Intellectual services"}</b></label>`).join("")}</div>
          <div><span>Funding</span>${["ordinary", "xb"].map((v) => `<label class="rf-seg"><input type="radio" name="funding" value="${v}" ${st.funding === v ? "checked" : ""}><b>${v === "ordinary" ? "Ordinary Budget" : "Extrabudgetary / mixed"}</b></label>`).join("")}</div></div>
      </form>
      <div class="rf-out" id="selectorOut"></div>
    </section>
    <div class="lanes">${LANES.map(([k, ic, c, title, range, when, who, control]) => { const r = routes[k];
      return `<article class="lane" data-lane="${k}" style="--c:var(--c${c})">
        <header><span class="lane-ic">${ic}</span><div><b>${title}</b><small data-range="${k}">${esc(range(lo))}</small></div></header>
        <p>${esc(when)}</p>
        <div class="lane-who"><small>Who approves</small><div>${who.map((w, i) => `${i ? '<i aria-hidden="true">→</i>' : ""}<span>${esc(w)}</span>`).join("")}</div></div>
        <div class="lane-ctl"><small>Key control</small><p>${esc(control)}</p></div>
        <details><summary>${r.steps.length} steps</summary><ol>${r.steps.map((x) => `<li><b>${esc(x[0])}</b><span>${esc(x[1])}</span></li>`).join("")}</ol></details>
        <details><summary>${r.docs.length} documents</summary><ul>${r.docs.map((d) => `<li><b>${esc(d[0])}</b><span>${esc(d[1])}</span></li>`).join("")}</ul></details>
      </article>`; }).join("")}</div>
    <div class="specials">
      <div class="special" style="--c:var(--c5)"><span>€10k</span><div><b>Special option · public prices below €10,000</b><p>Within competitive bidding, publicly available prices from three or more suppliers may be compared instead of issuing invitations, where the conditions are met and screenshots are archived.</p></div></div>
      <div class="special" style="--c:var(--c3)"><span>LCR</span><div><b>Extra control · extrabudgetary €55,000 – €184,000</b><p>A DLAPIL Legal Compliance Review (5 working days) is required before CCM approval. It adds a validation step; it does not replace the procedure.</p></div></div>
    </div>`;
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
      const v = Object.fromEntries(new FormData(form)), amount = Number(v.amount) || 0;
      FG.store.set("selector", v);
      const lo = v.type === "intellectual" ? E.LIMITS.lowIntellectual : E.LIMITS.lowGoods;
      LANES.forEach(([k, , , , range]) => { const el = root.querySelector(`[data-range="${k}"]`); if (el) el.textContent = range(lo); });
      const r = amount ? E.procurementCase({ value: amount, type: v.type, funding: v.funding }) : null;
      const lane = r ? (r.key === "direct-low" ? "direct" : r.key) : null;
      root.querySelectorAll("[data-lane]").forEach((el) => { el.classList.toggle("hit", el.dataset.lane === lane); el.classList.toggle("dim", !!lane && el.dataset.lane !== lane); });
      root.querySelector("#selectorOut").innerHTML = `${procRuler(amount, v.type, v.funding)}${r ? `<div class="rf-res"><small>Your route</small><b>${esc(r.route)}</b>
        <div class="rf-chain">${r.approvals.map(([w], i) => `${i ? '<i aria-hidden="true">→</i>' : ""}<span>${esc(w)}</span>`).join("")}</div>
        <div class="rf-tags"><span class="${r.eproc.mandatory ? "on" : ""}">${r.eproc.mandatory ? "e-procurement mandatory" : "e-procurement not required"}</span>${r.lcr ? '<span class="warn">Legal Compliance Review</span>' : ""}${r.risks.filter((x) => x[0] === "risk").map((x) => `<span class="risk">${esc(x[1])}</span>`).join("")}</div>
        <a href="#/procurement/my-case">Plan this as my case →</a></div>` : `<p class="rf-hint">Type a value to see your route light up.</p>`}`;
    };
    form.addEventListener("input", run); form.addEventListener("change", run); form.addEventListener("submit", (e) => e.preventDefault()); run();
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
    widgets: { "Roles & Funding": () => FG.vis.approvals(), "Authorise & Launch": () => FG.vis.clock("procurement"), "Negotiate & Award": () => FG.vis.clock("procurement"),  "Thresholds & Procedure": () => FG.vis.tree() + thresholdMatrix(), "Tender Design": tenderDesign, "Open & Evaluate": () => procGates() + FG.vis.scoring() },
    hero: { "Contract Types": contractMatrix },
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
    return `${FG.vis.budget()}<section class="card"><div class="card-head"><div><h3>Cost eligibility test</h3><small>Run before commitment and again before payment. Agreement and donor conditions still apply.</small></div></div><div class="card-body grid g2">
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
    widgets: { Complaints: () => FG.vis.clock("grants"), Procedure: grantProcedureWidget, Costs: grantCostsWidget, Evaluation: grantGates },
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
