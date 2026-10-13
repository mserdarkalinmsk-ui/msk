/* Verified notes for stage key figures (from the Procurement and Grants guides; €184,000 threshold). */
(function () {
  "use strict";
  const C = window.FG_CONTENT;
  C.factNotes = {
    procurement: {
      "Foundations": {
        "Rule No. 1395": { what: "Rule No. 1395 of 20 June 2019 complements the Financial Regulations and lays down the details of every procurement procedure, from tender file to contract signature.", why: "All Council of Europe purchases must follow one of its procedures; an annotated version on the Tenders Board page answers recurring questions.", ref: "1.1.1" },
        "31 March": { what: "Staff involved in procurement must submit a declaration of interests each year by 31 March, or within one month of taking up duties for new appointees.", why: "The declaration (Rule No. 1/2026) is checked in audits and protects you and the procedure from conflict-of-interest challenges.", ref: "1.1.2" },
        "0": { what: "The Council applies a no-gift policy: staff involved in procurement or grants cannot receive any gifts or hospitality from current or prospective contractors, whatever their value.", why: "Accepting even a small gift breaches the Code of Conduct and can lead to disciplinary sanctions and tainted procedures.", ref: "1.1.2" }
      },
      "Roles & Funding": {
        "€184,000": { what: "The Tenders Board ensures compliance with the competitive tendering rules for all contracts exceeding €184,000 excluding VAT.", why: "Above this amount the Board must authorise the procedure beforehand; it cannot approve an international call retroactively.", ref: "2.2.2" },
        "€55,000–€184,000": { what: "Since 1 February 2025, competitive bidding and direct award procedures funded wholly or partly by extrabudgetary funds between €55,000 and €184,000 excl. VAT need a DLAPIL Legal Compliance Review.", why: "The CCM or Commitments Officer may only approve the launch once the review is completed, so plan for it in your timetable.", ref: "2.2.2" },
        "48 h": { what: "The Procurement Unit (procurement@coe.int) operates a 48-hour service level for providing an initial response to queries.", why: "Contact them early: a first answer comes within two days, but complex advice may take longer than your deadlines allow.", ref: "2.2.3" }
      },
      "Market & Suppliers": {
        "3": { what: "In a competitive bidding procedure the buyer entity must invite at least three potential suppliers to submit an offer (Rule 1395, Article 21.2).", why: "The three must be meaningful candidates able to deliver good bids; inviting suppliers just to reach the number defeats competition.", ref: "4.3.2" },
        "50,000+": { what: "FIMS already holds over 50,000 supplier entries, but the renewal rate of active suppliers is very low.", why: "Relying only on known suppliers limits competition; actively look for new bidders through market research and CEIs.", ref: "4.3.1" },
        "Art. 5": { what: "Under Article 5 of Rule 1395 a call for expressions of interest seeks interest from capable suppliers and is explicitly not a procurement procedure.", why: "A CEI only builds a list of potential suppliers; a contract still requires a proper procurement procedure afterwards.", ref: "4.3.2" }
      },
      "Define the Need": {
        "2 years": { what: "For Ordinary Budget purchases, needs should be assessed over the whole two-year budget cycle when defining the requirement and threshold.", why: "Splitting similar needs across the cycle risks applying the wrong threshold and procedure.", ref: "4.4" },
        "Whole project": { what: "For co-operation projects, foreseeable similar needs must be assessed over the whole project duration, including possible project extensions.", why: "Ignoring extensions can push spending above the threshold of the procedure used, a serious breach of the rules.", ref: "4.4" },
        "3 weeks": { what: "Under an international public call for tenders, the submission deadline cannot be shorter than three weeks from publication.", why: "Higher-threshold procedures also need several validations, so build this minimum publication time into your planning.", ref: "4.6.3" }
      },
      "Contract Types": {
        "4 years": { what: "Framework contracts and framework agreements should not last more than four years, or five years in exceptional circumstances.", why: "The limit respects non-exclusivity and periodic competitive tendering; longer contracts need strong justification.", ref: "3.3.1" },
        "3": { what: "Framework agreements are always multiple, and a minimum of three suppliers per lot (or per agreement without lots) is recommended.", why: "Fewer suppliers undermines the mini-competition that makes each call-off competitive.", ref: "3.4.1" },
        "2–3 months": { what: "Order forms or call-offs placed near expiry should not run beyond the contract's end date by more than two to three months.", why: "A new contract should be concluded as soon as possible; long run-ons circumvent competitive tendering.", ref: "3.3.2" }
      },
      "Thresholds & Procedure": {
        "€2,000 / €6,000": { what: "Direct award is possible below €2,000 excl. VAT for goods and general services, and below €6,000 excl. VAT for intellectual services chosen on expertise.", why: "Above these ceilings at least a competitive bidding procedure is needed, and total spending under the contract must stay below them.", ref: "4.6.1" },
        "€184,000": { what: "Contracts with estimated total expenditure above €184,000 excl. VAT require an international public call for tenders authorised by the Tenders Board.", why: "If the estimate is close to €184,000, launch an international call: the Board cannot approve one retroactively.", ref: "4.5.2" },
        "€10,000": { what: "Within competitive bidding, purchases under €10,000 excl. VAT may be made by comparing publicly available prices of at least three suppliers instead of inviting tenders.", why: "Prices must be publicly visible, not quotes, and screenshots of the three suppliers must be kept on file.", ref: "4.6.4.2" }
      },
      "Tender Design": {
        "20 points": { what: "The weighting of the financial offer cannot in principle be lower than 20 points, unless a minimum score or exclusion level is set.", why: "Under-weighting price undermines value for money and the defensibility of the award decision.", ref: "4.8.3.3" },
        "Out of 10": { what: "Each technical or quality award criterion should be scored out of 10, then weighted according to the need, with a written justification for each score.", why: "Consistent scoring and justifications make the ranking transparent and defensible against enquiries and complaints.", ref: "4.9.6.4" },
        "15–35%": { what: "When limiting financial dependence, a bid representing between 15% and 35% of the supplier's annual turnover is considered satisfactory.", why: "This replaces excessive turnover requirements that would shut out newly created or small suppliers.", ref: "4.8.3.2" }
      },
      "Terms & Specifications": {
        "180 days": { what: "Offers are valid for 180 calendar days from the submission deadline; the period can be increased after consulting DLAPIL.", why: "After expiry bidders are no longer bound and may refuse to sign unless all agree in writing to extend.", ref: "4.8.4.3" },
        "3 weeks": { what: "In an international public call for tenders, the deadline for submission of offers cannot be shorter than three weeks.", why: "The deadline must also be proportionate to complexity; too short a period reduces competition and can invalidate the procedure.", ref: "4.8.4.2" },
        "3 months": { what: "For tacit renewal, a three-month notice to object is usually considered reasonable, and the notice period may never be shorter than one month.", why: "Without proper notice the contract renews automatically each year until its final end date.", ref: "4.8.9.2" }
      },
      "Authorise & Launch": {
        "5 working days": { what: "Complete requests for a Legal Compliance Review are processed by DLAPIL within 5 working days.", why: "Incomplete requests cause delays or requests for more information, and the launch cannot be approved before the review is done.", ref: "4.9.1" },
        "48 h": { what: "Tenders Board electronic consultations give members at least 48 hours (two working days) to approve; and no answers to bidders' questions are given later than 48 hours before the submission deadline.", why: "Plan both margins: Board approval cannot be rushed, and late questions cannot be answered, so publish early and answer promptly.", ref: "4.9.1 / 4.9.3" }
      },
      "Open & Evaluate": {
        "2": { what: "Bids must be opened and analysed by at least two authorised staff members of the buyer entity.", why: "The four-eyes principle protects the integrity of the procedure and is checked during audits.", ref: "4.9.6" },
        "10": { what: "The maximum score per technical or quality criterion is 10, each score then being weighted and justified in writing.", why: "Scores outside the published scale or without justification make the evaluation open to challenge.", ref: "4.9.6.4" },
        "Art. 17.2": { what: "Article 17.2 of Rule 1395 allows offers to be clarified or supplemented, but this must not change their principal features or distort competition.", why: "Letting a bidder improve its offer through clarifications breaches equal treatment and can void the award.", ref: "4.9.7" }
      },
      "Negotiate & Award": {
        "15 days": { what: "Unsuccessful bidders must be informed in writing no later than 15 days after the contract with the selected supplier has been signed.", why: "Sign first, then notify promptly; late notification breaches the rule and delays the enquiry and complaint periods.", ref: "4.9.11" },
        "7 days": { what: "Unsuccessful bidders may submit a written enquiry within seven days of notification of the outcome, answered without undue delay.", why: "Clear, prompt answers to enquiries reduce the risk of formal complaints.", ref: "4.9.14" },
        "30 days": { what: "A bidder who considers an error affected the outcome may complain in writing to the Tenders Board within 30 days; the Board replies within 30 days.", why: "Well-documented evaluations are your defence; a rejected complaint after an international call may go to an ad hoc review board.", ref: "4.9.14" }
      },
      "Contract Signing": {
        "MSA 4002": { what: "For a new supplier, the supplier identity must be created in FIMS using form MSA 4002, processed by the Treasury, Payments and Accounting Department.", why: "Without the FIMS record no purchase order or payment can be made to the supplier.", ref: "4.10" },
        "CCM": { what: "When an act of engagement is used for a one-off contract, the relevant CCM signs it unless he or she expressly delegates the power to sign.", why: "A one-off contract is both a legal and a financial commitment, so the signatory must be duly authorised.", ref: "4.8.6.1" },
        "PO": { what: "All purchases must be subject to a budgetary commitment (purchase order in FIMS) before any contract is signed by the Organisation.", why: "Signing without a PO is a breach of financial rules, and no goods or services may be provided before signature.", ref: "4.10" }
      },
      "Contract Management": {
        "€184,000": { what: "Expenditure under a framework contract concluded after competitive bidding must not exceed €184,000, the threshold that defined the procedure.", why: "Exceeding it is a severe breach; an international call approved by the Tenders Board must then cover the remaining needs.", ref: "5.4.2" },
        "10%": { what: "Small call-off amendments not affecting substance and not increasing the original value by more than 10% may be concluded with CCM authorisation.", why: "Increases above 10% require DLAPIL advice, as they may amount to an unlawful new award.", ref: "5.2.2" },
        "3": { what: "If a supplier fails more than three times to justify not submitting a tender for call-offs, the Council may terminate the framework agreement with that supplier.", why: "Unresponsive suppliers weaken mini-competitions; keep records of refusals to justify any termination.", ref: "5.4.3" }
      },
      "Contract Execution & Payment": {
        "60 days": { what: "By default the Council pays 60 days from receipt of the invoice or execution of the contract, whichever is later.", why: "Different terms are negotiable but must be approved by TPA; French law forbids terms above 60 days net.", ref: "5.7.4" },
        "€5,000": { what: "When payment by card is unavoidable, a single purchase may not exceed €5,000, with total monthly card purchases capped at €30,000 Organisation-wide.", why: "Payments are normally by bank transfer; a PO is needed first and larger amounts should go by transfer.", ref: "5.7.3" },
        "DAP": { what: "For goods, the recommended Incoterm is DAP (Delivered at Place) with delivery to a Council of Europe address.", why: "The Incoterm fixes who bears transport costs, risks and customs formalities; a wrong one can create unexpected costs.", ref: "5.7.5" }
      },
      "Performance & Filing": {
        "10 years": { what: "All contractual documents listed in Chapter 4.10 must be kept for 10 years.", why: "Auditors and donors may request the full file long after the contract ends; missing records can make expenditure ineligible.", ref: "4.11" },
        "1–10": { what: "Supplier performance is typically assessed by questionnaire with questions scored, for example, from 1 (very poor) to 10 (very good).", why: "Documented performance supports penalties and improves future tender documents, though poor past performance alone does not bar a supplier.", ref: "5.8" },
        "3 years": { what: "An optional exclusion criterion allows excluding suppliers who, in the previous three years, failed contractual obligations leading to refused payment or termination.", why: "Blocklists are prohibited, so this documented criterion is the only lawful way to exclude past poor performers.", ref: "4.3.3" }
      }
    },
    grants: {
      "Foundations": {
        "2": { what: "A grant must both assist the grantee in attaining its own objectives and advance the Organisation's values or policies; the two purposes are cumulative.", why: "If either purpose is missing the arrangement is not a grant and may need to be a procurement contract instead.", ref: "1" },
        "Art. 43 bis": { what: "Grants are foreseen by Article 43 bis of the Financial Regulations, implemented by Rule 1374, which applies whatever the source of funding.", why: "Ordinary Budget, voluntary contributions and external funds all follow the same Rule 1374 procedures.", ref: "1" },
        "12 months": { what: "Operational grants should not normally give rise to grant agreements lasting more than twelve consecutive months.", why: "Longer operational grants need justification and risk being seen as structural funding rather than support.", ref: "1" }
      },
      "Principles": {
        "€15,000": { what: "The €15,000 threshold refers to the total estimated budget of the grant award procedure; at €15,000 or more a call for proposals is in principle required.", why: "Using the per-grant amount instead of the total budget leads to unlawful direct awards.", ref: "2.1" },
        "5 × €10,000": { what: "Awarding five grants of €10,000 gives a reference figure of €50,000, so the €15,000 threshold is exceeded and a call is required.", why: "Splitting a budget into small grants does not avoid publication; the total procedure budget counts.", ref: "2.1" },
        "3": { what: "Above €15,000, non-publication is only justified by an unforeseeable emergency, the grantee's unique characteristics, or a project predetermining the grantees, e.g. by a donor.", why: "Exceptions are strictly interpreted; an unjustified direct award breaches transparency and can make funds ineligible.", ref: "2.1" }
      },
      "Procedure": {
        "< €15,000": { what: "Below €15,000 a grant may be directly awarded using decision Template G9.2A (Rule 1374, Art. 2.1.2), which also appoints the Co-ordinator.", why: "Even a direct award needs a documented decision and a written grant agreement.", ref: "9" },
        "≥ €15,000": { what: "Procedures of €15,000 or more require a competitive call for proposals, with Co-ordinator, Evaluation Committee, opening, evaluation and award decision.", why: "Skipping the call without a valid exception breaches the principle of transparency.", ref: "2.1" },
        "G9.2B": { what: "A direct award of €15,000 or more is exceptional and uses Template G9.2B, with the CCM's decision duly motivated (Art. 2.1.3).", why: "Without a solid justification under one of the strict exceptions, the award can be challenged by auditors or donors.", ref: "9" }
      },
      "Roles": {
        "a–k": { what: "Article 3.1 lists the Commitments Officer's responsibilities a to k, from deciding on direct award and approving the call to signing, suspending, terminating or recovering grants.", why: "Knowing who decides each step avoids decisions taken by unauthorised staff.", ref: "3.1" },
        "G3.1": { what: "Template G3.1 is the Commitments Officer's decision appointing the Co-ordinator responsible for the smooth running of the grant procedure.", why: "The Co-ordinator must be formally appointed before the call is run.", ref: "3.1" },
        "G13.1": { what: "Template G13.1 is the decision appointing the Evaluation Committee, accompanied by members' declarations.", why: "An evaluation by a committee not formally appointed is procedurally flawed.", ref: "13.1" },
        "Art. 31 FR": { what: "The Commitments Officer's responsibilities may be delegated in writing to a cost centre manager under the conditions of Article 31 of the Financial Regulations.", why: "Oral or informal delegation is invalid, so decisions taken under it may be challenged.", ref: "3.2" }
      },
      "Criteria": {
        "3": { what: "Three categories of criteria apply in sequence: exclusion grounds, eligibility criteria, then award criteria for proposals that pass the first two.", why: "Each category has a specific purpose; mixing them, e.g. scoring eligibility, distorts the evaluation.", ref: "5" },
        "Weighted": { what: "Each award criterion must be weighted, and the weighting must be clearly indicated in the call for proposals.", why: "Weighting gives applicants a transparent indication of each criterion's importance and must stay unchanged to the end.", ref: "5.2" },
        "Art. 5.4": { what: "Under Article 5.4, criteria and their weighting published in the call cannot be altered under any circumstances during the procedure.", why: "Changing criteria after publication breaches equal treatment and invalidates the evaluation.", ref: "5.4" }
      },
      "Costs": {
        "7%": { what: "Indirect eligible costs, if foreseen, must be stated in the call and the agreement and may never exceed 7% of the total (Article 6.3).", why: "Amounts above the ceiling are ineligible and must be recovered.", ref: "6.3" },
        "a–g": { what: "Direct eligible costs must meet conditions a to g, including being necessary, actually incurred in the period, verifiable, substantiated and in the estimated budget.", why: "Costs failing any condition are ineligible and may have to be recovered from the grantee.", ref: "6.2" },
        "a–h": { what: "Costs a to h are always ineligible, such as expenditure financed by other sources, debts, interest, land and buildings, exchange losses and loans to third parties.", why: "Accepting them breaks Rule 1374 and leads to recovery procedures or donor refusals.", ref: "7.1" }
      },
      "Call": {
        "a–j": { what: "Article 8.3 requires every call for proposals to contain elements a to j, from objectives and co-financing to criteria, number of grantees and agreement terms.", why: "A call missing a mandatory element breaches transparency and can compromise the whole procedure.", ref: "8.3" },
        "G8.1A / G8.1B": { what: "Template G8.1A is the call for proposals for Ordinary Budget or voluntary contribution funds; G8.1B is for EU funds.", why: "Using the wrong template can omit donor-specific requirements.", ref: "8.1" },
        "G8.3": { what: "Template G8.3 is the quality control checklist used to verify that a call contains all required elements.", why: "Running the checklist before publication catches omissions that cannot be fixed once the call is out.", ref: "8.3" }
      },
      "Submission": {
        "2 people": { what: "The Co-ordinator opens proposals but never alone: a member of the Evaluation Committee must be present.", why: "Opening alone or before the deadline breaches transparency and should lead to cancellation of the procedure.", ref: "11.2" },
        "G11.1": { what: "Template G11.1 is the report on the opening of proposals, recording information and the identification number of each proposal.", why: "The report is the evidence of a regular opening if the procedure is later questioned.", ref: "11.2" },
        "Force majeure": { what: "A proposal received late may only be considered if the applicant proves force majeure; the Committee advises the Commitments Officer on it.", why: "Accepting unjustified late proposals breaches equal treatment between applicants.", ref: "10.5" }
      },
      "Eligibility Check": {
        "≥ 1": { what: "The Rule requires at least one staff member on every Evaluation Committee, and a majority of staff members is recommended.", why: "Staff members guard against conflicts of interest and ensure knowledge of the rules.", ref: "13.1" },
        "G13.4": { what: "Template G13.4 is the declaration of absence of conflicts of interests, signed by all Evaluation Committee members.", why: "An undeclared conflict can invalidate the evaluation and the award.", ref: "13.4" },
        "G13.5": { what: "Template G13.5 is the declaration of confidentiality, required only for Evaluation Committee members who are not Secretariat staff.", why: "External members are not bound by staff rules, so their written undertaking protects applicants' data.", ref: "13.5" }
      },
      "Evaluation": {
        "0–5": { what: "Each Committee member individually scores every award criterion or sub-criterion out of 5, from 0 (fails or cannot be assessed) to 5 (excellent), with explanatory comments.", why: "Consistent use of the scale and comments underpins the consensus report and defends against complaints.", ref: "14.3" },
        "15 days": { what: "The Commitments Officer must inform unsuccessful applicants in writing no later than 15 calendar days after the successful ones; this deadline is imperative.", why: "Late notification breaches the Rule; best practice is to inform all applicants at the same time.", ref: "14.9" },
        "7 days": { what: "The letter to unsuccessful applicants must explain how to request information and give a cut-off date of at least 7 calendar days (Article 14.9).", why: "Without this information, the enquiry and complaint deadlines cannot run properly.", ref: "14.9" },
        "G14.6": { what: "Template G14.6 is the Commitments Officer's decision on the award in a competitive procedure, based on the Committee's consensus report.", why: "The award must be a formal, documented decision by the competent officer before agreements are signed.", ref: "14.6" }
      },
      "Complaints": {
        "30 days": { what: "Applicants may lodge a complaint within 30 calendar days of notification of the reply to their enquiry, and the Review Board meets within 30 calendar days of receiving it.", why: "An enquiry must precede a complaint; missing either deadline affects admissibility or breaches the Rule.", ref: "15.3 / 15.5" },
        "3": { what: "The Review Board comprises representatives of the internal Auditor, the Director of Legal Advice and Public International Law, and the Treasurer.", why: "Members must not have been involved, even indirectly, in the evaluation challenged, to avoid bias.", ref: "15.6" }
      },
      "Agreement": {
        "Written": { what: "Signing a written grant agreement between the parties is imperative; any verbal agreement is contrary to the Rule.", why: "Without a written agreement there is no enforceable basis for payment, reporting or recovery.", ref: "17.1" },
        "G17.2A / G17.2B": { what: "Template G17.2A is the model grant agreement for Ordinary Budget or voluntary contribution funds; G17.2B is for EU funds.", why: "The models contain mandatory clauses, such as data publication, that ad hoc drafts may omit.", ref: "17.2" },
        "G17.3": { what: "Template G17.3 is used to amend a grant agreement, which must always include a description of the action and an estimated budget.", why: "Changes not formalised by amendment are not binding and can make expenditure ineligible.", ref: "17.3" }
      },
      "Filing": {
        "Initiating department": { what: "All documents from the Co-ordinator's appointment to validation of supporting documents must be kept by the department that initiated the grant procedure.", why: "Auditors and donors expect one complete file; scattered records make it hard to justify the award.", ref: "18" },
        "Art. 19": { what: "Under Article 19, the Rule must be interpreted in good faith, in keeping with its spirit and the general principles in its Preamble.", why: "Where the text is silent, choose the reading that best respects transparency and equal treatment.", ref: "19" },
        "[XX]": { what: "Templates contain comments, blue highlighted parts and bracketed [XX] options that must all be completed or deleted before sending documents to third parties.", why: "Sending templates with leftover options or comments looks unprofessional and can create contractual ambiguity.", ref: "20" }
      }
    }
  };
})();

/* Separate notes where one stage shows the same value for two different rules. */
(function () {
  "use strict";
  const N = window.FG_CONTENT.factNotes;
  Object.assign(N.procurement["Authorise & Launch"], {
    "48 h|Tenders Board consultation period": { what: "Tenders Board electronic consultations give members at least 48 hours (two working days) to approve a request.", why: "Board approval cannot be rushed: build these two working days into your launch schedule.", ref: "4.9.1" },
    "48 h|before deadline: last Q&A answer": { what: "No answers to bidders' questions are given later than 48 hours before the submission deadline.", why: "Late questions stay unanswered, so publish early and answer promptly to keep all bidders equally informed.", ref: "4.9.3" },
  });
  Object.assign(N.grants["Complaints"], {
    "30 days|calendar days to lodge a complaint after the enquiry reply": { what: "Applicants may lodge a complaint within 30 calendar days of notification of the reply to their enquiry.", why: "An enquiry must come first; a complaint lodged after 30 days is not admissible.", ref: "15.3" },
    "30 days|for the Review Board to meet after receipt": { what: "The Review Board meets within 30 calendar days of receiving a complaint.", why: "Missing this deadline breaches the Rule, so convene the Board as soon as a complaint arrives.", ref: "15.5" },
  });
})();
