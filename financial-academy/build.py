"""Build Financial Guide Academy as one offline HTML file: dist/financial-guide-academy.html."""
import json, pathlib
HERE = pathlib.Path(__file__).parent
src = json.loads((HERE / "content/source.json").read_text(encoding="utf-8"))

def stage(s):
    keep = ("name", "title", "lead", "source", "remember", "keyFacts", "example", "understand", "do", "check", "sections", "warning", "best", "links")
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
# ---------- rich module content: every dataset becomes an interactive block ----------
x = json.loads((HERE / "content/extra.json").read_text(encoding="utf-8"))
def flow_from_tuple(stages):
    return [{"label": a, "role": b, "summary": d, "action": e, "control": f, "handover": g} for a, b, _i, d, e, f, g in stages]
def flow_from_obj(stages):
    return [{"label": s["label"], "role": s["role"], "summary": s["summary"], "action": s["action"], "control": s["control"], "handover": s["handover"], "evidence": s.get("evidence")} for s in stages]
def role_steps(steps):
    return [{"t": s["title"], "role": s["role"], "text": s["lead"], "list": s["items"], "docs": s.get("docs"), "note": s.get("note")} for s in steps]

B = {}
B["po-file"] = [
    {"type": "steps", "title": "The PO route, step by step", "sub": "Twelve steps from checking the workflow to starting the activity.", "items": [{"t": s["t"], "text": s["x"], "list": s["l"]} for s in x["poSteps"]]},
    {"type": "docs", "title": "Your document pack", "sub": "Pick the service type. Tick each document as you add it to the file.", "id": "po", "services": {k: {"sub": v.get("sub"), "signed": v["signed"], "support": v["support"]} for k, v in x["poServices"].items()}},
    {"type": "dodont", "title": "Do this, not that", "rows": x["poBestPractice"]},
]
B["payment-file"] = [
    {"type": "steps", "title": "From delivery to payment", "sub": "Nine checkpoints before Finance receives the file.", "items": [{"t": s["t"], "role": s.get("s"), "text": s["text"], "list": s.get("list", [])} for s in x["paySteps"]]},
    {"type": "docs", "title": "Payment document pack", "sub": "Pick the service type. Tick each document as you add it.", "id": "pay", "services": x["payServices"]},
    {"type": "dodont", "title": "Do this, not that", "rows": x["payBestPractice"]},
]
B["foma-handover"] = [
    {"type": "flow", "title": "PO request · who does what", "sub": "Select a role to see its action, control and handover.", "stages": flow_from_obj(x["fomaPoStages"])},
    {"type": "flow", "title": "Payment request · who does what", "sub": "The same discipline applies when paying.", "stages": flow_from_obj(x["fomaPaymentStages"])},
]
meta = x["eoyPhaseMeta"]
B["year-end"] = [
    {"type": "phases", "title": "Four moves before 31 December", "sub": "Work left to right; each move has an owner, a control and evidence.", "items": [dict(p, **meta[i]) for i, p in enumerate(x["eoyPhases"])]},
    {"type": "yearsplit", "title": "Which financial year?", "sub": "For a service that spans the year-end, split the cost by the days performed in each year."},
    {"type": "checklist", "title": "Year-end checklist", "id": "eoy", "items": x["eoyChecklist"]},
]
B["foma-forecast"] = [
    {"type": "triggers", "title": "What kind of change is it?", "sub": "Pick the situation; see what to check.", "items": [{"tag": t["tag"], "title": t["title"], "short": t["short"], "summary": t["summary"], "checks": t["checks"]} for t in x["forecastTriggers"]]},
    {"type": "steps", "title": "The forecast route", "sub": "Eight hand-offs from the working file to the DPC route.", "items": role_steps(x["forecastProcess"])},
]
B["foma-addendum"] = [
    {"type": "triggers", "title": "Why an Addendum?", "sub": "The reason decides what you must show.", "items": [{"tag": (r.get("decision") or {}).get("tag", "REASON"), "title": r["title"], "short": r["title"].split(" ")[0], "summary": r["summary"], "checks": r["checks"], "decision": r.get("decision")} for r in x["addendumReasons"]]},
    {"type": "steps", "title": "The Addendum route", "sub": "Each step lists the documents it produces.", "items": [dict(st, docs=x["addendumDocs"][i] if i < len(x["addendumDocs"]) else None) for i, st in enumerate(role_steps(x["addendumSteps"]))]},
    {"type": "keys", "title": "Four things reviewers check", "items": x["addendumKeys"]},
]
B["foma-reports"] = [
    {"type": "cards", "title": "Why, when and how", "items": [{"k": c["k"], "title": c["title"], "text": c["text"]} for c in x["reportIntro"]]},
    {"type": "steps", "title": "Build the report", "sub": "Action, control and output at each step.", "items": [{"t": r["title"], "text": r["lead"], "list": [f"Do: {r['action']}", f"Control: {r['control']}", f"Output: {r['output']}"]} for r in x["reportProcess"]]},
    {"type": "checklist", "title": "Before you send it", "id": "rep", "items": x["reportChecks"]},
]
B["foma"] = [{"type": "flow", "title": x["fomaFlows"]["Mission Order"]["title"], "sub": x["fomaFlows"]["Mission Order"]["desc"], "stages": flow_from_tuple(x["fomaFlows"]["Mission Order"]["stages"])}]
B["foma-claim"] = [{"type": "flow", "title": x["fomaFlows"]["Expense Claim"]["title"], "sub": x["fomaFlows"]["Expense Claim"]["desc"], "stages": flow_from_tuple(x["fomaFlows"]["Expense Claim"]["stages"])}]
B["filing"] = [
    {"type": "folders", "title": "What goes in each file", "sub": "Pick the file type; each folder is a phase.", "groups": x["filingMap"]},
    {"type": "checklist", "title": "Audit-ready test", "id": "audit", "items": x["auditItems"]},
]
B["links"] = [{"type": "links", "title": "Systems, templates and guidance", "items": [{k: l[k] for k in ("title", "cat", "desc", "use")} for l in x["usefulLinks"]]}]

