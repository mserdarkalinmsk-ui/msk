# Financial Guide · Academy

A single offline HTML file (`dist/financial-guide-academy.html`, ~375 KB) that teaches
project-finance rules and helps people find their own gaps.

- **Learn**: first-day tour, 8 learning paths, 39 short lessons (one sentence → why / do / done when → example → key figures → deeper topics → check).
- **Practise**: 88 questions and real cases, weakest topics first; a wrong answer links to the lesson that fixes it.
- **Find my gaps**: a 5-minute check that produces a knowledge map and a personal plan.
- **Tools**: route simulator (value → procedure, decision-maker, extra controls), "I'm stuck", glossary with in-context term popovers, Ctrl K search with direct answers (e.g. "40k consultant").

Content comes from the original guide (`content/source.json`); every question is tied to a lesson topic.

```sh
python3 build.py         # → dist/financial-guide-academy.html
node tests/academy.cjs   # thresholds, routes, review flow, mobile overflow
```
