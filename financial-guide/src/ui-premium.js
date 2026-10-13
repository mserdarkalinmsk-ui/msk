/* Premium building blocks shared by hubs: a line-icon set and the live route finder
   (value · type · funding → procedure, approvals and controls on a threshold ladder). */
(function () {
  "use strict";
  const E = window.FG_ENGINES, L = E.LIMITS;
  const P = {
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    pay: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
    grant: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    tree: '<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM20 17v5H6.5A2.5 2.5 0 0 1 4 19.5"/>',
    abc: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    files: '<path d="M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5M4 6v14a2 2 0 0 0 2 2h10"/>',
    ask: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V13M12 16h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    trend: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  };
  FG.icon = (k, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || P.doc}</svg>`;

  /* ---------- route finder ---------- */
  // Log-scaled ladder so €2k and €184k both get room; bands follow the procurement engine.
  const MAX = 400000, MIN = 500;
  const pos = (v) => Math.max(0, Math.min(100, (Math.log10(Math.max(v, MIN)) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN)) * 100));
  const val = (p) => Math.round(10 ** (Math.log10(MIN) + (p / 100) * (Math.log10(MAX) - Math.log10(MIN))) / 500) * 500;
  const PRESETS = [["Laptop", 1800, "general"], ["Short expert study", 5500, "intellectual"], ["Translation services", 48000, "intellectual"], ["Conference logistics", 120000, "general"], ["IT platform", 260000, "general"]];

  function state() { return Object.assign({ v: 48000, t: "general", f: "ordinary" }, FG.store.get("rf", {})); }
  function render(s) {
    const r = E.procurement({ amount: s.v, type: s.t, funding: s.f });
    const low = s.t === "intellectual" ? L.lowIntellectual : L.lowGoods;
    const bands = [[MIN, low, "Direct award", "c1"], [low, L.international, "Competitive bidding", "c2"], [L.international, MAX, "Int’l call", "c3"]];
    const marks = [[low, s.t === "intellectual" ? "€6k" : "€2k"], [L.legalReview, "€55k"], [L.international, "€184k"]];
    const xb = s.f !== "ordinary" && s.v >= L.legalReview && s.v < L.international;
    const steps = [["Procedure", r.route], ["Approval", r.kpis[2][1]], ["Digital route", r.kpis[3][1]], ["Key control", xb ? "DLAPIL legal review before CCM approval" : s.v >= L.international ? "Tenders Board authorises launch and award" : s.v > low ? "At least three suppliers invited" : "Proportionate, traceable file"]];
    return `<div class="rf-top"><div><span class="rf-k">Route finder</span><h2>What procedure does my purchase need?</h2><p>Move the value or pick an example. The route comes from the same engine as the procurement decision tool.</p></div>
        <div class="rf-amt"><small>Estimated total value excl. VAT</small><b>${E.euro(s.v)}</b></div></div>
      <div class="rf-presets">${PRESETS.map(([n, v, t]) => `<button type="button" data-rf-p="${v}|${t}" aria-pressed="${s.v === v && s.t === t}">${n}<small>${E.euro(v)}</small></button>`).join("")}</div>
      <div class="rf-ladder" style="--x:${pos(s.v)}%">
        <div class="rf-bands">${bands.map(([a, b, n, c]) => `<span class="${s.v > a && s.v <= b || (a === MIN && s.v <= b) ? "on" : ""}" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%;--c:var(--${c})">${n}</span>`).join("")}</div>
        <div class="rf-track"><i></i>${marks.map(([m, l]) => `<em style="left:${pos(m)}%"><b>${l}</b></em>`).join("")}<span class="rf-pin"><b>${E.euro(s.v)}</b></span></div>
        <input type="range" min="0" max="100" step="0.2" value="${pos(s.v).toFixed(1)}" data-rf-range aria-label="Estimated value">
      </div>
      <div class="rf-opts"><div class="rc-seg" role="group" aria-label="Purchase type">${[["general", "Goods & services"], ["intellectual", "Intellectual services"]].map(([k, l]) => `<button type="button" data-rf-t="${k}" aria-pressed="${s.t === k}">${l}</button>`).join("")}</div>
        <div class="rc-seg" role="group" aria-label="Funding">${[["ordinary", "Ordinary budget"], ["xb", "Extrabudgetary"], ["mixed", "Mixed"]].map(([k, l]) => `<button type="button" data-rf-f="${k}" aria-pressed="${s.f === k}">${l}</button>`).join("")}</div></div>
      <ol class="rf-out">${steps.map(([k, v], i) => `<li class="${i === 3 && (xb || s.v >= L.international) ? "warn" : ""}"><small>${k}</small><b>${FG.esc(v)}</b></li>`).join("")}</ol>
      <div class="rf-cta"><a class="btn primary" href="#/engines/procurement">Full decision with documents →</a><a class="btn" href="#/procurement/thresholds-and-procedure">Read the threshold rules</a></div>`;
  }
  FG.routeFinder = () => `<section class="rf" data-rf>${render(state())}</section>`;
  const update = (patch) => { const s = Object.assign(state(), patch); FG.store.set("rf", s); document.querySelectorAll("[data-rf]").forEach((el) => { el.innerHTML = render(s); }); };
  // While dragging only the pin and amount move; the route re-renders when the thumb is released.
  document.addEventListener("input", (e) => { if (!e.target.matches("[data-rf-range]")) return;
    const v = Math.max(MIN, val(+e.target.value)), box = e.target.closest("[data-rf]");
    box.querySelector(".rf-ladder").style.setProperty("--x", pos(v) + "%"); box.querySelector(".rf-pin b").textContent = E.euro(v); box.querySelector(".rf-amt b").textContent = E.euro(v); });
  document.addEventListener("change", (e) => { if (e.target.matches("[data-rf-range]")) { update({ v: Math.max(MIN, val(+e.target.value)) }); const n = document.querySelector("[data-rf-range]"); if (n) n.focus(); } });
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-rf-p]"); if (p) { const [v, t] = p.dataset.rfP.split("|"); return update({ v: +v, t }); }
    const t = e.target.closest("[data-rf-t]"); if (t) return update({ t: t.dataset.rfT });
    const f = e.target.closest("[data-rf-f]"); if (f) return update({ f: f.dataset.rfF });
  });
})();
