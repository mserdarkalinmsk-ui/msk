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
    ["Value", "Three routes, set by value", "€2,000 / €6,000 · €184,000", "Up to €2,000 (goods, general services, works) or €6,000 (intellectual services): direct award. Above that: competitive bidding. From €184,000: international public call for tenders.", "Thresholds & Procedure", ["A \u20ac4,000 translation service (an intellectual service) can be awarded directly.", true, "Yes: the direct-award ceiling is \u20ac6,000 for intellectual services."]],
    ["Value", "Count the whole need — never split", "Full period", "The threshold is the total foreseeable value of the need, excluding VAT, over the whole period, including renewals, lots and call-offs. Artificial splitting is prohibited and is a fraud red flag.", "Thresholds & Procedure", ["Three yearly contracts of \u20ac70,000 for the same need can each follow competitive bidding.", false, "No: the whole need is \u20ac210,000 over the period, so it is an international public call."]],
    ["Competition", "Competition is the default", "3 suppliers", "Competitive bidding invites at least three potential suppliers. A direct award above the low-value limits is exceptional: unforeseen urgency not caused by the buyer, technical requirements, or considerations of fact or law.", "Market & Suppliers", ["Above the low-value limit, a direct award is allowed whenever the buyer prefers a supplier.", false, "No: only for unforeseen urgency not caused by the buyer, technical requirements, or fact or law."]],
    ["Approval", "No approval, no launch", "CCM · DLAPIL · TB", "The CCM approves the tender documents in writing. Extrabudgetary funding between €55,000 and €184,000 needs a DLAPIL Legal Compliance Review first (5 working days). International calls need Tenders Board authorisation — never retroactively.", "Authorise & Launch", ["The Tenders Board can approve the launch of an international call after it has been published.", false, "No: the Tenders Board cannot approve a launch retroactively."]],
    ["Fairness", "Criteria are fixed once published", "Locked", "Exclusion, eligibility and award criteria and their weightings cannot be changed or subdivided after publication. Price normally weighs at least 20 points.", "Tender Design", ["Award weightings may be adjusted after opening if the offers are very different.", false, "No: criteria and weightings are locked once the call is published."]],
    ["Fairness", "Same information for everyone", "Q&A", "Answer bidders only through the published question-and-answer procedure, so every bidder has the same information at the same time. Never share details of a future call in advance.", "Authorise & Launch", ["A bidder who phones with a question can be answered directly to save time.", false, "No: answers go through the published Q&A so every bidder gets the same information."]],
    ["Evaluation", "Gates before scores", "3 gates", "An offer is first checked for admissibility, then exclusion, then eligibility (pass or fail). Only the remaining offers are scored against the published award criteria, with a written justification.", "Open & Evaluate", ["An offer that fails an eligibility criterion is still scored on the award criteria.", false, "No: eligibility is pass or fail; only eligible offers are scored."]],
    ["Evaluation", "Clarify, never change an offer", "Art. 17.2", "You may ask a bidder to clarify, but the offer itself cannot change. A missing financial offer or an unsigned act of engagement cannot be fixed after opening.", "Open & Evaluate", ["A missing financial offer can be requested from the bidder after opening.", false, "No: you may clarify an offer, never complete or change it."]],
    ["Award", "Sign the winner, then inform the others", "15 days", "Sign with the selected supplier first, then notify unsuccessful bidders within 15 days, disclosing only the winner's name, country and amount.", "Negotiate & Award", ["Unsuccessful bidders are informed before the contract with the winner is signed.", false, "No: sign with the winner first, then inform the others within 15 days."]],
    ["Contract", "PO first, signature second, work third", "PO", "A purchase order must exist in FIMS before any contract is signed, and no supplier may start work before the Organisation has signed.", "Contract Signing", ["A supplier may start work once the CCM has approved the award, before the PO exists.", false, "No: PO first, signature second, work third."]],
    ["Contract", "Amend before expiry, watch the ceiling", "€184,000", "Amendments are made before the contract expires and never change its scope. A framework contract awarded by competitive bidding must never exceed €184,000.", "Contract Management", ["A framework contract awarded by competitive bidding may grow to \u20ac200,000 through amendments.", false, "No: it must never exceed \u20ac184,000."]],
    ["Integrity", "Declare, refuse, archive", "10 years", "Declare your interests every year by the end of January, accept no gifts, and keep the complete procurement file for 10 years — missing justifications are a recurring audit finding.", "Performance & Filing", ["The procurement file must be kept for 10 years.", true, "Yes: missing justifications are a recurring audit finding."]],
  ];
  const known = () => FG.store.get("pr:known", {});
  const knownCount = () => Object.keys(known()).length;


  /* ---------- learning flow: one rule at a time, confirmed by a true/false check ---------- */
  function learnPage(list, set, base, nextHref, nextLabel) {
    const kn = FG.store.get(set, {}), k = Object.keys(kn).length, ans = FG.store.get(set + ":ans", {});
    let i = FG.store.get(set + ":at", 0); if (i >= list.length) i = 0;
    const [cat, title, fig, text, stage, q] = list[i], a = ans[i];
    const done = k === list.length;
    return `<div class="lf">
      <div class="lf-dots" role="tablist">${list.map((x, j) => `<button type="button" data-lf="${j}" data-set="${set}" class="${kn[j] ? "ok" : ""}${j === i ? " on" : ""}" aria-label="Rule ${j + 1}: ${esc(x[1])}">${kn[j] ? "✓" : j + 1}</button>`).join("")}<span>${k} / ${list.length} learnt</span></div>
      <article class="lf-card" style="--c:var(--c${(i % 4) + 1})">
        <div class="lf-left"><span class="lf-cat">Rule ${i + 1} · ${esc(cat)}</span><div class="lf-fig">${esc(fig)}</div></div>
        <div class="lf-main"><h2>${esc(title)}</h2><p>${esc(text)}</p>
          <div class="lf-q"><small>Check yourself</small><b>${esc(q[0])}</b>
            <div class="lf-btns">${[["true", "True"], ["false", "False"]].map(([v, l]) => `<button type="button" data-lfa="${v}" data-i="${i}" data-set="${set}" class="${a ? (String(q[1]) === v ? "right" : a === v ? "wrong" : "") : ""}" ${a ? "disabled" : ""}>${l}</button>`).join("")}</div>
            ${a ? `<p class="lf-fb ${a === String(q[1]) ? "good" : "bad"}">${a === String(q[1]) ? "Correct. " : "Not quite. "}${esc(q[2])}${a !== String(q[1]) ? ` <button type="button" class="lf-retry" data-lfr="${i}" data-set="${set}">Try again</button>` : ""}</p>` : ""}</div>
          <footer><a href="#/${base}/${slug(stage)}">Read more in “${esc(stage)}” →</a>
            <span>${i ? `<button type="button" class="btn sm ghost" data-lf="${i - 1}" data-set="${set}">← Previous</button>` : ""}${i < list.length - 1 ? `<button type="button" class="btn sm primary" data-lf="${i + 1}" data-set="${set}">Next rule →</button>` : `<a class="btn sm primary" href="${nextHref}">${nextLabel} →</a>`}</span></footer></div>
      </article>
      ${done ? `<div class="lf-done"><b>All ${list.length} rules learnt.</b> <a href="${nextHref}">${nextLabel} →</a></div>` : ""}</div>`;
  }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-lf]"), ans = e.target.closest("[data-lfa]"), retry = e.target.closest("[data-lfr]");
    if (retry) { const all = FG.store.get(retry.dataset.set + ":ans", {}); delete all[retry.dataset.lfr]; FG.store.set(retry.dataset.set + ":ans", all); FG.refresh(); }
    if (go) { FG.store.set(go.dataset.set + ":at", +go.dataset.lf); FG.refresh(); }
    if (ans) {
      const set = ans.dataset.set, i = ans.dataset.i, all = FG.store.get(set + ":ans", {}); all[i] = ans.dataset.lfa; FG.store.set(set + ":ans", all);
      const list = set === "pr:known" ? ESSENTIALS : G_ESSENTIALS, right = String(list[i][5][1]) === ans.dataset.lfa;
      if (right) { const kn = FG.store.get(set, {}); kn[i] = 1; FG.store.set(set, kn); }
      FG.refresh();
    }
  });

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
        <a class="hub-ref" href="#/procurement/reference"><span>§</span><div><b>Quick reference</b><small>Contract types · limits & deadlines · roles · how-to instructions</small></div><u>Open →</u></a>
        <section class="hub-strip card"><div><span class="eyebrow">At a glance</span><b>The three procurement routes</b></div>${FG.ui.ruler({ max: 400000, marks: [[L.lowGoods, "Goods / services"], [L.lowIntellectual, "Intellectual"], [L.legalReview, "LCR if extrabudgetary"], [L.international, "Tenders Board"]], zones: [[0, L.lowIntellectual, "Direct award", "--c2"], [L.lowIntellectual, L.international, "Competitive bidding", "--c1"], [L.international, 400000, "International public call", "--c3"]] })}</section>` };
    },
  });

  /* ---------- essentials ---------- */
  route("procurement/essentials", {
    section: "procurement",
    crumbs: () => [["Projects", "projects"], ["Procurement", "procurement"], ["Essentials", "procurement/essentials"]],
    render: () => ({ html: `${ui.head("Procurement · step 1 · learn one rule at a time", "The essentials", "")}${learnPage(ESSENTIALS, "pr:known", "procurement", "#/procurement/my-case", "Plan my case")}` }),
  });;
  FG.QUIZ_AT["procurement/essentials"] = "procurement";
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-known]"); if (!b) return; // legacy toggle
    const set = b.dataset.set, kn = FG.store.get(set, {}), i = b.dataset.known; if (kn[i]) delete kn[i]; else kn[i] = 1; FG.store.set(set, kn); FG.refresh();
  });

  /* ---------- shared case widgets ---------- */
  const nextHtml = (r, badge) => `<section class="next-act"><span aria-hidden="true">→</span><div><small>Your first action${r.deadline ? ` · finish by ${fmt(r.nextAction.by)}` : ""}</small><b>${esc(r.nextAction.title)}</b><p>${esc(r.nextAction.text)}</p></div>${badge || ""}</section>`;
  const chainHtml = (title, sub, list) => `<section class="card"><div class="card-head"><div><h3>${title}</h3><small>${sub}</small></div></div>
    <ol class="chain">${list.map(([who, what], i) => `<li><span>${i + 1}</span><div><b>${esc(who)}</b><p>${esc(what)}</p></div></li>`).join("")}</ol></section>`;
  function ganttHtml(r, source) {
    const tl = r.timeline, t0 = tl[0].from.getTime(), span = Math.max(1, tl[tl.length - 1].to.getTime() - t0);
    return `<section class="card"><div class="card-head"><div><h3>Timeline</h3><small>${r.deadline ? `Reverse-scheduled from ${fmt(r.deadline)}.` : "Forward from today — add a date to plan backwards."} <span class="lg src">Guide</span> durations come from ${source}; <span class="lg assumed">Planning</span> durations are assumptions to adjust with your unit.</small></div></div>
      <div class="gantt">${tl.map((x) => `<div class="g-row"><span class="g-lab">${esc(x.label)}<small>${x.days} wd · ${fmt(x.from)} → ${fmt(x.to)}</small></span><span class="g-track"><i class="${x.basis}" style="left:${((x.from - t0) / span) * 100}%;width:${Math.max(1.5, ((x.to - x.from) / span) * 100)}%"></i></span></div>`).join("")}</div></section>`;
  }
  const radarHtml = (r) => `<section class="card"><div class="card-head"><div><h3>Risk radar</h3><small>Specific to this case.</small></div></div>
    <div class="radar">${r.risks.length ? r.risks.map(([lvl, t, d]) => `<div class="rk ${lvl}"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join("") : `<p class="muted">No specific risk detected for these facts.</p>`}</div></section>`;
  const stagesHtml = (r, stages, base) => `<section class="card"><div class="card-head"><div><h3>Your stages</h3><small>The guide, filtered for this route.</small></div></div>
    <div class="case-stages">${stages.map((x, i) => { const st = r.skip.includes(x.name) ? "skip" : r.keyStages.includes(x.name) ? "key" : ""; return `<a class="cs ${st}" href="#/${base}/${slug(x.name)}"><em>${i + 1}</em><span>${esc(x.name)}</span>${st === "skip" ? "<small>Not needed</small>" : st === "key" ? "<small>Key for you</small>" : ""}</a>`; }).join("")}</div></section>`;
  const heroHtml = (tone, route, line, kpis) => `<section class="case-hero" style="--c:var(--c${tone})"><div><small>Your route</small><h2>${esc(route)}</h2><p>${line}</p></div><div class="case-kpis">${kpis.map(([b, t, bad]) => `<div class="${bad ? "bad" : ""}"><b>${b}</b><span>${t}</span></div>`).join("")}</div></section>`;

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
    const r = E.procurementCase(c), tl = r.timeline, tone = { "direct-low": 2, "direct-exc": 4, competitive: 1, international: 3 }[r.key];
    return `${heroHtml(tone, r.route, `${esc(c.what || "Your purchase")} · ${euro(r.value)} excl. VAT · ${esc(r.contract)}`, [[r.approvals.length, `approval${r.approvals.length > 1 ? "s" : ""}`], [r.total, "working days"], [fmt(r.start), r.late ? "should have started" : r.deadline ? "start at the latest" : "earliest signature " + fmt(tl[tl.length - 1].to), r.late]])}
      ${nextHtml(r, `<em class="${r.eproc.mandatory ? "on" : ""}">${r.eproc.mandatory ? "e-procurement: mandatory" : "e-procurement: not required"}</em>`)}
      ${chainHtml("Approval map", "Who validates, in this order.", r.approvals)}
      ${ganttHtml(r, "the Procurement Guide")}
      ${radarHtml(r)}
      ${ui.checklist(`pcase:${r.key}`, r.docs, "Document pack")}
      ${stagesHtml(r, FG.C.procurementStages, "procurement")}
      <div class="row no-print"><button type="button" class="btn" data-case-print>Print case summary</button><a class="btn primary" href="${stageLink((FG.C.procurementStages.find((x) => r.keyStages.includes(x.name)) || FG.C.procurementStages[0]).name)}">Go to my first key stage →</a></div>`;
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

  /* =================== GRANTS (Rule 1374) =================== */
  const G_ESSENTIALS = [
    ["Purpose", "Two purposes, both required", "2", "A grant must both help the grantee reach its own objectives and advance the Organisation's values or policies. Both conditions are cumulative.", "Foundations", ["A grant that only advances the Council's own objectives, without helping the grantee, is valid.", false, "No: both purposes are required."]],
    ["Value", "€15,000 decides the procedure", "€15,000", "Below €15,000 the Commitments Officer may award directly (G9.2A). From €15,000 a published call for proposals is the rule.", "Procedure", ["A single grant of \u20ac12,000 may be awarded directly with Template G9.2A.", true, "Yes: below \u20ac15,000 the Commitments Officer may award directly."]],
    ["Value", "Count the whole procedure", "5 × €10,000", "The threshold is the total budget of the procedure, not each grant: five grants of €10,000 make €50,000, so a call is required.", "Principles", ["Five grants of \u20ac10,000 can each be awarded directly because each is below \u20ac15,000.", false, "No: the procedure totals \u20ac50,000, so a call is required."]],
    ["Value", "Exceptions are strict", "Art. 2.1.3", "From €15,000 a direct award needs an exceptional circumstance — an unforeseeable emergency, grantee characteristics making a call impossible, or an action leaving no scope for a call — justified in G9.2B.", "Procedure", ["From \u20ac15,000, a direct award is possible whenever the call would take too long.", false, "No: only the strict exceptional circumstances of Article 2.1.3."]],
    ["Money", "The Council never pays everything", "Co-financing", "The grantee contributes own or third-party resources: staff, contributions in kind or income generated by the action.", "Principles", ["The Council may finance 100% of a project if the grantee has no resources.", false, "No: co-financing is required (staff, in kind or income generated)."]],
    ["Money", "No retroactivity, no profit, one grant", "1", "Costs cannot be incurred before the closing date for proposals, total funding cannot exceed the budgeted expenses, and one action receives only one grant.", "Principles", ["Costs incurred before the closing date for proposals can be eligible.", false, "No: there is no retroactivity."]],
    ["Money", "Eligible costs pass seven tests", "7% indirect", "Necessary, value for money, incurred in the period, recorded and verifiable, tax-compliant, supported by documents and in the budget. Indirect costs are capped at 7%.", "Costs", ["Indirect costs may reach 10% of the eligible costs.", false, "No: indirect eligible costs are capped at 7%."]],
    ["Roles", "Decide, run, evaluate", "CO · Co-ordinator · Committee", "The Commitments Officer decides and signs, the Co-ordinator (G3.1) runs the procedure, the Evaluation Committee (G13.1) evaluates — with conflict-of-interest declarations (G13.4).", "Roles", ["The Co-ordinator decides on the award of the grants.", false, "No: the Commitments Officer decides; the Co-ordinator runs the procedure."]],
    ["Fairness", "Criteria are published and fixed", "Weighted", "Exclusion, eligibility and weighted award criteria are set in the call and cannot be changed afterwards. Clarifications must never improve a proposal.", "Criteria", ["A clarification request may let an applicant improve its proposal.", false, "No: clarifications must never change the substance of a proposal."]],
    ["Selection", "Score 0–5, decide with reasons", "0–5", "Each member scores every criterion 0–5 (G14.3); the consensus report (G14.4) averages them; the Commitments Officer decides with reasons (G14.6).", "Evaluation", ["Each Evaluation Committee member scores every award criterion from 0 to 5.", true, "Yes: G14.3, averaged in the consensus report G14.4."]],
    ["Selection", "Inform within 15 days", "15 days", "Unsuccessful applicants are informed within 15 calendar days and may enquire; a complaint can follow within 30 days of the reply.", "Complaints", ["Unsuccessful applicants must be informed within 15 calendar days.", true, "Yes, and they may then enquire and complain."]],
    ["Agreement", "Always in writing, never more money", "G17.2", "The grant agreement is always written (G17.2A or G17.2B). Amendments may change management details but never increase the total grant.", "Agreement", ["An amendment can increase the total grant if the project grows.", false, "No: amendments never increase the total amount."]],
  ];
  const gKnown = () => FG.store.get("gr:known", {});
  route("grants", {
    section: "grants",
    crumbs: () => [["Projects", "projects"], ["Grants", "grants"]],
    render() {
      const k = Object.keys(gKnown()).length, c = FG.store.get("gcase", null), r = c && Number(c.budget) ? E.grantCase(c) : null;
      const stages = FG.C.grantStages, last = FG.store.get("grants:last", 0), visited = Object.keys(FG.store.get("grants:visited", {})).length;
      const paths = [
        ["1", "Learn the essentials", "Twelve rules of Rule 1374 to know before designing any grant.", "grants/essentials", `${k} of ${G_ESSENTIALS.length} learnt`, k / G_ESSENTIALS.length, 1, k ? "Continue" : "Start here"],
        ["2", "Plan my grant", r ? `${esc(c.what || "Your grant")} · ${euro(r.budget)} → ${r.route}` : "Five questions: route, roles, timeline, G-templates and risks.", "grants/my-grant", r ? `Start by ${fmt(r.start)}` : "Not started", r ? 1 : 0, 2, r ? "Open my grant" : "Plan a grant"],
        ["3", "Follow the guide", `${stages.length} stages from the purpose of the grant to filing.`, `grants/${slug(stages[last].name)}`, `${visited} of ${stages.length} stages opened`, visited / stages.length, 3, visited ? `Continue at ${stages[last].name}` : "Open stage 1"],
      ];
      return { html: `${ui.head("Projects · Grants", "Grants", "")}
        <section class="hub-paths">${paths.map(([n, t, d, p, meta, prog, c, cta]) => `<a class="hub-path" href="#/${p}" style="--c:var(--c${c})"><span class="hub-n">${n}</span><h2>${t}</h2><p>${d}</p>
          <div class="hub-meta"><span>${esc(meta)}</span><i><u style="width:${Math.round(prog * 100)}%"></u></i></div><b class="hub-cta">${esc(cta)} →</b></a>`).join("")}</section>
        <a class="hub-ref" href="#/grants/reference"><span>§</span><div><b>Quick reference</b><small>Limits & deadlines · roles · how-to instructions with templates</small></div><u>Open →</u></a>
        <section class="hub-strip card"><div><span class="eyebrow">At a glance</span><b>The €15,000 threshold — total budget of the procedure</b></div>${FG.ui.ruler({ max: 60000, marks: [[L.grant, "Call for proposals"]], zones: [[0, L.grant, "Direct award (G9.2A)", "--c2"], [L.grant, 60000, "Call for proposals", "--c1"]] })}</section>` };
    },
  });
  route("grants/essentials", {
    section: "grants",
    crumbs: () => [["Projects", "projects"], ["Grants", "grants"], ["Essentials", "grants/essentials"]],
    render: () => ({ html: `${ui.head("Grants · step 1 · learn one rule at a time", "The essentials", "")}${learnPage(G_ESSENTIALS, "gr:known", "grants", "#/grants/my-grant", "Plan my grant")}` }),
  });;
  FG.QUIZ_AT["grants/essentials"] = "grant";
  const G_DEFAULT = { what: "", budget: "", grantees: "1", funding: "bo", kind: "project", months: "", ground: "none", deadline: "" };
  function grantForm(c) {
    return `<form class="card case-form" data-case>
      <div class="card-head"><div><h3>Your grant</h3><small>Saved in this browser only.</small></div><button type="button" class="btn sm ghost" data-case-clear>Clear</button></div>
      <div class="card-body stack">
        <label class="field"><span>What will the grant support?</span><input class="input" name="what" value="${esc(c.what)}" placeholder="e.g. Local NGO projects on media literacy"></label>
        ${ui.number("budget", c.budget, "Total budget of the procedure (€)", "All grants under this procedure together.")}
        ${ui.number("grantees", c.grantees, "Number of grants foreseen")}
        ${ui.select("funding", [["bo", "Ordinary Budget / Voluntary Contributions"], ["eu", "EU funds"]], c.funding, "Funding")}
        ${ui.select("kind", [["project", "Project-related grant"], ["operational", "Operational grant"]], c.kind, "Type of grant")}
        ${ui.number("months", c.months, "Implementation period (months)")}
        ${ui.select("ground", [["none", "No — normal procedure"], ["emergency", "Unforeseeable emergency"], ["grantee", "Grantee characteristics make a call impossible"], ["action", "Action leaves no scope for a call"]], c.ground, "Exceptional circumstance (from €15,000)?")}
        <label class="field"><span>Agreement signed by</span><input class="input" type="date" name="deadline" value="${esc(c.deadline)}"></label>
      </div></form>`;
  }
  function grantResult(c) {
    if (!Number(c.budget)) return `<div class="case-empty card card-pad"><b>Enter the total budget of the procedure</b><p class="muted">Your route, roles, timeline, template pack and risk radar appear here as you type.</p></div>`;
    const r = E.grantCase(c), tl = r.timeline, tone = { direct: 2, "direct-exc": 4, call: 1 }[r.key];
    return `${heroHtml(tone, r.route, `${esc(c.what || "Your grant")} · ${euro(r.budget)} · ${r.n} grant${r.n > 1 ? "s" : ""} · ${r.eu ? "EU funds" : "Ordinary Budget / VC"}`, [[r.roles.length, `role${r.roles.length > 1 ? "s" : ""}`], [r.total, "working days"], [fmt(r.start), r.late ? "should have started" : r.deadline ? "start at the latest" : "earliest signature " + fmt(tl[tl.length - 1].to), r.late]])}
      ${nextHtml(r, `<em class="on">${r.eu ? "Templates: B variants" : "Templates: A variants"}</em>`)}
      ${chainHtml("Who does what", "Decision, coordination and evaluation.", r.roles)}
      ${ganttHtml(r, "the grants guide")}
      ${radarHtml(r)}
      ${ui.checklist(`gcase:${r.key}:${r.eu ? "eu" : "bo"}`, r.docs, "Template pack")}
      ${stagesHtml(r, FG.C.grantStages, "grants")}
      <div class="row no-print"><button type="button" class="btn" data-case-print>Print grant summary</button><a class="btn primary" href="#/grants/${slug((FG.C.grantStages.find((x) => r.keyStages.includes(x.name)) || FG.C.grantStages[0]).name)}">Go to my first key stage →</a></div>`;
  }
  FG.grantCase = () => { const c = FG.store.get("gcase", null); return c && Number(c.budget) ? E.grantCase(c) : null; };
  route("grants/my-grant", {
    section: "grants",
    crumbs: () => [["Projects", "projects"], ["Grants", "grants"], ["My grant", "grants/my-grant"]],
    render() {
      const c = { ...G_DEFAULT, ...FG.store.get("gcase", {}) };
      return { html: `${ui.head("Grants · step 2", "Plan my grant", "")}<div class="case-layout">${grantForm(c)}<div class="case-out stack" id="caseOut">${grantResult(c)}</div></div>`,
        mount(root) {
          const form = root.querySelector("[data-case]"), out = root.querySelector("#caseOut");
          form.addEventListener("input", () => { const v = Object.fromEntries(new FormData(form)); FG.store.set("gcase", v); out.innerHTML = grantResult(v); if (FG.enrich) FG.enrich(out); });
          root.querySelector("[data-case-clear]").onclick = () => { FG.store.set("gcase", null); FG.refresh(); };
          root.addEventListener("click", (e) => { if (e.target.closest("[data-case-print]")) window.print(); });
        } };
    },
  });

  /* ---------- quick reference: contract types, limits, roles, how-to ---------- */
  function referencePage(R, base) {
    if (!R) return `<p class="muted">Reference data not available.</p>`;
    const tabs = [];
    if ((R.contractTypes || []).length) tabs.push(["types", "Contract types", `<div class="ct-grid">${R.contractTypes.map((c, i) => `<article class="ct" style="--c:var(--c${i + 1})"><h3>${esc(c.name)}</h3>
      ${[["Use when", c.useWhen], ["Suppliers", c.suppliers], ["Orders", c.ordering], ["Duration", c.duration], ["Key control", c.control]].filter((x) => x[1]).map(([k, v]) => `<div><small>${k}</small><p>${esc(v)}</p></div>`).join("")}</article>`).join("")}</div>`, R.contractTypes.length]);
    if ((R.limits || []).length) tabs.push(["limits", "Limits & deadlines", `<div class="lim">${R.limits.map((l) => `<div class="lim-row"><b>${esc(l.value)}</b><p>${esc(l.rule)}</p><span>${esc(l.who || "")}</span></div>`).join("")}</div>`, R.limits.length]);
    if ((R.roles || []).length) tabs.push(["roles", "Roles", `<div class="role-grid">${R.roles.map((r) => `<article class="role"><h3>${esc(r.name)}</h3><p>${esc(r.does)}</p>${r.when ? `<small>${esc(r.when)}</small>` : ""}</article>`).join("")}</div>`, R.roles.length]);
    if ((R.howTo || []).length) tabs.push(["howto", "How to", `<div class="howto">${R.howTo.map((h) => `<details class="ht"><summary><b>${esc(h.title)}</b><span>${esc(h.who || "")}${h.source ? ` · ${esc(h.source)}` : ""}</span></summary>
      <ol>${h.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${(h.templates || []).length ? `<p class="small muted">Templates: ${h.templates.map(esc).join(", ")}</p>` : ""}</details>`).join("")}</div>`, R.howTo.length]);
    return ui.tabs(base + ":ref", tabs);
  }
  route("procurement/reference", {
    section: "procurement", crumbs: () => [["Projects", "projects"], ["Procurement", "procurement"], ["Quick reference", "procurement/reference"]],
    render: () => ({ html: `${ui.head("Procurement · quick reference", "Quick reference", "")}${referencePage(FG.C.procurementReference, "procurement")}` }),
  });
  route("grants/reference", {
    section: "grants", crumbs: () => [["Projects", "projects"], ["Grants", "grants"], ["Quick reference", "grants/reference"]],
    render: () => ({ html: `${ui.head("Grants · quick reference", "Quick reference", "")}${referencePage(FG.C.grantReference, "grants")}` }),
  });
})();
