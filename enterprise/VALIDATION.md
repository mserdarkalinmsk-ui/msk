# Validation — Enterprise offline edition

Validated on 15 October 2026 with Python 3.12, Node 24.19, locked Playwright 1.62.1 and system Chromium 154.

## Executed checks

| Check | Result |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | Pinned test dependencies installed from lockfile with artifact integrity checks |
| `python3 enterprise/build.py` | Original engine SHA-256 verified; standalone HTML and deterministic source ZIP produced |
| `node enterprise/tests/domain.cjs` | **26 checks passed** |
| `node enterprise/tests/browser.cjs` | **16 groups passed** |
| Generated executive-brief PDF | A4, 2 pages for the selected two-project fixture; extracted text contains owner, methodology and final source timestamp |

The domain suite covers unknown versus zero, future/invalid dates, stale sources, duplicate source dates and line codes, parent/child subtotal exclusion, incomplete commitments, matched cumulative differences, coverage changes, short intervals, refunds, scenario overruns and nonmutation, additive/atomic backup validation, source-sensitive review identity, formula-safe CSV and empty scope.

The browser suite covers original-portfolio boot, mixed coverage, scenario behavior, reload persistence, escaped notes, standalone HTML/JSON/CSV/PDF outputs, historical reporting-date selection, saved scopes, follow-up backup, undo, project and retained workspaces, read-only shared copies, bounded large-portolio rendering and a clean uninstrumented distributable.

No uncaught browser errors or external network requests occurred in the exercised decision-workspace flows. Layouts were checked at 320, 390, 768 and 1440 pixels; Finance, Evidence, Scenarios and Executive brief were also checked at 390 pixels. A dark-theme mobile screenshot was inspected by the automation; this is not an independent accessibility or visual-design audit.

## Scale evidence

The synthetic 1,000-project fixture completed the decision/evidence navigation and list checks in **975 ms** in this cloud run. Initial DOM rendering was bounded to 12 project cards and 50 source rows; loading more projects was exercised. This is fixture evidence on this machine, not a production performance guarantee, import benchmark or test of 1,000 large real source documents.

## Scope limits

- Original document parsers, all legacy financial screens, every file format, all browser engines and every existing workflow were not exhaustively retested. Retained charts and project editing access received smoke coverage.
- Browser checks used isolated profiles and local HTTP hosting. Direct file-URL behavior varies by browser; the cloud browser policy blocks file navigation, so that path was not verified here.
- The existing engine remains preserved and compiled; only the new decision layer is modularized.
- No server, identity provider, synchronized team storage, multi-currency engine, OCR or external AI system was added or tested.
- PDF generation and text completeness were verified. This is not a tagged-PDF accessibility certification.
- Automated tests use test-only runtime hooks injected into intercepted responses. Those hooks are absent from the generated standalone HTML.
- No new-cloud-task restoration or environment publication was performed as part of this feature work.

Detailed run artifacts are generated in ignored `test-results/enterprise/` by the browser suite and are not bundled as user portfolio data.
