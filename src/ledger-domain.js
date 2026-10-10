/* Domain projections. Financial facts remain owned by the tested ledger engine. */
function cleanLedgerReviews(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 10000)
      .filter(
        ([key, v]) =>
          key.length <= 240 &&
          key.includes(":") &&
          v &&
          typeof v === "object" &&
          ["open", "progress", "reviewed", "resolved"].includes(v.status),
      )
      .map(([key, v]) => [
        key,
        {
          fingerprint:
            typeof v.fingerprint === "string" ? v.fingerprint.slice(0, 80) : "",
          status: v.status,
          owner: typeof v.owner === "string" ? v.owner.slice(0, 120) : "",
          note: typeof v.note === "string" ? v.note.slice(0, 2000) : "",
          due:
            typeof v.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.due)
              ? v.due
              : "",
          at: typeof v.at === "string" ? v.at.slice(0, 40) : "",
        },
      ]),
  );
}
function createLedgerDomain(host) {
  const cache = new WeakMap();
  let version = "";
  function models(projects) {
    const next = host.revision();
    version = next;
    return projects.map((p) => {
      const hit = cache.get(p);
      if (hit?.version === version) return hit.value;
      const value = host.model(p);
      cache.set(p, { version, value });
      return value;
    });
  }
  const sumKnown = (R, predicate, field) => {
    const covered = R.filter(predicate);
    return {
      value: covered.length ? covered.reduce((n, r) => n + r[field], 0) : null,
      covered: covered.length,
      total: R.length,
    };
  };
  function financial(R) {
    return {
      ...host.financialSummary(R),
      spent: sumKnown(R, (r) => r.evidence.actual, "sp"),
      committed: sumKnown(R, (r) => r.evidence.committed, "co"),
      forecasts: sumKnown(R, (r) => r.forecastAvailable, "eac"),
      pace: R.filter((r) => r.pace !== null).length,
      delivery: R.filter((r) => host.delivery(r.p)?.total > 0).length,
    };
  }
  function stableKey(text) {
    let hash = 2166136261;
    for (const char of text)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(36);
  }
  function observations(R) {
    const byKey = new Map();
    const put = (x) => {
      const key = x.p.id + ":" + stableKey(x.category + "|" + x.title);
      const evidence = host.reports(x.p).at(-1);
      const fingerprint = stableKey(
        x.reason + "|" + (evidence?.id || "") + "|" + (evidence?.date || ""),
      );
      const contractCondition = /report.*(overdue|in \d)|heading/i.test(
        x.title,
      );
      const source = contractCondition
        ? x.p.contract?.fileName || "Contract calendar and budget checks"
        : x.category === "delivery"
          ? x.p.doa?.fileName || "Recorded activity plan"
          : x.category === "continuity"
            ? "Project continuity record"
            : evidence?.fileName || evidence?.name || "Project records";
      const stored = host.reviews()[key];
      const review = stored?.fingerprint === fingerprint ? stored : {};
      byKey.set(key, {
        ...x,
        key,
        fingerprint,
        review,
        status: review.status || "open",
        source,
        sourceDate:
          contractCondition || x.category === "continuity"
            ? ""
            : evidence?.date || "",
        owner: review.owner || "",
        amount: R.find((r) => r.p.id === x.p.id)?.evidence.exposure
          ? R.find((r) => r.p.id === x.p.id).u
          : null,
      });
    };
    for (const [priority, tone, title, p, link, due] of host.actions(R)) {
      const category = /successor/i.test(title)
        ? "continuity"
        : /report|heading|spend|absorp|financial/i.test(title)
          ? "finance"
          : "delivery";
      put({
        p,
        category,
        priority,
        tone,
        title,
        due,
        reason: title,
        link,
        next:
          category === "continuity"
            ? "Confirm a successor decision and date"
            : category === "delivery"
              ? "Review activity progress against the recorded plan"
              : "Check the report and record the follow-up",
      });
    }
    for (const check of host.quality(R))
      for (const { r, t } of check.items) {
        const category = /Staff/i.test(check.label)
          ? "people"
          : /Successor/i.test(check.label)
            ? "continuity"
            : /findings/i.test(check.label)
              ? "delivery"
              : "evidence";
        put({
          p: r.p,
          category,
          priority: 2,
          tone: "neutral",
          title: check.label,
          reason: t,
          link: host.projectLink(r.p, check.tab),
          due: "",
          next:
            category === "people"
              ? "Verify the contract and missing FTE details"
              : "Inspect the original source and update the record",
        });
      }
    return [...byKey.values()].sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.due || "9999").localeCompare(b.due || "9999") ||
        a.p.code.localeCompare(b.p.code),
    );
  }
  function sources(R) {
    return R.flatMap((r) => {
      const p = r.p,
        linked = new Set((p.docs || []).map((d) => d.ref).filter(Boolean));
      const docs = (p.docs || []).map((d) => ({
        key: p.id + "/doc/" + d.id,
        p,
        name: d.fileName,
        date: (d.addedAt || "").slice(0, 10),
        type: d.kind || "document",
        state: d.extraction?.status || "stored",
        detail: d.extraction?.summary || "Original document retained",
        href: host.projectLink(p, "documents/documents"),
        download: p.id + "|" + d.id,
      }));
      const reports = (p.reportingPeriods || [])
        .filter((q) => !linked.has(q.id))
        .map((q) => ({
          key: p.id + "/report/" + q.id,
          p,
          name: q.fileName || q.name,
          date: q.date || "",
          type: q.type || "report",
          state: "registered",
          detail: q.name || "Financial source",
          href: host.projectLink(p, "finance/reports"),
          download: "",
        }));
      return [...docs, ...reports];
    }).sort(
      (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
    );
  }
  return { models, financial, observations, sources };
}

/* Device preferences are separate from portfolio facts, migrations are additive. */
function createLedgerPreferences(storage, onFailure) {
  const key = "ledger.atelier.v1";
  const homeIds = ["decisions", "position", "dates", "changes"];
  function clean(value) {
    const v = value && typeof value === "object" ? value : {};
    const order = Array.isArray(v.homeOrder)
      ? v.homeOrder.filter((x) => homeIds.includes(x))
      : [];
    return {
      version: 1,
      homeOrder: [...new Set([...order, ...homeIds])],
      projectsView: ["directory", "cards", "countries", "compare"].includes(
        v.projectsView,
      )
        ? v.projectsView
        : "directory",
      peopleTab: ["assignments", "people", "contracts"].includes(v.peopleTab)
        ? v.peopleTab
        : "assignments",
      planningTab: ["agenda", "calendar", "timeline", "continuity"].includes(
        v.planningTab,
      )
        ? v.planningTab
        : "agenda",
    };
  }
  let state = clean(storage.get(key));
  return {
    get: () => state,
    set(patch) {
      state = clean({ ...state, ...patch });
      if (!storage.set(key, state)) onFailure();
      return state;
    },
  };
}
