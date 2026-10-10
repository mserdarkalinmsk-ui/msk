# Five-area refinement review — 10 October 2026

This is a new review round for the user's Calendar, Management Brief, Data,
Logframe and detailed budget-report requests. Prior approvals in REVIEW_LOG.md
apply to the earlier release, not automatically to this candidate.

Candidate HTML SHA256:
`cd50c5369e7b76695f67c35c382677baa8aba5bc4e52f796ce44b3bfc2e5e4a6`.

## Scope and preserved boundary

The exact uploaded Ledger 40 remains unmodified, SHA256
`af4f7a60b46f6b092bd7c84abd4f95e83ca81d041dabc92366f823c3cf2fc45e`.
The earlier six-workspace index.html remains unchanged. Original menus, financial
calculations, readers, native inputs, import preview and history remain delegates.
The user explicitly authorized expandable grouping of Data's existing cards.

| Request | Implemented result | Acceptance evidence |
| --- | --- | --- |
| Calendar | Closed optional month ribbon, direct month picker, compact headers; exact report warning lists with source links | Month navigation, overdue membership, link closes modal, original ICS event count and explicit range label |
| Management Brief | Available workspace width; coverage/source/action/team appendix | Width comparison, actual PDF text including closed disclosure contents; future budget disclosed |
| Data | Seven existing cards in six labelled keyboard disclosures | Native file chooser, preview without commit, templates, backup and remembered opening; destructive replacement separated |
| Logframe | Bounded viewport, search/coverage/group collapse, full result evidence | Original edits including zero, full XLSX despite filtering, print restores hidden rows, mobile group button visible |
| Budget reports | Separate approved/spent unit types, quantities/costs, remaining units and explicit staff names | Source CSV/XLSX provenance, explicit zero/missing/refund/conflict fixtures, retained monetary columns and CSV views |

## Findings and corrections

| ID / severity | Independent finding | Root correction and verification |
| --- | --- | --- |
| DETAIL-AUDIT-01 / high | Legacy parser default zero could become derived cost when actual expenditure was absent | Track source numerator presence/conflicts; missing or blank withholds cost, explicit zero derives zero, refunds stay negative; original snapshot amounts unchanged |
| DETAIL-AUDIT-02 / medium | Original engine may select a budget dated after the report | Withhold derived unit balance and disclose chronology; original monetary engine remains unchanged |
| USER-05 / high | Following a deadline left its modal covering the destination | Close modal on native source link; real browser task verified |
| USER-06 / medium | Approved and consumed units could have different types, but only one type was shown | Separate Approved unit and Spent unit columns; incompatible remaining quantity withheld |
| CODE-05 / high | A delayed old source could attach metadata to a replacement dataset with the same IDs | Capture state/project/report/snapshot identity and full project fingerprint; cancel changed reads without portfolio/history mutation; delayed replacement and in-place source mutation regressions |
| UX mobile / medium | Result collapse control lay outside initial phone viewport | Put control on left at phone widths, show sideways-column hint; 320/390px geometry regression |

The source-module initial implementation was authored by the code architect.
Root implemented the workspace integration and corrections. Source correctness
was independently reviewed by audit and product roles; the architect cannot be
its sole approver. Agent reviews are not human or institutional certifications.

## Verification and final decisions

The original Professional suite has 12 check groups: 42 route comparisons,
108 cached scenario/method outputs, native workflows and real exports, with
50/200/1000-project measured fixtures. The refinement suite now has nine groups,
including delayed-source lifecycle protection and desktop/390/320px tasks.
Both final runs passed on the candidate above: **12 Professional groups and nine
refinement groups**. Build/ZIP repeatability, baseline checksum, JavaScript syntax
and Git whitespace checks passed. Desktop, 390px and 320px browser tasks passed
without document-width overflow or page errors. Screenshots were regenerated
after the transient test notification closed.

| Role | Current candidate verdict |
| --- | --- |
| General Director / root | APPROVE: five user objectives, visual review, final 12+9 tests and six independent decisions completed |
| Project manager | APPROVE: current HTML/ZIP equality, delivery naming, acceptance coverage, source limits; PM-REF-01 documentation completion closed below |
| Code architect | APPROVE integration/lifecycle: independently reproduced delayed replacement, same-project source mutation, legitimate hydration/undo; CODE-05 closed |
| UX/UI director | APPROVE: initial 320/390px collapse control visible at x44–204, warning geometry and exact queue; medium mobile finding closed |
| Product evaluator | APPROVE: five repeated workflows; native project edit during paused source read cancels stale metadata and leaves retry enabled |
| Independent auditor | APPROVE: five delayed state/project/content/snapshot/report replacement cases cause no write/history; original/lossless/ZIP/source guards verified |
| Experienced end user | APPROVE: five workflows at 1440/390/320px, USER-05/06 closed; race runtime verification belongs to architect/audit/product |

All seven decisions concern the same final candidate hash above. No blocking,
high or medium finding remains within these reviewed workflows. PM-REF-01 is
closed by recording the actual final results and independently received verdicts.
A low UX reservation remains for later work: mobile result-collapse buttons are
approximately34.5px high; increasing them to44px would improve touch comfort.
This accepted low reservation does not claim full accessibility compliance.

## Material limits

Supplementary unit/name fields require recognized explicit CSV/XLSX headers and
exact budget-line codes. Arbitrary report layouts, OCR, names embedded in prose,
or inferred employee-to-line assignments are not invented. Older snapshots may
lack the extra metadata; the stored-original read action can recover it only
when the exact linked original is readable. Otherwise upload the original again.
An empty cell is unknown; established zero remains zero. Recorded project team
names are separately shown and are not guessed onto budget lines. Unit quantities
and rates are not summed across incompatible lines. Calendar warnings indicate
unmarked completion/receipt in the register, not proven non-submission.

Screenshots under refinements/ use disposable sample/source fixtures. Browser
checks do not certify every document format, accessibility criterion or workload.
Performance medians measure Analytics HTML evaluation, excluding DOM/layout and
parsing; reduced repeated calculations do not guarantee every workload is faster.
