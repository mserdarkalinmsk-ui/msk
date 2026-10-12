/* Scenario practice. */
(function () {
  "use strict";
  const { C, esc, euro, pct, ui, route, fmtDate } = FG;

  /* ---------- scenario practice ---------- */
  const CAT = { procurement: ["Procurement", "procurement/thresholds-and-procedure"], forecast: ["Forecast", "foma/forecast"], grant: ["Grant", "grants/procedure"], yearend: ["Year-end", "year-end"], payment: ["PO & payment", "payment-file"], reporting: ["Reporting", "foma/reports"], mission: ["Mission", "foma/mission-order"], filing: ["Filing", "filing"] };
  // Stable option order per scenario so the right answer is not always in the same place.
  const order = (n, i) => { const idx = [...Array(n).keys()]; let seed = i * 7919 + 17; for (let k = n - 1; k > 0; k--) { seed = (seed * 1103515245 + 12345) % 2147483648; const j = seed % (k + 1); [idx[k], idx[j]] = [idx[j], idx[k]]; } return idx; };
  route("scenarios", {
    crumbs: () => [["Scenario practice", "scenarios"]],
    render() {
      const qs = new URLSearchParams(location.hash.split("?")[1] || "");
      if (qs.get("cat")) FG.store.set("sc:cat", qs.get("cat"));
      const level = FG.store.get("sc:level", "basic"), cat = FG.store.get("sc:cat", "all"), answers = FG.store.get("scenarioAnswers", {});
      const list = C.scenarios.map((x, i) => ({ ...x, i })).filter((x) => (level === "all" || x.level === level) && (cat === "all" || x.cat === cat));
      const done = list.filter((x) => answers[x.i]), ok = done.filter((x) => answers[x.i].ok).length;
      return { html: `${ui.head("Practice · decide · learn", "Scenario practice", "Realistic decisions across procurement, finance, grants, reporting, year-end, missions and filing. Answers are kept in this browser.", `<button class="btn" data-reset-sc>Reset answers</button>`)}
        <div class="row">${ui.seg("level", [["basic", "Basic"], ["advanced", "Advanced"], ["all", "All levels"]], level)}<div class="chips">${[["all", "All topics"], ...Object.entries(CAT).map(([k, v]) => [k, v[0]])].map(([k, l]) => `<button class="chip" data-cat="${k}" aria-pressed="${k === cat}">${esc(l)}</button>`).join("")}</div></div>
        <div class="card card-pad mt"><div class="progress-head"><span>${done.length} of ${list.length} answered · ${ok} correct</span><span>${done.length ? pct((ok / done.length) * 100) : "—"} score</span></div>${ui.bar((done.length / Math.max(1, list.length)) * 100, "good")}</div>
        <div class="grid g2 mt">${list.map((x) => { const a = answers[x.i], o = order(x.opts.length, x.i);
          return `<article class="card scenario"><div class="row">${ui.tag(CAT[x.cat][0], "accent")}${ui.tag(x.level)}</div><h3>${esc(x.title)}</h3><p class="q">${esc(x.q)}</p>
            <div class="opts">${o.map((k) => `<button type="button" data-sc="${x.i}" data-opt="${k}" ${a ? "disabled" : ""} class="${a ? (k === x.correct ? "right" : k === a.choice ? "wrong" : "") : ""}">${esc(x.opts[k])}</button>`).join("")}</div>
            ${a ? `<div class="feedback">${ui.callout(a.ok ? "good" : "risk", a.ok ? "Correct" : "Not quite", x.feedback)}<a class="btn ghost sm mt" href="#/${CAT[x.cat][1]}">Review the rule →</a></div>` : ""}</article>`; }).join("")}</div>`,
        onSeg(name, v) { if (name === "level") { FG.store.set("sc:level", v); FG.refresh(); } },
        mount(root) {
          root.addEventListener("click", (e) => {
            const b = e.target.closest("[data-sc]");
            if (b) { const i = +b.dataset.sc, k = +b.dataset.opt, all = FG.store.get("scenarioAnswers", {}); all[i] = { choice: k, ok: k === C.scenarios[i].correct }; FG.store.set("scenarioAnswers", all); FG.refresh(); }
            const c = e.target.closest("[data-cat]"); if (c) { FG.store.set("sc:cat", c.dataset.cat); if (location.hash.includes("?")) FG.go("scenarios"); else FG.refresh(); }
            if (e.target.closest("[data-reset-sc]") && confirm("Clear all scenario answers?")) { FG.store.set("scenarioAnswers", {}); FG.refresh(); }
          });
        } };
    },
  });
  C.scenarios.forEach((x) => FG.addIndex(x.title, `Scenario · ${x.q}`, "scenarios", "Scenario", x.feedback));
})();
