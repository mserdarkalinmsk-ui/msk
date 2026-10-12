/* Procurement lifecycle content, rewritten from the Council of Europe Procurement Guide (international threshold updated to €184,000). */
(function () {
  "use strict";
  const C = window.FG_CONTENT;

  C.procurementPhases = [
    ["Prepare", ["Foundations", "Roles & Funding", "Market & Suppliers", "Define the Need", "Contract Types", "Thresholds & Procedure"]],
    ["Run the procedure", ["Tender Design", "Terms & Specifications", "Authorise & Launch", "Open & Evaluate", "Negotiate & Award", "Contract Signing"]],
    ["Manage the contract", ["Contract Management", "Contract Execution & Payment", "Performance & Filing"]]
  ];

  C.procurementStages = [
    {
      name: "Foundations",
      remember: "Buying for our own needs means procurement: compete, disclose, refuse gifts.",
      keyFacts: [["Rule No. 1395","procedure rules (20 June 2019)"],["31 January","annual declaration of interests due"],["0","value of gifts you may accept"]],
      example: "A project team wants to pay an NGO to run its own awareness campaign that also promotes Council of Europe values. Because the NGO pursues its own objectives and only costs are covered, this is a grant, not procurement. The correct action is to use a grant agreement under Rule No. 1374, not a tender.",
      title: "Principles, Legal Bases & Ethics",
      lead: "Understand the rules that govern every Council of Europe purchase and the ethical standards expected of everyone involved. Confirm that procurement, not a grant, is the right instrument.",
      source: "Ch. 1.1–1.3",
      understand: "Every purchase of works, goods or services to meet the Organisation's own needs is procurement and must follow one of the procedures in Rule No. 1395.",
      do: "Check that the activity is a purchase rather than financial assistance, and apply the six procurement principles throughout the procedure.",
      check: "Your annual declaration of interests is filed and no conflict of interest, gift or privileged contact with potential bidders exists.",
      sections: [
        ["Legal bases",{"lead":"Three instruments set the rules for every Council of Europe purchase, and DLAPIL templates replace the older model contracts.","items":[["Financial Regulations, Articles 40 to 43","Set out the three types of contract, the three main procedures and the role of the Tenders Board."],["Rule No. 1395 of 20 June 2019","Details each procedure, from preparing the tender file to signing the contract. An annotated version is on the Tenders Board's web page."],["Instructions No. 59 and No. 60","Cover consultants' contracts and outsourcing contracts respectively and remain relevant as background."]],"must":["Buyer entities should use the DLAPIL templates instead of the model contracts in Instructions No. 59 and No. 60, and should not use the model invoice."]}],
        ["The six principles",{"lead":"Six principles from Rule No. 1395 guide every procurement procedure: competition is the norm and direct award the exception.","items":[["Periodic competition","Competitive procedures are launched at regular intervals so that other suppliers also have the chance to compete."],["Objectivity","The buyer entity acts without partiality, bias or outside influence, with neutral tender documents and impartial scoring."],["Transparency","Criteria and rules are available to all tenderers, results are published and reasons for the award are given on request."],["Non-exclusivity","The Council avoids recurring, exclusive relationships with suppliers and contracts of excessive length."],["Equal treatment","All tenderers follow the same rules and receive the same information at each stage."],["Non-discrimination","Tenderers in a comparable situation are not treated differently because they belong to a particular group, especially in the conditions for taking part."]]}],
        ["Grants v. procurement",{"lead":"Buying for the Organisation's own needs is procurement; financing a grantee's own project is a grant.","items":[["Procurement contract","Used whenever the Organisation buys works, goods or services for its own needs, whatever the contractor's status. The price includes a profit margin and there are no reporting requirements."],["Grant agreement","Used when the Organisation gives financial assistance to a grantee for the grantee's own project (Article 43 bis of the Financial Regulations and Rule No. 1374). It covers part of the grantee's costs and requires extensive reporting."]]}],
        ["Values and ethics",{"lead":"Everyone involved in procurement follows the Code of Conduct and the Purchasing Code of Ethics (25 October 2005), and the Council has a no-gift policy.","items":[["Avoid conflicts of interest","Do not take part in a procedure where your own interests could conflict with the Council's."],["Keep tenders confidential","Do not disclose the content of offers."],["Keep professional relationships","Maintain professional, respectful and trusting relationships with suppliers."],["Apply objective criteria","Select suppliers on objective and impartial criteria."],["Refuse all benefits","Refuse any benefit, gift or solicitation from suppliers, whatever its value."]],"must":["Secretariat members involved in procurement must submit a declaration of interests every year by the end of January, or within one month of a change (Rule No. 1282)."]}],
        ["Fraud and reporting",{"lead":"Suspected fraud, corruption or other wrongdoing is reported at once under the Speak Up Policy.","must":["Staff must report suspected fraud, corruption or other wrongdoing immediately to the DIO.","Staff must not give potential bidders privileged technical or financial information before the call is public.","Buyer entities must not write specifications restrictively to discourage competition."]}],
        ["Audits and risks",{"lead":"Four kinds of auditor examine procurement, and non-compliance creates institutional, financial, ethical, reputational and operational risks.","items":[["DIO","Internal audit checks compliance and performance."],["External auditor","Certifies the accounts and may carry out performance audits."],["European Union","Audits actions it funds."],["Donor-mandated auditors","Third-party auditors appointed by donors."]],"must":["The Ordinary Budget must cover any ineligible expenditure that donors reclaim after a non-compliant procedure."],"tip":"Auditors look at transparency, competition, thresholds, reasons for direct awards, validation workflows, declarations of interest and archiving, so keep these well documented."}]
      ],
      warning: "When non-compliant procedures are funded by extrabudgetary resources, the donor can declare the expenditure ineligible and demand a refund, which is then charged to the Ordinary Budget.",
      best: "Use the procurement principles as a guiding thread at every stage. When in doubt on an ethics question, consult the Ethics Officer before contacting a supplier.",
      checklist: [
        "Confirm the activity is a purchase, not a grant",
        "Identify the applicable rules: Financial Regulations Art. 40–43 and Rule No. 1395",
        "Submit or update your declaration of interests",
        "Refuse any gift or hospitality from suppliers",
        "Report any suspicion of fraud to the DIO",
        "Keep pre-launch information confidential from potential bidders"
      ],
      links: ["Roles & Funding", "Thresholds & Procedure"]
    },
    {
      name: "Roles & Funding",
      remember: "Operations prepare, the CCM validates, the Tenders Board controls above €184,000.",
      keyFacts: [["€184,000","Tenders Board competence"],["€55,000–€184,000","DLAPIL review (extrabudgetary)"],["48 h","Procurement Unit first response"]],
      example: "A field office plans a €40,000 IT equipment purchase for a ministry under an EU-funded project. IT purchases need DIT approval. The correct action is to request permission via MSA 1002, check the budget line, and appoint authorised staff members in writing before launch.",
      title: "Actors, Funding & Types of Purchases",
      lead: "Know who prepares, validates, controls and supports each step, and how the funding source and type of purchase affect the procedure.",
      source: "Ch. 2.1–2.5",
      understand: "Procurement is decentralised: each MAE buys for its own needs, keeping operational functions separate from validation and financial management functions.",
      do: "Identify your CCM, appoint authorised staff members in writing and contact DLAPIL, the Procurement Unit or specialist directorates early.",
      check: "Authorised staff members are designated in writing by the CO or CCM before they open or assess offers.",
      sections: [
        ["Segregation of duties",{"lead":"Each MAE runs its own procurement, with operational functions kept separate from validation and financial functions.","items":[["Operational functions","Defining needs, drafting tender documents and assessing deliverables."],["Validation and financial functions","Budgetary verification, PO validation and transfers."]],"must":["Each MAE must ensure that the same person does not perform both operational and validation functions."],"tip":"Roles follow the Financial Management Framework, the general delegation framework CM/Res(2023)1 and each MAE's delegations."}],
        ["Buyer entity and authorised staff",{"lead":"The buyer entity runs the whole process, from forecasting the need to executing the contract.","must":["Only authorised staff members designated by the CO or CCM may open offers, assess offers and negotiate (Rule No. 1395, Article 3.2.d)."],"tip":"Delegate this authority in writing, at the latest when the CCM approves the tender documents, using the standard e-mail paragraph."}],
        ["Control and validation bodies",{"lead":"Four bodies control and validate procurement decisions.","items":[["CO","Authorises expenditure and usually delegates to CCMs."],["CCM","Validates the choice of procedure, tender files, awards and contracts, assisted by an ACCM and a FOMA."],["Tenders Board","Ensures compliance for all contracts above €184,000 excluding VAT, decides on the scope and publication of international calls and scrutinises bid analyses."],["DIO","Audits and investigates."]]}],
        ["Support services",{"lead":"Four services support buyer entities with legal, practical, Board and payment matters.","items":[["DLAPIL","Handles all legal questions, provides templates and training and, since 1 February 2025, performs the Legal Compliance Review for extrabudgetary-funded procedures between €55,000 and €184,000."],["DGA Procurement Unit","Gives non-legal support such as market analysis, sourcing, e-procurement and analysis tables, answering within 48 hours at procurement@coe.int."],["Tenders Board Secretariat","Checks files before they go to the Board."],["TPA","Registers suppliers in FIMS and pays invoices."]]}],
        ["Funding sources",{"lead":"Procurement is funded either from the Ordinary Budget or from extrabudgetary resources.","items":[["Budgetary resources","Come from the four-year Programme and Budget with a biennial cycle; procurement is planned on forecasts per budget line approved by the CO."],["Extrabudgetary resources","Include EU funds under joint programmes and voluntary contributions, earmarked or non-earmarked, including the Human Rights Trust Fund."]],"must":["In co-operation projects, procurement must match the approved description of the action and budget, which can be difficult to amend."]}],
        ["Types of purchases",{"lead":"Some types of purchase carry specific rules or need approval from a specialist directorate.","items":[["Intellectual services","Knowledge-based, non-recurrent creations of the mind that always raise intellectual property issues."],["Communication","Purchases need DC approval."],["IT","Purchases need DIT approval (MSA 1002), and cloud deliverables require the Cloud Checklist."],["Works on buildings","Go through DGS."],["Travel and accommodation","Booked directly for participants, they are outside Rule No. 1395 (Article 7); bought through an agency, they are not."]],"must":["Buyer entities must avoid disguised employment, for example by not giving consultants full-time or part-time workloads, CoE e-mail addresses or equipment."]}],
        ["AI and co-operation projects",{"lead":"Suppliers declare their use of AI, and co-operation projects follow specific planning roles.","must":["Suppliers must declare any use of AI in the DLAPIL AI questionnaire, which is saved with the file.","Any difference between national and international consultants may only be based on expertise or language skills, never on nationality or residence."],"items":[["DPC","Co-ordinates programming and extrabudgetary resources."],["External offices","Prepare forecasts that the CCM validates."]]}]
      ],
      warning: "Authority for authorised staff members must be delegated in writing by the CO or CCM before any opening, assessment or negotiation task is performed.",
      best: "Check with the DPC or the Procurement Unit whether a framework contract or framework agreement already covers events, translation, interpretation, transport or printing in the country concerned.",
      checklist: [
        "Identify the CO/CCM responsible for the purchase",
        "Designate authorised staff members in writing",
        "Confirm the funding source: Ordinary Budget or extrabudgetary",
        "Check the purchase matches the approved project budget lines",
        "Obtain DIT, DC or DGS approval where the category requires it",
        "Plan the AI questionnaire for intellectual deliverables"
      ],
      links: ["Foundations", "Define the Need", "Authorise & Launch"]
    },
    {
      name: "Market & Suppliers",
      remember: "Source widely, share nothing in advance.",
      keyFacts: [["3","suppliers minimum in competitive bidding"],["50,000+","suppliers already in FIMS"],["Art. 5","CEI is not a procurement procedure"]],
      example: "A team always invites the same three consultants for gender-equality training. Auditors would see this as a breach of periodic competition. The correct action is to publish a call for expressions of interest and use the shortlist it produces for the next call for tenders.",
      title: "Market Analysis & Supplier Sourcing",
      lead: "Study the market and identify capable suppliers before drafting the tender, so that the call attracts enough good-quality offers.",
      source: "Ch. 4.2–4.3",
      understand: "Market analysis and sourcing increase competition, reveal innovative solutions and risks, and support periodic competition and non-discrimination.",
      do: "Use internal and external sources, existing contracts, the suppliers database and, where useful, a call for expressions of interest.",
      check: "No potential bidder has received information that would give them an advantage in the future procedure.",
      sections: [
        ["Why analyse the market",{"lead":"A market analysis is essential when the goods, services or works have not been bought before.","items":[["Find new suppliers","Identifies suppliers beyond the usual ones."],["Fit the market","Helps tender documents match what the market offers."],["Reveal alternatives","Brings out alternative or innovative proposals."],["Highlight risks and opportunities","Shows what could go wrong or be improved."]],"tip":"Analyse the market before a direct award too, to check that better suppliers or solutions are not available."}],
        ["Sources",{"lead":"Use sources that match the type of purchase, plus the Council's own records.","items":[["Works, goods and technical services","Trade journals, chambers of commerce, embassies, catalogues and end users."],["Intellectual consultancy","Academic platforms such as researchgate.net, academia.edu and scholar.google.com, specialised journals, professional associations and LinkedIn."],["Internal sources","Existing contracts lists, previous lists of invitees and market studies supported by the Procurement Unit."]]}],
        ["Procurement strategy",{"lead":"A good strategy produces diverse offers, a proportionate workload and the best value for money.","items":[["Lots","Divide the contract into lots to widen competition."],["Framework contracts","Use them for recurring needs."],["Sharing","Share existing contracts with other entities."]],"must":["Buyer entities must make sure that SMEs and not-for-profit, minority-owned, women-owned and disability-inclusive suppliers are not excluded."]}],
        ["Identifying new suppliers",{"lead":"FIMS holds over 50,000 suppliers but few new ones are added, so the same suppliers often bid.","must":["In a competitive bidding procedure, the buyer entity must invite at least three suppliers (Rule No. 1395, Article 21.2)."],"tip":"Choose the invitees through targeted sourcing, not a passive internet search, so that you receive three good-quality bids rather than just meeting the rule."}],
        ["Call for expressions of interest",{"lead":"A CEI (Rule No. 1395, Article 5) is not a procurement procedure but a tool to list potential suppliers for future procedures.","items":[["Where to publish","The CoE website, e-procurement, the OJEU or social networks."],["No obligation to invite","There is no need to invite every listed supplier or to justify not inviting someone."],["No obligation to tender","There is no need to launch a call afterwards."]],"tip":"External auditors strongly recommend CEIs for consultancy."}],
        ["Suppliers database",{"lead":"The Procurement Unit's intranet holds an optional shared suppliers database by category, approved by the Data Protection Officer.","must":["Registering a contracted supplier in FIMS requires an MSA 4002 processed by TPA."],"tip":"The Council does not use blocklists, but an optional exclusion criterion covers suppliers who failed contractual obligations with the Council in the previous three years."}]
      ],
      warning: "When meeting potential suppliers, never share information about a future call for tenders that could give them an advantage. Consult DLAPIL or the Procurement Unit if in doubt.",
      best: "Carry out the market study first and then the CEI, and include the CEI's results in the market study. The Procurement Unit can also consult the NPIO network of 40+ international organisations.",
      checklist: [
        "Check the framework contracts and agreements database for an existing contract",
        "Consult internal and external market sources",
        "Consider lots or a framework contract in your strategy",
        "Launch a call for expressions of interest where useful",
        "Search the suppliers database by category",
        "Record why invited suppliers are relevant to the need"
      ],
      links: ["Define the Need", "Tender Design"]
    },
    {
      name: "Define the Need",
      remember: "Plan backwards from the deadline; one procedure per type of need.",
      keyFacts: [["2 years","Ordinary Budget period of reference"],["Whole project","incl. extensions for project-based needs"],["3 weeks","minimum publication for international calls"]],
      example: "A project expects 12 expert reports over its three-year life. Buying them one at a time would artificially split the need. The correct action is to estimate all 12 reports over the full project duration, including possible extensions, and run a single procedure.",
      title: "Define & Group Procurement Needs",
      lead: "Anticipate and describe the need precisely over the whole period of reference, grouping similar needs into as few procedures as possible.",
      source: "Ch. 4.4",
      understand: "A clearly defined need over the correct period of reference determines the type of contract, the threshold and the procedure.",
      do: "Plan backwards from the delivery date, group similar needs for the whole project or budget cycle, and consult the relevant in-house experts.",
      check: "All foreseeable similar needs for the period of reference are covered, ideally by one procedure per type of need.",
      sections: [
        ["Plan early",{"lead":"Identify needs as early as possible and build a reverse schedule from the required completion date.","items":[["Tenders Board approval","Allow time for the Board to authorise the launch and the results."],["Publication","Allow at least three weeks for international calls."],["VAT exemption","Allow time for the exemption procedures."]],"tip":"A procedure may be launched before the project formally starts if the tender documents state that the contract will only be awarded once it begins."}],
        ["Key questions",{"lead":"Answer a set of questions about the need before drafting anything.","items":[["Deliverable and frequency","What is expected and how often is it needed?"],["Budget and threshold","What is the estimated overall budget and which threshold applies?"],["Existing contracts","Does an existing transversal contract already cover the need?"],["Specific requirements","Payment terms, delivery time, penalties and language."],["Total cost of ownership","Consider the whole cost, not only the purchase price."]]}],
        ["Consult in-house expertise",{"lead":"Specialist directorates confirm the need is not already covered in-house and help validate the approach.","items":[["DGS","Works and buildings."],["DIT","IT goods or services."],["DC","Communication."],["ITEM","Multimedia."]],"must":["The buyer entity must consult the relevant directorate before tendering."]}],
        ["Co-operation projects",{"lead":"Co-operation projects can buy project by project or for a whole sector.","items":[["Project-based approach","Covers the needs of one project for its full duration, including possible extensions."],["Sector-based approach","Covers common needs of several projects or a sector; it requires a framework contract or agreement and an international public call for tenders."]],"must":["Under a sector-based approach, each order or call-off must be issued within one project, and the relevant CCMs must be consulted during drafting and informed of the results before any order is placed."]}],
        ["Ordinary Budget",{"lead":"For Ordinary Budget purchases, consider the whole two-year budget cycle and cover similar needs with a minimum number of procedures.","must":["Buyer entities must not repeat one-off purchases to meet a structural need."],"tip":"Ad hoc procedures for unforeseeable needs remain possible."}]
      ],
      warning: "Last-minute purchases can only be justified in exceptional circumstances where the urgency is not attributable to the buyer entity.",
      best: "Use a reverse schedule, working back from the completion date, to set milestones and a realistic start date for the procedure.",
      checklist: [
        "Describe the expected deliverables and frequency",
        "Set the period of reference (project or budget cycle)",
        "Choose project-based or sector-based approach",
        "Estimate the total budget for all similar needs",
        "Consult DGS, DIT, DC or ITEM where relevant",
        "Build a reverse schedule including approvals and VAT steps"
      ],
      links: ["Market & Suppliers", "Contract Types", "Thresholds & Procedure"]
    },
    {
      name: "Contract Types",
      remember: "Fixed need: one-off. Repeating units: framework contract. Variable: framework agreement.",
      keyFacts: [["4 years","maximum duration (5 exceptionally)"],["3","minimum suppliers per framework agreement lot"],["2–3 months","maximum run-on after end date"]],
      example: "A project needs a cybercrime trainer repeatedly, in one-hour, half-day and full-day formats, in Strasbourg or online. The volume is unknown but the units can be defined. The correct action is a framework contract with a price list per format and a pooling system for consultants.",
      title: "One-off, Framework Contract or Framework Agreement",
      lead: "Choose the contract type that matches how well defined and how repetitive the need is. The contract type does not determine the procedure.",
      source: "Ch. 3",
      understand: "Use a one-off contract for defined, non-recurring needs, a framework contract for recurring unit-based needs, and a framework agreement for variable or complex needs.",
      do: "Match the need to the contract type and decide the ordering system (ranking or pooling) or the call-off rules before launch.",
      check: "The contract type fits the need, its duration does not exceed four years (five exceptionally), and it does not overlap existing contracts.",
      sections: [
        ["Choosing the three types",{"lead":"A contract is not a procedure: the procedure depends on value, while the type of contract depends on the need.","items":[["One-off contract","Use when the need is quantifiable, definable and very unlikely to recur. One supplier (possibly a consortium); no orders, as price, specifications and quantities are fixed; lasts until both parties complete their obligations and cannot be renewed; control: a delivery deadline per deliverable, signed by the CCM."],["Framework contract","Use when the need can be defined as units and recurs often but cannot be fully quantified. One supplier (simple) or several (multiple, ranked or pooled); the buyer entity issues order forms at fixed unit prices; maximum four years, five exceptionally; control: the CCM signs each order after the PO is raised."],["Framework agreement","Use when the need is regular but variable, uncertain or complex. At least three suppliers per lot; each need goes to a call-off (mini-competition) approved by the CCM; maximum four years, five exceptionally; control: the CCM signs each call-off, and call-offs above €184,000 go to the Tenders Board."]]}],
        ["One-off contracts",{"lead":"A one-off contract is made with a single supplier, possibly a consortium, and may be split into lots.","must":["A one-off contract must define the price, specifications and quantities.","A one-off contract must state a delivery deadline for each deliverable and cannot be renewed.","Buyer entities must not use repeated one-off contracts for the same need, as this is prohibited artificial splitting."],"tip":"A one-off contract lasts until both parties have completed their obligations."}],
        ["Framework contracts",{"lead":"A framework contract fixes unit prices for defined items or time-based units, and the Council is not obliged to buy.","items":[["Simple","One supplier."],["Multiple with ranking","Orders go to suppliers in ranked order; recommended for goods and general services."],["Multiple with pooling","The buyer chooses a supplier for each order, justified in a note approved by the CCM; better for intellectual services."]],"must":["A multiple framework contract tender must state whether ranking or pooling applies.","Under a framework contract, only listed items can be ordered, and no order can be created after the end date."]}],
        ["Framework agreements",{"lead":"A framework agreement creates a pool of at least three suppliers per lot, selected on competence without price competition.","items":[["Select the pool","Choose at least three suppliers per lot on competence."],["Approve each call-off","The CCM approves each call-off before publication."],["Run the mini-competition","Each need is put out to a call-off among the pool."]],"ordered":true,"must":["Any call-off with a single value above €184,000 must go to the Tenders Board."],"tip":"Framework agreements are rarely recommended for estimated expenditure below €184,000, because each need requires a mini-competition."}],
        ["Duration and sharing",{"lead":"Framework contracts and agreements have no minimum duration but should not exceed four years, or five exceptionally, to respect non-exclusivity.","must":["Orders or call-offs must be created before the end date and usually run no more than two to three months afterwards.","In projects, delivery must fall within the implementation period."],"tip":"Framework contracts and agreements concluded through an international call are available to all Council of Europe entities; one-off contracts are not."}]
      ],
      warning: "Once the tender is published, the ordering method (ranking, pooling, rota or quotas) cannot be changed, so define it carefully in the tender documents.",
      best: "Keep the number of suppliers in a multiple framework contract reasonable. Dividing the estimated budget by the number of consultants shows whether each supplier's expected turnover is credible.",
      checklist: [
        "Decide whether the need is one-off, recurring or variable",
        "Choose simple or multiple framework contract",
        "Choose ranking or pooling and state it in the tender",
        "Set the maximum number of suppliers to select",
        "For framework agreements, plan at least three suppliers per lot",
        "Keep duration within four years (five exceptionally)",
        "Check for overlap with existing framework contracts"
      ],
      links: ["Define the Need", "Thresholds & Procedure", "Contract Management"]
    },
    {
      name: "Thresholds & Procedure",
      remember: "Total foreseeable value decides the procedure — never split.",
      keyFacts: [["€2,000 / €6,000","direct award ceiling (goods / intellectual)"],["€184,000","international public call and Tenders Board"],["€10,000","public prices purchase ceiling"]],
      example: "A team estimates €170,000 for translations over four years, but the project may be extended. The value is close to €184,000 and could exceed it. The correct action is to launch an international public call for tenders from the start, because the Tenders Board cannot approve a launch retroactively.",
      title: "Calculate the Threshold & Choose the Procedure",
      lead: "Estimate the total value of the need to determine whether a direct award, a competitive bidding procedure or an international public call for tenders applies.",
      source: "Ch. 4.5–4.7",
      understand: "The threshold is the estimated total value of the need, excluding VAT, over the full contract life, including renewals, lots and all orders or call-offs.",
      do: "Calculate per need, not per supplier or year, and choose the procedure matching the value and funding source.",
      check: "No need has been split artificially, and if the value may approach €184,000, an international public call for tenders is chosen.",
      sections: [
        ["Calculating the threshold",{"lead":"The threshold is set by the total estimated value before VAT over the full life of the contract, not per year.","items":[["Full duration","Include all renewals, tranches and options (works)."],["All lots","Add the value of every lot."],["All orders or call-offs","Include every possible order or call-off."],["Multiple contracts","Calculate the value regardless of the number of suppliers."],["Percentage-based fees","Use the total value of the service contract."]]}],
        ["Direct award",{"lead":"A direct award is a contract without competition, allowed only below small amounts or in exceptional cases.","items":[["Low value","Up to €2,000 (goods, general services, works) or €6,000 (intellectual services), on a memorandum to the CCM justified by the supplier's expertise (Rule No. 1395, Article 22.4)."],["Unforeseen urgency","Urgency not attributable to the buyer (Financial Regulations Article 40.3.c, Rule Article 22.1.a)."],["Technical requirements","Only one supplier can meet the technical need."],["Considerations of fact or law","Facts or legal rights make competition impossible."]],"must":["The CCM decides on exceptional direct awards below €184,000, and the Tenders Board decides from €184,000.","Extrabudgetary-funded direct awards from €55,000 to €184,000 must first receive a DLAPIL Legal Compliance Review."]}],
        ["Competitive bidding procedure",{"lead":"Competitive bidding applies between €2,000 (or €6,000) and €184,000, under the sole responsibility of the CCM.","must":["The buyer entity must invite at least three suppliers, or nine for a multiple framework contract with a pool of three.","Extrabudgetary-funded competitive bidding procedures from €55,000 to €184,000 must receive a Legal Compliance Review.","If all offers exceed €184,000, the buyer entity must cancel the procedure and launch an international call."]}],
        ["International public call for tenders",{"lead":"An international call applies when the total value is estimated to exceed €184,000, or if there is even a slight risk of reaching it.","must":["The Tenders Board must authorise the launch, on request from the CCM with a summary memo to the Tenders Board Secretary.","An international call must allow at least three weeks for submission.","The Tenders Board cannot approve a launch retroactively."]}],
        ["Other procedures",{"lead":"Two further procedures exist for hard-to-define needs and small purchases.","items":[["Competitive dialogue","For needs where the technical solution is hard to define, or a proof of concept. It uses a descriptive document, a published notice and rounds of discussion that may eliminate bidders; the Tenders Board validates the results."],["Public prices comparison","Under Article 21.2 of Rule No. 1395, a competitive bidding purchase below €10,000 excluding VAT may compare the public prices of three or more suppliers instead of inviting tenders."]],"must":["Screenshots of the compared public prices must be archived."]}],
        ["Purchases for third parties",{"lead":"Goods or services for project beneficiaries are bought only through one-off contracts, by competitive bidding or international call depending on value.","items":[["Tender file","DLAPIL tailor-made version, available on request."],["Tripartite contract","Signed by the Council, the supplier and the beneficiary."],["Tripartite act of acceptance","Ownership transfers to the beneficiary when it is signed."],["Declaration of agreement","Completes the set of templates."]],"tip":"Consult DIT on IT requirements."}],
        ["Specific risks",{"lead":"Three practices can push a purchase into the wrong procedure.","items":[["Artificial splitting","Dividing purchases without objective reason to stay below thresholds; it is prohibited and a red flag for fraud."],["Underestimating expenditure","If a later procedure covers needs that could have been included earlier, the threshold is calculated on the combined amount."],["Contract amendments","Amendments may push the total above the original threshold."]]}]
      ],
      warning: "Never split requirements or shorten contract terms to stay below a threshold. Artificial splitting is prohibited and treated as a red flag for fraud.",
      best: "If the estimate is close to €184,000 or may grow through extensions, amendments or other directorates using the contract, launch an international public call for tenders from the outset.",
      checklist: [
        "Add up all lots, renewals, orders and call-offs before VAT",
        "Calculate per need over the whole period of reference",
        "Apply €2,000 / €6,000 for direct award",
        "Use competitive bidding from €2,000 / €6,000 up to €184,000",
        "Use an international public call above €184,000",
        "Plan the Legal Compliance Review for extrabudgetary funds from €55,000 to €184,000",
        "Use the procedure selection tool on the Procurement page"
      ],
      links: ["Contract Types", "Authorise & Launch", "Tender Design"]
    },
    {
      name: "Tender Design",
      remember: "Publish the criteria once; never change them afterwards.",
      keyFacts: [["20 points","minimum weight for price, in principle"],["Out of 10","score per technical criterion"],["15–35%","bid as a share of turnover"]],
      example: "A tender for a 1,000-person conference asks for prior experience organising events. That criterion is too vague to assess. The correct action is to require proven experience of events of comparable size, with a list of references as the supporting document.",
      title: "Tender File, Lots & Assessment Criteria",
      lead: "Build the tender package and set the exclusion, eligibility and award criteria that will decide the outcome.",
      source: "Ch. 4.8.1–4.8.3",
      understand: "The tender file and act of engagement are mandatory for competitive procedures, and the criteria cannot be changed once the call is published.",
      do: "Download fresh DLAPIL templates and set clear, proportionate eligibility criteria and weighted award criteria.",
      check: "Criteria are objective, measurable and non-discriminatory, eligibility and award criteria do not overlap, and all weightings are published.",
      sections: [
        ["Tender package and templates",{"lead":"The tender package contains at least the tender file and the act of engagement, built from a fresh DLAPIL template.","items":[["Tender file","The terms of reference and the tender rules."],["Act of engagement","A ready-to-sign contract containing bidders' statutory declarations."]],"must":["Buyer entities must always download a new DLAPIL template, chosen by procedure, contract type, lots and language.","Documents published in two languages must state which version prevails, and machine translations must carry the standard disclaimer."],"tip":"DGA and EDQM have their own templates."}],
        ["Division into lots",{"lead":"Lots split a tender into separate competitions in the same call, increasing competition and letting specialised suppliers bid.","must":["Lots may only be used if each lot can be awarded to a different supplier.","The procedure is determined by the total value of all lots."],"tip":"Avoid overlapping lots, and do not use lots when a single supplier is needed."}],
        ["Exclusion criteria",{"lead":"The exclusion criteria in Appendix I to Rule No. 1395 apply to every purchase and cannot be deleted or changed, only supplemented.","items":[["Criminal convictions","Final judgment for participation in a criminal organisation, corruption, fraud, money laundering, terrorist financing or offences, child labour or trafficking in human beings."],["Insolvency","Bankruptcy, liquidation, insolvency or a similar procedure."],["Professional misconduct","A final judgment for an offence affecting professional integrity or serious misconduct."],["Unpaid taxes or contributions","Failure to pay social security contributions, taxes and dues."],["Shell companies","An entity created to circumvent tax, social or other legal obligations."],["Mismanagement of funds","Involvement in mismanagement of Council of Europe or public funds."],["Conflict of interest","Being, or appearing to be, in a conflict of interest."],["Retired staff","Retired staff and staff who left under an early departure scheme."],["Current staff","People employed by the Council now or on the launch date."],["Past contract failure (optional)","Failure to fulfil a Council contract in the previous three years leading to refused payment or termination."],["Restrictive measures","UN Security Council or EU restrictive measures, including those on a legal person's owners or executives."]],"tip":"The signed declaration of agreement in DLAPIL acts of engagement serves as the declaration; e-procurement users confirm it online."}],
        ["Eligibility criteria",{"lead":"Eligibility criteria set the minimum financial, economic, technical or professional capacity needed to perform the contract.","must":["Each eligibility criterion must be clear, objective, verifiable, proportionate and answerable with yes or no, with a defined supporting document."],"items":[["Vague terms","Do not use words such as sufficient or relevant."],["Council-only experience","Do not require experience limited to Council of Europe projects."],["Over-prescription","Do not set overly prescriptive requirements."],["Nationality","Do not require a nationality."]],"tip":"As a guide, the bid should represent between 15% and 35% of the bidder's turnover."}],
        ["Award criteria",{"lead":"Award criteria score quality and price to find the best value for money, and must not repeat eligibility criteria.","items":[["Methodology","How the bidder will do the work."],["Understanding of the need","How well the bidder grasps the objective."],["Work schedule","Whether the timing is realistic."],["Team","The skills of the people proposed."],["Price","In principle at least 20 points, and weighted higher the more standard the service."]],"must":["Weightings, including sub-criteria, must be published and cannot be changed."]}],
        ["Minimum scores",{"lead":"A minimum score can limit who is invited to negotiations or included in a framework contract pool.","must":["Any minimum score must be stated in the tender file.","Without a minimum score, all eligible suppliers up to the announced maximum number must be admitted to the pool."]}]
      ],
      warning: "Assessment criteria and their weightings cannot be modified or subdivided once the call for tenders is published.",
      best: "Keep eligibility requirements proportionate. Lower experience or turnover requirements attract new and innovative suppliers, and you can cap financial dependence instead of demanding a high turnover.",
      checklist: [
        "Download new tender file and act of engagement templates from DLAPIL",
        "Decide on lots and avoid overlaps",
        "Keep all exclusion criteria from Appendix I",
        "Add the restrictive measures criterion",
        "Define yes/no eligibility criteria with supporting documents",
        "Weight award criteria, with price at least 20 points",
        "State any minimum score in the tender file"
      ],
      links: ["Terms & Specifications", "Open & Evaluate"]
    },
    {
      name: "Terms & Specifications",
      remember: "Describe the objective, not the means; keep the three non-negotiable clauses.",
      keyFacts: [["180 days","offer validity"],["3 weeks","minimum international submission period"],["3 months","usual notice period for tacit renewal (minimum 1 month)"]],
      example: "A hotel will only sign its own contract terms, which give jurisdiction to national courts. The correct action is to accept the hotel's terms only if they are balanced and include the Council's clauses on disclosure, use of the name and logo, and disputes. If the hotel refuses, the CCM decides and records the decision.",
      title: "Tender Rules, Prices & Contract Terms",
      lead: "Set the rules for submission, the financial offer format, duration, renewal and legal conditions, and write specifications based on objectives.",
      source: "Ch. 4.8.4–4.8.12",
      understand: "Tender rules, prices, duration, renewal and conditions fixed in the tender define the future contract and limit later changes.",
      do: "Complete each part of the act of engagement and tender file deliberately, consulting DLAPIL for non-standard legal conditions.",
      check: "Deadlines, offer validity, the price format, renewal clause, specific conditions and the three non-negotiable clauses are all in place.",
      sections: [
        ["Tenderers and submission",{"lead":"Decide who may bid and how offers are submitted, and keep offers valid for 180 calendar days from the deadline.","items":[["Natural persons","Decide whether individuals may bid or only legal persons and consortia."],["Consortia","Members are jointly and severally liable."],["Subcontracting","Always requires Council approval."]],"must":["Late offers are inadmissible.","International calls must allow at least three weeks, with offers sent to cdm@coe.int unless e-procurement is used.","When e-procurement is used, offers received outside the platform are excluded."]}],
        ["Act of engagement and financial offer",{"lead":"The act of engagement holds the supplier and bank details, financial offer, declaration of agreement, signature boxes and legal conditions.","must":["A bidder that fails to complete or sign the act of engagement is normally excluded automatically.","A missing financial offer cannot be completed after opening."],"items":[["Goods and general services","Use deliverable-based units in framework contracts."],["Intellectual services","Use time-based units in framework contracts."]],"tip":"Add the clause allowing an hourly fee to be calculated as the daily fee divided by 8."}],
        ["Prices and revision",{"lead":"Give quantities or estimated volumes and a detailed price table so that offers can be compared.","must":["Any price update or revision must be provided for in the tender, and a revision under such a clause is recorded in a document signed by both parties, not an amendment."],"tip":"Link revisions to a relevant official index with a margin, and avoid exclusion levels (maximum prices) unless there is a strong objective reason such as a donor cap."}],
        ["Duration and renewal",{"lead":"Decide before publication how long the contract lasts and whether it can be renewed.","items":[["Not renewable","The contract ends at its term."],["Renewable by written agreement","Both parties sign a renewal before expiry."],["Renewable tacitly","The contract renews unless a party objects; best for framework contracts and agreements."]],"must":["A one-off contract must have a delivery deadline.","A multi-year contract should last no more than four years, or five in specific circumstances.","The notice period to object to tacit renewal is usually three months and must never be less than one month."]}],
        ["General Conditions and non-negotiable clauses",{"lead":"The General Conditions, called legal conditions in DLAPIL templates, cover VAT, confidentiality, data protection, payment and disputes; three clauses are non-negotiable.","items":[["Disclosure of contract terms","The Council may disclose the terms for audit, governance and transparency."],["Use of the Council's name and logo","The supplier may not use them without permission."],["Disputes","Disputes are settled by arbitration."]],"must":["A supplier's own terms, for example a hotel's, may be accepted only if they are balanced and include the three non-negotiable clauses."],"tip":"Internet purchase terms can be accepted exceptionally under the CCM's documented responsibility."}],
        ["Specific conditions",{"lead":"Technical or large-scale purchases use supplementary general conditions plus specific contractual conditions.","items":[["Intellectual services","Supplementary general conditions for consultancy and similar work."],["Supplies and services","Supplementary general conditions for goods and services."],["Works","Supplementary general conditions for building works."],["IT","Supplementary general conditions for IT purchases."]],"tip":"Add specific conditions such as indices, warranty, penalties or building access with the Procurement Unit's help, and set penalties high enough to be useful but not so high that they discourage bids."}],
        ["Technical specifications",{"lead":"Specify the objective to be achieved, not the means.","items":[["No brand names","Avoid them or add or equivalent."],["Keep content separate","Do not mix administrative and technical content."],["Level the field","Give enough information so that previous suppliers have no advantage."],["Allow variants","Consider variants and avoid over-quality."],["Whole cost","Take account of total cost of ownership, warranty and maintenance."],["Measurable outputs","Define them to support performance monitoring and penalties."]]}]
      ],
      warning: "Never accept contract terms without the three non-negotiable clauses (disclosure, name and logo, disputes) unless the CCM takes the documented decision described in the guide.",
      best: "For framework contracts and agreements, choose tacit renewal. It is far easier to manage than renewal by written agreement, especially with many suppliers.",
      checklist: [
        "Define eligible tenderer types and subcontracting rules",
        "Set the submission deadline (at least three weeks for international calls)",
        "Confirm 180-day offer validity or consult DLAPIL",
        "Provide a detailed price or fee table with volumes",
        "Decide on any price revision clause and index",
        "Choose duration and renewal option",
        "Check the three non-negotiable clauses are included",
        "Write objective-based technical specifications"
      ],
      links: ["Tender Design", "Authorise & Launch"]
    },
    {
      name: "Authorise & Launch",
      remember: "No approval, no launch; same answers to everyone.",
      keyFacts: [["5 working days","DLAPIL Legal Compliance Review"],["48 h","Tenders Board consultation period"],["48 h","before deadline: last Q&A answer"]],
      example: "An EU-funded €90,000 competitive bidding procedure is ready to launch. Because it is extrabudgetary and between €55,000 and €184,000, a Legal Compliance Review is required first. The correct action is to send a Request for LCR to DLAPIL and submit the documents to the CCM only after DLAPIL's visa.",
      title: "Authorise, Publish & Manage Questions",
      lead: "Obtain the required approval, invite or publish the call, and handle questions and deadline extensions fairly.",
      source: "Ch. 4.9.1–4.9.4",
      understand: "The approval route depends on the procedure, the value and the funding source: the CCM, the CCM after a DLAPIL Legal Compliance Review, or the Tenders Board.",
      do: "Submit tender documents for approval through the correct route, then invite at least three suppliers or publish, preferably via e-procurement.",
      check: "Written approval is on file before launch, and all bidders receive the same answers at the same time.",
      sections: [
        ["Approval routes",{"lead":"The approval route depends on the procedure and the value.","items":[["Direct award up to €2,000 or €6,000","A memorandum validated by the CCM."],["Exceptional direct award","A memorandum stating specification, cost, justification and supplier, to the CCM below €184,000 or the Tenders Board from €184,000."],["Competitive bidding","The CCM approves the documents in writing."],["International call","The CCM sends the documents and an explanatory note to the Tenders Board."]]}],
        ["Legal Compliance Review",{"lead":"Since 1 February 2025, extrabudgetary-funded competitive bidding and exceptional direct awards between €55,000 and €184,000 need a DLAPIL Legal Compliance Review before CCM approval.","items":[["Submit the form (buyer entity)","Send the request through the DLAPIL request form with the title Request for LCR."],["Attach the documents (buyer entity)","Attach the direct award memorandum or all tender documents."],["Give the mandatory details (buyer entity)","State the procedure, the estimated total expenditure, the funding source and the entities already consulted."],["Review (DLAPIL)","DLAPIL processes complete requests within 5 working days and gives its visa in writing."],["Approve the launch (CCM)","With the DLAPIL visa, the documents go to the CCM, who approves the launch."]],"ordered":true,"tip":"Call-offs under framework agreements are exempt, because they are not a procurement procedure."}],
        ["Tenders Board",{"lead":"The Tenders Board authorises the launch of international calls and validates their results, and is consulted on negotiations, amendments and direct awards.","items":[["Send the request (CCM)","The CCM e-mails the documents and an explanatory memo to the Tenders Board Secretariat."],["Forward to members (Tenders Board Secretariat)","The Secretariat gives members at least 48 hours (two working days) on the Tenders Board SharePoint."],["Answer questions (buyer entity)","The buyer entity answers members' questions on the SharePoint."],["Decide (Tenders Board)","The decision is posted on the SharePoint and sent by e-mail or e-procurement."],["Make changes (buyer entity)","The buyer entity makes any requested changes and the Secretariat validates the final version."]],"ordered":true}],
        ["Invite or publish",{"lead":"Competitive bidding invites suppliers by e-mail, while international calls are published by the Tenders Board Secretariat.","must":["In competitive bidding, the buyer entity must e-mail the tender documents to at least three suppliers and record the reasons if this is impossible.","For international calls, the Tenders Board Secretariat publishes on the CoE website, and the Board may add the OJEU, e-procurement, media or permanent representations."],"items":[["1 January 2026","E-procurement mandatory for international calls."],["1 April 2026","E-procurement mandatory for tenders above €55,000."],["1 January 2027","E-procurement mandatory for all tenders above €2,000 or €6,000."]],"ordered":true}],
        ["Questions and answers",{"lead":"All bidders receive the same answers through a single, anonymised Q&A document.","must":["The tender must state the e-mail address and deadline for questions, using a non-nominative address separate from the one receiving offers.","The buyer entity must distribute the anonymised Q&A document through every channel used to publish or invite.","No answer may be given later than 48 hours before the submission deadline.","Questions received by other channels are not answered, and there is no other contact with bidders during the tender."]}],
        ["Extending the deadline",{"lead":"The submission deadline may be extended only in exceptional circumstances.","must":["An extension must be decided before the deadline expires and approved by the CCM."],"tip":"Consult DLAPIL or the Procurement Unit beforehand."}]
      ],
      warning: "Do not answer bidders' questions outside the published Q&A procedure. Every bidder must have access to the same information at the same time.",
      best: "Publish at the right time: avoid launching during the summer break or setting a Monday-morning deadline, and use the e-procurement link to spread the call on relevant networks.",
      checklist: [
        "Identify the approval route by value and funding",
        "Request the Legal Compliance Review if it is required",
        "Obtain written approval from the CCM or Tenders Board",
        "Invite at least three suppliers or publish",
        "Set the questions e-mail address and deadline",
        "Publish anonymised Q&A to all bidders",
        "Extend the deadline only before expiry, with CCM approval"
      ],
      links: ["Thresholds & Procedure", "Open & Evaluate"]
    },
    {
      name: "Open & Evaluate",
      remember: "Admissible, not excluded, eligible — only then score.",
      keyFacts: [["2","authorised assessors at least"],["10","maximum score per technical criterion"],["Art. 17.2","clarify, never change, offers"]],
      example: "One bidder sent a missing CV late and also left the financial offer blank. The missing CV is minor information and can be clarified. The correct action is to exclude the bid anyway, because a missing financial offer cannot be completed after opening.",
      title: "Open, Analyse & Evaluate Bids",
      lead: "Open offers securely after the deadline and assess them in sequence: admissibility, exclusion, eligibility and award criteria.",
      source: "Ch. 4.9.5–4.9.8",
      understand: "Bids are assessed by at least two authorised staff members, strictly against the criteria published in the tender file.",
      do: "Record the opening, check admissibility, apply exclusion and eligibility as pass or fail, then score award criteria with written justification.",
      check: "Every score has an objective written justification, and any red flags or clarification requests are documented.",
      sections: [
        ["Opening offers",{"lead":"Offers are opened only after the deadline, and receipt and prices are recorded and confirmed by those opening.","items":[["E-procurement (one authorised staff member)","Offers open automatically after the deadline and one authorised staff member of the buyer entity opens them."],["Competitive bidding by e-mail (buyer entity)","At least two authorised staff members of the buyer entity open the offers."],["International call by e-mail (Tenders Board Secretariat)","The Secretariat opens offers sent to cdm@coe.int with an authorised member of the buyer entity and shares the record."]]}],
        ["Admissibility",{"lead":"Check admissibility first, analysing each lot separately.","items":[["Late bids","Inadmissible unless the delay was caused by the Council, for example a system failure."],["Incomplete bids","Inadmissible, although missing minor information may be requested."],["Above the exclusion level","Bids above a published exclusion level are excluded."]]}],
        ["Exclusion and eligibility",{"lead":"Admissible bids are then checked against the exclusion and eligibility criteria, which are pass or fail.","must":["The buyer entity must exclude any bid that fails an exclusion criterion or whose act of engagement is not signed.","With EU funds, the buyer entity must check the EU sanctions list using the WebFOCUS report.","A bid that fails an eligibility criterion is ineligible, and exceeding another criterion does not compensate unless the tender file says so."],"tip":"Where risk requires, ask the selected supplier for criminal record and tax certificates before signing."}],
        ["Award criteria",{"lead":"Only eligible bids are scored, using the published weightings.","items":[["Score technical criteria","Score each one out of 10 with a clear written assessment."],["Apply the weightings","Multiply each score by its published weight."],["Score price","Calculate financial scores against the cheapest offer; if price is the only criterion, the cheapest offer wins."]],"ordered":true,"tip":"Use the DLAPIL and Procurement Unit assessment templates or e-procurement; for Ordinary Budget purchases where all offers exceed the budget, scoring against the budget is good practice."}],
        ["Clarifications",{"lead":"Under Article 17.2 of Rule No. 1395, offers may be clarified only with non-essential information that does not change their main features or distort competition.","must":["Clarification requests must be made in writing, kept on record and reported to the CCM or Tenders Board with the results.","A clarification that would significantly change a bid requires a negotiation round."]}],
        ["Problematic cases",{"lead":"Some bidders and offers need special treatment.","items":[["Current staff","Bids from current staff, or from people employed on the launch date, are excluded."],["Former staff","Assessed case by case."],["Retired staff","Retired staff and those who left under an early departure measure cannot receive new contracts."],["Civil servants","Need their employer's approval and leave and must have no conflict."],["Abnormally low or high offers","Red flags that may be excluded with an explanatory memo."],["Multiple bids","The same bidder may not submit more than one bid."],["Other currencies or fee ranges","May be clarified rather than automatically excluded."]]}],
        ["Fraud indicators",{"lead":"Assessors look for signs of fraud, corruption, collusion or bid rigging.","must":["An assessor who sees any indication of fraud must report it immediately to their manager, copying the Director of the DIO."],"tip":"If the DIO opens an investigation, ask DLAPIL whether to reject the bids without waiting for the outcome."}]
      ],
      warning: "A missing or incomplete financial offer, or an unsigned act of engagement, cannot be corrected after opening, and the bid must normally be excluded.",
      best: "Write a detailed justification for every technical score. Clear analysis makes approval easier and lets you answer later enquiries without disclosing other bidders' information.",
      checklist: [
        "Open offers only after the deadline and record receipt",
        "Use at least two authorised assessors",
        "Check admissibility and that the act of engagement is signed",
        "Apply exclusion and eligibility criteria as pass or fail",
        "Score award criteria out of 10 with written justification",
        "Check EU sanctions list when EU funds are used",
        "Document all clarification requests in writing"
      ],
      links: ["Tender Design", "Negotiate & Award"]
    },
    {
      name: "Negotiate & Award",
      remember: "Sign with the winner first, then notify the others within 15 days.",
      keyFacts: [["15 days","to notify unsuccessful bidders"],["7 days","for bidders to enquire"],["30 days","to complain to the Tenders Board"]],
      example: "An international call produced offers that are all well above budget. The correct action is a memo to the Tenders Board asking either to negotiate with the eligible bidders, to relaunch, or to cancel. The memo must explain why the call failed and justify the chosen option.",
      title: "Negotiate, Award & Notify",
      lead: "Negotiate where it adds value, obtain the award decision, inform bidders and deal with unsuccessful procedures and complaints.",
      source: "Ch. 4.9.9–4.9.14",
      understand: "The CCM decides awards for competitive bidding procedures and the Tenders Board decides for international calls, based on the buyer entity's reasoned recommendation.",
      do: "Seek authorisation before negotiating, submit the analysis and recommendation, then notify successful and unsuccessful bidders in writing.",
      check: "Unsuccessful bidders are notified within 15 days of the successful notification, with the enquiry procedure explained.",
      sections: [
        ["Negotiations",{"lead":"Negotiation is possible in all tendering procedures (Rule No. 1395, Articles 20 and 21.8) to improve the offer, agree legal changes or settle final details.","must":["A negotiation must not significantly change the specifications.","The buyer entity must send a memo explaining why, with whom and on what to the CCM (competitive bidding) or the Tenders Board (international call).","The buyer entity must invite all eligible bidders unless exclusion is justified, document everything and get changes confirmed in writing."],"tip":"Involve DLAPIL for legal clauses and DIT or DGS for technical items."}],
        ["Awarding the contract",{"lead":"The CCM decides the award in competitive bidding, and the Tenders Board in international calls.","items":[["Competitive bidding","Submit a reasoned recommendation to the CCM, who decides."],["International call","The CCM validates the memo, assessment tables and recommendation and sends them to the Tenders Board Secretary; the Board scrutinises the analysis and decides."]],"must":["The buyer entity must never select more suppliers than the announced maximum."],"tip":"Auditors expect the CCM to justify repeated use of the same suppliers over a year, supported by a WebFOCUS report."}],
        ["Informing bidders",{"lead":"Sign with the winner first, then tell the others.","items":[["Inform the successful bidder","Notify in writing."],["Sign the contract","Complete signature before telling the others."],["Notify unsuccessful bidders","Within 15 days, in writing, with the reason and the Article 24 enquiry procedure."]],"ordered":true,"must":["Only the winner's amount, name and country may be disclosed to unsuccessful bidders."],"tip":"Results of international calls are published, and e-procurement sends notification letters automatically."}],
        ["Unsuccessful calls",{"lead":"A call is unfruitful if no or too few bids arrive, none meet the criteria, or prices greatly exceed the budget.","items":[["Cancel the purchase","Drop the need."],["Launch a new tender","Restart with revised documents."],["Negotiate directly","Ask to negotiate with a supplier (Articles 18.3 and 21.10)."]],"must":["The CCM (competitive bidding) or the Tenders Board (international call) must decide on a justifying memo, and bidders must be informed in writing."]}],
        ["Discontinuing",{"lead":"A procedure may be discontinued at any time before the award, without giving reasons or paying compensation (Article 18.2).","must":["The CCM decides for competitive bidding and the Tenders Board for international calls, and the buyer entity must inform tenderers in writing."]}],
        ["Enquiries and complaints",{"lead":"Unsuccessful bidders have up to three steps of recourse, none of which suspends the award or the start of the contract.","items":[["Enquiry","Within 7 days of notification; the buyer entity replies without undue delay."],["Complaint to the Tenders Board","Within 30 days; the Board replies within 30 days, and for competitive bidding this decision is final."],["Appeal to an ad hoc review board","International calls only, within 30 days, with a reply within 60 days."]],"ordered":true}]
      ],
      warning: "Sign the contract with the selected supplier before notifying unsuccessful bidders, and never disclose details of other bids beyond the winner's amount, name and country.",
      best: "When only one offer is received, you may still negotiate, but do not tell the bidder that no other bids were received.",
      checklist: [
        "Request CCM or Tenders Board authorisation before negotiating",
        "Record negotiations and obtain written bid confirmations",
        "Submit the reasoned award recommendation",
        "Respect the maximum number of suppliers announced",
        "Sign the contract, then notify unsuccessful bidders within 15 days",
        "Reply to enquiries using only the assessment records"
      ],
      links: ["Open & Evaluate", "Contract Signing"]
    },
    {
      name: "Contract Signing",
      remember: "PO first, signature second, work third.",
      keyFacts: [["MSA 4002","create a new supplier in FIMS"],["CCM","signs one-off contracts"],["PO","mandatory before any signature"]],
      example: "A consultant offers to start work on Monday, but the contract has not yet been countersigned. The correct action is to raise the PO in FIMS, have the CCM countersign, and send the signed PDF before any work starts.",
      title: "Contract Review & Signature",
      lead: "Complete the final checks and administrative steps so the contract is properly committed in FIMS and countersigned before any work starts.",
      source: "Ch. 4.10",
      understand: "A budgetary commitment (PO) is mandatory before the Organisation signs any contract, and no goods or services may be provided before signature.",
      do: "Check the documents, register new suppliers via MSA 4002, raise the PO, countersign and send the signed copy to the supplier.",
      check: "The act of engagement is complete, signed by the supplier, unaltered, matches any negotiations, and the PO exists before countersignature.",
      sections: [
        ["Final review",{"lead":"Check the contract documents carefully before signature.","items":[["Correct documents","They are correct, reflect any negotiated outcome and have not been modified by the supplier."],["Act of engagement","It is complete and signed by the supplier."],["Bank details","The supplier's name and the bank account holder are the same."]]}],
        ["FIMS steps",{"lead":"Set up the supplier and the commitment in FIMS before signing.","items":[["Create the supplier (buyer entity, then TPA)","For a new supplier, the buyer entity submits MSA 4002 and TPA processes it."],["Raise the purchase order (buyer entity)","Create the PO in FIMS."],["Countersign (CCM)","The CCM countersigns only after the commitment exists."]],"ordered":true,"must":["The commitment in FIMS must be made before the internal signature process."]}],
        ["Who signs",{"lead":"Who signs depends on whether the contract is a financial as well as a legal commitment.","items":[["One-off contract","A legal and financial commitment, signed by the CCM unless signature is expressly delegated."],["Framework contract or agreement","Only a legal commitment unless it includes a minimum purchase, so a duly authorised person may sign it, although CCM signature is advisable."]],"must":["Each selected supplier must sign the contract.","The buyer entity must enter the applicable VAT requirements in the invoicing table, as instructed by Protocol."]}],
        ["Countersign and send",{"lead":"Countersign with a wet-ink or electronic signature, then send and archive.","items":[["Countersign","A scanned act of engagement signed by the supplier can be countersigned electronically by the CCM."],["Send","E-mail a signed PDF copy to the contact named in the contract, or post a paper copy if requested."],["Archive","File the signed documents."]],"ordered":true}],
        ["Contractual documents",{"lead":"The contract is made up of several documents.","items":[["Act of engagement or contract","The signed core document."],["Terms of reference","The description of the need."],["Other Council documents","Such as technical specifications."],["Supplier's tender","The selected offer."]],"must":["If supplier documents contain internet links, the buyer entity must download those pages on the date of signature and add them to the file."]}],
        ["Share the contract",{"lead":"Once signed, a framework contract or agreement can be shared so colleagues with similar needs can use it.","tip":"Add it to the Organisation's database with help from the Procurement Unit."}]
      ],
      warning: "Never let a supplier start work, or sign any contract, before a PO has been raised in FIMS and the Organisation has signed.",
      best: "Save copies of any web pages referred to in the contract on the date of signature, in case the supplier later changes its conditions.",
      checklist: [
        "Verify documents are unaltered and reflect negotiations",
        "Confirm the act of engagement is complete and signed",
        "Create the new supplier via MSA 4002",
        "Raise the PO in FIMS before signature",
        "Fill in VAT requirements in the invoicing table",
        "Countersign and send a PDF copy to the supplier",
        "Add framework contracts to the shared database"
      ],
      links: ["Negotiate & Award", "Contract Management", "Performance & Filing"]
    },
    {
      name: "Contract Management",
      remember: "Amend before expiry; never change scope; watch the ceiling.",
      keyFacts: [["€184,000","ceiling for competitive bidding framework contracts"],["10%","call-off increase the CCM may authorise"],["3","unjustified call-off refusals before removal"]],
      example: "A framework contract awarded through competitive bidding has reached €150,000 in orders, with more training sessions planned. The correct action is to contact DLAPIL immediately and prepare an international public call for tenders, approved by the Tenders Board, before spending exceeds €184,000.",
      title: "Deadlines, Amendments, Orders & Renewal",
      lead: "Manage the contract actively: track deadlines, amend correctly, accept deliverables, order within thresholds and renew or end the contract on time.",
      source: "Ch. 5.1–5.6",
      understand: "The buyer entity monitors execution, and amendments may change how the contract is managed but never its main purpose, scope, volume or nature.",
      do: "Track deadlines, sign orders and call-offs through the CCM, monitor cumulative spending and document every change in writing.",
      check: "Cumulative spending stays below the threshold of the original procedure, and every extension or amendment is agreed before expiry.",
      sections: [
        ["Deadline management",{"lead":"The delivery deadline differs from the contract end date, which also covers acceptance, payment and warranty.","must":["A deadline extension must be legitimate, must not jeopardise the project, must be agreed before the original deadline expires, and counts as an amendment.","When a deadline is missed, the CCM decides whether to apply penalties, reduce payment, terminate or set a new deadline."],"tip":"Set realistic deadlines, use reminders and contact the provider before the deadline."}],
        ["Amendments",{"lead":"A contract can be amended only while it is in force, with both parties' agreement, and without distorting the original competition.","tip":"Typical amendments change deadlines, contact details, supplier name or bank details.","items":[["Get CCM agreement (buyer entity)","Obtain the CCM's written agreement before proposing the amendment."],["Propose the amendment (buyer entity)","By e-mail with the standard wording and the CCM in copy, or by a document, stating which provisions are supplemented or replaced."],["Confirm (supplier)","The supplier agrees by return e-mail or signs the document."]],"ordered":true,"must":["Call-off amendments up to 10% of the original value need CCM authorisation, and above 10% the buyer entity must consult DLAPIL."]}],
        ["Accepting deliverables",{"lead":"Accept deliverables in writing after checking them against the contract specifications.","must":["A refusal of deliverables must be sent to the supplier with reasons; a second refusal may be treated as a breach.","The acceptance certificate must be attached to the payment order validated by the CCM."],"tip":"For events, keep photographs and signed attendance sheets."}],
        ["Orders under framework contracts",{"lead":"Each order identifies the right supplier and fixes concrete deliverables, a deadline and a lump-sum price.","items":[["Identify the supplier","Apply the ranking or pooling rules in the contract."],["Issue the order form","State concrete deliverables, a deadline and a lump-sum price, but not the number of days."],["Raise the PO","Create it in FIMS."],["CCM signs last","The CCM signs after the PO has been raised."]],"ordered":true,"must":["Spending under a competitive bidding framework contract must not exceed €184,000; if it might, the buyer entity must contact DLAPIL immediately, and the remedy is an international call approved by the Tenders Board."]}],
        ["Call-offs under framework agreements",{"lead":"Each call-off is a mini-competition among the preselected suppliers, evaluated on the published award criteria.","must":["The buyer entity must send each call-off with terms of reference and a deadline, without revealing the other suppliers' identities.","Call-offs above €184,000 must go to the Tenders Board, and the CCM signs each call-off."],"items":[["Non-participation","A supplier that fails to justify non-participation more than three times may be removed."],["Above-market prices","After three call-offs with all tenders more than 20% above market price, the Council may tender outside the agreement."]]}],
        ["Termination and renewal",{"lead":"Contracts end by mutual consent, by unilateral termination as a last resort, or continue by renewal.","items":[["Mutual consent","Both parties agree in writing to end the contract."],["Unilateral termination","Only for breach where no negotiated solution can be found, after consulting DLAPIL, with all exchanges in writing."],["Renewal by written agreement","Completed before expiry, separately with each supplier, with the CCM's agreement."]]}]
      ],
      warning: "Exceeding €184,000 under a framework contract awarded through competitive bidding is a severe breach of the rules. If there is any risk of this, launch an international public call.",
      best: "Use the Procurement Unit's Excel tracking tables to follow every order or call-off against the contract ceiling, and tell the Tenders Board Secretary early if an announced budget will be significantly exceeded.",
      checklist: [
        "Set reminders for every delivery deadline",
        "Agree extensions and amendments in writing before expiry",
        "Accept deliverables in writing against specifications",
        "Issue orders with deliverables, a deadline and a lump-sum price",
        "Have the CCM sign orders and call-offs after the PO",
        "Track cumulative spend against the procedure threshold",
        "Renew or retender before the contract expires"
      ],
      links: ["Contract Types", "Contract Execution & Payment", "Performance & Filing"]
    },
    {
      name: "Contract Execution & Payment",
      remember: "Right invoice, right account, VAT settled before signing.",
      keyFacts: [["60 days","default payment term"],["€5,000","maximum per card purchase"],["DAP","recommended Incoterm for goods"]],
      example: "A French supplier asks to be paid in 90 days in exchange for a lower price. French law prohibits payment terms longer than 60 days net. The correct action is to refuse 90 days and, if different terms are needed, agree them with TPA and write them into the contract.",
      title: "Invoices, Payments & VAT",
      lead: "Make sure invoices are correct, paid on time to the right account, and that VAT and delivery terms are settled before signature.",
      source: "Ch. 5.7 & 5.10",
      understand: "Each directorate receives and validates invoices, TPA pays them by bank transfer in euros, and VAT must be clarified before signing.",
      do: "Check each invoice against the contract and acceptance certificate, apply the agreed payment terms and follow Protocol's VAT exemption procedures.",
      check: "The invoice meets all formal requirements, the payee account belongs to the supplier, and the VAT regime is correct.",
      sections: [
        ["Invoicing requirements",{"lead":"An invoice must contain specific information before it can be paid.","items":[["Date and letterhead","Dated, on the supplier's letterhead."],["Addressee","The Council of Europe, with the department on the second line."],["Supplier details","Name, address and VAT number if any."],["Invoice number","A unique reference."],["Deliverables and fees","The deliverables and the contract fees."],["Amounts","Sub-totals and total in the contract currency."],["Payment modalities","Any agreed terms."]],"must":["An invoice with an intra-EU VAT number must include the exemption wording referring to Articles 143 and 151 of Council Directive 2006/112/EC."]}],
        ["Payment requirements",{"lead":"Unless agreed otherwise, the payment term is 60 days from receipt of the invoice or execution of the contract, whichever is later.","must":["Payment must be made within the contract deadline to the bank account named in the contract, which must be held by the supplier.","For French suppliers, French law prohibits payment terms longer than 60 days net or 45 days end of month."]}],
        ["Payment schedules",{"lead":"Staged payments must be set out in the tender file and contract.","items":[["At order","For example 10% for works."],["During execution","For example 80%."],["On completion","For example 10%."]],"ordered":true,"must":["Shorter terms in exchange for a discount must be approved by TPA and written into the contract."],"tip":"Immediate payment is only for exceptional, justified cases, and TPA's minimum lead time is about 10 days."}],
        ["Bank cards and internet purchases",{"lead":"Payments are normally by bank transfer in euros, with cards, cheques or cash only as exceptions.","items":[["Raise a PO","Create the purchase order in FIMS."],["Ask TPA for the card","TPA provides the card number."]],"ordered":true,"must":["A card payment must not exceed €5,000 per purchase, and card spending must not exceed €30,000 per month for the whole Organisation."],"tip":"For internet purchases, consider the public prices procedure below €10,000; the supplier's terms may be accepted under the CCM's documented responsibility."}],
        ["Incoterms",{"lead":"For goods, Incoterms define who organises and insures transport and from what point.","tip":"Use DAP (Delivered at Place) to a Council of Europe address so the supplier is responsible until delivery, and contact Protocol for details."}],
        ["VAT",{"lead":"Goods and services for the Council's official use may be exempt from VAT, with separate procedures for goods and for services.","must":["With a new supplier, the buyer entity must establish its VAT status and the exact nature of the purchase to determine the place of taxation."],"tip":"Protocol is the point of contact for all VAT questions."}]
      ],
      warning: "Always clarify VAT before signing and sending the contract or order form, and never pay into an account not held by the supplier named in the contract.",
      best: "When suppliers need cash flow, such as in works or IT, set out a payment schedule in the tender file. It encourages more candidates to bid.",
      checklist: [
        "Check invoice addressee, letterhead and mandatory details",
        "Match invoice lines to contract fees and accepted deliverables",
        "Confirm the bank account holder is the supplier",
        "Apply 60-day terms unless others are agreed",
        "Stay within €5,000 per card purchase",
        "Settle the VAT regime with Protocol before signature",
        "Use DAP Incoterms for goods deliveries"
      ],
      links: ["Contract Management", "Contract Signing"]
    },
    {
      name: "Performance & Filing",
      remember: "Evaluate, learn, archive — ten years.",
      keyFacts: [["10 years","retention of contractual documents"],["1–10","typical performance score scale"],["3 years","optional exclusion for past failures"]],
      example: "At the end of a printing contract, deliveries were repeatedly late. Poor performance alone does not stop the supplier from bidding again. The correct action is to record the evaluation and add clear delivery targets linked to penalties in the next tender.",
      title: "Supplier Performance, Follow-up & Archiving",
      lead: "Assess how suppliers perform, use the lessons for the next tender, and keep a complete, audit-ready file.",
      source: "Ch. 5.8–5.9, 4.11 & Ch. 6",
      understand: "Performance follow-up improves future tenders, and complete archives support audits; poor past performance alone does not exclude a supplier.",
      do: "Assess suppliers during and at the end of the contract, and archive all procurement documents for 10 years.",
      check: "The file holds the tender documents, all bids, assessments, negotiations, memos, contract and amendments.",
      sections: [
        ["Supplier performance",{"lead":"Evaluate the supplier against the agreed deadlines, quality and service, during the contract and at the end.","items":[["Quality","Whether deliverables meet the specifications."],["Responsiveness","How quickly the supplier reacts."],["Ethics and CSR","Conduct and social responsibility."],["On-time delivery","Whether deadlines are met."],["Cost control","Whether costs stay within the contract."],["Innovation","Whether the supplier proposes improvements."]],"tip":"Use a questionnaire scored, for example, from 1 (very poor) to 10 (very good); the Procurement Unit has templates and can help set it up before the tender."}],
        ["Using the results",{"lead":"Poor past performance does not in itself prevent a supplier from bidding again.","tip":"The optional exclusion criterion covers suppliers who failed contractual obligations in the past three years, leading to refused payment or termination; build lessons such as clear targets linked to penalties into the next tender."}],
        ["Procurement follow-up",{"lead":"The DGA Procurement Unit monitors performance through KPIs and maps purchases using e-procurement and FIMS data.","tip":"Extract data for your CCM or directorate through WebFOCUS reports; procurement categories help define strategies for intellectual services, works and IT."}],
        ["Archiving",{"lead":"Keep all contract documents for 10 years.","items":[["Tender documents","The published or sent tender package."],["All bids","Every offer received."],["Exchanges with suppliers","All correspondence."],["Negotiation records","Memos and confirmed changes."],["Assessments","Scoring tables and reports."],["Contract and amendments","The signed contract and any changes."],["Memos","Internal approvals and justifications."]],"tip":"Each directorate keeps its files, usually in DMS; the buyer entity keeps execution documents such as acceptance separately, and TPA keeps invoices and payment requests."}],
        ["E-procurement and resources",{"lead":"The e-procurement platform, developed by DIT and supported by the Procurement Unit, centralises the tender process and keeps a full audit trail.","items":[["Publication","Calls are published on the platform."],["Q&A","Questions and answers are handled centrally."],["Opening","Offers open automatically."],["Assessment","Scoring is done on the platform."],["Notification","Letters are sent automatically."]],"tip":"Training on Procurement optimisation and e-procurement gives Super-User status; see also the intranet Procurement page, the DLAPIL and Tenders Board pages and the free internet suppliers portal."}],
        ["Social networks",{"lead":"Social networks can be used to promote calls and source suppliers.","must":["While a call is in progress, staff involved should not be openly connected with likely bidders or share or like their posts."]}]
      ],
      warning: "Missing documents in the file, such as justifications for direct awards, assessments or proof of notification, are a recurring audit finding. Archive everything for 10 years.",
      best: "Carry out an end-of-contract assessment before retendering, and draft the new tender documents to fix the weaknesses it identifies.",
      checklist: [
        "Assess supplier performance during the contract",
        "Complete an end-of-contract evaluation",
        "Record lessons learned for the next tender",
        "Archive tender documents, bids and assessments",
        "File negotiation records, memos, contract and amendments",
        "Keep execution and acceptance documents separately",
        "Retain the procurement file for 10 years"
      ],
      links: ["Contract Management", "Market & Suppliers", "Foundations"]
    }
  ];

  C.procurementReference = {
    "contractTypes": [
      {
        "name": "One-off contract",
        "useWhen": "The need is quantifiable and definable and very unlikely to recur.",
        "suppliers": "One supplier, which may be a consortium; the contract may be split into lots.",
        "ordering": "No orders: price, specifications and quantities are fixed in the contract.",
        "duration": "Until both parties have completed their obligations; a delivery deadline per deliverable; cannot be renewed.",
        "control": "The CCM signs, as it is a legal and financial commitment; repeated one-off contracts for the same need are prohibited artificial splitting."
      },
      {
        "name": "Framework contract",
        "useWhen": "The need can be defined as units and recurs often but cannot be fully quantified.",
        "suppliers": "One supplier (simple) or several (multiple), using ranking for goods and general services or pooling for intellectual services.",
        "ordering": "The buyer entity issues order forms at the fixed unit prices, with concrete deliverables, a deadline and a lump-sum price; the Council is not obliged to buy.",
        "duration": "No minimum; no more than four years, or five exceptionally; no order after the end date.",
        "control": "The CCM signs each order after the PO is raised; pooling choices are justified in a note approved by the CCM; spending under a competitive bidding framework contract must not exceed €184,000."
      },
      {
        "name": "Framework agreement",
        "useWhen": "The need is regular but variable, uncertain or complex.",
        "suppliers": "At least three suppliers per lot, selected on competence without price competition.",
        "ordering": "Each need goes to a call-off (mini-competition) among the pool, evaluated on the published award criteria.",
        "duration": "No minimum; no more than four years, or five exceptionally; call-offs only during validity.",
        "control": "The CCM approves and signs each call-off; call-offs above €184,000 go to the Tenders Board; rarely recommended below €184,000 in total."
      }
    ],
    "limits": [
      {
        "value": "€2,000",
        "rule": "Direct award allowed up to this amount for goods, general services and works; competitive bidding above it.",
        "who": "CCM, on a justified memorandum"
      },
      {
        "value": "€6,000",
        "rule": "Direct award allowed up to this amount for intellectual services; competitive bidding above it.",
        "who": "CCM, on a justified memorandum"
      },
      {
        "value": "€10,000",
        "rule": "Below this amount excluding VAT, a competitive bidding purchase may compare the public prices of three or more suppliers (Article 21.2); screenshots archived.",
        "who": "Buyer entity, CCM approval"
      },
      {
        "value": "€55,000",
        "rule": "From this amount to €184,000, extrabudgetary-funded competitive bidding and exceptional direct awards need a Legal Compliance Review; e-procurement mandatory above it from 1 April 2026.",
        "who": "DLAPIL, then CCM"
      },
      {
        "value": "€184,000",
        "rule": "Above this amount, an international public call for tenders is required; exceptional direct awards and call-offs from this value go to the Tenders Board.",
        "who": "Tenders Board"
      },
      {
        "value": "€5,000 / €30,000",
        "rule": "Maximum bank card payment per purchase, and per month for the whole Organisation.",
        "who": "TPA"
      },
      {
        "value": "10%",
        "rule": "Call-off amendments up to 10% of the original value need CCM authorisation; above 10%, consult DLAPIL.",
        "who": "CCM / DLAPIL"
      },
      {
        "value": "20%",
        "rule": "After three call-offs with all tenders more than 20% above market price, the Council may tender outside the framework agreement.",
        "who": "Buyer entity"
      },
      {
        "value": "3 suppliers",
        "rule": "Minimum invitees in competitive bidding (nine for a multiple framework contract with a pool of three); minimum pool per lot in a framework agreement.",
        "who": "Buyer entity"
      },
      {
        "value": "4 years (5 exceptionally)",
        "rule": "Maximum duration of framework contracts, framework agreements and multi-year contracts.",
        "who": "Buyer entity, CCM"
      },
      {
        "value": "3 weeks",
        "rule": "Minimum publication period for an international call.",
        "who": "Tenders Board Secretariat"
      },
      {
        "value": "48 hours",
        "rule": "No answers to questions later than 48 hours before the deadline; minimum time for Tenders Board members to approve a request.",
        "who": "Buyer entity / Tenders Board"
      },
      {
        "value": "48 hours",
        "rule": "Response time of the DGA Procurement Unit at procurement@coe.int.",
        "who": "Procurement Unit"
      },
      {
        "value": "5 working days",
        "rule": "DLAPIL processing time for a complete Legal Compliance Review request.",
        "who": "DLAPIL"
      },
      {
        "value": "180 days",
        "rule": "Offers remain valid for 180 calendar days from the deadline.",
        "who": "Bidders"
      },
      {
        "value": "15 days",
        "rule": "Unsuccessful bidders are notified in writing within 15 days, after the contract is signed.",
        "who": "Buyer entity"
      },
      {
        "value": "7 days",
        "rule": "Deadline for an unsuccessful bidder's enquiry after notification.",
        "who": "Buyer entity replies"
      },
      {
        "value": "30 days",
        "rule": "Deadline for a complaint to the Tenders Board, which replies within 30 days; also the deadline for an appeal to an ad hoc review board in international calls.",
        "who": "Tenders Board"
      },
      {
        "value": "60 days",
        "rule": "Ad hoc review board reply time; also the default payment term from invoice or execution, whichever is later.",
        "who": "Review board / TPA"
      },
      {
        "value": "3 months (min. 1 month)",
        "rule": "Usual notice period to object to tacit renewal, never less than one month.",
        "who": "Buyer entity"
      },
      {
        "value": "2 to 3 months",
        "rule": "Usual maximum time an order or call-off may continue after the framework end date.",
        "who": "Buyer entity"
      },
      {
        "value": "3 years",
        "rule": "Optional exclusion of suppliers that failed a Council contract in the previous three years.",
        "who": "Buyer entity"
      },
      {
        "value": "10 years",
        "rule": "Retention period for all contract and tender documents.",
        "who": "Each directorate"
      },
      {
        "value": "31 January",
        "rule": "Annual declaration of interests, or within one month of a change.",
        "who": "Secretariat members involved"
      }
    ],
    "roles": [
      {
        "name": "Buyer entity",
        "does": "Runs the whole process, from forecasting the need to executing the contract; drafts documents, invites, assesses and manages the contract.",
        "when": "All stages"
      },
      {
        "name": "Authorised staff members",
        "does": "Open offers, assess offers and negotiate, as designated in writing by the CO or CCM.",
        "when": "Open & Evaluate, Negotiate & Award"
      },
      {
        "name": "Commitments Officer (CO)",
        "does": "Authorises expenditure, approves budget-line forecasts and usually delegates to CCMs.",
        "when": "Planning and funding"
      },
      {
        "name": "Commitments Control Manager (CCM)",
        "does": "Validates the choice of procedure, tender files, awards, contracts, orders, call-offs and amendments.",
        "when": "All procedures; decides alone below €184,000"
      },
      {
        "name": "Tenders Board",
        "does": "Authorises and validates international calls, and is consulted on negotiations, amendments and direct awards.",
        "when": "From €184,000"
      },
      {
        "name": "Tenders Board Secretariat",
        "does": "Checks files, forwards requests, publishes international calls and opens e-mailed offers.",
        "when": "From €184,000"
      },
      {
        "name": "DLAPIL",
        "does": "Handles legal questions, templates and training, and performs the Legal Compliance Review.",
        "when": "Always for legal issues; LCR for extrabudgetary €55,000 to €184,000"
      },
      {
        "name": "DGA Procurement Unit",
        "does": "Gives non-legal support: market analysis, sourcing, e-procurement, templates and KPIs.",
        "when": "All stages, on request"
      },
      {
        "name": "TPA",
        "does": "Registers suppliers in FIMS, provides card numbers and pays invoices.",
        "when": "Contract Signing, Payment"
      },
      {
        "name": "DPC",
        "does": "Co-ordinates programming and extrabudgetary resources for co-operation projects.",
        "when": "Co-operation projects"
      },
      {
        "name": "DIO",
        "does": "Audits, evaluates and investigates; receives reports of suspected fraud.",
        "when": "Any time"
      },
      {
        "name": "Specialist directorates (DIT, DC, DGS, ITEM)",
        "does": "Approve or advise on IT, communication, works and multimedia purchases.",
        "when": "Define the Need"
      },
      {
        "name": "Protocol",
        "does": "Advises on VAT and Incoterms.",
        "when": "Contract Signing, Payment"
      }
    ],
    "howTo": [
      {
        "title": "How to request a Legal Compliance Review",
        "who": "Buyer entity, DLAPIL, CCM",
        "steps": [
          "Buyer entity: submit the DLAPIL request form titled Request for LCR.",
          "Buyer entity: attach the direct award memorandum or all tender documents.",
          "Buyer entity: state the procedure, estimated total expenditure, funding source and entities already consulted.",
          "DLAPIL: process the complete request within 5 working days and give its visa in writing.",
          "CCM: approve the launch once the visa is received."
        ],
        "source": "Ch. 4.9.1"
      },
      {
        "title": "How to submit to the Tenders Board",
        "who": "CCM, Tenders Board Secretariat, Tenders Board, buyer entity",
        "steps": [
          "CCM: e-mail the tender documents and an explanatory memo to the Tenders Board Secretariat.",
          "Tenders Board Secretariat: forward to members, allowing at least 48 hours, on the Tenders Board SharePoint.",
          "Buyer entity: answer members' questions on the SharePoint.",
          "Tenders Board: post its decision on the SharePoint and send it by e-mail or e-procurement.",
          "Buyer entity: make any requested changes and send the updated version to the Secretariat for final validation."
        ],
        "source": "Ch. 4.9.1"
      },
      {
        "title": "How to open offers",
        "who": "Authorised staff members, Tenders Board Secretariat",
        "steps": [
          "Wait until the submission deadline has passed.",
          "With e-procurement: one authorised staff member of the buyer entity opens the offers, which unlock automatically.",
          "Competitive bidding by e-mail: at least two authorised staff members of the buyer entity open the offers.",
          "International call by e-mail: the Tenders Board Secretariat opens offers sent to cdm@coe.int with an authorised member of the buyer entity.",
          "Those opening record and confirm receipt and prices."
        ],
        "source": "Ch. 4.9.5"
      },
      {
        "title": "How to review and sign a contract",
        "who": "Buyer entity, TPA, CCM",
        "steps": [
          "Buyer entity: check that the documents are correct, reflect negotiations and have not been modified by the supplier.",
          "Buyer entity: check that the act of engagement is complete and signed by the supplier.",
          "Buyer entity: for a new supplier, submit MSA 4002 so that TPA creates the supplier in FIMS.",
          "Buyer entity: raise the purchase order in FIMS.",
          "CCM: countersign with a wet-ink or electronic signature.",
          "Buyer entity: send a signed PDF copy to the supplier and archive the documents."
        ],
        "source": "Ch. 4.10"
      },
      {
        "title": "How to amend a contract",
        "who": "Buyer entity, CCM, supplier, DLAPIL",
        "steps": [
          "Buyer entity: obtain the CCM's written agreement before proceeding.",
          "Buyer entity: send the supplier an e-mail (CCM in copy) or a document naming the contract and the provisions supplemented or replaced, using the standard wording.",
          "Supplier: confirm by return e-mail or sign the document.",
          "Buyer entity: for call-off increases above 10%, seek DLAPIL advice first."
        ],
        "source": "Ch. 5.2"
      },
      {
        "title": "How to place an order under a framework contract",
        "who": "Buyer entity, supplier, CCM",
        "steps": [
          "Buyer entity: identify the supplier using the ranking or pooling rules.",
          "Buyer entity: complete the order form with deliverables, deadline, lump-sum price, project ID, FC number and VAT regime, and raise the PO.",
          "Supplier: sign the order form and return a scanned copy.",
          "CCM: countersign, adding the PO number and any advance payment percentage.",
          "Buyer entity: send the signed copy to the supplier; the order is then binding."
        ],
        "source": "Ch. 5.4.1, Appendix 2"
      },
      {
        "title": "How to launch a call-off under a framework agreement",
        "who": "Buyer entity, CCM, Tenders Board",
        "steps": [
          "Buyer entity: prepare terms of reference and a deadline; the CCM approves before publication.",
          "Buyer entity: send it to the preselected suppliers without revealing the others' identities.",
          "Buyer entity: evaluate tenders on the published award criteria; late tenders are not considered.",
          "Tenders Board: approve any call-off above €184,000.",
          "CCM: sign the call-off after the VAT requirements are entered."
        ],
        "source": "Ch. 3.4.2, 5.4.3"
      },
      {
        "title": "How to inform bidders of the outcome",
        "who": "Buyer entity",
        "steps": [
          "Inform the successful bidder in writing.",
          "Sign the contract.",
          "Notify unsuccessful bidders in writing within 15 days with the reason and the Article 24 enquiry procedure.",
          "Disclose only the winner's amount, name and country."
        ],
        "source": "Ch. 4.9.11"
      }
    ]
  };

  C.procurementRoles = {
    buyer: {
      name: "Buyer entity / project team",
      tag: "OPERATIONS · OWNER",
      summary: "The Council of Europe entity for which the purchase is made. It runs the process from forecasting the need to executing the contract.",
      when: "Throughout the procurement lifecycle.",
      does: [
        "Defines needs and estimates the threshold",
        "Prepares tender documents and technical specifications",
        "Invites or publishes and answers questions",
        "Submits files to the CCM or Tenders Board",
        "Receives and accepts deliverables and verifies invoices",
        "Monitors contract execution and supplier performance"
      ],
      stages: ["Market & Suppliers", "Define the Need", "Contract Types", "Thresholds & Procedure", "Tender Design", "Terms & Specifications", "Authorise & Launch", "Contract Management", "Contract Execution & Payment", "Performance & Filing"]
    },
    authorised: {
      name: "Authorised staff members",
      tag: "ASSESSMENT · RULE 1395",
      summary: "Members of the buyer entity authorised in writing by the CO or CCM (Rule No. 1395, Article 3.2.d) to perform key procedure tasks.",
      when: "From approval of the tender documents until the award.",
      does: [
        "Open offers or represent the buyer entity at opening",
        "Assess offers, with at least two assessors",
        "Conduct negotiations with tenderers when authorised",
        "Report indications of fraud or collusion"
      ],
      stages: ["Roles & Funding", "Open & Evaluate", "Negotiate & Award"]
    },
    ccm: {
      name: "Commitments Officer / Cost Centre Manager",
      tag: "VALIDATION · EXPENDITURE",
      summary: "COs authorise expenditure and delegate to CCMs. The CCM is responsible for the cost centre's purchases and decides on competitive bidding procedures and direct awards below €184,000.",
      when: "At every validation and signature point.",
      does: [
        "Validates the choice of procedure and the tender documents",
        "Authorises launch, deadline extensions and negotiations",
        "Decides awards for competitive bidding procedures",
        "Approves direct awards below €184,000",
        "Signs contracts, orders and call-offs",
        "Decides consequences of missed deadlines and approves amendments"
      ],
      stages: ["Roles & Funding", "Thresholds & Procedure", "Authorise & Launch", "Negotiate & Award", "Contract Signing", "Contract Management"]
    },
    tb: {
      name: "Tenders Board",
      tag: "CONTROL · ABOVE €184,000",
      summary: "Ensures compliance with the rules for all contracts above €184,000 excluding VAT. It is chaired by the Director General of Administration, with the DLAPIL Director, the Treasurer and an MAE member.",
      when: "For international public calls, direct awards from €184,000, call-offs above €184,000 and complaints.",
      does: [
        "Authorises the launch and publication of international calls",
        "Scrutinises bid analyses and decides on awards",
        "Authorises negotiations, amendments and direct awards",
        "Decides on unfruitful or discontinued international calls",
        "Rules on complaints within 30 days"
      ],
      stages: ["Thresholds & Procedure", "Authorise & Launch", "Negotiate & Award", "Contract Management"]
    },
    tbsec: {
      name: "Secretariat of the Tenders Board",
      tag: "TB · SECRETARIAT",
      summary: "Part of the DGA's Legal Support Division. It runs the Tenders Board's calendar, templates, SharePoint and consultations, and checks files before submission.",
      when: "Before and during Tenders Board procedures.",
      does: [
        "Reviews files before they go to the Board",
        "Runs electronic consultations with at least 48 hours for members",
        "Publishes international calls after approval",
        "Opens bids at cdm@coe.int when e-procurement is not used",
        "Archives Tenders Board decisions"
      ],
      stages: ["Authorise & Launch", "Open & Evaluate"]
    },
    dlapil: {
      name: "DLAPIL",
      tag: "LEGAL · COMPLIANCE",
      summary: "The Directorate of Legal Advice and Public International Law handles all legal procurement questions and templates. It performs the Legal Compliance Review for extrabudgetary-funded procedures from €55,000 to €184,000.",
      when: "For any legal question, and mandatorily for Legal Compliance Reviews.",
      does: [
        "Provides tender file, act of engagement and order form templates",
        "Carries out the Legal Compliance Review within 5 working days",
        "Advises on legal conditions, amendments and breaches",
        "Provides third-party purchase templates on request",
        "Trains staff on procurement procedures"
      ],
      stages: ["Foundations", "Thresholds & Procedure", "Tender Design", "Terms & Specifications", "Authorise & Launch", "Contract Management"]
    },
    pu: {
      name: "Procurement Unit (DGA)",
      tag: "SUPPORT · PERFORMANCE",
      summary: "Manages all DGA purchases and advises every buyer entity on non-legal procurement issues and tools, including e-procurement. It responds within a 48-hour SLA.",
      when: "From market analysis to contract execution.",
      does: [
        "Supports market analysis, sourcing and calls for expressions of interest",
        "Maintains the suppliers and contracts databases",
        "Supports e-procurement and OJEU publication",
        "Provides analysis tables and expenditure tracking tools",
        "Monitors procurement KPIs and purchase mapping"
      ],
      stages: ["Market & Suppliers", "Authorise & Launch", "Open & Evaluate", "Contract Management", "Performance & Filing"]
    },
    tpa: {
      name: "Treasury, Payments and Accounting (TPA)",
      tag: "TREASURY · PAYMENT",
      summary: "Registers suppliers and bank details in FIMS, checks payment claims and pays suppliers.",
      when: "At supplier registration and at payment.",
      does: [
        "Processes MSA 4002 supplier creation in FIMS",
        "Checks payment claims and settles invoices",
        "Approves specific payment conditions",
        "Provides card numbers for exceptional card payments",
        "Keeps invoices and payment requests"
      ],
      stages: ["Contract Signing", "Contract Execution & Payment"]
    },
    dpc: {
      name: "Directorate of Programme Co-ordination (DPC)",
      tag: "CO-OPERATION · PROJECTS",
      summary: "Co-ordinates programming and resource mobilisation for extrabudgetary co-operation projects and ensures they comply with the project management methodology.",
      when: "When procuring under co-operation projects.",
      does: [
        "Advises on existing framework contracts in external offices",
        "Addresses donor visibility and communication requirements",
        "Gives guidance on hiring civil servants from Horizontal Facility beneficiaries",
        "Ensures activities match the approved project budget"
      ],
      stages: ["Roles & Funding", "Define the Need"]
    },
    dio: {
      name: "Directorate of Internal Oversight (DIO)",
      tag: "AUDIT · INVESTIGATION",
      summary: "Provides independent audit, evaluation and investigation, including compliance and performance audits of procurement.",
      when: "When audits take place or wrongdoing is suspected.",
      does: [
        "Audits procurement compliance and performance",
        "Receives reports of fraud, corruption and wrongdoing",
        "Investigates suspected proscribed practices",
        "Reports on risks detected in declarations of interests"
      ],
      stages: ["Foundations", "Open & Evaluate", "Performance & Filing"]
    }
  };
})();
