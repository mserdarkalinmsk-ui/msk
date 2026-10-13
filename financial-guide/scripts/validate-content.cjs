/* Content validator: structure, complete sentences, key-figure notes, quiz integrity and banned values.
   Runs on procurement, grants and every guide in src/guides/. Usage: node scripts/validate-content.cjs */
const path = require("node:path"), fs = require("node:fs");
const SRC = path.resolve(__dirname, "../src");
function load() {
  const saved = global.window, savedFG = global.FG, guides = [];
  global.window = { FG_CONTENT: {} }; global.FG = { registerGuide: (g) => guides.push(g) };
  for (const f of ["content.generated.js", "content.procurement.js", "content.grants.js", "content.facts.js", "quiz.procurement.js", "quiz.grants.js"]) {
    delete require.cache[path.join(SRC, f)]; require(path.join(SRC, f));
  }
  const gdir = path.join(SRC, "guides");
  if (fs.existsSync(gdir)) for (const f of fs.readdirSync(gdir).filter((x) => x.endsWith(".js")).sort()) { delete require.cache[path.join(gdir, f)]; require(path.join(gdir, f)); }
  const C = global.window.FG_CONTENT;
  global.window = saved; global.FG = savedFG;
  return [
    { base: "procurement", stages: C.procurementStages, reference: C.procurementReference, quiz: (C.quizzes || {}).procurement, facts: (C.factNotes || {}).procurement },
    { base: "grants", stages: C.grantStages, reference: C.grantReference, quiz: (C.quizzes || {}).grants, facts: (C.factNotes || {}).grants },
    ...guides,
  ];
}
function validate() {
  const errors = [], warnings = [];
  const sentence = (where, t) => { if (t && !/[.!?:)”"]$/.test(String(t).trim())) errors.push(`${where}: not a complete sentence → "${String(t).slice(-60)}"`); };
  for (const g of load()) {
    const B = g.base, names = new Set((g.stages || []).map((s) => s.name));
    if (!g.stages || !g.stages.length) { errors.push(`${B}: no stages`); continue; }
    if (names.size !== g.stages.length) errors.push(`${B}: duplicate stage names`);
    for (const ph of g.phases || []) for (const n of ph[1]) if (!names.has(n)) errors.push(`${B}: phase "${ph[0]}" lists unknown stage "${n}"`);
    for (const s of g.stages) {
      const W = `${B} › ${s.name}`;
      for (const k of ["name", "title", "lead", "understand", "do", "check"]) if (!s[k]) errors.push(`${W}: missing ${k}`);
      ["lead", "understand", "do", "check", "warning", "best"].forEach((k) => sentence(`${W} › ${k}`, s[k]));
      if (!(s.sections || []).length) errors.push(`${W}: no sections`);
      for (const [h, b] of s.sections || []) {
        if (typeof b === "string") { sentence(`${W} › ${h}`, b); continue; }
        if (!b || !b.lead) { errors.push(`${W} › ${h}: section without lead`); continue; }
        sentence(`${W} › ${h} › lead`, b.lead);
        for (const it of b.items || []) if (!Array.isArray(it) || it.length !== 2 || !it[0] || !it[1]) errors.push(`${W} › ${h}: item must be [term, text]`); else sentence(`${W} › ${h} › ${it[0]}`, it[1]);
        (b.must || []).forEach((m) => sentence(`${W} › ${h} › must`, m));
        sentence(`${W} › ${h} › tip`, b.tip);
      }
      for (const [v, l] of s.keyFacts || []) {
        const n = g.facts && g.facts[s.name];
        if (!n || !(n[`${v}|${l}`] || n[v])) warnings.push(`${W}: key figure "${v}" has no verified note`);
      }
    }
    const Q = g.quiz || [];
    if (Q.length && Q.length !== 20) warnings.push(`${B}: quiz has ${Q.length} questions (20 recommended)`);
    Q.forEach((q, i) => {
      const W = `${B} › quiz ${i + 1}`;
      if (!(q.level >= 1 && q.level <= 5)) errors.push(`${W}: level must be 1–5`);
      if (!q.q || !(q.options || []).length) errors.push(`${W}: missing question or options`);
      if (q.type === "order") { const a = q.answer || []; if (a.length !== q.options.length || [...a].sort((x, y) => x - y).some((x, k) => x !== k)) errors.push(`${W}: order answer must be a permutation`); }
      else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)) errors.push(`${W}: answer index out of range`);
      if (q.stage && !names.has(q.stage)) errors.push(`${W}: unknown stage "${q.stage}"`);
      sentence(`${W} › explain`, q.explain);
    });
    for (const l of (g.reference && g.reference.limits) || []) if (!l.value || !l.rule) errors.push(`${B} › reference: limit needs value and rule`);
    const text = JSON.stringify(g);
    if (/171[,. ]?000/.test(text)) errors.push(`${B}: contains €171,000 (the threshold is €184,000)`);
  }
  return { errors, warnings };
}
module.exports = validate;
if (require.main === module) {
  const { errors, warnings } = validate();
  warnings.forEach((w) => console.log("warn  " + w));
  errors.forEach((e) => console.log("ERROR " + e));
  console.log(`${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}
