"""Build the premium Financial Guide from the original single-file app.
Applies the premium CSS layer and the narrative (content-flow) edits; every
replacement must match exactly once so a changed source fails loudly."""
import pathlib, re
HERE = pathlib.Path(__file__).parent
src = (HERE / "original.html").read_text(encoding="utf-8")

def sub(old, new, count=1):
    global src
    n = src.count(old)
    assert n == count, f"expected {count} match(es), got {n}: {old[:80]!r}"
    src = src.replace(old, new)

# 1. Hard-coded colours in the stylesheet follow the tokens (skip token definitions).
css_end = src.index("</style>")
css, rest = src[:css_end], src[css_end:]
remap = {"#2d6bd8": "var(--accent)", "#1b3a7a": "var(--navy)", "#1f9d6b": "var(--good)", "#c0392b": "var(--risk)", "#b03a2e": "var(--risk)", "#d98a1a": "var(--warn)"}
def fix(m):
    line_start = css.rfind("\n", 0, m.start())
    before = css[line_start:m.start()]
    if re.search(r"--[\w-]+\s*:\s*$", before):
        return m.group(0)
    return remap[m.group(0).lower()]
css = re.sub("|".join(remap), fix, css, flags=re.I)
src = css + rest

# 2. Premium layer last in the cascade.
premium = (HERE / "premium.css").read_text(encoding="utf-8")
idx = src.index("</style>")
src = src[:idx] + "\n" + premium + "\n" + src[idx:]

# 3. Favicon: midnight tile with brass rule.
src = re.sub(r'<link rel="icon" href="[^"]*">',
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect width=\'32\' height=\'32\' rx=\'8\' fill=\'%2314284b\'/%3E%3Crect x=\'8\' y=\'24\' width=\'16\' height=\'2\' rx=\'1\' fill=\'%23d4b072\'/%3E%3Ctext x=\'16\' y=\'20\' font-family=\'Inter,Arial\' font-weight=\'700\' font-size=\'12\' fill=\'white\' text-anchor=\'middle\'%3EFG%3C/text%3E%3C/svg%3E">', src, count=1)
sub('<meta name="color-scheme" content="light dark">', '<meta name="color-scheme" content="light dark">\n<meta name="theme-color" content="#14284b">')

