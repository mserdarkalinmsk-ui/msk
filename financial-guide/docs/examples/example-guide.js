/* Example guide: copy to src/guides/<name>.js, replace the content, run the build and the tests. */
(function () {
  "use strict";
  FG.registerGuide({
    base: "example-guide",                       // address: #/example-guide
    title: "Example guide",
    lead: "One sentence that says what this guide helps people do.",
    parent: ["Projects", "projects"],             // breadcrumb parent
    phases: [["Prepare", ["Start"]], ["Finish", ["Close"]]],
    stages: [
      { name: "Start", title: "Start the file", source: "Ch. 1", lead: "What this stage is for, in one sentence.",
        remember: "The one rule to remember, in a few words.",
        understand: "Why this stage matters.", do: "What you actually do.", check: "How you know it is done.",
        keyFacts: [["2 weeks", "lead time"]],
        sections: [["First topic", { lead: "The main point of the topic.", items: [["Term", "What it means, as a full sentence."]], must: ["A binding rule, as a full sentence."], tip: "Good practice, as a full sentence." }]],
        warning: "The most common mistake.", best: "The best practice.", checklist: ["A concrete check."], links: [] },
      { name: "Close", title: "Close the file", lead: "What this stage is for.", understand: "Why.", do: "What.", check: "How.",
        sections: [["Archive", { lead: "Keep the evidence together." }]] },
    ],
    facts: { Start: { "2 weeks": { what: "What the figure means, from the source.", why: "What goes wrong if it is missed.", ref: "1.2" } } },
    reference: { limits: [{ value: "2 weeks", rule: "Submit at least two weeks before the start.", who: "Requester" }], roles: [], howTo: [] },
    essentials: [],                                // optional: [cat, title, fig, text, stage, [question, true/false, explanation]]
    quiz: [],                                      // 20 questions: { level 1–5, type tf|mc|scenario|order, q, options, answer, explain, hint, stage }
    tools: [["File builder", "The existing interactive builder.", "po-file"]],  // optional links to existing tools
  });
})();
