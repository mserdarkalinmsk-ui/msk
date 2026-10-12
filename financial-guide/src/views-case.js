/* Procurement hub: learn the essentials first, then plan your own case, then follow the stage-by-stage guide.
   Registered before the lifecycle guide so "procurement", "procurement/essentials" and "procurement/my-case"
   are matched ahead of "procurement/:stage". */
(function () {
  "use strict";
  const { esc, euro, slug, ui, route } = FG;
  const E = window.FG_ENGINES;
  const L = E.LIMITS;
  const stageLink = (name) => `#/procurement/${slug(name)}`;
  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  /* ---------- the twelve essentials (all from the Procurement Guide; €184,000 replaces €171,000) ---------- */
  const ESSENTIALS = [
    ["Value", "Three routes, set by value", "€2,000 / €6,000 · €184,000", "Up to €2,000 (goods, general services, works) or €6,000 (intellectual services): direct award. Above that: competitive bidding. From €184,000: international public call for tenders.", "Thresholds & Procedure"],
    ["Value", "Count the whole need — never split", "Full period", "The threshold is the total foreseeable value of the need, excluding VAT, over the whole period, including renewals, lots and call-offs. Artificial splitting is prohibited and is a fraud red flag.", "Thresholds & Procedure"],
    ["Competition", "Competition is the default", "3 suppliers", "Competitive bidding invites at least three potential suppliers. A direct award above the low-value limits is exceptional: unforeseen urgency not caused by the buyer, technical requirements, or considerations of fact or law.", "Market & Suppliers"],
    ["Approval", "No approval, no launch", "CCM · DLAPIL · TB", "The CCM approves the tender documents in writing. Extrabudgetary funding between €55,000 and €184,000 needs a DLAPIL Legal Compliance Review first (5 working days). International calls need Tenders Board authorisation — never retroactively.", "Authorise & Launch"],
    ["Fairness", "Criteria are fixed once published", "Locked", "Exclusion, eligibility and award criteria and their weightings cannot be changed or subdivided after publication. Price normally weighs at least 20 points.", "Tender Design"],
    ["Fairness", "Same information for everyone", "Q&A", "Answer bidders only through the published question-and-answer procedure, so every bidder has the same information at the same time. Never share details of a future call in advance.", "Authorise & Launch"],
    ["Evaluation", "Gates before scores", "3 gates", "An offer is first checked for admissibility, then exclusion, then eligibility (pass or fail). Only the remaining offers are scored against the published award criteria, with a written justification.", "Open & Evaluate"],
    ["Evaluation", "Clarify, never change an offer", "Art. 17.2", "You may ask a bidder to clarify, but the offer itself cannot change. A missing financial offer or an unsigned act of engagement cannot be fixed after opening.", "Open & Evaluate"],
    ["Award", "Sign the winner, then inform the others", "15 days", "Sign with the selected supplier first, then notify unsuccessful bidders within 15 days, disclosing only the winner's name, country and amount.", "Negotiate & Award"],
    ["Contract", "PO first, signature second, work third", "PO", "A purchase order must exist in FIMS before any contract is signed, and no supplier may start work before the Organisation has signed.", "Contract Signing"],
    ["Contract", "Amend before expiry, watch the ceiling", "€184,000", "Amendments are made before the contract expires and never change its scope. A framework contract awarded by competitive bidding must never exceed €184,000.", "Contract Management"],
    ["Integrity", "Declare, refuse, archive", "10 years", "Declare your interests every year by the end of January, accept no gifts, and keep the complete procurement file for 10 years — missing justifications are a recurring audit finding.", "Performance & Filing"],
  ];
  const known = () => FG.store.get("pr:known", {});
  const knownCount = () => Object.keys(known()).length;

  /* ---------- hub ---------- */
  route("procurement", {
    section: "procurement",
    crumbs: () => [["Projects", "projects"], ["Procurement", "procurement"]],
    render() {
      const k = knownCount(), c = FG.store.get("pcase", null), r = c && Number(c.value) ? E.procurementCase(c) : null;
      const stages = FG.C.procurementStages, last = FG.store.get("procurement:last", 0), visited = Object.keys(FG.store.get("procurement:visited", {})).length;
      const paths = [
        ["1", "Learn the essentials", "Twelve rules every buyer must know before starting — with the numbers to remember.", "procurement/essentials", `${k} of ${ESSENTIALS.length} learnt`, k / ESSENTIALS.length, 1, k ? "Continue" : "Start here"],
        ["2", "Plan my case", r ? `${esc(c.what || "Your purchase")} · ${euro(r.value)} → ${r.route}` : "Answer five questions: get your route, approvals, timeline, documents and risks.", "procurement/my-case", r ? `Start by ${fmt(r.start)}` : "Not started", r ? 1 : 0, 2, r ? "Open my case" : "Plan a case"],
        ["3", "Follow the guide", `${stages.length} stages in three phases, from preparing the need to filing.`, `procurement/${slug(stages[last].name)}`, `${visited} of ${stages.length} stages opened`, visited / stages.length, 3, visited ? `Continue at ${stages[last].name}` : "Open stage 1"],
      ];
      return { html: `${ui.head("Projects · Procurement", "Procurement", "")}
        <section class="hub-paths">${paths.map(([n, t, d, p, meta, prog, c, cta]) => `<a class="hub-path" href="#/${p}" style="--c:var(--c${c})">
          <span class="hub-n">${n}</span><h2>${t}</h2><p>${d}</p>
          <div class="hub-meta"><span>${esc(meta)}</span><i><u style="width:${Math.round(prog * 100)}%"></u></i></div><b class="hub-cta">${esc(cta)} →</b></a>`).join("")}</section>
        <section class="hub-strip card"><div><span class="eyebrow">At a glance</span><b>The three procurement routes</b></div>${FG.ui.ruler({ max: 400000, marks: [[L.lowGoods, "Goods / services"], [L.lowIntellectual, "Intellectual"], [L.legalReview, "LCR if extrabudgetary"], [L.international, "Tenders Board"]], zones: [[0, L.lowIntellectual, "Direct award", "--c2"], [L.lowIntellectual, L.international, "Competitive bidding", "--c1"], [L.international, 400000, "International public call", "--c3"]] })}</section>` };
    },
  });

  /* ---------- essentials ---------- */
  route("procurement/essentials", {
    section: "procurement",
    crumbs: () => [["Projects", "projects"], ["Procurement", "procurement"], ["Essentials", "procurement/essentials"]],
    render() {
      const kn = known(), k = knownCount();
      return { html: `${ui.head("Procurement · step 1", "The essentials", "")}
        <div class="ess-top card"><div class="ess-ring" style="--p:${Math.round((k / ESSENTIALS.length) * 100)}"><span><b>${k}</b>/${ESSENTIALS.length}</span></div>
          <div><b>Read each rule, then mark it as learnt.</b><p class="muted small">Open a rule for the detail and a link to the stage of the guide where it applies. When all twelve are learnt, test yourself at the end of the page.</p></div>
          <a class="btn primary" href="#/procurement/my-case">Next: plan my case →</a></div>
        <section class="ess-grid">${ESSENTIALS.map(([cat, title, fig, text, stage], i) => `<article class="ess${kn[i] ? " known" : ""}" style="--c:var(--c${(i % 4) + 1})">
          <header><span class="ess-cat">${String(i + 1).padStart(2, "0")} · ${esc(cat)}</span><span class="ess-fig">${esc(fig)}</span></header>
          <h3>${esc(title)}</h3><p>${esc(text)}</p>
          <footer><a href="${stageLink(stage)}">${esc(stage)} →</a><button type="button" class="ess-btn" data-known="${i}" aria-pressed="${!!kn[i]}">${kn[i] ? "✓ Learnt" : "Mark as learnt"}</button></footer></article>`).join("")}</section>` };
    },
  });
  FG.QUIZ_AT["procurement/essentials"] = "procurement";
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-known]"); if (!b) return;
    const kn = known(), i = b.dataset.known; if (kn[i]) delete kn[i]; else kn[i] = 1; FG.store.set("pr:known", kn); FG.refresh();
  });

  /* ---------- my case ---------- */
  const DEFAULT = { what: "", type: "general", value: "", funding: "ordinary", need: "oneoff", ground: "none", deadline: "" };
  function caseForm(c) {
    return `<form class="card case-form" data-case>
      <div class="card-head"><div><h3>Your purchase</h3><small>Saved in this browser only.</small></div><button type="button" class="btn sm ghost" data-case-clear>Clear</button></div>
      <div class="card-body stack">
        <label class="field"><span>What are you buying?</span><input class="input" name="what" value="${esc(c.what)}" placeholder="e.g. Translation services for the project"></label>
        ${ui.select("type", [["general", "Goods / general services / works"], ["intellectual", "Intellectual services"]], c.type, "Type of purchase")}
        ${ui.number("value", c.value, "Total foreseeable value (€, excl. VAT)", "Whole period: renewals, lots and call-offs included.")}
        ${ui.select("funding", [["ordinary", "Ordinary Budget"], ["xb", "Extrabudgetary (wholly or partly)"]], c.funding, "Funding")}
        ${ui.select("need", [["oneoff", "One-off, clearly defined"], ["recurring", "Recurring, defined units"], ["variable", "Recurring, variable or complex"]], c.need, "Nature of the need")}
        ${ui.select("ground", [["none", "No — normal competition"], ["urgency", "Unforeseen urgency not caused by us"], ["technical", "Technical requirements"], ["law", "Considerations of fact or law"]], c.ground, "Exceptional ground for a direct award?")}
        <label class="field"><span>Needed by (contract signed)</span><input class="input" type="date" name="deadline" value="${esc(c.deadline)}"></label>
      </div></form>`;
  }
  function caseResult(c) {
    if (!Number(c.value)) return `<div class="case-empty card card-pad"><b>Enter the total foreseeable value</b><p class="muted">Your route, approvals, timeline, document pack and risk radar appear here as you type.</p></div>`;
    const r = E.procurementCase(c), tl = r.timeline, t0 = tl[0].from.getTime(), t1 = tl[tl.length - 1].to.getTime(), span = Math.max(1, t1 - t0);
    const tone = { "direct-low": 2, "direct-exc": 4, competitive: 1, international: 3 }[r.key];
    return `<section class="case-hero" style="--c:var(--c${tone})"><div><small>Your route</small><h2>${esc(r.route)}</h2><p>${esc(c.what || "Your purchase")} · ${euro(r.value)} excl. VAT · ${esc(r.contract)}</p></div>
        <div class="case-kpis"><div><b>${r.approvals.length}</b><span>approval${r.approvals.length > 1 ? "s" : ""}</span></div><div><b>${r.total}</b><span>working days</span></div><div class="${r.late ? "bad" : ""}"><b>${fmt(r.start)}</b><span>${r.late ? "should have started" : r.deadline ? "start at the latest" : "earliest signature " + fmt(tl[tl.length - 1].to)}</span></div></div></section>
      <section class="next-act"><span aria-hidden="true">→</span><div><small>Your first action${r.deadline ? ` · finish by ${fmt(r.nextAction.by)}` : ""}</small><b>${esc(r.nextAction.title)}</b><p>${esc(r.nextAction.text)}</p></div><em class="${r.eproc.mandatory ? "on" : ""}">${r.eproc.mandatory ? "e-procurement: mandatory" : "e-procurement: not required"}</em></section>
      <section class="card"><div class="card-head"><div><h3>Approval map</h3><small>Who validates, in this order.</small></div></div>
        <ol class="chain">${r.approvals.map(([who, what], i) => `<li><span>${i + 1}</span><div><b>${esc(who)}</b><p>${esc(what)}</p></div></li>`).join("")}</ol></section>
      <section class="card"><div class="card-head"><div><h3>Timeline</h3><small>${r.deadline ? `Reverse-scheduled from ${fmt(r.deadline)}.` : "Forward from today — add a date to plan backwards."} <span class="lg src">Guide</span> durations come from the Procurement Guide; <span class="lg assumed">Planning</span> durations are assumptions to adjust with your unit.</small></div></div>
        <div class="gantt">${tl.map((s) => `<div class="g-row"><span class="g-lab">${esc(s.label)}<small>${s.days} wd · ${fmt(s.from)} → ${fmt(s.to)}</small></span><span class="g-track"><i class="${s.basis}" style="left:${((s.from - t0) / span) * 100}%;width:${Math.max(1.5, ((s.to - s.from) / span) * 100)}%"></i></span></div>`).join("")}</div></section>
      <section class="card"><div class="card-head"><div><h3>Risk radar</h3><small>Specific to this case.</small></div></div>
        <div class="radar">${r.risks.length ? r.risks.map(([lvl, t, d]) => `<div class="rk ${lvl}"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join("") : `<p class="muted">No specific risk detected for these facts.</p>`}</div></section>
      ${ui.checklist(`pcase:${r.key}`, r.docs, "Document pack")}
      <section class="card"><div class="card-head"><div><h3>Your stages</h3><small>The guide, filtered for this route.</small></div></div>
        <div class="case-stages">${FG.C.procurementStages.map((s, i) => { const st = r.skip.includes(s.name) ? "skip" : r.keyStages.includes(s.name) ? "key" : ""; return `<a class="cs ${st}" href="${stageLink(s.name)}"><em>${i + 1}</em><span>${esc(s.name)}</span>${st === "skip" ? "<small>Not needed</small>" : st === "key" ? "<small>Key for you</small>" : ""}</a>`; }).join("")}</div></section>
      <div class="row no-print"><button type="button" class="btn" data-case-print>Print case summary</button><a class="btn primary" href="${stageLink((FG.C.procurementStages.find((s) => r.keyStages.includes(s.name)) || FG.C.procurementStages[0]).name)}">Go to my first key stage →</a></div>`;
  }
  FG.procurementCase = () => { const c = FG.store.get("pcase", null); return c && Number(c.value) ? E.procurementCase(c) : null; };
  route("procurement/my-case", {
    section: "procurement",
    crumbs: () => [["Projects", "projects"], ["Procurement", "procurement"], ["My case", "procurement/my-case"]],
    render() {
      const c = { ...DEFAULT, ...FG.store.get("pcase", {}) };
      return { html: `${ui.head("Procurement · step 2", "Plan my case", "")}<div class="case-layout">${caseForm(c)}<div class="case-out stack" id="caseOut">${caseResult(c)}</div></div>`,
        mount(root) {
          const form = root.querySelector("[data-case]"), out = root.querySelector("#caseOut");
          // Results update in place while typing; the form itself is never re-rendered.
          form.addEventListener("input", () => { const v = Object.fromEntries(new FormData(form)); FG.store.set("pcase", v); out.innerHTML = caseResult(v); if (FG.enrich) FG.enrich(out); });
          root.querySelector("[data-case-clear]").onclick = () => { FG.store.set("pcase", null); FG.refresh(); };
          root.addEventListener("click", (e) => { if (e.target.closest("[data-case-print]")) window.print(); });
        } };
    },
  });
})();
