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

  C.grantReference = {
    "limits": [
      {
        "value": "€15,000",
        "rule": "Total estimated procedure budget from which a published call for proposals is required; below it a direct award (G9.2A) is possible.",
        "who": "Commitments Officer"
      },
      {
        "value": "7%",
        "rule": "Maximum share of indirect eligible costs, stated in the call and made contractual in the agreement.",
        "who": "Department drafting the call; Commitments Officer"
      },
      {
        "value": "12 months",
        "rule": "Normal maximum duration of an operational grant agreement (consecutive months).",
        "who": "Commitments Officer"
      },
      {
        "value": "0–5",
        "rule": "Score scale for each award criterion or sub-criterion, with explanatory comments.",
        "who": "Each Evaluation Committee member"
      },
      {
        "value": "15 calendar days",
        "rule": "Latest time to inform unsuccessful applicants after the successful ones.",
        "who": "Commitments Officer"
      },
      {
        "value": "7 calendar days",
        "rule": "Minimum enquiry period stated in the letter to unsuccessful applicants.",
        "who": "Commitments Officer"
      },
      {
        "value": "30 calendar days",
        "rule": "Time to lodge a complaint after notification of the reply to the enquiry.",
        "who": "Unsuccessful applicant"
      },
      {
        "value": "30 calendar days",
        "rule": "Time within which the Review Board meets after receiving a complaint.",
        "who": "Review Board"
      },
      {
        "value": "At least 1",
        "rule": "Staff member on every Evaluation Committee.",
        "who": "Commitments Officer"
      }
    ],
    "roles": [
      {
        "name": "Commitments Officer",
        "does": "Holds the eleven Article 3.1 responsibilities: decides direct award, approves the call, appoints the Co-ordinator and Committee, awards, informs applicants, signs, suspends, terminates and recovers.",
        "when": "Throughout the procedure and the agreement; may delegate in writing to a cost centre manager (Art. 31 FR)."
      },
      {
        "name": "Co-ordinator",
        "does": "Runs the procedure: opens proposals with a Committee member, drafts the eligibility report, compiles the consensus report, answers enquiries and screens complaints for manifest error.",
        "when": "From appointment (G3.1) until the complaints stage."
      },
      {
        "name": "Evaluation Committee",
        "does": "Adopts the eligibility report, scores proposals individually, signs the consensus report and reassesses proposals after a manifest error or Review Board opinion.",
        "when": "From appointment (G13.1) through evaluation and any reassessment."
      },
      {
        "name": "Review Board",
        "does": "Checks that criteria were applied coherently and without discrimination; may recommend a fresh evaluation by reasoned opinion but cannot re-evaluate.",
        "when": "When a complaint shows no manifest error."
      },
      {
        "name": "DLAPIL",
        "does": "Gives legal opinions on the call and agreement, agrees specific clauses and is consulted before termination and on ad hoc situations.",
        "when": "Before publishing the call, when adapting or amending agreements, before termination."
      }
    ],
    "howTo": [
      {
        "title": "How to choose the procedure",
        "who": "Commitments Officer",
        "steps": [
          "Calculate the total estimated budget of the whole procedure.",
          "Below €15,000: adopt the direct award decision G9.2A and sign the agreement.",
          "From €15,000: launch a competitive call for proposals.",
          "Only in exceptional circumstances: adopt a justified G9.2B decision and attach it to the commitment request."
        ],
        "templates": [
          "G9.2A",
          "G9.2B"
        ],
        "source": "Art. 2.1.2, 2.1.3, 9"
      },
      {
        "title": "How to publish a call for proposals",
        "who": "Department concerned, approved by the Commitments Officer",
        "steps": [
          "The department formulates the objectives of the action.",
          "The department drafts the call with G8.1A or G8.1B and the G8.2 application form, covering elements a to j.",
          "The Commitments Officer checks the call with the G8.3 checklist.",
          "The department requests a DLAPIL legal opinion and agrees any specific clause.",
          "The Commitments Officer approves the call.",
          "The department publishes it on the website and through channels reaching the target public.",
          "The department publishes one consolidated questions and answers document by the same means."
        ],
        "templates": [
          "G8.1A",
          "G8.1B",
          "G8.2A",
          "G8.2B",
          "G8.3"
        ],
        "source": "Art. 3.1 b, 8"
      },
      {
        "title": "How to open proposals",
        "who": "Co-ordinator with an Evaluation Committee member",
        "steps": [
          "Wait until the submission deadline has expired.",
          "The Co-ordinator opens the proposals together with a Committee member.",
          "Give each proposal an identification number.",
          "Record the opening in the G11.1 report.",
          "Note late proposals and the reasons for the draft report."
        ],
        "templates": [
          "G11.1"
        ],
        "source": "Art. 10.5, 11"
      },
      {
        "title": "How to check exclusion and eligibility",
        "who": "Co-ordinator, then Evaluation Committee",
        "steps": [
          "The Co-ordinator checks each signed exclusion declaration.",
          "The Co-ordinator verifies each eligibility threshold.",
          "The Co-ordinator requests clarifications only, with a fixed date.",
          "The Co-ordinator sends the draft G14.1 report and all proposals to the Committee.",
          "The Committee adopts the G14.1 report."
        ],
        "templates": [
          "G4.1.2A",
          "G14.1"
        ],
        "source": "Art. 12, 14.1"
      },
      {
        "title": "How to evaluate proposals and award",
        "who": "Evaluation Committee, Co-ordinator, Commitments Officer",
        "steps": [
          "Each Committee member scores each eligible proposal 0–5 per criterion in G14.3.",
          "The Co-ordinator averages the scores equally in the G14.4 consensus report.",
          "All Committee members sign the consensus report.",
          "The Commitments Officer verifies aims, cost and funds and adopts a reasoned G14.6 decision.",
          "The Commitments Officer sends G14.8 letters and, within 15 calendar days, G14.9A or G14.9B letters."
        ],
        "templates": [
          "G14.3",
          "G14.4",
          "G14.6",
          "G14.8",
          "G14.9A",
          "G14.9B"
        ],
        "source": "Art. 14"
      },
      {
        "title": "How to handle a complaint",
        "who": "Co-ordinator, Evaluation Committee, Review Board, Commitments Officer",
        "steps": [
          "The Co-ordinator replies to the enquiry in writing with G15.2.",
          "The Co-ordinator checks the complaint arrived within 30 calendar days and is admissible (G15.3A) and complete (G15.3B).",
          "The Co-ordinator screens it immediately for manifest error.",
          "If there is a manifest error, the Evaluation Committee reassesses and recommends measures.",
          "Otherwise the Co-ordinator sends the full file to the Review Board, which meets within 30 calendar days and gives an opinion (G15.7A).",
          "The Commitments Officer decides on measures (G15.7B)."
        ],
        "templates": [
          "G15.2",
          "G15.3A",
          "G15.3B",
          "G15.7A",
          "G15.7B"
        ],
        "source": "Art. 15"
      },
      {
        "title": "How to draft and sign the grant agreement",
        "who": "Commitments Officer, with DLAPIL",
        "steps": [
          "Choose G17.2A or G17.2B according to the funding source.",
          "Adapt it to the context, the proposal and donor requirements.",
          "Attach the action description and the G17.2D budget, totalling the grant amount.",
          "Define the implementation period, never before the proposal deadline.",
          "The Commitments Officer signs the written agreement."
        ],
        "templates": [
          "G17.2A",
          "G17.2B",
          "G17.2D"
        ],
        "source": "Art. 17"
      },
      {
        "title": "How to amend an agreement",
        "who": "Commitments Officer or authorised staff member",
        "steps": [
          "Check the change concerns management matters only and does not increase the total amount.",
          "For e-mail, obtain the authorised staff member's agreement and copy him or her.",
          "Reference the agreement and state which provisions are supplemented or cancelled and replaced.",
          "Obtain the grantee's written confirmation by return e-mail, or both signatures on G17.3."
        ],
        "templates": [
          "G17.3"
        ],
        "source": "Art. 17.3"
      },
      {
        "title": "How to close and file",
        "who": "Initiating department",
        "steps": [
          "Collect all documents from the Co-ordinator's appointment to validation of the supporting documents.",
          "File them under the entity's document management table.",
          "Check templates sent out were completed and cleaned of comments, blue text and [XX] options."
        ],
        "templates": [
          "G3.1TAB"
        ],
        "source": "Art. 18, 20"
      }
    ]
  };

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
        ["Purpose of a grant", {"lead":"A grant serves two cumulative purposes; if either is missing, a grant is not the right instrument.","items":[["Grantee purpose","It assists the grantee in attaining its own goals or objectives."],["Organisation purpose","It fulfils a more general objective of advancing the Organisation's values or policies."]],"ordered":false,"must":["Every grant must meet both purposes at the same time."]}],
        ["Legal basis and scope", {"lead":"Grants are foreseen by Article 43 bis of the Financial Regulations and implemented by Rule 1374.","items":[["Ordinary Budget","Grants financed from the Organisation's own budget."],["Voluntary Contributions","Grants financed from voluntary contributions by member states or others."],["Donor agreements","Grants financed under Grant Agreements with external donors."]],"ordered":false,"must":["Rule 1374 applies to every grant procedure, whatever the source of funding."]}],
        ["Two types of grant", {"lead":"A grant finances either a project or a grantee's running costs, whatever the grantee's status, public or private, legal or natural person.","items":[["Project-related grant","Finances a project or a specified action."],["Operational grant","Finances a given grantee's operational expenditure."]],"ordered":false,"must":["An operational grant should not normally give rise to a grant agreement of more than twelve consecutive months."]}],
        ["Grant or procurement", {"lead":"Co-financing is the characteristic feature that distinguishes a grant from a service contract.","items":[["Grant","The grantee co-finances the action from its own or third-party resources."],["Service contract","No service contract may give rise to co-financing by the service supplier."]],"ordered":false,"tip":"If the Council would pay the full cost of a service it needs, use the procurement rules instead."}],
        ["Declaration of interest", {"lead":"Staff involved in a grant award process declare their interests before taking part.","must":["Every staff member involved in a procurement or grant award process must complete the staff member declaration of interest."],"tip":"Complete the declaration before taking part in any step of the procedure."}],
        ["How the guide is organised", {"lead":"The guide follows the numbering of Rule 1374, and each template carries the number of the article it implements.","tip":"Template G14.1, for example, implements Article 14.1."}]
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
        ["The six principles at a glance", {"lead":"Article 2 sets six general principles that apply to every grant procedure.","items":[["2.1 Transparency","Procedures of €15,000 or more require a published call for proposals."],["2.2 Non-retroactivity","The action must not already be completed when the agreement is signed."],["2.3 Co-financing","The Council never finances the entire cost."],["2.4 Non-cumulative awards","One Council grant per project, action or operational grantee."],["2.5 No profit","Total funding cannot exceed the agreed budgeted expenses."],["2.6 Non-discrimination","Applicants are treated equally unless a difference is objectively justified."]],"ordered":false}],
        ["Transparency and the €15,000 threshold", {"lead":"All grant award procedures of €15,000 or more require, in principle, a published call for proposals.","items":[["Reference figure","The threshold refers to the total estimated budget of the procedure, not the amount per grantee."],["Worked example","Five grants of €10,000 make €50,000, so the threshold is passed and a call is required."]],"ordered":false,"must":["Above the threshold, any exception to publication must be interpreted strictly."]}],
        ["Exceptions to publication", {"lead":"Only three situations may justify not publishing a call once the €15,000 threshold is met.","items":[["1. Unforeseeable emergency","An emergency beyond the awarding entity's control, of such magnitude that a call cannot be carried out."],["2. Grantee characteristics","The grantee's nature makes a call impossible, for example an international organisation acting alone in a given field."],["3. Predetermined action","The action is described in terms leaving no scope for a call, for instance partners approved by a donor and contractually predetermined."]],"ordered":false}],
        ["Non-retroactivity", {"lead":"The action financed must not already be completed when the agreement is signed.","items":[["Completed before signature","Not allowed: non-retroactivity precludes signature."],["Started before signature","Allowed but not recommended, provided eligible costs were incurred only after the closing date for proposals."],["Starts after signature","The best possible practice."]],"ordered":false,"must":["Eligible costs must not be incurred before the closing date for submission of proposals.","The grant agreement must state precisely the beginning and end of the implementation period."]}],
        ["Co-financing", {"lead":"The Council must not finance the entire cost of the action, the project or the grantee's operations.","items":[["Own or third-party funds","Financial resources of the grantee or of other funders."],["Human resources","Staff time contributed by the grantee."],["Contributions in kind","Moveable or immoveable, tangible or intangible assets."],["Income generated","Income generated by the action or project itself."]],"ordered":false,"must":["The grantee must contribute to financing the action from resources other than the Council grant."]}],
        ["Non-cumulative awards and no profit", {"lead":"Each action receives only one Council grant, and its total funding cannot exceed the agreed budget.","items":[["One grant only","The Council awards only one grant to a given project, action or operational grantee."],["No double funding","A grant may not finance part of an action already financed by other means."],["Complementary sources allowed","Several funders may each finance different parts of the action."],["No profit","Total funding above the agreed budgeted expenses would be overfunding and breach the no-profit principle."]],"ordered":false}],
        ["Non-discrimination", {"lead":"A difference in treatment of applicants in comparable situations is discriminatory unless it has an objective and reasonable justification.","items":[["Protected grounds","Gender, disability, age, colour, language, religion, belief, marital or parental status, opinions, national, social or ethnic origin, national minority, wealth, birth, citizenship, sexual orientation or any other situation."],["Legal persons","The principle applies to legal persons and their representatives, for example regarding place of establishment."],["Justification test","The difference must pursue a legitimate aim with proportionate means."]],"ordered":false,"tip":"Restricting a call to applicants in one town is justified when the call aims to build civil society capacity in that town."}]
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
        ["Direct award below €15,000", {"lead":"Under Article 2.1.2, a procedure with a total budget below €15,000 may be awarded without a call for proposals.","items":[["Adopt G9.2A","The Commitments Officer adopts the direct award decision; it also appoints the Co-ordinator."],["Sign the agreement","The grant agreement is signed with the grantee."]],"ordered":true}],
        ["Competitive procedure from €15,000", {"lead":"From €15,000 the principle is a competitive call for proposals, run in eight steps.","items":[["Appoint the Co-ordinator","Template G3.1."],["Publish the call","Draft, approve and publish the call (G8.1A or G8.1B, with G8.2)."],["Answer questions","Publish the questions and answers to all potential applicants."],["Appoint the Evaluation Committee","Template G13.1, with declarations of absence of conflicts of interest (G13.4)."],["Open proposals","Record the opening in G11.1."],["Assess","Eligibility report, individual scores and consensus report (G14.1, G14.3, G14.4)."],["Decide","The Commitments Officer adopts the award decision (G14.6)."],["Notify","Send the letters to applicants (G14.8, G14.9A, G14.9B)."]],"ordered":true}],
        ["Exceptional direct award from €15,000", {"lead":"Under Article 2.1.3, a grant of €15,000 or more cannot be awarded without a call unless exceptional circumstances occur.","items":[["Adopt G9.2B","The Commitments Officer adopts a duly justified decision, which also appoints the Co-ordinator."],["Sign the agreement","The grant agreement is signed with the grantee."]],"ordered":true,"must":["The Commitments Officer must justify the decision with reference to Article 2.1.3.","The justified decision must be attached to the request for commitment of funds (engagement de dépenses)."]}],
        ["Who decides", {"lead":"Only the competent Commitments Officer, or a representative by written delegation, can decide on a direct award.","tip":"The procedural guarantees for direct award are set out in Article 9 of the Rule."}]
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
        ["The three actors", {"lead":"The Commitments Officer decides, the Co-ordinator runs the procedure and the Evaluation Committee evaluates.","items":[["Commitments Officer","Responsible for every aspect of the procedure listed in Article 3.1."],["Co-ordinator","A staff member responsible for the smooth running of the procedure, appointed with G3.1."],["Evaluation Committee","Evaluates proposals; appointed with G13.1 under Article 13."]],"ordered":false}],
        ["Commitments Officer responsibilities (a to k)", {"lead":"Article 3.1 gives the Commitments Officer eleven responsibilities covering the procedure from start to finish.","items":[["a) Direct award","Decide whether the direct award conditions of Article 2.1 are met; Article 9 sets the guarantees."],["b) Approve the call","Approve the call, its publication means and submission arrangements, and ensure it complies with the Rule."],["c) Appoint the Co-ordinator","Formally appoint a staff member to plan and organise receipt and evaluation of applications (G3.1)."],["d) Appoint the Committee","Appoint the Evaluation Committee, whose membership and prerogatives are set by Article 13 (G13.1)."],["e) Award","Decide on the award under Articles 9.2, 14.5 and 14.7."],["f) Inform applicants","Inform applicants of the decision under Articles 14.8 and 14.9."],["g) Sign the agreement","Sign the grant agreement, consulting DLAPIL on adapting the model to donor conditions or national law."],["h) Confidentiality","Decide not to publish certain results if, and only if, the grantee's vital interests are potentially threatened (Art. 2.1.4)."],["i) Suspend","Suspend the agreement for unavoidable circumstances, political context or management reasons such as delays."],["j) Terminate","Terminate the agreement where difficulties make it necessary, after consulting DLAPIL."],["k) Reduce or recover","Reduce grant amounts or recover them in full or in part, for instance where expenses are ineligible."]],"ordered":false}],
        ["Preparing the call", {"lead":"The department concerned prepares the call, and the Commitments Officer checks it before approval.","items":[["Criteria","The call clearly specifies exclusion, eligibility and weighted award criteria, which cannot change after publication."],["Publication","The call is published so as to achieve its objectives (Art. 8.2)."],["Content","The call meets every requirement of Article 8.3."]],"ordered":false,"tip":"Use the G8.3 quality control checklist as a communication tool between the Commitments Officer and the drafters."}],
        ["Delegation", {"lead":"The Commitments Officer may delegate the Article 3.1 responsibilities to a cost centre manager in his or her administrative entity.","must":["Any delegation of Commitments Officer responsibilities must be in writing and follow Article 31 of the Financial Regulations."]}]
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
        ["Three categories, in sequence", {"lead":"Each category of criteria has its own purpose, and an applicant must pass each one before the next is applied.","items":[["1. Exclusion","Checks legal prerequisites, such as no criminal sentence linked to the applicant's activity."],["2. Eligibility","Checks the applicant's capacity to implement the project."],["3. Award","Evaluates the proposal itself."]],"ordered":true}],
        ["Exclusion grounds", {"lead":"Applicants who cannot guarantee compliance with the exclusion criteria are excluded and not assessed further.","must":["The call must define the exclusion criteria.","Each applicant must sign a declaration on exclusion criteria at submission (G4.1.2A to G4.1.2E).","The grant agreement must oblige grantees to report any change of situation affecting the exclusion criteria for its full duration."]}],
        ["Eligibility criteria", {"lead":"Eligibility criteria examine the applicant's capacity to implement the project, not the proposal itself.","items":[["Financial capacity","The applicant's financial means."],["Human capacity","The applicant's staff and human resources."],["Experience","The applicant's relevant experience."]],"ordered":false,"must":["Each eligibility criterion must set a precise threshold; applicants below it are not examined against the award criteria."]}],
        ["Award criteria", {"lead":"Award criteria evaluate the proposal as such, and apply only to applicants who passed exclusion and eligibility.","must":["Each award criterion must be relevant, verifiable and weighted.","The call must show the weighting of every award criterion and list the documents used to verify it."],"tip":"Give each award criterion weighted sub-criteria so applicants understand what is required."}],
        ["Objectivity of criteria", {"lead":"All criteria must be clearly formulated and founded on objective arguments.","items":[["Reasonable and proportionate","Criteria must not unduly restrict access, nor be so specific or vague that they favour or disadvantage applicants."],["Relevant","Each criterion has a cause and effect link with the project's goals, which are defined first."],["Verifiable","The call lists the documents used to verify each criterion, such as certified financial reports."]],"ordered":false}],
        ["Unalterable criteria", {"lead":"Published criteria are unalterable; this is a fundamental principle of Article 5.4.","must":["Nobody may alter published criteria or their weighting, under any circumstances, for the entire duration of the procedure."]}]
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
        ["Grant ceiling", {"lead":"The maximum grant amount is based on the estimated eligible costs, which must meet Article 6.2.","must":["The grant agreement must state the maximum amount of the grant."]}],
        ["Direct eligible costs (a to g)", {"lead":"A direct cost is eligible only if it meets all seven conditions of Article 6.2.","items":[["a) Necessary","Strictly necessary for implementing the action, or for the grantee's operations in an operational grant."],["b) Sound management","Consistent with sound financial management, best value for money and cost-effectiveness."],["c) Within the period","Actually incurred by the grantee during the implementation period defined to the day in the agreement."],["d) Identifiable and verifiable","Recorded in the grantee's accounts under its applicable accounting standards."],["e) Tax and social law","Compliant with applicable tax and social security legislation."],["f) Documented","Backed by originals or certified copies, certified generally by the grantee's treasurer."],["g) In the budget","Indicated in the estimated overall budget, including for operational grants."]],"ordered":false}],
        ["Indirect eligible costs", {"lead":"Indirect costs may be eligible only if planned from the start, and never above 7% of the total.","must":["The call must state the precise percentage of indirect costs, and the agreement must make it contractual.","Indirect costs must never exceed 7% of the total (Art. 6.3)."]}],
        ["Ineligible costs (a to h)", {"lead":"Article 7.1 lists eight costs that are never eligible, for reasons of principle or legal and financial certainty.","items":[["a) Other financing","Expenditure financed by other sources (non-cumulative awards)."],["b) Prior debts","Debts and provisions for losses or debts incurred before the award."],["c) Outside the period","Costs incurred outside the implementation period in the agreement."],["d) Unrelated","Expenditure unrelated to the project or action."],["e) Interest","Interest owed, which is never necessary to implement an action."],["f) Land and buildings","Purchase of land and buildings, completely excluded."],["g) Exchange losses","Currency exchange losses, which the grantee must guard against, for example with an account in a specific currency."],["h) Loans","Loans to third parties, given the risks involved."]],"ordered":false}],
        ["Renovation work", {"lead":"Renovation costs are excluded unless directly related to the project or action.","must":["Where renovation is directly related to the action, the action description must specify its extent precisely."]}],
        ["Other ineligible costs", {"lead":"The Article 7.1 list is not exhaustive and may be supplemented.","items":[["Donor needs","Extra items required by a donor of extra-budgetary resources."],["Procedure needs","Other requirements specific to the procedure in question."]],"ordered":false}]
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
        ["Templates", {"lead":"Use the standard call and application form templates matching the funding source.","items":[["G8.1A","Call for proposals for the Ordinary Budget or Voluntary Contributions."],["G8.1B","Call for proposals for EU funds."],["G8.2A / G8.2B","Application form, used for all competitive procedures."]],"ordered":false,"must":["Drafters may adapt the application form but must keep the substance of Sections 1 to 3 and leave the declaration and signature in Sections 12 and 13 unchanged."]}],
        ["Mandatory content (a to j)", {"lead":"Article 8.3 lists ten elements that every call for proposals must contain.","items":[["a) Objectives","The aims of the action; formulating them is the first stage of any procedure."],["b) Co-financing","The required level of co-financing, preferably as a percentage of the estimated budget."],["c) Submission arrangements","Ways to send proposals, supporting documents, deadline and the consequences of non-compliance."],["d) Contact e-mail","A departmental address for written questions, with languages, question deadline and how replies are published."],["e) Indicative dates","When applicants will learn the outcome and when agreements should be signed."],["f) Timetable","The indicative timetable for implementing the action."],["g) Exclusion and eligibility","The criteria and the supporting documents each applicant must submit."],["h) Award criteria","The criteria, their weighting and their supporting documents."],["i) Number of grantees","The number of potential grantees and the total value of the grants."],["j) Agreement terms","Terms based on the model: payment arrangements, any financial guarantees and any specific clauses."]],"ordered":false,"tip":"Create a dedicated e-mail address for the procedure rather than using a staff member's personal address."}],
        ["Legal opinion", {"lead":"DLAPIL systematically verifies the submission arrangements when asked for a legal opinion on the draft call.","must":["Drafters must agree any specific clause for the agreement with DLAPIL before it is published with the call."],"tip":"Request a legal opinion before publication, especially where financial guarantees such as a deposit or bank guarantee are stipulated."}],
        ["Means of publication", {"lead":"The means of publication must first and foremost reach the target public.","items":[["Organisation's website","Mandatory, but not sufficient on its own."],["Local newspaper","A notice referring to the full call on the website, useful for calls limited to certain member states."],["Social networks","A useful extra channel, in wording suited to the procedure."],["Permanent Delegations","Informing them suits calls limited to one or several member states."]],"ordered":false,"must":["Every published document must comply with data protection rules."]}],
        ["Questions and answers", {"lead":"Under non-discrimination, replies must reach all potential applicants, including those who did not ask.","items":[["Collect","Gather all questions into a single document."],["Merge and filter","Merge identical questions; omit irrelevant ones and those answered in the call."],["Publish","Publish the document by the same means as the call."]],"ordered":true}]
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
        ["Submission conditions", {"lead":"Dispatch arrangements, closing date and supporting documents are strict requirements applied uniformly to all applicants.","must":["The Co-ordinator must apply the consequences of non-compliance stated in the call stringently."]}],
        ["Late proposals", {"lead":"Whether a late proposal is examined depends on how the call certifies the dispatch date or time.","items":[["Proof of dispatch","The postmark, delivery stamp or e-mail time decides whether a proposal was on time."],["Force majeure","An applicant claiming unavoidable circumstances must prove force majeure."],["Co-ordinator","Gives reasons in the draft report on exclusion and eligibility."],["Evaluation Committee","States in the consensus report whether force majeure is proven."]],"ordered":true,"tip":"State in the call how the dispatch date and time are established."}],
        ["Estimated budget and other financing", {"lead":"The budget and funding information in each proposal make the key financial principles workable.","items":[["Estimated budget","Used to assess feasibility, calculate co-financing and determine eligible expenditure."],["Other sources of financing","Crucial for applying co-financing and non-cumulative awards."]],"ordered":false,"must":["Each proposal must include an estimated budget; costs outside it cannot be eligible."]}],
        ["Two-stage evaluation", {"lead":"For highly technical files, a concept note can test the fundamentals before shortlisted applicants submit a detailed proposal.","items":[["Stage 1: concept note","Checks the essential features of each proposal."],["Stage 2: detailed proposal","Shortlisted applicants develop the technical detail."]],"ordered":true,"must":["Unsuccessful applicants at either stage are informed only after the Commitments Officer's final award decision."],"tip":"Avoid two stages for files with little technical content; decide case by case."}],
        ["Personal data", {"lead":"Data protection rules apply throughout the procedure, including implementation of the agreement.","must":["The grant agreement must contain a clause on the conditions of publication of data; the model agreement includes one."]}],
        ["Opening and numbering", {"lead":"Proposals are opened only after the deadline, by two people, and recorded in Template G11.1.","items":[["Wait for the deadline","Opening early should lead to cancellation of the whole procedure."],["Open with a witness","The Co-ordinator opens the proposals with a member of the Evaluation Committee."],["Number and record","Each proposal receives an identification number in the G11.1 report."]],"ordered":true,"must":["The Co-ordinator must never open proposals alone.","Nobody may alter the content of a proposal once the Secretariat has received it."]}]
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
        ["Co-ordinator's draft report", {"lead":"The Co-ordinator checks exclusion and eligibility and records the conclusions in a draft G14.1 report.","items":[["Check exclusion","Confirm each applicant has duly signed the solemn declaration on exclusion criteria."],["Check eligibility","Verify each applicant meets every eligibility threshold."],["Write the draft","Enter conclusions and comments in the draft G14.1 report."],["Transmit","Send the draft with a copy of all proposals to the Evaluation Committee members."]],"ordered":true}],
        ["Requests for further information", {"lead":"A request may clarify a proposal but never change its substance.","items":[["Administrative details","Allowed: details without effect on the outcome, such as personal data or an unselected option."],["Technical errors","Allowed: a badly scanned page or a plainly outdated document version."],["Substantive changes","Not allowed: non-administrative additions are excluded and may trigger a fraud investigation."]],"ordered":false,"must":["The Co-ordinator must give the applicant a specified date; if nothing arrives, the evaluation proceeds on the elements available.","The Co-ordinator must ensure the process is transparent and non-discriminatory."]}],
        ["Committee composition", {"lead":"The Commitments Officer appoints the Evaluation Committee with Template G13.1.","must":["Each Evaluation Committee must include at least one staff member."],"tip":"Appoint a majority of staff members, ideally only staff; this is recommended but not binding."}],
        ["External members", {"lead":"Members from outside the Secretariat allow co-operation with donors or beneficiary state authorities and bring technical expertise.","must":["External members must undertake in writing that they have no conflict of interest and will abide by the rules.","External members must sign the declaration of confidentiality (G13.5); staff are already bound by Article 26 of the Staff Regulations."]}],
        ["Responsibilities and conflicts of interest", {"lead":"Each member undertakes on appointment to act in line with Article 13.3; the Vademecum (G13.2) explains the role.","items":[["G13.4 declaration","Every member declares the absence of conflicts of interest."],["Presumed conflicts","Article 13.4 lists cases where a conflict is irrebuttably presumed."],["Other conflicts","The list is not exhaustive; other situations may also be conflicts."]],"ordered":false,"must":["A member in a presumed conflict of interest must withdraw or be excluded from the Committee."]}]
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
        ["Evaluation steps", {"lead":"Evaluation runs from the eligibility report to the Commitments Officer's reasoned decision.","items":[["Adopt the G14.1 report","The Committee adopts the exclusion and eligibility report, possibly by electronic consultation."],["Score individually","Each member completes G14.3 for each eligible proposal."],["Compile the consensus","The Co-ordinator averages scores in the G14.4 consensus report."],["Sign","All members sign the consensus report to adopt it."],["Decide","The Commitments Officer adopts a reasoned G14.6 decision."]],"ordered":true,"must":["The Co-ordinator must keep a paper or electronic copy of any electronic consultation.","Only applicants declared eligible may be evaluated against the award criteria."]}],
        ["Scoring scale (0 to 5)", {"lead":"Each member scores every award criterion or sub-criterion from 0 to 5, with coherent explanatory comments.","items":[["0 Fails","Fails the criterion or cannot be assessed because information is missing."],["1 Poor","Approached superficially or with intrinsic weaknesses."],["2 Satisfactory","Generally meets the criterion but with intrinsic weaknesses."],["3 Good","Largely meets the criterion despite some shortcomings."],["4 Very good","Very largely meets the criterion with few shortcomings."],["5 Excellent","Fulfils every aspect; any shortcomings are minor."]],"ordered":false}],
        ["Consensus report", {"lead":"The Co-ordinator averages the scores, giving equal weight to each evaluator, in the G14.4 consensus report.","items":[["Total funds","The total amount of funds concerned by the procedure."],["Successful applicants","The list of successful applicants and selected proposals."],["Unsuccessful applicants","The list of unsuccessful applicants."]],"ordered":false,"must":["All Committee members must sign the consensus report before it is adopted."],"tip":"If scores diverge too widely, talk to the evaluators or convene the Committee to reach a common position."}],
        ["Commitments Officer decision", {"lead":"The Commitments Officer must give reasons, for example by endorsing the attached consensus report without reservation (G14.6).","items":[["Aims","The selected project pursues the aims stated in the call."],["Cost and content","The project's cost and content appear reasonable."],["Funds","Funds are available to finance the project."]],"ordered":false,"must":["The Commitments Officer must decide only on a reasoned and documented consensus report, and ask the Committee to amend or amplify it otherwise."]}],
        ["Unsuccessful call", {"lead":"After an unsuccessful call the Commitments Officer may award no grant or launch a new call, recorded in Template G14.7A.","items":[["No proposal received","The Commitments Officer may decide without prior action by the Committee."],["No proposal meets the criteria","The Commitments Officer decides only after the Committee has analysed the proposals."]],"ordered":false}],
        ["Informing applicants", {"lead":"The Commitments Officer informs all applicants of the outcome in writing.","items":[["Successful (G14.8)","Inform promptly; the Rule sets no deadline."],["Excluded or ineligible (G14.9A)","Within 15 calendar days of the successful applicants."],["Not selected (G14.9B)","Within 15 calendar days of the successful applicants."]],"ordered":false,"must":["The Commitments Officer must inform unsuccessful applicants no later than 15 calendar days after the successful ones.","Each letter to an unsuccessful applicant must explain how to enquire and give a cut-off date of at least 7 calendar days."],"tip":"Inform all applicants on the same day and direct their questions to the Co-ordinator."}]
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
        ["Route of a challenge", {"lead":"An unsuccessful applicant enquires first, may then complain, and the complaint is screened before any Review Board.","items":[["Enquiry","The applicant asks in writing why it was not selected."],["Reply","The Co-ordinator replies in writing with G15.2."],["Complaint","The applicant complains within 30 calendar days of the reply."],["Manifest error check","The Co-ordinator screens the complaint immediately."],["Review Board","Without a manifest error, the Board examines the complaint."],["Decision","The Commitments Officer decides on measures (G15.7B)."]],"ordered":true}],
        ["Enquiries and replies", {"lead":"Reasons for non-selection are given promptly and in writing, not by telephone.","items":[["Complaint procedure","How to lodge a complaint."],["Inadmissible complaints","Which complaints will not be accepted."],["Address","Where to send a complaint."]],"ordered":false,"must":["The Co-ordinator must check that each enquiry arrived within the deadline (at least 7 days) stated in the letter.","The G15.2 reply must explain the complaint procedure and state the address for complaints."]}],
        ["Lodging a complaint", {"lead":"A complaint is admissible only if it contests how the proposal was examined.","items":[["Prior enquiry","An enquiry must precede the complaint."],["Deadline","Within 30 calendar days of notification of the reply to the enquiry."],["References","The call reference and the proposal's identification number."],["Content","Full particulars of the grievances and all necessary documents."]],"ordered":false,"must":["The Co-ordinator must declare inadmissible (G15.3A) any complaint about the wording of criteria, unless they breach Article 2.","The Co-ordinator must request missing documents in writing (G15.3B) within a stated reasonable time."]}],
        ["Calculating time limits", {"lead":"Time limits run in calendar days from midnight on the day after the triggering act.","items":[["Start","A reply notified at 11 am on the 2nd starts the clock at midnight on the 3rd."],["Counting","Saturdays, Sundays and public holidays count."],["End","A deadline falling on a non-working day moves to the next working day."]],"ordered":true}],
        ["Manifest error check", {"lead":"A manifest error is a gross or clear error in interpreting the facts or in the procedure, such as rejecting a complete proposal as incomplete.","items":[["Co-ordinator","Examines the complaint immediately and alerts the Committee if an error is found."],["Evaluation Committee","Reassesses the proposal and recommends measures."],["Commitments Officer","Decides the measures to redress the error."]],"ordered":true}],
        ["Review Board", {"lead":"Without a manifest error, the complaint goes to a Review Board that checks the evaluation but cannot redo it.","items":[["Members","Representatives of the internal Auditor, the Director of Legal Advice and Public International Law and the Treasurer, none involved in the evaluation."],["Timing","Meets within 30 calendar days of receiving the complaint."],["Scope","Checks that criteria were applied coherently and without discrimination."],["Outcome","May recommend a fresh evaluation by reasoned opinion (G15.7A); the Commitments Officer decides (G15.7B)."]],"ordered":false,"must":["The Co-ordinator must send the complaint and all evaluation documents to the Review Board without delay."]}],
        ["Fraud, corruption and misconduct", {"lead":"The complaints procedure only reviews evaluation errors and is not an inquiry into misconduct.","items":[["Internal Auditor","May receive allegations of fraud, corruption or misconduct."],["Directorate General of Administration","May receive the same allegations and acts under Rule 1327."]],"ordered":false}]
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
        ["Written agreement", {"lead":"A verbal agreement not put into writing is contrary to the Rule.","must":["The parties must sign a written grant agreement."]}],
        ["Model agreement", {"lead":"The DLAPIL model is only a basis and must be adapted to the context, the proposal and any donor requirements.","items":[["G17.2A","Agreement for the Ordinary Budget or Voluntary Contributions."],["G17.2B","Agreement for EU funds."],["G17.2C","Guidance on how to prepare an agreement."]],"ordered":false,"must":["An agreement financed by extra-budgetary resources must reflect the donor's requirements, notably on visibility and eligibility of costs."],"tip":"Consult DLAPIL for a legal opinion on the terms."}],
        ["Content", {"lead":"Every agreement, including for operational grants, sets out the action, the budget, the grantee's obligations and the implementation period.","items":[["Description of the action","Preferably in an annex, including any purchases or sub-grants the grantee will make."],["Estimated budget","Itemised in an annex (G17.2D), with a total equal to the grant amount."],["Reporting obligations","Narrative and financial reporting, using model reports (G17.2E or G17.2F)."],["Implementation period","Defined precisely, since cost eligibility depends on it."]],"ordered":false,"must":["The implementation period must never pre-date the deadline for proposals."],"tip":"Use the budget annex structure as the framework for financial reporting."}],
        ["Amendments", {"lead":"An amendment can use any written format that unambiguously shows both parties' consent.","items":[["By e-mail","Obtain the authorised staff member's agreement first and copy him or her; list the change and ask the grantee to confirm by return."],["By signed document","Both parties sign a document (G17.3) setting out the change."],["Allowed changes","Management matters such as deadlines, contact details or bank details."],["Forbidden changes","Any increase in the total grant amount or change that distorts the initial conditions."]],"ordered":false,"must":["Every amendment must reference the agreement and state which provisions are supplemented or cancelled and replaced."]}],
        ["Third-party liability", {"lead":"The model agreement G17.2A already limits the Organisation's third-party liability.","must":["Every grant agreement must contractually limit the Organisation's third-party liability."]}],
        ["Grants in Ukraine", {"lead":"Grants implemented in Ukraine need an extra security and safety document.","items":[["G17.2H","Annex V on security and safety."],["G17.4","Addendum on security and safety."]],"ordered":false}]
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
        ["Storage of documents", {"lead":"The department that initiated the procedure keeps the complete grant file.","items":[["From","The appointment of the Co-ordinator."],["To","Validation of the supporting documents certifying proper use of the grant."]],"ordered":false,"must":["Each entity's document management table must reflect this record-keeping requirement."]}],
        ["Interpretation", {"lead":"The Rule is interpreted in good faith under Article 19, keeping in mind its spirit and the principles in its Preamble.","must":["Staff should consult DLAPIL on any ad hoc situation, as changing the forms may create a discrepancy with the Rule."],"tip":"Use the guide and its appendices for all award procedures; misuse may lead to an administrative inquiry."}],
        ["Using the templates", {"lead":"Templates contain parts to complete, multiple-choice options and drafting comments.","items":[["Complete","Fill in every element before sending to third parties."],["Clean","Delete comments, blue highlighting and bracketed [XX] options."],["Red parts","Parts for the applicant or grantee are marked in red."]],"ordered":true}]
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
