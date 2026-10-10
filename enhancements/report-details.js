/* Source-backed optional report details. The uploaded financial reader and formulas stay intact. */
const LedgerReportDetails = (() => {
  const version = 1;
  const aliases = {
    code: ["line code", "budget line code", "budget line", "line", "code"],
    approvedUnits: ["approved units", "budget units", "approved quantity", "budget quantity", "number of units", "units", "quantity"],
    unitRate: ["approved unit cost", "approved unit rate", "budget unit cost", "budget unit rate", "unit rate", "unit cost", "cost per unit", "rate per unit"],
    actualUnits: ["actual units", "spent units", "reported actual units", "actual quantity", "spent quantity", "units spent", "units consumed"],
    actualUnitCost: ["actual unit cost", "spent unit cost", "actual unit rate", "spent unit rate", "actual cost per unit"],
    actual: ["actual", "actual expenditure", "actual amount", "spent", "spent amount", "expenditure", "sum of actual expenditure"],
    remainingUnits: ["remaining units", "remaining quantity", "units remaining", "remaining budget units"],
    unit: ["unit", "unit type", "unit of measure", "unit of measurement"],
    approvedUnit: ["approved unit type", "budget unit type", "approved unit of measure"],
    actualUnit: ["actual unit type", "spent unit type", "actual unit of measure"],
    staffNames: ["staff name", "staff names", "staff member name", "employee name", "employee names", "person name", "person names", "name of staff member"],
  };
  const normalized = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, new Set(names.map(n2))]));
  const numeric = new Set(["approvedUnits", "unitRate", "actualUnits", "actualUnitCost", "remainingUnits", "actual"]);
  const meaningful = ["approvedUnits", "unitRate", "actualUnits", "actualUnitCost", "remainingUnits", "staffNames", "actual"];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const own = (x, k) => !!x && Object.prototype.hasOwnProperty.call(x, k);
  const text = (value) => String(value ?? "").trim();
  function lineCode(value) {
    const match = text(value).match(/^(\d+(?:\.\d+)*)\b/);
    return match ? match[1] : null;
  }
  function columnName(index) {
    let result = "";
    for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    return result;
  }
  function number(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = pnum(value);
    return parsed !== null && Number.isFinite(parsed) ? parsed : null;
  }
  function fieldsAt(row) {
    const found = {};
    row.forEach((cell, index) => {
      const name = n2(cell);
      for (const [key, names] of Object.entries(normalized)) if (names.has(name)) (found[key] ||= []).push(index);
    });
    return found;
  }
  function addConflict(record, field, reason, values = []) {
    if (!record.conflicts.some((item) => item.field === field && item.reason === reason)) record.conflicts.push({ field, reason, values });
    delete record.fields[field];
    record.presence[field] = false;
  }
  function fieldConflict(record, field) {
    return (record?.conflicts || []).some((item) => item.field === field);
  }
  async function extract(file) {
    const result = { version, fileName: text(file?.name), fileSize: Number(file?.size) || 0, status: "unrecognized", lines: {}, issues: [] };
    try {
      const buffer = await file.arrayBuffer();
      const isWorkbook = /\.xlsx$/i.test(result.fileName) || (new Uint8Array(buffer)[0] === 80 && new Uint8Array(buffer)[1] === 75);
      const workbook = isWorkbook ? await wbOpen(buffer) : { names: ["CSV"], rows: async () => parseCSV(new TextDecoder().decode(buffer)) };
      let recognized = 0;
      for (const sheet of workbook.names) {
        const rows = await workbook.rows(sheet);
        let headers = null, headerRow = -1;
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          const candidate = fieldsAt(row);
          if (candidate.code?.length && meaningful.some((key) => candidate[key]?.length)) {
            headers = candidate;
            headerRow = index;
            recognized++;
            continue;
          }
          if (!headers) continue;
          if (headers.code.length !== 1) {
            result.issues.push({ sheet, row: headerRow + 1, reason: "Multiple line-code columns; details were not matched." });
            headers = null;
            continue;
          }
          const code = lineCode(row[headers.code[0]]);
          if (!code || /\b(subtotal|total)\b/i.test(text(row[headers.code[0]]))) continue;
          const record = result.lines[code] ||= { fields: {}, presence: {}, provenance: { sheet, row: index + 1, columns: {}, sources: {} }, conflicts: [] };
          for (const [field, columns] of Object.entries(headers)) {
            if (field === "code") continue;
            const sources = columns.map((column) => ({ fileName: result.fileName, sheet, row: index + 1, column: columnName(column), columnIndex: column, header: text(rows[headerRow][column]) }));
            (record.provenance.sources[field] ||= []).push(...sources);
            record.provenance.columns[field] ||= sources[0];
            if (columns.length !== 1) {
              addConflict(record, field, "Multiple columns identify this field.");
              continue;
            }
            const raw = row[columns[0]];
            if (!text(raw)) {
              if (!own(record.presence, field)) record.presence[field] = false;
              continue;
            }
            let value;
            if (numeric.has(field)) {
              value = number(raw);
              if (value === null || (value < 0 && !["remainingUnits", "actual", "actualUnitCost"].includes(field))) {
                addConflict(record, field, "Source value is not a valid quantity or rate.", [text(raw)]);
                continue;
              }
            } else if (field === "staffNames") {
              value = [...new Set(text(raw).split(/[;|\n]+/).map(text).filter(Boolean))];
            } else value = text(raw);
            if (fieldConflict(record, field)) continue;
            if (own(record.fields, field) && !same(record.fields[field], value)) {
              addConflict(record, field, "Conflicting values for the same line code; no aggregation was applied.", [record.fields[field], value]);
              continue;
            }
            record.fields[field] = value;
            record.presence[field] = true;
          }
        }
      }
      result.status = !recognized ? "unrecognized" : Object.values(result.lines).some((record) => record.conflicts.length) || result.issues.length ? "partial" : "recognized";
    } catch (error) {
      result.status = "error";
      result.issues.push({ reason: String(error?.message || "Source details could not be read") });
    }
    return result;
  }
  const originalReadSnapshot = readSnapshot;
  readSnapshot = async function (file, ...args) {
    const snapshot = await originalReadSnapshot.call(this, file, ...args);
    snapshot.ledgerDetails = await extract(file);
    return snapshot;
  };
  function measure(value = null, state = "missing", label = "Not supplied by the source", provenance = []) {
    return { value, state, label, provenance };
  }
  function recordFor(report, code) {
    const details = report?.snapshot?.ledgerDetails;
    return details?.version === version ? details.lines?.[code] : null;
  }
  function sourceMeasure(report, code, key) {
    const record = recordFor(report, code);
    const provenance = (record?.provenance?.sources?.[key] || []).map((source) => ({ ...source, reportId: report.id, reportName: report.name, reportDate: report.date }));
    if (fieldConflict(record, key)) return measure(null, "conflict", "Source values conflict; no value selected", provenance);
    if (record?.presence?.[key] === true && own(record.fields, key)) return measure(record.fields[key], "source", "Explicit source value", provenance);
    return measure(null, "missing", "Not supplied by the source", provenance);
  }
  function approvedMeasure(report, code, key) {
    const explicit = sourceMeasure(report, code, key);
    if (explicit.state !== "missing") return explicit;
    const line = (report?.snapshot?.lines || []).find((item) => String(item.code) === code);
    const raw = line?.[key];
    const value = number(raw);
    const provenance = report ? [{ reportId: report.id, reportName: report.name, reportDate: report.date, fileName: report.fileName || "", field: key }] : [];
    if (own(line, key) && value !== null && value > 0) return measure(value, "legacy", "Value retained in the original snapshot; source cell presence was not recorded", provenance);
    if (own(line, key) && value === 0) return measure(null, "ambiguous", "Legacy zero may represent a missing source column", provenance);
    return explicit;
  }
  function unitMeasure(report, code, side) {
    const scoped = sourceMeasure(report, code, side === "actual" ? "actualUnit" : "approvedUnit");
    if (scoped.state !== "missing") return scoped;
    const generic = sourceMeasure(report, code, "unit");
    if (generic.state !== "missing") return generic;
    const raw = (report?.snapshot?.lines || []).find((item) => String(item.code) === code)?.unit;
    if (text(raw)) return measure(text(raw), "legacy", "Unit type retained in the original snapshot", [{ reportId: report.id, reportName: report.name, reportDate: report.date, fileName: report.fileName || "", field: "unit" }]);
    return generic;
  }
  const unitAliases = { day: "day", days: "day", month: "month", months: "month", personmonth: "personmonth", personmonths: "personmonth", staffmonth: "personmonth", staffmonths: "personmonth", personday: "personday", persondays: "personday", hour: "hour", hours: "hour", item: "item", items: "item", unit: "unit", units: "unit" };
  function compatibleUnits(a, b) {
    if (a.value === null || b.value === null) return false;
    const left = n2(a.value), right = n2(b.value);
    return !!left && (unitAliases[left] || left) === (unitAliases[right] || right);
  }
  function project(p) {
    const report = reps(p).at(-1) || null;
    const budget = effB(p, report?.date) || null;
    const current = finAt(p, report);
    const budgetAfterReport = !!(budget && report && budget.date > report.date);
    const approvedSource = budget || report;
    const lines = current.lines.map((line) => {
      const code = String(line.code);
      const approvedUnits = approvedMeasure(approvedSource, code, "approvedUnits");
      const unitRate = approvedMeasure(approvedSource, code, "unitRate");
      const approvedUnit = unitMeasure(approvedSource, code, "approved");
      const actualUnit = unitMeasure(report, code, "actual");
      const actualUnits = sourceMeasure(report, code, "actualUnits");
      let actualAmount = sourceMeasure(report, code, "actual");
      if (actualAmount.state === "missing") {
        const raw = (report?.snapshot?.lines || []).find((item) => String(item.code) === code)?.actual;
        const value = number(raw);
        if (value !== null && value !== 0) actualAmount = measure(value, "legacy", "Non-zero actual expenditure retained in the original report snapshot", [{ reportId: report.id, reportName: report.name, reportDate: report.date, field: "actual" }]);
        else if (value === 0) actualAmount = measure(null, "ambiguous", "Legacy zero may represent a missing actual expenditure column");
      }
      let actualUnitCost = sourceMeasure(report, code, "actualUnitCost");
      if (actualUnitCost.state === "missing" && actualUnits.value !== null && actualUnits.value > 0 && actualAmount.value !== null && actualAmount.value === line.actual) actualUnitCost = measure(line.actual / actualUnits.value, "derived", "Derived: source-established actual expenditure ÷ explicitly reported actual units", [...actualUnits.provenance, ...actualAmount.provenance]);
      if (actualUnitCost.state === "missing" && actualAmount.value === null) actualUnitCost.label = "Actual expenditure is not source-established; no unit cost derived";
      let remainingUnits = sourceMeasure(report, code, "remainingUnits");
      if (remainingUnits.state === "missing" && approvedUnits.value !== null && actualUnits.value !== null) {
        remainingUnits = budgetAfterReport ? measure(null, "chronology", "The selected budget is dated after the report; no unit balance derived") : compatibleUnits(approvedUnit, actualUnit) ? measure(approvedUnits.value - actualUnits.value, "derived", "Derived: approved units − actual units; compatible source unit types", [...approvedUnits.provenance, ...actualUnits.provenance, ...approvedUnit.provenance, ...actualUnit.provenance]) : measure(null, "incompatible", "Remaining units cannot be calculated until source unit types are compatible", [...approvedUnit.provenance, ...actualUnit.provenance]);
      }
      const staffNames = sourceMeasure(report, code, "staffNames");
      return { code, description: line.desc, financial: { approved: line.approved, actual: line.actual, spentCommitted: line.sc, remaining: line.approved - line.sc, forecast: line.forecast }, fields: { approvedUnits, unitRate, actualUnits, actualUnitCost, actualAmount, remainingUnits, unit: approvedUnit, approvedUnit, actualUnit, staffNames } };
    });
    const issues = [budget, report].filter(Boolean).flatMap((source) => (source.snapshot?.ledgerDetails?.issues || []).map((issue) => ({ ...issue, reportId: source.id, reportName: source.name })));
    return { version, budget, report, budgetAfterReport, lines, issues, status: report ? "report" : budget ? "budget-only" : "no-source" };
  }
  async function hydrate(p, options = {}) {
    const latest = reps(p).at(-1);
    const budget = effB(p, latest?.date);
    const targets = options.all ? RP(p) : [...new Set([budget, latest].filter(Boolean))];
    const updates = [], issues = [];
    for (const report of targets) {
      if (report.snapshot?.ledgerDetails?.version === version && report.snapshot.ledgerDetails.status === "recognized" && !options.force) continue;
      const documents = (p.docs || []).filter((doc) => doc.ref === report.id && ["budget", "report"].includes(doc.kind));
      if (documents.length !== 1) {
        issues.push({ reportId: report.id, reason: documents.length ? "Multiple retained files reference this report; no file selected." : "No retained original file is linked to this report." });
        continue;
      }
      const doc = documents[0];
      const stored = await IDB.getFile(doc.id);
      if (!stored) {
        issues.push({ reportId: report.id, docId: doc.id, reason: "The retained original file is unavailable in this browser." });
        continue;
      }
      const file = new File([stored], doc.fileName || report.fileName || "source.csv", { type: doc.mime || "" });
      const details = await extract(file);
      updates.push({ reportId: report.id, docId: doc.id, details });
    }
    return { updates, issues };
  }
  const api = Object.freeze({ version, extract, project, hydrate });
  window.LedgerReportDetails = api;
  return api;
})();
