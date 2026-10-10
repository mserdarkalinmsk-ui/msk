/* Offline register exports. No workbook library or remote service is required. */
function createRegisterExports(api) {
  const { COLUMNS, tableValue, tableCell, tableTotal, download2, announce } =
    api;
  const encoder = new TextEncoder();
  const escape = (value) =>
    String(value ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const safeText = (value) => {
    const text = String(value ?? "");
    return /^[=+\-@]/.test(text.trimStart()) ? "'" + text : text;
  };
  const plain = (value) => {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(plain).join(" · ");
    if (typeof value === "object")
      return Object.entries(value)
        .map(([key, item]) => key + ": " + plain(item))
        .join("; ");
    return String(value);
  };
  const numeric = (value) =>
    typeof value === "number" && Number.isFinite(value);
  const dateISO = (value) => {
    const text =
      value instanceof Date ? value.toISOString() : String(value || "");
    const candidate = text.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
    const timestamp = Date.parse(candidate + "T00:00:00Z");
    return Number.isFinite(timestamp) &&
      new Date(timestamp).toISOString().slice(0, 10) === candidate
      ? candidate
      : null;
  };
  const excelDate = (value) => {
    const date = dateISO(value);
    return date
      ? (Date.parse(date + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000
      : null;
  };
  const columnName = (index) => {
    let name = "";
    for (let n = index + 1; n; n = Math.floor((n - 1) / 26))
      name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
  };
  const selectedColumns = (columns) =>
    [...new Set(columns || Object.keys(COLUMNS))].filter((key) => COLUMNS[key]);
  const label = (key) => COLUMNS[key]?.label || key;
  const kind = (key) =>
    key === "date" ? "date" : COLUMNS[key]?.kind || "text";
  const captionColumn = (columns) =>
    columns.includes("name")
      ? columns.indexOf("name")
      : columns.findIndex((key) => kind(key) === "text");
  const source = (row) => row.evidence?.latest || {};
  const known = (row, key) => {
    const value = tableValue(row, key);
    return (
      value !== null &&
      value !== undefined &&
      (typeof value !== "number" || Number.isFinite(value))
    );
  };
  const coverage = (rows, key) => rows.filter((row) => known(row, key)).length;
  function contextRows(rows, columns, context) {
    const dates = [
      ...new Set(
        rows.map((row) => dateISO(tableValue(row, "date"))).filter(Boolean),
      ),
    ].sort();
    const exported = context.exportDate || new Date().toISOString();
    return [
      ["Report", context.title || "Portfolio project register"],
      [
        "Scope",
        plain(context.scope) || "Supplied filtered or selected records",
      ],
      ["Exported projects", rows.length],
      ["Exported at", plain(exported)],
      [
        "Currency",
        "EUR; values are numeric euros, not compacted thousands or millions",
      ],
      [
        "Active filters",
        plain(context.filters) || "No additional filters supplied",
      ],
      ["Selected columns", columns.map(label).join("; ")],
      [
        "Report dates",
        plain(context.reportDates) ||
          (dates.length ? dates.join("; ") : "No dated reports recorded"),
      ],
      [
        "Current versus reported",
        "Register values are current model values and may include administrator adjustments. Historical report values are preserved in their source reports; report dates identify the latest source and are not a common portfolio cut-off.",
      ],
      [
        "Exposure",
        "Spent + committed; commitments exclude spent. Missing evidence remains blank; a recorded zero remains zero.",
      ],
      [
        "Available",
        "Current approved budget minus recorded exposure. Negative available funds remain negative.",
      ],
      [
        "Budget used",
        "Exposure / approved budget. Undefined for missing exposure or non-positive budget. Excel stores the numeric fraction and displays a percentage.",
      ],
      [
        "Estimate and variance",
        "Estimate at completion follows each project's supported forecast method and active scenario. Projected variance = approved budget minus estimate; positive variance is projected unspent budget, not confirmed savings.",
      ],
      [
        "Totals",
        "Monetary totals sum known values only. Coverage is shown for each monetary measure. The portfolio budget-used total is budget weighted and appears only when all exported projects have a valid value.",
      ],
      [
        "Calculations / scenario",
        plain(context.calculations || context.scenario) ||
          "Current application calculations and scenario at export time",
      ],
      ["Spent coverage", coverage(rows, "spent") + "/" + rows.length],
      ["Commitment coverage", coverage(rows, "committed") + "/" + rows.length],
      ["Exposure coverage", coverage(rows, "exposure") + "/" + rows.length],
      ["Estimate coverage", coverage(rows, "forecast") + "/" + rows.length],
      [
        "Missing values",
        "Blank workbook cells and dashes in printed output mean the required source is not recorded. They are not zeros.",
      ],
      [
        "Formula safety",
        "Text is exported as inline strings; formula-like text is prefixed with an apostrophe. Numeric negative amounts remain numeric.",
      ],
    ];
  }
  function totalValue(rows, key) {
    if (COLUMNS[key]?.kind === "money") {
      const values = rows.map((row) => tableValue(row, key)).filter(numeric);
      return values.length
        ? values.reduce((sum, value) => sum + value, 0)
        : null;
    }
    if (
      key === "used" &&
      rows.length &&
      rows.every((row) => numeric(tableValue(row, key)))
    ) {
      const budget = rows.reduce(
        (sum, row) =>
          sum +
          (numeric(tableValue(row, "budget")) ? tableValue(row, "budget") : 0),
        0,
      );
      return budget > 0
        ? rows.reduce((sum, row) => sum + tableValue(row, "exposure"), 0) /
            budget
        : null;
    }
    return null;
  }

  // ZIP storage entries are deliberately uncompressed: this keeps the exporter synchronous,
  // dependency-free and compatible with browsers where compression streams are unavailable.
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let k = 0; k < 8; k++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    crcTable[n] = value >>> 0;
  }
  function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes)
      value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
  }
  function zip(entries) {
    const parts = [],
      directory = [];
    let offset = 0,
      directorySize = 0;
    const today = new Date();
    const year = Math.max(1980, Math.min(2107, today.getFullYear()));
    const dosTime =
      (today.getHours() << 11) |
      (today.getMinutes() << 5) |
      (today.getSeconds() >> 1);
    const dosDate =
      ((year - 1980) << 9) | ((today.getMonth() + 1) << 5) | today.getDate();
    for (const [path, content] of entries) {
      const name = encoder.encode(path),
        bytes = encoder.encode(content),
        crc = crc32(bytes);
      const header = new Uint8Array(30 + name.length),
        local = new DataView(header.buffer);
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x800, true);
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, bytes.length, true);
      local.setUint32(22, bytes.length, true);
      local.setUint16(26, name.length, true);
      header.set(name, 30);
      parts.push(header, bytes);
      const central = new Uint8Array(46 + name.length),
        record = new DataView(central.buffer);
      record.setUint32(0, 0x02014b50, true);
      record.setUint16(4, 20, true);
      record.setUint16(6, 20, true);
      record.setUint16(8, 0x800, true);
      record.setUint16(12, dosTime, true);
      record.setUint16(14, dosDate, true);
      record.setUint32(16, crc, true);
      record.setUint32(20, bytes.length, true);
      record.setUint32(24, bytes.length, true);
      record.setUint16(28, name.length, true);
      record.setUint32(42, offset, true);
      central.set(name, 46);
      directory.push(central);
      directorySize += central.length;
      offset += header.length + bytes.length;
    }
    const end = new Uint8Array(22),
      footer = new DataView(end.buffer);
    footer.setUint32(0, 0x06054b50, true);
    footer.setUint16(8, entries.length, true);
    footer.setUint16(10, entries.length, true);
    footer.setUint32(12, directorySize, true);
    footer.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, end], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;€&quot; #,##0.00;[Red]-&quot;€&quot; #,##0.00;&quot;€&quot; 0.00"/><numFmt numFmtId="165" formatCode="0.0%;[Red]-0.0%;0.0%"/><numFmt numFmtId="166" formatCode="yyyy-mm-dd"/></numFmts>
