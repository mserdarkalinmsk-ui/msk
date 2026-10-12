/* Financial analysis: workbook tables → budget lines, headings, project and portfolio signals.
   Pure functions; the UI only supplies parsed sheet matrices (arrays of rows). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FG_ANALYSIS = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const HEADINGS = { 1: "Human resources", 2: "Travel", 3: "Equipment", 4: "Local office", 5: "Other costs, services", 6: "Other", 7: "Indirect costs", 8: "Contingency reserve", 9: "Other", 10: "Administrative costs" };
  const DAY = 86400000;
  const norm = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

  function toNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    let s = String(v ?? "").trim();
    if (!s) return 0;
    const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
    s = s.replace(/[^0-9.,]/g, "");
    if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (s.includes(",")) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? (negative ? -n : n) : 0;
  }

  function parseCSV(text) {
    const first = text.split(/\r?\n/, 1)[0] || "";
    const sep = [";", "\t", ","].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = []; let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim()));
  }

  // Score each cell against the alias lists; an exact alias match beats a partial one.
  function matchField(header, aliases) {
    const h = norm(header);
    if (!h) return null;
    let best = null;
    for (const [field, list] of Object.entries(aliases)) {
      list.forEach((alias, rank) => {
        const score = h === alias ? 100 - rank : alias.length > 3 && h.includes(alias) ? 50 - rank : 0;
        if (score > 0 && (!best || score > best.score)) best = { field, score };
      });
    }
    return best;
  }

  function detectTable(matrix, aliases, kind) {
    const needed = kind === "budget" ? ["budget"] : ["spent", "committed", "amount"];
    let best = null;
    matrix.slice(0, 40).forEach((row, index) => {
      const map = {}, scores = {};
      row.forEach((cell, col) => {
        const m = matchField(cell, aliases);
        if (m && (!(m.field in scores) || m.score > scores[m.field])) { map[m.field] = col; scores[m.field] = m.score; }
      });
      const fields = Object.keys(map);
      const score = fields.length * 10 + (fields.includes("key") ? 15 : 0) + (needed.some((f) => f in map) ? 30 : 0);
      if (fields.length >= 2 && (!best || score > best.score)) best = { index, map, score };
    });
    if (!best || !needed.some((f) => f in best.map)) {
      throw new Error(kind === "budget" ? "Approved budget amounts could not be identified. Expected a column such as “Approved Budget”." : "Actual expenditure / commitments could not be identified. Expected columns such as “Actual Expenditure” and “Open Commitments”.");
    }
    return best;
  }

  const isTotalRow = (key, desc) => /^(grand\s*)?(sub-?\s*)?total\b/i.test(String(desc).trim()) || /^(grand\s*)?(sub-?\s*)?total\b/i.test(String(key).trim());

  function parseSheet(matrix, aliases, kind) {
    const { index, map } = detectTable(matrix, aliases, kind);
    const at = (row, f) => (f in map ? row[map[f]] : "");
    const lines = new Map(); let skipped = 0;
    for (const row of matrix.slice(index + 1)) {
      const key = String(at(row, "key") ?? "").trim(), desc = String(at(row, "desc") ?? "").trim();
      if (!key && !desc) continue;
      if (isTotalRow(key, desc)) { skipped++; continue; }
      const id = key || desc;
      const line = lines.get(id) || { key: id, desc, budget: 0, spent: 0, committed: 0, units: 0, unit: "" };
      if (!line.desc && desc) line.desc = desc;
      if (kind === "budget") line.budget += toNumber(at(row, "budget"));
      else if ("spent" in map || "committed" in map) { line.spent += toNumber(at(row, "spent")); line.committed += toNumber(at(row, "committed")); }
      else {
        const amount = toNumber(at(row, "amount"));
        if (/commit|open|encumb|reserv|order/i.test(String(at(row, "type")))) line.committed += amount; else line.spent += amount;
      }
      line.units += toNumber(at(row, "units"));
      line.unit = line.unit || String(at(row, "unit") ?? "").trim();
      lines.set(id, line);
    }
    const headers = Object.fromEntries(Object.entries(map).map(([f, c]) => [f, String(matrix[index][c] ?? "")]));
    return { lines: [...lines.values()], headerRow: index + 1, headers, skipped };
  }

  function lineStatus(budget, exposure) {
    if (budget <= 0) return exposure > 0 ? "unbudgeted" : "idle";
    const util = (exposure / budget) * 100;
    return util > 100 ? "over" : util >= 90 ? "watch" : util < 25 ? "low" : "ok";
  }

  function compare(budget, report) {
    const reported = new Map(report.lines.map((l) => [norm(l.key), l]));
    const used = new Set();
    const lines = budget.lines.map((b) => {
      const r = reported.get(norm(b.key)); if (r) used.add(norm(b.key));
      const spent = r ? r.spent : 0, committed = r ? r.committed : 0, exposure = spent + committed;
      const unitsApproved = b.units || 0, unitsReported = r ? r.units : 0;
      return { key: b.key, desc: b.desc || (r && r.desc) || "", budget: b.budget, spent, committed, exposure,
        remaining: b.budget - exposure, util: b.budget ? (exposure / b.budget) * 100 : 0, status: lineStatus(b.budget, exposure),
        unit: b.unit || (r && r.unit) || "", unitsApproved, unitsReported, unitsExceeded: unitsApproved > 0 && unitsReported > unitsApproved };
    });
    report.lines.filter((l) => !used.has(norm(l.key))).forEach((r) => {
      const exposure = r.spent + r.committed;
      lines.push({ key: r.key, desc: r.desc, budget: 0, spent: r.spent, committed: r.committed, exposure, remaining: -exposure, util: 0, status: lineStatus(0, exposure), unit: r.unit, unitsApproved: 0, unitsReported: r.units, unitsExceeded: false, unmatched: true });
    });
    const totals = lines.reduce((t, l) => ({ budget: t.budget + l.budget, spent: t.spent + l.spent, committed: t.committed + l.committed }), { budget: 0, spent: 0, committed: 0 });
    totals.exposure = totals.spent + totals.committed;
    totals.remaining = totals.budget - totals.exposure;
    totals.util = totals.budget ? (totals.exposure / totals.budget) * 100 : 0;
    totals.spentRate = totals.budget ? (totals.spent / totals.budget) * 100 : 0;
    return { lines, totals, headings: headings(lines), counts: countBy(lines, "status"), unmatched: lines.filter((l) => l.unmatched).length, unitsExceeded: lines.filter((l) => l.unitsExceeded).length };
  }

  function headings(lines) {
    const groups = new Map();
    for (const l of lines) {
      const top = (String(l.key).match(/^\d+/) || ["Other"])[0];
      const g = groups.get(top) || { id: top, name: HEADINGS[top] || (top === "Other" ? "Other / unclassified" : `Budget Heading ${top}`), budget: 0, spent: 0, committed: 0, lines: 0 };
      g.budget += l.budget; g.spent += l.spent; g.committed += l.committed; g.lines++;
      groups.set(top, g);
    }
    return [...groups.values()].map((g) => {
      const exposure = g.spent + g.committed;
      return { ...g, exposure, remaining: g.budget - exposure, util: g.budget ? (exposure / g.budget) * 100 : 0, status: lineStatus(g.budget, exposure) };
    }).sort((a, b) => (Number(a.id) || 99) - (Number(b.id) || 99));
  }

  const countBy = (list, field) => list.reduce((c, x) => ((c[x[field]] = (c[x[field]] || 0) + 1), c), {});

  function parseDate(v) {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function addMonths(date, months) { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; }
  const monthsBetween = (a, b) => (b - a) / (DAY * 30.4375);

  // Timeline and continuity signals; the risk rule is carried over from v14.
  function projectSignals(project, totals, today = new Date()) {
    const start = parseDate(project.start), end = parseDate(project.end), lead = Number(project.leadMonths) || 12;
    const timePct = start && end && end > start ? Math.min(100, Math.max(0, ((today - start) / (end - start)) * 100)) : null;
    const monthsRemaining = end ? Math.max(0, Math.round(monthsBetween(today, end))) : null;
    const elapsedMonths = start ? Math.max(0, monthsBetween(start, today)) : null;
    const burn = totals && elapsedMonths >= 1 ? totals.spent / elapsedMonths : null;
    const forecast = totals ? (burn != null && monthsRemaining != null ? totals.exposure + burn * monthsRemaining : totals.exposure) : null;
    const prepDate = end ? addMonths(end, -lead) : null;
    const daysToPrep = prepDate ? Math.ceil((prepDate - today) / DAY) : null;
    const paceGap = timePct != null && totals ? totals.util - timePct : null;
    const overspent = totals ? totals.exposure > totals.budget && totals.budget > 0 : false;
    let risk = "Low";
    if (overspent || (daysToPrep != null && daysToPrep <= 0) || (monthsRemaining != null && monthsRemaining <= 6)) risk = "High";
    else if ((daysToPrep != null && daysToPrep < 180) || (paceGap != null && Math.abs(paceGap) > 20)) risk = "Medium";
    return { timePct, monthsRemaining, burn, forecast, prepDate, daysToPrep, paceGap, overspent, risk,
      forecastGap: forecast != null && totals ? totals.budget - forecast : null };
  }

  function setupScore(p) {
    const checks = [p.name, p.start, p.end, Number(p.staff) >= 0 && p.staff !== "" && p.staff != null, p.budgetFile, p.reportFile, p.donor];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function portfolio(projects, results, today = new Date()) {
    const analysed = projects.filter((p) => results[p.id] && !results[p.id].error);
    const totals = analysed.reduce((t, p) => { const r = results[p.id].totals; t.budget += r.budget; t.exposure += r.exposure; t.spent += r.spent; return t; }, { budget: 0, exposure: 0, spent: 0 });
    const signals = projects.map((p) => ({ project: p, ...projectSignals(p, results[p.id] && results[p.id].totals, today) }));
    const prepDates = signals.filter((s) => s.prepDate).sort((a, b) => a.prepDate - b.prepDate);
    return {
      totals, util: totals.budget ? (totals.exposure / totals.budget) * 100 : 0,
      staff: projects.reduce((a, p) => a + (Number(p.staff) || 0), 0),
      ending12: signals.filter((s) => s.monthsRemaining != null && s.monthsRemaining <= 12).length,
      prepDue: signals.filter((s) => s.daysToPrep != null && s.daysToPrep <= 0).length,
      nextPrep: prepDates.find((s) => s.daysToPrep > 0) || prepDates[0] || null,
      risk: countBy(signals, "risk"), coverage: [analysed.length, projects.length],
      readiness: projects.length ? Math.round(projects.reduce((a, p) => a + setupScore(p), 0) / projects.length) : 0,
      signals,
    };
  }

  return { HEADINGS, norm, toNumber, parseCSV, matchField, detectTable, parseSheet, compare, headings, projectSignals, setupScore, portfolio, addMonths, parseDate };
});
