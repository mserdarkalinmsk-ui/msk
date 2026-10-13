/* My files: follow one purchase end to end (procedure → approvals → contract & PO → payment → filing),
   and role views: the reader picks a role and every file, home and stage shows that role's actions first. */
(function () {
  "use strict";
  const { esc, euro, slug, ui, route } = FG;
  const E = window.FG_ENGINES;

  /* ---------- roles ---------- */
  const ROLES = {
    po: { name: "Project Officer", short: "PO", guide: "buyer", desc: "Defines the need, prepares the file and follows delivery." },
    accm: { name: "ACCM / FOMA", short: "ACCM", guide: "buyer", desc: "Checks budget and coding, creates the PO and records approvals." },
    ccm: { name: "CCM", short: "CCM", guide: "ccm", desc: "Approves procedures, commitments and payments." },
    fin: { name: "Finance / Treasury", short: "FIN", guide: "tpa", desc: "Creates suppliers, checks the payment file and pays." },
  };
  FG.ROLES = ROLES;
  FG.role = () => { const r = FG.store.get("role", ""); return ROLES[r] ? r : ""; };
  FG.rolePicker = (compact) => { const cur = FG.role();
    return `<div class="rp${compact ? " sm" : ""}" role="group" aria-label="Your role"><span>${compact ? "Role" : "I am"}</span>${Object.entries(ROLES).map(([k, r]) => `<button type="button" data-role="${k}" aria-pressed="${k === cur}" title="${esc(r.desc)}">${esc(compact ? r.short : r.name)}</button>`).join("")}</div>`; };
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-role]"); if (!b) return; FG.store.set("role", FG.role() === b.dataset.role ? "" : b.dataset.role); FG.refresh(true); });
  // Stage pages: what the selected role does at this stage (from the procurement roles content).
  FG.roleAtStage = (base, stageName) => {
    const k = FG.role(); if (!k || base !== "procurement") return "";
    const R = ROLES[k], g = (FG.C.procurementRoles || {})[R.guide];
    const here = g && (g.stages || []).includes(stageName);
    return `<div class="ras${here ? " on" : ""}"><b>${esc(R.name)} at this stage</b>${here ? `<ul>${(g.does || []).slice(0, 4).map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : `<p>No direct action for your role here: read for context, the next action is with others.</p>`}</div>`;
  };

  /* ---------- file model ---------- */
  const files = () => FG.store.get("files", []);
  const save = (list) => FG.store.set("files", list);
  const getFile = (id) => files().find((f) => f.id === id);
  // Five macro phases; each check names the role that owns it.
  function phases(f, r) {
    return [
      ["Procedure", "Prepare the file for the route", (r.docs || []).map(([t, d]) => [t, d, /CCM approval|Award approval|authorisation/i.test(t) ? "ccm" : "po"])],
      ["Approvals", "Obtain every approval in order", (r.approvals || []).map(([t, d]) => [t, d, /CCM/.test(t) ? "ccm" : "po"])],
      ["Contract & PO", "Commit the expenditure", [
        ["PMM project / activity ID confirmed", "No PO can be raised without it.", "accm"],
        ["Supplier exists in FIMS", "Created through the Multiservice Assistant before submission.", "fin"],
        ["CCM approval recorded", "Prior approval by the CCM, recorded by the ACCM.", "ccm"],
        ["PO created", "Only the ACCM creates POs.", "accm"],
        ["Contract signed after the PO", "Signed and dated after the PO and before delivery.", "ccm"]]],
      ["Delivery & payment", "Accept, check and pay", [
        ["Acceptance document signed", "Certificate of Acceptance of Work (consultants) or Payment Request Memorandum.", "po"],
        ["Invoice matches the contract", "Amounts, deliverables and particulars agree with the contract.", "accm"],
        ["Payment approved", "CCM approval recorded by the ACCM before the file goes to the Treasurer.", "ccm"],
        ["Paid to the contractual bank account", "Payment follows the agreed terms.", "fin"]]],
      ["Filing", "Keep the audit trail", [
        ["Signed contract filed", "PDF and editable versions in the project folder.", "accm"],
        ["Procedure evidence filed", "Offers, evaluation, approvals and correspondence.", "po"],
        ["Invoices and payment evidence filed", "Together with the acceptance document.", "accm"],
        ["Retention set", "Kept for 10 years after the end of the project.", "accm"]]],
    ];
  }
  function fileState(f) {
    const r = E.procurementCase(f), P = phases(f, r), t = f.ticks || {};
    let done = 0, total = 0; const mine = []; let next = null;
    P.forEach(([ph, , items], pi) => items.forEach(([it, d, who], ii) => { total++; const k = `${pi}:${ii}`; if (t[k]) done++; else { if (!next) next = [ph, it, who]; if (who === FG.role()) mine.push([ph, it, k]); } }));
    return { r, P, done, total, pct: total ? Math.round((done / total) * 100) : 0, mine, next };
  }

  /* ---------- pages ---------- */
  const FORM = (f) => `<form class="fl-form" data-fl-form>
    <label class="span2"><span>Name of the purchase</span><input name="what" required value="${esc(f.what || "")}" placeholder="e.g. Translation services 2027"></label>
    <label><span>Estimated value (excl. VAT, whole period)</span><input name="value" type="number" min="0" step="500" value="${esc(f.value || "")}" required></label>
    <label><span>Type</span><select name="type"><option value="general">Goods, services, works</option><option value="intellectual"${f.type === "intellectual" ? " selected" : ""}>Intellectual services</option></select></label>
    <label><span>Funding</span><select name="funding"><option value="ordinary">Ordinary Budget</option><option value="xb"${f.funding === "xb" ? " selected" : ""}>Extrabudgetary</option></select></label>
    <label><span>Need</span><select name="need"><option value="oneoff">One-off</option><option value="recurring"${f.need === "recurring" ? " selected" : ""}>Recurring, defined units</option><option value="variable"${f.need === "variable" ? " selected" : ""}>Variable / complex</option></select></label>
    <label><span>Exceptional direct-award ground</span><select name="ground"><option value="none">None</option><option value="urgency"${f.ground === "urgency" ? " selected" : ""}>Unforeseeable urgency</option><option value="technical"${f.ground === "technical" ? " selected" : ""}>Only one possible supplier</option></select></label>
    <label><span>Contract needed by</span><input name="deadline" type="date" value="${esc(f.deadline || "")}"></label>
    <div class="span2 row"><button class="btn primary" type="submit">${f.id ? "Save changes" : "Create the file"}</button>${f.id ? `<button class="btn ghost" type="button" data-fl-del="${f.id}">Delete this file</button>` : ""}</div></form>`;

  route("files", {
    crumbs: () => [["My files", "files"]],
    render() {
      const list = files(), role = FG.role();
      const allMine = list.flatMap((f) => fileState(f).mine.map((m) => [f, ...m]));
      return { html: `${ui.head("Follow a purchase end to end", "My files", "One file per purchase: route, approvals, deadlines, documents and every check up to filing.")}
        ${FG.rolePicker()}
        ${role ? `<section class="card fl-mine"><div class="card-head"><h3>My open actions · ${esc(ROLES[role].name)}</h3>${ui.tag(String(allMine.length), allMine.length ? "warn" : "good")}</div><div class="card-body">${allMine.length ? `<ul>${allMine.slice(0, 8).map(([f, ph, it]) => `<li><a href="#/files/${f.id}"><b>${esc(it)}</b><span>${esc(f.what)} · ${esc(ph)}</span></a></li>`).join("")}</ul>` : `<p class="muted">Nothing waiting for you.</p>`}</div></section>` : ""}
        <section class="fl-grid">${list.map((f) => { const s = fileState(f); return `<a class="fl-card" href="#/files/${f.id}"><small>${esc(s.r.route)}</small><b>${esc(f.what)}</b><span>${euro(s.r.value)} · ${esc(s.r.contract)}</span>
          <div class="fl-bar"><i style="width:${s.pct}%"></i></div><em>${s.pct}% · ${s.next ? `Next: ${esc(s.next[1])}` : "Complete"}</em></a>`; }).join("")}
          <details class="fl-new card"${list.length ? "" : " open"}><summary>+ New file</summary>${FORM({})}</details></section>` };
    },
  });

  route("files/:id", {
    crumbs: (p) => [["My files", "files"], [(getFile(p.id) || {}).what || "File", "files/" + p.id]],
    render(p) {
      const f = getFile(p.id);
      if (!f) return { html: `${ui.head("My files", "File not found", "This file does not exist on this device. Files are stored in this browser only.")}<p class="muted">Open your list of files to pick another one, or create a new file for your purchase.</p><a class="btn" href="#/files">← All files</a>` };
      const s = fileState(f), r = s.r, role = FG.role(), t = f.ticks || {};
      const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      return { html: `
        <section class="card fl-hero"><div class="card-body">
          <div class="fl-top"><div><span class="eyebrow">My file</span><h2>${esc(f.what)}</h2><p>${euro(r.value)} · ${esc(r.route)} · ${esc(r.contract)}${r.eproc.mandatory ? " · e-procurement" : ""}</p></div>
            <div class="fl-ring" style="--p:${s.pct}"><b>${s.pct}%</b><small>${s.done}/${s.total}</small></div></div>
          ${FG.rolePicker(true)}
          ${s.next ? `<div class="fl-next${s.next[2] === role ? " mine" : ""}"><small>Next action${s.next[2] === role ? " · yours" : ` · ${esc(ROLES[s.next[2]].name)}`}</small><b>${esc(s.next[1])}</b><span>${esc(s.next[0])}</span></div>` : `<div class="fl-next done"><b>Every check is done. The file is complete.</b></div>`}
        </div></section>
        <ol class="fl-phases">${s.P.map(([ph, sub, items], pi) => { const d = items.filter((_, ii) => t[`${pi}:${ii}`]).length;
          return `<li class="${d === items.length && items.length ? "ok" : d ? "go" : ""}"><em>${d === items.length && items.length ? "✓" : pi + 1}</em><b>${esc(ph)}</b><small>${d}/${items.length}</small></li>`; }).join("")}</ol>
        <div class="split mt"><div class="stack">
          ${s.P.map(([ph, sub, items], pi) => `<section class="card"><div class="card-head"><div><h3>${pi + 1}. ${esc(ph)}</h3><small>${esc(sub)}</small></div></div><div class="card-body fl-checks">
            ${items.map(([it, d, who], ii) => { const k = `${pi}:${ii}`; return `<label class="check ${t[k] ? "done" : ""}${who === role ? " mine" : ""}"><input type="checkbox" data-fl-tick="${k}" ${t[k] ? "checked" : ""}><div><b>${esc(it)}</b><small>${esc(d)}</small></div><span class="fl-who">${esc(ROLES[who].short)}</span></label>`; }).join("")}
          </div></section>`).join("")}
        </div>
        <aside class="stack sticky">
          ${r.deadline ? `<section class="card"><div class="card-head"><h3>Timeline</h3>${r.late ? ui.tag("Behind schedule", "risk") : ui.tag("On time", "good")}</div><div class="card-body"><ol class="fl-tl">${r.timeline.map((x) => `<li><b>${esc(x.label)}</b><span>${fmt(x.from)} → ${fmt(x.to)}</span></li>`).join("")}</ol></div></section>` : ""}
          ${r.risks.length ? `<section class="card"><div class="card-head"><h3>Watch out</h3></div><div class="card-body stack">${r.risks.slice(0, 5).map(([k, ti, x]) => `<div class="fl-risk ${k}"><b>${esc(ti)}</b><p>${esc(x)}</p></div>`).join("")}</div></section>` : ""}
          <section class="card"><div class="card-head"><h3>Guidance for this file</h3></div><div class="card-body fl-links">
            ${r.keyStages.map((n) => `<a href="#/procurement/${slug(n)}">${esc(n)} →</a>`).join("")}<a href="#/po-file">PO file builder →</a><a href="#/payment-file">Payment file →</a><a href="#/filing">Filing →</a></div></section>
          <details class="card fl-edit"><summary>Edit the file</summary>${FORM(f)}</details>
        </aside></div>` };
    },
  });

  /* ---------- events ---------- */
  document.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-fl-form]"); if (!form) return; e.preventDefault();
    const data = Object.fromEntries(new FormData(form)), list = files(), id = (location.hash.match(/#\/files\/(.+)$/) || [])[1];
    if (id && getFile(id)) { Object.assign(list.find((x) => x.id === id), data); save(list); FG.refresh(true); }
    else { const nf = { id: Date.now().toString(36), ticks: {}, created: new Date().toISOString().slice(0, 10), ...data }; list.push(nf); save(list); location.hash = "#/files/" + nf.id; }
  });
  document.addEventListener("change", (e) => {
    const c = e.target.closest("[data-fl-tick]"); if (!c) return;
    const id = (location.hash.match(/#\/files\/(.+)$/) || [])[1], list = files(), f = list.find((x) => x.id === id); if (!f) return;
    f.ticks = f.ticks || {}; if (c.checked) f.ticks[c.dataset.flTick] = 1; else delete f.ticks[c.dataset.flTick]; save(list); FG.refresh(true);
  });
  document.addEventListener("click", (e) => {
    const d = e.target.closest("[data-fl-del]"); if (!d || !confirm("Delete this file? This cannot be undone.")) return;
    save(files().filter((x) => x.id !== d.dataset.flDel)); location.hash = "#/files";
  });
  FG.myFilesSummary = () => { const list = files(), role = FG.role(), mine = role ? list.reduce((a, f) => a + fileState(f).mine.length, 0) : 0;
    return { count: list.length, mine }; };
})();
