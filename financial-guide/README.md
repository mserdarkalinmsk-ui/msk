# Financial Guide v15

A complete rewrite of the uploaded *Financial Guide – Country Portfolio Command Center v14*.
Open **[financial-guide.html](../financial-guide.html)** in a modern browser: one offline file, no installation.

## What changed compared with v14

| v14 | v15 |
| --- | --- |
| 1.5 MB, ~60 stacked style/script patches (v8…v113) | 0.4 MB, one design system and 8 small source modules |
| Runtime error on load (`V44 intelligence render`), polling every 0.9–2.5 s | No console errors; no polling |
| Light theme only, fixed layout | Light / dark / system themes, mobile layout, print styles, keyboard search (Ctrl K) |
| Content locked inside rendering code | Content extracted as data (`src/content.generated.js`), rules as pure functions (`src/engines.js`) |
| Analysis lost on reload | Portfolios, projects, analyses, checklists and My Case kept in the browser |

Content is ordered as a project moves: **plan → decide → commit → pay → report & forecast → close → file**.
Every module shows the next step of that journey.

## Structure

```
financial-guide/
  scripts/extract-content.cjs   v14 HTML → src/content.generated.js (42 datasets, checksum-locked source)
  scripts/build.py              src/* → ../financial-guide.html
  src/engines.js                decision rules (procurement, budget revision, contract, grant, year-end, readiness, what-if, petty cash)
  src/analysis.js               Excel/CSV table detection, budget vs report, headings, project & portfolio signals
  src/core.js                   store, router, shell, search, My Case
  src/views-*.js, styles.css    screens and design system
```

## Build and test

```sh
node financial-guide/scripts/extract-content.cjs   # only when the v14 source changes
python3 financial-guide/scripts/build.py
node tests/financial-guide.cjs                      # rule unit tests + every route on desktop/light and mobile/dark
```

Excel files are read with SheetJS, loaded from cdnjs (jsDelivr as fallback) only when an `.xlsx` is chosen.
Offline, save the sheet as CSV — the same parser handles it.
