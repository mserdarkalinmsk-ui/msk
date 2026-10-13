/* Ask: type a question in plain words and get answer cards drawn only from the guides —
   stage rules, verified key-figure notes and test explanations — each with its source and a link. */
(function () {
  "use strict";
  const { esc, slug, route } = FG;
  const C = window.FG_CONTENT;
  const STOP = new Set("a an the of to in on for and or is are be can do does i we you my our what when who which how why must should may it this that with from by at as if any there need needed".split(" "));
  const SYN = { tender: "tenders", bid: "offer", bids: "offers", quote: "offer", quotes: "offers", gift: "gifts", supplier: "suppliers", sign: "signs", signature: "signs", pay: "payment", paid: "payment", days: "day", limit: "threshold", ceiling: "threshold", cap: "threshold" };
  const norm = (w) => { w = SYN[w] || w; return w.length > 4 ? w.replace(/(ies|es|s)$/, "") : w; };
  const words = (s) => String(s).toLowerCase().replace(/€\s?/g, "€").split(/[^a-z0-9€,.%-]+/).map((w) => w.replace(/[.,]+$/, "")).filter((w) => w && !STOP.has(w)).map(norm);

  let corpus = null;
  function build() {
    const out = [];
    const add = (text, kind, where, path, extra = "") => { if (text && String(text).length > 20) out.push({ text: String(text), kind, where, path, w: new Set(words(`${text} ${extra}`)) }); };
    [["procurement", "Procurement", C.procurementStages], ["grants", "Grants", C.grantStages]].forEach(([base, label, stages]) => (stages || []).forEach((s) => {
      const path = `${base}/${slug(s.name)}`, where = `${label} · ${s.name}`, ctx = `${s.name} ${s.title || ""}`;
      add(s.remember, "Rule", where, path, ctx);
      ["understand", "do", "check", "warning"].forEach((k) => add(s[k], k === "warning" ? "Warning" : "Guidance", where, path, ctx));
      (s.sections || []).forEach(([h, sec]) => {
        add(sec.lead, "Guidance", where, path, `${ctx} ${h}`);
        (sec.items || []).forEach(([t, d]) => add(`${t}: ${d}`, "Guidance", where, path, `${ctx} ${h}`));
        (sec.must || []).forEach((m) => add(m, "Rule", where, path, `${ctx} ${h}`));
        if (sec.tip) add(sec.tip, "Tip", where, path, `${ctx} ${h}`);
      });
      [].concat(s.best || []).forEach((b) => add(Array.isArray(b) ? b.join(": ") : b, "Good practice", where, path, ctx));
      const notes = ((C.factNotes || {})[base] || {})[s.name] || {};
      Object.entries(notes).forEach(([k, n]) => add(`${n.what}${n.why ? ` ${n.why}` : ""}`, "Key figure", where, path, `${ctx} ${k}`));
    }));
    Object.entries(C.quizzes || {}).forEach(([base, qs]) => qs.forEach((q) => add(q.explain, "Explained", `${base === "grants" ? "Grants" : "Procurement"} · ${q.stage || "Test"}`, q.stage ? `${base}/${slug(q.stage)}` : `${base}/test`, q.q)));
    const seen = new Set();
    return out.filter((x) => !seen.has(x.text) && seen.add(x.text));
  }

  function ask(q) {
    corpus = corpus || build();
    const terms = [...new Set(words(q))];
    if (!terms.length) return [];
    const df = {}; corpus.forEach((d) => terms.forEach((t) => { if (d.w.has(t)) df[t] = (df[t] || 0) + 1; }));
    const kindW = { Rule: 1.25, "Key figure": 1.2, Warning: 1.1, Explained: 1.05 };
    return corpus.map((d) => {
      let s = 0, hit = 0;
      terms.forEach((t) => { if (d.w.has(t)) { hit++; s += Math.log(1 + corpus.length / df[t]); } });
      if (!hit) return null;
      s *= (hit / terms.length) * (kindW[d.kind] || 1) / Math.sqrt(1 + d.text.length / 400);
      return { d, s, hit };
    }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 8).map((r) => ({ ...r.d, full: r.hit === terms.length }));
  }

  function mark(text, q) {
    const ts = [...new Set(words(q))].filter((t) => t.length > 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    let h = esc(text);
    if (ts.length) h = h.replace(new RegExp(`\\b(${ts.join("|")})[a-z]*`, "gi"), "<mark>$&</mark>");
    return h;
  }

  const SAMPLES = ["Can I accept a gift from a bidder?", "When is the Tenders Board competent?", "How many suppliers must I invite?", "What is the indirect cost cap for grants?", "How long must offers remain valid?", "When must DLAPIL review a contract?"];

  function results(q) {
    if (!q.trim()) return `<div class="ak-empty"><b>Try one of these</b><div class="ak-chips">${SAMPLES.map((s) => `<button type="button" data-ak-q="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
    const r = ask(q);
    if (!r.length) return `<div class="ak-empty"><b>No answer in the guides</b>Use other words, for example a figure (“€184,000”), a body (“Tenders Board”) or a document (“addendum”). Answers come only from the guide content.</div>`;
    const [top, ...rest] = r;
    return `<article class="ak-best"><span class="ak-k">Best match · ${esc(top.kind)}</span><p>${mark(top.text, q)}</p><a href="#/${esc(top.path)}">${esc(top.where)} →</a></article>
      ${rest.length ? `<h3 class="ak-h">Also relevant</h3><div class="ak-list">${rest.map((x) => `<a class="ak-card" href="#/${esc(x.path)}"><span class="ak-k">${esc(x.kind)}</span><p>${mark(x.text, q)}</p><small>${esc(x.where)}</small></a>`).join("")}</div>` : ""}
      <p class="ak-note">Answers are passages quoted from the guides, ranked by the words in your question. Always open the stage to read the full rule.</p>`;
  }

  route("ask", {
    crumbs: () => [["Ask the guide", "ask"]],
    render: () => {
      const q = FG.store.get("ask:q", "");
      return { html: `<section class="ak">
        <p class="eyebrow">Ask the guide</p><h1>Ask a question, get the rule</h1>
        <p class="lead">Write your question in plain words. The answer is taken word for word from the Procurement and Grants guides, with a link to the stage it comes from.</p>
        <form class="ak-form" data-ak-form><input name="q" type="search" value="${esc(q)}" placeholder="e.g. Who approves a contract above €184,000?" aria-label="Your question" autocomplete="off"><button class="btn primary" type="submit">Ask</button></form>
        <div class="ak-out" aria-live="polite">${results(q)}</div></section>`,
        mount(root) { const i = root.querySelector(".ak-form input"); if (i) i.focus(); } };
    }
  });

  const run = (q) => { FG.store.set("ask:q", q); const o = document.querySelector(".ak-out"); if (o) o.innerHTML = results(q); const i = document.querySelector(".ak-form input"); if (i && i.value !== q) i.value = q; };
  document.addEventListener("submit", (e) => { if (!e.target.matches("[data-ak-form]")) return; e.preventDefault(); run(e.target.q.value); });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-ak-q]"); if (b) run(b.dataset.akQ); });
  FG.ask = ask;
  if (FG.addIndex) FG.addIndex("Ask the guide", "Question → answer from the guides", "ask", "Tool", "question answer ask faq");
})();
