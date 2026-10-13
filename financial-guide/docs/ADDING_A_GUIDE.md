# Adding a guide

Every guide (PO/payment, year-end, FOMA, …) is one content file. The guide kit builds the hub, the stage pages, the test, the quick reference and the essentials from it, with the same design as Procurement and Grants.

## Steps
1. Copy `docs/examples/example-guide.js` to `src/guides/<name>.js`.
2. Fill it from the source document only. Every sentence must be complete. Thresholds use €184,000.
3. Run `node scripts/validate-content.cjs`. It stops on errors and lists warnings.
4. Run `python3 scripts/build.py`, then the tests: `NODE_PATH=/opt/node22/lib/node_modules node tests/financial-guide.cjs`.

## What the validator checks
- Every stage has a name, title, lead, understand, do and check, plus at least one section.
- Every lead, item, rule, tip, warning and explanation is a complete sentence.
- Every phase lists only existing stages, and no stage name is repeated.
- Every key figure has a verified note (`facts`); a missing note is a warning.
- Quiz: levels 1–5, valid answers, order questions are permutations, stage names exist; 20 questions are recommended.
- Reference limits have a value and a rule.
- No €171,000 anywhere.

## Content schema (per stage)
| Field | Meaning |
|---|---|
| `name` | Short stage name used in the route and links |
| `title`, `lead`, `source` | Page title, one-sentence purpose, guide chapter |
| `remember` | The one rule to remember |
| `understand`, `do`, `check` | The three steps |
| `keyFacts` | `[[value, label]]`, each with a note in `facts[stage][value]` (or `value|label` when a value repeats) |
| `sections` | `[[heading, { lead, items: [[term, text]], ordered, must: [], tip }]]` |
| `warning`, `best`, `checklist`, `templates`, `links` | Pitfall, best practice, checks, templates, related stages |

Guide-level fields: `base`, `title`, `lead`, `parent`, `phases`, `stages`, `facts`, `reference` (`limits`, `roles`, `howTo`, `contractTypes`), `essentials`, `quiz`, `roles`, `tools`, `widgets`, `mount`.

## Addresses
A guide whose `base` matches an existing module address (for example `po-file`) takes that address; link the old interactive tool through `tools` under a new address if you still need it.
