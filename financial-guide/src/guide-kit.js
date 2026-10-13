/* Guide kit: one call turns a content object into a full guide (hub, stages, test, reference, essentials).
   Guides registered here load before the operational modules, so a guide may take over a module's address;
   the module's own tools stay reachable through `tools`. Schema and checklist: docs/ADDING_A_GUIDE.md. */
(function () {
  "use strict";
  const { esc, slug, ui, route } = FG;
  FG.C.guides = FG.C.guides || {};

  FG.registerGuide = function (g) {
    const base = g.base, parent = g.parent || ["Projects", "projects"], crumbs = (extra) => [parent, [g.title, base], ...(extra ? [extra] : [])];
    g.stages = g.stages || []; g.phases = g.phases || [["Guide", g.stages.map((s) => s.name)]];
    FG.C.guides[base] = g;
    if (g.quiz) { FG.C.quizzes = FG.C.quizzes || {}; FG.C.quizzes[base] = g.quiz; }
    if (g.facts) { FG.C.factNotes = FG.C.factNotes || {}; FG.C.factNotes[base] = g.facts; }

    route(base, {
      section: base, crumbs: () => crumbs(),
      render() {
        const last = FG.store.get(base + ":last", 0), visited = Object.keys(FG.store.get(base + ":visited", {})).length, [qa, qn, qs] = FG.quizProgress(base);
        const first = g.stages[Math.min(last, g.stages.length - 1)];
        const paths = [
          g.stages.length && ["Follow the guide", `${g.stages.length} stages${g.phases.length > 1 ? ` in ${g.phases.length} phases` : ""}.`, `${base}/${slug(first.name)}`, `${visited} of ${g.stages.length} stages opened`, visited / g.stages.length, 1, visited ? "Continue" : "Start"],
          qn && ["Test yourself", `${qn} questions from easy to expert, with explanations.`, `${base}/test`, qa ? `${qs} of ${qn} correct · ${qa} answered` : `${qn} questions`, qa / qn, 3, qa ? "Continue the test" : "Start the test"],
          ...(g.tools || []).map(([t, d, p]) => [t, d, p, "Tool", 0, 2, "Open"]),
        ].filter(Boolean);
        return { html: `${ui.head(`${parent[0]} · ${g.title}`, g.title, g.lead || "")}
          <section class="hub-paths">${paths.map(([t, d, p, meta, prog, c, cta], i) => `<a class="hub-path" href="#/${p}" style="--c:var(--c${c})"><span class="hub-n">${i + 1}</span><h2>${esc(t)}</h2><p>${esc(d)}</p>
            <div class="hub-meta"><span>${esc(meta)}</span><i><u style="width:${Math.round((prog || 0) * 100)}%"></u></i></div><b class="hub-cta">${esc(cta)} →</b></a>`).join("")}</section>
          <div class="hub-sec">${FG.reviewChip()}${g.reference ? `<a class="hub-ref" href="#/${base}/reference"><span>§</span><div><b>Quick reference</b><small>Limits, roles and how-to</small></div><u>Open →</u></a>` : ""}${(g.essentials || []).length ? `<a class="hub-ref" href="#/${base}/essentials"><span>${g.essentials.length}</span><div><b>The essentials</b><small>One rule at a time</small></div><u>Open →</u></a>` : ""}</div>` };
      },
    });
    if ((g.essentials || []).length) route(base + "/essentials", { section: base, crumbs: () => crumbs(["The essentials", base + "/essentials"]),
      render: () => ({ html: `${ui.head(`${g.title} · learn one rule at a time`, "The essentials", "")}${FG.learnPage(g.essentials, base + ":known", base, `#/${base}`, g.title)}` }) });
    if (g.reference) route(base + "/reference", { section: base, crumbs: () => crumbs(["Quick reference", base + "/reference"]),
      render: () => ({ html: `${ui.head(`${g.title} · quick reference`, "Quick reference", "")}${FG.referencePage(g.reference, base)}` }) });
    if ((g.quiz || []).length) route(base + "/test", { section: base, crumbs: () => crumbs(["Test yourself", base + "/test"]),
      render: () => ({ html: `${ui.head(`${g.title} · self-test`, "Test yourself", "")}${FG.quizPage(base)}` }) });
    if (g.stages.length) FG.lifecycle({
      base, title: g.title, eyebrow: `${g.title} · guide`, lead: g.lead || "", stages: g.stages, phases: g.phases,
      checklist: (s) => s.checklist || [], bestPractice: (s) => s.best,
      roles: (s) => (g.roles || []).filter((r) => (r.stages || []).includes(s.name)),
      link: (l) => { const st = g.stages.find((x) => x.name === l); return st ? [l, `${base}/${slug(l)}`] : null; },
      widgets: g.widgets || {}, mount: g.mount || {},
    });
  };
})();
