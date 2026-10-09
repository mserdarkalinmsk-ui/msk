# Portfolio Ledger

A personalizable portfolio workspace with financial infographics, source
coverage, project schedules and a detailed project register. The supplied
ledger's report, forecast, contract, document-import and financial-evidence
engine is retained.

![Portfolio overview with the sample portfolio](docs/overview.png)

## Download and run

Download **index.html** using GitHub's **Download raw file** button, or download
this repository as a ZIP. The generated HTML contains the application, styles,
sample portfolio, graphics and embedded PDF readers. Running it requires no
package installation or build step.

For hosted development, run from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory .
```

Use a modern browser with JavaScript, IndexedDB and SVG support. The optional
**sw.js** adds an offline document cache when served from a secure context or
loopback host; keep it beside index.html for hosted offline use.

Records and imported documents live in browser storage. Use **Data → Export
backup** to move a portfolio between browser profiles or hosting origins. The
initial six-project portfolio is explicitly labelled as sample data.

## Make the workspace yours

**Home** and **Analytics** share three independently saved profiles:
Portfolio overview, Finance focus and Delivery focus. **Panels** chooses from
12 panels. **Customize** reveals drag handles, Earlier / Later controls,
width selection and pinning. Handles also support **Alt + ↑ / ↓**; phones
support vertical touch dragging and edge scrolling.

Collapse, hide or resize panels without editing portfolio records. Layout
settings use the separate `ledger.workspace.v2` storage key. The tools menu
exports/imports a layout or restores the active profile's default layout.
Portfolio backup remains a separate operation.

The workspace includes:

- Shared-scale budget allocation, with an amount/percentage switch and explicit
  handling of missing exposure, overspend and signed corrections.
- Dated expenditure history using the latest known report for each project at
  each date. Snapshots are never added together. Scope, series and history
  controls, keyboard-selectable points, source counts and a data table expose
  the figures behind the chart.
- Financial pace comparisons, country/sector budget composition, evidence
  coverage, source-linked observations, recorded deadlines and project/activity
  schedules. Financial utilization is kept separate from delivery completion.
- Forecast scenarios that preserve approved budgets and actuals, with the
  contributing project count and method shown beside estimates.
- A project register with local search, sorting, country/signal grouping,
  column selection, two densities, row details and pagination. Missing values
  stay last in either sort direction. Totals cover all filtered records and
  show their source counts.
- Selected-row or filtered-register CSV export; textual formula prefixes are
  escaped. Money columns use EUR and percentage columns export fractions.
- SVG and 1800px PNG chart exports, light/dark themes, reduced-motion support,
  print styling and responsive navigation.

<details>
<summary>Phone preview</summary>

![Phone overview](docs/mobile.png)

</details>

## Maintain the code

The distributable remains a single HTML file, while editable source is split
into three files:

| File                   | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `src/ledger-base.html` | Retained ledger engine, shared screens, embedded parsers and shell  |
| `src/workspace.js`     | Workspace rendering, preferences, charts, register and interactions |
| `src/workspace.css`    | Workspace typography, layout, themes, responsive and print styles   |
| `scripts/build.py`     | Embeds the workspace into the engine and generates `index.html`     |
| `sw.js`                | Optional scoped offline document cache                              |

After editing source, regenerate the distributable with Python's standard
library:

```sh
python3 scripts/build.py
```

Do not hand-edit generated index.html. The builder checks its integration
points so engine changes cannot silently detach the workspace. No third-party
build tooling is required. Existing portfolio storage keys and embedded PDF
readers are preserved.

## Validate

The cloud image provides Node.js, Playwright and `/usr/bin/chromium`:

```sh
node --check src/workspace.js
python3 scripts/build.py
node tests/smoke.cjs
node tests/workspace.cjs
```

Both browser suites start and stop their own Python servers, use isolated
profiles, and never touch a user's portfolio. Smoke tests cover 26 screens
at desktop and phone widths, filters, map/keyboard navigation, themes,
project validation and creation, undo/redo, backup round-tripping, actual
offline reload, self-contained rendering and print visibility.

Workspace tests cover mouse dragging, real Chromium touch input, keyboard
movement, persistent layouts, profile isolation, layout import/export/reset,
source-preserving scenarios, five viewport widths, SVG/PNG exports, register
interactions and controlled financial fixtures. Fixtures check cumulative
snapshots, known zero versus missing evidence, signed corrections, overspend,
CSV escaping and totals across multiple pages.

Set `CHROMIUM_PATH` for another browser installation. Set `LEDGER_TEST_PORT`
or `LEDGER_WORKSPACE_TEST_PORT` if ports 8765/8766 are occupied. Outside the
cloud image, provide Playwright and a Chromium installation yourself.

These checks exercise the retained workflows and new presentation layer;
they do not exhaustively validate every original document parser or financial
calculation.
