/* Financial Guide · Academy
   Learn → Practise → Apply. Every lesson, question and figure is tied to a topic key,
   so wrong answers point to the lesson that fixes them and the knowledge map is computed, not curated. */
(function () {
  "use strict";
  const D = JSON.parse(document.getElementById("data").textContent);
  const L = D.limits;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = (s) => String(s).toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const euro = (n) => "€" + Math.round(n).toLocaleString("en-GB");
  const words = (t) => String(t || "").split(/\s+/).length;

  /* ---------- icons ---------- */
  const P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    learn: '<path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v5c3 2.5 9 2.5 12 0V9"/>',
    practice: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    tool: '<path d="M4 20h16"/><path d="M6 16V9M12 16V5M18 16v-5"/>',
    book: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 20a2 2 0 0 1 0-4h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
    grant: '<path d="M12 2l2.6 6.4L21 9l-5 4.3L17.5 20 12 16.5 6.5 20 8 13.3 3 9l6.4-.6z"/>',
    doc: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    report: '<path d="M4 20V4h16v16z"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    plane: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1 4-4.5a2 2 0 0 1 3 3l-4.5 4 1 8L14.5 22 12 14.5"/>',
    folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 8 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  };
  const ic = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;

  /* ---------- content model ---------- */
  // Modules are the unit of the knowledge map. Each owns lessons; every lesson owns a topic key.
  const MODULES = [
    { id: "procurement", title: "Procurement", icon: "scale", c: "--m1", sub: "Buy works, goods and services" },
    { id: "grants", title: "Grants", icon: "grant", c: "--m4", sub: "Finance a grantee's own project" },
    { id: "payment", title: "PO & payment", icon: "doc", c: "--m2", sub: "Commit, receive and pay" },
    { id: "yearend", title: "Year-end", icon: "cal", c: "--m3", sub: "Charge to the right year" },
    { id: "forecast", title: "Forecast & budget", icon: "trend", c: "--m5", sub: "Where the project is going" },
    { id: "reporting", title: "Financial reporting", icon: "report", c: "--m6", sub: "Where the project stands" },
    { id: "mission", title: "Field operations", icon: "plane", c: "--m7", sub: "Missions, claims and handovers" },
    { id: "filing", title: "Filing & audit", icon: "folder", c: "--m8", sub: "Keep an audit-ready file" },
  ];
  const MOD = Object.fromEntries(MODULES.map((m) => [m.id, m]));
  const BRIEF_ORDER = ["po-file", "payment-file", "foma-handover", "petty-cash", "vat", "year-end", "foma-forecast", "foma-addendum", "foma-reports", "foma", "foma-claim", "events", "filing", "links"];
  const BRIEF_MODULE = { "foma-handover": "payment", "foma-claim": "mission", links: "filing", "po-file": "payment", "payment-file": "payment", "petty-cash": "payment", vat: "payment", "year-end": "yearend", "foma-forecast": "forecast", "foma-reports": "reporting", "foma-addendum": "forecast", foma: "mission", events: "mission", filing: "filing" };
  const LESSONS = []; // {key, module, kind, title, short, minutes, href, data, path?, index?}
  const PATHS = {};
  [["procurement", "Procurement", D.paths.procurement], ["grants", "Grants", D.paths.grants]].forEach(([id, title, p]) => {
    PATHS[id] = { id, title, phases: p.phases, stages: p.stages, lessons: [] };
    p.stages.forEach((s, i) => {
      const text = [s.lead, s.understand, s.do, s.check, ...s.sections.map(([, b]) => (typeof b === "string" ? b : [b.lead, ...(b.items || []).flat(), ...(b.must || []), b.tip].join(" ")))].join(" ");
      const l = { key: `${id}/${slug(s.name)}`, module: id, kind: "stage", title: s.title, name: s.name, short: s.remember || s.lead, minutes: Math.max(3, Math.round(words(text) / 200)), href: `#/learn/${id}/${slug(s.name)}`, data: s, path: id, index: i };
      LESSONS.push(l); PATHS[id].lessons.push(l);
    });
  });
  Object.entries(D.briefs).sort(([a], [b]) => BRIEF_ORDER.indexOf(a.replace(/\//g, "-")) - BRIEF_ORDER.indexOf(b.replace(/\//g, "-"))).forEach(([k, b]) => {
    const id = k.replace(/\//g, "-"), mod = BRIEF_MODULE[id]; if (!mod) return;
    LESSONS.push({ key: `brief/${id}`, module: mod, kind: "brief", title: b.title, name: b.title, short: b.remember || b.lead, minutes: 3 + (b.blocks || []).length * 2, href: `#/learn/brief/${id}`, data: b });
  });
  const LESSON = Object.fromEntries(LESSONS.map((l) => [l.key, l]));
  const lessonsOf = (m) => LESSONS.filter((l) => l.module === m);

  // Questions: quizzes are tied to a stage, scenarios to a module; both resolve to a topic (= lesson key).
  const SC_TOPIC = { procurement: "procurement/thresholds-procedure", grant: "grants/procedure", payment: "brief/payment-file", yearend: "brief/year-end", forecast: "brief/foma-forecast", reporting: "brief/foma-reports", mission: "brief/foma", filing: "brief/filing" };
  const QUESTIONS = [];
  ["procurement", "grants"].forEach((m) => (D.quizzes[m] || []).forEach((q, i) => {
    const topic = `${m}/${slug(q.stage)}`;
    QUESTIONS.push({ id: `q-${m}-${i}`, module: m, topic: LESSON[topic] ? topic : PATHS[m].lessons[0].key, level: q.level <= 2 ? 1 : q.level <= 3 ? 2 : 3, q: q.q, opts: q.options, answer: q.answer, explain: q.explain, hint: q.hint, title: "" });
  }));
  D.scenarios.forEach((s, i) => {
    const topic = SC_TOPIC[s.cat], m = LESSON[topic] ? LESSON[topic].module : null; if (!m) return;
    QUESTIONS.push({ id: `s-${i}`, module: m, topic, level: s.level === "basic" ? 1 : 3, q: s.q, opts: s.opts, answer: s.correct, explain: s.feedback, title: s.title, scenario: true });
  });
  const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

  /* ---------- glossary ---------- */
  const TERMS = D.glossary.map(([k, n, d]) => ({ k, n, d }));
  const TERM = Object.fromEntries(TERMS.map((t) => [t.k, t]));
  const termRx = new RegExp(`\\b(${TERMS.map((t) => t.k).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
  // Escaped text with glossary terms turned into explain-on-demand buttons (first occurrence per block).
  const rich = (t) => { const seen = new Set(); return esc(t).replace(termRx, (m) => { if (seen.has(m)) return m; seen.add(m); return `<button type="button" class="term" data-term="${esc(m)}">${m}</button>`; }); };
  const termsIn = (t) => [...new Set((String(t).match(termRx) || []))];

  /* ---------- store ---------- */
  const KEY = "fga:v1";
  const blank = { level: null, done: {}, score: {}, review: {}, read: {}, last: null, theme: null };
  let S = blank;
  try { S = Object.assign({}, blank, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = Object.assign({}, blank); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep in memory */ } };
  const answer = (q, ok) => {
    const t = S.score[q.topic] || (S.score[q.topic] = { c: 0, w: 0 });
    ok ? t.c++ : t.w++;
    if (ok) delete S.review[q.topic]; else S.review[q.topic] = Date.now();
    save();
  };
  const mastery = (m) => {
    const ls = lessonsOf(m), done = ls.filter((l) => S.done[l.key]).length;
    let c = 0, w = 0; ls.forEach((l) => { const t = S.score[l.key]; if (t) { c += t.c; w += t.w; } });
    const read = ls.length ? done / ls.length : 0, att = c + w;
    const v = att ? Math.round((0.4 * read + 0.6 * (c / att)) * 100) : Math.round(read * 50);
    return { v, done, total: ls.length, att, state: !att && !done ? "none" : v >= 70 ? "good" : "warn" };
  };
  const overall = () => Math.round(MODULES.reduce((a, m) => a + mastery(m.id).v, 0) / MODULES.length);
  const stateLabel = { none: "Not started", warn: "Needs work", good: "Solid" };

  /* ---------- router ---------- */
  const routes = [];
  const route = (pattern, fn, nav) => routes.push({ rx: new RegExp("^" + pattern.replace(/:(\w+)/g, "([^/]+)") + "$"), fn, nav });
  const view = $("#view");
  let cleanup = null;
  function render() {
    const h = location.hash.replace(/^#\/?/, "") || "";
    const path = h.split("?")[0], qs = new URLSearchParams(h.split("?")[1] || "");
    for (const r of routes) {
      const m = path.match(r.rx); if (!m) continue;
      if (cleanup) { cleanup(); cleanup = null; }
      closePop();
      const out = r.fn(...m.slice(1).map(decodeURIComponent), qs);
      view.innerHTML = `<div class="view">${out.html}</div>`;
      document.title = (out.title ? out.title + " · " : "") + "Financial Guide";
      $$("[data-nav]").forEach((a) => a.dataset.nav === r.nav ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
      if (out.mount) cleanup = out.mount(view) || null;
      sideMeter();
      window.scrollTo(0, 0);
      $("#view").focus({ preventScroll: true });
      return;
    }
    location.hash = "#/";
  }
  const go = (h) => { if (location.hash === h) render(); else location.hash = h; };

  /* ---------- shared bits ---------- */
  const ring = (v, c = "var(--accent)") => `<span class="ring" style="--p:${v};--c:${c}" data-v="${v}%"></span>`;
  const bar = (v, c) => `<div class="bar" style="${c ? `--c:var(${c});` : ""}"><i style="--w:${v}%"></i></div>`;
  const head = (eyebrow, title, lead) => `<header class="head"><span class="eyebrow">${esc(eyebrow)}</span><h1>${title}</h1>${lead ? `<p>${lead}</p>` : ""}</header>`;
  const foot = `<footer class="foot"><span>Guidance tool. It does not replace the applicable rules, the Procurement Guide or Finance validation.</span><span>Progress is saved in this browser only.</span></footer>`;
  const nextLesson = (m) => lessonsOf(m).find((l) => !S.done[l.key]) || lessonsOf(m)[0];
  const reviewList = () => Object.keys(S.review).filter((k) => LESSON[k]).sort((a, b) => S.review[b] - S.review[a]);

  const TASKS = [
    ["scale", "Buy something", "Find the procedure, approvals and documents.", "#/tools/route"],
    ["grant", "Award a grant", "Direct award or call for proposals.", "#/learn/grants"],
    ["doc", "Prepare a PO or payment", "Commitment, delivery and payment file.", "#/learn/brief/po-file"],
    ["cal", "Close the financial year", "Delivery cut-off and open POs.", "#/learn/brief/year-end"],
    ["trend", "Revise a forecast", "Rebuild the expected end position.", "#/learn/brief/foma-forecast"],
    ["plane", "Plan a mission", "Authorisation before travel.", "#/learn/brief/foma"],
    ["folder", "Organise the file", "Evidence trail for audit.", "#/learn/brief/filing"],
    ["report", "Prepare a financial report", "Reconcile and finalise.", "#/learn/brief/foma-reports"],
  ];

  /* ---------- home ---------- */
  route("", () => {
    const lv = S.level, ov = overall(), rv = reviewList();
    const resume = S.last && LESSON[S.last] ? LESSON[S.last] : null;
    const levels = [
      ["new", "I'm new to this", "Tour first, then step-by-step lessons."],
      ["some", "I know the basics", "Find my gaps, then practise."],
      ["pro", "I have a case to handle", "Routes, rules and documents first."],
    ];
    // The four spaces, ordered by the learning loop. The level decides which one is highlighted.
    const pick = lv === "pro" ? 3 : lv === "some" ? 2 : 0;
    const SPACES = [
      ["01 / Start here", "Learn", `${LESSONS.length} short lessons in 8 paths, plus a 10-minute first-day tour.`, "#/learn", "--m1", "learn", resume ? `Resume: ${resume.name}` : "Start the tour"],
      ["02 / Practise", "Practise", `${QUESTIONS.length} questions and real cases with instant feedback.`, "#/practice", "--m2", "practice", "Start a round"],
      ["03 / Find my gaps", "Diagnose", "Five minutes, sixteen questions: your knowledge map and a personal plan.", "#/check", "--m4", "map", "Take the check"],
      ["04 / Apply", "Tools", "Route simulator, thresholds, glossary and the I'm-stuck helper.", "#/tools", "--m3", "tool", "Open tools"],
    ];
    const map = `<div class="kmap">${MODULES.map((m) => { const x = mastery(m.id); return `<a class="kcell" href="#/learn/${m.id}" style="--c:var(${m.c})"><span class="kico">${ic(m.icon)}</span><div><b>${esc(m.title)}</b><small>${x.done}/${x.total} lessons · <span class="state ${x.state}">${stateLabel[x.state]}</span></small></div>${ring(x.v, `var(${m.c})`)}</a>`; }).join("")}</div>`;
    return {
      title: "Home",
      html: `
      <section class="hx">
        <span class="eyebrow">Council of Europe · Programme finance</span>
        <h1>Financial Guide <span>Academy</span></h1>
        <p>Learn the rules, find your gaps, then handle the real case — in one guided place.</p>
        <button type="button" class="hx-search" data-open-search>${ic("search")}<span>Search a rule, an amount (“40k consultant”) or a term…</span><kbd>Ctrl K</kbd></button>
        <div class="hx-level" role="group" aria-label="Your experience">${levels.map(([k, t, d]) => `<button type="button" data-level="${k}" aria-pressed="${lv === k}"><b>${t}</b><span>${d}</span></button>`).join("")}</div>
      </section>

      <section class="spaces">${SPACES.map(([e, t, d, h, c, i, cta], k) => `<a class="space${k === pick && lv ? " pick" : ""}" href="${k === 0 && !resume ? "#/tour" : k === 0 ? resume.href : h}" style="--c:var(${c})"><small>${e}</small><span class="sico">${ic(i)}</span><h2>${t}</h2><p>${d}</p><span class="go"><em>${cta}</em><i>${ic("arrow")}</i></span>${k === pick && lv ? `<span class="rec">Recommended for you</span>` : ""}</a>`).join("")}</section>

      ${rv.length ? `<div class="review"><span class="badge">${rv.length}</span><div><b>To review: ${rv.slice(0, 3).map((k) => esc(LESSON[k].name)).join(" · ")}${rv.length > 3 ? ` · +${rv.length - 3}` : ""}</b><p>Your last answer on these topics was wrong. One short lesson fixes each.</p></div><a class="btn primary sm" href="${LESSON[rv[0]].href}">Review now →</a></div>` : ""}

      <section class="panel">
        <header class="panel-h"><div><span class="eyebrow">Guided start</span><h2>What do you need to do?</h2><p>Start from your task. Each one opens the lesson or tool you need.</p></div><a class="btn primary" href="#/stuck">${ic("help")} I'm stuck</a></header>
        <div class="tasks">${TASKS.map(([i, t, d, h], k) => `<a class="task" href="${h}" style="--c:var(--m${(k % 8) + 1})"><span class="ico">${ic(i)}</span><b>${t}</b><span>${d}</span><u>${ic("arrow")}</u></a>`).join("")}</div>
      </section>

      <section class="panel">
        <header class="panel-h"><div><span class="eyebrow">Your progress</span><h2>Knowledge map</h2><p>${ov ? `Overall mastery ${ov}%. Computed from lessons completed and answers given.` : "Empty for now. The 5-minute check fills it in."}</p></div><a class="btn" href="#/check">${ic("map")} Find my gaps</a></header>
        ${map}
      </section>
      ${foot}`,
      mount(root) {
        const onClick = (e) => { if (e.target.closest("[data-open-search]")) { openPalette(); return; } const b = e.target.closest("[data-level]"); if (!b) return; S.level = b.dataset.level; save(); render(); };
        root.addEventListener("click", onClick);
        return () => root.removeEventListener("click", onClick);
      },
    };
  }, "home");

  /* ---------- first-day tour ---------- */
  route("tour", (qs) => {
    const steps = D.lifecycle, n = steps.length;
    let i = Math.min(n - 1, Math.max(0, +(new URLSearchParams(location.hash.split("?")[1] || "").get("s")) || 0));
    const link = { 0: "#/learn/brief/foma-reports", 1: "#/learn/brief/foma-forecast", 2: "#/learn/brief/foma-addendum", 3: "#/learn/procurement", 4: "#/learn/brief/po-file", 5: "#/learn/brief/payment-file", 6: "#/learn/brief/year-end" };
    const body = () => {
      const s = steps[i];
      return `<div class="flow" style="--n:${n};--f:${n > 1 ? i / (n - 1) : 0}"><span class="fill"></span><span class="coin"></span>${steps.map((x, k) => `<button type="button" data-step="${k}" class="${k === i ? "on" : k < i ? "done" : ""}" aria-current="${k === i}"><i>${k < i ? "✓" : k + 1}</i><span>${esc(x.title)}</span></button>`).join("")}</div>
        <article class="card tour-card"><div class="l"><span class="eyebrow">Stop ${i + 1} of ${n}</span><h2>${esc(s.title)}</h2><p class="q">${esc(s.question)}</p><p class="body">${rich(s.lead)}</p>
          <div class="row" style="margin-top:24px">${i > 0 ? `<button type="button" class="btn" data-step="${i - 1}">← Back</button>` : ""}${i < n - 1 ? `<button type="button" class="btn primary" data-step="${i + 1}">Next stop →</button>` : `<a class="btn brass" href="#/learn">Choose a learning path →</a>`}</div></div>
          <div class="r"><div class="kv"><small>What you look at</small><p>${rich(s.learn)}</p></div><div class="kv"><small>What you produce</small><p>${rich(s.output)}</p></div><div class="kv"><small>Learn it properly</small><p><a href="${link[i] || "#/learn"}" style="color:var(--accent);font-weight:600;text-decoration:none">Open the lesson →</a></p></div></div></article>`;
    };
    return {
      title: "First-day tour",
      html: `${head("First-day tour · 10 minutes", "How money moves through a project", "Seven stops from the current position to the year-end. Each stop answers one question and points to the lesson that goes deeper.")}<div data-tour>${body()}</div>
        <div class="h2"><div><h2>Four words you will hear every day</h2><p>The vocabulary behind the stops above.</p></div></div>
        <div class="grid g2">${D.concepts.map((c) => `<div class="card pad"><span class="chip accent">${esc(c.q)}</span><h3 style="margin-top:12px;font-size:18px">${esc(c.title)}</h3><p style="margin-top:8px;color:var(--ink-2);font-size:14.5px">${rich(c.definition)}</p><p style="margin-top:10px;font-size:13.5px;color:var(--muted)"><b style="color:var(--ink)">Output:</b> ${esc(c.output)}</p></div>`).join("")}</div>${foot}`,
      mount(root) {
        const box = $("[data-tour]", root);
        const onClick = (e) => { const b = e.target.closest("[data-step]"); if (!b) return; i = +b.dataset.step; box.innerHTML = body(); history.replaceState(null, "", `#/tour?s=${i}`); };
        const onKey = (e) => { if (e.target.closest("input,textarea") || $(".scrim")) return; if (e.key === "ArrowRight" && i < n - 1) { i++; box.innerHTML = body(); } if (e.key === "ArrowLeft" && i > 0) { i--; box.innerHTML = body(); } };
        root.addEventListener("click", onClick); document.addEventListener("keydown", onKey);
        return () => { root.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
      },
    };
  }, "learn");

  /* ---------- learn: all paths ---------- */
  route("learn", () => ({
    title: "Learn",
    html: `${head("Learn", "Learning paths", "Short lessons in the order you need them. Each one ends with a quick check, so the knowledge map knows what you have mastered.")}
      <a class="card night pad" href="#/tour" style="display:flex;align-items:center;justify-content:space-between;gap:16px;text-decoration:none"><div><span class="eyebrow">Start here if you are new</span><h2 style="margin-top:8px;font-size:24px">First-day tour: how money moves through a project</h2><p style="margin-top:6px">Seven stops · 10 minutes</p></div><span class="btn brass">Start ${ic("arrow")}</span></a>
      <div class="grid g2" style="margin-top:16px">${MODULES.map((m) => { const x = mastery(m.id), nl = nextLesson(m.id); return `<a class="card path lift" href="#/learn/${m.id}" style="--c:var(${m.c})"><div class="row" style="justify-content:space-between"><span class="ico">${ic(m.icon)}</span>${ring(x.v, `var(${m.c})`)}</div><div><h3>${esc(m.title)}</h3><p>${esc(m.sub)}</p></div><div><div class="meta"><span>${x.done}/${x.total} lessons · ${stateLabel[x.state]}</span><span>Next: ${esc(nl.name)}</span></div>${bar(x.total ? (x.done / x.total) * 100 : 0, m.c)}</div></a>`; }).join("")}</div>${foot}`,
  }), "learn");

  /* ---------- module page ---------- */
  route("learn/:mod", (mod, qs) => {
    const m = MOD[mod]; if (!m) return { html: notFound() };
    const x = mastery(mod), p = PATHS[mod], ls = lessonsOf(mod), nl = nextLesson(mod);
    // Lines: path phases, or one line for brief modules. Each station keeps its lesson and line colour.
    const LC = ["--m1", "--m2", "--m4", "--m3"];
    const lines = p ? p.phases.map(([t, names], i) => ({ t, c: LC[i % 4], st: names.map((n) => p.lessons.find((l) => l.name === n)).filter(Boolean) })) : [{ t: m.title, c: m.c, st: ls }];
    const stations = lines.flatMap((ln, li) => ln.st.map((l) => ({ l, li, c: ln.c })));
    const start = Math.max(0, stations.findIndex((s) => s.l.key === (qs.get("s") || nl.key)));
    // Station labels stay on one line: a few long names get a short form; the panel shows the full title.
    const SHORT = { "Contract Execution & Payment": "Execution & Payment", "Terms & Specifications": "Terms & Specs", "Contract Management": "Contract Mgmt", "Field PO & payment handovers": "Field handovers", "Forecast and budget revision": "Forecast & revision", "Useful links & systems": "Links & systems" };
    const short = (n) => SHORT[n] || n;
    const state = (l) => S.review[l.key] ? "review" : S.done[l.key] ? "done" : l === nl ? "here" : "todo";
    const related = (l) => (l.data.links || []).map((n) => LESSONS.find((y) => y.module === l.module && (y.name === n || y.title === n))).filter(Boolean);
    const panel = (i) => {
      const { l, c } = stations[i], s = l.data, st = state(l), q = countQ(l.key), t = S.score[l.key];
      const figs = (s.keyFacts || []).concat(s.figures || []).slice(0, 3);
      const checks = (s.checks || []).length + (s.blocks || []).filter((b) => b.type === "checklist").reduce((a, b) => a + b.items.length, 0);
      const rel = related(l), prev = stations[i - 1], next = stations[i + 1];
      return `<article class="st-card" style="--c:var(${c})">
        <div class="st-top"><span class="st-no">${String(i + 1).padStart(2, "0")}</span><div><small>${esc(lines[stations[i].li].t)} · Station ${i + 1} of ${stations.length}</small><h2>${esc(l.title)}</h2></div>
          <span class="chip ${st === "done" ? "good" : st === "review" ? "warn" : st === "here" ? "accent" : ""}">${st === "done" ? "✓ Completed" : st === "review" ? "To review" : st === "here" ? "You are here" : "Not started"}</span></div>
        ${s.remember ? `<p class="st-one">${esc(s.remember)}</p>` : ""}
        <div class="st-g">
          <div class="st-main">
            ${[["Why", s.understand], ["Do", s.do], ["Done when", s.check]].filter(([, v]) => v).map(([k, v]) => `<div class="st-row"><small>${k}</small><p>${rich(v)}</p></div>`).join("")}
          </div>
          <aside class="st-side">
            ${figs.length ? `<div class="st-figs">${figs.map(([v, lab]) => `<div><b>${esc(v)}</b><span>${esc(lab)}</span></div>`).join("")}</div>` : ""}
            <ul class="st-meta"><li>${ic("clock")}<span>${l.minutes} min read</span></li><li>${ic("check")}<span>${checks ? `${checks} checklist items` : "No checklist"}</span></li><li>${ic("practice")}<span>${q ? `${q} check question${q > 1 ? "s" : ""}${t ? ` · ${t.c}/${t.c + t.w} right` : ""}` : "No questions yet"}</span></li>${s.example ? `<li>${ic("spark")}<span>Includes a worked example</span></li>` : ""}</ul>
          </aside>
        </div>
        ${rel.length ? `<div class="st-rel"><small>Connected stations</small><div class="row">${rel.map((r) => { const j = stations.findIndex((y) => y.l === r); return j >= 0 ? `<button type="button" class="chip" data-go-st="${j}">${ic("arrow")}${esc(r.name)}</button>` : `<a class="chip" href="${r.href}">${esc(r.name)}</a>`; }).join("")}</div></div>` : ""}
        <div class="st-act"><a class="btn primary" href="${l.href}">${S.done[l.key] ? "Revisit lesson" : "Open lesson"} ${ic("arrow")}</a>${q ? `<a class="btn" href="#/practice?m=${mod}">Practise</a>` : ""}<span class="st-nav">${prev ? `<button type="button" class="icon-btn" data-go-st="${i - 1}" aria-label="Previous station">←</button>` : ""}${next ? `<button type="button" class="icon-btn" data-go-st="${i + 1}" aria-label="Next station">→</button>` : ""}</span></div>
      </article>`;
    };
    let k = 0;
    const map = `<div class="metro" role="tablist" aria-label="${esc(m.title)} route">${lines.map((ln) => `<section class="line" style="--c:var(${ln.c});--n:${ln.st.length}"><header><i></i>${esc(ln.t)}<em>${ln.st.length} stops</em></header><ol>${ln.st.map((l) => { const i = k++, st = state(l), q = countQ(l.key);
      return `<li><button type="button" role="tab" class="stn s-${st}${i === start ? " sel" : ""}" data-st="${i}" aria-selected="${i === start}" title="${esc(l.title)}"><span class="dot">${st === "done" ? ic("check") : st === "review" ? "!" : i + 1}</span><span class="nm" title="${esc(l.name)}">${esc(short(l.name))}</span>${q ? `<span class="q">${q}Q</span>` : ""}${st === "here" ? `<span class="pin">You are here</span>` : ""}</button></li>`; }).join("")}</ol></section>`).join("")}</div>`;
    return {
      title: m.title,
      html: `<div class="crumbs"><a href="#/learn">Learn</a><span>/</span><span>${esc(m.title)}</span></div>
        <div class="card night pad mhero" style="margin-top:14px">
          <div><span class="eyebrow">Learning route · ${ls.length} stations · ${ls.reduce((a, l) => a + l.minutes, 0)} min</span><h1>${esc(m.title)}</h1><p>${esc(m.sub)}. ${x.done} of ${x.total} stations completed${x.att ? ` · ${x.att} answers given` : ""}.</p>
          <div class="row" style="margin-top:20px"><a class="btn brass" href="${nl.href}">${x.done ? "Continue" : "Start"}: ${esc(nl.name)} ${ic("arrow")}</a><a class="btn ghost-night" href="#/practice?m=${mod}">Practise ${countQM(mod)} questions</a></div></div>
          <div class="mh-ring"><span class="ring" style="--p:${x.v};--c:#fff" data-v="${x.v}%"></span><small>${stateLabel[x.state]}</small></div></div>
        <div class="legend"><span><i class="lg lg-here"></i>You are here</span><span><i class="lg lg-done"></i>Completed</span><span><i class="lg lg-review"></i>To review</span><span><i class="lg"></i>Not started</span><span class="kb">Use ← → to move along the line</span></div>
        ${map}
        <div data-panel aria-live="polite">${panel(start)}</div>${foot}`,
      mount(root) {
        let cur = start;
        const sel = (i) => { if (i < 0 || i >= stations.length) return; cur = i;
          $$("[data-st]", root).forEach((b) => { const on = +b.dataset.st === i; b.classList.toggle("sel", on); b.setAttribute("aria-selected", on); if (on) b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); });
          $("[data-panel]", root).innerHTML = panel(i); history.replaceState(null, "", `#/learn/${mod}?s=${encodeURIComponent(stations[i].l.key)}`); };
        const onClick = (e) => { const b = e.target.closest("[data-st],[data-go-st]"); if (b) sel(+(b.dataset.st ?? b.dataset.goSt)); };
        const onKey = (e) => { if (e.target.closest("input,textarea") || $(".scrim")) return; if (e.key === "ArrowRight") { e.preventDefault(); sel(cur + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); sel(cur - 1); } };
        root.addEventListener("click", onClick); document.addEventListener("keydown", onKey);
        return () => { root.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
      },
    };
  }, "learn");
  const countQ = (k) => QUESTIONS.filter((q) => q.topic === k).length;
  const countQM = (m) => QUESTIONS.filter((q) => q.module === m).length;
  const notFound = () => `${head("Not found", "This page does not exist", "")}<a class="btn" href="#/">Back home</a>`;

  /* ---------- rich lesson blocks ---------- */
  const tickKey = (id) => (S.ticks || (S.ticks = {}))[id] || (S.ticks[id] = {});
  const bh = (b, extra = "") => `<header class="bk-h"><div><h3>${esc(b.title)}</h3>${b.sub ? `<p>${esc(b.sub)}</p>` : ""}</div>${extra}</header>`;
  const tickRow = (id, k, title, desc) => { const on = !!tickKey(id)[k]; return `<button type="button" class="tick${on ? " on" : ""}" data-tick="${esc(id)}" data-k="${k}" aria-pressed="${on}"><i>${ic("check")}</i><span><b>${esc(title)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</span></button>`; };
  const tickMeter = (id, n) => { const d = Object.keys(tickKey(id)).length; return `<span class="bk-count" data-count="${esc(id)}" data-n="${n}"><b>${d}</b>/${n} done</span>`; };
  const BLOCK = {
    steps: (b) => `<section class="bk">${bh(b, `<span class="chip">${b.items.length} steps</span>`)}<ol class="tl">${b.items.map((s, i) => `<li class="tl-i${i === 0 ? " open" : ""}"><button type="button" class="tl-b" data-tl><em>${i + 1}</em><span><b>${esc(s.t)}</b>${s.role ? `<small>${esc(s.role)}</small>` : ""}</span>${ic("chev")}</button><div class="tl-d"><p>${rich(s.text || "")}</p>${(s.list || []).length ? `<ul>${s.list.map((x) => `<li>${rich(x)}</li>`).join("")}</ul>` : ""}${(s.docs || []).length ? `<div class="tl-docs">${s.docs.map((d) => `<span>${ic("doc")}${esc(d)}</span>`).join("")}</div>` : ""}${s.note ? `<p class="tl-note">${rich(s.note)}</p>` : ""}</div></li>`).join("")}</ol></section>`,
    docs: (b) => { const keys = Object.keys(b.services), cur = keys[0];
      return `<section class="bk" data-docs="${b.id}">${bh(b)}<div class="seg wrapseg" role="tablist">${keys.map((k) => `<button type="button" data-svc="${esc(k)}" aria-pressed="${k === cur}">${esc(k)}</button>`).join("")}</div>${keys.map((k) => { const v = b.services[k], id = `${b.id}:${k}`, n = v.signed.length + v.support.length;
        return `<div class="docs-p" data-svc-p="${esc(k)}" ${k === cur ? "" : "hidden"}><div class="docs-top">${v.sub ? `<b>${esc(v.sub)}</b>` : `<b>${esc(k)}</b>`}${tickMeter(id, n)}</div><div class="docs-cols"><div><h4>${ic("flag")} To be signed</h4>${v.signed.map(([t, d], i) => tickRow(id, "s" + i, t, d)).join("")}</div><div><h4>${ic("folder")} Supporting documents</h4>${v.support.map(([t, d], i) => tickRow(id, "u" + i, t, d)).join("")}</div></div></div>`; }).join("")}</section>`; },
    dodont: (b) => `<section class="bk" data-dd>${bh(b, `<span class="chip">${b.rows.length} rules</span>`)}<div class="dd"><div class="dd-h"><span class="ok">${ic("check")} Do</span><span class="no">✕ Avoid</span></div>${b.rows.map(([d, n], i) => `<div class="dd-r"${i >= 6 ? " hidden" : ""}><p>${rich(d)}</p><p>${rich(n)}</p></div>`).join("")}</div>${b.rows.length > 6 ? `<button type="button" class="btn sm dd-more" data-dd-more>Show all ${b.rows.length} rules</button>` : ""}</section>`,
    flow: (b) => `<section class="bk" data-flow>${bh(b)}<div class="fl-chain">${b.stages.map((s, i) => `<button type="button" data-fl="${i}" aria-pressed="${i === 0}"><em>${String(i + 1).padStart(2, "0")}</em><b>${esc(s.role)}</b><small>${esc(s.label)}</small></button>`).join(`<i class="fl-ar">${ic("arrow")}</i>`)}</div>${b.stages.map((s, i) => `<div class="fl-d" data-fl-p="${i}" ${i ? "hidden" : ""}><div class="fl-who"><span class="chip accent">${esc(s.role)}</span><b>${esc(s.summary)}</b></div><div class="fl-g"><div><small>Action</small><p>${rich(s.action)}</p></div><div><small>Control</small><p>${rich(s.control)}</p></div><div><small>Handover</small><p>${rich(s.handover)}</p></div>${s.evidence ? `<div><small>Evidence</small><p>${rich(s.evidence)}</p></div>` : ""}</div></div>`).join("")}</section>`,
    phases: (b) => `<section class="bk">${bh(b)}<div class="ph">${b.items.map((p, i) => `<article style="--c:var(--m${[1, 2, 3, 4][i % 4]})"><small>${esc(p.m)}</small><h4>${esc(p.t)}</h4><ul>${p.items.map((x) => `<li>${rich(x)}</li>`).join("")}</ul><dl><div><dt>Owner</dt><dd>${esc(p.owner)}</dd></div><div><dt>Control</dt><dd>${esc(p.control)}</dd></div><div><dt>Evidence</dt><dd>${esc(p.evidence)}</dd></div></dl></article>`).join("")}</div></section>`,
    checklist: (b) => { const id = b.id || "chk"; return `<section class="bk">${bh(b, tickMeter(id, b.items.length))}<div class="ticks-l">${b.items.map((x, i) => Array.isArray(x) ? tickRow(id, i, x[0], x[1]) : tickRow(id, i, x)).join("")}</div></section>`; },
    cards: (b) => `<section class="bk">${bh(b)}<div class="cd">${b.items.map((c, i) => `<article style="--c:var(--m${(i % 8) + 1})"><small>${esc(c.k)}</small><h4>${esc(c.title)}</h4><p>${rich(c.text)}</p></article>`).join("")}</div></section>`,
    keys: (b) => `<section class="bk">${bh(b)}<ol class="keys">${b.items.map((k) => `<li><span>${rich(k)}</span></li>`).join("")}</ol></section>`,
    triggers: (b) => `<section class="bk" data-trg>${bh(b)}<div class="trg">${b.items.map((t, i) => `<button type="button" data-tr="${i}" aria-pressed="${i === 0}"><small>${esc(t.tag)}</small><b>${esc(t.title)}</b></button>`).join("")}</div>${b.items.map((t, i) => `<div class="trg-d" data-tr-p="${i}" ${i ? "hidden" : ""}><p class="trg-s">${rich(t.summary)}</p><div class="ticks-l">${t.checks.map((c, j) => `<div class="tick static"><i>${j + 1}</i><span><b>${rich(c)}</b></span></div>`).join("")}</div>${t.decision ? `<div class="trg-dec"><small>${esc(t.decision.tag)}</small><b>${esc(t.decision.title)}</b><p>${rich(t.decision.text)}</p></div>` : ""}</div>`).join("")}</section>`,
    folders: (b) => { const keys = Object.keys(b.groups); return `<section class="bk" data-fold>${bh(b)}<div class="seg wrapseg">${keys.map((k, i) => `<button type="button" data-fo="${i}" aria-pressed="${i === 0}">${esc(k)}</button>`).join("")}</div>${keys.map((k, i) => `<div class="fo" data-fo-p="${i}" ${i ? "hidden" : ""}>${b.groups[k].map(([ph, docs], j) => `<div class="fo-c" style="--c:var(--m${j + 1})"><h4>${ic("folder")}<span>${String(j + 1).padStart(2, "0")} · ${esc(ph)}</span></h4><ul>${docs.map((d) => `<li>${ic("doc")}${esc(d)}</li>`).join("")}</ul></div>`).join("")}</div>`).join("")}</section>`; },
    links: (b) => { const cats = [...new Set(b.items.map((l) => l.cat))]; return `<section class="bk">${bh(b)}${cats.map((c) => `<h4 class="lk-h">${esc(c)}</h4><div class="lk">${b.items.filter((l) => l.cat === c).map((l) => `<div><b>${esc(l.title)}</b><p>${esc(l.desc)}</p><small>Use it for: ${esc(l.use)}</small></div>`).join("")}</div>`).join("")}</section>`; },
    roles: (b) => `<section class="bk" data-roles>${bh(b)}<div class="rl">${b.items.map((r, i) => `<button type="button" data-rl="${i}" aria-pressed="${i === 0}"><b>${esc(r.name)}</b><small>${esc(r.tag)}</small></button>`).join("")}</div>${b.items.map((r, i) => `<div class="rl-d" data-rl-p="${i}" ${i ? "hidden" : ""}><p class="trg-s">${rich(r.summary)}</p>${r.when ? `<p class="rl-when"><b>When:</b> ${rich(r.when)}</p>` : ""}<div class="fl-g"><div><small>Does</small><ul>${(r.does || []).map((d) => `<li>${rich(d)}</li>`).join("")}</ul></div><div><small>Stages</small><div class="row">${(r.stages || []).map((s) => { const l = LESSON[`procurement/${slug(s)}`]; return l ? `<a class="chip" href="${l.href}">${esc(s)}</a>` : `<span class="chip">${esc(s)}</span>`; }).join("")}</div></div></div></div>`).join("")}</section>`,
    costs: (b) => `<section class="bk" data-costs>${bh(b)}<div class="rl">${b.items.map(([k, st], i) => `<button type="button" data-ct="${i}" aria-pressed="${i === 0}" class="${/^Ineligible/.test(st) ? "bad" : /Potentially/.test(st) ? "good" : "mid"}"><b>${esc(k[0].toUpperCase() + k.slice(1))}</b><small>${esc(st)}</small></button>`).join("")}</div>${b.items.map(([k, st, t], i) => `<div class="rl-d" data-ct-p="${i}" ${i ? "hidden" : ""}><span class="chip ${/^Ineligible/.test(st) ? "risk" : /Potentially/.test(st) ? "good" : "warn"}">${esc(st)}</span><p class="trg-s" style="margin-top:10px">${rich(t)}</p></div>`).join("")}</section>`,
    yearsplit: (b) => `<section class="bk" data-ys>${bh(b)}<div class="ys-in"><label>Service start<input type="date" data-ys-a value="2026-12-01"></label><label>Service end<input type="date" data-ys-b value="2027-01-31"></label><label>Amount (€)<input type="number" data-ys-v value="10000" min="0" step="100"></label></div><div class="ys-bar"><i data-ys-1></i><i data-ys-2></i></div><div class="ys-out" data-ys-o></div></section>`,
  };
  const blocksHtml = (list) => (list || []).map((b) => (BLOCK[b.type] ? BLOCK[b.type](b) : "")).join("");
  function yearSplit(box) {
    const a = new Date($("[data-ys-a]", box).value), b = new Date($("[data-ys-b]", box).value), v = +$("[data-ys-v]", box).value || 0;
    if (!(a <= b)) { $("[data-ys-o]", box).innerHTML = `<p class="tl-note">The end date must be after the start date.</p>`; return; }
    const day = 864e5, total = Math.round((b - a) / day) + 1, cut = new Date(a.getFullYear(), 11, 31);
    const d1 = b <= cut ? total : Math.max(0, Math.round((cut - a) / day) + 1), d2 = total - d1, y1 = a.getFullYear(), y2 = y1 + 1;
    $("[data-ys-1]", box).style.width = (d1 / total) * 100 + "%"; $("[data-ys-2]", box).style.width = (d2 / total) * 100 + "%";
    $("[data-ys-o]", box).innerHTML = `<div><small>${y1}</small><b>${euro((v * d1) / total)}</b><span>${d1} of ${total} days</span></div><div><small>${y2}</small><b>${euro((v * d2) / total)}</b><span>${d2} of ${total} days</span></div><p>${d2 ? `Charge only the ${y1} share to ${y1}; the rest belongs to ${y2}. Keep the service-period evidence in the file.` : `Fully performed in ${y1}: the whole amount is ${y1} expenditure if delivered by 31 December.`}</p>`;
  }
  function mountBlocks(root) {
    $$("[data-ys]", root).forEach(yearSplit);
    const sw = (e, attr, scope) => { const t = e.target.closest(`[${attr}]`); if (!t) return false; const box = t.closest(scope); $$(`[${attr}]`, box).forEach((x) => x.setAttribute("aria-pressed", x === t)); $$(`[${attr}-p]`, box).forEach((p) => (p.hidden = p.getAttribute(`${attr}-p`) !== t.getAttribute(attr))); return true; };
    const onClick = (e) => {
      const more = e.target.closest("[data-dd-more]"); if (more) { $$(".dd-r[hidden]", more.closest("[data-dd]")).forEach((r) => (r.hidden = false)); more.remove(); return; }
      const tl = e.target.closest("[data-tl]"); if (tl) { tl.parentElement.classList.toggle("open"); return; }
      const tk = e.target.closest("[data-tick]");
      if (tk) { const id = tk.dataset.tick, k = tk.dataset.k, m = tickKey(id); if (m[k]) delete m[k]; else m[k] = 1; save(); tk.classList.toggle("on", !!m[k]); tk.setAttribute("aria-pressed", !!m[k]);
        $$(`[data-count="${CSS.escape(id)}"]`, root).forEach((c) => { const d = Object.keys(m).length; c.querySelector("b").textContent = d; c.classList.toggle("full", d >= +c.dataset.n); }); return; }
      if (sw(e, "data-svc", "[data-docs]")) { const t = e.target.closest("[data-svc]"), box = t.closest("[data-docs]"); $$("[data-svc-p]", box).forEach((p) => (p.hidden = p.dataset.svcP !== t.dataset.svc)); return; }
      if (sw(e, "data-fl", "[data-flow]") || sw(e, "data-tr", "[data-trg]") || sw(e, "data-fo", "[data-fold]") || sw(e, "data-rl", "[data-roles]") || sw(e, "data-ct", "[data-costs]")) return;
    };
    const onInput = (e) => { const y = e.target.closest("[data-ys]"); if (y) yearSplit(y); };
    root.addEventListener("click", onClick); root.addEventListener("input", onInput);
    $$("[data-count]", root).forEach((c) => c.classList.toggle("full", +c.querySelector("b").textContent >= +c.dataset.n));
    return () => { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); };
  }

  /* ---------- lesson ---------- */
  function lessonPage(l) {
    S.last = l.key; save();
    const s = l.data, m = MOD[l.module], siblings = lessonsOf(l.module), k = siblings.indexOf(l);
    const prev = siblings[k - 1], next = siblings[k + 1];
    const allText = [s.lead, s.understand, s.do, s.check, s.example, ...(s.sections || []).map(([h, b]) => JSON.stringify(b))].join(" ");
    const terms = termsIn(allText).slice(0, 8);
    const figures = (s.keyFacts || []).map(([v, lab], fi) => { const n = ((D.factNotes[l.path] || {})[s.name] || {})[fi]; return [v, lab, n]; }).concat((s.figures || []).map(([v, lab, d]) => [v, lab, d ? { what: d } : null]));
    const qs = QUESTIONS.filter((q) => q.topic === l.key);
    const sections = (s.sections || []).map(([h, b], si) => {
      const bd = typeof b === "string" ? { lead: b } : b;
      const read = (S.read[l.key] || {})[si];
      return `<div class="acc${read ? " read" : ""}" data-acc="${si}"><button type="button" aria-expanded="false"><i>${read ? "✓" : si + 1}</i><b>${esc(h)}<span>${esc(bd.lead || "")}</span></b>${ic("chev")}</button><div class="body">
        ${(bd.items || []).length ? `<div class="items">${bd.items.map(([a, c]) => `<div><b>${rich(a)}</b><span>${rich(c)}</span></div>`).join("")}</div>` : ""}
        ${(bd.must || []).length ? `<ul class="musts">${bd.must.map((x) => `<li><span>${rich(x)}</span></li>`).join("")}</ul>` : ""}
        ${bd.tip ? `<p class="tip">${rich(bd.tip)}</p>` : ""}</div></div>`;
    }).join("");
    const pre = [prev ? `<a class="chip ${S.done[prev.key] ? "good" : "warn"}" href="${prev.href}">${S.done[prev.key] ? "✓" : "○"} ${esc(prev.name)}</a>` : "", ...terms.map((t) => `<button type="button" class="chip termchip" data-term="${esc(t)}">${esc(t)}</button>`)].filter(Boolean).join("");
    const steps = siblings.map((x, j) => `<a href="${x.href}" class="${j === k ? "on" : S.done[x.key] ? "done" : ""}" title="${esc(x.name)}"></a>`).join("");
    return {
      title: l.title,
      html: `<div class="narrow">
        <div class="lesson-top"><div class="crumbs"><a href="#/learn">Learn</a><span>/</span><a href="#/learn/${l.module}">${esc(m.title)}</a><span>/</span><span>Lesson ${k + 1} of ${siblings.length}</span></div><div class="steps-mini" aria-hidden="true">${siblings.length <= 16 ? steps : ""}</div></div>
        <header class="lesson-head"><span class="eyebrow">${esc(m.title)}${s.source ? ` · Guide ${esc(s.source)}` : ""}</span><h1>${esc(l.title)}</h1><p class="lead">${rich(s.lead)}</p>
          <div class="row"><span class="chip">${ic("clock")} ${l.minutes} min read</span>${qs.length ? `<span class="chip accent">${qs.length} check question${qs.length > 1 ? "s" : ""}</span>` : ""}${S.done[l.key] ? `<span class="chip good">✓ Completed</span>` : ""}${S.review[l.key] ? `<span class="chip warn">To review</span>` : ""}</div></header>
        ${s.remember ? `<div class="night sentence"><small>In one sentence</small><b>${esc(s.remember)}</b></div>` : ""}
        ${pre ? `<div class="prereq"><h4>To follow this lesson</h4><div class="row">${pre}</div></div>` : ""}
        <div class="trio">${[["Why it matters", s.understand, "--m1", "1"], ["What you do", s.do, "--m2", "2"], ["Done when", s.check, "--m3", "3"]].map(([t, x, c, n]) => x ? `<div style="--c:var(${c})"><small><i>${n}</i>${t}</small><p>${rich(x)}</p></div>` : "").join("")}</div>
        ${s.example ? `<div class="example"><span class="tag">EXAMPLE</span><p>${rich(s.example)}</p></div>` : ""}
        ${figures.length ? `<div class="figs" style="--n:${Math.min(3, figures.length)}">${figures.map(([v, lab, n]) => `<div class="fig"><b>${esc(v)}</b><span>${esc(lab)}</span>${n && n.what ? `<details><summary>Why it matters</summary><p>${rich(n.what)}</p>${n.why ? `<p>${rich(n.why)}</p>` : ""}</details>` : ""}</div>`).join("")}</div>` : ""}
        ${blocksHtml(s.blocks)}
        ${sections ? `<section class="deep"><div class="h2" style="margin-top:0"><div><h2>Go deeper</h2><p>${(s.sections || []).length} topics. Open each one; it is marked as read.</p></div></div>${sections}</section>` : ""}
        ${s.warning || s.best ? `<div class="pitfalls">${s.warning ? `<div class="bad"><h4>Common mistake</h4><p>${rich(s.warning)}</p></div>` : ""}${s.best ? `<div class="ok"><h4>Good practice</h4><p>${rich(s.best)}</p></div>` : ""}</div>` : ""}
        ${(s.checks || []).length ? blocksHtml([{ type: "checklist", title: "Stage checklist", sub: "Tick each control as you complete it on your file.", id: l.key, items: s.checks }]) : ""}
        <div data-quiz></div>
        <div class="lesson-nav">${prev ? `<a href="${prev.href}"><small>← Previous</small><b>${esc(prev.name)}</b></a>` : "<span></span>"}${next ? `<a class="next" href="${next.href}"><small>Next lesson →</small><b>${esc(next.name)}</b></a>` : `<a class="next" href="#/learn/${l.module}"><small>Path complete →</small><b>Back to ${esc(m.title)}</b></a>`}</div>
        ${foot}</div>`,
      mount(root) {
        const quizBox = $("[data-quiz]", root);
        if (qs.length) quiz(quizBox, qs, { title: "Check yourself", onDone: (c) => { S.done[l.key] = 1; save(); return c; }, lesson: l });
        else quizBox.innerHTML = completeCard(l);
        const onClick = (e) => {
          const a = e.target.closest(".acc > button");
          if (a) { const acc = a.parentElement, open = acc.getAttribute("open-state") !== "1"; acc.setAttribute("open-state", open ? "1" : "0"); a.setAttribute("aria-expanded", open);
            if (open) { const r = S.read[l.key] || (S.read[l.key] = {}); r[acc.dataset.acc] = 1; save(); acc.classList.add("read"); $("i", a).textContent = "✓"; } }
          if (e.target.closest("[data-complete]")) { S.done[l.key] = 1; save(); toast("Lesson completed"); quizBox.innerHTML = completeCard(l); sideMeter(); }
        };
        root.addEventListener("click", onClick);
        const unBlocks = mountBlocks(root);
        return () => { root.removeEventListener("click", onClick); unBlocks(); };
      },
    };
  }
  const completeCard = (l) => S.done[l.key]
    ? `<div class="card complete"><div><b>✓ Lesson completed</b><p class="muted" style="color:var(--muted)">It counts towards your ${esc(MOD[l.module].title)} mastery.</p></div><a class="btn sm" href="#/practice?m=${l.module}">Practise this module →</a></div>`
    : `<div class="card complete"><div><b>Got it?</b><p style="color:var(--muted)">Mark the lesson complete to update your knowledge map.</p></div><button type="button" class="btn primary" data-complete>${ic("check")} Mark complete</button></div>`;
  route("learn/brief/:id", (id) => LESSON[`brief/${id}`] ? lessonPage(LESSON[`brief/${id}`]) : { html: notFound() }, "learn");
  route("learn/:path/:stage", (p, st) => LESSON[`${p}/${st}`] ? lessonPage(LESSON[`${p}/${st}`]) : { html: notFound() }, "learn");

  /* ---------- quiz engine (lessons, practice, check) ---------- */
  function quiz(box, list, opt) {
    let i = 0; const res = [];
    const L8 = "ABCDEFGH";
    const draw = () => {
      if (i >= list.length) { const c = res.filter(Boolean).length; if (opt.onDone) opt.onDone(c, res); box.innerHTML = opt.summary ? opt.summary(c, res) : summary(c, list.length, opt.lesson); return; }
      const q = list[i];
      box.innerHTML = `<section class="card quiz" aria-live="polite"><div class="quiz-top"><span class="eyebrow">${esc(opt.title || "Question")} · ${i + 1} of ${list.length}</span><div class="progress-dots">${list.map((_, j) => `<i class="${j < i ? (res[j] ? "c" : "w") : j === i ? "on" : ""}"></i>`).join("")}</div></div>
        ${q.title ? `<p style="margin-top:14px"><span class="chip">${esc(MOD[q.module].title)} · case</span> <b style="margin-left:6px">${esc(q.title)}</b></p>` : opt.showModule ? `<p style="margin-top:14px"><span class="chip">${esc(MOD[q.module].title)}</span></p>` : ""}
        <h3>${rich(q.q)}</h3><div class="opts">${q.opts.map((o, j) => `<button type="button" class="opt" data-o="${j}"><i>${L8[j]}</i><span>${rich(o)}</span><span></span></button>`).join("")}</div>
        ${q.hint ? `<p class="hint">Stuck? <button type="button" data-hint>Show a hint</button></p>` : ""}<div data-fb></div></section>`;
    };
    const onClick = (e) => {
      if (e.target.closest("[data-hint]")) { const q = list[i]; e.target.closest(".hint").textContent = "Hint: " + q.hint; return; }
      if (e.target.closest("[data-next]")) { i++; draw(); box.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
      if (e.target.closest("[data-retry]")) { i = 0; res.length = 0; draw(); return; }
      const b = e.target.closest("[data-o]"); if (!b || b.disabled) return;
      const q = list[i], pick = +b.dataset.o, ok = pick === q.answer; res[i] = ok; answer(q, ok);
      $$(".opt", box).forEach((x, j) => { x.disabled = true; if (j === q.answer) x.classList.add("right"); else if (j === pick) x.classList.add("wrong"); });
      const l = LESSON[q.topic], here = opt.lesson && opt.lesson.key === q.topic;
      $("[data-fb]", box).innerHTML = `<div class="feedback ${ok ? "good" : "bad"}"><b>${ok ? "Correct." : "Not quite."}</b>${rich(q.explain)}
        <div class="row">${i < list.length - 1 ? `<button type="button" class="btn primary sm" data-next>Next question →</button>` : `<button type="button" class="btn primary sm" data-next>See result →</button>`}${!ok && l && !here ? `<a class="btn sm" href="${l.href}">Learn this: ${esc(l.name)} →</a>` : ""}</div></div>`;
      sideMeter();
    };
    box.addEventListener("click", onClick);
    draw();
  }
  const summary = (c, n, l) => `<section class="card quiz"><span class="eyebrow">Result</span><h3>${c} of ${n} correct${c === n ? " — well done." : "."}</h3><p style="margin-top:8px;color:var(--ink-2)">${c === n ? "This lesson is marked complete and counts as mastered." : "The lesson is marked complete. Wrong answers were added to your review list on the home page."}</p><div class="row" style="margin-top:16px"><button type="button" class="btn sm" data-retry>Try again</button>${l ? `<a class="btn primary sm" href="#/practice?m=${l.module}">Practise the module →</a>` : ""}</div></section>`;

  /* ---------- practice ---------- */
  route("practice", (qs) => {
    const m = MOD[qs.get("m")] ? qs.get("m") : "all", lv = qs.get("l") || "all";
    const pool = QUESTIONS.filter((q) => (m === "all" || q.module === m) && (lv === "all" || (lv === "1" ? q.level === 1 : q.level > 1)));
    // Weakest first: wrong before unseen before correct, then shuffle inside each band so repeats feel fresh.
    const band = (q) => { const t = S.score[q.topic]; return S.review[q.topic] ? 0 : !t ? 1 : 2; };
    const list = pool.map((q) => [band(q), Math.random(), q]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 8).map((x) => x[2]);
    const f = (key, val, label) => `<a href="#/practice?${new URLSearchParams({ m: key === "m" ? val : m, l: key === "l" ? val : lv })}" aria-pressed="${(key === "m" ? m : lv) === val}">${label}</a>`;
    return {
      title: "Practise",
      html: `${head("Practise", "Real cases, instant feedback", "Rounds of eight questions, weakest topics first. A wrong answer links straight to the lesson that explains it.")}
        <div class="filters">${f("m", "all", "All modules")}${MODULES.map((x) => f("m", x.id, x.title)).join("")}</div>
        <div class="filters">${f("l", "all", "All levels")}${f("l", "1", "Foundation")}${f("l", "2", "Advanced")}</div>
        <div data-pq>${list.length ? "" : `<div class="card pad empty">No questions for this filter.</div>`}</div>${foot}`,
      mount(root) { if (list.length) quiz($("[data-pq]", root), list, { title: "Practice round", showModule: m === "all", summary: (c) => `<section class="card quiz"><span class="eyebrow">Round complete</span><h3>${c} of ${list.length} correct</h3><p style="margin-top:8px;color:var(--ink-2)">${c === list.length ? "Clean round. Try the advanced level or another module." : "Missed topics are on your review list. Open the lessons, then come back for another round."}</p><div class="row" style="margin-top:16px"><a class="btn primary sm" href="#/practice?m=${m}&l=${lv}&r=${Date.now()}">New round →</a><a class="btn sm" href="#/">See my knowledge map</a></div></section>` }); },
    };
  }, "practice");

  /* ---------- gap check ---------- */
  route("check", () => {
    // Two questions per module, foundation level first: enough to place someone, short enough to finish.
    const list = MODULES.flatMap((m) => { const p = QUESTIONS.filter((q) => q.module === m.id); const a = p.filter((q) => q.level === 1); return (a.length >= 2 ? a : p).slice().sort(() => Math.random() - .5).slice(0, 2); });
    return {
      title: "Find my gaps",
      html: `${head("Find my gaps · about 5 minutes", "Where do you stand?", `${list.length} questions, two per area. You get a knowledge map and a personal plan: what to learn first, and what you can skip.`)}<div data-cq></div>${foot}`,
      mount(root) {
        quiz($("[data-cq]", root), list, { title: "Gap check", showModule: true, summary: (c, res) => {
          const per = MODULES.map((m) => { const idx = list.map((q, j) => (q.module === m.id ? j : -1)).filter((j) => j >= 0); const ok = idx.filter((j) => res[j]).length; return { m, ok, n: idx.length }; });
          const weak = per.filter((x) => x.ok < x.n).sort((a, b) => a.ok - b.ok);
          return `<section class="night result"><span class="eyebrow">Your result</span><h2>${c} of ${list.length} correct</h2><p style="margin-top:8px">${weak.length ? `Start with ${esc(weak[0].m.title)}${weak[1] ? `, then ${esc(weak[1].m.title)}` : ""}. Areas you answered fully are good to skip for now.` : "No gaps found at foundation level. Move on to advanced practice."}</p>
            <div class="row" style="margin-top:20px">${weak.length ? `<a class="btn brass" href="${nextLesson(weak[0].m.id).href}">Start: ${esc(nextLesson(weak[0].m.id).name)} ${ic("arrow")}</a>` : `<a class="btn brass" href="#/practice?l=2">Advanced practice ${ic("arrow")}</a>`}<a class="btn ghost-night" href="#/">See my knowledge map</a></div></section>
            <div class="h2"><div><h2>Your personal plan</h2><p>Ordered by priority.</p></div></div>
            <div class="lessons">${per.sort((a, b) => a.ok / a.n - b.ok / b.n).map((x, j) => `<a class="card lrow lift" href="#/learn/${x.m.id}"><span class="n" style="${x.ok === x.n ? "background:var(--good);border-color:var(--good);color:#fff" : ""}">${x.ok === x.n ? "✓" : j + 1}</span><div><b>${esc(x.m.title)}</b><span>${x.ok === x.n ? "Solid at foundation level: optional" : `Learn first: ${esc(nextLesson(x.m.id).name)}`}</span></div><em>${x.ok}/${x.n}</em><span class="chip ${x.ok === x.n ? "good" : x.ok ? "warn" : "risk"}">${x.ok === x.n ? "Solid" : x.ok ? "Partial" : "Gap"}</span></a>`).join("")}</div>`;
        } });
      },
    };
  }, "check");

  /* ---------- route simulator ---------- */
  const routeOf = (v, intel, xb) => {
    const low = intel ? L.lowIntellectual : L.lowGoods, k = v <= low ? "direct" : v < L.international ? "comp" : "intl";
    const extra = [];
    if (k === "comp" && v < L.publicPrices) extra.push(`Below ${euro(L.publicPrices)}, public prices of three or more suppliers may be compared instead of inviting offers.`);
    if (k === "comp" && xb && v >= L.legalReview) extra.push("Extrabudgetary funding: a Legal Compliance Review by DLAPIL is required (5 working days).");
    if (v > L.legalReview) extra.push(`E-procurement is mandatory above ${euro(L.legalReview)} (since 1 April 2026).`);
    if (k === "intl") extra.push("The Tenders Board is competent. Publication lasts at least three weeks; complaints within 30 days.");
    return { k, extra, name: { direct: "Direct award", comp: "Competitive bidding", intl: "International public call" }[k] };
  };
  route("tools/route", (qs) => {
    const v0 = Math.max(0, +(qs.get("v") || 25000));
    const RC = [
      ["direct", "Direct award", "--m2", () => `Up to ${euro(L.lowGoods)} · ${euro(L.lowIntellectual)} for intellectual services`, [["Competition", "None: one supplier is chosen"], ["Who decides", "CCM, on a justified memorandum"], ["Key document", "Justified memorandum"]], "procurement/thresholds-procedure"],
      ["comp", "Competitive bidding", "--m1", () => `Above the direct-award limit, below ${euro(L.international)}`, [["Competition", `At least 3 suppliers invited`], ["Who decides", "CCM"], ["Extrabudgetary", `${euro(L.legalReview)}+: Legal Compliance Review by DLAPIL`]], "procurement/tender-design"],
      ["intl", "International public call", "--m3", () => `${euro(L.international)} and above`, [["Competition", "Open international call for tenders"], ["Who decides", "Tenders Board"], ["Publication", "At least 3 weeks"]], "procurement/authorise-launch"],
    ];
    const max = 300000, toPos = (v) => Math.sqrt(v / max) * 100, fromPos = (p) => Math.round(((p / 100) ** 2 * max) / 500) * 500;
    return {
      title: "Route simulator",
      html: `${head("Tools · Procurement", "Which procedure applies?", "Move the value of the whole purchase (excluding VAT, full contract period). The route, the decision-maker and the extra controls update as you cross each threshold.")}
        <section class="card sim" data-sim>
          <div class="sim-in"><div><small style="color:var(--muted);font-size:13px">Estimated value</small><div class="sim-val" data-out>${euro(v0)}<small>excl. VAT</small></div></div>
            <div class="row"><div class="seg" role="group" aria-label="Type of purchase"><button type="button" aria-pressed="true" data-t="g">Goods, services, works</button><button type="button" aria-pressed="false" data-t="i">Intellectual services</button></div>
            <label class="chip" style="height:42px;padding:0 14px;cursor:pointer"><input type="checkbox" data-x> Extrabudgetary</label></div></div>
          <input type="range" min="0" max="100" step="0.1" value="${toPos(v0)}" data-r aria-label="Estimated value">
          <div class="ticks" data-ticks></div>
          <div class="routes">${RC.map(([k, t, c, band, rows, les]) => `<article class="route" data-col="${k}" style="--c:var(${c})"><small>${band()}</small><h3>${t}</h3><dl>${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${rich(b)}</dd></div>`).join("")}</dl><a href="#/learn/${les}" style="display:inline-block;margin-top:14px;font-size:13px;font-weight:600;color:var(--accent);text-decoration:none">Learn this route →</a></article>`).join("")}</div>
          <div class="verdict" data-v aria-live="polite"></div><ul class="notes" data-n></ul>
        </section>
        <div class="h2"><div><h2>All thresholds</h2><p>The numbers behind the simulator.</p></div></div>
        <div class="grid g4">${[[L.lowGoods, "Direct award · goods & services"], [L.lowIntellectual, "Direct award · intellectual services"], [L.publicPrices, "Public prices may be compared below"], [L.grant, "Grants: call for proposals from"], [L.legalReview, "E-procurement · DLAPIL review (XB)"], [L.international, "International public call · Tenders Board"]].map(([v, t]) => `<div class="fig"><b>${euro(v)}</b><span>${rich(t)}</span></div>`).join("")}</div>${foot}`,
      mount(root) {
        const box = $("[data-sim]", root), r = $("[data-r]", box);
        let intel = false;
        const ticks = () => { const low = intel ? L.lowIntellectual : L.lowGoods; const a = toPos(low), b = toPos(L.international);
          r.style.setProperty("--a", a + "%"); r.style.setProperty("--b", b + "%");
          $("[data-ticks]", box).innerHTML = [[low, a], [L.legalReview, toPos(L.legalReview)], [L.international, b]].map(([v, p]) => `<span style="left:${p}%">${euro(v)}</span>`).join(""); };
        const upd = () => {
          const v = fromPos(+r.value), x = $("[data-x]", box).checked, o = routeOf(v, intel, x);
          $("[data-out]", box).innerHTML = `${euro(v)}<small>excl. VAT</small>`;
          $$("[data-col]", box).forEach((c) => c.classList.toggle("on", c.dataset.col === o.k));
          $("[data-v]", box).innerHTML = `<b>${euro(v)} → ${o.name}.</b> ${o.k === "direct" ? "Keep a justified memorandum and do not split a foreseeable need to stay under the limit." : o.k === "comp" ? "Invite at least three suppliers and keep the evaluation trail." : "Prepare the tender file for the Tenders Board early: publication alone takes three weeks."}`;
          $("[data-n]", box).innerHTML = o.extra.map((e) => `<li>${rich(e)}</li>`).join("");
          history.replaceState(null, "", `#/tools/route?v=${v}`);
        };
        const onClick = (e) => { const t = e.target.closest("[data-t]"); if (!t) return; intel = t.dataset.t === "i"; $$("[data-t]", box).forEach((b) => b.setAttribute("aria-pressed", b === t)); ticks(); upd(); };
        box.addEventListener("input", upd); box.addEventListener("click", onClick); ticks(); upd();
      },
    };
  }, "tools");

  route("tools", () => ({
    title: "Tools",
    html: `${head("Tools", "Calculate, check, decide", "Small tools that answer one question each. Every result links to the lesson behind it.")}
      <div class="grid g3">${[["scale", "Route simulator", "Value and type → procedure, decision-maker and extra controls.", "#/tools/route"], ["help", "I'm stuck", "Pick what blocks you; get the one page that unblocks it.", "#/stuck"], ["book", "Glossary", `${TERMS.length} terms and abbreviations used across the guide.`, "#/glossary"], ["map", "Find my gaps", "A 5-minute check that builds your knowledge map.", "#/check"], ["practice", "Practice cases", `${QUESTIONS.length} questions with feedback, weakest first.`, "#/practice"], ["spark", "First-day tour", "How money moves through a project in seven stops.", "#/tour"]].map(([i, t, d, h]) => `<a class="card path lift" href="${h}" style="--c:var(--accent)"><span class="ico">${ic(i)}</span><div><h3>${t}</h3><p>${d}</p></div><span class="meta">Open →</span></a>`).join("")}</div>${foot}`,
  }), "tools");

  /* ---------- I'm stuck ---------- */
  route("stuck", () => ({
    title: "I'm stuck",
    html: `${head("Help", "What is blocking you?", "Choose the closest description. Each answer opens the one place that resolves it.")}
      <div class="stuck">${[
        ["book", "I don't understand a term", "Abbreviations and concepts, in plain words.", "#/glossary"],
        ["scale", "I don't know which procedure applies", "Enter the value and get the route.", "#/tools/route"],
        ["doc", "I don't know which documents I need", "PO file and payment file lessons list them.", "#/learn/brief/po-file"],
        ["people", "I don't know who approves", "Roles, funding and who decides what.", "#/learn/procurement/roles-funding"],
        ["cal", "I don't know which year to charge", "Delivery date decides the financial year.", "#/learn/brief/year-end"],
        ["trend", "My budget has changed", "Forecast first, then the right revision route.", "#/learn/brief/foma-forecast"],
        ["plane", "I need to travel", "Authorisation comes before the mission.", "#/learn/brief/foma"],
        ["folder", "I can't find a system or template", "Links to every system and template.", "#/learn/brief/links"],
        ["search", "Something else", "Search everything: rules, lessons, terms.", "#search"],
      ].map(([i, t, d, h]) => `<a class="card lift" href="${h}"><span class="ico">${ic(i)}</span><div><b>${t}</b><span>${d}</span></div>${ic("arrow")}</a>`).join("")}</div>${foot}`,
    mount(root) { const f = (e) => { const a = e.target.closest('a[href="#search"]'); if (a) { e.preventDefault(); openPalette(); } }; root.addEventListener("click", f); return () => root.removeEventListener("click", f); },
  }), "stuck");

  /* ---------- glossary ---------- */
  route("glossary", () => ({
    title: "Glossary",
    html: `${head("Reference", "Glossary", "Every term below is also explained in place: click any dotted word in a lesson.")}
      <div class="gl">${TERMS.slice().sort((a, b) => a.k.localeCompare(b.k)).map((t) => `<div id="t-${slug(t.k)}"><b>${esc(t.k)}</b>${t.n !== t.k ? `<em>${esc(t.n)}</em>` : ""}<p>${esc(t.d)}</p><p style="margin-top:8px;font-size:12.5px;color:var(--muted)">Used in ${LESSONS.filter((l) => termsIn(JSON.stringify(l.data)).includes(t.k)).length} lessons</p></div>`).join("")}</div>${foot}`,
  }), "tools");

  /* ---------- term popover ---------- */
  let pop = null;
  const closePop = () => { if (pop) { pop.remove(); pop = null; } };
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-term]");
    if (!t) { if (pop && !e.target.closest(".pop")) closePop(); return; }
    e.preventDefault(); closePop();
    const g = TERM[t.dataset.term]; if (!g) return;
    pop = document.createElement("div"); pop.className = "pop"; pop.setAttribute("role", "tooltip");
    pop.innerHTML = `<b>${esc(g.k)}${g.n !== g.k ? ` · ${esc(g.n)}` : ""}</b><p>${esc(g.d)}</p>`;
    document.body.append(pop);
    const r = t.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + "px";
    pop.style.top = (r.bottom + h + 12 > innerHeight ? r.top - h - 8 : r.bottom + 8) + "px";
  });
  addEventListener("scroll", closePop, { passive: true });

  /* ---------- search palette ---------- */
  const INDEX = [];
  LESSONS.forEach((l) => {
    INDEX.push({ k: "Lesson", i: MOD[l.module].icon, t: l.title, s: `${MOD[l.module].title} · ${l.short}`, h: l.href, x: [l.name, l.short, l.data.lead, l.data.understand, l.data.do].join(" ") });
    (l.data.sections || []).forEach(([h, b]) => INDEX.push({ k: "Topic", i: "doc", t: h, s: `${l.title}`, h: l.href, x: typeof b === "string" ? b : [b.lead, ...(b.items || []).flat(), ...(b.must || [])].join(" ") }));
    (l.data.keyFacts || []).concat(l.data.figures || []).forEach(([v, lab]) => INDEX.push({ k: "Figure", i: "flag", t: `${v} — ${lab}`, s: l.title, h: l.href, x: `${v} ${lab}` }));
  });
  TERMS.forEach((t) => INDEX.push({ k: "Term", i: "book", t: t.k === t.n ? t.k : `${t.k} · ${t.n}`, s: t.d, h: `#/glossary`, x: t.d, term: t }));
  [["Route simulator", "Which procedure applies to my purchase?", "#/tools/route"], ["Find my gaps", "5-minute knowledge check", "#/check"], ["Practice cases", "Questions with feedback", "#/practice"], ["First-day tour", "How money moves through a project", "#/tour"], ["I'm stuck", "Help me find the right page", "#/stuck"]].forEach(([t, s, h]) => INDEX.push({ k: "Tool", i: "tool", t, s, h, x: s }));
  INDEX.forEach((e) => { e.lt = e.t.toLowerCase(); e.lx = (e.t + " " + e.s + " " + e.x).toLowerCase(); });

  const parseAmount = (q) => { const m = q.replace(/[, ]/g, "").match(/€?(\d+(?:\.\d+)?)(k|m)?/i); if (!m) return null; let v = parseFloat(m[1]); if (/k/i.test(m[2] || "")) v *= 1e3; if (/m/i.test(m[2] || "")) v *= 1e6; return v >= 100 ? v : null; };
  function directAnswer(q) {
    const ql = q.toLowerCase(), v = parseAmount(q);
    if (v && !/^\d{1,2}$/.test(q.trim())) {
      const intel = /consult|intellect|expert|study|training|advis/.test(ql);
      if (/grant/.test(ql)) return `<small>Direct answer · grants</small><p><b>${euro(v)} → ${v < L.grant ? "Direct award of a grant" : "Call for proposals"}.</b> The call for proposals applies from ${euro(L.grant)}.</p>`;
      const o = routeOf(v, intel, /extra|xb|donor|eu/.test(ql));
      return `<small>Direct answer · procurement${intel ? " · intellectual services" : ""}</small><p><b>${euro(v)} → ${o.name}.</b> ${o.extra.map(esc).join(" ")}</p><p style="margin-top:8px"><a href="#/tools/route?v=${Math.round(v)}" style="color:var(--brass-2);font-weight:600;text-decoration:none">Open in the simulator →</a></p>`;
    }
    if (/threshold|limit|ceiling|how much/.test(ql)) return `<small>Direct answer · thresholds</small><p>Direct award up to <b>${euro(L.lowGoods)}</b> (<b>${euro(L.lowIntellectual)}</b> intellectual services) · e-procurement and DLAPIL review (XB) from <b>${euro(L.legalReview)}</b> · international call from <b>${euro(L.international)}</b> · grants: call from <b>${euro(L.grant)}</b>.</p>`;
    const t = TERMS.find((x) => x.k.toLowerCase() === ql.trim() || x.n.toLowerCase() === ql.trim());
    if (t) return `<small>Definition · ${esc(t.k)}</small><p><b>${esc(t.n)}.</b> ${esc(t.d)}</p>`;
    return "";
  }
  function search(q) {
    const toks = q.toLowerCase().split(/\s+/).filter((x) => x.length > 1 && !/^€?\d/.test(x));
    if (!toks.length) return [];
    return INDEX.map((e) => { let sc = 0; for (const t of toks) { if (!e.lx.includes(t)) return null; sc += e.lt.includes(t) ? (e.lt.startsWith(t) ? 6 : 4) : 1; } sc += { Lesson: 3, Tool: 3, Term: 2, Figure: 1, Topic: 0 }[e.k]; return [sc, e]; }).filter(Boolean).sort((a, b) => b[0] - a[0]).slice(0, 24).map((x) => x[1]);
  }
  const hl = (s, q) => { let h = esc(s); q.toLowerCase().split(/\s+/).filter((x) => x.length > 1).forEach((t) => { h = h.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"), "<mark>$1</mark>"); }); return h; };
  function openPalette(seed = "") {
    if ($(".scrim")) return;
    const sc = document.createElement("div"); sc.className = "scrim";
    sc.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="Search"><header>${ic("search")}<input type="search" placeholder="Search a rule, an amount (e.g. 40k consultant), a term…" aria-label="Search" value="${esc(seed)}"><kbd>Esc</kbd></header><div class="res" role="listbox"></div><footer><span>↑↓ to move</span><span>↵ to open</span><span>Try: "€40k", "DLAPIL", "year-end", "gift"</span></footer></div>`;
    document.body.append(sc);
    const inp = $("input", sc), res = $(".res", sc); let sel = 0, hits = [];
    const sugg = () => `<div class="grp">Start here</div>${[["Lesson", "spark", "First-day tour", "How money moves through a project", "#/tour"], ["Tool", "scale", "Which procedure applies?", "Route simulator", "#/tools/route"], ["Tool", "map", "Find my gaps", "5-minute check", "#/check"], ["Tool", "help", "I'm stuck", "Help me find the right page", "#/stuck"]].map(([k, i, t, s, h], j) => `<a class="hit" href="${h}" data-hit="${j}" aria-selected="${j === 0}"><span class="k">${ic(i)}</span><span><b>${t}</b><span>${s}</span></span></a>`).join("")}`;
    const draw = () => {
      const q = inp.value.trim(); sel = 0;
      if (!q) { res.innerHTML = sugg(); hits = $$("[data-hit]", res); return; }
      const ans = directAnswer(q), r = search(q);
      let html = ans ? `<div class="answer">${ans}</div>` : "", last = "";
      r.forEach((e, j) => { if (e.k !== last) { html += `<div class="grp">${e.k}s</div>`; last = e.k; } html += `<a class="hit" href="${e.h}" data-hit="${j}" aria-selected="${j === 0}"><span class="k">${ic(e.i)}</span><span><b>${hl(e.t, q)}</b><span>${hl(e.s, q)}</span></span></a>`; });
      res.innerHTML = html || `<div class="empty">No match for “${esc(q)}”. Try a shorter word, or <a href="#/stuck" style="color:var(--accent)">tell us what blocks you</a>.</div>`;
      hits = $$("[data-hit]", res);
    };
    const mark = () => hits.forEach((h, j) => { h.setAttribute("aria-selected", j === sel); if (j === sel) h.scrollIntoView({ block: "nearest" }); });
    const close = () => { sc.remove(); document.removeEventListener("keydown", key, true); };
    const key = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === "Enter" && hits[sel]) { e.preventDefault(); const h = hits[sel].getAttribute("href"); close(); go(h); }
    };
    let t; inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(draw, 60); });
    document.addEventListener("keydown", key, true);
    sc.addEventListener("click", (e) => { if (e.target === sc) close(); else if (e.target.closest("a")) close(); });
    draw(); inp.focus(); inp.select();
  }

  /* ---------- chrome ---------- */
  function sideMeter() { const el = $("#meter"); if (el) { const n = reviewList().length; el.innerHTML = `<i class="${overall() ? "on" : ""}"></i><span><b>My progress · ${overall()}%</b><small>${Object.keys(S.done).length} lessons done · ${n} to review</small></span>${ic("arrow")}`; } }
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2200); }
  const NAV = [["home", "#/", "Home"], ["learn", "#/learn", "Learn"], ["practice", "#/practice", "Practise"], ["check", "#/check", "Find my gaps", "map"], ["tools", "#/tools", "Tools", "tool"]];
  $("#side").innerHTML = NAV.map(([k, h, t]) => `<a href="${h}" data-nav="${k}">${t}</a>`).join("") + `<a href="#/glossary" data-nav="glossary">Glossary</a>`;
  $("#tabbar").innerHTML = NAV.map(([k, h, t, i]) => `<a href="${h}" data-nav="${k}">${ic(i || k)}${t.replace("Find my gaps", "Gaps")}</a>`).join("");
  $("#searchBtn").innerHTML = `${ic("search")}<span>Search rules, amounts, terms…</span><kbd>Ctrl K</kbd>`;
  $("#searchBtn").addEventListener("click", () => openPalette());
  $("#stuckBtn").innerHTML = `${ic("help")}<span>I'm stuck</span>`;
  $("#themeBtn").innerHTML = ic("moon");
  const applyTheme = () => { if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme; };
  $("#themeBtn").addEventListener("click", () => { const dark = S.theme ? S.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; S.theme = dark ? "light" : "dark"; save(); applyTheme(); });
  applyTheme();
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); } else if (e.key === "/" && !e.target.closest("input,textarea")) { e.preventDefault(); openPalette(); } else if (e.key === "Escape") closePop(); });
  addEventListener("hashchange", render);
  render();
  window.FGA = { LESSONS, QUESTIONS, MODULES, routeOf, mastery, search, directAnswer, state: () => S };
})();
