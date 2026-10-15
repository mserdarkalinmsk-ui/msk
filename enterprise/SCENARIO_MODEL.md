# Advanced scenario model v3

## Financial contract

The original **Compare scenarios** screen is replaced in the generated application. The preserved upload in `vendor/` stays unchanged for audit and reproducibility. Its fallback `observed rate || exposure / elapsed months` is not used by the new screen.

Amounts are EUR. Define:

- **A**: reported cumulative actual spend at the selected source snapshot.
- **C**: open commitments at that same snapshot, excluding amounts already in A.
- **B**: current registered budget. A scenario may change the limit to **B′**, without editing B.
- **U**: explicitly planned, still uncommitted future costs.
- **G**: a gross future spending envelope that **already includes** settlement of C.
- **X**: a separate additional one-off cost excluded from both C and the selected cost basis.

### Uncommitted cost plan

```text
Projected cost at completion = A + C + U + X
```

The user must confirm that U is complete and does not contain C. An empty confirmed plan means U = 0; an empty unconfirmed plan is unknown and withholds the projection.

Cost lines have a name, staff/other category, one-off/monthly recurrence and non-negative amount. A future-rate change applies to monthly lines only. A staff reduction applies only to explicitly uncommitted staff lines. Neither control reduces A or C.

### Observed or explicitly assumed gross rate

```text
Gross future envelope G = monthly rate × modeled months × rate multiplier
Commitment overlap removed = min(C, G)
Incremental future cost = max(0, G − C)
Projected cost at completion = A + C + max(0, G − C) + X
                            = A + max(C, G) + X
```

This equation prevents the **same modeled commitment amount** from being added both as C and inside G. The rate's coverage must be explicitly confirmed. That confirmation is an assumption about real-world coverage, not automatic invoice-level reconciliation.

Observed rate uses the difference between two complete, matching-scope cumulative reports at least 30 days apart. Commitments and elapsed project time are never a fallback. Observed zero stays zero. A negative cumulative change may be a refund or correction; it does not establish forward spending. The user must use a cost plan or a clearly identified manual rate instead.

A manual rate is labeled a user assumption. Blank is unknown; explicit zero is valid. In gross-rate modes, staff reductions are disabled because the uncommitted staff share has not been established.

## Timing and extensions

Projection starts at the **latest usable source date**, not a later reporting date with unreported actuals. The reporting date selects which sources may be used. A lag between the snapshot and reporting date is shown explicitly.

The two extension policies are independent choices:

1. **Fixed workload:** preserve the modeled original remaining cost; extend the time available. The arithmetic average per month falls, but the total does not automatically rise.
2. **Fixed rate:** continue recurring costs into the additional months. Recurring total can rise; one-off costs and recorded commitments are not automatically multiplied.

Monthly amounts use actual days / 30.4375. Calendar end-date extension clamps to the end of the target month rather than rolling into another month. Average remaining outflow is an arithmetic average, not a payment schedule. No commitment maturity schedule is inferred.

## Budget and verdicts

```text
Headroom after recorded obligations = B′ − A − C
Forecast overrun = max(0, projected cost − B′)
Forecast headroom = max(0, B′ − projected cost)
Recorded actual over scenario limit = max(0, A − B′)
Recorded exposure over scenario limit = max(0, A + C − B′)
```

These are separate results. A forecast overrun is never labeled current expenditure. Scenario utilization and recorded actual utilization are displayed separately. A zero scenario budget does not produce an invented percentage. Spending an entire budget is not presented as an objective.

The screenshot regression is covered directly: with A + C = **€461,888**, confirmed U = 0 and X = 0, reducing B from **€1,482,000** to **€1,333,800** leaves projected cost at **€461,888**, with **€871,912** headroom and **€0** forecast overrun. This is a conditional example, not a reconstruction of the user's actual/commitment split.

## Readiness, persistence and audit

- Every mode needs known actuals, known non-negative open commitments, a dated current snapshot, a usable schedule and a non-negative budget. Freshness is the existing explicit 180-day product policy.
- Missing source values, unconfirmed coverage, invalid amounts and unsupported assumptions withhold the projection rather than producing a default zero.
- Draft controls do not change project records. **Save scenario assumptions** writes only scenario metadata through the application's audit, undo and confirmed IndexedDB flow.
- `ledger.enterprise.scenarios[projectId]` contains the configuration, model version, source key and save timestamp. The source key covers source identity/date/line scope, actuals, commitments, budget, schedule and comparable history.
- Changed source data remounts the draft with confirmations reset. Old saved projections are excluded from the portfolio forecast until reviewed and saved against the new baseline.
- The first saved card is the reference scenario for the executive brief. A full portfolio forecast requires usable saved reference scenarios for every selected project. A report pair alone does not supply a complete cost model.
- Scenario JSON and CSV carry source dates, inputs, blockers and separate cost components. Full portfolio JSON contains saved scenarios. Follow-up-only backups do not.
- View-only copies allow exploration but not saved changes. Unsaved drafts are explicitly labeled and are not used by the executive brief.

## Source layout and validation

`src/scenario-domain.js` is a pure model with no browser dependency. `src/scenario-ui.js` is the shared comparison editor used by both the decision workspace and the replaced original project screen. `src/bridge.js` persists scenario metadata; `src/report.js` includes saved source-matched reference models.

Run `npm test` and `npm run test:browser` from `enterprise/` after building. The scenario suite includes overlap, zero-rate, missing evidence, extension policies, staff reductions, screenshot regression, source invalidation, nonmutation and malformed-configuration tests.

This is deterministic scenario analysis, not a probability model, automatic approval, accounting certification, complete cash-flow schedule or a guarantee that manually entered cost lines do not overlap. Original documents and cost-plan completeness still need review.
