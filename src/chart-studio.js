/* Financial chart studio: presentation and shared analysis selection only.
 * Report values and evidence remain owned by the original ledger engine. */
function createChartStudio(api) {
  "use strict";
  const {
    h,
    money,
    compact,
    pc,
    icon,
    empty,
    url,
    historyReports,
    finAt,
    cmSourceAmountKnown,
    entityColor,
    SG,
  } = api;
  const SERIES = ["spent", "exposure"];
  const LABEL = { spent: "Spent", exposure: "Spent + committed" };
  const COLOR = { spent: "var(--mp-spent)", exposure: "var(--mp-committed)" };
  const snapshots = new Map();
  const binding = new WeakSet();
  const mobileMedia = matchMedia("(max-width: 720px)");
  const chartObserver =
    typeof ResizeObserver === "function"
      ? new ResizeObserver((entries) =>
          entries.forEach(({ target }) => sizeText(target)),
        )
      : null;
  let historyCache = { rows: [], all: [], points: [] };
  const settings = () => api.getSettings().charts;
  const analysis = () => api.getAnalysis();
  const uniq = (xs) => [...new Set(xs)];
  const finite = Number.isFinite;
  const sum = (R, key) => R.reduce((n, r) => n + r[key], 0);
  const signed = (n) => (finite(n) ? (n > 0 ? "+" : "") + money(n) : "—");
  function commitCharts(patch) {
    api.updateCharts(patch);
    api.render();
  }
  function sizeText(svg) {
    svg.style.aspectRatio = `${svg.viewBox.baseVal.width} / ${svg.viewBox.baseVal.height}`;
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    if (!scale) return;
    for (const text of svg.querySelectorAll("text:not(.mp-bubble-label)"))
      text.style.fontSize = `${Math.min(40, (text.classList.contains("cs-bridge-value") ? 13 : 12) / scale)}px`;
  }
  mobileMedia.addEventListener?.("change", () => {
    if (
      document.querySelector(
        ".cs-history-chart,.cs-waterfall-chart,.cs-pace-chart",
      )
    )
      api.render();
  });
  function restoreControl(el) {
    const panel = el.closest("[data-mp-panel]")?.dataset.mpPanel;
    const data = { ...el.dataset },
      tag = el.tagName;
    requestAnimationFrame(() => {
      const root = panel
        ? document.querySelector(`[data-mp-panel="${panel}"]`)
        : document;
      if (!root) return;
      const selector = data.csAction
        ? "[data-cs-action]"
        : data.csRange
          ? "[data-cs-range]"
          : "[data-cs-option]";
      const target = [...root.querySelectorAll(selector)].find(
        (n) =>
          n.tagName === tag &&
          ["csAction", "csRange", "csOption", "csKey", "csValue"].every(
            (key) => n.dataset[key] === data[key],
          ),
      );
      target?.focus({ preventScroll: true });
    });
  }
  function isoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
    const t = Date.parse(value + "T00:00:00Z");
    return finite(t) && new Date(t).toISOString().slice(0, 10) === value;
  }
  function shortDate(value, year = true) {
    return new Date(value + "T12:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  }
  function selectButton(action, value, label, selected = false, extra = "") {
    return `<button type="button" data-cs-action="${action}" data-cs-value="${h(value)}" aria-pressed="${selected}" ${extra}>${label}</button>`;
  }
  function toggle(option, values, label) {
    return `<div class="mp-toggle cs-toggle" role="group" aria-label="${h(label)}">${values.map(([v, l]) => selectButton("option", v, h(l), settings()[option] === v, `data-cs-key="${option}"`)).join("")}</div>`;
  }
  function sourceCaption(R, property = "exposure") {
    const n = R.filter((r) => r.evidence[property]).length;
    const dates = uniq(
      R.map((r) => r.evidence.latest?.date).filter(isoDate),
    ).sort();
    return `${n}/${R.length} projects with ${property === "actual" ? "actuals" : "exposure"} evidence${dates.length ? " · source dates " + dates[0] + (dates.length > 1 ? " to " + dates.at(-1) : "") : " · manual or undated sources"}`;
  }
  function currentCaption(R, detail) {
    return `<p class="mp-footnote cs-current-caption"><b>Current records.</b> ${h(detail)} ${h(sourceCaption(R))}. Report-date filtering applies to history only.</p>`;
  }
  function selectProject(r, label = "Select project") {
    return selectButton(
      "select-project",
      r.p.id,
      `${h(label)} <span aria-hidden="true">↗</span>`,
      analysis().project === r.p.id,
      `aria-label="Select ${h(r.p.name)} across the analysis"`,
    );
  }
  function financialReports(p) {
    const byDate = new Map();
    const candidates = api.sourceReports
      ? api.sourceReports(p)
      : historyReports(p);
    for (const q of candidates) {
      if (
        !isoDate(q.date) ||
        (!cmSourceAmountKnown(q, "actual") &&
          !cmSourceAmountKnown(q, "spentCommitted"))
      )
        continue;
      const old = byDate.get(q.date);
      if (
        !old ||
        String(q.updatedAt || q.registeredAt || "") >=
          String(old.updatedAt || old.registeredAt || "")
      )
        byDate.set(q.date, q);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  function reportSeries(R) {
    const streams = R.map((r) => ({
      r,
      index: -1,
      Q: financialReports(r.p)
        .map((q) => {
          const f = finAt(r.p, q);
          return {
            date: q.date,
            q,
            spent:
              cmSourceAmountKnown(q, "actual") && finite(f.actual)
                ? f.actual
                : null,
            exposure:
              cmSourceAmountKnown(q, "spentCommitted") && finite(f.sc)
                ? f.sc
                : null,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    const dates = uniq(streams.flatMap((s) => s.Q.map((q) => q.date))).sort();
    let previous = null;
    return dates.map((date) => {
      const p = {
        date,
        t: Date.parse(date),
        total: R.length,
        actualCount: 0,
        exposureCount: 0,
        spent: null,
        exposure: null,
        sources: [],
      };
      const states = new Map();
      for (const s of streams) {
        while (s.Q[s.index + 1]?.date <= date) s.index++;
        const q = s.Q[s.index];
        if (!q) continue;
        states.set(s.r.p.id, q);
        p.sources.push({ r: s.r, ...q });
        if (q.spent !== null) {
          p.spent = (p.spent ?? 0) + q.spent;
          p.actualCount++;
        }
        if (q.exposure !== null) {
          p.exposure = (p.exposure ?? 0) + q.exposure;
          p.exposureCount++;
        }
      }
      p.interval = {
        date,
        t: p.t,
        from: previous?.date || "",
        total: R.length,
        spent: null,
        exposure: null,
        actualCount: 0,
        exposureCount: 0,
        newCount: 0,
        sources: [],
        cumulative: p,
      };
      if (previous) {
        for (const [id, q] of states) {
          const old = previous.states.get(id);
          // Only a newly recorded observation can establish an interval change.
          // New coverage is never treated as expenditure from zero.
          if (old?.date === q.date) continue;
          p.interval.newCount++;
          const item = {
            r: streams.find((s) => s.r.p.id === id).r,
            ...q,
            previous: old,
            spent: null,
            exposure: null,
          };
          for (const k of SERIES) {
            if (old && old[k] !== null && q[k] !== null) {
              item[k] = q[k] - old[k];
              p.interval[k] = (p.interval[k] ?? 0) + item[k];
              p.interval[k === "spent" ? "actualCount" : "exposureCount"]++;
            }
          }
          p.interval.sources.push(item);
        }
      }
      p.interval.unmatchedActual = p.interval.newCount - p.interval.actualCount;
      p.interval.unmatchedExposure =
        p.interval.newCount - p.interval.exposureCount;
      previous = { date, states };
      return p;
    });
  }
  function visibleSeries() {
    const s = settings().series;
    return SERIES.filter((k) => s === "both" || s === k);
  }
  function scopedHistoryRows(R) {
    const scope = settings().history;
    return scope && scope !== "all" && R.some((r) => r.p.id === scope)
      ? R.filter((r) => r.p.id === scope)
      : R;
  }
  function timelineSelection(all) {
    const a = analysis();
    let selected = all.filter(
      (p) => (!a.from || p.date >= a.from) && (!a.to || p.date <= a.to),
    );
    if (settings().window === "12") selected = selected.slice(-12);
    return selected;
  }
  function dateControls(all, points) {
    if (!all.length) return "";
    const a = analysis();
    const first = a.from || points[0]?.date || all[0].date;
    const last = a.to || points.at(-1)?.date || all.at(-1).date;
    const start = Math.max(
      0,
      all.findIndex((p) => p.date >= first),
    );
    let end = all.findLastIndex((p) => p.date <= last);
    if (end < 0) end = 0;
    const W = 620,
      H = 36,
      vals = all.map((p) => p.spent).filter(finite);
    const min = Math.min(0, ...vals),
      max = Math.max(1, ...vals),
      span = max - min;
    const t0 = all[0].t,
      t1 = all.at(-1).t;
    const X = (t) => 5 + ((t - t0) / (t1 - t0 || 1)) * (W - 10);
    const Y = (v) => H - 4 - ((v - min) / span) * (H - 8);
    let pen = false;
    const path = all
      .map((p) => {
        if (p.spent === null) {
          pen = false;
          return "";
        }
        const cmd = pen ? "L" : "M";
        pen = true;
        return `${cmd}${X(p.t).toFixed(2)} ${Y(p.spent).toFixed(2)}`;
      })
      .join(" ");
    const left = X(all[start]?.t || t0),
      right = X(all[Math.max(start, end)]?.t || t1);
    return `<div class="cs-date-toolbar"><label>From report<input type="date" data-cs-option="from" value="${h(a.from || "")}" min="${all[0].date}" max="${all.at(-1).date}" aria-label="History from report date"></label><label>To report<input type="date" data-cs-option="to" value="${h(a.to || "")}" min="${all[0].date}" max="${all.at(-1).date}" aria-label="History to report date"></label><div class="cs-zoom" role="group" aria-label="Report history zoom"><button data-cs-action="zoom" data-cs-value="in" aria-label="Zoom into report history" ${points.length <= 2 ? "disabled" : ""}>＋</button><button data-cs-action="zoom" data-cs-value="out" aria-label="Zoom out of report history" ${!a.from && !a.to && settings().window === "all" ? "disabled" : ""}>−</button><button data-cs-action="reset-range">Full history</button></div></div><div class="cs-navigator" data-cs-navigator><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><rect x="${left}" y="1" width="${Math.max(2, right - left)}" height="${H - 2}" fill="var(--mp-spent)" opacity=".12"/><path d="${path}" fill="none" stroke="var(--mp-spent)" stroke-width="1.8"/><line x1="${left}" x2="${left}" y1="0" y2="${H}" stroke="var(--mp-spent)"/><line x1="${right}" x2="${right}" y1="0" y2="${H}" stroke="var(--mp-spent)"/></svg><div class="cs-range-handles"><label>Start<input type="range" min="0" max="${all.length - 1}" step="1" value="${start}" data-cs-range="from" aria-label="First visible report" aria-valuetext="${all[start]?.date || first}" ${all.length < 2 ? "disabled" : ""}></label><label>End<input type="range" min="0" max="${all.length - 1}" step="1" value="${Math.max(start, end)}" data-cs-range="to" aria-label="Last visible report" aria-valuetext="${all[Math.max(start, end)]?.date || last}" ${all.length < 2 ? "disabled" : ""}></label></div><p data-cs-range-readout>${h(first)} — ${h(last)} <span>Drag either range handle or use arrow keys.</span></p></div>`;
  }
  function trendControls(R, all, points) {
    return `<div class="mp-chart-controls cs-studio-controls"><div>${toggle(
      "mode",
      [
        ["cumulative", "Cumulative"],
        ["interval", "Report changes"],
      ],
      "History measure",
    )}${toggle(
      "style",
      [
        ["line", "Lines"],
        ["columns", "Columns"],
      ],
      "Chart appearance",
    )}</div><label>History<select data-cs-option="window"><option value="all" ${settings().window !== "12" ? "selected" : ""}>All dates</option><option value="12" ${settings().window === "12" ? "selected" : ""}>Last 12 dates</option></select></label></div><div class="cs-series-controls" role="group" aria-label="Visible financial series">${SERIES.map((k) => selectButton("series", k, `<i class="cs-series-dot ${k}"></i>${LABEL[k]}`, visibleSeries().includes(k))).join("")}<span>EUR · ${R.length} project${R.length === 1 ? "" : "s"}</span></div>${dateControls(all, points)}`;
  }
  function historySvg(points, selected, interval) {
    const VW = mobileMedia.matches ? 430 : 760;
    const L = mobileMedia.matches ? 72 : 110,
      W = VW - L - 72,
      T = 25,
      B = 240;
    const series = visibleSeries();
    const vals = points.flatMap((p) => series.map((k) => p[k]).filter(finite));
    let min = Math.min(0, ...vals),
      max = Math.max(1, ...vals);
    const buffer = (max - min) * 0.09;
    if (min < 0) min -= buffer;
    max += buffer;
    const span = max - min;
    const t0 = points[0].t,
      t1 = points.at(-1).t;
    const X = (t) =>
      points.length === 1 ? L + W / 2 : L + ((t - t0) / (t1 - t0 || 1)) * W;
    const Y = (v) => B - ((v - min) / span) * (B - T);
    const path = (k) => {
      let pen = false;
      return points
        .map((p) => {
          if (p[k] === null) {
            pen = false;
            return "";
          }
          const cmd = pen ? "L" : "M";
          pen = true;
          return `${cmd}${X(p.t).toFixed(2)} ${Y(p[k]).toFixed(2)}`;
        })
        .join(" ");
    };
    const ticks = [points[0]];
    for (const p of points.slice(1, -1))
      if (
        X(p.t) - X(ticks.at(-1).t) >= 165 &&
        X(points.at(-1).t) - X(p.t) >= 130
      )
        ticks.push(p);
    if (points.length > 1) ticks.push(points.at(-1));
    const neighborGap =
      points.length < 2
        ? 70
        : Math.min(...points.slice(1).map((p, i) => X(p.t) - X(points[i].t)));
    const band = Math.max(2, Math.min(50, neighborGap * 0.7));
    const colWidth = band / series.length;
    const pointGroup = (p, k, svg) =>
      `<g class="mp-point cs-point" role="button" tabindex="0" data-cs-action="pick-date" data-cs-value="${p.date}" data-cs-series="${k}" aria-label="${h(p.date + ": " + (interval ? LABEL[k] + " change " : LABEL[k] + " ") + money(p[k]) + "; " + p[k === "spent" ? "actualCount" : "exposureCount"] + " of " + p.total + " project sources")}" aria-pressed="${selected.date === p.date}" data-tip="${p.date}|${h((interval ? "Matched report change: " : "") + LABEL[k] + " " + money(p[k]))}|${p.actualCount}/${p.total} actuals · ${p.exposureCount}/${p.total} exposure sources">${svg}</g>`;
    const drawing = series
      .map((k, j) => {
        if (settings().style === "columns")
          return points
            .filter((p) => p[k] !== null)
            .map((p) => {
              const x = X(p.t) - band / 2 + j * colWidth,
                y = Math.min(Y(0), Y(p[k])),
                height = Math.abs(Y(0) - Y(p[k]));
              return pointGroup(
                p,
                k,
                `<rect x="${x}" y="${T}" width="${Math.max(12, colWidth)}" height="${B - T}" fill="transparent"/><rect class="cs-column" x="${x}" y="${y}" width="${Math.max(1, colWidth - 2)}" height="${Math.max(1.2, height)}" rx="2" fill="${COLOR[k]}" opacity="${selected.date === p.date ? 1 : 0.73}"/>${p[k] < 0 ? `<path d="M${x} ${Y(0)}h${Math.max(1, colWidth - 2)}" stroke="var(--ink)" stroke-width="2"/>` : ""}`,
              );
            })
            .join("");
        return `<path d="${path(k)}" fill="none" stroke="${COLOR[k]}" stroke-width="2.8" ${k === "exposure" ? 'stroke-dasharray="6 4"' : ""}/>${points
          .filter((p) => p[k] !== null)
          .map((p) =>
            pointGroup(
              p,
              k,
              `<circle cx="${X(p.t)}" cy="${Y(p[k])}" r="12" fill="transparent"/><circle cx="${X(p.t)}" cy="${Y(p[k])}" r="${selected.date === p.date ? 5.5 : 3.5}" fill="${COLOR[k]}" stroke="var(--surface)" stroke-width="2"/>`,
            ),
          )
          .join("")}`;
      })
      .join("");
    return `<svg class="mp-chart mp-trend-chart cs-history-chart" viewBox="0 0 ${VW} 290" role="group" aria-labelledby="mp-trend-title mp-trend-desc"><title id="mp-trend-title">${interval ? "Financial changes between matched source observations" : "Cumulative expenditure by financial report date"}</title><desc id="mp-trend-desc">Actual dates determine spacing. ${interval ? "Only projects with a new report and a known value in both observations are included. New source coverage is excluded from changes. Negative values retain corrections or refunds." : "Each point uses one latest known report per project. Snapshots are never added together."} Select a point by touch, click, Enter or arrow keys.</desc><defs><linearGradient id="cs-spent-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--mp-spent)" stop-opacity=".14"/><stop offset="1" stop-color="var(--mp-spent)" stop-opacity="0"/></linearGradient></defs>${[0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${L}" x2="${L + W}" y1="${Y(min + span * f)}" y2="${Y(min + span * f)}" class="mp-gridline"/><text x="${L - 10}" y="${Y(min + span * f) + 4}" text-anchor="end">${compact(min + span * f)}</text>`).join("")}${!interval && settings().style !== "columns" && series.includes("spent") && points.every((p) => p.spent !== null) ? `<path d="${path("spent")}L${X(points.at(-1).t)} ${Y(0)}L${X(points[0].t)} ${Y(0)}Z" fill="url(#cs-spent-area)"/>` : ""}<line x1="${L}" x2="${L + W}" y1="${Y(0)}" y2="${Y(0)}" class="cs-zero-line"/><line x1="${X(selected.t)}" x2="${X(selected.t)}" y1="${T}" y2="${B}" class="mp-selection-line"/>${drawing}${ticks.map((p) => `<text x="${X(p.t)}" y="${B + 25}" text-anchor="${points.length === 1 ? "middle" : p === points[0] ? "start" : p === points.at(-1) ? "end" : "middle"}">${h(shortDate(p.date))}</text>`).join("")}<text x="${L}" y="15" class="cs-axis-unit">EUR${interval ? " · matched report changes" : " · cumulative"}</text></svg>`;
  }
  function sourcesDisclosure(selected, interval) {
    const sources = selected.sources;
    return `<details class="cs-source-disclosure"><summary>Inspect the selected sources <span>${sources.length} project${sources.length === 1 ? "" : "s"}</span></summary>${sources.length ? `<div class="cs-source-list">${sources.map((s) => `<article><div><b>${h(s.r.p.code || s.r.p.name)}</b><span>${h(s.q.name || s.q.fileName || "Financial report")} · ${s.date}</span>${interval ? `<small>${s.previous ? "Compared with " + s.previous.date : "First observation · excluded from changes"}</small>` : ""}</div><dl><div><dt>${interval ? "Spent change" : "Spent"}</dt><dd>${interval ? signed(s.spent) : money(s.spent)}</dd></div><div><dt>${interval ? "Exposure change" : "Exposure"}</dt><dd>${interval ? signed(s.exposure) : money(s.exposure)}</dd></div></dl><div class="cs-source-links">${selectProject(s.r, "Analyze project")}<a href="${url(s.r, "finance/reports")}">Open source reports ↗</a></div></article>`).join("")}</div>` : "<p>No preceding matched observation for this date.</p>"}</details>`;
  }
  function trend(R) {
    snapshots.delete("trend");
    const scope = scopedHistoryRows(R),
      all = reportSeries(scope),
      selected = timelineSelection(all);
    const interval = settings().mode === "interval";
    const points = selected.map((p) => (interval ? p.interval : p));
    historyCache = { rows: scope, all, points };
    const controls = trendControls(scope, all, selected);
    if (!all.length)
      return (
        controls +
        empty(
          "No dated expenditure yet",
          "Add a dated financial report with recorded actuals to build an evidence-based history.",
          '<a class="btn" href="#/data">Add source reports</a>',
        )
      );
    if (!points.length)
      return (
        controls +
        empty(
          "No reports in this date range",
          "Adjust the date range or return to full history. Current financial position is unchanged.",
          '<button class="btn" data-cs-action="reset-range">Show full history</button>',
        )
      );
    const picked =
      points.find((p) => p.date === api.getPickedDate()) || points.at(-1);
    const table = `<details class="mp-data-disclosure"><summary>Read the chart as a table</summary><div class="mp-scroll" tabindex="0" role="region" aria-label="Report history values"><table><caption>${interval ? "Changes use only newly reported projects with known values in both observations. An opening observation has no change; incomplete pairs stay unknown." : "Latest known report per project at each date. Missing amounts stay unknown."}</caption><thead><tr><th scope="col">Date</th><th scope="col">${interval ? "Spent change" : "Spent"}</th><th scope="col">${interval ? "Exposure change" : "Exposure"}</th><th scope="col">${interval ? "Matched actuals" : "Actuals coverage"}</th><th scope="col">${interval ? "Matched exposure" : "Exposure coverage"}</th>${interval ? '<th scope="col">Unmatched new actuals</th>' : ""}</tr></thead><tbody>${points.map((p) => `<tr ${p.date === picked.date ? 'class="cs-selected-data"' : ""}><td><button data-cs-action="pick-date" data-cs-value="${p.date}">${p.date}</button>${interval && p.from ? `<small>after ${p.from}</small>` : ""}</td><td>${money(p.spent)}</td><td>${money(p.exposure)}</td><td>${p.actualCount}/${p.total}</td><td>${p.exposureCount}/${p.total}</td>${interval ? `<td>${p.unmatchedActual || 0}</td>` : ""}</tr>`).join("")}</tbody></table></div></details>`;
    const readout = `<div class="mp-trend-readout" aria-live="polite"><div><small>${interval ? "Report change ending" : "Selected report date"}</small><b>${picked.date}</b>${interval ? `<span>${picked.from ? "after " + picked.from : "Opening observation"}</span>` : ""}</div><div><small>${interval ? "Spent change · " : "Spent · "}${picked.actualCount}/${picked.total} ${interval ? "matched" : "sources"}</small><b class="${picked.spent < 0 ? "cs-signed-adjustment" : ""}">${compact(picked.spent)}</b></div><div><small>${interval ? "Exposure change · " : "Spent + committed · "}${picked.exposureCount}/${picked.total} ${interval ? "matched" : "sources"}</small><b class="${picked.exposure < 0 ? "cs-signed-adjustment" : ""}">${compact(picked.exposure)}</b></div></div>`;
    const intervalNote = interval
      ? `<p class="cs-comparison-note"><b>Matched evidence, signed changes.</b> ${picked.from ? `${picked.actualCount} actuals pair${picked.actualCount === 1 ? "" : "s"} and ${picked.exposureCount} exposure pair${picked.exposureCount === 1 ? "" : "s"} at the selected date.` : "The opening observation cannot establish a change."} ${picked.unmatchedActual ? `${picked.unmatchedActual} new actuals source${picked.unmatchedActual === 1 ? "" : "s"} excluded because the preceding value is unknown.` : ""} A change spans each project's two report dates; projects may have different reporting intervals. Exposure changes include commitments.</p>`
      : "";
    snapshots.set("trend", {
      rows: scope,
      from: points[0].date,
      to: points.at(-1).date,
      count: picked.actualCount,
      total: scope.length,
      label: interval
        ? "Matched financial report changes"
        : "Cumulative financial report history",
      detail: interval
        ? "New coverage is excluded; signed corrections are retained. Each project change spans its own source dates."
        : "One latest known report per project at each date; cumulative snapshots are never added.",
    });
    return (
      controls +
      historySvg(points, picked, interval) +
      readout +
      intervalNote +
      sourcesDisclosure(picked, interval) +
      table +
      `<p class="mp-footnote">Actual dates determine horizontal spacing. ${interval ? "Values are signed differences between matched reports, not changes caused by new coverage." : "Coverage can change between dates; cumulative portfolio differences are not necessarily spending by the same projects."} Historical reports remain as recorded; current administrator adjustments belong in the register.</p>`
    );
  }
  function waterfall(R) {
    const complete = R.filter(
      (r) =>
        r.evidence.actual &&
        r.evidence.exposure &&
        r.evidence.committed &&
        [r.b, r.sp, r.co].every(finite),
    );
    const excluded = R.filter((r) => !complete.includes(r));
    if (!complete.length)
      return empty(
        "A complete bridge needs matched evidence",
        "No project in this selection has known actuals and commitments. Inspect source coverage or switch to Project comparison.",
      );
    const budget = sum(complete, "b"),
      spent = sum(complete, "sp"),
      committed = sum(complete, "co"),
      available = budget - spent - committed;
    const steps = [
      {
        name: "Approved",
        start: 0,
        end: budget,
        value: budget,
        color: "var(--studio-budget,var(--brand))",
        total: true,
      },
      {
        name: "Spent",
        start: budget,
        end: budget - spent,
        value: -spent,
        color: "var(--mp-spent)",
      },
      {
        name: "Committed",
        start: budget - spent,
        end: available,
        value: -committed,
        color: "var(--mp-committed)",
      },
      {
        name: available < 0 ? "Over budget" : "Available",
        start: 0,
        end: available,
        value: available,
        color: available < 0 ? "var(--bad)" : "var(--mp-available)",
        total: true,
      },
    ];
    const VW = mobileMedia.matches ? 430 : 760;
    const L = mobileMedia.matches ? 72 : 110,
      W = VW - L - 50,
      T = 38,
      B = 248;
    let min = Math.min(0, ...steps.flatMap((s) => [s.start, s.end]));
    let max = Math.max(1, ...steps.flatMap((s) => [s.start, s.end]));
    const pad = (max - min) * 0.12;
    if (min < 0) min -= pad;
    max += pad;
    const Y = (n) => B - ((n - min) / (max - min)) * (B - T),
      width = mobileMedia.matches ? 48 : 78,
      cell = W / 4;
    const svg = `<svg class="mp-chart cs-waterfall-chart" viewBox="0 0 ${VW} 295" role="img" aria-labelledby="cs-bridge-title cs-bridge-desc"><title id="cs-bridge-title">Current financial position: approved budget to remaining available funding</title><desc id="cs-bridge-desc">${complete.length} of ${R.length} projects with complete actuals and commitment evidence. Approved ${money(budget)}, spent ${money(spent)}, committed ${money(committed)}, available ${money(available)}. Negative recorded amounts increase remaining funding. Excluded projects are not treated as zero.</desc>${[0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${L}" x2="${L + W}" y1="${Y(min + (max - min) * f)}" y2="${Y(min + (max - min) * f)}" class="mp-gridline"/><text x="${L - 12}" y="${Y(min + (max - min) * f) + 4}" text-anchor="end">${compact(min + (max - min) * f)}</text>`).join("")}<line x1="${L}" x2="${L + W}" y1="${Y(0)}" y2="${Y(0)}" class="cs-zero-line"/>${steps
      .map((s, i) => {
        const x = L + cell * i + (cell - width) / 2,
          y = Math.min(Y(s.start), Y(s.end)),
          height = Math.max(1.5, Math.abs(Y(s.start) - Y(s.end)));
        return `${i < 3 ? `<line x1="${x + width}" x2="${L + cell * (i + 1) + (cell - width) / 2}" y1="${Y(s.end)}" y2="${Y(s.end)}" class="cs-bridge-connector"/>` : ""}<g data-tip="${h(s.name)}|${h((s.total ? "" : "Funding change ") + money(s.value))}|${complete.length}/${R.length} projects with complete sources"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${s.color}" opacity="${s.total ? 0.96 : 0.84}"/><text x="${x + width / 2}" y="${Math.max(20, y - 9)}" text-anchor="middle" class="cs-bridge-value">${s.total ? compact(s.value) : (s.value > 0 ? "+" : "") + compact(s.value)}</text><text x="${x + width / 2}" y="${B + 25}" text-anchor="middle">${mobileMedia.matches && s.name === "Committed" ? "Commit." : s.name}</text></g>`;
      })
      .join(
        "",
      )}<text x="${L}" y="16" class="cs-axis-unit">EUR · current financial bridge</text></svg>`;
    const coveredBudget = sum(excluded, "b");
    snapshots.set("allocation", {
      rows: complete,
      count: complete.length,
      total: R.length,
      label: "Current budget bridge",
      detail: `Only complete actuals and commitments included; ${excluded.length} projects and ${money(coveredBudget)} approved budget excluded from this bridge. Current records; historical date selection does not alter this chart.`,
    });
    return `<div class="cs-bridge-summary"><div><span>Complete sources</span><b>${complete.length}<small> / ${R.length} projects</small></b></div><div><span>Included approved funding</span><b>${compact(budget)}</b></div><div><span>${available < 0 ? "Covered overspend" : "Covered available funding"}</span><b class="${available < 0 ? "negative" : ""}">${compact(available)}</b></div></div>${svg}<p class="cs-comparison-note"><b>${complete.length}/${R.length} projects in this bridge.</b> ${excluded.length ? `${money(coveredBudget)} approved funding belongs to ${excluded.length} project${excluded.length === 1 ? "" : "s"} with incomplete actuals or commitments and is excluded. Remaining funding for that excluded group is unknown.` : "All selected projects have complete actuals and commitment evidence."} ${spent < 0 || committed < 0 ? "Negative recorded amounts increase remaining funding and remain signed." : "Spent and committed reduce approved funding; commitments exclude expenditure already spent."}</p><details class="mp-data-disclosure"><summary>Read the financial bridge as a table</summary><div class="mp-scroll"><table><caption>Current values for projects with complete sources; excluded project values are not treated as zero.</caption><thead><tr><th>Step</th><th>Recorded amount</th><th>Funding remaining</th></tr></thead><tbody><tr><td>Approved</td><td>${money(budget)}</td><td>${money(budget)}</td></tr><tr><td>Spent</td><td>${money(spent)}</td><td>${money(budget - spent)}</td></tr><tr><td>Committed</td><td>${money(committed)}</td><td>${money(available)}</td></tr><tr><td>Available</td><td>${money(available)}</td><td>${money(available)}</td></tr></tbody></table></div></details>`;
  }
  function projectComparison(R) {
    const percent = settings().allocation === "percent",
      sorted = [...R].sort((a, b) => b.b - a.b);
    const ratios = sorted.flatMap((r) => {
      const den = percent ? r.b : 1;
      if (den <= 0) return [];
      return [
        r.b / den,
        ...(r.evidence.actual ? [r.sp / den] : []),
        ...(r.evidence.exposure ? [r.u / den] : []),
      ];
    });
    const min = Math.min(0, ...ratios),
      max = Math.max(percent ? 1 : 1, ...ratios),
      span = max - min;
    const X = (v) => Math.min(100, Math.max(0, ((v - min) / span) * 100));
    const zero = X(0);
    return `${toggle(
      "allocation",
      [
        ["amount", "EUR"],
        ["percent", "% of budget"],
      ],
      "Project comparison scale",
    )}<div class="cs-comparison-key"><span><i class="spent"></i>Spent</span><span><i class="exposure"></i>Spent + committed</span><span><i class="budget"></i>Approved</span></div><div class="cs-project-comparison">${sorted
      .map((r) => {
        const den = percent ? r.b : 1,
          can = den > 0;
        const mark = (value, kind) => {
          const from = Math.min(zero, X(value)),
            to = Math.max(zero, X(value));
          return kind === "budget"
            ? `<i class="cs-budget-tick" style="left:${X(value)}%" title="Approved ${money(r.b)}"></i>`
            : `<i class="cs-comparison-bar ${kind}${value < 0 ? " cs-negative-bar" : ""}" style="left:${from}%;width:${Math.max(0.4, to - from)}%"></i>`;
        };
        const signedAdjustment = r.evidence.exposure && (r.sp < 0 || r.co < 0);
        return `<article><header><button data-cs-action="select-project" data-cs-value="${h(r.p.id)}" aria-pressed="${analysis().project === r.p.id}" aria-label="Analyze ${h(r.p.name)}"><i style="background:${entityColor("project", r.p.id)}"></i><span><b>${h(r.p.code || r.p.name)}</b><small>${h(r.cn)}</small></span></button><strong>${compact(r.b)}</strong></header><div class="cs-comparison-track" role="img" aria-label="${h(r.p.name)}: approved ${money(r.b)}; ${r.evidence.actual ? "spent " + money(r.sp) : "spent unknown"}; ${r.evidence.exposure ? "exposure " + money(r.u) : "exposure unknown"}"><i class="cs-comparison-zero" style="left:${zero}%"></i>${can ? `${mark(r.b / den, "budget")}${r.evidence.exposure ? mark(r.u / den, "exposure") : '<i class="cs-comparison-unknown"></i>'}${r.evidence.actual ? mark(r.sp / den, "spent") : ""}` : "<span>Positive approved budget required for percentages</span>"}</div><footer><span>${signedAdjustment ? "Signed adjustment · " : ""}${r.evidence.exposure ? (r.u > r.b ? money(r.u - r.b) + " over budget" : `${percent && r.b > 0 ? pc(r.u / r.b) + " used · " : ""}${compact(r.u)} exposure`) : "Exposure not recorded"}</span><a href="${url(r, "finance/budget")}">Source ↗</a></footer></article>`;
      })
      .join(
        "",
      )}</div><p class="mp-footnote">${percent ? "Percentages use each project’s own positive approved budget on a common scale." : "All projects share one signed EUR scale."} Approved funding is marked by a vertical tick. Missing exposure is hatched. Negative adjustments extend left of zero. Select a project to filter the analysis.</p>`;
  }
  function allocation(R) {
    snapshots.delete("allocation");
    if (!R.length)
      return empty(
        "No selected projects",
        "Choose a country or project to review current funding.",
      );
    const body =
      settings().bridge === "coverage" ? projectComparison(R) : waterfall(R);
    if (settings().bridge === "coverage")
      snapshots.set("allocation", {
        rows: R,
        count: R.filter((r) => r.evidence.exposure).length,
        total: R.length,
        label: "Current project funding comparison",
        detail:
          "Current approved funding, actuals and exposure on a common signed scale. Unknown exposure stays hatched; historical date selection does not alter this chart.",
      });
    return `<div class="mp-chart-controls">${toggle(
      "bridge",
      [
        ["waterfall", "Financial bridge"],
        ["coverage", "Project comparison"],
      ],
      "Current funding chart",
    )}<span>Current · EUR</span></div>${body}${currentCaption(R, "Approved funding and current exposure use current portfolio records; source dates may differ.")}`;
  }
  function pace(R) {
    snapshots.delete("pace");
    const valid = R.filter(
      (r) =>
        r.evidence.exposure &&
        r.b > 0 &&
        r.util >= 0 &&
        finite(r.el) &&
        r.s < r.e,
    );
    const excluded = R.length - valid.length;
    if (!valid.length)
      return empty(
        "Pace cannot be assessed yet",
        "Valid project dates, a positive approved budget and non-negative recorded exposure are required.",
      );
    const VW = mobileMedia.matches ? 430 : 660;
    const L = 70,
      W = VW - L - 60,
      T = 30,
      B = 250;
    const ceiling = Math.max(1.05, ...valid.map((r) => r.util)) * 1.12;
    const X = (v) => L + v * W,
      Y = (v) => B - (v / ceiling) * (B - T);
    const maxBudget = Math.max(...valid.map((r) => r.b));
    const color = (r) =>
      r.pace === null || r.g === "n"
        ? "var(--mute)"
        : r.g === "r"
          ? "var(--bad)"
          : r.g === "o"
            ? "var(--warn)"
            : "var(--good)";
    const yticks = uniq([
      0,
      0.25,
      0.5,
      0.75,
      1,
      ...(ceiling > 1.3 ? [Math.floor(ceiling * 2) / 2] : []),
    ]).filter((n) => n <= ceiling);
    const svg = `<svg class="mp-chart mp-pace-chart cs-pace-chart" viewBox="0 0 ${VW} 310" role="group" aria-labelledby="mp-pace-title mp-pace-desc"><title id="mp-pace-title">Current financial utilization compared with elapsed project time</title><desc id="mp-pace-desc">Circle area reflects approved budget. Select a circle to analyze that project. Financial pace is a straight-line timing comparison, not delivery completion. ${excluded} projects lack suitable evidence.</desc><path d="M${L} ${Y(1)}L${X(1)} ${Y(1)}L${X(1)} ${Y(ceiling)}L${L} ${Y(ceiling)}Z" fill="var(--bad)" opacity=".035"/>${[0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${X(f)}" x2="${X(f)}" y1="${T}" y2="${B}" class="mp-gridline"/><text x="${X(f)}" y="${B + 22}" text-anchor="middle">${pc(f)}</text>`).join("")}${yticks.map((f) => `<line x1="${L}" x2="${L + W}" y1="${Y(f)}" y2="${Y(f)}" class="mp-gridline"/><text x="${L - 10}" y="${Y(f) + 4}" text-anchor="end">${pc(f)}</text>`).join("")}<path d="M${X(0)} ${Y(0)}L${X(1)} ${Y(1)}" stroke="var(--mute)" stroke-dasharray="5 5" fill="none"/><text x="${X(0.43)}" y="${Y(0.43) - 8}" class="mp-annotation">Equal time and exposure</text>${valid.map((r) => `<g role="button" tabindex="0" class="cs-scatter-point" data-cs-action="select-project" data-cs-value="${h(r.p.id)}" aria-pressed="${analysis().project === r.p.id}" aria-label="Analyze ${h(r.p.name)}: ${pc(r.el)} time elapsed, ${pc(r.util)} budget used" data-tip="${h(r.p.name)}|${pc(r.util)} exposure · ${pc(r.el)} elapsed time|${r.pace === null ? "Pace not yet assessed" : r.pace.toFixed(2) + "× pace"} · ${h(SG[r.g]?.[0] || "Not assessed")}"><circle cx="${X(r.el)}" cy="${Y(r.util)}" r="${mobileMedia.matches ? 28 : 22}" fill="transparent"/><circle cx="${X(r.el)}" cy="${Y(r.util)}" r="${Math.sqrt(r.b / maxBudget) * 20}" fill="${color(r)}" fill-opacity=".2" stroke="${color(r)}" stroke-width="${analysis().project === r.p.id ? 3 : 1.8}"/><text x="${X(r.el)}" y="${Y(r.util) + 3}" text-anchor="middle" class="mp-bubble-label">${h(r.p.code?.split("-").at(-1) || "")}</text></g>`).join("")}<text x="${L + W / 2}" y="${B + 49}" text-anchor="middle">Elapsed project time →</text><text transform="translate(15 140) rotate(-90)" text-anchor="middle">Budget used →</text></svg>`;
    snapshots.set("pace", {
      rows: valid,
      count: valid.length,
      total: R.length,
      label: "Current financial pace",
      detail:
        "Budget exposure versus elapsed time; circle area reflects approved budget. A straight-line reference, not delivery completion. Historical date selection does not alter this chart.",
    });
    return (
      svg +
      `<div class="mp-legend"><span class="signal-good">On pace</span><span class="signal-warn">Slow absorption</span><span class="signal-bad">Fast burn</span><span class="signal-neutral">Not assessed</span></div><details class="mp-data-disclosure"><summary>Inspect projects and select a scope</summary><div class="mp-scroll"><table><caption>Current project dates and exposure; select a project to filter the whole analysis.</caption><thead><tr><th>Project</th><th>Time elapsed</th><th>Budget used</th><th>Pace</th><th>Source</th></tr></thead><tbody>${valid.map((r) => `<tr><td><button data-cs-action="select-project" data-cs-value="${h(r.p.id)}">${h(r.p.code || r.p.name)}</button></td><td>${pc(r.el)}</td><td>${pc(r.util)}</td><td>${r.pace === null ? "Not assessed" : r.pace.toFixed(2) + "×"}</td><td><a href="${url(r, "finance/reports")}">${h(r.evidence.latest?.date || "Manual / undated")} ↗</a></td></tr>`).join("")}</tbody></table></div></details>` +
      currentCaption(
        R,
        `${valid.length}/${R.length} projects plotted; ${excluded} excluded for missing dates, positive budget or non-negative exposure. Circle area reflects approved budget. Financial pace is not delivery completion.`,
      )
    );
  }
  function composition(R) {
    snapshots.delete("composition");
    const mode = settings().composition === "sector" ? "sector" : "country",
      groups = new Map();
    for (const r of R) {
      const key = mode === "country" ? r.p.country : r.p.sector || "Unassigned";
      if (!groups.has(key))
        groups.set(key, {
          key,
          label: mode === "country" ? r.cn : key,
          budget: 0,
          rows: [],
        });
      const g = groups.get(key);
      g.budget += Math.max(0, r.b);
      g.rows.push(r);
    }
    const all = [...groups.values()].sort((a, b) => b.budget - a.budget),
      total = all.reduce((n, g) => n + g.budget, 0);
    const controls = `<div class="mp-chart-controls">${toggle(
      "composition",
      [
        ["country", "By country"],
        ["sector", "By sector"],
      ],
      "Funding composition",
    )}<span>Current approved · EUR</span></div>`;
    if (!total)
      return (
        controls +
        empty(
          "No positive approved budgets",
          "Record positive approved funding to show composition. Zero and negative budgets remain in the project register.",
        )
      );
    const C = Math.PI * 2 * 79;
    let offset = 0;
    const chart = `<svg class="mp-chart mp-donut cs-composition-chart" viewBox="0 0 240 240" role="group" aria-labelledby="mp-composition-title"><title id="mp-composition-title">Current positive approved funding by ${mode}. Total ${money(total)}.</title><circle cx="120" cy="120" r="79" fill="none" stroke="var(--line)" stroke-width="19"/>${all
      .map((g) => {
        const length = (g.budget / total) * C,
          start = offset;
        offset += length;
        if (!length) return "";
        const action =
          mode === "country"
            ? `role="button" tabindex="0" data-cs-action="select-country" data-cs-value="${h(g.key)}" aria-label="Analyze ${h(g.label)}, ${pc(g.budget / total)} of current approved funding" aria-pressed="${analysis().country === g.key}"`
            : `role="img" aria-label="${h(g.label)}: ${pc(g.budget / total)} approved funding"`;
        return `<circle ${action} class="cs-ring-segment" cx="120" cy="120" r="79" transform="rotate(-90 120 120)" fill="none" stroke="${entityColor(mode === "country" ? "country" : "sector", g.key)}" stroke-width="19" stroke-dasharray="${length} ${Math.max(0, C - length)}" stroke-dashoffset="${-start}" data-tip="${h(g.label)}|${money(g.budget)} approved · ${pc(g.budget / total)}|${g.rows.length} projects"/>`;
      })
      .join(
        "",
      )}<text x="120" y="115" text-anchor="middle" class="mp-donut-number">${compact(total)}</text><text x="120" y="140" text-anchor="middle">approved budget</text></svg>`;
    const legend = `<div class="cs-composition-ranking">${all.map((g) => `<article><div>${mode === "country" ? `<button data-cs-action="select-country" data-cs-value="${h(g.key)}" aria-pressed="${analysis().country === g.key}" aria-label="Analyze ${h(g.label)}">` : "<b>"}<i style="background:${entityColor(mode === "country" ? "country" : "sector", g.key)}"></i>${h(g.label)}${mode === "country" ? "</button>" : "</b>"}<strong>${pc(g.budget / total)}</strong></div><span class="cs-composition-track"><i style="width:${(g.budget / total) * 100}%;background:${entityColor(mode === "country" ? "country" : "sector", g.key)}"></i></span><details><summary>${money(g.budget)} · ${g.rows.length} project${g.rows.length === 1 ? "" : "s"}</summary>${g.rows.map((r) => `<div class="cs-composition-project">${selectProject(r, r.p.code || r.p.name)}<a href="${url(r)}" aria-label="Open ${h(r.p.name)}">Project ↗</a></div>`).join("")}</details></article>`).join("")}</div>`;
    const nonPositive = R.filter((r) => r.b <= 0).length;
    snapshots.set("composition", {
      rows: R,
      count: R.length - nonPositive,
      total: R.length,
      label: `Current positive approved funding by ${mode}`,
      detail: `${nonPositive} zero or negative budgets excluded from funding shares; shares describe allocation, not expenditure or delivery. Historical date selection does not alter this chart.`,
    });
    return (
      controls +
      `<div class="mp-composition cs-composition">${chart}${legend}</div>` +
      currentCaption(
        R,
        `Shares describe positive funding allocation, not expenditure or delivery. ${nonPositive ? nonPositive + " zero or negative budgets are excluded from shares." : ""} Select a country or a project to filter all analysis panels.`,
      )
    );
  }
  function zoom(direction) {
    const { all, points } = historyCache;
    if (!all.length) return;
    const indices = points
      .map((p) => all.findIndex((q) => q.date === p.date))
      .filter((n) => n >= 0);
    const first = indices[0] ?? 0,
      last = indices.at(-1) ?? all.length - 1;
    const current = last - first + 1;
    const length =
      direction === "in"
        ? Math.max(2, Math.ceil(current / 2))
        : Math.min(all.length, Math.max(2, current * 2));
    const pick = all.findIndex((p) => p.date === api.getPickedDate());
    const center =
      direction === "in" && pick >= first && pick <= last
        ? pick
        : Math.floor((first + last) / 2);
    let start = Math.max(0, center - Math.floor((length - 1) / 2));
    if (start + length > all.length) start = Math.max(0, all.length - length);
    const end = Math.min(all.length - 1, start + length - 1);
    api.updateCharts({ window: "all" });
    api.setAnalysis({
      from: start === 0 && end === all.length - 1 ? "" : all[start].date,
      to: start === 0 && end === all.length - 1 ? "" : all[end].date,
    });
    api.announce(`History range ${all[start].date} to ${all[end].date}`);
  }
  function handleClick(button, event) {
    const action = button?.dataset.csAction;
    if (!action) return false;
    event?.preventDefault();
    const value = button.dataset.csValue;
    if (action === "option") commitCharts({ [button.dataset.csKey]: value });
    else if (action === "series") {
      const visible = visibleSeries(),
        wasVisible = visible.includes(value);
      if (wasVisible && visible.length === 1) {
        api.announce("Keep at least one financial series visible.");
        return true;
      }
      const next = wasVisible
        ? visible.filter((k) => k !== value)
        : [...visible, value];
      commitCharts({ series: next.length === 2 ? "both" : next[0] });
    } else if (action === "select-project") {
      const row = api.getBaseRows().find((r) => r.p.id === value);
      if (row) {
        api.updateCharts({ history: "all" });
        api.setAnalysis({
          project: analysis().project === value ? "" : value,
          country: row.p.country,
        });
        api.announce(
          analysis().project
            ? `Analysis selected: ${row.p.name}`
            : "Project selection cleared.",
        );
      }
    } else if (action === "select-country") {
      api.updateCharts({ history: "all" });
      api.setAnalysis({
        country: analysis().country === value ? "" : value,
        project: "",
      });
      api.announce("Country selection updated across the analysis.");
    } else if (action === "pick-date") {
      api.setPickedDate(value);
      api.render();
      const series = button.dataset.csSeries;
      requestAnimationFrame(() => {
        const matches = [
          ...document.querySelectorAll(
            '.cs-history-chart [data-cs-action="pick-date"]',
          ),
        ];
        (
          matches.find(
            (b) =>
              b.dataset.csValue === value &&
              (!series || b.dataset.csSeries === series),
          ) || matches.find((b) => b.dataset.csValue === value)
        )?.focus({ preventScroll: true });
      });
    } else if (action === "zoom") zoom(value);
    else if (action === "reset-range") {
      api.updateCharts({ window: "all" });
      api.setAnalysis({ from: "", to: "" });
      api.announce("Full report history restored.");
    } else return false;
    if (action !== "pick-date") restoreControl(button);
    return true;
  }
  function handleChange(el, event) {
    if (el?.dataset.csRange) {
      const all = historyCache.all,
        key = el.dataset.csRange,
        index = Math.max(0, Math.min(all.length - 1, Number(el.value)));
      if (!all[index]) return true;
      const a = analysis(),
        date = all[index].date,
        patch = { [key]: date };
      if (key === "from" && a.to && date > a.to) patch.to = date;
      if (key === "to" && a.from && date < a.from) patch.from = date;
      api.updateCharts({ window: "all" });
      api.setAnalysis(patch);
      api.announce(`${key === "from" ? "First" : "Last"} report: ${date}`);
      restoreControl(el);
      return true;
    }
    const key = el?.dataset.csOption;
    if (!key) return false;
    if (key === "from" || key === "to") {
      if (el.value && !isoDate(el.value)) {
        api.announce("Choose a valid report date.");
        return true;
      }
      const a = analysis(),
        patch = { [key]: el.value };
      if (key === "from" && a.to && el.value > a.to) patch.to = el.value;
      if (key === "to" && a.from && el.value && el.value < a.from)
        patch.from = el.value;
      api.updateCharts({ window: "all" });
      api.setAnalysis(patch);
    } else commitCharts({ [key]: el.value });
    restoreControl(el);
    return true;
  }
  function afterRender(view) {
    chartObserver?.disconnect();
    for (const svg of view.querySelectorAll(
      ".cs-history-chart,.cs-waterfall-chart,.cs-pace-chart",
    )) {
      sizeText(svg);
      chartObserver?.observe(svg);
    }
    if (binding.has(view)) return;
    binding.add(view);
    view.addEventListener(
      "keydown",
      (event) => {
        const target = event.target.closest(
          '.cs-history-chart [data-cs-action="pick-date"], .cs-scatter-point, .cs-ring-segment[data-cs-action]',
        );
        if (!target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          handleClick(target, event);
        } else if (
          target.matches('.cs-history-chart [data-cs-action="pick-date"]') &&
          ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          const series = target.dataset.csSeries;
          const choices = [
            ...view.querySelectorAll(
              `.cs-history-chart [data-cs-series="${series}"]`,
            ),
          ];
          const index = choices.indexOf(target),
            next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? choices.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        choices.length - 1,
                        index + (event.key === "ArrowLeft" ? -1 : 1),
                      ),
                    );
          handleClick(choices[next], event);
        }
      },
      true,
    );
    view.addEventListener("input", (event) => {
      const el = event.target;
      if (!el.dataset.csRange) return;
      const p = historyCache.all[Number(el.value)];
      if (!p) return;
      el.setAttribute("aria-valuetext", p.date);
      const navigator = el.closest("[data-cs-navigator]"),
        inputs = [...navigator.querySelectorAll("[data-cs-range]")];
      const readout = navigator.querySelector("[data-cs-range-readout]");
      readout.firstChild.textContent = `${historyCache.all[Number(inputs[0].value)]?.date || ""} — ${historyCache.all[Number(inputs[1].value)]?.date || ""} `;
    });
  }
  function exportContext(panelId, R) {
    const p = snapshots.get(panelId);
    if (!p)
      return {
        title: "Portfolio analysis",
        caption: sourceCaption(R),
        scope: scopeText(R),
      };
    return {
      title: p.label,
      scope: scopeText(p.rows),
      date: p.from
        ? p.from + (p.from !== p.to ? " to " + p.to : "")
        : "Current records · mixed source dates",
      coverage: `${p.count}/${p.total} ${panelId === "trend" && settings().mode === "interval" ? "matched actuals pairs at the selected date" : panelId === "trend" ? "actuals sources at the selected date" : "projects included"}`,
      caption: p.detail,
    };
  }
  function scopeText(R) {
    if (R.length === 1) return R[0].p.code + " · " + R[0].p.name;
    const countries = uniq(R.map((r) => r.cn));
    return `${R.length} projects · ${countries.length === 1 ? countries[0] : countries.length + " countries"} · EUR`;
  }
  function exportSVG(panelId, R) {
    if (panelId !== "allocation" || settings().bridge !== "coverage") return "";
    const percent = settings().allocation === "percent";
    const sorted = [...R].sort((a, b) => b.b - a.b);
    const vals = sorted.flatMap((r) => {
      const den = percent ? r.b : 1;
      return den > 0
        ? [
            r.b / den,
            ...(r.evidence.actual ? [r.sp / den] : []),
            ...(r.evidence.exposure ? [r.u / den] : []),
          ]
        : [];
    });
    const min = Math.min(0, ...vals),
      max = Math.max(1, ...vals);
    const L = 180,
      W = 510,
      rowHeight = 61,
      T = 66,
      H = T + sorted.length * rowHeight + 70;
    const X = (v) => L + ((v - min) / (max - min)) * W;
    const number = (v) => (percent ? pc(v) : compact(v));
    const bar = (v, y, color, opacity = 1) =>
      `<rect x="${Math.min(X(0), X(v))}" y="${y}" width="${Math.max(1.5, Math.abs(X(v) - X(0)))}" height="8" rx="2" fill="${color}" opacity="${opacity}"/>`;
    return `<svg class="mp-chart cs-project-comparison-export" viewBox="0 0 900 ${H}" role="img" aria-labelledby="cs-compare-export-title cs-compare-export-desc"><title id="cs-compare-export-title">Current approved funding, actuals and exposure by project</title><desc id="cs-compare-export-desc">${sorted.length} selected projects. ${percent ? "Percentages use each positive project budget." : "All projects share one signed EUR scale."} Spent is teal, spent plus committed is amber, approved funding is a vertical tick. Missing exposure remains hatched. Negative amounts extend left of zero. Current records are unchanged by historical date filtering.</desc><defs><pattern id="cs-export-missing" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line x1="0" x2="0" y1="0" y2="7" stroke="var(--line)" stroke-width="2"/></pattern></defs><g style="font-size:13px"><line x1="${L}" x2="${L + W}" y1="42" y2="42" stroke="var(--line)"/>${[min, (min + max) / 2, max].map((v, i) => `<text x="${X(v)}" y="30" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}" fill="var(--mute)">${number(v)}</text>`).join("")}<text x="730" y="30" fill="var(--mute)">Approved · exposure</text></g>${sorted
      .map((r, i) => {
        const y = T + i * rowHeight,
          den = percent ? r.b : 1;
        return `<g><text x="0" y="${y + 8}" fill="var(--ink)" style="font-size:14px;font-weight:600">${h(r.p.code || "Project")}</text><text x="0" y="${y + 25}" fill="var(--mute)" style="font-size:11px">${h(r.cn)}</text><rect x="${L}" y="${y}" width="${W}" height="25" rx="3" fill="var(--soft)"/><line x1="${X(0)}" x2="${X(0)}" y1="${y}" y2="${y + 25}" stroke="var(--mute)" opacity=".55"/>${den > 0 ? `${r.evidence.exposure ? bar(r.u / den, y + 3, "var(--mp-committed)", 0.55) : `<rect x="${L}" y="${y}" width="${W}" height="25" fill="url(#cs-export-missing)"/>`}${r.evidence.actual ? bar(r.sp / den, y + 14, "var(--mp-spent)") : ""}<line x1="${X(r.b / den)}" x2="${X(r.b / den)}" y1="${y - 3}" y2="${y + 28}" stroke="var(--studio-budget,var(--brand))" stroke-width="2"/>` : `<text x="${L + 8}" y="${y + 17}" fill="var(--mute)" style="font-size:12px">Positive approved budget required for percentages</text>`}<text x="730" y="${y + 9}" fill="var(--ink)" style="font-size:13px">${compact(r.b)} · ${r.evidence.exposure ? compact(r.u) : "unknown"}</text><text x="730" y="${y + 28}" fill="var(--mute)" style="font-size:11px">${h(r.evidence.latest?.date || (r.evidence.exposure ? "Manual / undated" : "No source"))}</text>${(r.evidence.actual && r.sp < 0) || (r.evidence.committed && r.co < 0) ? `<text x="${L}" y="${y + 41}" fill="var(--mute)" style="font-size:11px">Signed adjustment · spent ${r.evidence.actual ? money(r.sp) : "unknown"} · committed ${r.evidence.committed ? money(r.co) : "unknown"}</text>` : ""}<line x1="0" x2="900" y1="${y + 50}" y2="${y + 50}" stroke="var(--line)"/></g>`;
      })
      .join(
        "",
      )}<g transform="translate(0 ${H - 40})" style="font-size:12px"><line x1="0" x2="18" y1="0" y2="0" stroke="var(--mp-spent)" stroke-width="4"/><text x="25" y="4" fill="var(--mute)">Spent</text><line x1="106" x2="124" y1="0" y2="0" stroke="var(--mp-committed)" stroke-width="4"/><text x="131" y="4" fill="var(--mute)">Spent + committed</text><line x1="298" x2="298" y1="-5" y2="6" stroke="var(--studio-budget,var(--brand))" stroke-width="2"/><text x="308" y="4" fill="var(--mute)">Approved</text><text x="0" y="27" fill="var(--mute)">${h(sourceCaption(R))}. Missing exposure is unknown; current source dates can differ.</text></g></svg>`;
  }
  return {
    trend,
    allocation,
    pace,
    composition,
    handleClick,
    handleChange,
    afterRender,
    exportContext,
    exportSVG,
  };
}