# 4. Home: intent first. One promise, one search, "how it works", then tasks, then areas.
old_home_start = '      return { html: `\n        <section class="hx-hero"><div><span class="eyebrow">Council of Europe · Financial Guide</span>'
old_home_end = '<em>${counts[i]} →</em></div></a>`).join("")}</section>` };'
a = src.index(old_home_start); b = src.index(old_home_end, a) + len(old_home_end)
assert src.count(old_home_start) == 1
new_home = r'''      const steps = (C.procurementStages || []).length + (C.grantStages || []).length;
      return { html: `
        <div class="hx-band">
        <section class="hx-hero"><div><span class="eyebrow">Council of Europe · Financial Guide</span>
          <h1>Every financial procedure, step by step.</h1>
          <p>Say what you need to do. The guide shows the rule that applies, the route to follow and the documents to keep on file.</p>
          <button type="button" class="hx-search" data-hx-search>${FG.icon ? "" : ""}<span>Search a rule, a threshold or a document…</span><kbd>Ctrl K</kbd></button></div>
          ${last ? `<a class="hx-last" href="${esc(last.href)}"><small>Continue where you left off</small><b>${esc(last.title)}</b><span>${esc(last.sub)}</span><u>Resume →</u></a>` : `<a class="hx-last" href="#/procurement"><small>New here? Start here</small><b>Procurement guide</b><span>The most used guide: ${(C.procurementStages || []).length} stages from need to filing</span><u>Start →</u></a>`}
        </section>
        <ol class="hx-how">
          <li><em>01</em><b>Understand the rule</b><span>Each stage opens with why it exists, what you do and how you know it is done.</span></li>
          <li><em>02</em><b>Plan your case</b><span>Enter the value and type of your purchase or grant; the guide returns your route.</span></li>
          <li><em>03</em><b>Keep the evidence</b><span>Checklists and document packs make the file audit-ready from day one.</span></li>
        </ol>
        <div class="hx-stats"><div><b>${steps}</b><span>procedure stages explained</span></div><div><b>${engines}</b><span>decision engines</span></div><div><b>48</b><span>practice scenarios</span></div><div><b>${counts.length}</b><span>working spaces</span></div></div>
        </div>
        ${FG.rolePicker ? FG.rolePicker() : ""}
        <h2 class="hx-h">What do you need to do?</h2>
        <p class="hx-sub">Pick the task in front of you. Each one opens the right guide or decision engine.</p>
        <section class="hx-tasks">${TASKS.map(([ic, t, d, p]) => `<a class="hx-task" href="#/${p}"><i aria-hidden="true">${ic}</i><b>${esc(t)}</b><span>${esc(d)}</span><u>Open →</u></a>`).join("")}</section>
        <h2 class="hx-h">Or browse by area</h2>
        <p class="hx-sub">The full guide, organised by who uses it.</p>
        <section class="hx-hubs">${HUBS.map(([k, t, sub, d, p, c, ic], i) => `<a class="hx-hub" style="--c:var(--c${c})" data-g="${ic}" href="#/${p}"><span class="hx-ico" aria-hidden="true">${ic}</span><div><small>${esc(sub)}</small><h3>${esc({ PROJECTS: "Projects", FOMA: "FOMA field operations", TOOLS: "Tools", "DECISION ENGINES": "Decision engines" }[t] || t)}</h3><p>${esc(d)}</p><em>${counts[i]} →</em></div></a>`).join("")}</section>
        <section class="hx-quick">${quick.filter(([, , h]) => ["files", "ask", "procurement/test"].includes(h)).map(([t, d, h]) => `<a href="#/${h}"><b>${t}</b><span>${d}</span></a>`).join("")}</section>` };'''
src = src[:a] + new_home + src[b:]
# Home search button opens the existing search.
sub('FG.start();</script>', 'document.addEventListener("click", (e) => { if (e.target.closest("[data-hx-search]")) { const s = document.getElementById("searchBtn"); if (s) s.click(); } });\nFG.start();</script>')

# 5. Projects: replace vanity counters with a reading guide.
sub('<div class="pj-kpis"><div><small>MODULES</small><b>${modules}</b></div><div><small>PROCEDURE STEPS</small><b>${steps}</b></div><div><small>STEPS OPENED</small><b>${completed}%</b></div></div></header>',
    '</header><p class="pj-guide">Read left to right: you <b>commit</b> the money, <b>spend</b> it, then <b>close</b> the year and the file. Core modules are marked; start there.</p>')

# 6. Stage page: the practical example sits with the summary, not after all the reading.
sub('${s.remember ? `<div class="sb-rule"><small>If you remember one thing</small><b>${esc(s.remember)}</b></div>` : ""}',
    '${s.remember ? `<div class="sb-rule"><small>The stage in one sentence</small><b>${esc(s.remember)}</b></div>` : ""}')
sub('${FG.roleAtStage ? FG.roleAtStage(cfg.base, s.name) : ""}\n        </div>',
    '${s.example ? `<div class="sb-example"><span>EXAMPLE</span><p>${esc(s.example)}</p></div>` : ""}${FG.roleAtStage ? FG.roleAtStage(cfg.base, s.name) : ""}\n        </div>')
sub('${s.example ? `<div class="example mt"><span aria-hidden="true">◆</span><div><small>In practice</small><p>${esc(s.example)}</p></div></div>` : ""}', '')

(HERE / "financial-guide-premium.html").write_text(src, encoding="utf-8")
print("built", len(src))
