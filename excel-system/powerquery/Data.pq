// Data — every system extraction in the folder named in the cell ExtractionsFolder (Home sheet).
// One row per Consolidation line (Kind = "CONSO") and per dated posting (Kind = "POSTING": invoice by GL date, GL entry).
// Units: UnitsOfficial follows the official report (0 when nothing spent, months paid on a staff PO, else ordered);
//        UnitsSpent counts only the spent share of a PO (analysis).
// Flag: entries to check (staff PO not covering the months left, invoiced above the PO, no reporting line,
//       possible duplicate invoice).
let
    Folder = Text.Trim(Text.From(Excel.CurrentWorkbook(){[Name = "ExtractionsFolder"]}[Content]{0}[Column1])),
    Norm = (t as any) as text =>
        let
            s = Text.Lower(if t = null then "" else Text.From(t)),
            r = List.Accumulate({{"é","e"},{"è","e"},{"ê","e"},{"à","a"},{"â","a"},{"ç","c"},{"ô","o"},{"û","u"},{"ü","u"},{"î","i"}}, s, (a, p) => Text.Replace(a, p{0}, p{1}))
        in
            Text.Select(r, {"a".."z", "0".."9"}),
    // Header row = first of the first 40 rows holding every key; columns renamed to their normalised names.
    Promote = (tbl as table, keys as list) as nullable table =>
        let
            rows = Table.ToRows(Table.FirstN(tbl, 40)),
            idx = List.PositionOf(List.Transform(rows, (r) => List.ContainsAll(List.Transform(r, Norm), keys)), true),
            out = if idx < 0 then null else
                let
                    body = Table.Skip(tbl, idx + 1),
                    names = List.Transform(rows{idx}, Norm),
                    uniq = List.Accumulate(List.Positions(names), {}, (acc, i) => acc & {if names{i} = "" or List.Contains(acc, names{i}) then names{i} & "_" & Text.From(i) else names{i}})
                in
                    Table.RenameColumns(body, List.Zip({Table.ColumnNames(body), uniq}))
        in
            out,
    FindTable = (wb as table, keys as list) as nullable table =>
        let
            sheets = Table.SelectRows(wb, each [Kind] = "Sheet"),
            found = List.RemoveNulls(List.Transform(sheets[Data], (d) => Promote(d, keys))),
            best = if List.IsEmpty(found) then null else List.Last(List.Sort(found, (a, b) => Value.Compare(Table.RowCount(a), Table.RowCount(b))))
        in
            best,
    Col = (t as nullable table, names as list) as text => let c = List.First(List.Intersect({names, if t = null then {} else Table.ColumnNames(t)}), null) in c,
    Get = (r as record, c as nullable text) => if c = null then null else Record.FieldOrDefault(r, c, null),
    Num = (v) => if v = null or v = "" then 0 else try Number.From(v) otherwise 0,
    ToDate = (v) =>
        if v = null then null
        else if Value.Is(v, type datetime) then Date.From(v)
        else if Value.Is(v, type date) then v
        else if Value.Is(v, type number) and v > 20000 and v < 80000 then Date.From(v)
        else let s = Text.Trim(Text.From(v)), p = Text.Split(Text.BeforeDelimiter(s, " "), "/") in
            if List.Count(p) = 3 then try #date(Number.From(Text.Start(p{2}, 4)), Number.From(p{1}), Number.From(p{0})) otherwise null
            else if Text.Length(s) = 6 and Text.At(s, 3) = "-" then try #date(2000 + Number.From(Text.End(s, 2)), (Text.PositionOf("JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC", Text.Upper(Text.Start(s, 3))) / 3) + 1, 1) otherwise null
            else null,
    Month = (period, d) => let x = ToDate(period), y = if x <> null then x else ToDate(d) in if y = null then null else Date.ToText(y, "yyyy-MM"),
    PeriodOf = (desc as text) =>
        let s = Text.Lower(desc), i = Text.PositionOf(s, "from "), j = Text.PositionOf(s, " to ") in
            if i < 0 or j < i then null else
            let f = ToDate(Text.Middle(desc, i + 5, 10)), t = ToDate(Text.Middle(desc, j + 4, 10)) in if f = null or t = null or t <= f then null else [From = f, To = t],

    OneFile = (content as binary, name as text) as table =>
        let
            wb = Excel.Workbook(content, null, true),
            top = List.Combine(List.Transform(Table.SelectRows(wb, each [Kind] = "Sheet")[Data], (d) => List.Transform(Table.ToRows(Table.FirstN(d, 12)), (r) => Text.From(r{0} ?? "")))),
            bhLine = List.First(List.Select(top, each Text.Contains(_, "BH=")), ""),
            BH = if bhLine = "" then null else Text.Trim(Text.BeforeDelimiter(Text.AfterDelimiter(bhLine, "BH=") & " ", " ")),
            dateLine = List.First(List.Select(top, each Text.StartsWith(Text.Trim(_), "Date :")), ""),
            AsAt = if dateLine = "" then null else ToDate(Text.Middle(Text.Trim(dateLine), 7, 10)),
            conso = FindTable(wb, {"source", "reportingline", "spentcomeur"}),
            inv = FindTable(wb, {"invoiceno", "montantligne"}),
            gl = FindTable(wb, {"glnumber", "reportingline"}),
            // Consolidation columns
            cSrc = Col(conso, {"source"}), cLine = Col(conso, {"reportingline"}), cUt = Col(conso, {"unittype"}), cU = Col(conso, {"nbreofunits"}),
            cDoc = Col(conso, {"docnumber"}), cD = Col(conso, {"description"}), cDl = Col(conso, {"descriptionline"}), cSup = Col(conso, {"supplier"}),
            cAmt = Col(conso, {"poamounteur"}), cSp = Col(conso, {"spenteur"}), cCm = Col(conso, {"committedeur"}), cSc = Col(conso, {"spentcomeur"}),
            cSt = Col(conso, {"closurestatus"}), cDt = Col(conso, {"acctdate", "encumbereddate"}),
            consoRows = if conso = null then {} else List.Select(Table.ToRecords(conso), (r) => let s = Text.From(Get(r, cSrc) ?? "") in s <> "" and not Text.StartsWith(Text.Lower(s), "total")),
            // Invoices
            iDg = Col(inv, {"dategl"}), iPe = Col(inv, {"period"}), iNo = Col(inv, {"invoiceno"}), iD = Col(inv, {"description"}),
            iAm = Col(inv, {"montantengage", "montantligne"}), iPo = Col(inv, {"numeropo"}), iPf = Col(inv, {"postedflag"}),
            invRows = if inv = null then {} else List.Select(Table.ToRecords(inv), (r) => Text.From(Get(r, iNo) ?? "") <> "" and (try Number.From(Get(r, iAm)) otherwise null) <> null),
            paidByPo = List.Accumulate(invRows, [], (acc, r) =>
                let po = Text.From(Get(r, iPo) ?? ""), m = Month(Get(r, iPe), Get(r, iDg)) in
                    if po = "" or m = null then acc else Record.TransformFields(Record.AddField(Record.RemoveFields(acc, {po}, MissingField.Ignore), po, List.Distinct(Record.FieldOrDefault(acc, po, {}) & {m})), {})),
            spentByPo = List.Accumulate(invRows, [], (acc, r) =>
                let po = Text.From(Get(r, iPo) ?? "") in if po = "" then acc else Record.AddField(Record.RemoveFields(acc, {po}, MissingField.Ignore), po, Record.FieldOrDefault(acc, po, 0) + Num(Get(r, iAm)))),
            poInfo = List.Accumulate(consoRows, [], (acc, r) =>
                let po = Text.From(Get(r, cDoc) ?? "") in if po = "" or Record.HasFields(acc, po) or not Text.StartsWith(Text.From(Get(r, cSrc)), "1") then acc
                else Record.AddField(acc, po, [Line = Text.From(Get(r, cLine) ?? ""), Supplier = Get(r, cSup), Desc = Get(r, cD)])),
            ConsoOut = List.Transform(consoRows, (r) =>
                let
                    isPo = Text.StartsWith(Text.From(Get(r, cSrc)), "1"),
                    po = Text.From(Get(r, cDoc) ?? ""), desc = Text.From(Get(r, cD) ?? ""), ut = Text.From(Get(r, cUt) ?? ""),
                    u = Num(Get(r, cU)), sp = Num(Get(r, cSp)), sc = Num(Get(r, cSc)), amt = Num(Get(r, cAmt)),
                    per = PeriodOf(desc), staff = isPo and per <> null and Text.Contains(Text.Lower(ut), "month"),
                    paid = List.Count(Record.FieldOrDefault(paidByPo, po, {})),
                    official = if not isPo then u else if Number.Abs(sp) < 0.005 then 0 else if staff and paid > 0 then List.Min({u, paid}) else u,
                    spentShare = if not isPo then u else if Number.Abs(sp) < 0.005 then 0 else if staff and paid > 0 then List.Min({u, paid}) else if sc > sp + 0.005 and sc > 0 then Number.Round(u * sp / sc, 2) else u,
                    line = let l = Text.Trim(Text.From(Get(r, cLine) ?? "")) in if l = "" then "0" else l,
                    status = Text.From(Get(r, cSt) ?? ""),
                    // staff PO: months left after the last paid month, at the average monthly cost
                    months = List.Sort(Record.FieldOrDefault(paidByPo, po, {})),
                    lastPaid = if List.IsEmpty(months) then null else #date(Number.From(Text.Start(List.Last(months), 4)), Number.From(Text.End(List.Last(months), 2)), 1),
                    left = if staff and lastPaid <> null and Text.Upper(status) = "OPEN" then (Date.Year(per[To]) * 12 + Date.Month(per[To])) - (Date.Year(lastPaid) * 12 + Date.Month(lastPaid)) else 0,
                    perMonth = if paid > 0 then Record.FieldOrDefault(spentByPo, po, sp) / paid else 0,
                    short = if left > 0 then perMonth * left - (sc - sp) else 0,
                    misc = Text.Upper(desc & " " & Text.From(Get(r, cDl) ?? "") & " " & Text.From(Get(r, cSup) ?? "")),
                    over = isPo and amt > 0 and not (Text.StartsWith(misc, "OM") or Text.Contains(misc, "PETTY CASH") or Text.Contains(misc, "MISSION") or Text.Contains(misc, "PERSONNEL") or Text.Contains(misc, "PAIE")) and sp - amt > List.Max({250, amt * 0.05}),
                    levy = line = "0" and (Text.Contains(misc, "TRANCHE") or Text.Contains(misc, "PRELEV")),
                    flag = if short > 100 then "Staff PO does not cover the months left" else if over then "Invoiced above the PO" else if line = "0" and not levy then "No reporting line" else null,
                    flagAmt = if short > 100 then short else if over then sp - amt else if flag <> null then sc else null
                in
                    [BH = BH, AsAt = AsAt, File = name, Kind = "CONSO", Source = Get(r, cSrc), Line = line, UnitType = ut, UnitsOfficial = official, UnitsSpent = spentShare,
                     UnitsOrdered = u, Doc = po, PO = if isPo then po else null, Description = desc, Detail = Get(r, cDl), Supplier = Get(r, cSup), POAmount = amt, Spent = sp,
                     Committed = sc - sp, SpentCommitted = sc, Status = status, Date = ToDate(Get(r, cDt)), Month = null, Amount = null, Posted = null, Flag = flag, FlagAmount = flagAmt, Levy = levy]),
            InvOut = List.Transform(invRows, (r) =>
                let po = Text.From(Get(r, iPo) ?? ""), info = Record.FieldOrDefault(poInfo, po, null), d = ToDate(Get(r, iDg)), dd = if d = null then ToDate(Get(r, iPe)) else d in
                    [BH = BH, AsAt = AsAt, File = name, Kind = "POSTING", Source = "Invoice", Line = if info = null then null else info[Line], UnitType = null, UnitsOfficial = null, UnitsSpent = null,
                     UnitsOrdered = null, Doc = Text.From(Get(r, iNo)), PO = po, Description = if info = null then Get(r, iD) else info[Desc], Detail = Get(r, iD),
                     Supplier = if info = null then null else info[Supplier], POAmount = null, Spent = null, Committed = null, SpentCommitted = null, Status = null,
                     Date = dd, Month = if dd = null then null else Date.ToText(dd, "yyyy-MM"), Amount = Num(Get(r, iAm)), Posted = Get(r, iPf), Flag = null, FlagAmount = null, Levy = false]),
            gAd = Col(gl, {"accountingdate"}), gPe = Col(gl, {"period"}), gNo = Col(gl, {"glnumber"}), gLn = Col(gl, {"reportingline"}),
            gD = Col(gl, {"description"}), gDl = Col(gl, {"linedescription"}), gSp = Col(gl, {"spent"}), gPf = Col(gl, {"postingflag"}),
            glRows = if gl = null then {} else List.Select(Table.ToRecords(gl), (r) => Text.From(Get(r, gNo) ?? "") <> "" and (try Number.From(Get(r, gSp)) otherwise null) <> null),
            GlOut = List.Transform(glRows, (r) =>
                let d = ToDate(Get(r, gAd)), dd = if d = null then ToDate(Get(r, gPe)) else d, l = Text.Trim(Text.From(Get(r, gLn) ?? "")),
                    desc = Text.From(Get(r, gD) ?? ""), lv = (l = "" or l = "0") and (Text.Contains(Text.Upper(desc), "TRANCHE") or Text.Contains(Text.Upper(desc), "PRELEV")) in
                    [BH = BH, AsAt = AsAt, File = name, Kind = "POSTING", Source = "GL", Line = if l = "" then "0" else l, UnitType = null, UnitsOfficial = null, UnitsSpent = null,
                     UnitsOrdered = null, Doc = Text.From(Get(r, gNo)), PO = null, Description = desc, Detail = Get(r, gDl), Supplier = null, POAmount = null, Spent = null,
                     Committed = null, SpentCommitted = null, Status = null, Date = dd, Month = if dd = null then null else Date.ToText(dd, "yyyy-MM"), Amount = Num(Get(r, gSp)),
                     Posted = Get(r, gPf), Flag = null, FlagAmount = null, Levy = lv]),
            all = Table.FromRecords(ConsoOut & InvOut & GlOut)
        in
            if conso = null then #table({"BH"}, {}) else all,

    Files = Table.SelectRows(Folder.Files(Folder), each List.Contains({".xlsx", ".xlsm", ".xls"}, Text.Lower([Extension])) and not Text.StartsWith([Name], "~$")),
    Parts = List.Transform(Table.ToRecords(Files), (f) => try OneFile(f[Content], f[Name]) otherwise #table({"BH"}, {})),
    Combined = Table.Combine(Parts),
    // Keep only the latest file of each budget head (by situation date)
    Latest = Table.Group(Table.SelectRows(Combined, each [BH] <> null), {"BH"}, {{"AsAtMax", each List.Max([AsAt]), type nullable date}}),
    Joined = Table.Join(Combined, "BH", Latest, "BH"),
    Kept = Table.SelectRows(Joined, each [AsAt] = [AsAtMax]),
    Cols = {"BH", "AsAt", "File", "Kind", "Source", "Line", "UnitType", "UnitsOfficial", "UnitsSpent", "UnitsOrdered", "Doc", "PO", "Description", "Detail", "Supplier",
            "POAmount", "Spent", "Committed", "SpentCommitted", "Status", "Date", "Month", "Amount", "Posted", "Flag", "FlagAmount", "Levy"},
    Out = Table.SelectColumns(Kept, Cols, MissingField.UseNull),
    Typed = Table.TransformColumnTypes(Out, {{"BH", type text}, {"AsAt", type date}, {"Line", type text}, {"Doc", type text}, {"PO", type text}, {"Date", type date},
        {"UnitsOfficial", type number}, {"UnitsSpent", type number}, {"UnitsOrdered", type number}, {"POAmount", type number}, {"Spent", type number},
        {"Committed", type number}, {"SpentCommitted", type number}, {"Amount", type number}, {"FlagAmount", type number}, {"Levy", type logical}})
in
    Typed
