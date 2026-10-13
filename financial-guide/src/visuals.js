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
    document.querySelectorAll("[data-chain]:not([data-ok])").forEach((b) => { b.dataset.ok = 1; drawChain(b, false); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
