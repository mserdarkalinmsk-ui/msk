/* Core: helpers, persistent store, router, shell (navigation, search, My Case, theme). */
(function () {
  "use strict";
  const C = window.FG_CONTENT;
  const FG = (window.FG = { routes: [], nav: [], index: [] });

  /* ---------- helpers ---------- */
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const euro = (n, digits = 0) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(n) || 0);
  const pct = (n, d = 0) => (n == null || !Number.isFinite(n) ? "—" : `${Number(n).toFixed(d)}%`);
  const slug = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  Object.assign(FG, { C, esc, euro, pct, slug, $, $$, fmtDate });

  // Ordered path of a case, used for the home journey and the "next step" bar on each module.
  FG.JOURNEY = [
    { title: "Plan the need", sub: "Procurement or grant route", path: "procurement", sections: ["procurement", "grants"] },
    { title: "Decide the route", sub: "Engines for your case", path: "engines", sections: ["engines"] },
    { title: "Commit", sub: "PO file & signatures", path: "po-file", sections: ["po-file", "foma"] },
    { title: "Pay", sub: "Delivery, invoice, payment", path: "payment-file", sections: ["payment-file", "petty-cash"] },
    { title: "Report & forecast", sub: "Position, variance, revision", path: "foma/reports", sections: ["foma-reports", "foma-forecast", "analysis"] },
    { title: "Close the year", sub: "Cut-off and PO finalisation", path: "year-end", sections: ["year-end"] },
    { title: "File & audit", sub: "Evidence trail", path: "filing", sections: ["filing"] },
  ];
  // Each area has its own colour; views read it through --accent.
  FG.TONES = { home: 1, engines: 4, analysis: 6, procurement: 1, grants: 4, "po-file": 5, foma: 5, "payment-file": 2, "petty-cash": 3, "foma-reports": 5, "foma-forecast": 3, "year-end": 3, filing: 2, scenarios: 4, roles: 1, links: 1, rules: 4, glossary: 5 };

  /* ---------- store: localStorage when available, memory otherwise ---------- */
  const KEY = "fg.v15";
  let memory = {};
  try { memory = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { memory = {}; }
  FG.store = {
    get(path, fallback) { return path in memory ? memory[path] : fallback; },
    set(path, value) {
      memory[path] = value;
      try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* private mode: keep in memory */ }
    },
  };
  // Checklist ticks keyed by a stable id; returns the current set.
  FG.ticks = (id) => FG.store.get("ticks:" + id, {});
  FG.tick = (id, key, on) => { const t = { ...FG.ticks(id) }; if (on) t[key] = 1; else delete t[key]; FG.store.set("ticks:" + id, t); return t; };

  /* ---------- UI fragments shared by views ---------- */
  FG.ui = {
    head(eyebrow, title, lead, actions = "") {
      return `<header class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${lead ? `<p>${esc(lead)}</p>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</header>`;
    },
    tag: (text, tone = "") => `<span class="tag ${tone}">${esc(text)}</span>`,
    callout: (tone, title, text, icon = tone === "warn" ? "!" : tone === "good" ? "✓" : "i") => `<div class="callout ${tone}"><i aria-hidden="true">${icon}</i><div>${title ? `<b>${esc(title)}</b>` : ""}${esc(text)}</div></div>`,
    kpis: (items) => `<div class="kpis">${items.map((k) => `<div class="kpi"><small>${esc(k[0])}</small><b class="${String(k[1]).length > 14 ? "text" : ""}">${esc(k[1])}</b>${k[2] ? `<span>${esc(k[2])}</span>` : ""}</div>`).join("")}</div>`,
    bar: (value, tone = "") => `<div class="bar ${tone}"><i style="width:${Math.max(0, Math.min(100, value || 0))}%"></i></div>`,
    // A persisted checklist. items: [[title, detail?], ...]
    checklist(id, items, title = "Checklist") {
      const t = FG.ticks(id), done = items.filter((_, i) => t[i]).length, p = Math.round((done / Math.max(1, items.length)) * 100);
      return `<div class="card" data-checklist="${esc(id)}"><div class="card-head"><h3>${esc(title)}</h3><small>${done} / ${items.length}</small></div><div class="card-body"><div class="progress-head"><span>${p}% complete</span>${done ? `<button class="btn ghost sm" data-reset-checklist>Reset</button>` : ""}</div>${FG.ui.bar(p, p === 100 ? "good" : "")}<div class="checklist mt">${items.map((it, i) => {
        const [a, b] = Array.isArray(it) ? it : [it];
        return `<label class="check ${t[i] ? "done" : ""}"><input type="checkbox" data-i="${i}" ${t[i] ? "checked" : ""}><div><b>${esc(a)}</b>${b ? `<small>${esc(b)}</small>` : ""}</div></label>`;
      }).join("")}</div></div></div>`;
    },
    seg(name, options, value) {
      return `<div class="seg" role="group" data-seg="${esc(name)}">${options.map(([v, label]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(label)}</button>`).join("")}</div>`;
    },
    select(name, options, value, label, hint) {
      return `<label class="field"><span>${esc(label)}</span><select class="input" name="${esc(name)}">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
    },
    number(name, value, label, hint) {
      return `<label class="field"><span>${esc(label)}</span><input class="input" type="number" inputmode="decimal" min="0" step="any" name="${esc(name)}" value="${esc(value)}">${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
    },
    pairs: (list) => `<div class="pairs">${list.map(([d, a]) => `<div><div class="do">${esc(d)}</div><div class="dont">${esc(a)}</div></div>`).join("")}</div>`,
    flowHeader(stages, active, labelOf) {
      return `<div class="flow" role="group">${stages.map((s, i) => `<button type="button" data-flow="${i}" aria-pressed="${i === active}">${labelOf(s, i)}</button>`).join("")}</div>`;
    },
  };

  // Delegated behaviour for persisted checklists and segmented controls inside a view root.
  FG.bindCommon = function (root, onChange) {
    root.addEventListener("change", (e) => {
      const box = e.target.closest("[data-checklist] input[type=checkbox]");
      if (!box) return;
      const host = box.closest("[data-checklist]");
      FG.tick(host.dataset.checklist, box.dataset.i, box.checked);
      FG.refresh();
    });
    root.addEventListener("click", (e) => {
      const reset = e.target.closest("[data-reset-checklist]");
      if (reset) { FG.store.set("ticks:" + reset.closest("[data-checklist]").dataset.checklist, {}); FG.refresh(); return; }
      const seg = e.target.closest("[data-seg] button");
      if (seg) {
        const group = seg.closest("[data-seg]");
        $$("button", group).forEach((b) => b.setAttribute("aria-pressed", String(b === seg)));
        if (onChange) onChange(group.dataset.seg, seg.dataset.v);
      }
    });
  };

  /* ---------- decision result rendering (shared by all engines) ---------- */
  FG.renderDecision = function (r, opts = {}) {
    const ui = FG.ui;
    const scale = r.scale ? `<div class="block"><h3>Threshold position</h3><div class="scale" aria-hidden="true"><div class="track"></div><div class="pin" style="left:${Math.min(99, Math.max(1, (r.scale.value / r.scale.max) * 100))}%"></div><div class="labels">${r.scale.marks.map(([v, l]) => `<span style="left:${(v / r.scale.max) * 100}%">${esc(l)}</span>`).join("")}</div></div></div>` : "";
    const fit = r.fit ? `<div class="block"><h3>Model fit</h3><div class="fit">${r.fit.map(([n, s]) => `<div><span>${esc(n)}</span>${ui.bar((s / 12) * 100, n === r.route ? "good" : "")}<em>${s} pts</em></div>`).join("")}</div></div>` : "";
    const flags = r.flags ? `<div class="block"><h3>Control flags</h3><div class="row">${r.flags.map(([t, tone]) => ui.tag(t, tone === "neutral" ? "" : tone)).join("")}</div></div>` : "";
    const confidence = r.confidence && r.score != null ? `<div class="block"><h3>Decision confidence</h3><div class="score ${r.score >= 85 ? "good" : r.score >= 70 ? "warn" : "risk"}"><div class="ring" style="--p:${r.score}"><b>${r.score}%</b></div><div><h4>${esc(r.confidence[0])}</h4><p>${esc(r.confidence[1])}</p></div></div></div>` : "";
    return `<section class="card decision" aria-live="polite">
      <div class="decision-hero ${r.tone}"><div class="eyebrow">${esc(r.kicker)}</div><h2>${esc(r.route)}</h2><p>${esc(r.summary)}</p>
        <div class="row">${r.meta.map(([k, v]) => ui.tag(`${k}: ${v}`)).join("")}<span class="spacer"></span>${opts.save !== false ? `<button class="btn sm no-print" data-save-case>Save to My Case</button>` : ""}</div></div>
      <div class="decision-body">${ui.kpis(r.kpis)}${scale}${fit}
        <div class="block"><h3>${esc(opts.reasonsTitle || "Why this result")}</h3><div class="reasons">${r.reasons.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div></div>
        ${flags}
        ${r.docs ? `<div class="block"><h3>Required file pack</h3><div class="docs">${r.docs.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div></div>` : ""}
        ${confidence}
        <div class="block"><h3>Next actions</h3><div class="actions-list">${r.actions.map(([a, b]) => `<div><div><b>${esc(a)}</b><span>${esc(b)}</span></div></div>`).join("")}</div></div>
        ${opts.footer || ""}
      </div></section>`;
  };

  /* ---------- My Case ---------- */
  FG.case = {
    items: () => FG.store.get("case", []),
    add(item) {
      const items = FG.case.items().filter((x) => x.engine !== item.engine);
      items.unshift({ ...item, at: new Date().toISOString() });
      FG.store.set("case", items.slice(0, 20));
      FG.updateCaseBadge();
      FG.toast("Saved to My Case");
    },
    remove(i) { const items = FG.case.items(); items.splice(i, 1); FG.store.set("case", items); FG.updateCaseBadge(); FG.renderCase(); },
    clear() { FG.store.set("case", []); FG.store.set("caseNote", ""); FG.updateCaseBadge(); FG.renderCase(); },
  };
  FG.updateCaseBadge = () => { const n = FG.case.items().length, b = $("#caseCount"); if (b) { b.textContent = n; b.hidden = !n; } };
  FG.renderCase = function () {
    const items = FG.case.items(), body = $("#caseBody");
    body.innerHTML = `<p class="muted small">Decisions you save from the engines are kept here, in this browser only, so the case context follows you between modules.</p>
      <label class="field"><span>Case notes</span><textarea class="input" id="caseNote" rows="4" placeholder="Project, supplier, reference numbers, open questions…">${esc(FG.store.get("caseNote", ""))}</textarea></label>
      ${items.length ? items.map((x, i) => `<div class="case-item"><header><div><small>${esc(x.kicker)}</small><b>${esc(x.route)}</b></div><button class="icon-btn" data-remove-case="${i}" aria-label="Remove ${esc(x.route)}">×</button></header><p class="small muted mt">${esc(x.summary)}</p><div class="row mt">${x.meta.map(([k, v]) => FG.ui.tag(`${k}: ${v}`)).join("")}</div><div class="row mt"><a class="btn sm" href="#/${esc(x.path)}">Open engine</a><small>${esc(fmtDate(x.at))}</small></div></div>`).join("")
        : `<div class="empty"><b>No saved decisions yet</b>Run a decision engine and choose “Save to My Case”.</div>`}
      <div class="row"><button class="btn sm" id="casePrint">Print case summary</button><span class="spacer"></span>${items.length ? `<button class="btn ghost sm" id="caseClear">Clear case</button>` : ""}</div>`;
  };

  /* ---------- router ---------- */
  FG.route = function (pattern, def) {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$");
    FG.routes.push({ pattern, re, keys, ...def });
  };
  function match(path) {
    for (const r of FG.routes) {
      const m = path.match(r.re);
      if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
  FG.path = () => (location.hash.replace(/^#\/?/, "") || "home").split("?")[0];
  FG.go = (path) => { location.hash = "#/" + path; };

  let current = null;
  FG.refresh = function (keepScroll = true) {
    const y = window.scrollY, path = FG.path(), hit = match(path) || match("home");
    const view = hit.route.render(hit.params) || {};
    const main = $("#content"), root = document.createElement("div");
    root.innerHTML = view.html || "";
    main.replaceChildren(root);
    current = { path, hit };
    const crumbs = [["Home", "home"], ...(hit.route.crumbs ? hit.route.crumbs(hit.params) : [])];
    $("#crumbs").innerHTML = crumbs.map(([t, p], i) => (i === crumbs.length - 1 ? `<b>${esc(t)}</b>` : `<a href="#/${p}">${esc(t)}</a><span aria-hidden="true">/</span>`)).join("");
    document.title = `${crumbs[crumbs.length - 1][0]} · Financial Guide`;
    const section = hit.route.section || path.split("/")[0];
    $$(".nav a").forEach((a) => { if (a.dataset.section === section) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    FG.bindCommon(root, view.onSeg);
    if (view.mount) view.mount(root);
    if (FG.enrich) FG.enrich(root);
    document.documentElement.dataset.tone = FG.TONES[section] || 1;
    const step = FG.JOURNEY.findIndex((j) => j.sections.includes(section));
    if (step >= 0 && FG.JOURNEY[step + 1]) {
      const n = FG.JOURNEY[step + 1], bar = document.createElement("nav");
      bar.className = "next-step no-print"; bar.setAttribute("aria-label", "Next step in the journey");
      bar.innerHTML = `<span>Step ${step + 1} of ${FG.JOURNEY.length} · ${esc(FG.JOURNEY[step].title)}</span><a href="#/${n.path}"><small>Next step</small><b>${esc(n.title)} →</b></a>`;
      root.appendChild(bar);
    }
    if (keepScroll) window.scrollTo(0, y);
  };
  window.addEventListener("hashchange", () => {
    const changedPage = !current || FG.path().split("/")[0] !== current.path.split("/")[0];
    FG.refresh(false);
    closeSide();
    if (changedPage) { window.scrollTo(0, 0); $("#content").focus({ preventScroll: true }); }
  });

  /* ---------- search ---------- */
  FG.addIndex = (title, sub, path, kind, keywords = "") => FG.index.push({ title, sub, path, kind, hay: `${title} ${sub} ${keywords}`.toLowerCase() });
  function search(q) {
    const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return FG.index.filter((x) => x.kind === "Module" || x.kind === "Engine").slice(0, 14);
    return FG.index.map((x) => {
      let score = 0;
      for (const t of terms) { if (!x.hay.includes(t)) return null; score += x.title.toLowerCase().includes(t) ? 3 : 1; }
      return { x, score: score + (x.kind === "Module" ? 1 : 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 30).map((r) => r.x);
  }
  let results = [], sel = 0;
  function renderResults() {
    const list = $("#paletteList");
    list.innerHTML = results.length ? results.map((r, i) => `<li><a href="#/${esc(r.path)}" role="option" aria-selected="${i === sel}" data-i="${i}"><span>${esc(r.title)}</span><small>${esc(r.sub)}</small>${FG.ui.tag(r.kind)}</a></li>`).join("") : `<li class="empty"><b>No results</b>Try another word, such as “threshold”, “addendum” or “petty cash”.</li>`;
    const active = $(`[aria-selected="true"]`, list); if (active) active.scrollIntoView({ block: "nearest" });
  }
  FG.openPalette = function () {
    $("#palette").classList.add("open"); $("#overlay").classList.add("open");
    const input = $("#paletteInput"); input.value = ""; results = search(""); sel = 0; renderResults(); input.focus();
  };
  function closeOverlays() {
    ["#palette", "#overlay", "#caseDrawer"].forEach((s) => $(s).classList.remove("open"));
    closeSide();
  }
  FG.closeOverlays = closeOverlays;

  const svg = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    case: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>'),
    system: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    dark: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  };
  FG.ICON = ICON;
  /* ---------- toast & theme ---------- */
  let toastTimer;
  FG.toast = (text) => { const t = $("#toast"); t.textContent = text; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200); };
  function applyTheme(theme) {
    if (theme === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", theme);
    const btn = $("#themeBtn"); if (btn) { btn.innerHTML = ICON[theme]; btn.setAttribute("aria-label", `Theme: ${theme}. Change theme`); }
  }
  function closeSide() { $("#side")?.classList.remove("open"); if (!$("#palette").classList.contains("open") && !$("#caseDrawer").classList.contains("open")) $("#overlay").classList.remove("open"); }

  /* ---------- shell ---------- */
  FG.start = function () {
    const groups = FG.nav;
    document.body.innerHTML = `<a class="skip" href="#content">Skip to content</a>
<div class="app">
  <aside class="side" id="side" aria-label="Main navigation">
    <a class="brand" href="#/home"><span class="brand-mark" aria-hidden="true">FG</span><span><b>Financial Guide</b><small>Procurement · Finance · Grants</small></span></a>
    <nav class="nav">${groups.map((g) => `<div class="nav-group"><span>${esc(g.title)}</span>${g.items.map((it) => `<a href="#/${it.path}" data-section="${it.section || it.path.split("/")[0]}"><i aria-hidden="true">${esc(it.icon)}</i>${esc(it.title)}</a>`).join("")}</div>`).join("")}</nav>
    <div class="side-foot">Guidance tool. It does not replace the applicable rules, the Procurement Guide or Finance validation.</div>
  </aside>
  <div class="main">
    <header class="top">
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open navigation">${ICON.menu}</button>
      <nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>
      <div class="top-actions">
        <button class="search-btn" id="searchBtn" aria-label="Search the guide">${ICON.search}<span>Search the guide…</span><kbd>Ctrl K</kbd></button>
        <button class="icon-btn" id="caseBtn" aria-label="Open My Case">${ICON.case}<span class="badge-dot" id="caseCount" hidden>0</span></button>
        <button class="icon-btn" id="themeBtn" aria-label="Change theme"></button>
      </div>
    </header>
    <main class="content" id="content" tabindex="-1"></main>
  </div>
</div>
<div class="overlay" id="overlay"></div>
<div class="palette" id="palette" role="dialog" aria-modal="true" aria-label="Search">
  <input id="paletteInput" type="search" placeholder="Search procedures, rules, documents, tools…" aria-label="Search" autocomplete="off" role="combobox" aria-controls="paletteList" aria-expanded="true">
  <ul id="paletteList" role="listbox"></ul>
  <div class="hint"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
</div>
<aside class="drawer" id="caseDrawer" aria-label="My Case" aria-hidden="true">
  <div class="drawer-head"><b>My Case</b><button class="icon-btn" id="caseClose" aria-label="Close My Case">${ICON.close}</button></div>
  <div class="drawer-body" id="caseBody"></div>
</aside>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

    applyTheme(FG.store.get("theme", "system"));
    $("#themeBtn").onclick = () => { const order = ["system", "light", "dark"], next = order[(order.indexOf(FG.store.get("theme", "system")) + 1) % 3]; FG.store.set("theme", next); applyTheme(next); FG.toast(`Theme: ${next}`); };
    $("#menuBtn").onclick = () => { $("#side").classList.add("open"); $("#overlay").classList.add("open"); };
    $("#searchBtn").onclick = FG.openPalette;
    $("#overlay").onclick = closeOverlays;
    const openCase = () => { FG.renderCase(); $("#caseDrawer").classList.add("open"); $("#caseDrawer").setAttribute("aria-hidden", "false"); $("#overlay").classList.add("open"); $("#caseClose").focus(); };
    $("#caseBtn").onclick = openCase;
    FG.openCase = openCase;
    $("#caseClose").onclick = () => { $("#caseDrawer").setAttribute("aria-hidden", "true"); closeOverlays(); };
    $("#caseDrawer").addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove-case]"); if (rm) FG.case.remove(+rm.dataset.removeCase);
      if (e.target.closest("#caseClear")) FG.case.clear();
      if (e.target.closest("#casePrint")) printCase();
      if (e.target.closest("a")) closeOverlays();
    });
    $("#caseDrawer").addEventListener("input", (e) => { if (e.target.id === "caseNote") FG.store.set("caseNote", e.target.value); });
    $("#paletteInput").addEventListener("input", (e) => { results = search(e.target.value); sel = 0; renderResults(); });
    $("#paletteInput").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + results.length) % Math.max(1, results.length); renderResults(); }
      if (e.key === "Enter" && results[sel]) { FG.go(results[sel].path); closeOverlays(); }
    });
    $("#paletteList").addEventListener("click", (e) => { if (e.target.closest("a")) closeOverlays(); });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); FG.openPalette(); }
      else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); FG.openPalette(); }
      else if (e.key === "Escape") closeOverlays();
    });
    // "Save to My Case" on any decision card.
    $("#content").addEventListener("click", (e) => {
      if (!e.target.closest("[data-save-case]")) return;
      const r = FG.lastDecision; if (r) FG.case.add({ engine: r.engine, path: FG.path(), kicker: r.kicker, route: r.route, summary: r.summary, meta: r.meta });
    });
    FG.updateCaseBadge();
    FG.refresh(false);
  };

  function printCase() {
    const items = FG.case.items(), w = window.open("", "_blank");
    if (!w) { FG.toast("Allow pop-ups to print the case summary"); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>My Case</title><style>body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px}section{border-top:1px solid #ccc;padding:10px 0}small{color:#666}</style><h1>My Case — ${esc(fmtDate(new Date()))}</h1><p>${esc(FG.store.get("caseNote", "")).replace(/\n/g, "<br>")}</p>${items.map((x) => `<section><small>${esc(x.kicker)}</small><h2 style="font-size:16px;margin:2px 0">${esc(x.route)}</h2><p>${esc(x.summary)}</p><small>${x.meta.map((m) => esc(m.join(": "))).join(" · ")} · ${esc(fmtDate(x.at))}</small></section>`).join("")}`);
    w.document.close(); w.focus(); w.print();
  }
})();
