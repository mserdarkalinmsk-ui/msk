# Portfolio Ledger

A self-contained portfolio workspace, refined from the supplied HTML. The app
keeps the original report, forecast, document-import and financial-evidence
engine, with a shared navy, teal and ivory interface.

## Run

No package installation or build is needed. From this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory .
```

Use a browser with modern JavaScript, IndexedDB and SVG support. `index.html`
contains the styles, application, sample portfolio and embedded PDF readers.
The optional `sw.js` adds an offline document cache when served from a secure
context or loopback host. Keep both files together for hosted offline use.

Portfolio records and imported documents stay in browser storage. Use **Data →
Export backup** before moving between browser profiles or hosting origins.
The initial six-project portfolio is sample data, clearly labelled on Home.

## What changed

- Editorial headings, aligned page headers, compact financial cards, and
  consistent colours and controls across the main screens.
- Four primary Home metrics; budget coverage and team capacity remain available
  in an expandable section. Missing evidence still displays an em dash.
- Five-item mobile navigation with a complete page menu, native dialog keyboard
  handling and focus restoration.
- Persistent light/dark themes resolved before the first paint, reduced-motion
  support, and a dedicated print layout.
- A repaired mobile financial matrix rule, a corrected scenario-search route,
  and Staff included in the command palette.
- Accessible search results with active-option tracking and an optional scoped
  offline cache. The original Blob-based service-worker registration could not
  work in browsers.

The uploaded original is unchanged. Existing storage keys and embedded PDF
readers are preserved. Source files in this checkout are the improved version.

## Validate

The cloud image already provides Node.js, Playwright and `/usr/bin/chromium`.
From this directory:

```sh
node tests/smoke.cjs
```

The test starts and stops its own Python server on port 8765. It uses isolated
browser profiles and checks 26 screens at desktop and phone widths, filters,
map controls, keyboard navigation, theme persistence, form validation,
creation/undo/redo, backup round-tripping, an actual offline reload, and print
visibility. It also renders the complete HTML without separate assets.

To use another Chromium installation, set `CHROMIUM_PATH`. Set
`LEDGER_TEST_PORT` if port 8765 is already occupied. Outside the cloud image,
install Playwright in your development tooling and provide a Chromium browser.

The validation does not cover every contract/report parser or every financial
calculation. Those original engines were retained rather than rewritten.
