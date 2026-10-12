/* Decision engines: one form → one structured decision, recomputed on every change. */
(function () {
  "use strict";
  const { esc, ui, route } = FG;
  const E = window.FG_ENGINES;

  const ENGINES = [
    { id: "procurement", n: "01", title: "Procurement route", group: "Procurement", lead: "Value, funding, market and urgency → procedure, controls, approvals and e-procurement route.", icon: "⚖",
      fn: E.procurement, defaults: { amount: 72000, type: "general", funding: "xb", market: "many", urgency: "none", pattern: "oneoff", publicPrices: "" },
      fields: [["number", "amount", "Foreseeable procurement value (€, excl. VAT)", "Full need over the period: renewals, lots, options, call-offs."],
        ["select", "type", "Purchase type", [["general", "Goods / general services / works"], ["intellectual", "Intellectual services"]]],
        ["select", "funding", "Funding", [["ordinary", "Ordinary Budget"], ["xb", "Extrabudgetary"], ["mixed", "Mixed funding"]]],
        ["check", "publicPrices", "Public prices available and the need is below €10,000"],
        ["select", "market", "Market situation", [["many", "Several credible suppliers"], ["limited", "Limited market"], ["single", "Only one supplier identified"]]],
        ["select", "urgency", "Urgency", [["none", "No urgency"], ["operational", "Operational urgency"], ["emergency", "Unforeseeable emergency"]]],
        ["select", "pattern", "Need pattern", [["oneoff", "One-off / clearly defined"], ["repeat", "Recurring / units can be defined"], ["variable", "Recurring but variable / complex"]]]],
      more: ["Threshold matrix", "procurement/thresholds-and-procedure"] },
    { id: "budget-revision", n: "02", title: "Budget revision", group: "Budget change", lead: "Heading variation plus unit, structure and contractual triggers → Notification, Addendum or VC route.", icon: "±",
      fn: E.budgetRevision, defaults: { project: "jp", donor: "ap", change: "reallocation", current: 100000, proposed: 128000, totalChange: "no", durationChange: "no", scopeChange: "no", unitsExceeded: "no", unitBasis: "no", newLine: "no" },
      fields: [["select", "project", "Project type", [["jp", "Joint Programme (JP)"], ["vc", "Voluntary Contribution (VC)"]]],
        ["select", "donor", "VC funding", [["ap", "Action Plan / pooled funding"], ["earmarked", "Earmarked / specific donor"]], (v) => v.project === "vc"],
        ["select", "change", "What is changing?", [["reallocation", "Reallocation between budget lines / headings"], ["newline", "New budget line"], ["total", "Total project cost"], ["extension", "Project duration / extension"], ["scope", "Scope / purpose / objectives"]]],
        ["number", "current", "Current Budget Heading (€)"], ["number", "proposed", "Proposed Budget Heading (€)"],
        ["yesno", "totalChange", "Does the total project budget change?"], ["yesno", "durationChange", "Does the project duration / end date change?"],
        ["yesno", "scopeChange", "Does scope, purpose or objectives change?"], ["yesno", "unitsExceeded", "Are approved Nb of Units exceeded?"],
        ["select", "unitBasis", "Has the approved unit basis materially changed?", [["no", "No"], ["generic", "Only a generic reporting label differs"], ["yes", "Yes — measurement basis changed"]]],
        ["yesno", "newLine", "Is a new budget line being introduced?"]],
      more: ["Forecast workflow", "foma/forecast"], rerender: ["project"] },
    { id: "contract-strategy", n: "03", title: "Contract strategy", group: "Contract model", lead: "Need pattern and ordering model → one-off contract, framework contract or framework agreement.", icon: "▦",
      fn: E.contractStrategy, defaults: { pattern: "fixed", defined: "yes", suppliers: "single", mini: "no", prices: "yes", ceiling: "yes" },
      fields: [["select", "pattern", "How often will the need arise?", [["fixed", "One clearly defined need"], ["recurring", "Recurring and broadly predictable"], ["variable", "Recurring but variable / complex"]]],
        ["select", "defined", "Can quantity / deliverables be defined now?", [["yes", "Yes"], ["partial", "Partly"], ["no", "No"]]],
        ["select", "suppliers", "Supplier model", [["single", "Single supplier is sufficient"], ["multiple", "Multiple suppliers needed"]]],
        ["yesno", "mini", "Will individual needs require mini-competition?"],
        ["select", "prices", "Can unit prices be fixed in advance?", [["yes", "Yes"], ["partial", "Partly"], ["no", "No"]]],
        ["select", "ceiling", "Is a ceiling / maximum volume known?", [["yes", "Yes"], ["no", "No / uncertain"]]]],
      more: ["Contract type matrix", "procurement/contract-types"] },
    { id: "grant-procedure", n: "04", title: "Grant procedure", group: "Grant", lead: "Total procedure budget and exception conditions → direct award, competitive call or exceptional direct award.", icon: "✦",
      fn: E.grantProcedure, defaults: { amount: 18000, type: "Project-related Grant", exception: "no", basis: "none", count: 1, publication: "yes" },
      fields: [["number", "amount", "Total procedure budget (€)", "Threshold is assessed on the total grant-award procedure budget, not per grantee."],
        ["select", "type", "Grant type", [["Project-related Grant", "Project-related grant"], ["Operational Grant", "Operational grant"]]],
        ["yesno", "exception", "Permitted exception to competitive call?"],
        ["select", "basis", "Exception basis", [["none", "Not applicable"], ["emergency", "Unforeseeable emergency"], ["unique", "Unique grantee characteristics"], ["predetermined", "Predetermined partner / no meaningful scope for call"]], (v) => v.exception === "yes"],
        ["number", "count", "Number of intended grants"],
        ["select", "publication", "Publication / open call feasible?", [["yes", "Yes"], ["no", "No"]]]],
      more: ["Grant lifecycle", "grants/procedure"], rerender: ["exception"] },
    { id: "year-end", n: "05", title: "Year-end treatment", group: "Year-end", lead: "Delivery timing, invoice status and budget type → accrual, split, next-year treatment and PO action.", icon: "◷",
      fn: E.yearEnd, defaults: { delivery: "current", invoice: "yes", budget: "annual", po: "open", measurable: "yes" },
      fields: [["select", "delivery", "Delivery / service timing", [["current", "Fully delivered in current financial year"], ["next", "Delivered in next financial year"], ["split", "Spans current and next financial year"]]],
        ["select", "invoice", "Invoice status", [["yes", "Invoice received"], ["no", "No invoice received by year-end"]]],
        ["select", "budget", "Budget type", [["annual", "Annual budget"], ["special", "Special account"]]],
        ["select", "po", "PO status", [["open", "PO / commitment still open"], ["closed", "PO already closed / finalised"], ["none", "No PO"]]],
        ["select", "measurable", "Can the delivered portion be reliably measured?", [["yes", "Yes"], ["no", "No / evidence incomplete"]]]],
      more: ["Year-end closing", "year-end"] },
  ];
  const READINESS = [
    { id: "payment-readiness", title: "Payment readiness", lead: "Pre-flight check of the payment file before it moves on.", icon: "✓", more: ["Payment file", "payment-file"],
      controls: [["po", "PO / contractual basis", "Valid PO, contract or other payment basis is present."], ["delivery", "Delivery / acceptance evidence", "Goods/services delivered and acceptance can be evidenced."], ["invoice", "Invoice match", "Invoice matches the contractual basis, amount and supplier."], ["bank", "Supplier / bank data", "Supplier identity and bank information are controlled."], ["visa", "Approval / visa trail", "Required approval and visa trail is complete."]] },
    { id: "audit-readiness", title: "Audit readiness", lead: "Would the case stand up to an audit review? Check decision trail, approvals, execution evidence and filing.", icon: "⌕", more: ["Filing & audit", "filing"],
      controls: [["decision", "Decision / procedure justification", "The chosen route and any exception can be traced."], ["approvals", "Approvals", "Required approvals and validations are retained."], ["competition", "Competition / selection trail", "Invitations, bids, evaluation and award evidence are complete where applicable."], ["declarations", "Conflict-of-interest / declarations", "Conflict-of-interest and required declarations are on file."], ["contract", "Contract / PO", "Signed contractual and commitment documents are retained."], ["execution", "Execution / delivery evidence", "Delivery, acceptance and performance can be demonstrated."], ["payment", "Payment / filing package", "Invoice, payment trail and final filing package are complete."]] },
  ];

  route("engines", {
    crumbs: () => [["Decision engines", "engines"]],
    render: () => ({ html: `${ui.head("Decide", "Decision engines", "Answer a few case questions and get the applicable route, control points, file pack and next actions. Save results to My Case to keep the context.")}
      <div class="modules">${ENGINES.map((e) => `<a class="module" href="#/engines/${e.id}"><span class="ico" aria-hidden="true">${e.icon}</span><span><small>${e.n} · ${esc(e.group)}</small><b>${esc(e.title)}</b><small>${esc(e.lead)}</small></span></a>`).join("")}
        <a class="module" href="#/analysis"><span class="ico" aria-hidden="true">⌁</span><span><small>06 · Financial health</small><b>Financial analysis</b><small>Budget execution, variance and continuity from your Excel reports.</small></span></a></div>
      <div class="section-title"><h2>Case readiness & simulation</h2></div>
      <div class="modules">${READINESS.map((e) => `<a class="module" href="#/engines/${e.id}"><span class="ico" aria-hidden="true">${e.icon}</span><span><b>${esc(e.title)}</b><small>${esc(e.lead)}</small></span></a>`).join("")}
        <a class="module" href="#/engines/what-if"><span class="ico" aria-hidden="true">↔</span><span><b>What-if simulator</b><small>Change a JP Budget Heading and watch the formal route switch.</small></span></a></div>
      <div class="mt">${ui.callout("info", "One principle", "Tools help you perform a task. Decision engines tell you which route, control or action applies to your case. Neither replaces the applicable rules or Finance validation.")}</div>` }),
  });

  function field(f, v) {
    const [kind, name, label, opt, cond] = f;
    if (typeof cond === "function" && !cond(v)) return "";
    if (kind === "number") return ui.number(name, v[name], label, opt);
    if (kind === "select") return ui.select(name, opt, v[name], label);
    if (kind === "yesno") return ui.select(name, [["no", "No"], ["yes", "Yes"]], v[name], label);
    if (kind === "check") return `<label class="check"><input type="checkbox" name="${name}" value="1" ${v[name] ? "checked" : ""}><div><b>${esc(label)}</b></div></label>`;
    return "";
  }
  const readForm = (form, defaults) => { const v = { ...defaults }; Object.keys(defaults).forEach((k) => { const el = form.elements[k]; if (!el) return; v[k] = el.type === "checkbox" ? (el.checked ? "1" : "") : el.value; }); return v; };

  function enginePage(e, key, compute, formHtml, footer) {
    return {
      html: `${ui.head(`${e.group || "Readiness"} · decision engine`, e.title, e.lead, `<a class="btn" href="#/engines">All engines</a><button class="btn" data-reset>Reset</button>`)}
        <div class="split-l"><form class="card sticky" data-engine novalidate><div class="card-head"><h3>Case details</h3></div><div class="card-body form">${formHtml}</div></form><div id="result"></div></div>`,
      mount(root) {
        const form = root.querySelector("[data-engine]"), out = root.querySelector("#result");
        const run = () => { const r = compute(form); FG.lastDecision = { ...r, engine: e.id }; out.innerHTML = FG.renderDecision(r, { footer: e.more ? `<a class="btn" href="#/${e.more[1]}">${esc(e.more[0])} →</a>` : "" }); };
        form.addEventListener("input", run); // "input" already recomputes; "change" (fired on blur) only rebuilds the form when a field shows or hides others,
        // so clicking a result button right after typing never hits a replaced element.
        form.addEventListener("change", (ev) => { if (ev.target.dataset.rerender !== undefined) FG.refresh(); });
        form.addEventListener("submit", (ev) => ev.preventDefault());
        root.querySelector("[data-reset]").onclick = () => { FG.store.set(key, null); FG.refresh(); };
        run();
      },
    };
  }

  ENGINES.forEach((e) => {
    route(`engines/${e.id}`, {
      section: "engines", crumbs: () => [["Decision engines", "engines"], [e.title, `engines/${e.id}`]],
      render() {
        const key = `engine:${e.id}`, v = { ...e.defaults, ...(FG.store.get(key) || {}) };
        const conditional = e.rerender || [];
        const html = e.fields.map((f) => field(f, v)).join("");
        const page = enginePage(e, key, (form) => { const val = readForm(form, v); FG.store.set(key, val); return e.fn({ ...val, publicPrices: !!val.publicPrices }); }, html);
        const mount = page.mount;
        page.mount = (root) => { conditional.forEach((k) => { const el = root.querySelector(`[name=${k}]`); if (el) el.dataset.rerender = ""; }); mount(root); };
        return page;
      },
    });
    FG.addIndex(`${e.title} engine`, e.lead, `engines/${e.id}`, "Engine");
  });

  READINESS.forEach((e) => {
    route(`engines/${e.id}`, {
      section: "engines", crumbs: () => [["Decision engines", "engines"], [e.title, `engines/${e.id}`]],
      render() {
        const key = `engine:${e.id}`, v = FG.store.get(key) || {};
        const html = `<div class="checklist">${e.controls.map(([k, t, d]) => `<label class="check"><input type="checkbox" name="${k}" ${v[k] ? "checked" : ""}><div><b>${esc(t)}</b><small>${esc(d)}</small></div></label>`).join("")}</div>`;
        return enginePage(e, key, (form) => {
          const checked = {}; e.controls.forEach(([k]) => { checked[k] = form.elements[k].checked; });
          FG.store.set(key, checked);
          return E.readiness(e.title, e.controls.map(([k, t]) => [k, t]), checked);
        }, html);
      },
    });
    FG.addIndex(e.title, e.lead, `engines/${e.id}`, "Engine");
  });

  const WHATIF = { id: "what-if", title: "What-if simulator", lead: "Change a Joint Programme Budget Heading and see how the formal route changes. Direct contractual changes always override the percentage route.", more: ["Budget Revision engine", "engines/budget-revision"] };
  route("engines/what-if", {
    section: "engines", crumbs: () => [["Decision engines", "engines"], ["What-if simulator", "engines/what-if"]],
    render() {
      const key = "engine:what-if", v = { current: 100000, proposed: 124000, change: "none", ...(FG.store.get(key) || {}) };
      const html = `${ui.number("current", v.current, "Current Budget Heading (€)")}
        <label class="field"><span>Proposed Budget Heading (€)</span><input class="input" type="range" name="slider" min="0" max="${Math.max(200000, v.current * 2)}" step="500" value="${v.proposed}" aria-label="Proposed heading slider"><input class="input" type="number" name="proposed" value="${v.proposed}" min="0" step="any"></label>
        ${ui.select("change", [["none", "No — budget movement only"], ["total", "Total project cost changes"], ["extension", "Project extension"], ["scope", "Scope / purpose / objectives change"]], v.change, "Direct contractual change")}`;
      const page = enginePage(WHATIF, key, (form) => {
        const val = { current: form.elements.current.value, proposed: form.elements.proposed.value, change: form.elements.change.value };
        FG.store.set(key, val); return E.whatIf(val);
      }, html);
      const mount = page.mount;
      page.mount = (root) => {
        const s = root.querySelector("[name=slider]"), p = root.querySelector("[name=proposed]");
        s.addEventListener("input", () => { p.value = s.value; });
        p.addEventListener("input", () => { s.value = p.value; });
        mount(root);
      };
      return page;
    },
  });
  FG.addIndex("What-if simulator", WHATIF.lead, "engines/what-if", "Engine", "notification addendum 25% heading");
})();
