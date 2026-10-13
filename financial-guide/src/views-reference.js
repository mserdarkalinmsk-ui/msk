/* Reference layer: glossary with inline tooltips, rulebook with an interactive decision tree, stage quizzes. */
(function () {
  "use strict";
  const { C, esc, euro, ui, route } = FG;
  const E = window.FG_ENGINES;

  // Definitions are taken from how the guide itself uses each term.
  FG.GLOSSARY = [
    ["ACCM", "Finance support role", "Checks financial and file completeness, supports the budgetary commitment and creates the PO or mission order when the file is ready."],
    ["AoE", "Act of Engagement", "Contractual document signed by the supplier/consultant, used with the Order Form (e.g. for direct awards)."],
    ["AWP", "Activities Work Plan", "Approved plan of activities. Once approved, it allows limited flexibility above the activity budget; it should cover the implementation period and be reviewed periodically."],
    ["CCA", "Prepaid expense", "The part of a split 2026–2027 service charged to the next year under the year-end allocation table."],
    ["CCM", "Commitments Officer", "Exercises expenditure and procurement approval within the applicable delegation; validates POs, authorises negotiation in competitive bidding, approves petty cash before spending."],
    ["DLAPIL", "Legal compliance review", "Provides the Legal Compliance Review required before CCM approval for extrabudgetary or mixed funding from €55,000 to below €184,000, and advises on changes to legal contractual clauses."],
    ["DMS", "Document Management System", "Where the project file is organised: contract documents, activities, POs, signed and editable versions together."],
    ["FA", "Framework agreement", "Pool of preselected suppliers; each specific need is awarded through a mini-competition (call-off). Generally up to 4 years."],
    ["FC", "Framework contract", "Recurring need with definable units and fixed unit prices; orders are placed with order forms. Generally up to 4 years."],
    ["FIMS", "Financial system", "System where expenditure is recorded; check “Amount billed” / “Invoices” on the Fiche PO before finalising a PO."],
    ["JP", "Joint Programme", "Jointly funded programme. A Budget Heading variation above ±25%, or a change in total cost, duration or scope, requires an Addendum."],
    ["OB", "Ordinary Budget", "Organisation's regular budget. Petty cash invoices may not exceed €50 each."],
    ["PO", "Purchase order", "Financial commitment. No activity should start until the PO is opened, signatures are collected and the provider holds the countersigned documents."],
    ["ToR", "Terms of Reference", "Specification of the requirement: context, objective, deliverables, timing and technical requirements."],
    ["VC", "Voluntary Contribution", "Voluntary funding; budget revisions follow the VC route, with donor acceptance where funding is earmarked."],
    ["XB", "Extrabudgetary funding", "Funding outside the Ordinary Budget. From €55,000 it adds a Legal Compliance Review before CCM approval."],
    ["Addendum", "Formal contract amendment", "Contractual revision of a JP budget/agreement requiring external acceptance before implementation."],
    ["Notification", "Formal notification route", "JP budget change route where every relevant Budget Heading stays within ±25% and no contractual element changes."],
    ["Budget Heading", "Budget subtotal", "Grouping of budget lines (e.g. 1 Human resources, 2 Travel). The ±25% test is applied at this level, not to the project total."],
    ["Tenders Board", "Governance body", "Authorises launch, negotiation and award for international public calls for tenders (≥ €184,000)."],
  ];
  const TERMS = FG.GLOSSARY.filter(([t]) => t.length <= 6 && /^[A-Z]+$/.test(t));
  const termRe = new RegExp(`\\b(${TERMS.map(([t]) => t).join("|")})\\b|(€\\s?\\d[\\d,.]*(?:\\s?k)?|[±≥≤<>]?\\s?\\d+(?:\\.\\d+)?\\s?%)`, "g");
  const defs = Object.fromEntries(FG.GLOSSARY.map(([t, n, d]) => [t, `${n} — ${d}`]));

  // Mark acronyms (tooltip + link to glossary) and amounts in rendered guidance text.
  FG.enrich = function (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.parentElement.closest("input,select,textarea,button,a,abbr,mark,script,style,.kpi,table.t thead,h1,.nav,.no-enrich,.opts,.scale,.donut,.pace,.fx-hero,.hp,.fx-hubs,.mem,.va-scale,.vc-track,.qz-card,.qz-end,.qz-miss,.rf,.lanes,.specials,.sh-fig,.lf-left,.lf-q,.lf-dots,.ess-fig,.ess-ring,.case-hero,.case-kpis,.g-lab,.hub-path,.ucf,.ruler,.pj-kpis,.pj-flow,.pj-chev,.progress-head,.tag,.tn,.tb") && termRe.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    const seen = new Set();
    for (const node of nodes) {
      const frag = document.createDocumentFragment(); let last = 0; const text = node.nodeValue;
      text.replace(termRe, (m, term, amount, i) => {
        frag.append(text.slice(last, i)); last = i + m.length;
        if (term) {
          if (seen.has(term)) { frag.append(m); return m; }
          seen.add(term);
          const a = document.createElement("abbr"); a.title = defs[term]; a.textContent = m; a.tabIndex = 0; frag.append(a);
        } else { const k = document.createElement("mark"); k.className = "amt"; k.textContent = m; frag.append(k); }
        return m;
      });
      termRe.lastIndex = 0;
      frag.append(text.slice(last)); node.replaceWith(frag);
    }
  };

  // Inline quiz built from the scenario bank; answers are shared with the Scenario practice page.
  FG.ui.quiz = function (cat, n = 3) {
    const answers = FG.store.get("scenarioAnswers", {});
    const list = C.scenarios.map((x, i) => ({ ...x, i })).filter((x) => x.cat === cat).sort((a, b) => (a.level === b.level ? 0 : a.level === "basic" ? -1 : 1)).slice(0, n);
    if (!list.length) return "";
    const ok = list.filter((x) => answers[x.i] && answers[x.i].ok).length;
    const open = FG.quizOpen === cat ? " open" : "";
    return `<details class="mq no-enrich no-print"${open}><summary><span class="mq-ico" aria-hidden="true">?</span><span><b>Check yourself</b><small>${list.length} short questions on this module</small></span>${ui.tag(`${ok}/${list.length} correct`, ok === list.length ? "good" : "")}</summary>
      <div class="mq-body">${list.map((x, n) => { const a = answers[x.i];
      return `<div class="mq-q"><b>${n + 1}. ${esc(x.title)}</b><p class="small muted">${esc(x.q)}</p><div class="opts">${x.opts.map((o, k) => `<button type="button" data-qz="${x.i}" data-cat="${cat}" data-opt="${k}" ${a ? "disabled" : ""} class="${a ? (k === x.correct ? "right" : k === a.choice ? "wrong" : "") : ""}">${esc(o)}</button>`).join("")}</div>${a ? `<p class="small muted">${a.ok ? "✓" : "✕"} ${esc(x.feedback)}</p>` : ""}</div>`; }).join("")}
      <a class="small" href="#/scenarios">More practice scenarios →</a></div></details>`;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-qz]"); if (!b) return;
    const i = +b.dataset.qz, k = +b.dataset.opt, all = FG.store.get("scenarioAnswers", {});
    all[i] = { choice: k, ok: k === C.scenarios[i].correct }; FG.store.set("scenarioAnswers", all); FG.quizOpen = b.dataset.cat; FG.refresh();
  });

  /* ---------- glossary ---------- */
  route("glossary", {
    crumbs: () => [["Glossary", "glossary"]],
    render() {
      const q = FG.store.get("gl:q", "");
      const list = FG.GLOSSARY.filter(([t, n, d]) => !q || `${t} ${n} ${d}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a[0].localeCompare(b[0]));
      return { html: `${ui.head("Reference", "Glossary", "Terms and abbreviations used across the guide. Underlined terms in any page show this definition on hover.", `<input class="input" style="width:240px" type="search" data-gq placeholder="Find a term" aria-label="Find a term" value="${esc(q)}">`)}
        <div class="glossary">${list.map(([t, n, d]) => `<article class="card card-pad no-enrich" id="g-${esc(t)}"><div class="row"><b class="term">${esc(t)}</b><span class="muted">${esc(n)}</span></div><p class="mt">${esc(d)}</p></article>`).join("") || `<div class="empty"><b>No term found</b></div>`}</div>`,
        mount(root) { const i = root.querySelector("[data-gq]"); i.addEventListener("input", () => { FG.store.set("gl:q", i.value); FG.refresh(); const n = document.querySelector("[data-gq]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); } };
    },
  });
  FG.GLOSSARY.forEach(([t, n, d]) => FG.addIndex(`${t} — ${n}`, d, "glossary", "Term"));

  /* ---------- rulebook ---------- */
  const RULES = [
    ["Procurement", "procurement/thresholds-and-procedure", [
      ["Direct award", "≤ €2,000 goods / general services / works · ≤ €6,000 intellectual services", "Ch. 4.5–4.6"],
      ["Competitive bidding", "Above the low-value limit and below €184,000; invite at least three potential suppliers", "Ch. 4.5–4.6"],
      ["International public call", "≥ €184,000 total foreseeable need; Tenders Board launch and award. Use it if there is even a slight risk of reaching the threshold", "Ch. 4.5–4.6"],
      ["Legal Compliance Review", "Extrabudgetary or mixed funding, €55,000 to < €184,000 — before CCM approval; does not replace the procedure", "Ch. 4.5–4.6"],
      ["Public prices", "Below €10,000 within competitive bidding: compare public prices of 3+ suppliers and archive screenshots", "Ch. 4.5–4.6"],
      ["Aggregation", "Value = full need over the period: duration, renewals, lots, options, order forms and call-offs. No splitting", "Ch. 4.5"],
      ["Framework duration", "Framework contracts and agreements generally ≤ 4 years, 5 only exceptionally", "Ch. 3.1–3.4"],
      ["Negotiation", "CCM authorises in competitive bidding, Tenders Board in an international call; specifications must not change significantly", "Ch. 4.9.7 & 4.9.9"]]],
    ["Grants", "grants/procedure", [
      ["Direct award", "Total procedure budget below €15,000 — template G9.2A", "Rule 1374"],
      ["Competitive call", "€15,000 or more — call for proposals, Evaluation Committee, decision and notifications", "Rule 1374"],
      ["Exceptional direct award", "At or above €15,000 only under strictly interpreted exceptions — template G9.2B", "Rule 1374"],
      ["Threshold basis", "Total budget of the grant-award procedure, never the amount per grantee", "Rule 1374"],
      ["Indirect costs", "Only where foreseen in the call/agreement, maximum 7%", "Art. 6–7"],
      ["Operational grants", "Should not normally exceed twelve consecutive months", "Rule 1374"]]],
    ["Budget revision", "engines/budget-revision", [
      ["JP — Notification", "Every relevant Budget Heading within ±25% and no contractual change", "Forecast guidance"],
      ["JP — Addendum", "Any Budget Heading above ±25%, or a change in total cost, duration or scope", "Forecast guidance"],
      ["Units & new lines", "Exceeded approved units, a changed unit basis or a new budget line need formal review", "Forecast guidance"],
      ["VC", "Earmarked funding requires donor acceptance; otherwise internal / programming confirmation", "Forecast guidance"]]],
    ["Payments & year-end", "year-end", [
      ["Start of work", "No activity before the PO is opened, signatures collected and countersigned documents sent", "PO file"],
      ["Payment", "Only after delivery/acceptance is evidenced and the invoice matches the contractual basis", "Payment file"],
      ["2026 expenditure", "Only goods delivered / services rendered by 31 December 2026", "2026 closing"],
      ["PO finalisation", "Once all expenditure is recorded in FIMS — payment itself is not required first", "2026 closing"],
      ["Petty cash", "€50 per invoice · CCM approval before spending · no splitting", "Petty cash"]]],
  ];
  // Decision tree drawn as connected nodes; the path for the entered case lights up.
  function tree(v) {
    const amount = Number(v.amount) || 0, low = v.type === "intellectual" ? 6000 : 2000, xb = v.funding === "xb";
    const path = amount <= low ? "direct" : amount >= 184000 ? "intl" : xb && amount >= 55000 ? "cbl" : "cb";
    const node = (id, title, sub, cls = "") => `<div class="tn ${cls} ${path === id ? "on" : ""}"><b>${title}</b><small>${sub}</small></div>`;
    return `<div class="dtree" role="img" aria-label="Procurement decision tree; current route highlighted">
      <div class="tn root on"><b>${amount ? euro(amount) : "Total foreseeable value"}</b><small>${v.type === "intellectual" ? "Intellectual services" : "Goods / general services / works"} · ${xb ? "XB / mixed" : "Ordinary Budget"}</small></div>
      <div class="tbranches">
        <div class="tb ${path === "direct" ? "on" : ""}"><span>≤ ${euro(low)}</span>${node("direct", "Direct Award", "CCM validation · document value for money", "good")}</div>
        <div class="tb ${path === "cb" || path === "cbl" ? "on" : ""}"><span>${euro(low)} – €184,000</span>${node("cb", "Competitive Bidding", "≥ 3 suppliers invited")}${xb ? node("cbl", "+ Legal Compliance Review", "from €55,000, before CCM approval", "warn") : ""}</div>
        <div class="tb ${path === "intl" ? "on" : ""}"><span>≥ €184,000</span>${node("intl", "International Public Call", "Tenders Board · e-procurement", "risk")}</div>
      </div></div>`;
  }
  route("rules", {
    crumbs: () => [["Rules at a glance", "rules"]],
    render() {
      const v = FG.store.get("tree", { amount: 72000, type: "general", funding: "xb" });
      return { html: `${ui.head("Reference", "Rules at a glance", "Every threshold and route in the guide on one page, with its source. Open a module for the full guidance.", `<button class="btn" onclick="print()">Print</button>`)}
        <section class="card"><div class="card-head"><div><h3>Procurement procedure — decision tree</h3><small>Enter the case; the applicable branch lights up.</small></div><a class="btn sm" href="#/engines/procurement">Full engine</a></div><div class="card-body stack">
          <form class="grid g3" data-tree>${ui.number("amount", v.amount, "Total foreseeable value (€, excl. VAT)")}${ui.select("type", [["general", "Goods / general services / works"], ["intellectual", "Intellectual services"]], v.type, "Purchase type")}${ui.select("funding", [["ordinary", "Ordinary Budget"], ["xb", "Extrabudgetary / mixed"]], v.funding, "Funding")}</form>
          <div id="treeOut">${tree(v)}</div></div></section>
        ${RULES.map(([title, path, rows]) => `<section class="card mt"><div class="card-head"><h3>${esc(title)}</h3><a class="btn sm" href="#/${path}">Open →</a></div><div class="card-body"><div class="table-wrap"><table class="t"><thead><tr><th>Rule</th><th>What applies</th><th>Source</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="muted">${esc(r[2])}</td></tr>`).join("")}</tbody></table></div></div></section>`).join("")}`,
        mount(root) { const f = root.querySelector("[data-tree]"); f.addEventListener("input", () => { const val = Object.fromEntries(new FormData(f)); FG.store.set("tree", val); root.querySelector("#treeOut").innerHTML = tree(val); }); } };
    },
  });
  RULES.forEach(([t, , rows]) => rows.forEach((r) => FG.addIndex(`${r[0]} (${t})`, r[1], "rules", "Rule", r[2])));
  void E;
})();
