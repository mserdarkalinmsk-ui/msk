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
        ["Legal bases", "Articles 40 to 43 of the Financial Regulations set out the three types of contract, the three main procedures and the role of the Tenders Board. Rule No. 1395 of 20 June 2019 details each procedure, from preparing the tender file to signing the contract; an annotated version is on the Tenders Board's web page. Instructions No. 59 (consultants) and No. 60 (outsourcing) remain relevant, but the DLAPIL templates should be used instead of their model contracts, and the model invoice should not be used."],
        ["The six principles", "Periodic competition requires competitive procedures at regular intervals. Objectivity requires neutral tender documents and impartial scoring. Transparency means criteria and rules are available to all tenderers and results are published, with reasons for the award given on request. Non-exclusivity, equal treatment and non-discrimination complete the set: competition is the norm and direct award the exception."],
        ["Grants v. procurement", "A procurement contract is required whenever the Organisation buys works, goods or services to meet its own needs, whatever the status of the contractor. A grant agreement (Article 43 bis of the Financial Regulations and Rule No. 1374) is used when the Organisation gives financial assistance to a grantee for the grantee's own project. Procurement includes a profit margin for the provider and has no reporting requirements; a grant covers part of the grantee's costs and requires extensive reporting."],
        ["Values and ethics", "Secretariat members must follow the Code of Conduct and the Purchasing Code of Ethics (25 October 2005). They must avoid conflicts of interest, respect the confidentiality of tenders, apply objective criteria and refuse all benefits. The Council of Europe has a no-gift policy in procurement, whatever the value. Persons involved must submit a declaration of interests every year by the end of January, or within one month of a change (Rule No. 1282)."],
        ["Fraud and reporting", "Suspected fraud, corruption or other wrongdoing must be reported immediately to the DIO under the Speak Up Policy. Before the call is public, bidders must not be given privileged technical or financial information, and specifications must not be written restrictively to discourage competition."],
        ["Audits and risks", "Procurement is audited by the DIO, the external auditor, the European Union and donor-mandated auditors. They examine transparency, competition, compliance with thresholds, reasons for direct awards, validation workflows, declarations of interest and archiving. Non-compliance creates institutional and financial risks, including donors reclaiming ineligible expenditure, which must then be paid from the Ordinary Budget. It also creates ethical, reputational and operational risks."]
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
        ["Segregation of duties", "Each MAE is responsible for its own procurement. Staff performing operational functions (defining needs, drafting tender documents, assessing deliverables) must be separate from those performing validation and financial management functions (budgetary verification, PO validation, transfers). Roles follow the Financial Management Framework, the general delegation framework CM/Res(2023)1 and each MAE's delegations."],
        ["Buyer entity and authorised staff", "The buyer entity runs the whole process, from forecasting the need to executing the contract. Opening offers, assessing offers and negotiating must be done by authorised staff members designated by the CO or CCM (Rule No. 1395, Article 3.2.d). The guide recommends delegating this authority in writing, at the latest when the CCM approves the tender documents, using the standard e-mail paragraph."],
        ["Control and validation bodies", "COs authorise expenditure and usually delegate to CCMs. CCMs validate the choice of procedure, tender files, awards and contracts, assisted by an ACCM and a FOMA. The Tenders Board ensures compliance for all contracts above €184,000 excluding VAT, decides on the scope and publication of international calls, and scrutinises bid analyses. The DIO audits and investigates."],
        ["Support services", "DLAPIL handles all legal questions, provides templates and training and, since 1 February 2025, performs the Legal Compliance Review for extrabudgetary-funded procedures between €55,000 and €184,000. The DGA Procurement Unit gives non-legal support (market analysis, sourcing, e-procurement, analysis tables) and answers within a 48-hour SLA at procurement@coe.int. The Tenders Board Secretariat checks files before they go to the Board. TPA registers suppliers in FIMS and pays invoices."],
        ["Funding sources", "Budgetary resources come from the four-year Programme and Budget with a biennial cycle, and procurement is planned on forecasts per budget line approved by the CO. Extrabudgetary resources include EU funds under joint programmes and voluntary contributions, either earmarked or non-earmarked, including the Human Rights Trust Fund. In co-operation projects, procurement must match the approved description of the action and budget, which can be difficult to amend."],
        ["Types of purchases", "Intellectual services are knowledge-based, non-recurrent creations of the mind and always raise intellectual property issues. Avoid disguised employment, for example by not giving consultants full-time or part-time workloads, CoE e-mail addresses or equipment. Communication purchases need DC approval, IT purchases need DIT approval (MSA 1002), cloud deliverables require the Cloud Checklist, and works on buildings go through DGS. Travel and accommodation booked directly for participants are outside Rule No. 1395 (Article 7), but buying them through an agency is not."],
        ["AI and co-operation projects", "Use of AI must be declared by suppliers in the DLAPIL AI questionnaire, which is saved with the file. In co-operation projects, the DPC co-ordinates programming and extrabudgetary resources, and external offices prepare forecasts that the CCM validates. The difference between national and international consultants may only be based on expertise or language skills, never on nationality or residence."]
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
        ["Why analyse the market", "A market analysis identifies new suppliers, helps tender documents fit the market, reveals alternative or innovative proposals and highlights risks and opportunities. It is essential when the goods, services or works have not been bought before. It is also recommended before a direct award, to check that better suppliers or solutions are not available."],
        ["Sources", "For works, goods and technical services, use trade journals, chambers of commerce, embassies, catalogues and end users. For intellectual consultancy, use academic platforms such as researchgate.net, academia.edu and scholar.google.com, specialised journals, professional associations and LinkedIn. Internal sources include the existing contracts lists, previous lists of invitees and market studies supported by the Procurement Unit."],
        ["Procurement strategy", "A good strategy produces diverse offers, a workload proportionate to the purchase and the best value for money. Consider dividing the contract into lots, using framework contracts, and sharing existing contracts with other entities. Make sure SMEs, not-for-profit, minority-owned, women-owned and disability-inclusive suppliers are not excluded."],
        ["Identifying new suppliers", "FIMS holds over 50,000 suppliers, but few new ones are added, so the same suppliers often bid. Sourcing should be targeted and meaningful, not a passive internet search. In a competitive bidding procedure, the minimum of three invited suppliers (Rule No. 1395, Article 21.2) should be chosen to obtain three good-quality bids, not just to meet the rule."],
        ["Call for expressions of interest", "A CEI (Rule No. 1395, Article 5) is not a procurement procedure. It is a tool to list potential suppliers for future procedures, for example through the CoE website, e-procurement, the OJEU or social networks. There is no obligation to invite every listed supplier, to justify not inviting someone, or to launch a call afterwards. External auditors strongly recommend CEIs for consultancy."],
        ["Suppliers database", "The Procurement Unit's intranet holds a shared suppliers database by category, approved by the Data Protection Officer. Adding names to it is optional. Registering a contracted supplier in FIMS still requires an MSA 4002 processed by TPA. The Council of Europe does not use blocklists, but an optional exclusion criterion covers suppliers who failed contractual obligations with the Council in the previous three years."]
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
        ["Plan early", "Identify needs as early as possible in the project or activity. A procedure may even be launched before the project formally starts if the tender documents state that the contract will only be awarded once it begins. Build a reverse schedule from the required completion date. Allow time for Tenders Board approval, at least three weeks' publication for international calls, and VAT exemption procedures."],
        ["Key questions", "Define the expected deliverable, how often it is needed, the estimated overall budget and the applicable threshold. Check whether an existing transversal contract already covers it. Identify specific requirements such as payment terms, delivery time, penalties and language. Consider the total cost of ownership, not only the purchase price."],
        ["Consult in-house expertise", "Before tendering, consult DGS for works and buildings, DIT for IT goods or services, DC for communication and ITEM for multimedia. These directorates confirm the need is not already covered in-house and help validate the approach."],
        ["Co-operation projects", "A project-based approach covers the needs of one project for its full duration, including possible extensions. A sector-based approach covers common needs of several projects or a sector. It requires a framework contract or agreement and an international public call for tenders. Each order or call-off is still issued within one project, and the relevant CCMs must be consulted during drafting and informed of the results before any order is placed."],
        ["Ordinary Budget", "For Ordinary Budget purchases, consider the whole two-year budget cycle and cover similar needs with a minimum number of procedures. Ad hoc procedures for unforeseeable needs remain possible, but one-off purchases must not be repeated to meet a structural need."]
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
        ["Choosing the type", "A contract is not a procedure: the procedure depends on value, while the type depends on the need. A one-off contract suits quantifiable, definable needs that are very unlikely to recur. A framework contract suits needs that can be defined as units and recur often but cannot be fully quantified. A framework agreement suits needs that are regular but variable, uncertain or complex."],
        ["One-off contracts", "A one-off contract is made with a single supplier, which may be a consortium, although it may be split into lots. Price, specifications and quantities must be defined. It lasts until both parties have completed their obligations, must state a delivery deadline for each deliverable and cannot be renewed. Using repeated one-off contracts for the same need is artificial splitting and is prohibited."],
        ["Framework contracts", "A framework contract fixes unit prices for defined items or time-based units, and the Council is not obliged to buy. It can be simple (one supplier) or multiple. For multiple contracts, the tender must choose between ranking (recommended for goods and general services) and pooling (better for intellectual services, with the choice for each order justified in a note approved by the CCM). Only listed items can be ordered, and orders cannot be created after the end date."],
        ["Framework agreements", "A framework agreement establishes a pool of at least three suppliers per lot, selected on competence without price competition. Each need is then put out to a call-off among them, approved by the CCM before publication. Call-offs with a single value above €184,000 must go to the Tenders Board. Because each need requires a mini-competition, framework agreements are rarely recommended for estimated expenditure below €184,000."],
        ["Duration and sharing", "Framework contracts and agreements have no minimum duration but should not exceed four years, or five exceptionally, to respect non-exclusivity. Orders or call-offs created before the end date may continue for usually no more than two to three months afterwards, and in projects delivery must fall within the implementation period. Framework contracts and agreements concluded through an international call are available to all Council of Europe entities; one-off contracts are not."]
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
        ["Calculating the threshold", "Add the total estimated value before VAT for the full intended duration, including all renewals, tranches and options (works), lots, and all possible orders or call-offs. For multiple contracts, calculate the value regardless of the number of suppliers. Thresholds apply to the total value over the life of the programme, not per year. For a percentage-based service fee, use the total value of the service contract."],
        ["Direct award", "A direct award is possible up to €2,000 (goods, general services, works) or €6,000 (intellectual services), based on a memorandum to the CCM justified by the supplier's expertise (Rule No. 1395, Article 22.4). Above these amounts, it is only allowed exceptionally for unforeseen urgency not attributable to the buyer, technical requirements, or considerations of fact or law (Financial Regulations Article 40.3.c, Rule Article 22.1.a). The CCM decides below €184,000 and the Tenders Board from €184,000. Extrabudgetary-funded cases from €55,000 to €184,000 first need a DLAPIL Legal Compliance Review."],
        ["Competitive bidding procedure", "This applies between €2,000 (or €6,000) and €184,000, under the sole responsibility of the CCM. Invite at least three suppliers; for a multiple framework contract with a pool of three, invite nine. Extrabudgetary-funded procedures from €55,000 to €184,000 need a Legal Compliance Review. If all offers exceed €184,000, cancel the procedure and launch an international call."],
        ["International public call for tenders", "This applies when the total value is estimated to exceed €184,000, or if there is even a slight risk of reaching it. The Tenders Board must authorise the launch, on request from the CCM with a summary memo to the Tenders Board Secretary. The minimum submission period is three weeks. The Tenders Board cannot approve a launch retroactively."],
        ["Other procedures", "A competitive dialogue suits needs where the technical solution is hard to define. It uses a descriptive document, a published notice and rounds of discussion, which may eliminate bidders, and the results are validated by the Tenders Board; it also suits a proof of concept. Under Article 21.2 of Rule No. 1395, a competitive bidding purchase below €10,000 excluding VAT may compare the public prices of three or more suppliers instead of inviting tenders. Screenshots must be archived."],
        ["Purchases for third parties", "Goods or services for project beneficiaries can only be bought through one-off contracts, using a competitive bidding procedure or an international call depending on value. They use DLAPIL tailor-made templates available on request: a tender file, a tripartite contract, a tripartite act of acceptance and a declaration of agreement. Ownership transfers to the beneficiary when the tripartite act of acceptance is signed. Consult DIT on IT requirements."],
        ["Specific risks", "Artificial splitting, meaning dividing purchases without objective reason to stay below thresholds, is prohibited and a red flag for fraud. Underestimating expenditure is also a risk: if a later procedure covers needs that could have been included in an earlier one, the threshold is calculated on the combined amount. Contract amendments may also push the total above the original threshold."]
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
        ["Tender package and templates", "The package includes at least the tender file (terms of reference and tender rules) and the act of engagement, which is a ready-to-sign contract containing bidders' statutory declarations. Always download a new DLAPIL template, chosen by procedure, contract type, lots and language. DGA and EDQM have their own templates. If documents are published in two languages, state which version prevails; machine translations need the standard disclaimer."],
        ["Division into lots", "Lots split a tender into separate competitions in the same call and are only possible if each lot can be awarded to a different supplier. They increase competition and allow specialised suppliers to bid. The procedure is determined by the total of all lots. Avoid overlapping lots, and do not use lots when a single supplier is needed."],
        ["Exclusion criteria", "The exclusion criteria in Appendix I to Rule No. 1395 apply to every purchase and cannot be deleted or changed, although they can be supplemented. They cover convictions (including for child labour and trafficking), bankruptcy, unpaid taxes or social contributions, shell companies, conflicts of interest, current staff and retired staff, and UN or EU restrictive measures. The signed declaration of agreement in DLAPIL acts of engagement serves as the declaration; e-procurement users confirm it online."],
        ["Eligibility criteria", "Eligibility criteria set the minimum financial, economic, technical or professional capacity needed to perform the contract. They must be clear, objective, verifiable, proportionate and answerable with yes or no, each with a defined supporting document. Do not use vague terms such as sufficient or relevant, experience limited to Council of Europe projects, overly prescriptive requirements or nationality. As a guide, the bid should represent between 15% and 35% of the bidder's turnover."],
        ["Award criteria", "Award criteria score quality and price to find the best value for money, and must not repeat eligibility criteria. Technical criteria assess methodology, understanding of the need, work schedule and the team. The more standard the service, the higher the weight of price, which should in principle be at least 20 points. Weightings, including sub-criteria, must be published and cannot be changed."],
        ["Minimum scores", "A minimum score can be set to limit who is invited to negotiations or included in a framework contract pool, but it must be stated in the tender file. Without a minimum score, all eligible suppliers up to the announced maximum number must be admitted to the pool."]
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
        ["Tenderers and submission", "Decide whether natural persons may bid or only legal persons and consortia. Consortium members are jointly and severally liable, and subcontracting always requires Council approval. Late offers are inadmissible. International calls need a minimum of three weeks, with offers sent to cdm@coe.int unless e-procurement is used, in which case offers received outside the platform are excluded. Offers remain valid for 180 calendar days from the deadline."],
        ["Act of engagement and financial offer", "The act of engagement contains the supplier and bank details, the financial offer, the declaration of agreement, signature boxes and legal conditions. Failure to complete or sign it normally means automatic exclusion, and a missing financial offer cannot be completed after opening. For framework contracts, use deliverable-based units for goods and general services and time-based units for intellectual services. Add the clause allowing an hourly fee to be calculated as the daily fee divided by 8."],
        ["Prices and revision", "Give quantities or estimated volumes and a detailed price table so that offers can be compared. Any price update or revision must be provided for in the tender, ideally linked to a relevant official index with a margin. A revision under such a clause is recorded in a document signed by both parties and is not an amendment. Avoid exclusion levels (maximum prices) unless there are strong objective reasons, such as a donor cap."],
        ["Duration and renewal", "One-off contracts need a delivery deadline. Multi-year contracts should last no more than four years, or five in specific circumstances. Decide before publication whether the contract is not renewable, renewable by written agreement, or renewable tacitly. Tacit renewal is best for framework contracts and agreements; the notice period to object is usually three months and never less than one month."],
        ["General Conditions and non-negotiable clauses", "The General Conditions, called legal conditions in DLAPIL templates, cover VAT, confidentiality, data protection, payment and disputes. Three clauses are non-negotiable: disclosure of contract terms, use of the Council's name and logo, and disputes (arbitration). If a supplier such as a hotel refuses the Council's terms, its terms may be accepted only if they are balanced and include these clauses. Internet purchase terms can be accepted exceptionally under the CCM's documented responsibility."],
        ["Specific conditions", "For technical or large-scale purchases, use supplementary general conditions for intellectual services, supplies and services, works or IT, completed by specific contractual conditions such as indices, warranty, penalties or building access. Contact the Procurement Unit for these. Penalties should be high enough to be useful but not so high that they discourage bids."],
        ["Technical specifications", "Specify the objective to be achieved, not the means. Avoid brand names or add or equivalent. Do not mix administrative and technical content, and give enough information so that previous suppliers have no advantage. Consider allowing variants, avoid over-quality, and take account of total cost of ownership, warranty and maintenance. Define measurable outputs to support performance monitoring and penalties."]
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
        ["Approval routes", "Direct awards up to €2,000 or €6,000 need a memorandum validated by the CCM. Above that, a memorandum stating the specification, cost, justification and supplier goes to the CCM below €184,000 or to the Tenders Board from €184,000. Competitive bidding documents are approved in writing by the CCM. International calls need the CCM to send the documents and an explanatory note to the Tenders Board."],
        ["Legal Compliance Review", "Since 1 February 2025, competitive bidding procedures and exceptional direct awards funded partly or wholly by extrabudgetary funds between €55,000 and €184,000 need a DLAPIL Legal Compliance Review before CCM approval. Submit it through the request form titled Request for LCR, with the documents, procedure, estimated expenditure, funding source and entities already consulted. Complete requests are processed within 5 working days. Call-offs under framework agreements are exempt."],
        ["Tenders Board", "The Tenders Board authorises the launch of international calls and validates their results. It is also consulted on negotiations, amendments and direct awards. Requests go by e-mail to its Secretariat, which allows members at least 48 hours (two working days), and the workflow uses the Tenders Board SharePoint. Any requested changes are made by the buyer entity and validated by the Secretariat."],
        ["Invite or publish", "In competitive bidding, e-mail the tender documents to at least three suppliers and record the reasons if this is impossible; publication may be added. For international calls, the Tenders Board Secretariat publishes on the CoE website, and the Board may add the OJEU, e-procurement, media or permanent representations. E-procurement is mandatory for international calls from 1 January 2026, for tenders above €55,000 from 1 April 2026, and for all tenders above €2,000 or €6,000 from 1 January 2027."],
        ["Questions and answers", "State in the tender the e-mail address and deadline for questions. Use a non-nominative address, separate from the one receiving offers. Compile anonymised questions and answers in one document and distribute it through every channel used to publish or invite. No answers may be given later than 48 hours before the submission deadline. Questions received by other channels are not answered, and there is no other contact with bidders during the tender."],
        ["Extending the deadline", "The submission deadline may be extended only in exceptional circumstances, before it expires and with CCM approval. Consult DLAPIL or the Procurement Unit beforehand."]
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
        ["Opening offers", "Offers are opened only after the deadline. With e-procurement, they open automatically and one authorised staff member may open them. Otherwise, competitive bidding offers are opened by at least two authorised staff members, and international call offers sent to cdm@coe.int are opened by the Tenders Board Secretariat with an authorised member of the buyer entity. Receipt and prices are recorded and confirmed by those opening."],
        ["Admissibility", "Late bids are inadmissible unless the delay was caused by the Council, for example a system failure. Incomplete bids are inadmissible, although missing minor information may be requested. Bids above a published exclusion level are excluded. For lots, analyse each lot separately."],
        ["Exclusion and eligibility", "Exclude any bid that fails an exclusion criterion or whose act of engagement is not signed. Where risk requires, ask the selected supplier for criminal record and tax certificates before signing. With EU funds, check the EU sanctions list using the WebFOCUS report. Eligibility criteria are not scored: if one is not met, the bid is ineligible, and exceeding another criterion does not compensate unless the tender file says so."],
        ["Award criteria", "Only eligible bids are scored. Score each technical criterion out of 10 with a clear written assessment, then apply the weightings. Financial scores are calculated against the cheapest offer, and if price is the only criterion, the cheapest offer wins. For Ordinary Budget purchases where all offers exceed the budget, scoring against the budget is good practice. Use the DLAPIL and Procurement Unit assessment templates or e-procurement."],
        ["Clarifications", "Under Article 17.2 of Rule No. 1395, offers may be clarified or supplemented with non-essential information only, without changing their main features or distorting competition. Make requests in writing, keep them on record and report them to the CCM or Tenders Board with the results. A clarification that would significantly change a bid requires a negotiation round."],
        ["Problematic cases", "Bids from current staff, or from people employed on the launch date, are excluded. Former staff are assessed case by case, while retired staff and those who left under an early departure measure cannot receive new contracts. Civil servants need their employer's approval and leave and must have no conflict. Abnormally low or high offers are red flags and may be excluded with an explanatory memo. Multiple bids from the same bidder are not allowed. Offers in other currencies or with fee ranges may be clarified rather than automatically excluded."],
        ["Fraud indicators", "Assessors must look for signs of fraud, corruption, collusion or bid rigging. Report any indication immediately to your manager, copying the Director of the DIO. If the DIO opens an investigation, ask DLAPIL whether to reject the bids without waiting for the outcome."]
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
        ["Negotiations", "Negotiation is possible in all tendering procedures (Rule No. 1395, Articles 20 and 21.8) to improve the offer, agree legal changes or settle final details. It must not significantly change the specifications. Send a memo to the CCM (competitive bidding) or the Tenders Board (international call) explaining why, with whom and on what. Invite all eligible bidders unless exclusion is justified, document everything, and get changes confirmed in writing; involve DLAPIL for legal clauses and DIT or DGS for technical items."],
        ["Awarding the contract", "For competitive bidding, submit a reasoned recommendation to the CCM, who decides. For international calls, the CCM validates the memo, assessment tables and recommendation and sends them to the Tenders Board Secretary; the Board then scrutinises the analysis and decides. Never select more suppliers than the announced maximum. Auditors expect the CCM to justify repeated use of the same suppliers over a year, supported by a WebFOCUS report."],
        ["Informing bidders", "Inform successful bidders in writing and sign the contract before notifying unsuccessful bidders. Notify unsuccessful bidders in writing within 15 days, giving the reason and the Article 24 enquiry procedure. Disclose only the winner's amount, name and country. Results of international calls are published, and e-procurement sends notification letters automatically."],
        ["Unsuccessful calls", "A call is unfruitful if no or too few bids are received, none meet the criteria, or prices greatly exceed the budget. The options are to cancel the purchase, launch a new tender, or ask to negotiate directly with a supplier (Articles 18.3 and 21.10). The CCM decides for competitive bidding and the Tenders Board for international calls, based on a justifying memo, and bidders are informed in writing."],
        ["Discontinuing", "A procedure may be discontinued at any time before the award, without giving reasons or paying compensation (Article 18.2). The CCM decides for competitive bidding and the Tenders Board for international calls. Inform tenderers in writing."],
        ["Enquiries and complaints", "Unsuccessful bidders may enquire within 7 days of notification, and the buyer entity must reply without undue delay. They may then complain to the Tenders Board within 30 days, and the Board replies within 30 days; for competitive bidding this decision is final. For international calls, an appeal to an ad hoc review board is possible within 30 days, with a reply within 60 days. None of these steps suspends the award or the start of the contract."]
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
        ["Final review", "Check that all contract documents are correct, reflect any negotiated outcome and have not been modified by the supplier. Check that the act of engagement is complete and signed by the supplier. Check that the supplier's name and bank account holder are the same."],
        ["FIMS steps", "For a new supplier, create the supplier record in FIMS using MSA 4002, which TPA processes. Raise the purchase order in FIMS: the commitment is mandatory before the internal signature process."],
        ["Who signs", "A one-off contract is a legal and financial commitment and is signed by the CCM, unless signature is expressly delegated. A framework contract or agreement is only a legal commitment unless it includes a minimum purchase, so a duly authorised person may sign it, although signature by the CCM is advisable. Each selected supplier must sign. Enter the applicable VAT requirements in the invoicing table, as instructed by Protocol."],
        ["Countersign and send", "The contract may be countersigned with a wet-ink or electronic signature; a scanned act of engagement signed by the supplier can be countersigned electronically by the CCM. Send a signed PDF copy by e-mail to the contact named in the contract, or post a paper copy if requested, and archive the documents."],
        ["Contractual documents", "The contract usually includes the act of engagement or contract, the terms of reference, any other Council document such as technical specifications, and the selected supplier's tender. If supplier documents contain internet links, download those pages on the date of signature and add them to the file."],
        ["Share the contract", "Once signed, consider adding a framework contract or agreement to the Organisation's database so that colleagues with similar needs can use it. The Procurement Unit can help."]
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
        ["Deadline management", "The delivery deadline is different from the contract end date, which also covers acceptance, payment and warranty. Set realistic deadlines, use reminders and contact the provider before the deadline. An extension must be legitimate, must not jeopardise the project, must be agreed before the original deadline expires, and is an amendment. Missed deadlines are a breach, and the CCM decides whether to apply penalties, reduce payment, terminate or set a new deadline."],
        ["Amendments", "A contract can only be amended while it is in force, with both parties' agreement, and without distorting the original competition. Amendments may change deadlines, contact details, supplier name or bank details. Agree them by e-mail using the standard wording, with the CCM's prior agreement and in copy, or by a signed document. Call-off amendments up to 10% of the original value need CCM authorisation; above 10%, consult DLAPIL."],
        ["Accepting deliverables", "Accept deliverables in writing after checking them against the contract specifications. If you refuse them, inform the supplier with reasons; a second refusal may be treated as a breach. For events, keep photographs and signed attendance sheets. Attach the acceptance certificate to the payment order validated by the CCM."],
        ["Orders under framework contracts", "Identify the supplier using the ranking or pooling rules in the contract, then issue an order form with concrete deliverables, a deadline and a lump-sum price; do not state the number of days. The CCM signs last, after the PO has been raised. Spending under a competitive bidding framework contract must not exceed €184,000. If it might, contact DLAPIL immediately; the remedy is an international call approved by the Tenders Board."],
        ["Call-offs under framework agreements", "Send each call-off to the preselected suppliers with terms of reference and a deadline, without revealing the other suppliers' identities, and evaluate it on the published award criteria. Call-offs above €184,000 go to the Tenders Board, and the CCM signs each call-off. A supplier that fails to justify non-participation more than three times may be removed. After three call-offs with all tenders more than 20% above market price, the Council may tender outside the agreement."],
        ["Termination and renewal", "A contract may be terminated by mutual written consent. Unilateral termination is only possible for breach where no negotiated solution can be found, after consulting DLAPIL, with all exchanges in writing; it is a last resort. Renewal by written agreement must be completed before the contract expires, separately with each supplier, and with the CCM's agreement."]
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
        ["Invoicing requirements", "The invoice must be dated, on the supplier's letterhead and addressed to the Council of Europe, with the department on the second line. It must show the supplier's name and address, invoice number, VAT number if any, deliverables, contract fees, sub-totals and total in the contract currency, and any payment modalities. For intra-EU VAT numbers, it must include the exemption wording referring to Articles 143 and 151 of Council Directive 2006/112/EC."],
        ["Payment requirements", "Payment is made within the contract deadline to the bank account named in the contract, which must be held by the supplier. Unless agreed otherwise, the payment term is 60 days from receipt of the invoice or execution of the contract, whichever is later. For French suppliers, French law prohibits terms longer than 60 days net or 45 days end of month."],
        ["Payment schedules", "Where staged payments are needed, set them out in the tender file and contract, for example 10% at order, 80% during execution and 10% on completion for works. Shorter terms in exchange for a discount must be approved by TPA and written into the contract. Immediate payment is only for exceptional, justified cases; TPA's minimum lead time is about 10 days."],
        ["Bank cards and internet purchases", "Payments are normally by bank transfer in euros, with cards, cheques or cash only as exceptions. For a card payment, raise a PO and ask TPA for the card number. The maximum is €5,000 per purchase and €30,000 per month for the whole Organisation. For internet purchases, the public prices procedure below €10,000 may be considered, and the supplier's terms may be accepted under the CCM's documented responsibility."],
        ["Incoterms", "For goods, Incoterms define who organises and insures transport and from what point. The recommended term is DAP (Delivered at Place) to a Council of Europe address, so the supplier is responsible until delivery. Contact Protocol for details."],
        ["VAT", "Goods and services for the Council's official use may be exempt from VAT, using separate exemption procedures for goods and for services. With a new supplier, establish its VAT status and the exact nature of the purchase to determine the place of taxation. Protocol is the point of contact for all VAT questions."]
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
        ["Supplier performance", "Evaluate the supplier against the agreed deadlines, quality and service, both during the contract and at the end. Use a questionnaire scored, for example, from 1 (very poor) to 10 (very good). Indicators include quality, responsiveness, ethics and CSR, on-time delivery, cost control and innovation. The Procurement Unit has templates and can help set this up before the tender."],
        ["Using the results", "Poor past performance does not in itself prevent a supplier from bidding again. However, the optional exclusion criterion applies where the supplier failed contractual obligations in the past three years, leading to refused payment or termination. Build the lessons, such as clear targets linked to penalties, into the next tender."],
        ["Procurement follow-up", "The DGA Procurement Unit monitors performance through KPIs and maps the Organisation's purchases using data from e-procurement and FIMS. Staff can extract data for their CCM or directorate through WebFOCUS reports. The procurement categories help define strategies for intellectual services, works and IT."],
        ["Archiving", "Keep all contract documents for 10 years, together with the tender documents, all bids, exchanges with suppliers, negotiation records, assessments, contract and amendments, and memos. Each directorate keeps its files, usually in DMS. Execution documents such as acceptance are kept separately by the buyer entity, and TPA keeps invoices and payment requests."],
        ["E-procurement and resources", "The e-procurement platform, developed by DIT and supported by the Procurement Unit, centralises publication, Q&A, opening, assessment and notification, and keeps a full audit trail. Training on Procurement optimisation and e-procurement gives Super-User status. Useful pages include the intranet Procurement page, the DLAPIL and Tenders Board pages, and the internet suppliers portal, where suppliers register free of charge."],
        ["Social networks", "Social networks can be used to promote calls and source suppliers. While a call is in progress, staff involved should not be openly connected with likely bidders or share or like their posts."]
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