<fonts count="4"><font><sz val="11"/><color rgb="FF24364A"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="20"/><color rgb="FF15364B"/><name val="Aptos Display"/></font><font><b/><sz val="11"/><color rgb="FF15364B"/><name val="Aptos"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF15364B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9F4F0"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD7E0E7"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  function cell(value, reference, style = 0, type = "text") {
    if (value == null || (typeof value === "number" && !Number.isFinite(value)))
      return `<c r="${reference}" s="${style}"/>`;
    if (type === "date") {
      const serial = excelDate(value);
      if (serial !== null)
        return `<c r="${reference}" s="5"><v>${serial}</v></c>`;
    }
    if (numeric(value))
      return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
    return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escape(safeText(plain(value)).slice(0, 32767))}</t></is></c>`;
  }
  function worksheet(title, subtitle, headers, records, options = {}) {
    const endColumn = columnName(headers.length - 1);
    const rowXML = (values, number, style = 0, height = "") =>
      `<row r="${number}"${height ? ` ht="${height}" customHeight="1"` : ""}>${values.map((value, index) => cell(value, columnName(index) + number, typeof style === "function" ? style(index) : style, options.types?.[index])).join("")}</row>`;
    let xml =
      rowXML([title], 1, 2, 32) +
      rowXML([subtitle], 2, 9, 36) +
      rowXML(headers, 4, 1, 32);
    records.forEach((record, index) => {
      const height = Math.min(
        165,
        Math.max(
          25,
          ...record.map(
            (value, i) =>
              Math.ceil(
                plain(value).length /
                  Math.max(12, (options.widths?.[i] || 22) - 2),
              ) *
                14 +
              7,
          ),
        ),
      );
      xml += rowXML(
        record,
        index + 5,
        (i) =>
          options.types?.[i] === "money"
            ? 3
            : options.types?.[i] === "percent"
              ? 4
              : options.types?.[i] === "date"
                ? 5
                : 0,
        height,
      );
    });
    let lastRow = records.length + 4;
    if (options.totals) {
      lastRow += 2;
      xml += rowXML(
        options.totals,
        lastRow,
        (i) =>
          options.types?.[i] === "money"
            ? 7
            : options.types?.[i] === "percent"
              ? 8
              : 6,
        26,
      );
      if (options.coverage) {
        lastRow++;
        xml += rowXML(options.coverage, lastRow, 9, 30);
      }
    }
    const widths = headers
      .map(
        (_, index) =>
          `<col min="${index + 1}" max="${index + 1}" width="${options.widths?.[index] || 22}" customWidth="1"/>`,
      )
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${endColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="25"/><cols>${widths}</cols><sheetData>${xml}</sheetData>${records.length ? `<autoFilter ref="A4:${endColumn}${records.length + 4}"/>` : ""}${headers.length > 1 ? `<mergeCells count="2"><mergeCell ref="A1:${endColumn}1"/><mergeCell ref="A2:${endColumn}2"/></mergeCells>` : ""}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LPortfolio Ledger&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter></worksheet>`;
  }
  function xlsx(rows, columns, context = {}) {
    rows = Array.isArray(rows) ? rows : [];
    columns = selectedColumns(columns);
    if (!columns.length) columns = [Object.keys(COLUMNS)[0]];
    const exported = plain(context.exportDate || new Date().toISOString());
    const caption = captionColumn(columns);
    const totals = columns.map((key, index) =>
      index === caption ? "Exported totals" : totalValue(rows, key),
    );
    const counts = columns.map((key, index) =>
      COLUMNS[key]?.kind === "money"
        ? `${coverage(rows, key)}/${rows.length} sources`
        : index === caption
          ? `${rows.length} exported projects`
          : "",
    );
    const data = rows.map((row) => columns.map((key) => tableValue(row, key)));
    const sources = rows.map((row) => [
      row.p.id,
      row.p.code,
      row.p.name,
      row.cn,
      row.p.sector || "",
      row.p.funding || "",
      source(row).date || "",
      source(row).fileName || source(row).name || "Manual project record",
      known(row, "spent") ? "Recorded" : "Missing",
      known(row, "committed") ? "Recorded" : "Missing",
      known(row, "exposure") ? "Recorded" : "Missing",
      known(row, "forecast") ? "Supported" : "Not supported",
      Object.keys(row.p.adminOverrides || {}).length
        ? "Yes; current values include adjustments"
        : "No",
      row.basis || "",
    ]);
    const sheets = [
      [
        "Register",
        worksheet(
          context.title || "Portfolio project register",
          `${rows.length} projects · EUR · ${plain(context.scope) || "Exported records"} · ${exported}`,
          columns.map(label),
          data,
          {
            types: columns.map(kind),
            widths: columns.map((key) =>
              key === "name"
                ? 38
                : key === "signal"
                  ? 26
                  : kind(key) === "money"
                    ? 23
                    : 20,
            ),
            totals,
            coverage: counts,
          },
        ),
      ],
      [
        "Project sources",
        worksheet(
          "Project identity and source coverage",
          "Zero is a recorded value. Missing evidence is distinct from zero; current values may include adjustments.",
          [
            "Project ID",
            "Code",
            "Project",
            "Country",
            "Sector",
            "Funding",
            "Latest report date",
            "Latest source",
            "Actuals",
            "Commitments",
            "Exposure",
            "Estimate",
            "Administrator adjustments",
            "Forecast basis",
          ],
          sources,
          {
            types: ["text", "text", "text", "text", "text", "text", "date"],
            widths: [25, 18, 38, 22, 24, 24, 20, 42, 17, 17, 17, 20, 36, 22],
          },
        ),
      ],
      [
        "Context",
        worksheet(
          "Export context and calculation notes",
          "This workbook is a snapshot; original source documents remain in the application and full backup.",
          ["Item", "Value / explanation"],
          contextRows(rows, columns, context),
          { widths: [32, 110] },
        ),
      ],
    ];
    const sheetNames = sheets.map(([name]) => name);
    const entries = [
      [
        "[Content_Types].xml",
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
      ],
      [
        "_rels/.rels",
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ],
      [
        "xl/workbook.xml",
        `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheetNames.map((name, i) => `<sheet name="${escape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${sheetNames.map((name, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${escape(name)}'!$1:$4</definedName>`).join("")}</definedNames></workbook>`,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ],
      ["xl/styles.xml", styles],
      ...sheets.map(([, xml], i) => [`xl/worksheets/sheet${i + 1}.xml`, xml]),
    ];
    const blob = zip(entries);
    const date = dateISO(exported) || new Date().toISOString().slice(0, 10);
    download2(`portfolio-register-${date}.xlsx`, blob);
    announce(
      `${rows.length} projects exported to Excel with source coverage and calculation notes.`,
    );
    return blob;
  }

  function sparkline(points, name = "Recorded history") {
    if (!Array.isArray(points)) return "";
    const values = points.map((point) =>
      typeof point === "number" ? point : point?.value,
    );
    const finite = values.filter(numeric);
    if (finite.length < 2) return "";
    const min = Math.min(...finite),
      max = Math.max(...finite),
      range = max - min || 1;
    let path = "",
      connected = false;
    values.forEach((value, i) => {
      if (!numeric(value)) {
        connected = false;
        return;
      }
      const x = 5 + (i / Math.max(1, values.length - 1)) * 190,
        y = 43 - ((value - min) / range) * 36;
      path += `${connected ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
      connected = true;
    });
    return `<svg viewBox="0 0 200 50" role="img" aria-label="${escape(name)}" class="history"><title>${escape(name)}</title><path d="${path}" fill="none" stroke="#157b6a" stroke-width="2"/></svg>`;
  }
  function print(rows, columns, context = {}) {
    rows = Array.isArray(rows) ? rows : [];
    columns = selectedColumns(columns);
    if (!columns.length) columns = [Object.keys(COLUMNS)[0]];
    const notes = contextRows(rows, columns, context);
    const title = context.title || "Portfolio project register";
    const caption = captionColumn(columns);
    const paper = ["A4", "A3"].includes(context.paperSize)
      ? context.paperSize
      : columns.length > 10
        ? "A3"
        : "A4";
    const sourceTable = rows
      .map(
        (row) =>
          `<tr><td><b>${escape(row.p.code || row.p.name)}</b><small>${escape(row.cn)}</small></td><td>${escape(source(row).fileName || source(row).name || "Manual project record")}<small>${escape(source(row).date || "No dated source")}</small></td><td>${known(row, "spent") ? "Recorded" : "Missing"}</td><td>${known(row, "exposure") ? "Recorded" : "Missing"}</td><td>${known(row, "forecast") ? "Supported" : "Not supported"}</td><td>${Object.keys(row.p.adminOverrides || {}).length ? "Current values include adjustments" : "—"}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>
      @page{size:${paper} landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#233549;margin:0;font-size:10px;line-height:1.45}h1{font-family:Georgia,serif;font-size:27px;font-weight:normal;line-height:1.2;margin:8px 0}h2{font-size:15px;margin:22px 0 9px}header{border-top:5px solid #157b6a;border-bottom:1px solid #ced9df;padding:12px 0 14px;margin-bottom:16px}.eyebrow{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#536e7e}.meta{display:flex;gap:20px;flex-wrap:wrap;color:#536576}table{width:100%;border-collapse:collapse;table-layout:auto;font-variant-numeric:tabular-nums}thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid}th{background:#15364b;color:white;font-size:9px;text-align:left;padding:8px 6px;vertical-align:bottom;print-color-adjust:exact;-webkit-print-color-adjust:exact}td{padding:7px 6px;border-bottom:1px solid #dce3e8;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f5f8f9;print-color-adjust:exact;-webkit-print-color-adjust:exact}.number{text-align:right;white-space:nowrap}.negative{color:#a4373d}.mp-missing{color:#6f7d88}small{display:block;font-size:8px;color:#627385;margin-top:2px}a{color:inherit;text-decoration:none}.mp-register-name>i,.mp-use-cell>i,.sr-only{display:none}.mp-register-name small{white-space:normal}.tag{font-size:9px}.totals td{background:#e9f4f0;font-weight:700;border-top:2px solid #157b6a;print-color-adjust:exact;-webkit-print-color-adjust:exact}.note{color:#536576;font-size:9px;margin:10px 0}.context{table-layout:fixed}.context td:first-child{width:22%;font-weight:bold}.sources{font-size:9px}.history{width:140px;height:35px;display:block}.portfolio-history{display:flex;align-items:center;gap:14px;margin:10px 0}.footer{border-top:1px solid #ced9df;padding-top:10px;margin-top:18px;font-size:8px;color:#627385}
    </style></head><body><header><div class="eyebrow">Portfolio Ledger · register report</div><h1>${escape(title)}</h1><div class="meta"><span>${rows.length} exported projects</span><span>Currency: EUR</span><span>${escape(plain(context.scope) || "Supplied filtered or selected records")}</span><span>Exported: ${escape(plain(context.exportDate || new Date().toISOString()))}</span></div></header>${Array.isArray(context.sparkline) ? `<div class="portfolio-history"><b>Recorded history</b>${sparkline(context.sparkline)}</div>` : ""}<table class="register"><thead><tr>${columns.map((key) => `<th class="${["money", "percent"].includes(kind(key)) ? "number" : ""}">${escape(label(key))}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((key) => `<td class="${["money", "percent"].includes(kind(key)) ? "number" : ""}">${tableCell(row, key)}${key === "name" && context.history?.[row.p.id] ? sparkline(context.history[row.p.id], `${row.p.code || row.p.name}: recorded history`) : ""}</td>`).join("")}</tr>`).join("")}</tbody><tfoot><tr class="totals">${columns.map((key, i) => `<td class="${["money", "percent"].includes(kind(key)) ? "number" : ""}">${i === caption ? `<b>Exported totals</b><small>${rows.length} projects · EUR</small>` : tableTotal(rows, key)}</td>`).join("")}</tr></tfoot></table><p class="note">Totals include every exported record, independent of screen pagination. Monetary totals include known values only; their source coverage is shown. A dash means missing evidence, not zero. Latest report dates may differ between projects.</p><h2>Project source coverage</h2><table class="sources"><thead><tr><th>Project</th><th>Latest source</th><th>Actuals</th><th>Exposure</th><th>Estimate</th><th>Adjustments</th></tr></thead><tbody>${sourceTable}</tbody></table><h2>Scope and calculation notes</h2><table class="context"><tbody>${notes.map(([key, value]) => `<tr><td>${escape(key)}</td><td>${escape(plain(value))}</td></tr>`).join("")}</tbody></table><p class="footer">Portfolio Ledger · Current model snapshot. Original source documents remain in the application and full backup.</p></body></html>`;
    document
      .querySelectorAll("iframe[data-register-print]")
      .forEach((frame) => frame.remove());
    const frame = document.createElement("iframe");
    frame.dataset.registerPrint = "true";
    frame.title = "Printable project register";
    frame.tabIndex = -1;
    frame.style.cssText =
      "position:fixed;left:-100000px;top:0;width:1400px;height:1000px;border:0;";
    frame.setAttribute("aria-hidden", "true");
    frame.addEventListener(
      "load",
      () => {
        const target = frame.contentWindow;
        if (!target) return;
        target.addEventListener(
          "afterprint",
          () => setTimeout(() => frame.remove(), 1000),
          { once: true },
        );
        setTimeout(() => {
          try {
            target.focus();
            target.print();
            announce(
              `${rows.length} projects prepared for printing or saving as PDF.`,
            );
          } catch {
            announce(
              "The printable register is ready. Your browser could not open its print dialog.",
            );
          }
        }, 80);
      },
      { once: true },
    );
    frame.srcdoc = html;
    document.body.appendChild(frame);
    announce("Preparing the complete register report.");
    return frame;
  }
  return { xlsx, print };
}
