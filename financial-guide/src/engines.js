/* Decision engines: pure functions from case facts to a structured decision.
   Rules are carried over from v14 unchanged; only the presentation is new. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FG_ENGINES = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LIMITS = { lowGoods: 2000, lowIntellectual: 6000, legalReview: 55000, international: 184000, publicPrices: 10000, grant: 15000, heading: 25 };
  const euro = (n) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n) || 0);
  const num = (v) => Math.max(0, Number(v) || 0);
  const signed = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  function procurement(input) {
    const amount = num(input.amount), type = input.type || "general", fund = input.funding || "ordinary";
    const market = input.market || "many", urgency = input.urgency || "none", pattern = input.pattern || "oneoff";
    const low = type === "intellectual" ? LIMITS.lowIntellectual : LIMITS.lowGoods;
    let route, approval, control = "Standard validation", digital = "Standard route", tone = "good";
    if (amount <= low) {
      route = "Direct Award"; approval = "Commitments Officer / delegated authority"; digital = "No competitive e-proc tender route";
    } else if (amount < LIMITS.international) {
      route = "Competitive Bidding"; approval = "CCM / applicable approval route";
      digital = amount >= LIMITS.legalReview ? "E-procurement route applies" : "Competitive procedure — confirm digital publication route";
      if ((fund === "xb" || fund === "mixed") && amount >= LIMITS.legalReview) { control = "DLAPIL Legal Compliance Review before CCM approval"; tone = "warn"; }
    } else {
      route = "International Public Call for Tenders"; approval = "Tenders Board + applicable signatory";
      control = "Tenders Board governance / approval"; digital = "E-procurement mandatory"; tone = "warn";
    }
    let risk = 0; const flags = [];
    if (market === "limited") { risk += 12; flags.push(["Limited supplier market", "warn"]); }
    if (market === "single") { risk += 28; flags.push(["Single supplier identified", "risk"]); }
    if (urgency === "operational") { risk += 8; flags.push(["Operational urgency", "warn"]); }
    if (urgency === "emergency") { risk += 28; flags.push(["Emergency exception review", "risk"]); }
    if (input.publicPrices && amount < LIMITS.publicPrices && amount > low) {
      control = "Public-price comparison route — confirm all conditions and retain at least 3 public prices";
      flags.push(["Public-price evidence", "good"]);
    }
    if (!flags.length) flags.push(["No exceptional trigger identified", "good"]);
    flags.push([control, tone === "warn" ? "warn" : "neutral"]);
    const contract = pattern === "oneoff" ? "One-off contract" : pattern === "repeat" ? "Framework contract" : "Framework agreement / structured call-off";
    const score = Math.max(56, 96 - risk - (amount === 0 ? 20 : 0));
    const docs = route === "Direct Award"
      ? [["Need & value note", "Specification / ToR, full foreseeable value, budget availability and aggregation check."], ["Market / supplier evidence", "Quotation, market research or public-price evidence where applicable."], ["Approval & integrity", "Approval trail, conflict checks and justification of any exceptional circumstances."], ["Contract / PO file", "Signed contractual basis, PO/commitment, delivery and filing trail."]]
      : [["Tender package", "Specification / ToR, published criteria, invitation/publication and timetable."], ["Competition record", "Bids, clarifications, opening/admissibility and evaluation trail."], ["Integrity evidence", "Declarations, conflict checks, confidentiality and equal-treatment record."], ["Award & contract", "Award decision, notifications, signed contract, PO and e-proc record."]];
    return {
      kicker: "Recommended procurement route", route, tone, score,
      summary: `Threshold, funding, market, urgency and contract-pattern controls combined. ${control}.`,
      meta: [["Value", euro(amount)], ["Funding", fund === "ordinary" ? "Ordinary Budget" : fund === "xb" ? "Extrabudgetary" : "Mixed"], ["Confidence", score + "%"]],
      kpis: [["Foreseeable value", euro(amount)], ["Contract model", contract], ["Approval route", approval], ["Digital route", digital]],
      scale: { value: amount, max: LIMITS.international, marks: [[0, "€0"], [low, euro(low) + " low-value"], [LIMITS.legalReview, "€55k control"], [LIMITS.international, "€184k international"]] },
      reasons: [["Value test", `${euro(amount)} foreseeable value; applicable low-value limit ${euro(low)}.`],
        ["Market", market === "many" ? "Several credible suppliers support competition." : market === "limited" ? "Market appears limited; market research should be retained." : "Only one supplier is identified; this does not by itself create an exception."],
        ["Urgency", urgency === "none" ? "No urgency-based exception indicated." : urgency === "operational" ? "Operational urgency does not automatically justify bypassing competition." : "Emergency circumstances require strict evidence and exceptional-route review."],
        ["Contract model", `${contract}; contract structure remains separate from procedure selection.`]],
      flags, docs,
      confidence: score >= 85 ? ["High-confidence route", "Inputs are internally consistent and no material exception trigger dominates the case."] : ["Route requires validation", "Market / urgency / control conditions increase the need for documented validation."],
      actions: [["Confirm aggregation", "Include renewals, lots, options, expected call-offs and the full foreseeable duration."], ["Lock procedure & approvals", `${route}; ${approval}.`], ["Build the file pack", "Use the generated document set and retain all exception evidence before award."]],
    };
  }

  function budgetRevision(input) {
    const project = input.project || "jp", change = input.change || "reallocation";
    const current = num(input.current), proposed = num(input.proposed);
    const variation = current ? ((proposed - current) / current) * 100 : 0;
    const total = input.totalChange === "yes" || change === "total";
    const duration = input.durationChange === "yes" || change === "extension";
    const scope = input.scopeChange === "yes" || change === "scope";
    const units = input.unitsExceeded === "yes", basis = input.unitBasis || "no";
    const newline = input.newLine === "yes" || change === "newline";
    const direct = total || duration || scope, structural = units || basis === "yes" || newline;
    let route, acceptance, tone = "good";
    if (project === "jp") {
      if (direct || Math.abs(variation) > LIMITS.heading) { route = "Addendum"; acceptance = "EU acceptance + contractual amendment"; tone = "risk"; }
      else if (structural) { route = "Notification review"; acceptance = "Validate formal notification / clearance route"; tone = "warn"; }
      else { route = "Notification"; acceptance = "No EU acceptance required under the ≤25% heading route"; }
    } else {
      const earmarked = input.donor === "earmarked";
      if (direct) { route = "Contractual / donor review"; acceptance = earmarked ? "Donor acceptance required" : "Assess contractual amendment requirements"; tone = "warn"; }
      else if (structural) { route = "Formal revision review"; acceptance = earmarked ? "Donor acceptance / confirmation may be required" : "Internal / programming confirmation route"; tone = "warn"; }
      else { route = "VC budget revision"; acceptance = earmarked ? "Donor acceptance required" : "No donor acceptance required"; }
    }
    const critical = direct || Math.abs(variation) > LIMITS.heading;
    const score = critical ? 96 : structural ? 86 : 94;
    const isAddendum = route === "Addendum", isNotification = route.startsWith("Notification");
    return {
      kicker: "Formal budget change route", route, tone, score,
      summary: "Budget-heading variation combined with unit, structure and contractual-change triggers. The highest applicable route prevails.",
      meta: [["Project", project === "jp" ? "Joint Programme" : "Voluntary Contribution"], ["Variation", current ? Math.abs(variation).toFixed(1) + "%" : "—"], ["Confidence", score + "%"]],
      kpis: [["Heading variation", current ? signed(variation) : "—"], ["Current heading", euro(current)], ["Proposed heading", euro(proposed)], ["External acceptance", acceptance]],
      reasons: [["Heading variation", `${signed(variation)} ${Math.abs(variation) > LIMITS.heading ? "— above 25% threshold" : "— within 25% threshold"}`],
        ["Total budget", total ? "Changes — contractual trigger" : "No change"],
        ["Duration / end date", duration ? "Changes — contractual trigger" : "No change"],
        ["Scope / objectives", scope ? "Changes — contractual trigger" : "No change"],
        ["Nb of Units", units ? "Approved units exceeded — formal review" : "Within approved structure"],
        ["Unit basis", basis === "yes" ? "Material measurement basis change" : basis === "generic" ? "Generic reporting label only — no material change assumed" : "No change"],
        ["Budget structure", newline ? "New budget line introduced" : "No new line"]],
      docs: [["Latest approved budget", "Signed / approved baseline used for the comparison."], ["Financial report & forecast", "Current execution position and forward-looking impact of the change."], ["Variation analysis", "Current vs proposed heading amounts, % variation and justification."],
        isAddendum ? ["Addendum package", "Draft amendment, approvals and external acceptance evidence."] : ["Notification / revision package", "Clean revised budget, justification, clearance and communication trail."],
        ["Implementation updates", "PMM, delegation letter, fiche staff and related records at the correct point in the route."], ["Decision trail", "RFO / CCM / Programming / donor evidence as applicable."]],
      confidence: critical ? ["Contractual trigger identified", "A direct contractual or >25% threshold trigger determines the route."] : /review/i.test(route) ? ["Formal review required", "Unit / structure changes require validation before implementation."] : ["Standard revision route", "The budget-heading route is clear from the supplied answers."],
      actions: [["Reconcile the baseline", "Confirm the latest approved budget, current financial report and forecast."], ["Document each trigger", "Keep the variation calculation and evidence for units, new lines or contractual changes."],
        ["Follow the generated route", isAddendum ? "Do not implement the contractual change before the required external acceptance / signatures." : isNotification ? "Prepare and validate the Notification package before implementation where required." : "Apply the VC / donor route shown above."]],
    };
  }

  function contractStrategy(input) {
    const pattern = input.pattern || "fixed", defined = input.defined || "yes", suppliers = input.suppliers || "single";
    const mini = input.mini || "no", prices = input.prices || "yes", ceiling = input.ceiling || "yes";
    let one = 0, fc = 0, fa = 0;
    if (pattern === "fixed") one += 5; if (defined === "yes") one += 3; if (mini === "no") one += 1;
    if (pattern === "recurring") fc += 5; if (defined !== "no") fc += 2; if (prices === "yes") fc += 2;
    if (pattern === "variable") fa += 5; if (mini === "yes") fa += 4; if (suppliers === "multiple") fa += 2; if (defined === "no") fa += 2; if (prices === "no") fa += 1;
    const max = Math.max(one, fc, fa);
    const route = max === one ? "One-off contract" : max === fa ? "Framework agreement" : "Framework contract";
    const summary = route === "One-off contract" ? "A single clearly defined need with concrete deliverables and completion point." : route === "Framework contract" ? "Recurring needs can be ordered through defined units / prices while total volume remains uncertain." : "Recurring, variable or complex needs require a structured call-off / mini-competition model.";
    return {
      kicker: "Recommended contract structure", route, tone: "good", score: null, summary,
      meta: [["Top fit", max + " pts"], ["Need", pattern], ["Prices", prices]],
      kpis: [["Recommended model", route], ["Supplier model", suppliers === "multiple" ? "Multiple suppliers" : "Single supplier"], ["Mini-competition", mini === "yes" ? "Yes" : "No"], ["Ceiling", ceiling === "yes" ? "Defined / controllable" : "Uncertain"]],
      fit: [["One-off contract", one], ["Framework contract", fc], ["Framework agreement", fa]],
      reasons: [["Demand pattern", pattern === "fixed" ? "One clearly defined need." : pattern === "recurring" ? "Recurring and broadly predictable need." : "Recurring but variable / complex need."],
        ["Definition level", defined === "yes" ? "Quantity / deliverables can be defined now." : defined === "partial" ? "Only part of the future need is definable." : "Future deliverables cannot be defined sufficiently now."],
        ["Supplier & competition", suppliers === "multiple" ? `Multiple suppliers anticipated${mini === "yes" ? " with mini-competition." : "."}` : "Single supplier model anticipated."],
        ["Pricing & ceiling", `${prices === "yes" ? "Unit prices can be fixed" : prices === "partial" ? "Pricing can only partly be fixed" : "Pricing remains variable"}; ${ceiling === "yes" ? "ceiling can be controlled" : "maximum volume is uncertain"}.`]],
      docs: [["Structure schedule", "Scope, units/deliverables, pricing mechanism, duration and ceiling."], ["Ordering mechanism", route === "Framework agreement" ? "Call-off / mini-competition rules and secondary-award methodology." : "Order forms, ranking/pooling or direct delivery rules."], ["Performance controls", "Acceptance criteria, KPIs, supplier performance and amendment controls."], ["Procurement route", "Run threshold routing separately; contract type never replaces the procurement procedure decision."]],
      actions: [["Confirm full demand horizon", "Check frequency, forecast volume and foreseeable recurrence before drafting."], ["Design ordering logic", "Define orders, call-offs, ranking / pooling or mini-competition before launch."], ["Run Procurement Route", "Apply the value/funding threshold engine independently of contract structure."]],
    };
  }

  function grantProcedure(input) {
    const amount = num(input.amount), exception = input.exception || "no", basis = input.basis || "none";
    const count = Math.max(1, num(input.count) || 1), publication = input.publication || "yes", type = input.type || "Project-related Grant";
    let route, template, tone = "good", score = 95;
    if (amount < LIMITS.grant) { route = "Direct award"; template = "G9.2A"; }
    else if (exception === "yes") { route = "Exceptional direct award"; template = "G9.2B"; tone = "warn"; score = 74; }
    else { route = "Competitive call"; template = "Call + evaluation + award templates"; }
    if (publication === "no" && amount >= LIMITS.grant && exception !== "yes") { tone = "warn"; score = 68; }
    const basisLabel = { emergency: "Unforeseeable emergency", unique: "Unique grantee characteristics", predetermined: "Predetermined partner / no meaningful scope for call", none: "not specified" }[basis] || basis;
    const competitive = route === "Competitive call";
    return {
      kicker: "Recommended grant procedure", route, tone, score,
      summary: `Rule logic is applied to the total grant-award procedure budget of ${euro(amount)}.`,
      meta: [["Grants", count], ["Publication", publication === "yes" ? "Feasible" : "Constrained"], ["Confidence", score + "%"]],
      kpis: [["Procedure budget", euro(amount)], ["Threshold", euro(LIMITS.grant)], ["Core template", template], ["Grant type", type]],
      reasons: [["Threshold basis", `Total procedure budget ${euro(amount)}; route is not determined per grantee.`], ["Intended grants", `${count} planned grant(s); indicative average ${euro(amount / count)} only for orientation.`],
        ["Publication", publication === "yes" ? "Open/public call appears feasible." : "Publication is constrained; this does not automatically establish an exception."],
        ["Exception", exception === "yes" ? `Exception claimed: ${basisLabel}. Evidence must substantiate the legal/factual basis.` : "No exception to competition is claimed."]],
      docs: competitive
        ? [["Call package", "Call, timetable, eligibility, selection and award criteria."], ["Evaluation governance", "Committee appointment, declarations, assessment grids and consolidated report."], ["Award decision", "Commitments Officer decision, applicant notifications and audit trail."], ["Grant agreement", "Signed agreement, approved budget, payment, reporting and monitoring conditions."]]
        : [["Grant case file", "Purpose, beneficiary, eligibility and total procedure budget."], ["Justification", route === "Exceptional direct award" ? `Motivated exception justification supported by evidence (${basisLabel}).` : "Selection and proportionality rationale."], ["Award approval", "Commitments Officer / delegated decision and control trail."], ["Grant agreement", "Signed agreement, budget, payment schedule, reporting and monitoring obligations."]],
      confidence: score >= 85 ? ["Procedure route is clear", "Threshold and competition inputs point consistently to the recommended route."] : ["Exception / publication conditions need validation", "Non-publication or a selected exception basis is never treated as automatically sufficient."],
      actions: [["Confirm eligibility & budget", "Validate beneficiary eligibility, funding conditions and the total award procedure budget."],
        competitive ? ["Launch controlled call", "Keep published criteria and weighting unchanged throughout evaluation."] : ["Complete justification & award file", "Retain a complete selection / exception justification and approval trail."],
        ["Move into grant management", "Agreement → payment/pre-financing → implementation monitoring → reporting → final verification."]],
    };
  }

  function yearEnd(input) {
    const delivery = input.delivery || "current", invoice = input.invoice || "yes", budget = input.budget || "annual";
    const po = input.po || "open", measurable = input.measurable || "yes";
    let route, recognition, tone = "good", score = 94;
    if (delivery === "current" && invoice === "yes") { route = "Current-year expenditure"; recognition = "Record current-year expenditure; finalise PO once expenditure is recorded."; }
    else if (delivery === "current") { route = "Accrual / provision review"; recognition = "Accrue the delivered current-year portion using supportable evidence and calculation."; tone = "warn"; }
    else if (delivery === "next") { route = "Next-year treatment"; recognition = budget === "annual" ? "Move the financial treatment to the next year and handle the PO accordingly." : "Special-account commitment may remain open where applicable."; }
    else { route = "Split-year treatment"; recognition = "Separate the current-year delivered portion from the next-year portion; avoid recognising undelivered work as current-year expenditure."; tone = "warn"; }
    if (measurable === "no") { score = 62; tone = "warn"; }
    if (po === "closed" && delivery !== "next") { score = Math.min(score, 70); tone = "warn"; }
    return {
      kicker: "Year-end financial treatment", route, tone, score, summary: recognition,
      meta: [["Budget", budget === "annual" ? "Annual" : "Special account"], ["Invoice", invoice === "yes" ? "Received" : "Not received"], ["Readiness", score + "%"]],
      kpis: [["Treatment", route], ["PO status", { open: "Open", closed: "Closed / finalised", none: "No PO" }[po]], ["Evidence quality", measurable === "yes" ? "Measurable" : "Review required"], ["Budget type", budget === "annual" ? "Annual budget" : "Special account"]],
      reasons: [["Delivery timing", delivery === "current" ? "Fully delivered in current year." : delivery === "next" ? "Delivery belongs to next year." : "Delivery spans two financial years."],
        ["Invoice", invoice === "yes" ? "Invoice received." : "No invoice at year-end; treatment must rely on delivery evidence / accrual support where applicable."],
        ["Budget", budget === "annual" ? "Annual-budget year-end constraints apply." : "Special-account treatment may allow different commitment handling."],
        ["Measurement", measurable === "yes" ? "Delivered portion can be measured reliably." : "Delivered portion cannot currently be measured reliably — blocker for confident closing treatment."],
        ["PO status", po === "open" ? "PO / commitment remains open." : po === "closed" ? "PO is already closed / finalised; corrective treatment may be needed." : "No PO — confirm the valid commitment basis."]],
      docs: [["Delivery / acceptance evidence", "Evidence of goods/services actually delivered by the closing date."], ["Invoice / accrual support", invoice === "yes" ? "Invoice and reconciliation to delivered amount." : "Documented accrual calculation and basis for the estimate."], ["PO / commitment evidence", "Status and reconciliation of the commitment to the delivered portion."], ["Closing calculation", "Clear split by financial year, approvals, accounting treatment and audit trail."]],
      confidence: score >= 85 ? ["Treatment can be prepared", "Delivery, invoice and commitment inputs provide a supportable year-end route."] : ["Closing treatment needs review", "Measurement or PO status creates a control gap that should be resolved before final posting."],
      actions: [["Reconcile delivery cut-off", "Confirm what was actually delivered by year-end."], ["Apply accounting treatment", recognition], ["Close the audit trail", "Retain calculation, approvals, invoice/accrual support and PO evidence together."]],
    };
  }

  function readiness(title, controls, checked) {
    const done = controls.filter((c) => checked[c[0]]), missing = controls.filter((c) => !checked[c[0]]);
    const score = Math.round((done.length / Math.max(1, controls.length)) * 100);
    const tone = score === 100 ? "good" : score >= 70 ? "warn" : "risk";
    const route = score === 100 ? "Ready for final validation" : score >= 70 ? "Review open gaps" : "Not ready";
    return {
      kicker: title, route, tone, score, summary: `${done.length} of ${controls.length} controls are confirmed.`,
      meta: [["Score", score + "%"], ["Open", missing.length], ["Priority", missing[0] ? missing[0][1] : "None"]],
      kpis: [["Controls completed", `${done.length}/${controls.length}`], ["Readiness score", score + "%"], ["Open gaps", missing.length], ["Status", route]],
      reasons: missing.length ? missing.map((c) => [c[1], "Missing / not yet confirmed."]) : [["Complete", "All listed controls are confirmed."]],
      confidence: score === 100 ? ["Ready for final validation", "All listed controls are present; complete final validation and filing."] : [score >= 70 ? "Substantially ready" : "Material gaps remain", `Resolve ${missing.length} outstanding control(s) before treating the file as complete.`],
      actions: [["Resolve critical gaps", missing.length ? missing.slice(0, 4).map((c) => c[1]).join(" · ") : "No open control gaps."], ["Validate consistency", "Check that amounts, supplier / beneficiary data and approvals reconcile across the file."], ["Lock the filing trail", "Archive the decision, execution and payment / audit evidence together."]],
    };
  }

  function whatIf(input) {
    const current = num(input.current), proposed = num(input.proposed), change = input.change || "none";
    const variation = current ? ((proposed - current) / current) * 100 : 0;
    const addendum = change !== "none" || Math.abs(variation) > LIMITS.heading;
    const route = addendum ? "Addendum" : "Notification";
    return {
      kicker: "What-if route", route, tone: addendum ? "risk" : "good", score: null,
      summary: "Simulation only: direct contractual changes override the percentage-based budget-heading route.",
      meta: [["Variation", Math.abs(variation).toFixed(1) + "%"], ["Threshold", "25%"], ["Mode", "Simulation"]],
      kpis: [["Current heading", euro(current)], ["Proposed heading", euro(proposed)], ["Variation", signed(variation)], ["Direct contractual change", change === "none" ? "No" : "Yes"]],
      reasons: [["25% threshold", Math.abs(variation) > LIMITS.heading ? "Exceeded — Addendum route indicated." : "Within threshold — Notification route indicated unless another contractual trigger applies."], ["Contractual override", change === "none" ? "No override selected." : "Direct contractual change selected; it overrides the percentage route."]],
      actions: [["Compare route", `Current simulated route: ${route}.`], ["Test another scenario", "Change the proposed amount or contractual trigger to see the route switch immediately."], ["Move to Budget Revision", "Use the full Budget Revision engine for units, new lines, donor conditions and evidence requirements."]],
    };
  }

  function pettyCash(input) {
    const limit = 50, amount = Number(input.amount) || 0;
    if (amount <= 0) return { tone: "warn", title: "Enter the expected amount", text: "Add the planned expense amount to check the applicable limit." };
    if (amount > limit) return { tone: "risk", title: "Petty cash not applicable", text: `€${amount.toFixed(2)} is above the €${limit} limit per invoice. Use the normal purchasing/payment route.` };
    if (!input.approved) return { tone: "warn", title: "Do not spend yet", text: "CCM approval must be obtained before the petty cash expense is made." };
    return { tone: "good", title: "Petty cash route available", text: `Amount is within the €${limit} limit and the pre-spend CCM approval is confirmed.` };
  }

  function grantCost(input) {
    const tests = [["necessary", "Necessary", "Required for implementation"], ["period", "Eligible period", "Falls within the permitted implementation period"], ["budgeted", "Budgeted", "Included in the approved / estimated budget"], ["verifiable", "Verifiable", "Identifiable, lawful and supported by evidence"]];
    const failed = tests.filter((t) => !input[t[0]]);
    return { tests, failed, ok: failed.length === 0, title: failed.length ? `${failed.length} core condition(s) not met` : "Core eligibility conditions appear satisfied",
      text: failed.length ? `Resolve: ${failed.map((t) => t[1]).join(", ")}. A cost failing any core test is not eligible.` : "Continue with the agreement-specific, donor-specific and indirect-cost/ineligible-cost checks." };
  }

  // 2026 expenditure-allocation table (v14 "Which Financial Year?" tool).
  function yearAllocation(input) {
    const d = input.delivery || "current", invoiced = (input.invoice || "yes") === "yes", annual = input.budget !== "special";
    if (d === "current" && invoiced) return { tone: "good", title: "2026 expenditure", text: "The good/service was delivered in 2026 and the invoice was received before year-end. The expenditure is charged to the 2026 PO.", action: "PO action: finalise the PO after the expenditure has been recorded." };
    if (d === "current") return { tone: "warn", title: "2026 accrued expense", text: "The good/service was delivered in 2026 but the invoice was not received at year-end. The table indicates a provision for accrued expenses for 2026.", action: "PO action: follow the year-end provision process and finalise after the expenditure is recorded." };
    if (d === "next") return { tone: "info", title: "Not 2026 expenditure", text: "Delivery/performance is in 2027, so no expenditure is charged to 2026.", action: annual ? "Annual budget: finalise the 2026 PO and create the required 2027 PO for the year of delivery." : "Special account: the 2026 PO may remain open until delivery and the expenditure is recorded in 2027." };
    if (invoiced) return { tone: "warn", title: "Split between 2026 and 2027", text: "Charge the part delivered/performed in 2026 to 2026. The 2027 part is treated as prepaid expense (CCA) under the allocation table.", action: annual ? "Annual budget: finalise after the 2026 charge and create the required 2027 PO for the CCA part." : "Special account: the existing PO remains open until the 2027 CCA part is recorded." };
    return { tone: "warn", title: "2026 part accrued; 2027 part not accrued", text: "For a service spanning 2026–2027 with no invoice at year-end, the 2026 delivered/performed part is accrued. No provision is made for the 2027 CCA part.", action: annual ? "Annual budget: after the 2026 treatment, create the required 2027 PO for the remaining delivery." : "Special account: the PO remains open until the 2027 part is recorded." };
  }


  /* ---------- procurement case planner ----------
     Facts marked `src` come from the Procurement Guide; durations marked `assumed` are planning
     assumptions shown as such in the UI. Working days exclude weekends only. */
  const addWorkdays = (date, n) => { const d = new Date(date); let left = Math.abs(n); const step = n < 0 ? -1 : 1; while (left > 0) { d.setDate(d.getDate() + step); if (d.getDay() % 6) left--; } return d; };
  function procurementCase(input, today = new Date()) {
    const value = num(input.value), type = input.type || "general", xb = input.funding === "xb";
    const need = input.need || "oneoff", ground = input.ground || "none";
    const low = type === "intellectual" ? LIMITS.lowIntellectual : LIMITS.lowGoods;
    const intl = value >= LIMITS.international, lcr = xb && value >= LIMITS.legalReview && !intl;
    let route, key;
    if (value <= low) { key = "direct-low"; route = "Direct award"; }
    else if (ground !== "none") { key = "direct-exc"; route = "Direct award on exceptional grounds"; }
    else if (intl) { key = "international"; route = "International public call for tenders"; }
    else { key = "competitive"; route = "Competitive bidding procedure"; }
    const contract = need === "variable" ? "Framework agreement" : need === "recurring" ? "Framework contract" : "One-off contract";

    // Approval chain, in order.
    const approvals = [];
    if (key === "direct-low") approvals.push(["Buyer entity", "Awards directly on the basis of the supplier's expertise and value for money; keeps the justification on file.", "src"]);
    else {
      if (lcr) approvals.push(["DLAPIL · Legal Compliance Review", "Mandatory for extrabudgetary funding between €55,000 and €184,000, before the CCM. Processed within 5 working days of a complete request.", "src"]);
      if (key === "direct-exc") approvals.push(intl ? ["Tenders Board", "The CCM submits the direct-award request (specification, total cost, justification) to the Tenders Board.", "src"] : ["CCM", "Decides on the memorandum: specification, estimated total cost and the exceptional ground relied on.", "src"]);
      if (key === "competitive") approvals.push(["CCM", "Approves the tender documents in writing before launch, and later the award.", "src"]);
      if (key === "international") approvals.push(["CCM → Tenders Board", "The CCM sends the tender documents with an explanatory note; the Tenders Board authorises the launch (members have at least 48 hours) and later decides on the award.", "src"]);
    }

    // Timeline in working days: [label, days, basis]. Reverse-scheduled from the deadline when given.
    const steps = [["Define the need & market analysis", 10, "assumed"]];
    if (key !== "direct-low") steps.push([key === "direct-exc" ? "Memorandum & justification" : "Tender file & act of engagement", key === "international" ? 20 : 10, "assumed"]);
    if (lcr) steps.push(["Legal Compliance Review (DLAPIL)", 5, "src"]);
    if (key === "competitive" || key === "direct-exc") steps.push(["CCM approval", 5, "assumed"]);
    if (key === "international") steps.push(["Tenders Board launch approval", 10, "assumed"]);
    if (key === "competitive") steps.push(["Invitation & submission period", 10, "assumed"]);
    if (key === "international") steps.push(["Publication (minimum three weeks)", 15, "src"]);
    if (key === "competitive" || key === "international") steps.push(["Opening & evaluation", 10, "assumed"], [key === "international" ? "Tenders Board award decision" : "CCM award approval", key === "international" ? 10 : 5, "assumed"]);
    steps.push(["Contract review & signature", key === "direct-low" ? 3 : 10, "assumed"]);
    const total = steps.reduce((a, x) => a + x[1], 0);
    const deadline = input.deadline ? new Date(input.deadline) : null;
    let cursor = deadline ? addWorkdays(deadline, -total) : new Date(today);
    const start = new Date(cursor);
    const timeline = steps.map(([label, days, basis]) => { const from = new Date(cursor); cursor = addWorkdays(cursor, days); return { label, days, basis, from, to: new Date(cursor) }; });
    const late = deadline && start < today;

    const docs = {
      "direct-low": [["Need description", "What, quantity, period and estimated value."], ["Offer / quotation", "From the selected supplier."], ["Value-for-money note", "Why this supplier and price are appropriate."], ["Purchase order / contract", "Signed before the service starts."], ["Delivery acceptance & invoice", "Before payment."]],
      "direct-exc": [["Memorandum", "Specification, estimated total cost and the exceptional ground."], ...(lcr ? [["LCR request & DLAPIL visa", "Request form titled “Request for LCR”, with the memorandum."]] : []), [intl ? "Tenders Board decision" : "CCM decision", "Written approval of the direct award."], ["Negotiated offer", "From the supplier retained."], ["Signed contract", "Reviewed and signed by the authorised signatory."]],
      competitive: [["Tender file", "Rules, criteria and requirements."], ["Act of engagement", "Supplier details and financial offer."], ["Technical specifications", "Where separate from the tender file."], ["List of invited suppliers", "At least three potential suppliers."], ...(lcr ? [["LCR request & DLAPIL visa", "Before the CCM approval."]] : []), ["CCM approval of the documents", "Written, before launch."], ["Opening record & analysis table", "Admissibility, exclusion, eligibility and award scoring."], ["Award approval", "CCM decision on the proposed award."], ["Notification letters", "Unsuccessful tenderers informed within 15 days of notifying the winner."], ["Signed contract", "After contract review."]],
      international: [["Tender file & act of engagement", "With appendices."], ["Explanatory note / memo to the Tenders Board", "Template on the Tenders Board website."], ["Tenders Board launch authorisation", "Before publication."], ["Publication on the e-procurement platform", "Deadline of at least three weeks."], ["Opening record & analysis table", "Admissibility, exclusion, eligibility and award scoring."], ["Tenders Board award decision", "Validates the results and the award."], ["Notification letters", "Unsuccessful tenderers informed within 15 days of notifying the winner."], ["Signed contract", "After contract review."]],
    }[key];

    const risks = [];
    if (!intl && value >= 0.85 * LIMITS.international) risks.push(["risk", "Close to €184,000", "If the value may exceed the threshold (extensions, amendments, higher bids), the guide recommends an international public call. The Tenders Board cannot approve a launch retroactively."]);
    if (need !== "oneoff" && contract !== "Framework agreement" && value <= low) risks.push(["warn", "Recurring need at low value", "Assess the whole foreseeable need over the full period: splitting a recurring need to stay below a threshold is not allowed."]);
    if (need === "variable" && !intl) risks.push(["warn", "Framework agreement below €184,000", "Framework agreements need a mini-competition for each call-off and are rarely recommended below €184,000."]);
    if (key === "direct-exc") risks.push(["warn", "Exceptional direct award", "Only for unforeseen urgency not attributable to the buyer, technical requirements, or considerations of fact or law. Document the ground precisely."]);
    if (lcr) risks.push(["info", "Legal Compliance Review is mandatory", "Extrabudgetary funding between €55,000 and €184,000: no CCM approval before the DLAPIL visa."]);
    if (late) risks.push(["risk", "Behind schedule", `To meet the deadline the procedure should have started by ${start.toISOString().slice(0, 10)}. Consider a later deadline or a reduced scope.`]);
    const pub = timeline.find((t) => /Publication|Invitation/.test(t.label));
    if (pub && [6, 7].includes(pub.from.getMonth())) risks.push(["warn", "Publication during the summer break", "The guide advises against launching calls for tenders during the summer break."]);
    if (key !== "direct-low") risks.push(["info", "Offer validity", "Offers are valid for 180 calendar days from the submission deadline; plan evaluation and award within that period."]);

    // E-procurement platform (Ch. 6.1): mandatory for international calls from 1 Jan 2026, above €55,000 from 1 Apr 2026,
    // and for all tenders above the low-value limits from 1 Jan 2027. Judged on the planned launch date.
    const launch = (timeline.find((t) => /Publication|Invitation/.test(t.label)) || timeline[0]).from;
    const eDate = key === "international" ? "2026-01-01" : value >= LIMITS.legalReview ? "2026-04-01" : value > low ? "2027-01-01" : null;
    const eproc = key === "direct-low" || key === "direct-exc" || !eDate ? { mandatory: false, text: "Not a tender: the e-procurement platform is not required." }
      : launch >= new Date(eDate) ? { mandatory: true, text: `Mandatory: tenders of this type launched from ${eDate} go through the Council of Europe e-procurement platform.` }
      : { mandatory: false, text: `Becomes mandatory for this type of tender from ${eDate}; using it already is recommended.` };
    if (eproc.mandatory) risks.unshift(["info", "E-procurement platform mandatory", eproc.text]);
    const first = {
      "direct-low": ["Document the need and get an offer", "Describe what you need and its total value, obtain the offer from the supplier with the right expertise and note why it is good value."],
      "direct-exc": [lcr ? "Prepare the memorandum and request the Legal Compliance Review" : `Prepare the memorandum to the ${intl ? "Tenders Board (via the CCM)" : "CCM"}`, "State the specification, the estimated total cost and precisely which exceptional ground applies, with the evidence."],
      competitive: ["Draft the tender file and act of engagement", `Use the DLAPIL templates, fix the exclusion, eligibility and weighted award criteria, and list at least three potential suppliers${lcr ? "; then send everything to DLAPIL for the Legal Compliance Review" : ""}.`],
      international: ["Prepare the tender file and the memo to the Tenders Board", "Use the DLAPIL templates and the Tenders Board memo template; plan a submission period of at least three weeks on the e-procurement platform."],
    }[key];
    const nextAction = { title: first[0], text: first[1], by: timeline[0].to };
    // Relevance of each of the 15 guide stages for this route.
    const skipFor = { "direct-low": ["Tender Design", "Terms & Specifications", "Open & Evaluate", "Negotiate & Award"], "direct-exc": ["Tender Design", "Open & Evaluate"], competitive: [], international: [] }[key];
    const keyFor = { "direct-low": ["Thresholds & Procedure", "Contract Signing"], "direct-exc": ["Thresholds & Procedure", "Authorise & Launch", "Negotiate & Award"], competitive: ["Tender Design", "Authorise & Launch", "Open & Evaluate"], international: ["Tender Design", "Authorise & Launch", "Open & Evaluate", "Negotiate & Award"] }[key];
    return { key, route, contract, value, eproc, nextAction, approvals, timeline, total, start, deadline, late, docs, risks, skip: skipFor, keyStages: keyFor, lcr, intl };
  }

  /* ---------- grant case planner (Rule 1374) ---------- */
  function grantCase(input, today = new Date()) {
    const budget = num(input.budget), n = Math.max(1, Math.round(num(input.grantees) || 1)), eu = input.funding === "eu";
    const kind = input.kind || "project", exc = input.ground && input.ground !== "none", months = num(input.months);
    const A = eu ? "B" : "A", fund = eu ? "EU funds" : "Ordinary Budget / Voluntary Contributions";
    let key, route;
    if (budget < LIMITS.grant) { key = "direct"; route = "Direct award (below €15,000)"; }
    else if (exc) { key = "direct-exc"; route = "Exceptional direct award (Article 2.1.3)"; }
    else { key = "call"; route = "Call for proposals"; }
    const roles = key === "call"
      ? [["Commitments Officer", "Approves the call, appoints the Co-ordinator (G3.1) and the Evaluation Committee (G13.1), decides on the award (G14.6) and signs the agreement.", "src"], ["Co-ordinator", "Runs the procedure: publication, questions, opening (G11.1), draft eligibility report and the follow-up table (G3.1TAB).", "src"], ["Evaluation Committee", "Adopts the exclusion and eligibility report (G14.1), scores the proposals 0–5 (G14.3) and signs the consensus report (G14.4). At least one staff member; conflict-of-interest declarations (G13.4).", "src"], ["DLAPIL (recommended)", "Legal opinion on the draft call before publication — strongly recommended where financial guarantees are stipulated.", "src"]]
      : [["Commitments Officer", key === "direct" ? "Adopts the direct-award decision with Template G9.2A, which also appoints the Co-ordinator, then signs the agreement." : "Takes a duly justified decision with reference to Article 2.1.3 using Template G9.2B, attached to the request for commitment of funds.", "src"]];
    const steps = key === "call"
      ? [["Objectives & appoint Co-ordinator (G3.1)", 5, "assumed"], [`Draft call & application form (G8.1${A}, G8.2${A})`, 10, "assumed"], ["DLAPIL legal opinion & approval", 5, "assumed"], ["Publication & questions", 20, "assumed"], ["Opening & eligibility report (G11.1, G14.1)", 5, "assumed"], ["Scoring & consensus report (G14.3, G14.4)", 10, "assumed"], ["Commitments Officer decision (G14.6)", 5, "assumed"], ["Inform applicants (G14.8, G14.9)", 10, "src"], [`Sign grant agreement (G17.2${A})`, 5, "assumed"]]
      : [[key === "direct" ? "Decision on direct award (G9.2A)" : "Justified decision (G9.2B)", 5, "assumed"], [`Prepare & sign grant agreement (G17.2${A})`, 5, "assumed"]];
    const total = steps.reduce((a, x) => a + x[1], 0), deadline = input.deadline ? new Date(input.deadline) : null;
    let cursor = deadline ? addWorkdays(deadline, -total) : new Date(today); const start = new Date(cursor);
    const timeline = steps.map(([label, days, basis]) => { const from = new Date(cursor); cursor = addWorkdays(cursor, days); return { label, days, basis, from, to: new Date(cursor) }; });
    const late = deadline && start < today;
    const docs = key === "call"
      ? [["G3.1", "Decision appointing the Co-ordinator"], [`G8.1${A}`, `Call for proposals (${fund})`], [`G8.2${A}`, "Application form"], ["G8.3", "Call quality control checklist"], ["G13.1", "Decision appointing the Evaluation Committee"], ["G13.4", "Declarations of absence of conflict of interests"], ["G11.1", "Report on opening of proposals"], ["G14.1", "Exclusion and eligibility report"], ["G14.3 / G14.4", "Individual assessments and consensus report"], ["G14.6", "Commitments Officer award decision"], ["G14.8 / G14.9", "Letters to successful and unsuccessful applicants"], [`G17.2${A} + G17.2D`, "Grant agreement with the estimated budget annex"]]
      : [[key === "direct" ? "G9.2A" : "G9.2B", key === "direct" ? "Decision on direct award below €15,000" : "Justified decision on direct award from €15,000"], [`G17.2${A}`, "Grant agreement"], ["G17.2D", "Annex II, estimated budget"], ["G3.1TAB", "Co-ordinator follow-up table"]];
    const risks = [];
    if (key === "direct" && budget >= 0.8 * LIMITS.grant) risks.push(["warn", "Close to €15,000", "The threshold is the total budget of the procedure, not each grant. If several grants or a larger amount are foreseeable, a call for proposals is required."]);
    if (n > 1 && budget / n < LIMITS.grant && budget >= LIMITS.grant) risks.push(["info", "Count the whole procedure", `${n} grants of about ${euro(budget / n)} each make ${euro(budget)} in total: a call for proposals applies.`]);
    if (key === "direct-exc") risks.push(["risk", "Exceptions are strict", "Only an unforeseeable emergency, grantee characteristics making a call impossible, or an action leaving no scope for a call. Reference Article 2.1.3 precisely."]);
    if (kind === "operational" && months > 12) risks.push(["warn", "Operational grant longer than 12 months", "Operational grants should not normally give rise to agreements of more than twelve consecutive months."]);
    risks.push(["info", "Co-financing", "The Council must not finance the entire cost: the grantee contributes own or third-party resources (human resources, in kind or income generated)."]);
    risks.push(["info", "No retroactivity", "Costs cannot be incurred before the closing date for proposals; implementation should start after signature."]);
    risks.push(["info", "Indirect costs", "Indirect eligible costs are capped at 7% where foreseen."]);
    if (eu) risks.push(["info", "EU-funded templates", "Use the B variants (G8.1B, G8.2B, G17.2B) and the EU exclusion declarations (G4.1.2B, D or E)."]);
    if (late) risks.push(["risk", "Behind schedule", `To sign by the date entered, the procedure should have started by ${start.toISOString().slice(0, 10)}.`]);
    const skip = key === "call" ? [] : ["Criteria", "Call", "Submission", "Eligibility Check", "Evaluation", "Complaints"];
    const keyStages = key === "call" ? ["Call", "Eligibility Check", "Evaluation"] : ["Procedure", "Agreement"];
    const first = key === "call" ? ["Define the objectives and appoint the Co-ordinator", `Objectives are the first stage of any procedure. Then draft the call with G8.1${A}: co-financing level, criteria with weights, number of grantees and total value.`]
      : key === "direct" ? ["Adopt the direct-award decision (G9.2A)", "The Commitments Officer signs G9.2A, which also appoints the Co-ordinator; then prepare the grant agreement with its budget annex."]
      : ["Write the justification under Article 2.1.3 (G9.2B)", "Explain which exceptional circumstance applies and why a call is impossible; attach the decision to the request for commitment of funds."];
    return { key, route, budget, n, eu, roles, timeline, total, start, deadline, late, docs, risks, skip, keyStages, nextAction: { title: first[0], text: first[1], by: timeline[0].to } };
  }

  return { LIMITS, euro, grantCase, procurementCase, addWorkdays, procurement, budgetRevision, contractStrategy, grantProcedure, yearEnd, readiness, whatIf, pettyCash, grantCost, yearAllocation };
});
