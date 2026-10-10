# Portfolio Ledger design system

The shared application frame supports six different jobs. Home is an operational
summary, Projects is a directory, Finance is a financial investigation workspace,
Intelligence is an explainable follow-up queue, People distinguishes source names
from assignments/contracts, and Planning presents recorded dates and schedules.
The same components, selection, type scale and financial meanings connect them.

## Financial and evidence colors

| Meaning                        | Token                | Color family |
| ------------------------------ | -------------------- | ------------ |
| Approved budget                | `--studio-budget`    | Blue         |
| Cumulative expenditure         | `--studio-spent`     | Teal         |
| Commitments / exposure series  | `--studio-committed` | Amber        |
| Supported forecast             | `--studio-forecast`  | Purple       |
| Risk / urgent condition        | `--studio-risk`      | Coral        |
| Unknown / neutral availability | `--studio-unknown`   | Grey         |

Palette shades vary; meanings do not. Light/dark and contrast variants keep the
same families. Shape, text and coverage labels supplement color. Unspent funds
and positive forecast variance are neutral unless a specific interpretation is
stated. Source availability does not establish verification or delivery. Zero is
numerical evidence; a dash means insufficient evidence.

## Scale and surfaces

`atelier.css` defines 4/8/12/16/24/32px spacing tokens. Main text uses the local
system sans serif stack; financial numbers use tabular numerals. Body and primary
controls use 14–15px, analytical table cells 13px, source notes 11–12px and compact
metadata 10–11px. Headings are restrained 18–30px with stronger weight; the Home
portfolio statement is the only larger display element.

A neutral canvas, thin dividers and white/dark surfaces establish hierarchy.
Headers and shared selection stay stable across routes. Group lists, source
catalogs, agenda rows and toolbars use dividers; containers are reserved for
meaningful sections and comparisons. No quantitative graphic uses decorative 3D.
Legacy workflow components inherit the frame and financial aliases.

## Reusable components

`atelier-pages.js` uses shared section headers, statistics, badges, tabs,
selection/search, empty states, pagination, evidence drawer and review/import
forms. Specialized charts, register, schedule and assignments remain separate
feature modules. `LedgerHost` provides explicit render/scope/model/import-preview
hooks; `ledger-domain.js` supplies financial coverage, observation/source
projections, cache invalidation and additive preferences/review validation.

Portfolio selection follows the six workspaces. Local table/assignment/event
filters show matching counts and refine that selection. Project/country detail
links establish their own drill-down context. Report history windows do not
silently change current figures. Country and project source families remain
separate in comparisons and are not double-counted.

## Task composition

Home has four summary figures and four arrangeable sections: diverse project
priorities, compact funding position, next recorded dates, recent changes.
Finance places the bridge/composition, history or forecasts in distinct views;
advanced controls and the 12-panel custom studio remain available on demand.
Projects starts with six columns and task presets. Intelligence exposes reason,
source, date, owner, next step and review state without a synthetic health score.

Reviewed is separate from resolved. If a recorded resolution still has an active
source condition, the interface says so. If source evidence changes, its review
fingerprint no longer marks the changed condition reviewed. Follow-ups are saved
with portfolio records and backed up; device layout preferences are separate.

## Mobile, keyboard and effects

Mobile navigation shows Home, Projects, Finance, Intelligence and More; More
exposes all six workspaces and utilities. Planning defaults to an agenda.
Analytical tables offer mobile cards and a full horizontally scrollable table
using the same filtered records. Full exports retain all matching rows.

Home and custom-studio arranging offer mouse, touch and keyboard controls;
Earlier/Later buttons provide a clear alternative to dragging. Columns retain
keyboard movement, resizing and freezing. Native disclosures, labelled form
controls, focus outlines, keyboard chart points and Escape-close dialogs remain
available. Effects identify focus, selection and a drop target; reduced motion
and effects-off disable decorative transitions/animation.

## Verification and limits

Browser suites inspect retained routes, two themes, three frame sizes and focused
320/390/768/1440/1920px feature checks. Financial fixtures cover independent source
coverage, zero/unknown, cumulative snapshots, changing coverage, corrections and
invariant current totals. Export tests inspect actual SVG/PNG and workbook data.
Atelier adds shared scope, purpose separation, review backup/undo, reader preview,
mobile views and bounded rendering at 50/200/1000 projects.

Screenshots are reviewed visually after functional checks. Automated frame and
keyboard checks are not an accessibility certification or proof of subjective
visual quality. Large document parsing remains dependent on the retained readers
and the source's structure/text layer.
