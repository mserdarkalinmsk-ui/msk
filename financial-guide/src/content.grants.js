/* Grants lifecycle content, rewritten from the Council of Europe grants guide (Rule 1374). */
(function () {
  "use strict";
  const C = window.FG_CONTENT;

  C.grantPhases = [
    ["Frame the grant", ["Foundations", "Principles", "Procedure", "Roles"]],
    ["Design the call", ["Criteria", "Costs", "Call"]],
    ["Select", ["Submission", "Eligibility Check", "Evaluation", "Complaints"]],
    ["Agree & close", ["Agreement", "Filing"]]
  ];

  C.grantStages = [
    {
      name: "Foundations",
      title: "What a grant is and when Rule 1374 applies",
      lead: "A grant finances a project, a specified action or a grantee's operations to advance the Organisation's values. Rule 1374 implements Article 43 bis of the Financial Regulations for every grant procedure.",
      source: "Financial Regulations Art. 43 bis · Rule 1374",
      remember: "Two purposes, both required: help the grantee, advance the Organisation.",
      keyFacts: [["2","cumulative purposes of every grant"],["Art. 43 bis","Financial Regulations basis, implemented by Rule 1374"],["12 months","normal maximum for an operational grant agreement"]],
      example: "A programme wants to fund a human rights NGO's annual running costs. The NGO's goals and the Council's values are both served, so a grant fits, but as an operational grant. Correct action: plan an operational grant agreement of no more than twelve consecutive months.",
      understand: "A grant must both help the grantee attain its own objectives and advance the Organisation's values or policies; the two conditions are cumulative.",
      do: "Confirm that both purposes are met and decide whether you are financing a project-related grant or an operational grant.",
      check: "Every staff member involved in the award process has completed the staff member declaration of interest.",
      sections: [
        ["Purpose of a grant", "A grant must assist the grantee in attaining its goals or objectives and also fulfil a more general objective of advancing the Organisation's values or policies. Both conditions are cumulative; if either is missing, a grant is not the right instrument."],
        ["Legal basis and scope", "Grants are foreseen by Article 43 bis of the Financial Regulations and implemented by Rule 1374. The Rule applies to all grant procedures irrespective of the source of funding, including the Ordinary Budget, Voluntary Contributions and Grant Agreements with external donors."],
        ["Project-related and operational grants", "A project-related grant finances a project or a specified action; an operational grant finances a given grantee's operational expenditure. The definition applies whatever the grantee's status, public or private, legal or natural person. Operational grants should not normally give rise to grant agreements of more than twelve consecutive months."],
        ["Grant or procurement", "Co-financing is a characteristic feature distinguishing a grant from a service contract: no service contract may give rise to co-financing by the service supplier. If the Council would pay the full cost of a service it needs, the procurement rules are the relevant route instead."],
        ["Declaration of interest", "All staff members involved in a procurement or grant award process must complete the staff member declaration of interest in the context of procurement. Do this before taking part in any step of the procedure."],
        ["How the guide is organised", "The guide follows the numbering of Rule 1374, and the templates carry the same numbers. Template G14.1, for example, implements Article 14.1."]
      ],
      warning: "Both purposes of a grant are mandatory and cumulative; a financing that only serves the grantee, or only the Organisation, is not a grant.",
      best: "Record at the outset why the action meets both purposes; this justification will also anchor the objectives of the call.",
      checklist: [
        "Confirm the grantee's goals and the Organisation's objective are both served",
        "Identify the funding source (Ordinary Budget, VC or donor agreement)",
        "Classify the grant as project-related or operational",
        "Keep operational grants to twelve consecutive months or less",
        "Check that co-financing makes this a grant, not a service contract",
        "Complete the staff member declaration of interest"
      ],
      links: ["Principles", "Procedure"],
      templates: []
    },
    {
      name: "Principles",
      title: "The six general principles of Rule 1374",
      lead: "Article 2 sets six principles that apply to every grant: transparency, non-retroactivity, co-financing, non-cumulative awards, no profit and non-discrimination.",
      source: "Rule 1374 · Art. 2",
      remember: "Count the whole procedure budget; never let the Council pay everything.",
      keyFacts: [["€15,000","total procedure budget triggering a call"],["5 × €10,000","= €50,000, so a call is required"],["3","strict exceptions to publication"]],
      example: "A department plans five grants of €10,000 to local youth NGOs and suggests five direct awards. The reference figure is the €50,000 total, which passes the threshold. Correct action: launch a call for proposals and require each grantee to co-finance.",
      understand: "The principles govern every decision in the procedure, and breaching one can invalidate an award or make costs ineligible.",
      do: "Test the planned grant against each of the six principles before designing the call.",
      check: "The €15,000 threshold has been measured against the total estimated budget of the procedure, not the amount per grantee.",
      sections: [
        ["Transparency and the €15,000 threshold", "All grant award procedures of €15,000 or more require, in principle, a published call for proposals. The threshold refers to the total estimated budget of the procedure: five grants of €10,000 make €50,000, so a call is required. Above the threshold, exceptions to publication are interpreted strictly."],
        ["Exceptions to publication", "Only three situations may justify non-publication: an unforeseeable emergency beyond the awarding entity's control that makes a call impossible; grantee characteristics that make a call impossible, such as an international organisation acting alone in a field; or an action described in terms leaving no scope for a call, for instance partners approved by a donor and contractually predetermined."],
        ["Non-retroactivity", "The action financed must not already be completed when the agreement is signed. Implementation may exceptionally have begun, but eligible costs cannot be incurred before the closing date for submission of proposals, and the agreement must state the implementation period precisely. Implementation starting after signature is the best practice."],
        ["Co-financing", "The Council must not finance the entire cost of the action, the project or the grantee's operations. The grantee contributes from its own or third-party resources, which may take the form of human resources, contributions in kind (moveable or immoveable, tangible or intangible assets) or income generated by the action."],
        ["Non-cumulative awards and no profit", "The Council awards only one grant to a given project, action or operational grantee, and a grant may not finance part of an action already financed by other means. Several complementary funding sources are allowed, but total funding cannot exceed the agreed budgeted expenses, as overfunding would breach the linked principle of no profit."],
        ["Non-discrimination", "Applicants must not be discriminated against on grounds such as gender, disability, age, language, religion, opinions, national or ethnic origin, citizenship or sexual orientation. A difference in treatment is discriminatory unless it has an objective and reasonable justification. Restricting a call to applicants in one town can be justified when the call aims to build civil society capacity in that town."]
      ],
      warning: "The €15,000 threshold applies to the total estimated budget of the procedure; splitting it into smaller grants does not avoid a call for proposals.",
      best: "Plan the agreement so that implementation begins after signature; it is the cleanest way to respect non-retroactivity.",
      checklist: [
        "Calculate the total estimated budget of the whole procedure",
        "Publish a call if the total is €15,000 or more",
        "Document any strict exception to publication",
        "Ensure no eligible costs precede the submission deadline",
        "Require the grantee to co-finance the action",
        "Check the action receives no other Council grant",
        "Justify objectively any restriction on who may apply"
      ],
      links: ["Procedure", "Costs", "Call"],
      templates: []
    },
    {
      name: "Procedure",
      title: "Choosing the route: direct award or call for proposals",
      lead: "The total estimated budget decides the route: below €15,000 a grant may be awarded directly; from €15,000 a competitive call for proposals is the rule.",
      source: "Rule 1374 · Art. 2.1.2, 2.1.3, 9",
      remember: "Below €15,000 you may award directly; from €15,000, call.",
      keyFacts: [["< €15,000","direct award, Template G9.2A (Art. 2.1.2)"],["≥ €15,000","competitive call for proposals"],["G9.2B","exceptional direct award, duly justified (Art. 2.1.3)"]],
      example: "A project needs a single €12,000 grant to a regional ombudsman network. The total procedure budget is below €15,000. Correct action: the Commitments Officer adopts a G9.2A decision, which also appoints the Co-ordinator, and signs the agreement.",
      understand: "Direct award below €15,000 (Art. 2.1.2) needs only Template G9.2A; €15,000 or more requires a competitive call unless exceptional circumstances apply (Art. 2.1.3).",
      do: "Calculate the total procedure budget, select the route and open the matching decision template.",
      check: "Any direct award of €15,000 or more carries a duly justified Commitments Officer decision attached to the commitment request.",
      sections: [
        ["Direct award below €15,000", "Under Article 2.1.2, when the budget of a grant award procedure is less than €15,000, the grant may be awarded without a call for proposals. The Commitments Officer adopts the direct award decision using Template G9.2A, which also integrates the appointment of the Co-ordinator. The grant agreement is then signed."],
        ["Competitive procedure from €15,000", "From €15,000 the principle is a competitive procedure. The steps are: appoint the Co-ordinator (G3.1); draft, approve and publish the call (G8.1A, G8.1B, G8.2); answer questions; appoint the Evaluation Committee (G13.1) with declarations of absence of conflicts of interest (G13.4); open proposals (G11.1); assess (G14.1, G14.3, G14.4); take the Commitments Officer's decision (G14.6); send notification letters (G14.8, G14.9A, G14.9B)."],
        ["Exceptional direct award from €15,000", "Under Article 2.1.3 a grant of €15,000 or more cannot be awarded without a call unless exceptional circumstances occur. The Commitments Officer must justify the decision with reference to Article 2.1.3 using Template G9.2B, which integrates the Co-ordinator's appointment. The duly justified decision is attached to the request for commitment of funds (engagement de dépenses)."],
        ["Who decides", "Only the competent Commitments Officer, or a representative by written delegation, can decide on a direct award. The procedural guarantees for direct award are set out in Article 9 of the Rule."]
      ],
      warning: "A direct award of €15,000 or more is an exception that must be strictly justified under Article 2.1.3; an unreasoned G9.2B decision does not meet the Rule.",
      best: "Use the G3.1TAB follow-up table from the start of a competitive procedure to track each step and template.",
      checklist: [
        "Establish the total estimated budget of the procedure",
        "Below €15,000: complete Template G9.2A and sign the agreement",
        "From €15,000: launch the competitive procedure",
        "For exceptional direct award, justify under Article 2.1.3 with G9.2B",
        "Attach the justified decision to the commitment request",
        "Track the steps in the Co-ordinator's follow-up table"
      ],
      links: ["Principles", "Roles", "Call"],
      templates: [
        ["G9.2A", "Decision on direct award below €15,000"],
        ["G9.2B", "Decision on direct award equal to or exceeding €15,000"],
        ["G3.1", "Decision appointing the Co-ordinator"],
        ["G3.1TAB", "Follow-up table of the Co-ordinator"]
      ]
    },
    {
      name: "Roles",
      title: "Who is responsible: Commitments Officer, Co-ordinator, Evaluation Committee",
      lead: "The Commitments Officer is responsible for the whole grant award procedure, appoints a Co-ordinator and an Evaluation Committee, and may delegate in writing.",
      source: "Rule 1374 · Art. 3",
      remember: "The Commitments Officer decides; the Co-ordinator runs; the Committee evaluates.",
      keyFacts: [["a–k","Commitments Officer responsibilities in Art. 3.1"],["G3.1","appoints the Co-ordinator"],["G13.1","appoints the Evaluation Committee"],["Art. 31 FR","conditions for written delegation"]],
      example: "A Head of Department wants a cost centre manager to run a grant procedure on his behalf. Delegation is possible within his administrative entity. Correct action: delegate in writing under Article 31 of the Financial Regulations, then appoint the Co-ordinator with G3.1.",
      understand: "Article 3.1 assigns eleven responsibilities (a to k) to the Commitments Officer, from deciding on direct award to recovering funds.",
      do: "Have the Commitments Officer formally appoint the Co-ordinator with Template G3.1 and the Evaluation Committee with Template G13.1.",
      check: "Any delegation is in writing, to a cost centre manager in the same administrative entity, under Article 31 of the Financial Regulations.",
      sections: [
        ["Deciding and approving", "The Commitments Officer decides whether direct award conditions under Article 2.1 are met (a) and approves the call for proposals, its publication means and submission arrangements (b). The call is prepared by the department concerned; the Commitments Officer is recommended to check it against the quality control checklist, Template G8.3."],
        ["Appointing the actors", "The Commitments Officer formally appoints a Co-ordinator responsible for the smooth running of the procedure, including planning the receipt and evaluation of applications (c, Template G3.1). He or she also appoints the Evaluation Committee whose membership and prerogatives are set out in Article 13 (d, Template G13.1)."],
        ["Awarding and informing", "The Commitments Officer decides on the award under Articles 9.2, 14.5 and 14.7 (e), informs applicants of the decision under Articles 14.8 and 14.9 (f) and signs the grant agreement (g). The model agreement prepared by DLAPIL may need adapting to donor conditions or national law, so DLAPIL should be consulted."],
        ["Confidentiality and implementation", "Where a grantee's vital interests are potentially threatened, the Commitments Officer may decide not to publish certain results (h, Art. 2.1.4). He or she may suspend the agreement for unavoidable circumstances, political context or management reasons (i), terminate it after consulting DLAPIL (j), and reduce or recover grant amounts, for instance where expenses are ineligible (k)."],
        ["Delegation", "The responsibilities in Article 3.1 may be delegated in writing to a cost centre manager in the Commitments Officer's administrative entity. Delegation follows the conditions of Article 31 of the Financial Regulations."]
      ],
      warning: "Only the competent Commitments Officer, or a written delegate, may decide on direct award, the award decision, suspension, termination or recovery.",
      best: "Use the G8.3 checklist as a communication tool between the Commitments Officer and the drafters of the call.",
      checklist: [
        "Identify the competent Commitments Officer",
        "Put any delegation in writing under Article 31",
        "Appoint the Co-ordinator with Template G3.1",
        "Appoint the Evaluation Committee with Template G13.1",
        "Check the call against the G8.3 checklist before approval",
        "Consult DLAPIL before terminating an agreement"
      ],
      links: ["Procedure", "Eligibility Check", "Evaluation"],
      templates: [
        ["G3.1", "Decision appointing the Co-ordinator"],
        ["G3.1TAB", "Follow-up table of the Co-ordinator"],
        ["G13.1", "Decision appointing the Evaluation Committee"],
        ["G8.3", "Call for proposals quality control checklist"]
      ]
    },
    {
      name: "Criteria",
      title: "Exclusion, eligibility and award criteria",
      lead: "Each category of criteria has its own purpose: exclusion checks legal prerequisites, eligibility checks the applicant's capacity, award criteria evaluate the proposal itself.",
      source: "Rule 1374 · Art. 4–5",
      remember: "Exclude, then check capacity, then score the proposal; never change criteria.",
      keyFacts: [["3","criteria categories applied in sequence"],["Weighted","every award criterion, shown in the call"],["Art. 5.4","published criteria and weights are unalterable"]],
      example: "After publishing a call, the team realises one award criterion is weighted too heavily. Changing it would breach the unalterable character of criteria. Correct action: evaluate with the published weighting, or let the procedure end and launch a new call.",
      understand: "Criteria are applied in sequence: excluded applicants are not assessed further, and only eligible applicants are scored against weighted award criteria.",
      do: "Define clear exclusion grounds, threshold-based eligibility criteria and weighted award criteria, each with its supporting documents, in the call.",
      check: "Every criterion is reasonable, proportionate, relevant and verifiable, and every award criterion carries a published weighting.",
      sections: [
        ["Exclusion grounds", "Exclusion criteria ensure legal prerequisites, notably that applicants have never been criminally sentenced for reasons linked with their activity. They must be defined in the call and covered by a clause in the agreement obliging grantees to report any change of situation. Compliance is established by a declaration signed by each applicant at submission (Templates G4.1.2A to G4.1.2E)."],
        ["Eligibility criteria", "Eligibility criteria examine the applicant's capacity to implement the project in financial and human terms or in terms of experience, not the proposal itself. They must set a precise threshold; applicants who do not reach it are not examined against the award criteria."],
        ["Award criteria", "Award criteria evaluate the proposal as such and apply only to applicants that passed exclusion and eligibility. Each criterion must be relevant, verifiable and weighted, with the weighting clearly shown in the call. Ideally each criterion has sub-criteria, each with its own weighting."],
        ["Objectivity", "Criteria must be reasonable and proportionate, must not unduly restrict access, and must be neither too specific nor too vague. They must be relevant, with a cause and effect link to the project's goals, and verifiable, with the call listing the documents used to check each one, such as certified financial reports."],
        ["Unalterable criteria", "Published criteria and their weighting cannot be altered under any circumstances for the entire duration of the procedure. This is a fundamental principle of Article 5.4."]
      ],
      warning: "Once the call is published, no criterion or weighting may be changed for any reason; draft them carefully before approval.",
      best: "Define the project's goals first, then derive each eligibility criterion from them so the link is explicit.",
      checklist: [
        "Include the exclusion grounds and declaration template in the call",
        "Set a measurable threshold for each eligibility criterion",
        "Weight every award criterion and sub-criterion",
        "List the supporting documents for every criterion",
        "Test each criterion for relevance and proportionality",
        "Add the change-of-situation clause to the agreement"
      ],
      links: ["Call", "Eligibility Check", "Evaluation"],
      templates: [
        ["G4.1.2A", "Declaration on exclusion criteria, BO or VC, natural person"],
        ["G4.1.2B", "Declaration on exclusion criteria, EU funds, natural person"],
        ["G4.1.2C", "Declaration on exclusion criteria, BO or VC, legal person"],
        ["G4.1.2D", "Declaration on exclusion criteria, EU funds, legal person"],
        ["G4.1.2E", "Declaration on exclusion criteria, EU funds, legal person, owners and executive officers"]
      ]
    },
    {
      name: "Costs",
      title: "Eligible and ineligible costs",
      lead: "The grant ceiling is set on the basis of estimated eligible costs, which must meet seven conditions; certain costs are always ineligible.",
      source: "Rule 1374 · Art. 6–7",
      remember: "Necessary, in budget, in period, on record; indirect costs max 7%.",
      keyFacts: [["7%","maximum indirect eligible costs"],["a–g","conditions for direct eligible costs"],["a–h","costs that are always ineligible"]],
      example: "An applicant's budget includes buying an office building, interest on a loan and 10% overheads. Land and buildings and interest are ineligible, and indirect costs cannot exceed 7%. Correct action: remove both items and cap indirect costs at no more than 7%.",
      understand: "Only costs meeting all Article 6.2 conditions are eligible; indirect costs are capped at 7% and Article 7.1 lists costs that are never eligible.",
      do: "Build the estimated budget from eligible costs only and state the grant ceiling and any indirect cost rate in the agreement.",
      check: "Every budgeted cost appears in the estimated overall budget and falls within the implementation period defined to the day.",
      sections: [
        ["Grant ceiling", "The maximum amount of the grant must be stated in the grant agreement. It is established on the basis of the estimated eligible costs, which must meet the requirements of Article 6.2."],
        ["Direct eligible costs", "Direct costs must be: (a) necessary for implementing the action, or for the grantee's operations in an operational grant; (b) consistent with sound financial management, best value for money and cost-effectiveness; (c) actually incurred during the implementation period defined in the agreement; (d) identifiable, verifiable and recorded in the grantee's accounts; (e) compliant with tax and social security law; (f) backed by originals or certified copies, certified generally by the grantee's treasurer; and (g) indicated in the estimated overall budget."],
        ["Indirect eligible costs", "If indirect costs are foreseen, their percentage must be stated precisely in the call and made contractual in the agreement. In no circumstances may it exceed 7% of the total, the ceiling set by Article 6.3."],
        ["Ineligible costs", "The following are never eligible: (a) expenditure financed by other sources; (b) debts and provisions for losses or debts incurred before the award; (c) costs outside the implementation period; (d) expenditure unrelated to the project; (e) interest owed; (f) purchase of land and buildings; (g) currency exchange losses, which the grantee must guard against; and (h) loans to third parties."],
        ["Renovation work", "Renovation costs are excluded unless directly related to the project or action. If so, the extent of the work must be precisely specified in the description of the action."],
        ["Other ineligible costs", "The Article 7.1 list is not exhaustive. It may be supplemented to meet a donor's needs for extra-budgetary resources or other requirements specific to the procedure."]
      ],
      warning: "Indirect costs may never exceed 7% of the total, and a cost not shown in the estimated budget cannot be eligible.",
      best: "Define the implementation period to the exact day in the agreement, since cost eligibility depends on it.",
      checklist: [
        "State the maximum grant amount in the agreement",
        "Test each cost against conditions (a) to (g)",
        "Cap indirect costs at 7% and publish the rate",
        "Remove land purchases, interest, loans and exchange losses",
        "Specify any project-related renovation in the action description",
        "Add donor-specific ineligible costs where needed"
      ],
      links: ["Principles", "Agreement", "Submission"],
      templates: [
        ["G17.2D", "Annex II, estimated budget"],
        ["G17.2G", "Guidelines for using grant agreement budget templates"]
      ]
    },
    {
      name: "Call",
      title: "Drafting and publishing the call for proposals",
      lead: "A public call for proposals must reach the target public and contain everything applicants need to submit a complete application.",
      source: "Rule 1374 · Art. 8",
      remember: "Objectives first; website always; answers for everyone.",
      keyFacts: [["a–j","mandatory elements of a call (Art. 8.3)"],["G8.1A / G8.1B","call template for BO-VC / EU funds"],["G8.3","quality control checklist"]],
      example: "A call targets NGOs in one member state and is only on the Council website. The website is mandatory but not enough to reach that public. Correct action: add a local newspaper notice referring to the full call online and inform the Permanent Delegation.",
      understand: "Article 8.3 lists ten mandatory elements (a to j) of a call, and publication on the Organisation's website is an absolute prerequisite.",
      do: "Draft the call with G8.1A or G8.1B and the G8.2 application form, check it with G8.3, then publish it widely.",
      check: "All replies to questions are published to all potential applicants by the same means as the call.",
      sections: [
        ["Templates", "Use Template G8.1A for calls financed by the Ordinary Budget or Voluntary Contributions and G8.1B for EU funds. The application form (G8.2A or G8.2B) should be used for all competitive procedures; it may be adapted, but the substance of Sections 1 to 3 and the declaration and signature in Sections 12 and 13 must remain unchanged."],
        ["Mandatory content (a to f)", "The call must state: (a) the objectives of the action, which is the first stage of any procedure; (b) the required level of co-financing, preferably as a percentage of the budget; (c) the submission arrangements, supporting documents, deadline and consequences of non-compliance; (d) a departmental e-mail address and the conditions for asking questions; (e) indicative dates for informing applicants and signing agreements; and (f) the indicative implementation timetable."],
        ["Mandatory content (g to j)", "The call must also include: (g) exclusion and eligibility criteria with their supporting documents; (h) award criteria with their weighting and supporting documents; (i) the number of potential grantees and the total value of the grants; and (j) the terms of the grant agreement based on the model, including payment arrangements, any financial guarantees and any specific clauses agreed beforehand with DLAPIL."],
        ["Legal opinion", "DLAPIL systematically verifies the submission arrangements when a legal opinion on the draft call is requested. A legal opinion before publication is highly recommended, and strongly recommended where financial guarantees are stipulated."],
        ["Means of publication", "Publication on the Organisation's website is mandatory but not sufficient on its own. Choose additional means that reach the target public, such as a notice in a local newspaper, social networks in suitable wording, or informing Permanent Delegations for calls limited to certain member states. Published documents must comply with data protection rules."],
        ["Questions and answers", "In line with non-discrimination, replies must reach all potential applicants, including those who did not ask. Best practice is a single document of all questions and answers, merging identical questions and omitting irrelevant ones or those answered in the call, published by the same means as the call."]
      ],
      warning: "Any specific clause to be added to the model agreement must be agreed with DLAPIL and published in the draft agreement with the call.",
      best: "Create a dedicated e-mail address for the procedure rather than using a staff member's personal address.",
      checklist: [
        "Formulate the objectives of the action first",
        "Use G8.1A or G8.1B and the G8.2 application form",
        "Cover all elements (a) to (j) of Article 8.3",
        "Run the G8.3 quality control checklist",
        "Request a DLAPIL legal opinion before publication",
        "Publish on the website and through targeted channels",
        "Publish one consolidated questions and answers document"
      ],
      links: ["Criteria", "Costs", "Submission"],
      templates: [
        ["G8.1A", "Call for proposals for BO or VC"],
        ["G8.1B", "Call for proposals for EU funds"],
        ["G8.2A", "Application form for BO or VC"],
        ["G8.2B", "Application form for EU funds"],
        ["G8.3", "Call for proposals quality control checklist"]
      ]
    },
    {
      name: "Submission",
      title: "Submission, receipt and opening of proposals",
      lead: "Submission conditions are strict and applied uniformly; proposals are opened only after the deadline, by the Co-ordinator with an Evaluation Committee member.",
      source: "Rule 1374 · Art. 10–11",
      remember: "Never open early, never open alone, never alter a proposal.",
      keyFacts: [["2 people","Co-ordinator plus an Evaluation Committee member at opening"],["G11.1","report on opening of proposals"],["Force majeure","must be proved by the late applicant"]],
      example: "Ten proposals arrive and the Co-ordinator is keen to start before the deadline. Opening early would require cancelling the whole procedure. Correct action: wait for the deadline, open with a Committee member, number each proposal and record it in G11.1.",
      understand: "Opening proposals before the deadline, or altering their content after receipt, breaches transparency and non-discrimination.",
      do: "Open proposals after the deadline with an Evaluation Committee member present, number each one and record it in Template G11.1.",
      check: "Each proposal includes an estimated budget and information on other sources of financing.",
      sections: [
        ["Conditions and late proposals", "Dispatch arrangements, closing date and supporting documents are strict requirements applied uniformly, and the consequences of non-fulfilment stated in the call are applied stringently. For late proposals, the decision depends on how the dispatch date or time is certified; an applicant claiming force majeure must prove it. The Co-ordinator gives reasons in the draft report and the Evaluation Committee states its view in the consensus report."],
        ["Estimated budget and other financing", "Each proposal must include an estimated budget, used to assess feasibility, calculate co-financing and determine eligible expenditure. Information on other sources of financing is crucial for applying the co-financing and non-cumulative award principles."],
        ["Two-stage evaluation", "For highly technical files, a first stage based on a concept note can test the fundamentals before shortlisted applicants submit a detailed proposal. It is not recommended for files with little technical content, as it is more time-consuming, and is decided case by case. Unsuccessful applicants at either stage are informed only after the final award decision."],
        ["Personal data", "Data protection rules apply throughout the procedure, including implementation of the agreement. The model grant agreement contains a clause on the conditions of publication of data concerning the agreement."],
        ["Opening and numbering", "Proposals must not be opened before the deadline expires; disregarding this should lead to cancellation of the whole procedure. The Co-ordinator opens the proposals, never alone but always with a member of the Evaluation Committee. Each proposal receives an identification number recorded in the report on opening of proposals (Template G11.1)."]
      ],
      warning: "Never open proposals before the deadline or alone; either breach can require cancellation of the procedure.",
      best: "State in the call how the dispatch date and time are established, so late proposals can be decided objectively.",
      checklist: [
        "Apply submission conditions identically to every applicant",
        "Keep proposals unopened until the deadline expires",
        "Open proposals with an Evaluation Committee member present",
        "Number each proposal and record it in G11.1",
        "Check each proposal has a budget and funding information",
        "Note late proposals and reasons for the draft report"
      ],
      links: ["Call", "Eligibility Check"],
      templates: [
        ["G11.1", "Report on opening of proposals"]
      ]
    },
    {
      name: "Eligibility Check",
      title: "Checking exclusion and eligibility; the Evaluation Committee",
      lead: "The Co-ordinator prepares a draft report on exclusion and eligibility for an Evaluation Committee whose members must be free of conflicts of interest.",
      source: "Rule 1374 · Art. 12–13",
      remember: "Clarify, never improve: requests must not change a proposal's substance.",
      keyFacts: [["≥ 1","staff member on every Evaluation Committee"],["G13.4","conflict of interest declaration, all members"],["G13.5","confidentiality declaration, external members only"]],
      example: "An applicant's financial statement page was badly scanned. This is a technical error, not a substantive change. Correct action: ask for that page only by a fixed date, and evaluate on available elements if it does not arrive.",
      understand: "The Co-ordinator checks signed exclusion declarations and eligibility thresholds; requests for information may clarify a proposal but never change its substance.",
      do: "Prepare the draft G14.1 report and send it with copies of all proposals to the Evaluation Committee members.",
      check: "Every Committee member has signed G13.4, and external members have also signed the G13.5 confidentiality declaration.",
      sections: [
        ["Co-ordinator's draft report", "For exclusion, the Co-ordinator checks that each applicant has duly signed the solemn declaration on exclusion criteria. For eligibility, he or she verifies that each threshold has been met. Conclusions are entered in a draft report (Template G14.1), sent to the Evaluation Committee with a copy of all proposals received."],
        ["Requests for further information", "Requests may only clarify a proposal, for example to complete administrative details or correct a technical error such as a badly scanned page. The applicant may supply only the expected information by a specified date, failing which the evaluation proceeds on the elements available. Any non-administrative addition is excluded, and any attempt to alter the proposal substantively may give rise to a fraud investigation."],
        ["Committee composition", "The Rule requires at least one staff member on each Evaluation Committee. It is recommended to appoint a majority of staff members, ideally only staff, though this is not binding. The Committee is appointed by the Commitments Officer using Template G13.1."],
        ["External members", "Members from outside the Secretariat allow co-operation with donors or beneficiary state authorities and bring technical expertise. They must undertake in writing that they have no conflict of interest and will abide by the rules, and must sign a declaration of confidentiality (G13.5); staff are already bound by Article 26 of the Staff Regulations."],
        ["Responsibilities and conflicts of interest", "Each member undertakes on appointment to act in line with Article 13.3; the Vademecum (G13.2) explains the role. Article 13.4 lists cases where a conflict of interest is irrebuttably presumed, requiring the person to withdraw or be excluded. The list is not exhaustive."]
      ],
      warning: "A presumed conflict of interest under Article 13.4 cannot be rebutted; the member must withdraw or be excluded from the Committee.",
      best: "Appoint a Committee made up mainly or entirely of staff members to avoid disputes over interpreting the Rule.",
      checklist: [
        "Check every exclusion declaration is signed",
        "Verify each eligibility threshold against the evidence",
        "Limit information requests to clarifications with a fixed date",
        "Collect G13.4 declarations from all Committee members",
        "Collect G13.5 from members outside the Secretariat",
        "Send the draft G14.1 report and all proposals to members"
      ],
      links: ["Submission", "Evaluation", "Roles"],
      templates: [
        ["G14.1", "Evaluation report on exclusion and eligibility criteria"],
        ["G13.1", "Decision appointing the Evaluation Committee"],
        ["G13.2", "Vademecum for Evaluation Committee members"],
        ["G13.4", "Declaration of absence of conflict of interests"],
        ["G13.5", "Declaration of confidentiality (external members)"]
      ]
    },
    {
      name: "Evaluation",
      title: "Evaluating proposals and deciding the award",
      lead: "The Committee adopts the eligibility report, members score proposals individually, the Co-ordinator compiles a consensus report and the Commitments Officer decides.",
      source: "Rule 1374 · Art. 14",
      remember: "Score 0–5, average equally, all sign, Commitments Officer reasons.",
      keyFacts: [["0–5","score scale per award criterion"],["15 days","max calendar days to inform unsuccessful applicants"],["7 days","minimum enquiry period in the letter"],["G14.6","Commitments Officer award decision"]],
      example: "The consensus report for a media freedom call is signed by all members, but one recommended budget looks unreasonable. The Commitments Officer must verify cost, aims and available funds. Correct action: ask the Committee to amplify its report before adopting a reasoned G14.6 decision.",
      understand: "Members score each award criterion from 0 to 5 with comments; the consensus report averages scores equally and is adopted when all members sign.",
      do: "Run individual scoring with G14.3, compile the G14.4 consensus report and submit it for the Commitments Officer's reasoned G14.6 decision.",
      check: "Unsuccessful applicants are informed in writing no later than 15 calendar days after the successful ones.",
      sections: [
        ["Adopting the eligibility report", "The Evaluation Committee starts by adopting the report on exclusion and eligibility criteria (G14.1) based on the Co-ordinator's draft. Adoption may be by electronic consultation, in which case the Co-ordinator keeps a copy of the exchanges. Only applicants declared eligible proceed to the award criteria."],
        ["Individual scoring", "The Co-ordinator sends each member Model G14.3, completed by each member for each proposal. Each criterion or sub-criterion is scored from 0 (fails or cannot be assessed) to 5 (excellent), with coherent explanatory comments."],
        ["Consensus report", "The Co-ordinator establishes an average score for each proposal, giving equal weight to each evaluator, in the consensus report (G14.4). If scores diverge too widely, he or she may talk to evaluators or convene the Committee. The report is adopted once signed by all members and states the total funds, the successful and the unsuccessful applicants."],
        ["Commitments Officer decision", "The Commitments Officer must give reasons, for example by endorsing the attached consensus report without reservation (G14.6). He or she verifies that the selected project pursues the call's aims, that its cost and content are reasonable and that funds are available. If the report is insufficiently reasoned or conflicts with the Rule, he or she asks the Committee to amend or amplify it."],
        ["Unsuccessful call", "If no proposal is received, the Commitments Officer may decide, without prior action by the Committee, to award no grant or launch a new call. If no proposal meets the criteria, the decision follows the Committee's analysis. Template G14.7A records the decision."],
        ["Informing applicants", "The Commitments Officer informs successful applicants in writing promptly (G14.8). Unsuccessful applicants are informed in writing within 15 calendar days of the successful ones (G14.9A for exclusion or ineligibility, G14.9B for those not selected), with the enquiry procedure and a cut-off date of at least 7 calendar days. Best practice is to inform all applicants at the same time."]
      ],
      warning: "The 15 calendar day deadline for informing unsuccessful applicants is imperative, and the letter must state a cut-off date for enquiries of at least 7 calendar days.",
      best: "Send all successful and unsuccessful letters on the same day and direct questions to the Co-ordinator.",
      checklist: [
        "Adopt the G14.1 report and keep a record of exchanges",
        "Collect a completed G14.3 sheet per member per proposal",
        "Average scores equally in the G14.4 consensus report",
        "Have every Committee member sign the consensus report",
        "Obtain the Commitments Officer's reasoned G14.6 decision",
        "Send G14.8 and G14.9A or G14.9B letters on time"
      ],
      links: ["Eligibility Check", "Complaints", "Agreement"],
      templates: [
        ["G14.1", "Evaluation report on exclusion and eligibility criteria"],
        ["G14.3", "Individual assessment report"],
        ["G14.4", "Consensus report"],
        ["G14.6", "Decision on the award (competitive procedure)"],
        ["G14.7A", "Decision following an unsuccessful call"],
        ["G14.8", "Letter informing successful participants"],
        ["G14.9A", "Letter to unsuccessful applicants (exclusion or ineligibility)"],
        ["G14.9B", "Letter to unsuccessful participants (not selected)"]
      ]
    },
    {
      name: "Complaints",
      title: "Enquiries, complaints and allegations",
      lead: "Unsuccessful applicants must first enquire, may then complain within 30 calendar days, and complaints go to the Co-ordinator and, failing a manifest error, to the Review Board.",
      source: "Rule 1374 · Art. 15–16",
      remember: "Enquire first, complain within 30 days, about the evaluation only.",
      keyFacts: [["30 days","calendar days to lodge a complaint after the enquiry reply"],["30 days","for the Review Board to meet after receipt"],["3","Review Board members: Auditor, DLAPIL, Treasurer"]],
      example: "An unsuccessful NGO complains that its complete proposal was rejected as incomplete. That is a manifest error. Correct action: the Co-ordinator alerts the Evaluation Committee, which reassesses and recommends measures to the Commitments Officer.",
      understand: "A complaint is admissible only if it contests how the proposal was examined; it cannot challenge the wording of the criteria unless they breach Article 2.",
      do: "Reply to enquiries in writing with G15.2, screen complaints for manifest error and transmit the rest to the Review Board without delay.",
      check: "Time limits are counted in calendar days from midnight after the triggering act, extended to the next working day if needed.",
      sections: [
        ["Enquiries and replies", "The enquiry deadline, at least 7 days, is stated in the letter to unsuccessful applicants, and the Co-ordinator checks that requests arrive in time. Reasons for non-selection are given in writing, not by telephone, promptly. The reply (G15.2) explains the complaint procedure, which complaints are inadmissible and where to send a complaint."],
        ["Lodging a complaint", "An enquiry must precede any complaint. The complaint must be submitted within 30 calendar days of notification of the reply to the enquiry, cite the call reference and the proposal's identification number, and contain the grievances and all necessary documents. Inadmissible complaints receive G15.3A; missing documents are requested with G15.3B within a reasonable time stated in writing."],
        ["Calculating time limits", "Time runs from midnight on the day after the triggering act: a reply notified at 11 am on the 2nd starts the clock at midnight on the 3rd. Saturdays, Sundays and public holidays count, but a deadline falling on one is extended to the next working day."],
        ["Manifest error check", "The Co-ordinator immediately examines the complaint for a manifest error, a gross or clear error in interpreting the facts or in the procedure, such as rejecting a proposal as incomplete when all documents were submitted. If found, the Evaluation Committee reassesses the proposal and recommends measures to the Commitments Officer, who decides."],
        ["Review Board", "Otherwise the Co-ordinator transmits the complaint and all evaluation documents to the Review Board without delay; it meets within 30 calendar days of receipt. It comprises representatives of the internal Auditor, the Director of Legal Advice and Public International Law and the Treasurer, none involved in the evaluation. It cannot re-evaluate the proposal but checks that criteria were applied coherently and without discrimination, and may recommend a fresh evaluation by reasoned opinion (G15.7A); the Commitments Officer decides on measures (G15.7B)."],
        ["Fraud, corruption and misconduct", "The complaints procedure only reviews errors in evaluation and is not an inquiry into misconduct. Allegations of fraud, corruption or misconduct should be addressed to the internal Auditor or the Directorate General of Administration, which act under the applicable framework, in particular Rule 1327."]
      ],
      warning: "Complaints contesting anything other than the examination of the proposal are inadmissible, and the Review Board may not substitute its own evaluation.",
      best: "Keep every evaluation document on file so the complete record can be sent to the Review Board at once.",
      checklist: [
        "Check enquiries were received within the stated deadline",
        "Reply to enquiries in writing using G15.2",
        "Confirm an enquiry preceded the complaint",
        "Check admissibility and completeness of the complaint",
        "Screen the complaint for manifest error immediately",
        "Transmit the full file to the Review Board without delay",
        "Refer fraud allegations to the internal Auditor or DGA"
      ],
      links: ["Evaluation", "Filing"],
      templates: [
        ["G15.2", "Reply to enquiries"],
        ["G15.3A", "Reply letter, inadmissible complaint"],
        ["G15.3B", "Reply letter, missing documents"],
        ["G15.7A", "Opinion of the Review Board"],
        ["G15.7B", "Commitments Officer decision following a complaint"]
      ]
    },
    {
      name: "Agreement",
      title: "Drafting, signing and amending the grant agreement",
      lead: "A written grant agreement is imperative; it is based on the DLAPIL model but must be adapted to the context, the proposal and the donor's requirements.",
      source: "Rule 1374 · Art. 17",
      remember: "Always in writing; amend management details, never the total amount.",
      keyFacts: [["Written","grant agreement is imperative"],["G17.2A / G17.2B","model agreement for BO-VC / EU funds"],["G17.3","amendment template"]],
      example: "A grantee asks to change its bank details and add €5,000 to the grant. Bank details are a management matter, but the total amount must not increase. Correct action: amend the bank details in writing with G17.3 or e-mail and refuse the increase.",
      understand: "The agreement must contain a description of the action, an estimated budget, the implementation period, reporting obligations and a limit on third-party liability.",
      do: "Adapt Template G17.2A or G17.2B with its annexes, consulting DLAPIL where needed, and have the Commitments Officer sign it.",
      check: "The estimated budget total equals the grant amount and the implementation period does not pre-date the proposal deadline.",
      sections: [
        ["Written agreement", "The signature of a written grant agreement between the parties is imperative. A verbal agreement not put into writing is contrary to the Rule."],
        ["Model agreement", "Use Template G17.2A for the Ordinary Budget or Voluntary Contributions and G17.2B for EU funds, with the guidance in G17.2C. The model is only a basis and must be adapted to the context, the proposal and any donor requirements, notably visibility and eligibility of costs. DLAPIL may be consulted for a legal opinion."],
        ["Content", "The agreement must include a description of the action, preferably in an annex, and an itemised estimated budget annex (G17.2D) whose total matches the grant amount, even for operational grants. It defines the grantee's obligations, especially narrative and financial reporting (G17.2E or G17.2F), and any purchases or sub-grants. The implementation period should not be retroactive and may never pre-date the deadline for proposals."],
        ["Amendments", "Where the agreement requires written agreement of both parties, an amendment may be made by e-mail or by a document signed by both (G17.3), clearly referencing the agreement and the provisions supplemented or cancelled and replaced. For e-mail, the authorised staff member's written agreement is obtained first and he or she is copied. Amendments may cover management matters such as deadlines, contact or bank details, but must never increase the total grant amount or distort the initial conditions of the procedure."],
        ["Third-party liability", "The Organisation's third-party liability must be contractually limited. The model agreement G17.2A is drafted accordingly."],
        ["Grants in Ukraine", "For grants implemented in Ukraine, add Annex V on security and safety (G17.2H) or the corresponding addendum (G17.4)."]
      ],
      warning: "An amendment must never increase the total grant amount or alter conditions in a way that creates unequal treatment between applicants.",
      best: "Use the estimated budget annex structure as the framework for the grantee's financial reporting.",
      checklist: [
        "Choose G17.2A or G17.2B according to the funding source",
        "Attach the action description and G17.2D budget annex",
        "Match the budget total to the grant amount",
        "Define the implementation period without retroactivity",
        "Set narrative and financial reporting obligations",
        "Keep the third-party liability limitation clause",
        "Record amendments in writing with G17.3 or e-mail"
      ],
      links: ["Costs", "Evaluation", "Filing"],
      templates: [
        ["G17.2A", "Grant agreement for BO or VC"],
        ["G17.2B", "Grant agreement for EU funds"],
        ["G17.2C", "How to prepare a grant agreement"],
        ["G17.2D", "Annex II, estimated budget"],
        ["G17.2E", "Annex III, financial report (one currency)"],
        ["G17.2F", "Annex III, financial report (two currencies)"],
        ["G17.2G", "Guidelines for using budget templates"],
        ["G17.2H", "Annex V, security and safety for grants in Ukraine"],
        ["G17.3", "Amendment"],
        ["G17.4", "Addendum on security and safety in Ukraine"]
      ]
    },
    {
      name: "Filing",
      title: "Record-keeping, interpretation and templates",
      lead: "The initiating department keeps the complete file, the Rule is interpreted in good faith, and the templates must be completed and cleaned before use.",
      source: "Rule 1374 · Art. 18–20",
      remember: "Keep everything, from Co-ordinator appointment to final supporting documents.",
      keyFacts: [["Initiating department","keeps the full grant file"],["Art. 19","good-faith interpretation of the Rule"],["[XX]","options and comments to delete before sending"]],
      example: "At closure, a project team holds evaluation sheets but the grantee's validated receipts sit with another unit. The whole file belongs with the initiating department. Correct action: gather all documents up to validation of the supporting documents and file them per the document management table.",
      understand: "All documents from the Co-ordinator's appointment to validation of the supporting documents must be kept by the department that initiated the procedure.",
      do: "File every procedure document in line with your entity's document management table and finalise templates before sending them.",
      check: "Comments, blue highlighting and bracketed [XX] options have been removed from every template sent to third parties.",
      sections: [
        ["Storage of documents", "All documents relating to the grant procedure, from the appointment of the Co-ordinator to the validation of the supporting documents certifying proper use of the grant, are kept by the department that initiated the procedure. Entities' document management tables must reflect this requirement."],
        ["Interpretation", "The Rule is interpreted in good faith under Article 19, keeping in mind its spirit and the general principles in its Preamble. The guide and its appendices are recommended for all award procedures; changing the forms may create a discrepancy with the Rule, so consult DLAPIL on any ad hoc situation. Misuse of the guide may be the subject of an administrative inquiry."],
        ["Using the templates", "Templates contain parts to complete and multiple-choice options, with comments to help drafting. All elements must be completed before sending to third parties, and comments, parts highlighted in blue and bracketed [XX] options must be deleted. Parts for the applicant or grantee are marked in red."]
      ],
      warning: "Altering the standard forms risks departing from the Rule; consult DLAPIL before any ad hoc change.",
      best: "Open the G3.1TAB follow-up table at the start and file each document as the step is completed.",
      checklist: [
        "Keep the full file in the initiating department",
        "Include supporting documents validating use of the grant",
        "Align filing with the document management table",
        "Complete every template field before sending",
        "Delete comments, blue text and [XX] options",
        "Consult DLAPIL before altering any form"
      ],
      links: ["Agreement", "Complaints", "Roles"],
      templates: [
        ["G3.1TAB", "Follow-up table of the Co-ordinator"]
      ]
    }
  ];
})();
