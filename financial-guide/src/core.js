/* Core: helpers, persistent store, router, shell (navigation, search, theme). */
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
    { title: "Report & forecast", sub: "Position, variance, revision", path: "foma/reports", sections: ["foma-reports", "foma-forecast"] },
    { title: "Close the year", sub: "Cut-off and PO finalisation", path: "year-end", sections: ["year-end"] },
    { title: "File & audit", sub: "Evidence trail", path: "filing", sections: ["filing"] },
  ];
  // Each area has its own colour; views read it through --accent.
  FG.TONES = { home: 1, engines: 4, procurement: 1, grants: 4, "po-file": 5, foma: 5, "payment-file": 2, "petty-cash": 3, "foma-reports": 5, "foma-forecast": 3, "year-end": 3, filing: 2, scenarios: 4, roles: 1, links: 1, rules: 4, glossary: 5, projects: 1, tools: 3, vat: 6, events: 4, "foma-po": 2, "foma-pay": 2, "foma-mission": 5, "foma-claim": 5 };

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
      return `<header class="page-head${lead ? "" : " compact"}"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${lead ? `<p>${esc(lead)}</p>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</header>`;
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

  // Tabs: panels are all rendered, only the remembered one is shown; switching never re-renders the page.
  FG.ui.tabs = function (id, tabs) {
    tabs = tabs.filter((t) => t && t[2]);
    const keys = tabs.map((t) => t[0]), cur = keys.includes(FG.store.get("tab:" + id)) ? FG.store.get("tab:" + id) : keys[0];
    return `<div class="tabs" data-tabs="${esc(id)}"><div class="tablist" role="tablist">${tabs.map(([k, label, , count]) => `<button type="button" role="tab" data-tab="${esc(k)}" aria-selected="${k === cur}">${esc(label)}${count != null ? `<em>${esc(count)}</em>` : ""}</button>`).join("")}<i class="tab-ink" aria-hidden="true"></i></div>
      ${tabs.map(([k, , html]) => `<div class="tabpanel" role="tabpanel" data-panel="${esc(k)}" ${k === cur ? "" : "hidden"}>${html}</div>`).join("")}</div>`;
  };
  FG.placeInk = (root) => root.querySelectorAll(".tablist").forEach((l) => { const a = l.querySelector('[aria-selected="true"]'), ink = l.querySelector(".tab-ink"); if (a && ink) { ink.style.left = a.offsetLeft + "px"; ink.style.width = a.offsetWidth + "px"; } });
  // Donut chart: segments [[label, value, colour]]; centre shows the first segment's share.
  FG.ui.donut = function (segments, centre, sub) {
    const total = segments.reduce((a, x) => a + Math.max(0, x[1]), 0) || 1, R = 52, C = 2 * Math.PI * R; let off = 0;
    const arcs = segments.map(([l, v, c]) => { const len = (Math.max(0, v) / total) * C, a = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${c}" stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" class="arc"><title>${esc(l)}: ${esc(euro(v))}</title></circle>`; off += len; return a; }).join("");
    return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="${esc(segments.map((x) => `${x[0]} ${euro(x[1])}`).join(", "))}"><g transform="rotate(-90 70 70)"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--sunken)" stroke-width="16"/>${arcs}</g><text x="70" y="68" text-anchor="middle" class="d-main">${esc(centre)}</text><text x="70" y="86" text-anchor="middle" class="d-sub">${esc(sub)}</text></svg>
      <ul>${segments.map(([l, v, c]) => `<li><i style="background:${c}"></i><span>${esc(l)}</span><b>${esc(euro(v))}</b></li>`).join("")}</ul></div>`;
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
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        const box = tab.closest("[data-tabs]"); FG.store.set("tab:" + box.dataset.tabs, tab.dataset.tab);
        box.querySelectorAll(":scope > .tablist [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === tab)));
        box.querySelectorAll(":scope > .tabpanel").forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
        FG.placeInk(box); return;
      }
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
    const scale = r.scale ? `<div class="block"><h3>Threshold position</h3><div class="scale" aria-hidden="true"><div class="track"></div><div class="pin" style="left:${Math.min(99, Math.max(1, (r.scale.value / r.scale.max) * 100))}%"></div><div class="labels">${r.scale.marks.map(([v, l]) => `<span style="left:${(v / r.scale.max) * 100}%;${v / r.scale.max < 0.12 ? "transform:none" : ""}">${esc(l)}</span>`).join("")}</div></div></div>` : "";
    const fit = r.fit ? `<div class="block"><h3>Model fit</h3><div class="fit">${r.fit.map(([n, s]) => `<div><span>${esc(n)}</span>${ui.bar((s / 12) * 100, n === r.route ? "good" : "")}<em>${s} pts</em></div>`).join("")}</div></div>` : "";
    const flags = r.flags ? `<div class="block"><h3>Control flags</h3><div class="row">${r.flags.map(([t, tone]) => ui.tag(t, tone === "neutral" ? "" : tone)).join("")}</div></div>` : "";
    const confidence = r.confidence && r.score != null ? `<div class="block"><h3>Decision confidence</h3><div class="score ${r.score >= 85 ? "good" : r.score >= 70 ? "warn" : "risk"}"><div class="ring" style="--p:${r.score}"><b>${r.score}%</b></div><div><h4>${esc(r.confidence[0])}</h4><p>${esc(r.confidence[1])}</p></div></div></div>` : "";
    return `<section class="card decision" aria-live="polite">
      <div class="decision-hero ${r.tone}"><div class="eyebrow">${esc(r.kicker)}</div><h2>${esc(r.route)}</h2><p>${esc(r.summary)}</p>
        <div class="row">${r.meta.map(([k, v]) => ui.tag(`${k}: ${v}`)).join("")}<span class="spacer"></span></div></div>
      <div class="decision-body">${ui.kpis(r.kpis)}${scale}${fit}
        ${FG.ui.tabs("decision", [
          ["why", "Why this result", `<div class="reasons">${r.reasons.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>`, r.reasons.length],
          ["controls", "Controls & confidence", (flags + confidence) || "", null],
          ["files", "File pack", r.docs ? `<div class="docs">${r.docs.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>` : "", r.docs ? r.docs.length : null],
          ["next", "Next actions", `<div class="actions-list">${r.actions.map(([a, b]) => `<div><div><b>${esc(a)}</b><span>${esc(b)}</span></div></div>`).join("")}</div>`, r.actions.length],
        ])}
        ${opts.footer || ""}
      </div></section>`;
  };

  // Path → scenario category: a compact self-check appears only at the end of each module.
  FG.QUIZ_AT = {};
  /* ---------- advanced visuals ---------- */
  // Threshold ruler: piecewise-log scale so small and large thresholds are both readable.
  // zones: [[from, to, label, colourVar]], marks: [[value, label]], value: the case amount (optional).
  FG.ui.ruler = function ({ zones, marks, value, max }) {
    const stops = [0, ...marks.map(([v]) => v), max];
    const pos = (v) => { v = Math.max(0, Math.min(max, v)); for (let k = 1; k < stops.length; k++) if (v <= stops[k]) return ((k - 1) + (v - stops[k - 1]) / (stops[k] - stops[k - 1])) / (stops.length - 1) * 100; return 100; };
    const hit = value > 0 ? zones.find(([a, b]) => value > a && value <= b) || zones[zones.length - 1] : null;
    return `<div class="ruler no-enrich" role="img" aria-label="Threshold ruler${hit ? `: ${esc(euro(value))} falls in ${esc(hit[2])}` : ""}">
      <div class="ruler-track">${zones.map(([a, b, l, c]) => `<span class="ruler-zone${hit && hit[2] === l ? " on" : ""}" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%;--c:var(${c})"><em>${esc(l)}</em></span>`).join("")}
        ${value > 0 ? `<i class="ruler-pin" style="left:${pos(value)}%"><b>${esc(euro(value))}</b></i>` : ""}</div>
      <div class="ruler-marks">${marks.map(([v, l]) => `<span style="left:${pos(v)}%"><b>${esc(euro(v))}</b>${l ? `<small>${esc(l)}</small>` : ""}</span>`).join("")}</div></div>`;
  };
  // Gate funnel: each gate narrows the field; shows what is tested and what happens on failure.
  FG.ui.funnel = function (title, gates) {
    return `<section class="card funnel no-enrich"><div class="card-head"><div><h3>${esc(title)}</h3><small>Each gate must be passed before the next one is applied.</small></div></div>
      <ol class="funnel-list">${gates.map(([t, test, fail, kind], k) => `<li style="--w:${100 - k * (55 / Math.max(1, gates.length - 1))}%;--c:var(--c${(k % 4) + 1})"><div class="funnel-bar"><span>${k + 1}</span><b>${esc(t)}</b><em>${esc(kind || "")}</em></div><p>${esc(test)}${fail ? `<small>If not: ${esc(fail)}</small>` : ""}</p></li>`).join("")}</ol></section>`;
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
  // Identify an element by a stable attribute so it can be found again after a re-render.
  const KEYS = ["id", "name", "data-tab", "data-k", "data-rd-go", "data-flow", "data-opt", "data-cat", "data-s", "data-p", "data-c"];
  const sig = (el) => { const k = KEYS.find((a) => el.hasAttribute && el.hasAttribute(a)); return k ? `[${k}="${CSS.escape(el.getAttribute(k))}"]` : null; };
  function snapshot(root) {
    const a = document.activeElement, f = a && root.contains(a) ? sig(a) : null;
    return {
      focus: f, sel: f && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null,
      details: [...root.querySelectorAll("details")].map((d) => d.open),
      scrollers: [...root.querySelectorAll(".rt-scroll, .table-wrap, .tablist, .rd-nav")].map((x) => x.scrollLeft),
      panels: [...root.querySelectorAll("[data-rd]")].map((rd) => { const b = rd.querySelector('.rd-nav [aria-selected="true"]'); return b ? b.dataset.rdGo : null; }),
    };
  }
  function restore(root, m) {
    root.querySelectorAll("details").forEach((d, i) => { if (m.details[i] !== undefined) d.open = m.details[i]; });
    root.querySelectorAll(".rt-scroll, .table-wrap, .tablist, .rd-nav").forEach((x, i) => { if (m.scrollers[i]) x.scrollLeft = m.scrollers[i]; });
    root.querySelectorAll("[data-rd]").forEach((rd, i) => { const k = m.panels[i]; if (k != null) rd.querySelector(`.rd-nav [data-rd-go="${k}"]`)?.click(); });
    if (m.focus) { const el = root.querySelector(m.focus); if (el) { el.focus({ preventScroll: true }); if (m.sel && el.setSelectionRange) try { el.setSelectionRange(...m.sel); } catch (e) {} } }
  }
  FG.refresh = function (keepScroll = true) {
    const y = window.scrollY, path = FG.path(), hit = match(path) || match("home");
    const main = $("#content"), old = main.firstElementChild;
    // In-place refresh (an interaction on the same page): remember what the reader was doing so the
    // new render is indistinguishable from an update — no entry animation, same focus, same open panels.
    const inPlace = keepScroll && !!old, memo = inPlace ? snapshot(old) : null;
    const view = hit.route.render(hit.params) || {};
    const root = document.createElement("div");
    root.innerHTML = view.html || "";
    if (inPlace) { document.documentElement.classList.add("quiet"); root.classList.add("still"); }
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
    requestAnimationFrame(() => FG.placeInk(root));
    document.documentElement.dataset.tone = FG.TONES[section] || 1;
    const quizCat = FG.QUIZ_AT[path];
    if (quizCat && FG.ui.quiz) root.insertAdjacentHTML("beforeend", FG.ui.quiz(quizCat));
    const step = FG.JOURNEY.findIndex((j) => j.sections.includes(section));
    // Procurement and grants have their own route; the generic journey bar would compete with it.
    if (step >= 0 && FG.JOURNEY[step + 1] && !["procurement", "grants"].includes(section)) {
      const n = FG.JOURNEY[step + 1], bar = document.createElement("nav");
      bar.className = "next-step no-print"; bar.setAttribute("aria-label", "Next step in the journey");
      bar.innerHTML = `<span>Step ${step + 1} of ${FG.JOURNEY.length} · ${esc(FG.JOURNEY[step].title)}</span><a href="#/${n.path}"><small>Next step</small><b>${esc(n.title)} →</b></a>`;
      root.appendChild(bar);
    }
    if (memo) restore(root, memo);
    if (keepScroll) { window.scrollTo(0, y); requestAnimationFrame(() => window.scrollTo(0, y)); }
    if (inPlace) requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("quiet")));
  };
  window.addEventListener("hashchange", () => {
    const changedPage = !current || FG.path().split("/")[0] !== current.path.split("/")[0];
    // Moving between stages of the same module keeps the reader where they are.
    FG.refresh(!changedPage);
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
    ["#palette", "#overlay"].forEach((s) => $(s).classList.remove("open"));
    const sh = $("#sheet"); if (sh && !sh.hidden) { sh.classList.remove("open"); setTimeout(() => { sh.hidden = true; }, 200); if (FG.sheetFrom) FG.sheetFrom.focus({ preventScroll: true }); }
  }
  FG.closeOverlays = closeOverlays;
  // Side sheet for details: opens over the page without leaving it.
  FG.openSheet = function (kicker, title, html) {
    FG.sheetFrom = document.activeElement;
    $("#sheetKicker").textContent = kicker; $("#sheetTitle").textContent = title; $("#sheetBody").innerHTML = html;
    if (FG.enrich) FG.enrich($("#sheetBody"));
    const sh = $("#sheet"); sh.hidden = false; requestAnimationFrame(() => sh.classList.add("open")); $("#overlay").classList.add("open"); $("#sheetClose").focus();
  };

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

  /* ---------- shell ---------- */
  FG.start = function () {
    const groups = FG.nav;
    document.body.innerHTML = `<a class="skip" href="#content">Skip to content</a>
