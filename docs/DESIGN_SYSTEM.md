# Portfolio Intelligence Studio

The studio is a working environment for portfolio evidence. Its hierarchy is
scope → current financial position → comparison → individual source records.
Panels, charts and tables share one visual system without sharing the same
interaction model.

## Financial colour semantics

| Meaning                       | Default light colour | Paired explanation                              |
| ----------------------------- | -------------------- | ----------------------------------------------- |
| Approved budget               | Cobalt `#3058bd`     | Budget label or budget reference line           |
| Cumulative expenditure        | Teal `#007f82`       | Spent label or solid series                     |
| Outstanding commitments       | Amber `#a26207`      | Committed label; expenditure excluded           |
| Forecast                      | Violet `#7855c8`     | Estimated label, assumptions and forecast basis |
| Attention or adverse variance | Coral `#bc434f`      | Explicit status and numerical difference        |
| Unknown or unavailable        | Slate `#647085`      | Missing label, dash or hatching                 |

Project and country identity colours remain separate from financial meaning.
A colour alone must never establish an assessment. Zero is a known numerical
value; missing evidence is a different state. Positive variance can use the
positive colour only when the calculation's sign convention is stated.

## Palettes and themes

- **Atelier:** neutral canvas, white surfaces, cobalt accents and a restrained
  evidence narrative using the same surface as the surrounding panels.
- **Executive:** conservative blue-grey framework with identical semantics.
- **Contrast:** firm borders, stronger foregrounds and fewer surface effects.

All palettes support the ledger's light and dark themes. The palette belongs to
workspace preferences; portfolio records do not depend on it. Feature modules
use `--studio-*` semantic tokens or their `--mp-*` compatibility aliases.

The application frame applies to every route, including Intelligence, Projects,
country pages and individual project tabs. Navigation width, background, type
and header spacing remain stable when moving between them. `app-design.css`
provides this shared layer after feature styles.

## Typography and density

Use the local system font stack and tabular, lining numbers. Workspace headings
use a sans serif family; financial values have stronger weight and restrained
letter spacing. Body, controls and source notes are typically 12–13 CSS pixels;
decorative labels may be 10 pixels. SVG labels must be checked at their actual
rendered size, especially inside smaller panels. Compact density reduces
spacing before reducing text size.

Numbers align at the decimal edge where practical. Tables distinguish
selection, hover, grouping, totals and unknown values. Column identity is
stable while its width, position or visibility changes. Mobile views scroll
individual data surfaces and retain the page's viewport width.

## Effects and interaction

Effects explain state: selected controls, focused objects, source disclosure,
drag destinations and a brief route entrance. Financial graphics avoid
decorative 3D, gradients on quantitative bars and permanent animation. Panels
do not move on hover. Keyboard focus remains visible, and reduced-motion
preferences disable the studio's animations and transitions.

## Composition

The preserved overview layout pairs allocation and historical comparison at
half width. For a history-focused layout, expand the historical comparison to
full width. Funding composition can pair a wide allocation panel with a
third-width budget bridge. The project register uses full width. Context and
evidence panels follow the task. Users can change the arrangement and save
named layouts.

The evidence banner communicates a factual narrative, source coverage and
dates. It must not invent a portfolio score or imply that financial pace is
delivery completion. Date controls state when they filter historical reports
rather than changing the current approved financial position.

Analysis selection and workspace settings use native disclosures with visible
summaries. Active analysis opens its controls on initial load. Secondary controls
should not push the first analytical row beyond the desktop viewport.

## Verification

Check 320, 390, 768, 1440 and 1920-pixel viewports, both themes, all palettes,
keyboard focus, reduced motion and print. Wait for route animations to settle
before capturing visual references. Exported graphics must retain meaning
outside the application: title, units, dates, scope, source coverage and
assumptions belong with the visual.
