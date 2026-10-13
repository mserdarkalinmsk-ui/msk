"""Build Financial Guide Academy as one offline HTML file: dist/financial-guide-academy.html."""
import json, pathlib
HERE = pathlib.Path(__file__).parent
src = json.loads((HERE / "content/source.json").read_text(encoding="utf-8"))

def stage(s):
    keep = ("name", "title", "lead", "source", "remember", "keyFacts", "example", "understand", "do", "check", "sections", "warning", "best")
    return {k: s[k] for k in keep if s.get(k)}

data = {
    "paths": {
        "procurement": {"phases": src["procurementPhases"], "stages": [stage(s) for s in src["procurementStages"]]},
        "grants": {"phases": src["grantPhases"], "stages": [stage(s) for s in src["grantStages"]]},
    },
    "briefs": src["moduleBriefs"],
    "quizzes": src["quizzes"],
    "scenarios": [{k: s[k] for k in ("cat", "level", "title", "q", "opts", "correct", "feedback")} for s in src["scenarios"]],
    "glossary": src["GLOSSARY"],
    "limits": src["LIMITS"],
    "lifecycle": src["financeLifecycle"],
    "concepts": src["financeConcepts"],
    "factNotes": src["factNotes"],
}
data_json = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
css = ((HERE / "src/styles.css").read_text(encoding="utf-8") + "\n" + (HERE / "src/theme.css").read_text(encoding="utf-8")).replace("__INTER__", (HERE / "content/inter.woff2.b64").read_text().strip())
js = (HERE / "src/app.js").read_text(encoding="utf-8")
html = (HERE / "src/shell.html").read_text(encoding="utf-8")
html = html.replace("__CSS__", css).replace("__JS__", js).replace("__DATA__", data_json)
out = HERE / "dist/financial-guide-academy.html"
out.write_text(html, encoding="utf-8")
print(f"built {out.name}: {len(html.encode()) / 1024:.0f} KB (data {len(data_json) / 1024:.0f} KB, js {len(js) / 1024:.0f} KB, css {len(css) / 1024:.0f} KB)")
