/* Planned schedule workspace. Source dates never imply delivery completion. */
function createScheduleStudio(api) {
  "use strict";
  const DAY = 86400000;
  const DEFAULTS = {
    zoom: "quarter",
    window: "all",
    focus: "",
    from: "",
    to: "",
    milestones: true,
    financial: true,
  };
  const expanded = new Set();
  const ui = {
    start: 0,
    end: 0,
    width: 0,
    scroll: 0,
    center: null,
    pendingToday: false,
    selectedEvent: null,
    selectedCluster: [],
    events: [],
    signature: "",
    focus: null,
  };
  const h = api.h;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const date = (t) => new Date(t).toISOString().slice(0, 10);
  const today = () => new Date().toISOString().slice(0, 10);
  const stamp = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
    const t = Date.parse(value + "T00:00:00Z");
    return Number.isFinite(t) && date(t) === value ? t : null;
  };
  const dateLabel = (value) => {
    const t = typeof value === "number" ? value : stamp(value);
    return t === null
      ? "Date not recorded"
      : new Date(t).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
  };
  const monthStart = (t) =>
    Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), 1);
  const shiftMonth = (t, amount) =>
    Date.UTC(
      new Date(t).getUTCFullYear(),
      new Date(t).getUTCMonth() + amount,
      1,
    );
  const weekStart = (t) => t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
  const projectUrl = (p, section = "overview") =>
    "#/project/" + encodeURIComponent(p.id) + "/" + section;
  const icon = (name) => (api.icon ? api.icon(name) : "");
  function preferences() {
    const all = api.getSettings ? api.getSettings() || {} : {};
    const raw = all.schedule || all;
    return {
      ...DEFAULTS,
      zoom: ["quarter", "month", "week"].includes(raw.zoom)
        ? raw.zoom
        : DEFAULTS.zoom,
      window: raw.window === "focus" ? "focus" : "all",
      focus: typeof raw.focus === "string" ? raw.focus : "",
      from: stamp(raw.from) !== null ? raw.from : "",
      to: stamp(raw.to) !== null ? raw.to : "",
      milestones: raw.milestones !== false,
      financial: raw.financial !== false,
    };
  }
  function snapshotScroll() {
    const scroller = document.querySelector(".ss-scroll");
    if (scroller) ui.scroll = scroller.scrollLeft;
    const active = document.activeElement;
    if (active && active.closest(".ss-studio")) {
      if (active.dataset.ssAction)
        ui.focus = `[data-ss-action="${CSS.escape(active.dataset.ssAction)}"]${active.dataset.ssValue ? `[data-ss-value="${CSS.escape(active.dataset.ssValue)}"]` : ""}${active.dataset.ssId ? `[data-ss-id="${CSS.escape(active.dataset.ssId)}"]` : ""}${active.dataset.ssEvent ? `[data-ss-event="${CSS.escape(active.dataset.ssEvent)}"]` : ""}`;
      else if (active.dataset.ssChange)
        ui.focus = `[data-ss-change="${CSS.escape(active.dataset.ssChange)}"]`;
    }
  }
  function update(patch) {
    snapshotScroll();
    if (api.updateSchedule) api.updateSchedule(patch);
    api.render();
  }
  function isExpanded(id) {
    const set = api.getExpanded ? api.getExpanded() : expanded;
    return set && typeof set.has === "function"
      ? set.has(id)
      : expanded.has(id);
  }
  function toggleExpanded(id) {
    const next = new Set(
      api.getExpanded ? api.getExpanded() || expanded : expanded,
    );
    next.has(id) ? next.delete(id) : next.add(id);
    if (api.setExpanded) api.setExpanded(next);
    else {
      expanded.clear();
      next.forEach((k) => expanded.add(k));
    }
  }
  function activities(r) {
    const base = stamp(r.p.doa && r.p.doa.start) ?? stamp(r.p.start);
    if (base === null) return [];
    return ((r.p.doa && r.p.doa.acts) || []).map((a) => {
      const months = (key) =>
        [
          ...new Set(
            (Array.isArray(a[key]) ? a[key] : [])
              .map(Number)
              .filter((m) => Number.isInteger(m) && m > 0 && m <= 1200),
          ),
        ].sort((x, y) => x - y);
      const P = months("P"),
        E = months("E"),
        X = months("X");
      return {
        a,
        P,
        E,
        X,
        base,
        scheduled: P.length + E.length + X.length > 0,
      };
    });
  }
  function eventsFor(R) {
    const events = [];
    /* One malformed imported plan must not hide other projects' recorded events. */
    R.forEach((r) => {
      try {
        (api.portfolioEvents([r]) || []).forEach((e) => {
          const t = stamp(e.date);
          if (t !== null) events.push({ ...e, t });
        });
      } catch (_) {
        /* The row still exposes its source plan and missing-date note. */
      }
    });
    return events.sort(
      (a, b) => a.t - b.t || String(a.p.id).localeCompare(String(b.p.id)),
    );
  }
  function boundaries(valid, prefs) {
    const focus = valid.find((r) => r.p.id === prefs.focus);
    let lo = Math.min(...valid.map((r) => r.start)),
      hi = Math.max(...valid.map((r) => r.end));
    if (prefs.window === "focus" && focus) {
      lo = focus.start;
      hi = focus.end;
    }
    const customFrom = stamp(prefs.from),
      customTo = stamp(prefs.to);
    if (customFrom !== null) lo = customFrom;
    if (customTo !== null) hi = customTo;
    if (hi < lo)
      return {
        error:
          "The planned-date window ends before it starts. Reset the window or choose a later end date.",
      };
    let start, end;
    if (prefs.zoom === "week") {
      start = weekStart(lo);
      end = weekStart(hi) + 7 * DAY;
    } else if (prefs.zoom === "month") {
      start = monthStart(lo);
      end = shiftMonth(hi, 1);
    } else {
      const first = new Date(lo),
        last = new Date(hi);
      start = Date.UTC(
        first.getUTCFullYear(),
        Math.floor(first.getUTCMonth() / 3) * 3,
        1,
      );
      end = Date.UTC(
        last.getUTCFullYear(),
        Math.floor(last.getUTCMonth() / 3) * 3 + 3,
        1,
      );
    }
    return { start, end, lo, hi };
  }
  function ticks(start, end, zoom) {
    const out = [];
    let t = start;
    const interval = zoom === "quarter" ? 3 : 1;
    for (let i = 0; t < end && i < 1600; i++) {
      const next = zoom === "week" ? t + 7 * DAY : shiftMonth(t, interval);
      const d = new Date(t);
      const label =
        zoom === "quarter"
          ? "Q" + (Math.floor(d.getUTCMonth() / 3) + 1)
          : zoom === "month"
            ? d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
            : d.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              });
      out.push({
        start: t,
        end: Math.min(next, end),
        label,
        year: d.getUTCFullYear(),
      });
      t = next;
    }
    return out;
  }
  function stage(r) {
    const now = stamp(today());
    return now < r.start
      ? ["Scheduled", "planned"]
      : now > r.end
        ? ["Past scheduled end", "past"]
        : ["Within scheduled dates", "active"];
  }
  function selectedProject(id) {
    const analysis = api.getAnalysis ? api.getAnalysis() || {} : {};
    return analysis.project === id;
  }
  function selectProject(id) {
    if (!api.setAnalysis) return;
    snapshotScroll();
    const current = api.getAnalysis ? api.getAnalysis() || {} : {};
    api.setAnalysis({
      ...current,
      country: "all",
      project: current.project === id ? "all" : id,
    });
    if (api.announce)
      api.announce(
        current.project === id
          ? "Project analysis filter cleared"
          : "Analysis filtered to the selected project",
      );
  }
  function sourceSheet() {
    const e = ui.selectedEvent;
    if (!e) return "";
    const sourceFile =
      e.kind === "milestone"
        ? e.p.doa?.planFileName || e.p.doa?.fileName
        : e.p.contract?.fileName;
    const siblings = ui.selectedCluster.filter((v) => v !== e);
    return `<aside class="ss-source-sheet" role="region" aria-label="Selected schedule source"><div><span class="ss-kicker">Recorded ${h(e.kind || "event")}</span><h3>${h(e.label || "Schedule event")}</h3><p><strong>${h(dateLabel(e.t))}</strong> · ${h(e.p.code || e.p.name)} · ${e.done ? "Recorded as done" : "Completion not recorded"}</p>${e.detail ? `<p>${h(e.detail)}</p>` : ""}${sourceFile ? `<p class="ss-source-file">Source file: <strong>${h(sourceFile)}</strong></p>` : ""}${siblings.length ? `<div class="ss-cluster-list"><span>${siblings.length} other event${siblings.length === 1 ? "" : "s"} at this marker</span>${siblings.map((v) => `<button type="button" data-ss-action="event" data-ss-event="${ui.events.indexOf(v)}" data-ss-cluster="${ui.selectedCluster.map((c) => ui.events.indexOf(c)).join(",")}">${h(v.label)} · ${h(dateLabel(v.t))}</button>`).join("")}</div>` : ""}</div><div class="ss-source-actions"><a class="btn" href="${h(e.link || projectUrl(e.p))}">Open source ${icon("arrow")}</a><button type="button" class="btn" data-ss-action="project-filter" data-ss-id="${h(e.p.id)}">${selectedProject(e.p.id) ? "Clear project selection" : "Analyze this project"}</button><button type="button" class="ss-dismiss" data-ss-action="close-event" aria-label="Close selected schedule event">×</button></div></aside>`;
  }
  function timeline(R) {
    const prefs = preferences();
    if (ui.selectedEvent && !R.some((r) => r.p.id === ui.selectedEvent.p.id)) {
      ui.selectedEvent = null;
      ui.selectedCluster = [];
    }
    const baseRows = api.getBaseRows ? api.getBaseRows() : R;
    const decorated = R.map((r) => ({
      ...r,
      start: stamp(r.p.start),
      end: stamp(r.p.end),
    }));
    const valid = decorated
      .filter((r) => r.start !== null && r.end !== null && r.end >= r.start)
      .sort((a, b) => a.end - b.end || a.start - b.start);
    const invalid = decorated.filter((r) => !valid.includes(r));
    const plannedRows = valid.filter((r) => activities(r).length);
    const allExpanded =
      plannedRows.length > 0 && plannedRows.every((r) => isExpanded(r.p.id));
    const range = valid.length ? boundaries(valid, prefs) : null;
    const toolbar = `<div class="ss-controls"><div class="ss-zoom" role="group" aria-label="Schedule time scale">${["quarter", "month", "week"].map((z) => `<button type="button" data-ss-action="zoom" data-ss-value="${z}" aria-pressed="${prefs.zoom === z}" class="${prefs.zoom === z ? "active" : ""}">${z === "quarter" ? "Quarter" : z === "month" ? "Month" : "Week"}</button>`).join("")}</div><div class="ss-controls-actions"><button type="button" class="btn" data-ss-action="fit">All dates</button><button type="button" class="btn" data-ss-action="today">Today</button>${plannedRows.length ? `<button type="button" class="btn" data-ss-action="expand-all">${allExpanded ? "Collapse activities" : "Expand activities"}</button>` : ""}</div><label class="ss-focus">Focus schedule<select aria-label="Focus project schedule" data-ss-change="focus"><option value="">Whole selection</option>${baseRows.map((r) => `<option value="${h(r.p.id)}"${prefs.focus === r.p.id && prefs.window === "focus" ? " selected" : ""}>${h(r.p.code || r.p.name)}</option>`).join("")}</select></label></div><div class="ss-window-bar"><details class="ss-window"><summary>${prefs.from || prefs.to ? "Custom planned-date window" : "Planned-date window"}<span>${range && !range.error ? h(dateLabel(range.lo)) + " — " + h(dateLabel(range.hi)) : "Recorded project dates"}</span></summary><div class="ss-window-fields"><label>From<input type="date" data-ss-change="from" value="${h(prefs.from)}" aria-label="Schedule window start"></label><label>To<input type="date" data-ss-change="to" value="${h(prefs.to)}" aria-label="Schedule window end"></label><button type="button" class="btn" data-ss-action="apply-window">Apply window</button><button type="button" class="btn" data-ss-action="reset-window">Reset</button><small>This window controls planned dates. Report-history filters remain separate.</small></div></details><div class="ss-display"><label><input type="checkbox" data-ss-change="milestones"${prefs.milestones ? " checked" : ""}>Recorded events</label><label><input type="checkbox" data-ss-change="financial"${prefs.financial ? " checked" : ""}>Financial context</label></div></div>`;
    const invalidNotice = invalid.length
      ? `<p class="ss-warning">${invalid.length} project${invalid.length === 1 ? " has" : "s have"} missing, invalid or reversed dates and cannot be plotted: ${invalid.map((r) => `<a href="${projectUrl(r.p)}">${h(r.p.code || r.p.name)}</a>`).join(", ")}. Correct the recorded dates in the project.</p>`
      : "";
    if (!valid.length || range.error) {
      return `<section class="ss-studio">${toolbar}<div class="ss-empty"><strong>${range && range.error ? "Check the planned-date window" : "A recorded schedule starts here"}</strong><p>${h((range && range.error) || (R.length ? "Add valid start and end dates to plot this selection." : "No projects match this analysis selection."))}</p><a class="btn" href="#/projects">Open projects</a></div>${invalidNotice}${sourceSheet()}</section>`;
    }
    const { start, end } = range,
      span = end - start;
    const timeTicks = ticks(start, end, prefs.zoom);
    const measured = Math.max(
      360,
      (document.querySelector(".ss-scroll")?.clientWidth || 960) - 246,
    );
    const px = prefs.zoom === "quarter" ? 36 : prefs.zoom === "month" ? 78 : 88;
    const width = Math.min(64000, Math.max(measured, timeTicks.length * px));
    const x = (t) => ((t - start) / span) * 100;
    const now = stamp(today()),
      hasToday = now >= start && now < end;
    ui.start = start;
    ui.end = end;
    ui.width = width;
    const signature = `${start}/${end}/${prefs.zoom}/${R.map((r) => r.p.id).join(",")}`;
    if (ui.signature !== signature && ui.center === null && !ui.pendingToday)
      ui.scroll = 0;
    ui.signature = signature;
    const allEvents = eventsFor(valid),
      windowEvents = allEvents.filter((e) => e.t >= start && e.t < end);
    ui.events = windowEvents;
    const grid = timeTicks
      .map(
        (t) =>
          `<i class="ss-grid-line" style="left:${x(t.start)}%" aria-hidden="true"></i>`,
      )
      .join("");
    const todayLine = hasToday
      ? `<i class="ss-today-line" style="left:${x(now)}%" aria-hidden="true"></i>`
      : "";
    const clipBar = (a, b, className, title, link, color) => {
      if (b <= start || a >= end) return "";
      const left = x(Math.max(a, start)),
        right = x(Math.min(b, end));
      return `<a class="${className}${a < start ? " ss-clipped-start" : ""}${b > end ? " ss-clipped-end" : ""}" style="left:${left}%;width:${Math.max(0.12, right - left)}%;--ss-project-color:${color}" href="${h(link)}" title="${h(title)}" aria-label="${h(title)}"></a>`;
    };
    function markers(r, localEvents) {
      if (!prefs.milestones) return "";
      /* Closely spaced dates share a count marker instead of hiding each other. */
      const clusters = [];
      localEvents.forEach((e) => {
        const previous = clusters.at(-1),
          position = ((e.t - start) / span) * width;
        if (previous && position - previous.position < 20)
          previous.events.push(e);
        else clusters.push({ position, events: [e] });
      });
      return clusters
        .map((cluster) => {
          const e = cluster.events[0],
            eventIndex = ui.events.indexOf(e),
            label =
              cluster.events.length > 1
                ? `${cluster.events.length} recorded events beginning ${dateLabel(e.t)}`
                : `${e.label} · ${dateLabel(e.t)} · ${e.done ? "recorded as done" : "completion not recorded"}`;
          return `<button type="button" class="ss-event-marker ss-event-${h(e.kind || "other")}${cluster.events.length > 1 ? " clustered" : ""}" style="left:${clamp(x(e.t), 0.6, 99.4)}%" data-ss-action="event" data-ss-event="${eventIndex}" data-ss-cluster="${cluster.events.map((v) => ui.events.indexOf(v)).join(",")}" title="${h(label)}" aria-label="${h(label)}">${cluster.events.length > 1 ? `<b>${cluster.events.length}</b>` : `<i aria-hidden="true"></i>`}</button>`;
        })
        .join("");
    }
    const rowsMarkup = valid
      .map((r) => {
        const p = r.p,
          acts = activities(r),
          open = isExpanded(p.id),
          color = api.entityColor("project", p.id),
          phase = stage(r),
          localEvents = windowEvents.filter((e) => e.p.id === p.id);
        const financialKnown =
          !!r.evidence?.exposure &&
          Number.isFinite(r.b) &&
          r.b > 0 &&
          Number.isFinite(r.util);
        const financial = prefs.financial
          ? `<span class="ss-financial"><b>${financialKnown ? h(api.pc(r.util)) : "—"}</b><span>${financialKnown ? "spent + committed / budget" : !r.evidence?.exposure ? "exposure not evidenced" : "budget not established"}</span></span>`
          : "";
        const projectTitle = `${p.name} · scheduled ${dateLabel(r.start)} to ${dateLabel(r.end)}. Duration is not delivery completion.`;
        const projectRow = `<div class="ss-project-row${selectedProject(p.id) ? " ss-selected" : ""}" data-ss-project="${h(p.id)}"><div class="ss-label"><div class="ss-label-heading">${acts.length ? `<button type="button" class="ss-expand" data-ss-action="expand" data-ss-id="${h(p.id)}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} planned activities for ${h(p.code || p.name)}">${open ? "−" : "+"}</button>` : `<span class="ss-expand-space"></span>`}<a href="${projectUrl(p)}"><b>${h(p.code || "Project")}</b><span>${h(p.name)}</span></a><button type="button" class="ss-select-project${selectedProject(p.id) ? " active" : ""}" data-ss-action="project-filter" data-ss-id="${h(p.id)}" aria-pressed="${selectedProject(p.id)}" aria-label="${selectedProject(p.id) ? "Clear analysis filter for" : "Filter analysis to"} ${h(p.code || p.name)}">${icon("filter") || "↗"}</button></div><small class="ss-row-date">${h(dateLabel(r.start))} — ${h(dateLabel(r.end))}</small>${financial}</div><div class="ss-track">${grid}${todayLine}${clipBar(r.start, r.end + DAY, "ss-project-bar", projectTitle, projectUrl(p), color)}<span class="ss-phase ss-phase-${phase[1]}">${phase[0]}</span>${markers(r, localEvents)}${r.end < start || r.start >= end ? `<span class="ss-outside">Outside this planned-date window</span>` : ""}</div></div>`;
        const activityRows = open
          ? acts
              .map(({ a, P, E, X, base, scheduled }) => {
                const title =
                    (a.code ? a.code + " " : "") +
                    (a.name || "Planned activity"),
                  link = projectUrl(p, "delivery/plan"),
                  status = a.status || "Status not recorded";
                const segments = (months, kind, label) =>
                  months
                    .map((m) => {
                      const lo = shiftMonth(base, m - 1),
                        hi = shiftMonth(base, m);
                      return clipBar(
                        lo,
                        hi,
                        "ss-activity-segment ss-" + kind,
                        `${title} · planned ${label} in ${dateLabel(lo)} · recorded status: ${status}`,
                        link,
                        color,
                      );
                    })
                    .join("");
                const diamonds = prefs.milestones
                  ? X.map((m) => {
                      const t = shiftMonth(base, m - 1);
                      return t >= start && t < end
                        ? `<a class="ss-activity-milestone" style="left:${clamp(x(t), 0.6, 99.4)}%" href="${link}" aria-label="${h(title + " · recorded milestone in " + dateLabel(t))}" title="${h(title + " · recorded milestone in " + dateLabel(t))}"></a>`
                        : "";
                    }).join("")
                  : "";
                return `<div class="ss-activity-row" data-ss-activity="${h(a.id || a.code || title)}"><div class="ss-label ss-activity-label"><a href="${link}">${h(title)}</a><small>${h(status)}${a.impl ? " · " + h(a.impl) : ""}</small></div><div class="ss-track">${grid}${todayLine}${segments(P, "preparation", "preparation")}${segments(E, "execution", "execution")}${diamonds}${!scheduled ? `<span class="ss-outside">No valid planned months recorded</span>` : ""}</div></div>`;
              })
              .join("")
          : "";
        return projectRow + activityRows;
      })
      .join("");
    const years = [];
    timeTicks.forEach((t) => {
      let group = years.at(-1);
      if (!group || group.year !== t.year) {
        group = { year: t.year, start: t.start, end: t.end };
        years.push(group);
      } else group.end = t.end;
    });
    const ruler = `<div class="ss-column-head"><div class="ss-label ss-column-label"><b>Project & recorded plan</b><small>${valid.length} projects · ${windowEvents.length} recorded events in view</small></div><div class="ss-axis"><div class="ss-axis-years">${years.map((y) => `<span style="left:${x(y.start)}%;width:${x(y.end) - x(y.start)}%">${y.year}</span>`).join("")}</div><div class="ss-axis-ticks">${timeTicks.map((t) => `<span style="left:${x(t.start)}%;width:${x(t.end) - x(t.start)}%">${h(t.label)}</span>`).join("")}</div>${hasToday ? `<b class="ss-today-label" style="left:${clamp(x(now), 1.6, 98.4)}%">Today</b>` : ""}</div></div>`;
    const eventList = windowEvents.length
      ? `<details class="ss-event-list"><summary><b>${windowEvents.length}</b> recorded events in this window<span>Dates, recorded status and source</span></summary><div class="ss-event-items">${windowEvents
          .slice(0, 80)
          .map(
            (e, i) =>
              `<button type="button" data-ss-action="event" data-ss-event="${i}"><time datetime="${h(e.date)}">${h(dateLabel(e.t))}</time><span><b>${h(e.label)}</b><small>${h(e.p.code)} · ${h(e.kind)} · ${e.done ? "recorded as done" : "completion not recorded"}</small></span><span aria-hidden="true">↗</span></button>`,
          )
          .join(
            "",
          )}${windowEvents.length > 80 ? `<p class="ss-note">Showing the earliest 80 of ${windowEvents.length} recorded events. Narrow the planned-date window or open the <a href="#/calendar">calendar</a>.</p>` : ""}</div></details>`
      : "";
    return `<section class="ss-studio" data-ss-start="${date(start)}" data-ss-end="${date(end - DAY)}" data-ss-zoom="${prefs.zoom}">${toolbar}<div class="ss-scroll-hint"><span>Scroll horizontally for the full schedule</span><span>Labels stay in view ${icon("arrow")}</span></div><div class="portfolio-timeline-scroll ss-scroll" tabindex="0" role="region" aria-label="Interactive planned project schedule, ${h(prefs.zoom)} scale"><div class="ss-canvas" style="--ss-axis-width:${width}px">${ruler}${rowsMarkup}</div></div><div class="ss-legend"><span><i class="ss-legend-project"></i>Scheduled project duration</span>${plannedRows.length ? `<span><i class="ss-legend-preparation"></i>Planned preparation</span><span><i class="ss-legend-execution"></i>Planned execution</span>` : ""}${prefs.milestones ? `<span><i class="ss-legend-event"></i>Recorded event</span>` : ""}<span><i class="ss-legend-today"></i>Today</span></div><p class="ss-note">Bars show recorded planned dates, not actual delivery completion. Financial use = (spent + committed) ÷ approved budget and is shown separately; — means evidence or budget is unavailable. Activity colours identify projects; activity status is shown as recorded.${!hasToday ? " Today is outside this planned-date window." : ""}</p>${invalidNotice}${sourceSheet()}${eventList}</section>`;
  }
  function handleClick(button, event) {
    if (!button || !button.dataset.ssAction) return false;
    const action = button.dataset.ssAction;
    const prefs = preferences();
    if (action === "zoom") {
      const scroller = button
        .closest(".ss-studio")
        ?.querySelector(".ss-scroll");
      const labelWidth = scroller
        ? parseFloat(
            getComputedStyle(scroller.closest(".ss-studio")).getPropertyValue(
              "--ss-label-width",
            ),
          ) || 246
        : 246;
      const offset = scroller
        ? Math.max(
            0,
            scroller.scrollLeft +
              Math.max(0, scroller.clientWidth - labelWidth) / 2,
          )
        : 0;
      ui.center =
        ui.start + clamp(offset / (ui.width || 1), 0, 1) * (ui.end - ui.start);
      update({ zoom: button.dataset.ssValue });
    } else if (action === "fit") {
      ui.center = null;
      ui.scroll = 0;
      update({ zoom: "quarter", window: "all", focus: "", from: "", to: "" });
    } else if (action === "today") {
      const now = stamp(today());
      ui.pendingToday = true;
      if (now < ui.start || now >= ui.end)
        update({
          window: "all",
          focus: "",
          from: date(shiftMonth(now, -6)),
          to: date(shiftMonth(now, 7) - DAY),
        });
      else {
        snapshotScroll();
        afterRender(button.closest(".ss-studio")?.parentElement || document);
      }
      if (api.announce) api.announce("Schedule centered on today");
    } else if (action === "expand") {
      snapshotScroll();
      toggleExpanded(button.dataset.ssId);
      api.render();
    } else if (action === "expand-all") {
      snapshotScroll();
      const ids = [
        ...document.querySelectorAll(".ss-project-row .ss-expand"),
      ].map((b) => b.dataset.ssId);
      const close = ids.length && ids.every(isExpanded);
      ids.forEach((id) => {
        if (isExpanded(id) === !!close) toggleExpanded(id);
      });
      api.render();
    } else if (action === "apply-window") {
      const studio = button.closest(".ss-studio"),
        from = studio.querySelector('[data-ss-change="from"]').value,
        to = studio.querySelector('[data-ss-change="to"]').value;
      if (from && to && to < from) {
        if (api.announce)
          api.announce("Schedule end must be on or after the start date");
        studio
          .querySelector('[data-ss-change="to"]')
          .setCustomValidity("Choose an end date on or after the start date.");
        studio.querySelector('[data-ss-change="to"]').reportValidity();
        return true;
      }
      update({ from, to, window: "all", focus: "" });
    } else if (action === "reset-window") {
      ui.scroll = 0;
      update({ from: "", to: "", window: "all", focus: "" });
    } else if (action === "project-filter") selectProject(button.dataset.ssId);
    else if (action === "event") {
      const selected = ui.events[Number(button.dataset.ssEvent)];
      if (!selected) return true;
      snapshotScroll();
      ui.selectedEvent = selected;
      ui.selectedCluster = button.dataset.ssCluster
        ? button.dataset.ssCluster
            .split(",")
            .map((i) => ui.events[Number(i)])
            .filter(Boolean)
        : [];
      api.render();
      const sheet = document.querySelector(".ss-source-sheet");
      if (sheet) {
        sheet.setAttribute("tabindex", "-1");
        sheet.focus({ preventScroll: true });
        sheet.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    } else if (action === "close-event") {
      snapshotScroll();
      ui.selectedEvent = null;
      ui.selectedCluster = [];
      api.render();
    } else return false;
    return true;
  }
  function handleChange(el) {
    if (!el || !el.dataset.ssChange) return false;
    const key = el.dataset.ssChange;
    if (key === "focus") {
      ui.center = null;
      ui.scroll = 0;
      update({
        focus: el.value,
        window: el.value ? "focus" : "all",
        from: "",
        to: "",
      });
    } else if (key === "milestones" || key === "financial")
      update({ [key]: el.checked });
    else if (key === "from" || key === "to") {
      el.setCustomValidity("");
    } else return false;
    return true;
  }
  function afterRender(view) {
    const scope = view && view.querySelector ? view : document;
    scope.querySelectorAll(".ss-scroll").forEach((scroller) => {
      const labelWidth =
        parseFloat(
          getComputedStyle(scroller.closest(".ss-studio")).getPropertyValue(
            "--ss-label-width",
          ),
        ) || 246;
      const available = Math.max(0, scroller.clientWidth - labelWidth),
        max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      ui.width =
        scroller.querySelector(".ss-axis")?.getBoundingClientRect().width ||
        ui.width;
      let left = ui.scroll;
      if (ui.pendingToday || ui.center !== null) {
        const center = ui.pendingToday ? stamp(today()) : ui.center;
        left =
          ((center - ui.start) / (ui.end - ui.start || 1)) * ui.width -
          available / 2;
        ui.pendingToday = false;
        ui.center = null;
      }
      scroller.scrollLeft = clamp(left, 0, max);
      if (!scroller.dataset.ssBound) {
        scroller.dataset.ssBound = "true";
        scroller.addEventListener(
          "scroll",
          () => {
            ui.scroll = scroller.scrollLeft;
          },
          { passive: true },
        );
      }
    });
    if (ui.focus) {
      const active = scope.querySelector(".ss-studio " + ui.focus);
      if (active) active.focus({ preventScroll: true });
      else
        scope
          .querySelector('.ss-zoom button[aria-pressed="true"]')
          ?.focus({ preventScroll: true });
      ui.focus = null;
    }
  }
  return { timeline, handleClick, handleChange, afterRender };
}
