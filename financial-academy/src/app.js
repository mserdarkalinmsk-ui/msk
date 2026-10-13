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
  const BRIEF_MODULE = { "po-file": "payment", "payment-file": "payment", "petty-cash": "payment", vat: "payment", "year-end": "yearend", "foma-forecast": "forecast", "foma-reports": "reporting", "foma-addendum": "forecast", foma: "mission", events: "mission", filing: "filing" };
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
  Object.entries(D.briefs).forEach(([k, b]) => {
    const id = k.replace(/\//g, "-"), mod = BRIEF_MODULE[id]; if (!mod) return;
    LESSONS.push({ key: `brief/${id}`, module: mod, kind: "brief", title: b.title, name: b.title, short: b.remember || b.lead, minutes: 3, href: `#/learn/brief/${id}`, data: b });
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
    const firstLesson = PATHS.procurement.lessons[0];
    const glass = resume
      ? `<div class="glass"><small>Continue learning</small><b>${esc(resume.title)}</b><p>${esc(MOD[resume.module].title)} · ${resume.minutes} min</p><div class="bar" style="--c:var(--brass-2)"><i style="--w:${mastery(resume.module).v}%"></i></div><a href="${resume.href}">Resume lesson →</a></div>`
      : lv === "pro"
        ? `<div class="glass"><small>Check a route</small><b>Which procedure applies?</b><p>Enter a value; see the route, approvals and extra controls.</p><a href="#/tools/route">Open the route simulator →</a></div>`
        : `<div class="glass"><small>New here? Start here</small><b>Your first day in 10 minutes</b><p>How money moves through a Council of Europe project, in seven stops.</p><a href="#/tour">Start the tour →</a></div>`;
    const levels = [
      ["new", "01", "I'm new to this", "Start with the 10-minute tour, then learn step by step."],
      ["some", "02", "I know the basics", "Find your gaps with a short check, then practise."],
      ["pro", "03", "I have a case to handle", "Go straight to routes, rules and documents."],
    ];
    const primary = lv === "pro" ? ["#/tools/route", "Check my route"] : lv === "some" ? ["#/check", "Find my gaps · 5 min"] : ["#/tour", "Start the first-day tour"];
    const secondary = lv === "some" ? ["#/practice", "Practise with cases"] : lv === "pro" ? ["#/stuck", "I'm stuck"] : ["#/check", "Find my gaps"];
    const map = `<div class="kmap">${MODULES.map((m) => { const x = mastery(m.id); return `<a class="kcell" href="#/learn/${m.id}" style="--c:var(${m.c})"><header><div><b>${esc(m.title)}</b><small style="display:block">${x.done}/${x.total} lessons</small></div>${ring(x.v, `var(${m.c})`)}</header><span class="state ${x.state}">● ${stateLabel[x.state]}</span></a>`; }).join("")}</div>`;
    return {
      title: "Home",
      html: `
      <section class="night hero">
        <div class="hero-grid"><div>
          <span class="eyebrow">Council of Europe · Financial Guide</span>
          <h1>Learn the rules. <em>Then</em> handle the case.</h1>
          <p class="lead">A guided academy for project finance: short lessons, real cases with feedback, and tools that tell you which route, approvals and documents apply.</p>
          <div class="row"><a class="btn brass" href="${primary[0]}">${primary[1]} ${ic("arrow")}</a><a class="btn ghost-night" href="${secondary[0]}">${secondary[1]}</a></div>
        </div>${glass}</div>
        <div class="stats"><div><b>${LESSONS.length}</b><span>short lessons</span></div><div><b>${QUESTIONS.length}</b><span>questions & real cases</span></div><div><b>${TERMS.length}</b><span>terms explained in context</span></div><div><b>${ov}%</b><span>your overall mastery</span></div></div>
      </section>

      <div class="h2"><div><h2>How familiar are you with project finance?</h2><p>The guide adapts what it puts first. You can change this at any time.</p></div></div>
      <div class="level">${levels.map(([k, n, t, d]) => `<button type="button" data-level="${k}" aria-pressed="${lv === k}"><i>${n}</i><b>${t}</b><span>${d}</span></button>`).join("")}</div>

      ${rv.length ? `<div class="h2"><div><h2>To review</h2><p>Topics where your last answer was wrong. One short lesson fixes each.</p></div></div>
        <div class="review"><span class="badge">${rv.length}</span><div><b>${rv.slice(0, 3).map((k) => esc(LESSON[k].title)).join(" · ")}${rv.length > 3 ? ` · +${rv.length - 3}` : ""}</b><p>Re-read the lesson, then answer its check again to clear it.</p></div><a class="btn sm" href="${LESSON[rv[0]].href}">Review now →</a></div>` : ""}

      <div class="h2"><div><h2>Your knowledge map</h2><p>${ov ? "Computed from the lessons you completed and the questions you answered." : "Empty for now. Take the 5-minute check to see where you stand."}</p></div><a href="#/check">Find my gaps →</a></div>
      ${map}

      <div class="h2"><div><h2>What do you need to do?</h2><p>Have a real task? Each one opens the lesson or tool you need.</p></div></div>
      <div class="tasks">${TASKS.map(([i, t, d, h]) => `<a class="card task" href="${h}"><span class="ico">${ic(i)}</span><b>${t}</b><span>${d}</span><u>${ic("arrow")}</u></a>`).join("")}</div>
      ${foot}`,
      mount(root) {
        const onClick = (e) => { const b = e.target.closest("[data-level]"); if (!b) return; S.level = b.dataset.level; save(); render(); };
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
  route("learn/:mod", (mod) => {
    const m = MOD[mod]; if (!m) return { html: notFound() };
    const x = mastery(mod), p = PATHS[mod], ls = lessonsOf(mod), nl = nextLesson(mod);
    const row = (l, k) => { const t = S.score[l.key]; return `<a class="card lrow lift${S.done[l.key] ? " done" : ""}" href="${l.href}"><span class="n">${S.done[l.key] ? "✓" : k + 1}</span><div><b>${esc(l.title)}</b><span>${esc(l.short)}</span></div><em>${l.minutes} min</em>${S.review[l.key] ? `<span class="chip warn">Review</span>` : t ? `<span class="chip good">${t.c}/${t.c + t.w}</span>` : `<span class="chip">${countQ(l.key)} Q</span>`}</a>`; };
    const groups = p ? p.phases.map(([t, names], pi) => `<section class="phase"><h3><i>0${pi + 1}</i>${esc(t)}</h3><div class="lessons">${names.map((nm) => { const l = p.lessons.find((y) => y.name === nm); return l ? row(l, p.lessons.indexOf(l)) : ""; }).join("")}</div></section>`).join("") : `<div class="lessons">${ls.map(row).join("")}</div>`;
    return {
      title: m.title,
      html: `<div class="crumbs"><a href="#/learn">Learn</a><span>/</span><span>${esc(m.title)}</span></div>
        <div class="card night pad" style="margin-top:14px;padding:30px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center">
          <div><span class="eyebrow">Learning path · ${ls.length} lessons · ${ls.reduce((a, l) => a + l.minutes, 0)} min</span><h1 style="margin-top:10px;font-size:clamp(30px,3.4vw,40px)">${esc(m.title)}</h1><p style="margin-top:8px">${esc(m.sub)}. ${stateLabel[x.state]}: ${x.done} of ${x.total} lessons done${x.att ? `, ${x.att} answers given` : ""}.</p>
          <div class="row" style="margin-top:20px"><a class="btn brass" href="${nl.href}">${x.done ? "Continue" : "Start"}: ${esc(nl.name)} ${ic("arrow")}</a><a class="btn ghost-night" href="#/practice?m=${mod}">Practise ${countQM(mod)} questions</a></div></div>
          <span class="ring" style="--p:${x.v};--c:var(--brass-2);width:96px;height:96px" data-v="${x.v}%"></span></div>
        ${groups}${foot}`,
    };
  }, "learn");
  const countQ = (k) => QUESTIONS.filter((q) => q.topic === k).length;
  const countQM = (m) => QUESTIONS.filter((q) => q.module === m).length;
  const notFound = () => `${head("Not found", "This page does not exist", "")}<a class="btn" href="#/">Back home</a>`;

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
        ${sections ? `<section class="deep"><div class="h2" style="margin-top:0"><div><h2>Go deeper</h2><p>${(s.sections || []).length} topics. Open each one; it is marked as read.</p></div></div>${sections}</section>` : ""}
        ${s.warning || s.best ? `<div class="pitfalls">${s.warning ? `<div class="bad"><h4>Common mistake</h4><p>${rich(s.warning)}</p></div>` : ""}${s.best ? `<div class="ok"><h4>Good practice</h4><p>${rich(s.best)}</p></div>` : ""}</div>` : ""}
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
        return () => root.removeEventListener("click", onClick);
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
  function sideMeter() { const el = $("#meter"); if (el) el.innerHTML = `<small>Overall mastery</small><b class="num">${overall()}%</b>${bar(overall())}<small style="margin-top:8px">${Object.keys(S.done).length} lessons · ${reviewList().length} to review</small>`; }
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2200); }
  const NAV = [["home", "#/", "Home"], ["learn", "#/learn", "Learn"], ["practice", "#/practice", "Practise"], ["check", "#/check", "Find my gaps", "map"], ["tools", "#/tools", "Tools", "tool"]];
  $("#side").innerHTML = `<h6>Academy</h6>${NAV.map(([k, h, t, i]) => `<a href="${h}" data-nav="${k}">${ic(i || k)}${t}</a>`).join("")}
    <h6>Learning paths</h6>${MODULES.map((m) => `<a href="#/learn/${m.id}">${ic(m.icon)}${m.title}<em>${lessonsOf(m.id).length}</em></a>`).join("")}
    <h6>Reference</h6><a href="#/glossary" data-nav="glossary">${ic("book")}Glossary</a><a href="#/stuck" data-nav="stuck">${ic("help")}I'm stuck</a>
    <div class="meter" id="meter"></div>`;
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