extra_briefs = {
    "foma-handover": {"title": "Field PO & payment handovers", "lead": "In field offices every PO and payment file passes from the Project Assistant to ACCM, RFO and CCM. Each role controls something different.", "remember": "A file moves to the next role only when your control is complete.", "understand": "Splitting preparation, verification and validation across roles is what makes field spending defensible.", "do": "Prepare the complete file, apply your control, and hand it over with the evidence the next role needs.", "check": "Each stage left a trace: who prepared, who verified, who validated, and what evidence they relied on.", "figures": []},
    "foma-claim": {"title": "Expense claims", "lead": "After the mission, the expense claim reimburses the actual eligible expenses with receipts.", "remember": "The claim reimburses what was authorised and evidenced; it never replaces the mission order.", "understand": "Reimbursement must rest on the authorised mission and on receipts for what was actually spent.", "do": "Declare eligible expenses, attach receipts and submit the claim to ACCM for verification and CCM validation.", "check": "Every amount claimed has a receipt and matches the authorised mission.", "figures": []},
    "links": {"title": "Useful links & systems", "lead": "The systems, templates and guidance you will open every week, and what each one is for.", "remember": "Use the controlled template from the official source, never an old local copy.", "understand": "Most file errors come from outdated templates or the wrong system.", "do": "Bookmark the systems you use and download templates from their source each time.", "check": "Every document in your file was produced from the current template.", "figures": []},
}
briefs = dict(src["moduleBriefs"]); briefs.update(extra_briefs)
for k, blocks in B.items():
    key = k.replace("-", "/", 1) if k.startswith("foma-") and k not in extra_briefs else k
    if key in briefs: briefs[key] = dict(briefs[key], blocks=blocks)
data["briefs"] = briefs

# Path stages gain their checklist, best practice and special blocks (aliases where names differ).
PALIAS = {"Need & Planning": "Define the Need", "Launch & Publication": "Authorise & Launch", "Evaluation": "Open & Evaluate", "Clarification & Negotiation": "Negotiate & Award", "Award": "Negotiate & Award", "Filing & Audit Trail": "Performance & Filing"}
GALIAS = {"Amendments": "Agreement"}
def attach(stages, checklists, best, alias):
    by = {s["name"]: s for s in stages}
    for k, items in checklists.items():
        s = by.get(alias.get(k, k))
        if s: s.setdefault("checks", []).extend(items)
    for k, t in best.items():
        s = by.get(alias.get(k, k))
        if s and not s.get("best"): s["best"] = t
attach(data["paths"]["procurement"]["stages"], x["procurementChecklists"], x["procurementBestPractice"], PALIAS)
attach(data["paths"]["grants"]["stages"], x["grantChecklists"], x["grantBestPractice"], GALIAS)
roles = [dict(v, id=k) for k, v in x["procurementRoles"].items()]
for s in data["paths"]["procurement"]["stages"]:
    if s["name"] == "Roles & Funding": s["blocks"] = [{"type": "roles", "title": "Who does what", "sub": "Select an actor to see its job and the stages it touches.", "items": roles}]
    if s["name"] == "Contract Types": s["blocks"] = [{"type": "cards", "title": "Three contract structures", "items": [{"k": v[0].split(" ")[0].upper(), "title": v[0], "text": f"{v[3]} Suppliers: {v[1]} Ordering: {v[2]}"} for v in x["contractTypes"].values()]}]
for s in data["paths"]["grants"]["stages"]:
    if s["name"] == "Costs": s["blocks"] = [{"type": "costs", "title": "Is this cost eligible?", "sub": "Pick a cost category.", "items": [[k, v[0], v[1]] for k, v in x["grantCostCategories"].items()]}]

data_json = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
css = ((HERE / "src/styles.css").read_text(encoding="utf-8") + "\n" + (HERE / "src/theme.css").read_text(encoding="utf-8")).replace("__INTER__", (HERE / "content/inter.woff2.b64").read_text().strip())
js = (HERE / "src/app.js").read_text(encoding="utf-8")
html = (HERE / "src/shell.html").read_text(encoding="utf-8")
html = html.replace("__CSS__", css).replace("__JS__", js).replace("__DATA__", data_json)
out = HERE / "dist/financial-guide-academy.html"
out.write_text(html, encoding="utf-8")
print(f"built {out.name}: {len(html.encode()) / 1024:.0f} KB (data {len(data_json) / 1024:.0f} KB, js {len(js) / 1024:.0f} KB, css {len(css) / 1024:.0f} KB)")
