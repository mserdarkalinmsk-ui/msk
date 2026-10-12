/* VAT procedures and Events & GDD modules. Rules come from the guide's own content
   (procurement stage "VAT, Invoice & Payment", Event Management PO/payment packages, best practice). */
(function () {
  "use strict";
  const { C, esc, euro, ui, route } = FG;
  const stage = C.procurementStages.find((s) => s.name === "Contract Execution & Payment");
  const sec = Object.fromEntries(stage.sections);

  /* ---------- pure logic (exported for tests) ---------- */
  const CARD_SINGLE = 5000, CARD_MONTHLY = 30000;
  FG.logic = FG.logic || {};
  // Card payments are exceptions: ≤ €5,000 per purchase and ≤ €30,000 Organisation-wide per month.
  FG.logic.paymentMethod = function (amount, monthUsed) {
    amount = Math.max(0, Number(amount) || 0); monthUsed = Math.max(0, Number(monthUsed) || 0);
    if (!amount) return { tone: "warn", title: "Enter the amount", text: "Bank transfer to the contractual account is the standard route." };
    if (amount > CARD_SINGLE) return { tone: "risk", title: "Bank transfer", text: `${euro(amount)} is above the ${euro(CARD_SINGLE)} single card-purchase limit. Pay by transfer to the bank account stipulated in the contract.` };
    if (amount + monthUsed > CARD_MONTHLY) return { tone: "risk", title: "Bank transfer", text: `This purchase would take monthly card use to ${euro(amount + monthUsed)}, above the ${euro(CARD_MONTHLY)} Organisation-wide monthly limit.` };
    return { tone: "warn", title: "Card possible as an exception", text: `Within the ${euro(CARD_SINGLE)} single and ${euro(CARD_MONTHLY)} monthly limits (${euro(CARD_MONTHLY - monthUsed - amount)} left this month). Card payments remain exceptions — transfer is preferred.` };
  };
  // Default payment term: 60 days from receipt of invoice or execution, whichever is later.
  FG.logic.paymentDue = function (invoiceDate, executionDate, days = 60) {
    const a = invoiceDate ? new Date(invoiceDate) : null, b = executionDate ? new Date(executionDate) : null;
    const base = a && b ? (a > b ? a : b) : a || b; if (!base || isNaN(base)) return null;
    const due = new Date(base); due.setDate(due.getDate() + days);
    return { base, due, from: base === a ? "invoice receipt" : "execution" };
  };
  // Initial vs final event budget; every changed line needs a reason and CCM approval evidence when material.
  FG.logic.eventBudget = function (lines) {
    const rows = lines.filter((l) => l.item || Number(l.initial) || Number(l.final)).map((l) => {
      const initial = Number(l.initial) || 0, final = Number(l.final) || 0, diff = final - initial;
      return { ...l, initial, final, diff, pct: initial ? (diff / initial) * 100 : final ? 100 : 0 };
    });
    const initial = rows.reduce((a, r) => a + r.initial, 0), final = rows.reduce((a, r) => a + r.final, 0);
    return { rows, initial, final, diff: final - initial, pct: initial ? ((final - initial) / initial) * 100 : 0, changed: rows.filter((r) => r.diff !== 0) };
  };

  /* ---------- VAT procedures ---------- */
  const INVOICE_FIELDS = [["supplier", "Supplier identified", "Name and address match the contract / PO."], ["number", "Invoice number", "Unique invoice reference."], ["vat", "VAT number if applicable", "Supplier VAT number where the supplier is VAT-registered."], ["deliverables", "Deliverables described", "Matches the accepted contractual deliverables."], ["fees", "Fees / subtotals", "Applicable fee and subtotals shown."], ["total", "Total amount", "Equals the accepted amount; VAT treatment as agreed before signature."], ["modalities", "Payment modalities", "Bank details match the account stipulated in the contract."], ["addressee", "Addressed to the Council of Europe", "Correct addressee on the invoice."]];
  const VAT_STEPS = [
    ["Before signature", "Clarify VAT", "Establish the supplier's VAT status and place of taxation before signing and sending the contract / order form. Protocol is the point of contact for VAT questions.", ["Supplier VAT status confirmed", "Place of taxation identified", "Protocol consulted where unclear", "VAT treatment written into the contract / order form"]],
    ["PO submission", "Check exemption", "Check VAT exemption or tax rules before submitting the PO — never assume a supplier is always tax-exempt.", ["Exemption / tax rule checked for this supplier and service", "Amounts in the PO consistent with the agreed VAT treatment"]],
    ["Invoice", "Verify particulars", "The invoice must carry the particulars below and match the contract and accepted deliverables.", ["All invoice particulars present", "VAT on the invoice matches the agreed treatment"]],
    ["Payment", "Pay correctly", sec["Payment route"], ["Bank account matches the contract", "Payment date respects the agreed terms"]],
    ["Filing", "Keep the VAT trail", "File VAT correspondence and evidence in the DMS under Project Contract Documents → VAT, together with the invoice and payment evidence.", ["VAT correspondence filed", "Invoice and payment evidence filed together"]],
  ];
  route("vat", {
    crumbs: () => [["Projects", "projects"], ["VAT procedures", "vat"]],
    render() {
      const step = Math.min(FG.store.get("vat:step", 0), VAT_STEPS.length - 1), s = VAT_STEPS[step];
      const inv = FG.store.get("vat:invoice", {}), invDone = INVOICE_FIELDS.filter(([k]) => inv[k]).length;
      const pay = FG.store.get("vat:pay", { amount: "", month: "", invoiceDate: "", executionDate: "" });
      const m = FG.logic.paymentMethod(pay.amount, pay.month), due = FG.logic.paymentDue(pay.invoiceDate, pay.executionDate);
      return { html: `${ui.head("Projects · VAT", "VAT procedures", "VAT is a procurement planning issue as well as a payment issue: clarify it before signature, check it at PO and invoice, and keep the trail.", `<a class="btn" href="#/procurement/contract-execution-and-payment">Procurement stage 12</a><a class="btn primary" href="#/payment-file">Payment file</a>`)}
        ${ui.callout("warn", "Key rule", stage.warning)}
        <section class="card mt"><div class="card-head"><div><h3>VAT across the file</h3><small>Step ${step + 1} of ${VAT_STEPS.length}</small></div></div><div class="card-body stack">
          ${ui.flowHeader(VAT_STEPS, step, (x, j) => `<small>${j + 1} · ${esc(x[0].toUpperCase())}</small><b>${esc(x[1])}</b>`)}
          <p>${esc(s[2])}</p>${ui.checklist(`vat:step${step}`, s[3], `${s[1]} — checks`)}
        </div></section>
        <div class="grid g2 mt">
          <section class="card"><div class="card-head"><div><h3>Invoice particulars check</h3><small>${esc(sec["Invoice content"])}</small></div>${ui.tag(`${invDone}/${INVOICE_FIELDS.length}`, invDone === INVOICE_FIELDS.length ? "good" : "warn")}</div><div class="card-body stack">
            <div class="checklist" data-invoice>${INVOICE_FIELDS.map(([k, t, d]) => `<label class="check ${inv[k] ? "done" : ""}"><input type="checkbox" data-k="${k}" ${inv[k] ? "checked" : ""}><div><b>${esc(t)}</b><small>${esc(d)}</small></div></label>`).join("")}</div>
            ${invDone === INVOICE_FIELDS.length ? ui.callout("good", "Invoice can be processed", "All particulars are present. Attach acceptance evidence and continue with the payment file.") : ui.callout("risk", "Return to supplier", `Missing: ${INVOICE_FIELDS.filter(([k]) => !inv[k]).map((f) => f[1]).join(", ")}.`)}
            <button class="btn sm" data-inv-reset>New invoice</button></div></section>
          <section class="card"><div class="card-head"><div><h3>Payment method & due date</h3><small>Card: ≤ ${euro(CARD_SINGLE)} per purchase, ≤ ${euro(CARD_MONTHLY)} per month. Default term: 60 days.</small></div></div><div class="card-body stack">
            <form class="grid g2" data-pay>${ui.number("amount", pay.amount, "Amount (€)")}${ui.number("month", pay.month, "Card use this month so far (€)")}
              <label class="field"><span>Invoice received</span><input class="input" type="date" name="invoiceDate" value="${esc(pay.invoiceDate)}"></label><label class="field"><span>Execution / acceptance</span><input class="input" type="date" name="executionDate" value="${esc(pay.executionDate)}"></label></form>
            ${ui.callout(m.tone, m.title, m.text)}
            ${due ? ui.callout("info", `Payment due by ${FG.fmtDate(due.due)}`, `60 days from ${due.from} (${FG.fmtDate(due.base)}), the later of the two dates — unless the contract sets other negotiated terms.`) : `<p class="small muted">Enter the invoice and execution dates to compute the default due date.</p>`}
          </div></section>
        </div>`,
        mount(root) {
          root.addEventListener("click", (e) => {
            const f = e.target.closest("[data-flow]"); if (f) { FG.store.set("vat:step", +f.dataset.flow); FG.refresh(); }
            if (e.target.closest("[data-inv-reset]")) { FG.store.set("vat:invoice", {}); FG.refresh(); }
          });
          root.querySelector("[data-invoice]").addEventListener("change", (e) => { const v = FG.store.get("vat:invoice", {}); v[e.target.dataset.k] = e.target.checked ? 1 : 0; FG.store.set("vat:invoice", v); FG.refresh(); });
          const form = root.querySelector("[data-pay]");
          form.addEventListener("change", () => { FG.store.set("vat:pay", Object.fromEntries(new FormData(form))); FG.refresh(); });
        } };
    },
  });

  /* ---------- Events & GDD ---------- */
  const EV_STEPS = [
    ["Plan", "Work plan & call-off", "Define the event in the work plan, run the call-off and keep all financial offers, technical proposals and cancellation policies for the assessment.", C.poServices["Event Management"].support.slice(0, 4).map((d) => d[0])],
    ["Commit", "Event Management PO", "Submit the PO package. The selected financial proposal is signed by the CCM after the PO is opened; no service starts before the PO is issued.", C.poServices["Event Management"].signed.map((d) => d[0])],
    ["Deliver", "Run the event", "Collect delivery evidence as the event happens: signature list, agenda, accommodation, transfer and travel records, photos.", ["Signature list", "Agenda", "Accommodation / transfer / travel records", "Event photo"]],
    ["Reconcile", "Final budget", "Compare the final budget with the initial one. Keep e-mails on significant financial changes with CCM approval, and exchange-rate evidence where amounts were in another currency.", ["Final budget signed by Project Manager / Officer", "CCM approval e-mails for significant changes", "Exchange-rate document"]],
    ["Pay", "Payment file", "Build the Event Management payment package and send it to Finance.", C.payServices["Event Management"].support.map((d) => d[0])],
  ];
  route("events", {
    crumbs: () => [["Projects", "projects"], ["Events & GDD", "events"]],
    render() {
      const step = Math.min(FG.store.get("ev:step", 0), EV_STEPS.length - 1), s = EV_STEPS[step];
      const lines = FG.store.get("ev:budget", [{ item: "Venue", initial: 4000, final: 4000 }, { item: "Catering", initial: 2500, final: 3100 }, { item: "Interpretation", initial: 3000, final: 2600 }, { item: "Travel & accommodation", initial: 6000, final: 6400 }]);
      const b = FG.logic.eventBudget(lines);
      const fx = FG.store.get("ev:fx", { amount: "", currency: "TRY", rate: "", source: "" }), fxEur = Number(fx.amount) && Number(fx.rate) ? Number(fx.amount) / Number(fx.rate) : null;
      const links = C.usefulLinks.filter((l) => /EventS|GDD/.test(l.title));
      return { html: `${ui.head("Projects · Events", "Events & GDD", "Event-related finance from the call-off to the payment file: the Event Management PO and payment packages, budget reconciliation and exchange-rate evidence.", links.map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.title)} ↗</a>`).join(""))}
        <section class="card"><div class="card-head"><div><h3>Event finance workflow</h3><small>Step ${step + 1} of ${EV_STEPS.length}</small></div></div><div class="card-body stack">
          ${ui.flowHeader(EV_STEPS, step, (x, j) => `<small>${j + 1} · ${esc(x[0].toUpperCase())}</small><b>${esc(x[1])}</b>`)}
          <p>${esc(s[2])}</p>${ui.checklist(`ev:step${step}`, s[3], "Documents for this step")}</div></section>
        <section class="card mt"><div class="card-head"><div><h3>Initial vs final event budget</h3><small>Every change needs a reason; significant financial changes need CCM approval evidence in the payment file.</small></div>${ui.tag(`${b.diff >= 0 ? "+" : ""}${euro(b.diff)} (${b.pct.toFixed(1)}%)`, b.diff > 0 ? "warn" : "good")}</div><div class="card-body stack">
          <div class="table-wrap"><table class="t" data-evb><thead><tr><th>Item</th><th class="n">Initial (€)</th><th class="n">Final (€)</th><th class="n">Change</th><th></th></tr></thead><tbody>
            ${b.rows.map((r, i) => `<tr><td><input class="input" data-i="${i}" data-f="item" value="${esc(r.item)}" aria-label="Item"></td><td><input class="input" type="number" min="0" data-i="${i}" data-f="initial" value="${r.initial}" aria-label="Initial amount"></td><td><input class="input" type="number" min="0" data-i="${i}" data-f="final" value="${r.final}" aria-label="Final amount"></td><td class="n" style="color:${r.diff > 0 ? "var(--warn)" : r.diff < 0 ? "var(--good)" : "inherit"}">${r.diff >= 0 ? "+" : ""}${euro(r.diff)}<small>${r.pct.toFixed(1)}%</small></td><td><button class="btn ghost sm" data-del="${i}" aria-label="Remove ${esc(r.item)}">×</button></td></tr>`).join("")}
          </tbody><tfoot><tr><td>Total</td><td class="n">${euro(b.initial)}</td><td class="n">${euro(b.final)}</td><td class="n">${b.diff >= 0 ? "+" : ""}${euro(b.diff)}</td><td></td></tr></tfoot></table></div>
          <div class="row"><button class="btn sm" data-add>＋ Add item</button><span class="spacer"></span></div>
          ${b.changed.length ? ui.callout("warn", `${b.changed.length} item(s) changed`, `Document the reason for: ${b.changed.map((r) => r.item || "unnamed item").join(", ")}. Attach CCM approval e-mails for significant changes and the final budget signed by the Project Manager / Officer.`) : ui.callout("good", "No change", "Final budget equals the initial budget.")}
        </div></section>
        <div class="grid g2 mt">
          <section class="card"><div class="card-head"><div><h3>Exchange-rate evidence</h3><small>For costs incurred in another currency.</small></div></div><form class="card-body form" data-fx>
            <div class="grid g3">${ui.number("amount", fx.amount, "Amount in local currency")}<label class="field"><span>Currency</span><input class="input" name="currency" value="${esc(fx.currency)}" maxlength="3"></label>${ui.number("rate", fx.rate, `Rate (${esc(fx.currency || "XXX")} per €1)`)}</div>
            <label class="field"><span>Rate source and date</span><input class="input" name="source" value="${esc(fx.source)}" placeholder="e.g. official rate of the month, date"></label>
            ${fxEur != null ? ui.callout(fx.source ? "good" : "warn", `${euro(fxEur, 2)}`, fx.source ? `Keep this rate (${fx.source}) as the exchange-rate document in the payment file.` : "Record the rate source and date — the payment file needs the exchange-rate evidence.") : `<p class="small muted">Enter amount and rate to convert.</p>`}</form></section>
          <section class="card"><div class="card-head"><h3>Best practice</h3></div><div class="card-body">${ui.pairs([...C.payBestPractice, ...C.poBestPractice].filter((x) => /event/i.test(x.join(" "))))}</div></section>
        </div>`,
        mount(root) {
          const save = (l) => { FG.store.set("ev:budget", l); FG.refresh(); };
          root.addEventListener("click", (e) => {
            const f = e.target.closest("[data-flow]"); if (f) { FG.store.set("ev:step", +f.dataset.flow); FG.refresh(); }
            if (e.target.closest("[data-add]")) save([...lines, { item: "", initial: 0, final: 0 }]);
            const d = e.target.closest("[data-del]"); if (d) save(lines.filter((_, i) => i !== +d.dataset.del));
          });
          root.querySelector("[data-evb]").addEventListener("change", (e) => { const i = +e.target.dataset.i; if (isNaN(i)) return; const l = lines.map((x) => ({ ...x })); l[i][e.target.dataset.f] = e.target.dataset.f === "item" ? e.target.value : Number(e.target.value) || 0; save(l); });
          const fxf = root.querySelector("[data-fx]"); fxf.addEventListener("change", () => { FG.store.set("ev:fx", Object.fromEntries(new FormData(fxf))); FG.refresh(); });
        } };
    },
  });
  FG.addIndex("VAT procedures", "VAT before signature, invoice particulars, card limits, payment terms", "vat", "Module", "vat tax exemption protocol invoice card 5000 30000 60 days");
  FG.addIndex("Events & GDD", "Event Management PO and payment, final budget, exchange rates", "events", "Module", "event conference call-off exchange rate gdd final budget");
})();
