/* Module briefs: rule, three steps and key figures, drawn from the existing module content. */
(function () {
  "use strict";
  const C = window.FG_CONTENT;
  C.moduleBriefs = {
    "po-file": {
      title: "Prepare a PO file",
      lead: "Build a complete, signature-ready and audit-ready purchase order file for the selected service type.",
      remember: "No activity starts before the PO is issued and documents are countersigned.",
      understand: "The PO is the commitment that allows work to start, so it must rest on confirmed budget, a valid supplier route and the correct signatures.",
      do: "Confirm the budget, the PMM activity ID and the supplier in FIMS, prepare the contractual package, obtain prior CCM approval and submit the complete file so that the ACCM can create the PO.",
      check: "The PO has been issued, the contract was signed and dated after the PO and before delivery, the countersigned documents have been returned to the supplier and the issued PO is kept in the file.",
      figures: [
        ["2 weeks", "Submission lead time", "Submit the PO request at least two weeks before the scheduled start date to leave enough time for approval."],
        ["PMM ID", "PO prerequisite", "No PO can be raised without the PMM project and/or activity ID, and no PO can be raised before the supplier exists in FIMS."],
        ["€55k–€184k", "Legal review band", "Procurements in the €55,000 to €184,000 band should follow the applicable legal and procurement review route."]
      ]
    },
    "payment-file": {
      title: "Prepare a payment file",
      lead: "Continue the control trail from the PO stage and build a finance-ready payment file.",
      remember: "Pay only for completed, accepted work that matches the approved contractual basis.",
      understand: "A payment closes the trail opened at PO stage, so it must match the same contract, supplier and approval route.",
      do: "Confirm completion with a signed Certificate of Acceptance of Work or Payment Request Memorandum, match the invoice to the PO and contract, complete the PMM synopsis and obtain CCM approval before the file goes to the Treasurer.",
      check: "The payment file is complete, the ACCM has recorded the CCM approval, discrepancies are resolved and the payment evidence is archived until settlement.",
      figures: [
        ["60 days", "Default payment term", "The default payment term is 60 days from receipt of the invoice or execution, whichever is later, unless the contract sets other terms."]
      ]
    },
    "year-end": {
      title: "Year-end closing",
      lead: "Check delivery dates, complete payment files, follow up suppliers and finalise POs when the expenditure is fully recorded.",
      remember: "Only delivery by 31 December 2026 counts as 2026 expenditure.",
      understand: "Expenditure must be charged to the financial year in which the goods were delivered or the services were rendered.",
      do: "Review open POs, follow up suppliers for missing invoices and send complete payment files to Finance as soon as they are ready.",
      check: "All 2026 expenditure is recorded in FIMS and the Fiche PO shows it under Amount billed or Invoices before the PO is finalised.",
      figures: [
        ["31/12/2026", "Delivery cut-off", "Only goods delivered and services rendered by 31 December 2026 can be included in 2026 expenditure."]
      ]
    },
    "petty-cash": {
      title: "Petty cash",
      lead: "Use petty cash only for small-value operational needs, within the authorised limit, with a clear supporting file.",
      remember: "Get CCM approval before spending, and keep each invoice paid by petty cash at or below €50.",
      understand: "Petty cash is a small-value exception, so it must not replace the normal procurement or payment route.",
      do: "Check each invoice against the €50 limit, obtain CCM approval, let the ACCM issue the PO and send the request to DPFL, which transfers the approved amount to a local bank account.",
      check: "Every cash advance has a signed cash transfer form, cash is kept in a lockable box, and each invoice is supported by evidence of its link to the project, such as the activity, date and place, or for taxis the traveller, purpose and why public transport was not used.",
      figures: [
        ["€50", "Per invoice", "Invoices paid by petty cash must not exceed €50 each; above that, use the normal purchasing and payment route."],
        ["Lockable box", "Cash custody", "Every staff member who receives a cash advance signs a cash transfer form and keeps the cash in a lockable box."]
      ]
    },
    "filing": {
      title: "Filing and audit trail",
      lead: "Keep project, procurement and financial records easy to find, easy to verify and ready for review.",
      remember: "Store every approval and document with the transaction it supports.",
      understand: "A complete and traceable file shows why each action was taken, who approved it and how it was executed.",
      do: "File decision, approval and execution evidence in the DMS project folder, using clear names, dates and references, and keep project documentation electronically and physically.",
      check: "Final PDF evidence and its editable source are kept together and every file can be found and verified.",
      figures: [
        ["10 years", "Retention period", "Project documentation, including deliverables and supporting documents, must remain easy to retrieve for audit for ten years after the end of the project."]
      ]
    },
    "foma": {
      title: "FOMA workflows",
      lead: "Controlled handover workflows and financial guidance for day-to-day field-office operations.",
      remember: "Each file moves to the next role only after its control is complete.",
      understand: "Field-office files pass between the requester or Project Team, ACCM, RFO and CCM, and each role has its own control.",
      do: "Choose the workflow, complete your stage and hand the file over to the next role in the route.",
      check: "Each stage has been controlled and the file has reached the final validation or the donor route where required.",
      figures: []
    },
    "foma/reports": {
      title: "Financial reporting",
      lead: "Prepare and reconcile the project's current financial position and retain a controlled reporting package.",
      remember: "Reconcile spent and committed figures to the source data before finalising.",
      understand: "The financial report gives a clear and traceable picture of the project's current financial position for review and validation.",
      do: "Build the report from the correct data, reconcile it, apply the JP or VC structure and complete the reporting controls.",
      check: "No unexplained discrepancy, broken formula or unsupported figure remains, and the final report is archived with its evidence.",
      figures: [
        ["Quarterly", "Reporting frequency", "Quarterly financial reporting is required."],
        ["Once a year", "Forecast in the report", "At least once per year, the report should include actual and forecast expenditure for the coming year."]
      ]
    },
    "foma/forecast": {
      title: "Forecast and budget revision",
      lead: "Plan future expenditure, revise the budget and identify the applicable route.",
      remember: "Assess the ±25% threshold per Budget Heading, not the project total.",
      understand: "The size of each Budget Heading variation and any contractual change decide whether a revision follows the Notification or Addendum route.",
      do: "Prepare the FORECAST working sheet, collect the Project Team input, then review the variations and decide the route.",
      check: "Formulas are intact, the Project Team input is consistent and the route decision is documented.",
      figures: [
        ["±25%", "Budget Heading threshold", "For a Joint Programme, a variation within ±25% at Budget Heading level follows Notification, and a variation above ±25% follows Addendum."]
      ]
    },
    "foma/addendum": {
      title: "Addendum workflow",
      lead: "Prepare a Joint Programme Addendum package from the latest financial report and forecast.",
      remember: "Changes to total cost, duration or scope always require an Addendum.",
      understand: "An Addendum amends the donor-approved contractual budget, so it needs a clean, validated and justified package.",
      do: "Confirm the route, prepare the revised budget, collect the Project Team justification and build the clean donor package.",
      check: "The Addendum is signed by both parties, the revised budget is uploaded to PMM and all project records are aligned.",
      figures: [
        ["±25%", "Addendum trigger", "Where any relevant Budget Heading of a Joint Programme exceeds ±25%, the Addendum route applies."]
      ]
    },
    "vat": {
      title: "VAT procedures",
      lead: "Clarify VAT before signature, check it at PO and invoice stage, and keep the VAT trail.",
      remember: "Clarify VAT before signing the contract or order form.",
      understand: "VAT exemption is a privilege of the Council of Europe, and staff must follow the procedures carefully and meet the deadlines for requesting exemption certificates.",
      do: "Establish the supplier's VAT status and place of taxation, request any exemption certificate through MSA form 9215 within the deadlines, check the invoice particulars and pay to the contractual bank account.",
      check: "The invoice matches the agreed VAT treatment and the VAT correspondence is filed in the DMS with the invoice and payment evidence.",
      figures: [
        ["MSA 9215", "Exemption certificate form", "All requests for VAT exemption certificates go through MSA form 9215 and its SLA, which help departments submit correct files and limit the risk of rejection by the French authorities."],
        ["€5,000", "Single card purchase", "A single card purchase is limited to €5,000, and card payments remain exceptions."],
        ["€30,000", "Monthly card limit", "The Organisation-wide monthly card limit is €30,000; larger amounts should preferably be paid by transfer."],
        ["60 days", "Default payment term", "The default payment term is 60 days from receipt of the invoice or execution, whichever is later, unless the contract sets other terms."]
      ]
    },
    "events": {
      title: "Events and GDD",
      lead: "Manage event finance from the call-off to the payment file, including budget reconciliation and exchange-rate evidence.",
      remember: "Document every budget change and keep CCM approval for significant ones.",
      understand: "The final event budget often differs from the initial one, so each change must be explained and supported in the payment file.",
      do: "Run the call-off, submit the Event Management PO, collect delivery evidence and compare the final budget with the initial one.",
      check: "The payment file holds the signed final budget, CCM approval e-mails for significant changes and exchange-rate evidence where needed.",
      figures: []
    }
  };
})();
