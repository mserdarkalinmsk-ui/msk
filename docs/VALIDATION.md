# Workspace redesign validation

Verified in the cloud checkout on 10 October 2026 with Chromium, isolated browser
profiles and controlled portfolio fixtures.

| Suite | Passing check groups | Evidence |
| --- | ---: | --- |
| Smoke | 15 | 42 routes at desktop and phone widths; offline/standalone rendering, forms, undo and backup |
| Workspace | 10 | Native mouse/touch/keyboard arranging, layout persistence, financial scenarios and exports |
| Studio | 15 | Source-aware financial history, table operations, named contexts, XLSX and chart exports |
| Staff | 7 | Source-backed assignments, contract editing, known zero/unknown FTE and complete CSV |
| Design | 9 | 26 routes × 2 themes × 3 viewport sizes = 156 frame comparisons |
| Atelier | 9 | Connected workspaces, follow-up backup/undo, guided import and original download, mobile views and scale |

All 65 groups passed. JavaScript syntax checks and `git diff --check` also passed.
Documentation screenshots were regenerated and inspected. Final narrow mobile CSS
changes were followed by fresh Atelier and Design runs; the last Smoke run also
passed all 84 route renders.

## Scale measurements

Latest Atelier run, measured 2026-10-10 10:20 UTC:

| Projects | Fixture page load | Country filter |
| ---: | ---: | ---: |
| 50 | 446 ms | 59 ms |
| 200 | 430 ms | 71 ms |
| 1,000 | 411 ms | 63 ms |

These are individual controlled-fixture measurements, not averages or a monotonic
performance curve. Fixtures verify full financial totals, shared selection and
bounded register/queue/source-comparison/agenda rendering. They contain no large
original documents and do not benchmark PDF parsing or a user's production data.

Checks exercise representative source conditions and retained workflows. They do
not certify accessibility or exhaustively cover every original document parser.
