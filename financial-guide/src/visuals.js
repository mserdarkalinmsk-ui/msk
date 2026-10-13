/* Dynamic visuals: procedure clock (dates from your deadline) and approval chain (who signs at your value). */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const DAY = 864e5;
  const iso = (d) => d.toISOString().slice(0, 10);
  const add = (d, n) => new Date(d.getTime() + n * DAY);
  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const today = () => { const t = new Date(); return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())); };
  const parse = (v, fb) => { const d = v ? new Date(v + "T00:00:00Z") : null; return d && !isNaN(d) ? d : fb; };
  FG.vis = {};

  /* ---------- procedure clock ---------- */
  function procEvents(D, S, intl) {
    const N = add(S, 15);
    return [
      intl && [add(D, -21), "Publish the call (latest)", "At least 3 weeks before the deadline (international call).", "prep"],
      [add(D, -2), "Last answer to questions", "No answers later than 48 hours before the deadline.", "prep"],
      [D, "Submission deadline", "Offers received after it are not admissible.", "key"],
      [S, "Contract signed", "Sign before notifying the unsuccessful bidders.", "key"],
      [N, "Unsuccessful bidders notified", "In writing, at the latest 15 days after the successful bidder is notified.", "after"],
      [add(N, 7), "Enquiry window closes", "Bidders may enquire within 7 days of notification.", "after"],
      [add(N, 37), "Complaint window (indicative)", "A complaint to the Tenders Board is due within 30 days of the reply to the enquiry; shown here from the end of the enquiry window.", "soft"],
      [add(D, 180), "Offers expire", "Offers stay valid for 180 calendar days from the deadline.", "limit"],
    ].filter(Boolean);
  }
  function grantEvents(D, S) {
    const N = add(S, 15);
    return [
      [D, "Submission deadline", "Proposals received after it are rejected.", "key"],
      [S, "Successful applicants notified", "Agreements follow the award decision.", "key"],
      [N, "Unsuccessful applicants informed", "At the latest 15 calendar days after the successful ones.", "after"],
      [add(N, 7), "Enquiry period ends (minimum)", "The letter states an enquiry period of at least 7 calendar days.", "after"],
      [add(N, 37), "Complaint deadline (indicative)", "30 calendar days from notification of the reply to the enquiry; shown from the end of the enquiry period.", "soft"],
      [add(N, 67), "Review Board meets (latest)", "Within 30 calendar days of receiving the complaint.", "soft"],
    ];
  }
  FG.vis.clock = function (base) {
    const isP = base !== "grants", st = FG.store.get("clock:" + base, {});
    const D = parse(st.d, add(today(), 30)), S = parse(st.s, add(D, 30));
    return `<section class="vc card" data-clock="${base}"><div class="vc-head"><div><span class="eyebrow">Procedure clock</span><b>Every deadline, calculated from your dates</b></div>
      <div class="vc-in"><label><span>Submission deadline</span><input type="date" data-ck="d" value="${iso(D)}"></label>
        <label><span>${isP ? "Contract signature" : "Award notification"}</span><input type="date" data-ck="s" value="${iso(S)}"></label>
        ${isP ? `<label class="rc-chk"><input type="checkbox" data-ck="i" ${st.i === false ? "" : "checked"}> International call</label>` : ""}</div></div>
      <div class="vc-body" data-ck-out></div>
      <p class="vc-note">Calendar days. Indicative dates depend on when the enquiry is answered; always check the letter you sent.</p></section>`;
  };
  function drawClock(box) {
    const base = box.dataset.clock, isP = base !== "grants", g = (k) => box.querySelector(`[data-ck="${k}"]`);
    const D = parse(g("d").value, today()), S = parse(g("s").value, add(D, 30)), intl = isP ? g("i").checked : false;
    FG.store.set("clock:" + base, { d: iso(D), s: iso(S), i: intl });
    const ev = (isP ? procEvents(D, S, intl) : grantEvents(D, S)).sort((a, b) => a[0] - b[0]);
    const t0 = ev[0][0].getTime(), t1 = ev[ev.length - 1][0].getTime(), span = Math.max(t1 - t0, DAY), now = today().getTime();
    const pos = (d) => ((d.getTime() - t0) / span) * 100;
    const warn = isP && S > add(D, 180) ? `<div class="vc-warn">Signature falls after the offers expire (${fmt(add(D, 180))}). Ask bidders to extend validity or sign earlier.</div>` : S < D ? `<div class="vc-warn">${isP ? "Signature" : "Notification"} is before the submission deadline. Check the dates.</div>` : "";
    box.querySelector("[data-ck-out]").innerHTML = `${warn}
      <div class="vc-track"><i class="vc-line"></i>${now >= t0 && now <= t1 ? `<i class="vc-today" style="left:${pos(today())}%"><span>Today</span></i>` : ""}
        ${ev.map(([d, t], k) => `<button type="button" class="vc-dot ${ev[k][3]}" style="left:${pos(d)}%" data-ck-k="${k}" title="${esc(t)}: ${fmt(d)}"></button>`).join("")}</div>
      <ol class="vc-list">${ev.map(([d, t, x, kind], k) => { const days = Math.round((d.getTime() - now) / DAY);
        return `<li class="${kind}" data-ck-row="${k}"><time><b>${fmt(d)}</b><small>${days === 0 ? "today" : days > 0 ? `in ${days} days` : `${-days} days ago`}</small></time><div><b>${esc(t)}</b><p>${esc(x)}</p></div></li>`; }).join("")}</ol>`;
  }

  /* ---------- approval chain ---------- */
  FG.vis.approvals = function () {
    const st = FG.store.get("chain", { v: 90000, x: true, e: false });
    return `<section class="va card" data-chain><div class="vc-head"><div><span class="eyebrow">Approval chain</span><b>Who has to approve at your value?</b></div>
      <div class="vc-in"><label><span>Estimated value (excl. VAT)</span><div class="rc-val"><b>€</b><input type="number" min="0" step="1000" data-ch="v" value="${st.v}"></div></label>
        <label class="rc-chk"><input type="checkbox" data-ch="x" ${st.x ? "checked" : ""}> Extrabudgetary</label>
        <label class="rc-chk"><input type="checkbox" data-ch="e" ${st.e ? "checked" : ""}> Exceptional direct award</label></div></div>
      <input type="range" class="va-range" min="0" max="100" step="0.5" data-ch="r" aria-label="Value scale">
      <div class="va-scale"><span>€0</span><span>€2k</span><span>€10k</span><span>€55k</span><span>€184k</span><span>€1m</span></div>
      <div data-ch-out></div></section>`;
  };
  // Piecewise scale so the thresholds sit at readable positions.
  const STOPS = [[0, 0], [2000, 18], [10000, 36], [55000, 56], [184000, 78], [1000000, 100]];
  const toPct = (v) => { for (let i = 1; i < STOPS.length; i++) { const [a, pa] = STOPS[i - 1], [b, pb] = STOPS[i]; if (v <= b) return pa + ((v - a) / (b - a)) * (pb - pa); } return 100; };
  const toVal = (p) => { for (let i = 1; i < STOPS.length; i++) { const [a, pa] = STOPS[i - 1], [b, pb] = STOPS[i]; if (p <= pb) return Math.round((a + ((p - pa) / (pb - pa)) * (b - a)) / 500) * 500; } return 1000000; };
  function drawChain(box, fromRange) {
    const g = (k) => box.querySelector(`[data-ch="${k}"]`);
    if (fromRange) g("v").value = toVal(+g("r").value); else g("r").value = toPct(+g("v").value || 0);
    const v = +g("v").value || 0, x = g("x").checked, e = g("e").checked;
    FG.store.set("chain", { v, x, e });
    const intl = v >= 184000, lcr = x && v >= 55000 && v < 184000, eproc = v > 55000;
    const route = e ? (intl ? "Exceptional direct award, Tenders Board" : "Exceptional direct award") : v <= 2000 ? "Direct award possible (€6,000 for intellectual services)" : intl ? "International public call for tenders" : "Competitive bidding";
    const steps = [
      ["Buyer entity", "Prepares the need, the tender file and the evaluation.", true],
      ["DLAPIL", "Legal Compliance Review, about 5 working days for a complete request.", lcr],
      ["CCM", e && !intl ? "Authorises the exceptional direct award on a justified memorandum." : "Authorises the launch and approves the award.", !intl],
      ["Tenders Board", "Competent from €184,000: approves the launch and the award.", intl],
    ];
    box.querySelector("[data-ch-out]").innerHTML = `<p class="va-route"><b>€${v.toLocaleString("en-GB")}</b> → ${esc(route)}${eproc ? ' <span class="va-tag">E-procurement</span>' : ""}</p>
      <ol class="va-chain">${steps.map(([n, d, on], k) => `<li class="${on ? "on" : "off"}" style="--c:var(--c${k + 1})"><em>${on ? k + 1 : "–"}</em><b>${n}</b><p>${on ? esc(d) : "Not required at this value"}</p></li>`).join("")}</ol>`;
  }


  /* ---------- procedure decision tree ---------- */
  const TREE = {
    own: { q: "Is the Council buying for its own needs?", hint: "Works, goods or services the Organisation itself uses.", a: [["Yes, a purchase", "exc"], ["No, we fund a partner's own action", "=grant"]] },
    exc: { q: "Is there a ground for an exceptional direct award?", hint: "For example unforeseeable urgency not caused by the buyer entity, or only one possible supplier.", a: [["No, normal case", "type"], ["Yes, and it is documented", "=exc"]] },
    type: { q: "What are you buying?", hint: "The direct-award ceiling depends on the type.", a: [["Goods, general services or works", "val:g"], ["Intellectual services", "val:i"]] },
  };
  const RES = {
    grant: ["Grant, not procurement", "Use the grant procedure under Rule No. 1374 instead of a tender.", "#/grants", "Open the grants guide", "c4"],
    exc: ["Exceptional direct award", "Justify it in writing. CCM authorises; a Legal Compliance Review applies from €55,000 when extrabudgetary, and the Tenders Board decides from €184,000.", "#/procurement/thresholds-and-procedure", "Read the exceptions", "c3"],
    da: ["Direct award", "One supplier, on a justified memorandum validated by the CCM.", "#/procurement/my-case", "Plan this case", "c2"],
    cbp: ["Competitive bidding (public prices)", "Below €10,000 you may compare the public prices of three or more suppliers and archive screenshots.", "#/procurement/my-case", "Plan this case", "c1"],
    cb: ["Competitive bidding", "Invite at least three suppliers. Extrabudgetary from €55,000: Legal Compliance Review by DLAPIL. E-procurement above €55,000.", "#/procurement/my-case", "Plan this case", "c1"],
    ic: ["International public call for tenders", "Tenders Board competence, publication of at least three weeks, e-procurement.", "#/procurement/my-case", "Plan this case", "c3"],
  };
  FG.vis.tree = () => `<section class="vt card" data-ptree><div class="vc-head"><div><span class="eyebrow">Decision tree</span><b>Find your procedure in four questions</b></div><button type="button" class="btn sm" data-tr-reset>Start again</button></div><div data-tr-out></div></section>`;
  function drawTree(box) {
    const path = JSON.parse(box.dataset.path || "[]"), out = box.querySelector("[data-tr-out]");
    let node = "own", result = null, kind = "g";
    const crumbs = path.map(([n, label]) => `<li><small>${esc(TREE[n] ? TREE[n].q : "Estimated value")}</small><b>${esc(label)}</b></li>`).join("");
    path.forEach(([n, , go]) => { if (go.startsWith("=")) result = go.slice(1); else if (go.startsWith("val:")) { kind = go.slice(4); node = "val"; } else node = go; });
    if (path.length && path[path.length - 1][0] === "val") { node = null; result = path[path.length - 1][2]; }
    let cur = "";
    if (!result && node === "val") {
      const low = kind === "i" ? 6000 : 2000, opts = [[`Up to €${low.toLocaleString("en-GB")}`, "da"], ...(low < 10000 ? [[`€${(low + 1).toLocaleString("en-GB")} – €9,999`, "cbp"]] : []), ["€10,000 – €183,999", "cb"], ["€184,000 or more", "ic"]];
      cur = `<div class="vt-q"><b>What is the total estimated value, excluding VAT?</b><p>Over the whole period, including possible extensions.</p><div class="vt-opts">${opts.map(([l, r]) => `<button type="button" data-tr="val|${esc(l)}|${r}">${esc(l)}</button>`).join("")}</div></div>`;
    } else if (!result) {
      const t = TREE[node];
      cur = `<div class="vt-q"><b>${esc(t.q)}</b><p>${esc(t.hint)}</p><div class="vt-opts">${t.a.map(([l, g]) => `<button type="button" data-tr="${node}|${esc(l)}|${g}">${esc(l)}</button>`).join("")}</div></div>`;
    }
    const r = result && RES[result];
    out.innerHTML = `<ol class="vt-path">${crumbs}</ol>${cur}${r ? `<div class="vt-res" style="--c:var(--${r[4]})"><small>Your procedure</small><h4>${esc(r[0])}</h4><p>${esc(r[1])}</p><a class="btn sm primary" href="${r[2]}">${esc(r[3])} →</a></div>` : ""}`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tr]"), rs = e.target.closest("[data-tr-reset]"); if (!b && !rs) return;
    const box = (b || rs).closest("[data-ptree]");
    if (rs) box.dataset.path = "[]"; else { const [n, l, g] = b.dataset.tr.split("|"); const p = JSON.parse(box.dataset.path || "[]"); p.push([n, l, g]); box.dataset.path = JSON.stringify(p); }
    drawTree(box);
  });

  /* ---------- grant budget builder ---------- */
  const BL = [["staff", "Staff", "--c1"], ["travel", "Travel", "--c2"], ["equip", "Equipment", "--c3"], ["other", "Other direct", "--c4"]];
  FG.vis.budget = function () {
    const st = FG.store.get("gbudget", { staff: 20000, travel: 6000, equip: 4000, other: 5000, ind: 7, co: 20 });
    return `<section class="vb card" data-budget><div class="vc-head"><div><span class="eyebrow">Budget builder</span><b>Build an eligible grant budget</b></div></div>
      <div class="vb-in">${BL.map(([k, l]) => `<label><span>${l}</span><div class="rc-val"><b>€</b><input type="number" min="0" step="500" data-b="${k}" value="${st[k]}"></div></label>`).join("")}
        <label class="vb-sl"><span>Indirect costs <b data-b-o="ind"></b></span><input type="range" min="0" max="12" step="0.5" data-b="ind" value="${st.ind}"></label>
        <label class="vb-sl"><span>Grantee co-financing <b data-b-o="co"></b></span><input type="range" min="0" max="60" step="1" data-b="co" value="${st.co}"></label></div>
      <div data-b-out></div></section>`;
  };
  function drawBudget(box) {
    const st = {}; box.querySelectorAll("[data-b]").forEach((i) => { st[i.dataset.b] = Math.max(0, +i.value || 0); });
    FG.store.set("gbudget", st);
    box.querySelector('[data-b-o="ind"]').textContent = st.ind + "% of total"; box.querySelector('[data-b-o="co"]').textContent = st.co + "%";
    const direct = BL.reduce((a, [k]) => a + st[k], 0), total = st.ind >= 100 ? direct : direct / (1 - st.ind / 100), ind = total - direct;
    const grantee = total * st.co / 100, council = total - grantee, f = (n) => "€" + Math.round(n).toLocaleString("en-GB"), pc = (n) => total ? (n / total) * 100 : 0;
    const issues = [st.ind > 7 && ["risk", `Indirect costs are ${st.ind}% of the total. They may never exceed 7%, and the exact rate must be stated in the call and the agreement.`],
      st.co === 0 && ["warn", "No co-financing. The grantee should finance part of the action; in financial difficulty it may take the form of staff, in-kind contributions or project income."],
      ["info", council >= 15000 ? `A Council grant of ${f(council)}: if the total budget of the procedure is €15,000 or more, a call for proposals is required.` : `A Council grant of ${f(council)}: below €15,000 for the whole procedure, a direct award (G9.2A) is possible.`]].filter(Boolean);
    box.querySelector("[data-b-out]").innerHTML = `
      <div class="vb-bar" aria-label="Cost structure">${BL.map(([k, l, c]) => st[k] ? `<i style="width:${pc(st[k])}%;background:var(${c})" title="${l}: ${f(st[k])}"><span>${l}</span></i>` : "").join("")}${ind ? `<i class="ind${st.ind > 7 ? " over" : ""}" style="width:${pc(ind)}%" title="Indirect: ${f(ind)}"><span>Indirect</span></i>` : ""}<u style="left:${100 - 7}%" title="7% ceiling"></u></div>
      <div class="vb-legend"><span>Direct ${f(direct)}</span><span>Indirect ${f(ind)}</span><b>Total ${f(total)}</b></div>
      <div class="vb-split"><div style="width:${100 - st.co}%"><small>Council grant</small><b>${f(council)}</b></div><div style="width:${st.co}%"><small>Grantee</small><b>${f(grantee)}</b></div></div>
      <ul class="vb-issues">${issues.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("")}</ul>`;
  }

  /* ---------- weighted award scoring ---------- */
  const SC0 = { w: [40, 30, 30], names: ["Quality of proposal", "Expertise"], b: [["Bidder A", [8, 7], 52000], ["Bidder B", [6, 9], 47000], ["Bidder C", [9, 8], 61000]] };
  FG.vis.scoring = function () {
    const st = FG.store.get("scoring", SC0);
    return `<section class="vs card" data-score><div class="vc-head"><div><span class="eyebrow">Award scoring</span><b>Weighted scores and final ranking</b></div><button type="button" class="btn sm" data-sc-reset>Reset example</button></div>
      <div class="vs-w">${st.names.map((n, k) => `<label><span>${esc(n)} <i>weight</i></span><input type="number" min="0" max="100" data-sw="${k}" value="${st.w[k]}"></label>`).join("")}<label><span>Financial offer <i>weight</i></span><input type="number" min="0" max="100" data-sw="2" value="${st.w[2]}"></label><div class="vs-sum" data-sc-sum></div></div>
      <div class="table-wrap"><table class="t vs-t"><thead><tr><th>Bidder</th>${st.names.map((n) => `<th class="c">${esc(n)}<small>score /10</small></th>`).join("")}<th class="c">Price (€)</th></tr></thead><tbody>
        ${st.b.map(([n, sc, pr], i) => `<tr><td><b>${esc(n)}</b></td>${sc.map((v, k) => `<td class="c"><input type="number" min="0" max="10" step="0.5" data-sb="${i}:${k}" value="${v}"></td>`).join("")}<td class="c"><input type="number" min="1" step="100" data-sp="${i}" value="${pr}"></td></tr>`).join("")}
      </tbody></table></div><div data-sc-out></div>
      <p class="vc-note">Each quality criterion is scored out of 10 with a written justification. Financial points here are proportional to the cheapest offer (cheapest ÷ price × weight); use the method stated in your tender file.</p></section>`;
  };
  function drawScore(box) {
    const st = FG.store.get("scoring", SC0);
    box.querySelectorAll("[data-sw]").forEach((i) => { st.w[+i.dataset.sw] = Math.max(0, +i.value || 0); });
    box.querySelectorAll("[data-sb]").forEach((i) => { const [b, k] = i.dataset.sb.split(":").map(Number); st.b[b][1][k] = Math.min(10, Math.max(0, +i.value || 0)); });
    box.querySelectorAll("[data-sp]").forEach((i) => { st.b[+i.dataset.sp][2] = Math.max(1, +i.value || 1); });
    FG.store.set("scoring", st);
    const sum = st.w.reduce((a, b) => a + b, 0), fw = st.w[2], low = Math.min(...st.b.map((b) => b[2]));
    box.querySelector("[data-sc-sum]").innerHTML = `<b class="${sum === 100 ? "ok" : "bad"}">${sum}</b><small>/ 100 points</small>`;
    const rows = st.b.map(([n, sc, pr]) => { const q = sc.map((v, k) => (v / 10) * st.w[k]), f = (low / pr) * fw; return { n, q, f, t: q.reduce((a, b) => a + b, 0) + f, pr }; }).sort((a, b) => b.t - a.t);
    const max = Math.max(sum, 1), cols = ["--c1", "--c2"];
    const warn = [sum !== 100 && `Weights add up to ${sum}, not 100.`, fw < 20 && "The financial offer weight should not in principle be lower than 20 points (unless a minimum score or exclusion level is set)."].filter(Boolean);
    box.querySelector("[data-sc-out]").innerHTML = `${warn.map((w) => `<div class="vc-warn">${esc(w)}</div>`).join("")}
      <ol class="vs-rank">${rows.map((r, i) => `<li class="${i ? "" : "win"}"><span class="vs-pos">${i + 1}</span><b>${esc(r.n)}</b>
        <div class="vs-bar">${r.q.map((v, k) => `<i style="width:${(v / max) * 100}%;background:var(${cols[k]})" title="${esc(st.names[k])}: ${v.toFixed(1)}"></i>`).join("")}<i style="width:${(r.f / max) * 100}%;background:var(--c3)" title="Financial: ${r.f.toFixed(1)}"></i></div>
        <em>${r.t.toFixed(1)}</em></li>`).join("")}</ol>
      <div class="vs-legend">${st.names.map((n, k) => `<span><i style="background:var(${cols[k]})"></i>${esc(n)}</span>`).join("")}<span><i style="background:var(--c3)"></i>Financial offer</span></div>
      <p class="va-route"><b>${esc(rows[0].n)}</b> ranks first with ${rows[0].t.toFixed(1)} points${rows[0].pr !== low ? ", although it is not the cheapest offer" : ""}.</p>`;
  }
  document.addEventListener("input", (e) => { const b = e.target.closest("[data-score]"); if (b) drawScore(b); });
  document.addEventListener("click", (e) => { const r = e.target.closest("[data-sc-reset]"); if (!r) return; FG.store.set("scoring", JSON.parse(JSON.stringify(SC0))); const box = r.closest("[data-score]"), tmp = document.createElement("div"); tmp.innerHTML = FG.vis.scoring(); box.replaceWith(tmp.firstElementChild); });
  document.addEventListener("input", (e) => { const b = e.target.closest("[data-budget]"); if (b) drawBudget(b); });
  document.addEventListener("input", (e) => {
    const c = e.target.closest("[data-clock]"); if (c) drawClock(c);
    const a = e.target.closest("[data-chain]"); if (a) drawChain(a, e.target.dataset.ch === "r");
  });
  document.addEventListener("change", (e) => { const c = e.target.closest("[data-clock]"); if (c && e.target.type === "checkbox") drawClock(c); });
  document.addEventListener("click", (e) => {
    const d = e.target.closest("[data-ck-k]"); if (!d) return;
    const row = d.closest("[data-clock]").querySelector(`[data-ck-row="${d.dataset.ckK}"]`);
    row.scrollIntoView({ block: "nearest", behavior: "smooth" }); row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
  });
  new MutationObserver(() => {
    document.querySelectorAll("[data-clock]:not([data-ok])").forEach((b) => { b.dataset.ok = 1; drawClock(b); });
    document.querySelectorAll("[data-score]:not([data-ok])").forEach((b) => { b.dataset.ok = 1; drawScore(b); });
    document.querySelectorAll("[data-budget]:not([data-ok])").forEach((b) => { b.dataset.ok = 1; drawBudget(b); });
    document.querySelectorAll("[data-ptree]:not([data-ok])").forEach((b) => { b.dataset.ok = 1; drawTree(b); });
    document.querySelectorAll("[data-chain]:not([data-ok])").forEach((b) => { b.dataset.ok = 1; drawChain(b, false); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