<div class="app no-side">
  <div class="main">
    <header class="top">
      <a class="brand" href="#/home"><span class="brand-mark" aria-hidden="true">FG</span><span><b>Financial Guide</b><small>Council of Europe</small></span></a>
      <div class="top-actions">
        <button class="search-btn" id="searchBtn" aria-label="Search the guide">${ICON.search}<span>Search the guide…</span><kbd>Ctrl K</kbd></button>
        <button class="icon-btn" id="themeBtn" aria-label="Change theme"></button>
      </div>
    </header>
    <nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>
    <main class="content" id="content" tabindex="-1"></main>
    <footer class="foot">Guidance tool. It does not replace the applicable rules, the Procurement Guide or Finance validation. <span class="build">Version __BUILD__</span></footer>
  </div>
</div>
<div class="overlay" id="overlay"></div>
<div class="palette" id="palette" role="dialog" aria-modal="true" aria-label="Search">
  <input id="paletteInput" type="search" placeholder="Search procedures, rules, documents, tools…" aria-label="Search" autocomplete="off" role="combobox" aria-controls="paletteList" aria-expanded="true">
  <ul id="paletteList" role="listbox"></ul>
  <div class="hint"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
</div>
<aside class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" hidden><div class="sheet-head"><div><small id="sheetKicker"></small><h2 id="sheetTitle"></h2></div><button class="icon-btn" id="sheetClose" aria-label="Close details">${ICON.close}</button></div><div class="sheet-body" id="sheetBody"></div></aside>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

    applyTheme(FG.store.get("theme", "system"));
    $("#themeBtn").onclick = () => { const order = ["system", "light", "dark"], next = order[(order.indexOf(FG.store.get("theme", "system")) + 1) % 3]; FG.store.set("theme", next); applyTheme(next); FG.toast(`Theme: ${next}`); };
    $("#searchBtn").onclick = FG.openPalette;
    $("#sheetClose").onclick = closeOverlays;
    $("#overlay").onclick = closeOverlays;
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
    FG.refresh(false);
  };

})();
