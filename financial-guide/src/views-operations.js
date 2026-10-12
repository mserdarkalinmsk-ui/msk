/* Operational modules: PO file, payment file, year-end, petty cash, filing, FOMA workflows. */
(function () {
  "use strict";
  const { C, esc, euro, slug, ui, route } = FG;
  const E = window.FG_ENGINES;

  const pick = (key, list, fallback) => { const v = FG.store.get(key, fallback); return list.includes(v) ? v : fallback; };
  const onClick = (root, attr, fn) => root.addEventListener("click", (e) => { const b = e.target.closest(`[${attr}]`); if (b) fn(b.getAttribute(attr), b, e); });

  // Numbered timeline whose steps can be marked done; the open step is remembered.
  function timeline(id, steps, map) {
    const t = FG.ticks(id), done = steps.filter((_, i) => t[i]).length;
    return `<div class="progress-head"><span>${done} / ${steps.length} steps complete</span>${done ? `<button class="btn ghost sm" data-tl-reset="${esc(id)}">Reset</button>` : ""}</div>${ui.bar((done / steps.length) * 100, done === steps.length ? "good" : "")}
      <div class="timeline mt" data-timeline="${esc(id)}">${steps.map((s, i) => { const m = map(s, i); return `<div class="tl"><div class="tl-dot"><button type="button" class="${t[i] ? "ok" : ""}" data-tl="${i}" aria-pressed="${!!t[i]}" aria-label="Mark step ${i + 1} ${t[i] ? "not done" : "done"}">${t[i] ? "✓" : i + 1}</button></div>
        <details class="tl-body" ${i === 0 ? "open" : ""}><summary>${esc(m.title)}${m.sub ? `<small>${esc(m.sub)}</small>` : ""}</summary><p>${esc(m.text)}</p>${m.list ? `<ul>${m.list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</details></div>`; }).join("")}</div>`;
  }
  function mountTimeline(root) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tl]");
      if (b) { const id = b.closest("[data-timeline]").dataset.timeline; FG.tick(id, b.dataset.tl, !FG.ticks(id)[b.dataset.tl]); FG.refresh(); }
      const r = e.target.closest("[data-tl-reset]");
      if (r) { FG.store.set("ticks:" + r.dataset.tlReset, {}); FG.refresh(); }
    });
  }
  function contextPanel(key) {
    const m = C.moduleContexts[key]; if (!m) return "";
    return `<section class="card"><div class="card-head"><h3>Who does what</h3></div><div class="card-body stack">${m.roles.map(([r, d]) => `<div><b>${esc(r)}</b><p class="small muted">${esc(d)}</p></div>`).join("")}</div></section>`;
  }

  /* ---------- PO file ---------- */
  const SERVICES = Object.keys(C.poServices);
  const VISA_ROLES = ["Project Officer", "Content Manager", "Head of Unit", "Finance Officer", "CCM"];
  const VISA_ROWS = [
    ["Activities Work Plan (AWP)", "", [1, 1, 1, 1, 1]],
    ["Local / international consultant", "One-off contract, Order Form, Call-off, Grants", [1, 1, 0, 1, 1], ["Consultants"]],
    ["Imprest agreement", "Fixed assets for beneficiaries", [1, 1, 0, 1, 1]],
    ["Service contract / invoice", "With a service provider", [1, 0, 0, 1, 1], ["Event Management", "Other Services"]],
    ["Purchase of goods / works", "", [1, 0, 0, 1, 1]],
    ["Translation / interpretation", "", [1, 0, 0, 1, 1], ["Interpretation", "Translation"]],
    ["In-country / international mission", "", [1, 0, 0, 1, 1]],
    ["All unforeseen", "As per AWP", [1, 1, 1, 1, 1]],
  ];
  function servicePicker(key, service) {
    return `<div class="chips" data-service="${key}">${SERVICES.map((s) => `<button class="chip" data-s="${esc(s)}" aria-pressed="${s === service}">${esc(C.poServices[s].icon || "")} ${esc(s)}</button>`).join("")}</div>`;
  }
  function docList(id, title, items) {
    const t = FG.ticks(id);
    return `<div data-checklist="${esc(id)}"><h3 class="small" style="text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">${esc(title)}</h3><div class="checklist">${items.map(([a, b], i) => `<label class="check ${t[i] ? "done" : ""}"><input type="checkbox" data-i="${i}" ${t[i] ? "checked" : ""}><div><b>${esc(a)}</b><small>${esc(b)}</small></div></label>`).join("")}</div></div>`;
  }
  route("po-file", {
    crumbs: () => [["Projects", "projects"], ["PO file", "po-file"]],
    render() {
      const service = pick("service", SERVICES, SERVICES[0]), d = C.poServices[service];
      const signedId = `po:${service}:signed`, supportId = `po:${service}:support`;
      const all = d.signed.length + d.support.length, ticked = Object.keys(FG.ticks(signedId)).length + Object.keys(FG.ticks(supportId)).length;
      const visa = FG.ticks("visa"), required = VISA_ROWS.reduce((a, r) => a + r[2].filter(Boolean).length, 0), verified = Object.keys(visa).length;
      return { html: `${ui.head("Purchase order · file builder", "How to prepare a PO file", "Build a complete, signature-ready and audit-ready PO file. Follow the steps, then choose the service type to get the exact document package from the Financial Documents Content List.", `<a class="btn" href="#/payment-file">Continue to payment →</a>`)}
        ${ui.callout("warn", "Before any activity starts", "No activity or service should begin until the PO is opened, required signatures are collected and the service provider has received the countersigned documents.")}
        <div class="split mt">
          <div class="stack">
            <section class="card"><div class="card-head"><div><h3>Document builder</h3><small>Documents to be signed are separated from supporting evidence.</small></div>${ui.tag(`${ticked}/${all} ready`, ticked === all ? "good" : "")}</div><div class="card-body stack">
              ${servicePicker("po", service)}<p class="small muted">${esc(d.sub || "")}</p>
              <div class="grid g2">${docList(signedId, "To be signed", d.signed)}${docList(supportId, "Supporting documents", d.support)}</div></div></section>
            <section class="card"><div class="card-head"><div><h3>Visa / signature matrix</h3><small>Commitment and settlement of expenditure. The row for the selected service is highlighted; click a required cell to mark it verified.</small></div>${ui.tag(`${verified}/${required} visas`, verified === required ? "good" : "")}</div><div class="card-body stack">
              <div class="table-wrap"><table class="t visa"><thead><tr><th>Phase / expenditure type</th>${VISA_ROLES.map((r) => `<th class="c">${esc(r)}</th>`).join("")}</tr></thead><tbody>
              ${VISA_ROWS.map((r, i) => `<tr class="${(r[3] || []).includes(service) ? "hl" : ""}"><td><b>${esc(r[0])}</b>${r[1] ? `<small>${esc(r[1])}</small>` : ""}</td>${r[2].map((req, j) => `<td class="c">${req ? `<button type="button" class="req ${visa[`${i}-${j}`] ? "ok" : ""}" data-visa="${i}-${j}" aria-label="${esc(VISA_ROLES[j])} visa for ${esc(r[0])}: ${visa[`${i}-${j}`] ? "verified" : "required"}">✓</button>` : `<span class="muted" aria-label="Not required">·</span>`}</td>`).join("")}</tr>`).join("")}
              </tbody></table></div>
              <div class="table-wrap"><table class="t"><thead><tr><th>Project type (financial management)</th><th>CCM DPC</th><th>Financial Unit DPC</th></tr></thead><tbody><tr><td>Decentralised financial management</td><td>In situ</td><td>In situ</td></tr><tr><td>Non-decentralised financial management</td><td>In HQ</td><td>In situ or in HQ</td></tr></tbody></table></div>
              <details class="accordion"><summary>Operational notes</summary><div><ol class="small">
                <li>Once the AWP is approved, the reference allows limited flexibility above the activity budget without full re-approval.</li>
                <li>Material increases to a PO amount should be routed for prior CCM approval in line with the applicable authorisation rules.</li>
                <li>Contracts with substantive elements such as consultants and grants require Content Manager validation, or the relevant superior where applicable.</li>
                <li>The AWP should cover the relevant implementation period and be reviewed periodically.</li>
                <li>Contracts under decentralised management must follow the applicable CCM signature route.</li>
                <li>Procurements in the €55k–€184k band should follow the applicable legal/procurement review route.</li></ol></div></details>
            </div></section>
            <section class="card"><div class="card-head"><h3>Best practice & common mistakes</h3></div><div class="card-body">${ui.pairs(C.poBestPractice)}</div></section>
          </div>
          <aside class="stack sticky">
            <section class="card"><div class="card-head"><h3>PO process</h3></div><div class="card-body">${timeline("po:steps", C.poSteps, (s) => ({ title: s.t, text: s.x, list: s.l }))}</div></section>
            ${contextPanel("pofile")}
          </aside>
        </div>`,
        mount(root) {
          mountTimeline(root);
          onClick(root, "data-s", (v) => { FG.store.set("service", v); FG.refresh(); });
          onClick(root, "data-visa", (k) => { FG.tick("visa", k, !FG.ticks("visa")[k]); FG.refresh(); });
        } };
    },
  });

  /* ---------- payment file ---------- */
  route("payment-file", {
    crumbs: () => [["Projects", "projects"], ["Payment file", "payment-file"]],
    render() {
      const service = pick("service", SERVICES, SERVICES[0]), d = C.payServices[service] || { signed: [], support: [] };
      const row = VISA_ROWS.find((r) => (r[3] || []).includes(service)) || VISA_ROWS[3];
      return { html: `${ui.head("Payment · file builder", "How to prepare a payment file", "Continue the control trail created at PO stage: verify delivery, match the invoice to the contractual package and build the finance-ready payment file.", `<a class="btn" href="#/po-file">← PO file</a><a class="btn primary" href="#/engines/payment-readiness">Payment readiness check</a>`)}
        <div class="split">
          <div class="stack">
            <section class="card"><div class="card-head"><div><h3>Payment file builder</h3><small>Use the same service type as the PO.</small></div></div><div class="card-body stack">
              ${servicePicker("pay", service)}
              <div class="grid g2">${docList(`pay:${service}:signed`, "To be signed", d.signed)}${docList(`pay:${service}:support`, "Supporting documents", d.support)}</div></div></section>
            <section class="card"><div class="card-head"><h3>Visa / approval continuity</h3>${ui.tag("Inherited from PO", "accent")}</div><div class="card-body stack">
              <p>Route for <b>${esc(service)}</b> — ${esc(row[0])}:</p>
              <div class="row">${VISA_ROLES.filter((_, j) => row[2][j]).map((r, k, a) => `${ui.tag(r, "accent")}${k < a.length - 1 ? '<span class="muted">→</span>' : ""}`).join("")}</div>
              ${ui.callout("info", "Rule", "Continue with the route processed at PO stage. Re-check it only if the service/expenditure type changes, the contractual basis changes, or a material financial change requires fresh approval.")}</div></section>
            <section class="card"><div class="card-head"><h3>Best practice & common mistakes</h3></div><div class="card-body">${ui.pairs(C.payBestPractice)}</div></section>
          </div>
          <aside class="stack sticky">
            <section class="card"><div class="card-head"><h3>Payment process</h3></div><div class="card-body">${timeline("pay:steps", C.paySteps, (s) => ({ title: s.t, sub: s.s, text: s.text, list: s.list }))}</div></section>
            ${contextPanel("paymentfile")}
          </aside>
        </div>`,
        mount(root) { mountTimeline(root); onClick(root, "data-s", (v) => { FG.store.set("service", v); FG.refresh(); }); } };
    },
  });

  /* ---------- year-end ---------- */
  route("year-end", {
    crumbs: () => [["Projects", "projects"], ["Year-end closing", "year-end"]],
    render() {
      const phase = FG.store.get("eoy:phase", 0), p = C.eoyPhases[phase], meta = C.eoyPhaseMeta[phase] || {};
      const f = FG.store.get("eoy:fy", { delivery: "current", invoice: "yes", budget: "annual" }), r = E.yearAllocation(f);
      return { html: `${ui.head("Project finance · 2026 closing", "Year-end closing", "Check delivery dates, complete payment files, follow up suppliers and finalise POs when the expenditure is fully recorded.", `<a class="btn primary" href="#/engines/year-end">Year-End Treatment engine</a>`)}
        <div class="grid g3">
          ${ui.callout("info", "Delivery by 31/12/2026", "Only goods delivered and services rendered by 31 December 2026 can be included in 2026 expenditure.", "📅")}
          ${ui.callout("info", "Both budget types", "The year-end accounting rules apply to annual budgets and special accounts.", "◫")}
          ${ui.callout("good", "Check before finalising", "Finalise a 2026 PO only when all expenditure is recorded in FIMS (Fiche PO: “Amount billed” / “Invoices”). You do not need to wait for payment.")}
        </div>
        <div class="split mt">
          <div class="stack">
            <section class="card"><div class="card-head"><h3>Closing phases</h3><small>Action, owner, control and evidence</small></div><div class="card-body stack">
              ${ui.flowHeader(C.eoyPhases, phase, (x) => `<small>${esc(x.m.toUpperCase())}</small><b>${esc(x.t)}</b>`)}
              <ul>${p.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
              <div class="detail-grid"><div><small>Owner</small>${esc(meta.owner || "—")}</div><div><small>Control</small>${esc(meta.control || "—")}</div><div><small>Evidence</small>${esc(meta.evidence || "—")}</div><div><small>Documents</small>${esc((meta.docs || []).join(" · ") || "—")}</div></div>
            </div></section>
            <section class="card"><div class="card-head"><div><h3>Which financial year?</h3><small>2026 expenditure-allocation table. A guide for the closing check, not a replacement for Finance validation.</small></div></div><div class="card-body stack">
              <form class="grid g3" data-fy>
                ${ui.select("delivery", [["current", "Completed in 2026"], ["next", "Delivered / performed in 2027"], ["split", "Spans 2026 and 2027"]], f.delivery, "Delivery / service")}
                ${ui.select("invoice", [["yes", "Invoice received"], ["no", "Invoice not received"]], f.invoice, "Invoice at year-end")}
                ${ui.select("budget", [["annual", "Annual budget"], ["special", "Special account"]], f.budget, "Budget type")}
              </form>
              <div class="callout ${r.tone}" aria-live="polite"><i aria-hidden="true">${r.tone === "good" ? "✓" : r.tone === "info" ? "→" : "↔"}</i><div><b>${esc(r.title)}</b>${esc(r.text)}<p class="mt"><b>${esc(r.action)}</b></p></div></div>
            </div></section>
            <section class="grid g2">
              <div class="card card-pad"><div class="eyebrow" style="color:var(--good)">Project team — do</div><ul class="small mt"><li>Check open POs regularly.</li><li>Follow up suppliers for missing invoices and documents.</li><li>Send completed payment files to Finance without waiting for the last day.</li><li>Finalise POs as soon as possible once all expenditure is recorded.</li></ul></div>
              <div class="card card-pad"><div class="eyebrow" style="color:var(--risk)">Avoid</div><ul class="small mt"><li>Finalising a PO before checking Amount billed / Invoices in the Fiche PO.</li><li>Including 2027 delivery as 2026 expenditure.</li><li>Waiting for the supplier payment before finalising an otherwise complete PO.</li><li>Leaving missing invoices or blocked files until the final deadline.</li></ul></div>
            </section>
            <section class="card"><div class="card-head"><h3>Fixed assets — where relevant</h3></div><div class="card-body reasons" style="border:0"><div><b>Payment request</b><span>Tick “Fixed asset” and complete the required information.</span></div><div><b>Inventory</b><span>Update the relevant asset record after delivery.</span></div><div><b>Partial acceptance</b><span>For relevant IT work/developments, record partial acceptance and attach the acceptance certificate.</span></div></div></section>
          </div>
          <aside class="stack sticky">${ui.checklist("eoy", C.eoyChecklist, "2026 project-team checklist")}
            ${ui.callout("info", "Simple rule", "Complete → record → check → finalise. Payment itself does not need to be completed before PO finalisation. Detailed cut-off dates follow the official 2026 closing calendar.")}
            ${contextPanel("eoy")}</aside>
        </div>`,
        mount(root) {
          onClick(root, "data-flow", (i) => { FG.store.set("eoy:phase", +i); FG.refresh(); });
          const form = root.querySelector("[data-fy]");
          form.addEventListener("change", () => { FG.store.set("eoy:fy", Object.fromEntries(new FormData(form))); FG.refresh(); });
        } };
    },
  });

  /* ---------- petty cash ---------- */
  const PETTY_CHECKS = [["CCM approval", "Approval obtained before the expense is made."], ["Limit check", "Expense is within the applicable Projects / OB limit."], ["Purpose & coding", "Reason for the expense and coding are clear."], ["Receipt / invoice", "Readable supporting evidence is available."], ["File complete", "Approval and supporting evidence are kept together."]];
  route("petty-cash", {
    crumbs: () => [["Projects", "projects"], ["Petty cash", "petty-cash"]],
    render() {
      const f = FG.store.get("petty", { budget: "project", amount: "", approved: "" }), r = E.pettyCash({ budget: f.budget === "ob" ? "ob" : "project", amount: f.amount, approved: !!f.approved });
      return { html: `${ui.head("Project finance · quick control", "Petty cash", "Use petty cash only for small-value operational needs, within the authorised limit, with a clear supporting file.")}
        ${ui.kpis([["Projects", euro(100), "Maximum per project-related expense"], ["Ordinary Budget (OB)", euro(50), "Maximum per OB-related expense"], ["Pre-spend approval", "CCM", "Required before any expense"], ["Exception route", "Small value", "Never split or repeat"]])}
        <div class="split mt"><div class="stack">
          <section class="card"><div class="card-head"><h3>Can I use petty cash?</h3></div><div class="card-body stack"><form class="grid g3" data-petty>
            ${ui.select("budget", [["project", "Projects — €100"], ["ob", "Ordinary Budget — €50"]], f.budget, "Budget type")}
            ${ui.number("amount", f.amount, "Expense amount (€)")}
            <label class="check" style="align-self:end"><input type="checkbox" name="approved" value="1" ${f.approved ? "checked" : ""}><div><b>CCM approval obtained</b><small>Tick only when received.</small></div></label>
          </form>${ui.callout(r.tone, r.title, r.text)}</div></section>
          <div class="grid g2">
            <div class="card card-pad"><div class="eyebrow" style="color:var(--good)">Appropriate use</div><ul class="small mt"><li>Small-value operational need</li><li>Within the applicable limit</li><li>CCM approval obtained before the expense</li><li>Clear purpose and coding</li><li>Readable receipt or invoice kept in the file</li></ul></div>
            <div class="card card-pad"><div class="eyebrow" style="color:var(--risk)">Do not use for</div><ul class="small mt"><li>Split or repeated purchases</li><li>Items that should follow the normal procurement route</li><li>Unsupported or personal expenses</li><li>Costs above the authorised petty cash limit</li><li>Any expense made before CCM approval</li></ul></div>
          </div></div>
          <aside class="sticky">${ui.checklist("petty", PETTY_CHECKS, "Petty cash file checklist")}</aside></div>`,
        mount(root) {
          const form = root.querySelector("[data-petty]");
          form.addEventListener("change", () => { const v = Object.fromEntries(new FormData(form)); FG.store.set("petty", { ...v, approved: v.approved ? 1 : "" }); FG.refresh(); });
        } };
    },
  });

  /* ---------- filing ---------- */
  const DMS = [
    ["1. Project contract documents", ["Signed project contractual documents (PDF and Word)", "Addendums (Report name – date)", "Notifications", "VAT"]],
    ["2. Activities", [["Inception phase / launching & closing", ["Agenda & presentation – drafts / final (Word and PDF)", "Presentations of the conference"]], ["Call-off", ["Tendering", "Call-off documents including finance approval e-mail", "Call-off publication e-mails", "Call-off applications (including e-mails)", "Questions & answers", "Signed assessment documents", "Notifications", "Signed call-off"]],
      ["POXXXXXXX – Purchase Order (EDD)", ["To be signed: PO Request · Order Form / Act of Engagement · Call-off · Comparative table · CCM / Tender Board decision · Work plan / deliverables · Threshold monitoring table", "Signed PO file", "Financial offers", "Tender documents"]]]],
  ];
  const tree = (nodes) => `<ul>${nodes.map((n) => (Array.isArray(n) ? `<li style="list-style:none"><details open><summary>${esc(n[0])}</summary>${tree(n[1])}</details></li>` : `<li>${esc(n)}</li>`)).join("")}</ul>`;
  route("filing", {
    crumbs: () => [["Projects", "projects"], ["Filing & audit", "filing"]],
    render() {
      const proc = pick("filing:p", Object.keys(C.filingMap), "Procurement");
      return { html: `${ui.head("Project documentation · DMS & audit readiness", "Filing & audit trail", "Keep project, procurement and financial records easy to find, easy to verify and ready for review.", `<a class="btn primary" href="#/engines/audit-readiness">Audit readiness check</a>`)}
        <div class="grid g3">${ui.callout("info", "Editable + signed", "Keep final PDF evidence together with the relevant editable source where applicable.", "▤")}${ui.callout("info", "Traceable", "Store approvals, clarifications and correspondence with the related transaction.", "↔")}${ui.callout("info", "Consistent naming", "Use clear names, dates and references so files remain searchable.", "Aa")}</div>
        <div class="split mt"><div class="stack">
          <section class="card"><div class="card-head"><div><h3>Evidence map by process</h3><small>What each stage of the file must contain.</small></div></div><div class="card-body stack">
            <div class="chips" data-proc>${Object.keys(C.filingMap).map((k) => `<button class="chip" data-p="${esc(k)}" aria-pressed="${k === proc}">${esc(k)}</button>`).join("")}</div>
            <div class="grid g2">${C.filingMap[proc].map(([stage, docs]) => docList(`filing:${proc}:${stage}`, stage, docs.map((d) => [d, ""])) ).join("")}</div></div></section>
          <section class="card"><div class="card-head"><div><h3>DMS project folder structure</h3><small>Organised for transparency and traceability.</small></div></div><div class="card-body tree">${tree(DMS)}</div></section>
        </div><aside class="stack sticky">${ui.checklist("audit", C.auditItems, "Audit documents")}</aside></div>`,
        mount(root) { onClick(root, "data-p", (v) => { FG.store.set("filing:p", v); FG.refresh(); }); } };
    },
  });

  /* ---------- FOMA ---------- */
  const FOMA = [
    ["po-request", "PO request", "Create and track purchase order requests.", "🧾"],
    ["payment-request", "Payment request", "Prepare and submit payment requests.", "💳"],
    ["mission-order", "Mission order", "Mission order preparation and approval workflow.", "✈"],
    ["expense-claim", "Expense claim", "Expense claim checks and reimbursement logic.", "◎"],
    ["reports", "Financial reports", "Current financial position and the reporting package.", "▥"],
    ["forecast", "Forecast & budget revision", "Plan expenditure, revise the budget and find the route.", "↗"],
    ["addendum", "Addendum", "Prepare a Joint Programme Addendum package.", "±"],
  ];
  route("foma", {
    crumbs: () => [["FOMA", "foma"]],
    render: () => ({ html: `${ui.head("Field operations", "FOMA workflows", "Controlled handover workflows and financial guidance for day-to-day field-office operations.")}
      <div class="modules">${FOMA.map(([p, t, s, i]) => `<a class="module" href="#/foma/${p}"><span class="ico" aria-hidden="true">${i}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></a>`).join("")}</div>
      <div class="section-title"><h2>Financial management lifecycle</h2></div>
      <div class="grid g4">${C.financeLifecycle.map((x, i) => `<div class="card card-pad"><div class="eyebrow">${i + 1} · ${esc(x.question)}</div><b>${esc(x.title)}</b><p class="small muted mt">${esc(x.lead)}</p><p class="small mt"><b>Output:</b> ${esc(x.output)}</p></div>`).join("")}</div>` }),
  });

  // Role-handover flows: fomaPoStages / fomaPaymentStages are objects; fomaFlows stages are tuples.
  const tupleStage = (s) => ({ label: s[0], role: s[1], summary: s[3], action: s[4], control: s[5], handover: s[6] });
  function handoverPage(key, title, lead, stages) {
    const i = Math.min(FG.store.get(`foma:${key}`, 0), stages.length - 1), s = stages[i];
    return `${ui.head("FOMA · controlled handover workflow", title, lead, `<a class="btn" href="#/foma">← FOMA</a>`)}
      <section class="card"><div class="card-head"><h3>${stages.length} controlled stages</h3><small>Select a stage to see responsibilities, evidence, control objective and handover.</small></div><div class="card-body stack">
        ${ui.flowHeader(stages, i, (x, j) => `<small>STAGE ${j + 1}</small><b>${esc(x.label)}</b><span>${esc(x.role)}</span>`)}
        <div><div class="eyebrow">${esc(s.role)}</div><h3 style="font-size:17px">${esc(s.summary)}</h3>${s.lead ? `<p class="muted mt">${esc(s.lead)}</p>` : ""}</div>
        <div class="detail-grid"><div><small>Action</small>${esc(s.action)}</div><div><small>Control objective</small>${esc(s.control)}</div>${s.evidence ? `<div><small>Evidence</small>${esc(s.evidence)}</div>` : ""}<div><small>Handover</small>${esc(s.handover)}${s.next ? ` → <b>${esc(s.next)}</b>` : ""}</div></div>
        <div class="stage-nav">${i > 0 ? `<button class="btn" data-flow="${i - 1}">← Previous</button>` : "<span></span>"}${i < stages.length - 1 ? `<button class="btn primary" data-flow="${i + 1}">Next stage →</button>` : ""}</div>
      </div></section>`;
  }
  const FLOW_SECTION = { "po-request": "foma-po", "payment-request": "foma-pay", "mission-order": "foma-mission", "expense-claim": "foma-claim" };
  const flowRoute = (key, title, lead, stages) => route(`foma/${key}`, {
    section: FLOW_SECTION[key], crumbs: () => [["FOMA", "foma"], [title, `foma/${key}`]],
    render: () => ({ html: handoverPage(key, title, lead, stages), mount: (root) => onClick(root, "data-flow", (i) => { FG.store.set(`foma:${key}`, +i); FG.refresh(); }) }),
  });
  flowRoute("po-request", "PO request process", "Follow the request from preparation to the issued purchase order.", C.fomaPoStages);
  flowRoute("payment-request", "Payment request process", "Follow the payment request from file preparation to Finance processing.", C.fomaPaymentStages);
  flowRoute("mission-order", C.fomaFlows["Mission Order"].title, C.fomaFlows["Mission Order"].desc, C.fomaFlows["Mission Order"].stages.map(tupleStage));
  flowRoute("expense-claim", C.fomaFlows["Expense Claim"].title, C.fomaFlows["Expense Claim"].desc, C.fomaFlows["Expense Claim"].stages.map(tupleStage));

  route("foma/reports", {
    section: "foma-reports", crumbs: () => [["FOMA", "foma"], ["Financial reporting", "foma/reports"]],
    render() {
      const fr = C.fomaFlows["Financial Reports"];
      return { html: `${ui.head("FOMA · financial reporting", fr.title, fr.desc, `<a class="btn primary" href="#/analysis">Analyse a report in Excel</a>`)}
        <div class="grid g3">${C.reportIntro.map((x) => `<div class="card card-pad"><div class="eyebrow">${esc(x.k)}</div><b>${esc(x.title)}</b><p class="small muted mt">${esc(x.text)}</p></div>`).join("")}</div>
        <div class="split mt"><div class="stack">
          <section class="card"><div class="card-head"><h3>Reporting workflow</h3></div><div class="card-body">${timeline("report:steps", fr.stages, (s) => ({ title: s[1], sub: s[0], text: s[3], list: [`Objective: ${s[4]}`, `Control: ${s[5]}`, `Output: ${s[6]}`] }))}</div></section>
          <section class="card"><div class="card-head"><h3>Report process in detail</h3></div><div class="card-body accordion">${C.reportProcess.map((x, i) => `<details ${i === 0 ? "open" : ""}><summary>${i + 1}. ${esc(x.title)}</summary><div><p>${esc(x.lead)}</p><div class="detail-grid mt"><div><small>Action</small>${esc(x.action)}</div><div><small>Control</small>${esc(x.control)}</div><div><small>Output</small>${esc(x.output)}</div></div></div></details>`).join("")}</div></section>
        </div><aside class="sticky">${ui.checklist("report:controls", C.reportChecks, "Report controls")}</aside></div>` , mount: mountTimeline };
    },
  });

  route("foma/forecast", {
    section: "foma-forecast", crumbs: () => [["FOMA", "foma"], ["Forecast & budget revision", "foma/forecast"]],
    render() {
      const fc = C.fomaFlows.Forecast, trig = FG.store.get("fc:trig", 0), t = C.forecastTriggers[trig];
      return { html: `${ui.head("FOMA · forecast", fc.title, fc.desc, `<a class="btn" href="#/engines/what-if">What-if simulator</a><a class="btn primary" href="#/engines/budget-revision">Budget Revision engine</a>`)}
        <div class="grid g4">${C.financeConcepts.map((x) => `<div class="card card-pad"><div class="eyebrow">${esc(x.q)}</div><b>${esc(x.title)}</b><p class="small muted mt">${esc(x.definition)}</p><p class="small mt"><b>Output:</b> ${esc(x.output)}</p></div>`).join("")}</div>
        <section class="card mt"><div class="card-head"><div><h3>What is changing?</h3><small>Identify all changes together; each one points to its route.</small></div></div><div class="card-body stack">
          ${ui.flowHeader(C.forecastTriggers, trig, (x) => `<small>${esc(x.tag)}</small><b>${esc(x.short)}</b><span>${esc(x.sub)}</span>`)}
          <div><h3 style="font-size:16px">${esc(t.title)}</h3><p class="muted">${esc(t.summary)}</p></div><ul>${t.checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div></section>
        <div class="split mt"><div class="stack">
          <section class="card"><div class="card-head"><h3>Forecast workflow</h3><small>${fc.stages.length} steps</small></div><div class="card-body">${timeline("fc:steps", fc.stages, (s) => ({ title: s[1], sub: s[0], text: s[3], list: [`Control: ${s[5]}`, `Output: ${s[6]}`] }))}</div></section>
          <section class="card"><div class="card-head"><h3>Roles, actions and documents</h3></div><div class="card-body accordion">${C.forecastProcess.map((x, i) => `<details ${i === 0 ? "open" : ""}><summary>${ui.tag(x.role, "accent")} ${esc(x.title)}</summary><div><p>${esc(x.lead)}</p><ul class="mt">${x.items.map((y) => `<li>${esc(y)}</li>`).join("")}</ul>${x.docs ? `<p class="small mt"><b>Documents:</b> ${esc(x.docs.join(" · "))}</p>` : ""}${x.note ? `<p class="small muted mt">${esc(x.note)}</p>` : ""}</div></details>`).join("")}</div></section>
        </div><aside class="stack sticky">${ui.callout("info", "Route rule", "For a Joint Programme, the ±25% threshold is assessed at Budget Heading / subtotal level, not against the project total. Changes to total cost, duration or scope always require an Addendum.")}<a class="btn" href="#/foma/addendum">Addendum workflow →</a></aside></div>`,
        mount(root) { mountTimeline(root); onClick(root, "data-flow", (i) => { FG.store.set("fc:trig", +i); FG.refresh(); }); } };
    },
  });

  route("foma/addendum", {
    section: "foma", crumbs: () => [["FOMA", "foma"], ["Addendum", "foma/addendum"]],
    render() {
      const reason = FG.store.get("add:reason", 0), r = C.addendumReasons[reason];
      return { html: `${ui.head("FOMA · Joint Programme", "Addendum workflow", C.fomaFlows.Addendum.desc, `<a class="btn primary" href="#/engines/budget-revision">Check the route</a>`)}
        <section class="card"><div class="card-head"><h3>Reason for the change</h3></div><div class="card-body stack">
          <div class="chips" data-reason>${C.addendumReasons.map((x, i) => `<button class="chip" data-r="${i}" aria-pressed="${i === reason}">${esc(x.title.split(" between")[0].split(" /")[0])}</button>`).join("")}</div>
          <div><h3 style="font-size:16px">${esc(r.title)}</h3><p class="muted">${esc(r.summary)}</p></div><ul>${r.checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
          ${r.decision ? ui.callout("info", r.decision.title, r.decision.text) : ""}</div></section>
        <section class="card mt"><div class="card-head"><h3>Addendum steps</h3><small>${C.addendumSteps.length} steps</small></div><div class="card-body">${timeline("add:steps", C.addendumSteps, (s, i) => ({ title: s.title, sub: s.role, text: s.lead, list: [...s.items, ...(C.addendumDocs[i] ? ["Documents: " + C.addendumDocs[i].join(" · ")] : []), ...(C.addendumKeys[i] ? ["Key point: " + C.addendumKeys[i]] : [])] }))}</div></section>`,
        mount(root) { mountTimeline(root); onClick(root, "data-r", (i) => { FG.store.set("add:reason", +i); FG.refresh(); }); } };
    },
  });

  [["PO file", "Signed and supporting documents by service type, visa matrix.", "po-file", "purchase order consultants translation interpretation visa signature"],
    ["Payment file", "Delivery, invoice match and payment package.", "payment-file", "invoice payment delivery acceptance"],
    ["Year-end closing", "2026 closing rules, allocation table and checklist.", "year-end", "accrual cca prepaid fiche po fims december 2026 2027"],
    ["Petty cash", "€100 projects / €50 OB limits and pre-spend CCM approval.", "petty-cash", "cash small expense receipt"],
    ["Filing & audit trail", "DMS structure, evidence map and audit documents.", "filing", "dms archive evidence audit"],
    ["Financial reporting", "Reporting workflow and controls.", "foma/reports", "report fims webfocus reconcile"],
    ["Forecast & budget revision", "Forecast workflow, change triggers and roles.", "foma/forecast", "forecast reallocation extension staff charging back"],
    ["Addendum workflow", "Joint Programme addendum package.", "foma/addendum", "addendum jp donor eu"],
  ].forEach(([t, s, p, k]) => FG.addIndex(t, s, p, "Module", k));
  FOMA.forEach(([p, t, s]) => FG.addIndex(t, `FOMA · ${s}`, `foma/${p}`, "Workflow"));
  C.poBestPractice.forEach(([d]) => FG.addIndex(d, "PO file · best practice", "po-file", "Practice"));
})();
