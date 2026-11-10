// Model - the whole analysis in one query. Paste it into Data > Get Data > From Other Sources > Blank Query >
// Advanced Editor, name the query Model, then Close & Load To... > Table > Existing worksheet: Model!$A$1.
// It reads the folders named on the Home sheet (ExtractionsFolder, BudgetsFolder) and the ProjectSettings table.
let
    Data =
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
        Typed,
    Budget =
    let
        Folder = Text.Trim(Text.From(Excel.CurrentWorkbook(){[Name = "BudgetsFolder"]}[Content]{0}[Column1])),
        IsCode = (s as text) => s <> "" and List.AllTrue(List.Transform(Text.ToList(s), each List.Contains({"0".."9", "."}, _))) and not Text.EndsWith(s, ".") and not Text.StartsWith(s, "."),
        OneFile = (content as binary) as table =>
            let
                wb = Excel.Workbook(content, null, true),
                sheets = Table.SelectRows(wb, each [Kind] = "Sheet"),
                pick = Table.SelectRows(sheets, each Text.Upper([Name]) = "REPORT" or Text.Upper([Name]) = "BUDGET"),
                data = if Table.RowCount(pick) > 0 then pick{0}[Data] else sheets{0}[Data],
                rows = Table.ToRows(data),
                firstCol = List.Transform(rows, (r) => Text.From(r{0} ?? "")),
                head = List.FirstN(firstCol, 14),
                lineWith = (k) => List.First(List.Select(head, each Text.Contains(_, k)), ""),
                bhL = lineWith("BH "), BH = if bhL = "" then null else Text.Trim(Text.BeforeDelimiter(Text.AfterDelimiter(bhL, "BH ") & " ", " ")),
                jpL = lineWith("JP "), JP = if jpL = "" then null else Text.Trim(Text.BeforeDelimiter(Text.AfterDelimiter(jpL, "JP ") & " ", " ")),
                cL = lineWith("Contract n"), Contract = if cL = "" then null else Text.Trim(Text.BeforeDelimiter(Text.Range(cL, Text.PositionOf(cL, "Contract n")) & "#(lf)", "#(lf)")),
                segs = List.Transform(head, (h) => Text.Trim(Text.BeforeDelimiter(h & "#(lf)", "#(lf)"))),
                Title = List.First(List.Select(segs, each Text.Length(_) > 8 and not Text.Contains(_, "Contract") and not Text.StartsWith(_, "JP ") and not Text.Contains(_, "BH ") and not Text.Contains(Text.Lower(_), "financial report") and not IsCode(Text.BeforeDelimiter(_, " "))), null),
                lines = List.Select(rows, (r) =>
                    let t = Text.Trim(Text.From(r{0} ?? "")), c = Text.BeforeDelimiter(t, " ") in
                        IsCode(c) and Text.Contains(t, " ") and not Text.StartsWith(t, "Sub-total") and (try Number.From(Text.BeforeDelimiter(c & ".", ".")) otherwise 99) <= 6),
                recs = List.Transform(lines, (r) =>
                    let t = Text.Trim(Text.From(r{0})), c = Text.BeforeDelimiter(t, " "), n = (i) => try Number.From(r{i}) otherwise null in
                        [BH = BH, JP = JP, Title = Title, Contract = Contract, Code = c,
                         Description = Text.Trim(Text.BeforeDelimiter(Text.AfterDelimiter(t, " ") & "#(lf)", "#(lf)")),
                         Unit = if List.Count(r) > 1 then r{1} else null, Units = n(2), Rate = n(3), Cost = n(4)])
            in
                Table.FromRecords(recs),
        Files = Table.SelectRows(Folder.Files(Folder), each List.Contains({".xlsx", ".xlsm", ".xls"}, Text.Lower([Extension])) and not Text.StartsWith([Name], "~$")),
        Sorted = Table.Sort(Files, {{"Date modified", Order.Descending}}),
        Parts = List.Transform(Table.ToRecords(Sorted), (f) => try Table.AddColumn(OneFile(f[Content]), "File", each f[Name]) otherwise #table({"BH"}, {})),
        Combined = Table.Combine(Parts),
        // first (latest) file per BH
        FirstFile = Table.Group(Table.SelectRows(Combined, each [BH] <> null), {"BH"}, {{"FileKept", each List.First([File]), type text}}),
        Kept = Table.SelectRows(Table.Join(Combined, "BH", FirstFile, "BH"), each [File] = [FileKept]),
        Out = Table.SelectColumns(Kept, {"BH", "JP", "Title", "Contract", "Code", "Description", "Unit", "Units", "Rate", "Cost", "File"}, MissingField.UseNull),
        Typed = Table.TransformColumnTypes(Out, {{"BH", type text}, {"JP", type text}, {"Code", type text}, {"Units", type number}, {"Rate", type number}, {"Cost", type number}})
    in
        Typed,
    Report =
    let
        D = Table.SelectRows(Data, each [Kind] = "CONSO" and [Line] <> "0"),
        B = Budget,
        Agg = Table.Group(D, {"BH", "Line"}, {{"AU", each List.Sum([UnitsOfficial]), type number}, {"AUS", each List.Sum([UnitsSpent]), type number},
            {"SP", each List.Sum([Spent]), type number}, {"SC", each List.Sum([SpentCommitted]), type number}}),
        Heads = {"1", "2", "3", "4", "5", "6"},
        HeadName = [#"1" = "Human resources", #"2" = "Travel", #"3" = "Equipment and supplies", #"4" = "Local office", #"5" = "Other costs, services", #"6" = "Other"],
        Top = (c as text) => Text.BeforeDelimiter(c & ".", "."),
        OneBH = (bh as text) as list =>
            let
                bud = Table.ToRecords(Table.SelectRows(B, each [BH] = bh)),
                acts = Table.SelectRows(Agg, each [BH] = bh),
                act = (code) => let t = Table.SelectRows(acts, each [Line] = code) in if Table.RowCount(t) = 0 then [AU = 0, AUS = 0, SP = 0, SC = 0] else t{0},
                budCodes = List.Transform(bud, each [Code]),
                extra = List.Select(acts[Line], (l) => not List.Contains(budCodes, l) and not List.AnyTrue(List.Transform(budCodes, (c) => Text.StartsWith(c, l & ".")))),
                isLeaf = (r) => r[Unit] <> null and Text.Trim(Text.From(r[Unit])) <> "",
                perHead = List.Transform(Heads, (h) =>
                    let
                        rows = List.Select(bud, (r) => Top(r[Code]) = h),
                        lineRows = List.Transform(rows, (r) =>
                            let a = if isLeaf(r) then act(r[Code]) else null in
                                [Kind = if isLeaf(r) then "line" else "head", Code = r[Code], Level = List.Count(Text.Split(r[Code], ".")),
                                 Label = r[Code] & " " & Text.From(r[Description] ?? ""), Unit = r[Unit], BUnits = r[Units], BRate = r[Rate],
                                 BCost = if isLeaf(r) then (if r[Cost] <> null then r[Cost] else if r[Units] <> null and r[Rate] <> null then r[Units] * r[Rate] else 0) else null,
                                 AUnits = if a = null then null else a[AU], AUnitsSpent = if a = null then null else a[AUS],
                                 Spent = if a = null then null else a[SP], SC = if a = null then null else a[SC]]),
                        extraRows = List.Transform(List.Select(extra, (l) => Top(l) = h), (l) => let a = act(l) in
                            [Kind = "line", Code = l, Level = List.Count(Text.Split(l, ".")), Label = l & " (not in the approved budget)", Unit = null, BUnits = null, BRate = null,
                             BCost = 0, AUnits = a[AU], AUnitsSpent = a[AUS], Spent = a[SP], SC = a[SC]]),
                        leaves = List.Select(lineRows & extraRows, each [Kind] = "line"),
                        sum = (f) => List.Sum(List.Transform(leaves, (x) => Record.Field(x, f) ?? 0)),
                        name = let first = List.First(List.Select(rows, (r) => r[Code] = h), null) in if first <> null then Text.From(first[Description] ?? "") else Record.FieldOrDefault(HeadName, h, ""),
                        sub = [Kind = "sub", Code = h, Level = 1, Label = "Sub-total " & h & " " & name, Unit = null, BUnits = null, BRate = null,
                               BCost = sum("BCost"), AUnits = null, AUnitsSpent = null, Spent = sum("Spent"), SC = sum("SC")]
                    in
                        if List.IsEmpty(rows) and List.IsEmpty(extraRows) then {} else lineRows & extraRows & {sub}),
                body = List.Combine(perHead),
                subs = List.Select(body, each [Kind] = "sub"),
                t = (f) => List.Sum(List.Transform(subs, (x) => Record.Field(x, f) ?? 0)),
                r7 = [Kind = "total", Code = "7", Level = 0, Label = "7. Sub-total Direct eligible costs of the action (1+2+3+4+5+6)", Unit = null, BUnits = null, BRate = null, BCost = t("BCost"), AUnits = null, AUnitsSpent = null, Spent = t("Spent"), SC = t("SC")],
                r8 = [Kind = "total8", Code = "8", Level = 0, Label = "8. Provision for contingency reserve (maximum 5% of 7. Sub-total of direct eligible costs of the Action)", Unit = null, BUnits = null, BRate = null, BCost = 0, AUnits = null, AUnitsSpent = null, Spent = 0, SC = 0],
                r9 = [Kind = "total", Code = "9", Level = 0, Label = "9. Total direct eligible costs of the action (7 + 8)", Unit = null, BUnits = null, BRate = null, BCost = r7[BCost], AUnits = null, AUnitsSpent = null, Spent = r7[Spent], SC = r7[SC]],
                r10 = [Kind = "admin", Code = "10", Level = 0, Label = "10. Administrative costs (maximum 7% of 9. Total direct eligible costs of the action) (3)", Unit = null, BUnits = null, BRate = null,
                       BCost = Number.Round(r9[BCost] * 0.07, 2), AUnits = null, AUnitsSpent = null, Spent = Number.Round(r9[Spent] * 0.07, 2), SC = Number.Round(r9[SC] * 0.07, 2)],
                r11 = [Kind = "total11", Code = "11", Level = 0, Label = "11. Total eligible costs (9 + 10)", Unit = null, BUnits = null, BRate = null, BCost = r9[BCost] + r10[BCost], AUnits = null, AUnitsSpent = null, Spent = r9[Spent] + r10[Spent], SC = r9[SC] + r10[SC]],
                all = body & {r7, r8, r9, r10, r11}
            in
                List.Transform(List.Positions(all), (i) => all{i} & [BH = bh, Seq = i + 1]),
        BHs = List.Distinct(List.RemoveNulls(B[BH] & Data[BH])),
        Rows = List.Combine(List.Transform(List.Select(BHs, (b) => Table.RowCount(Table.SelectRows(B, each [BH] = b)) > 0), OneBH)),
        T = Table.FromRecords(Rows, {"BH", "Seq", "Kind", "Code", "Level", "Label", "Unit", "BUnits", "BRate", "BCost", "AUnits", "AUnitsSpent", "Spent", "SC"}, MissingField.UseNull),
        WithRate = Table.AddColumn(T, "ARate", each if [AUnits] <> null and [AUnits] <> 0 then [Spent] / [AUnits] else null, type nullable number),
        WithRateS = Table.AddColumn(WithRate, "ARateSpent", each if [AUnitsSpent] <> null and [AUnitsSpent] <> 0 then [Spent] / [AUnitsSpent] else null, type nullable number),
        Key = Table.AddColumn(WithRateS, "Key", each [BH] & "|" & Text.From([Seq]), type text),
        Out = Table.SelectColumns(Key, {"Key", "BH", "Seq", "Kind", "Code", "Level", "Label", "Unit", "BUnits", "BRate", "BCost", "AUnits", "ARate", "Spent", "SC", "AUnitsSpent", "ARateSpent"}),
        Typed = Table.TransformColumnTypes(Out, {{"BH", type text}, {"Seq", Int64.Type}, {"Code", type text}, {"Level", Int64.Type}, {"BUnits", type number}, {"BRate", type number},
            {"BCost", type number}, {"AUnits", type number}, {"Spent", type number}, {"SC", type number}, {"AUnitsSpent", type number}})
    in
        Typed,
    // ---------------------------------------------------------------- project settings typed on the Home sheet
    SettingsRaw = try Excel.CurrentWorkbook(){[Name = "ProjectSettings"]}[Content] otherwise #table({"BH", "Start", "End"}, {}),
    Settings = Table.TransformColumns(Table.SelectRows(SettingsRaw, each [BH] <> null and Text.From([BH]) <> ""), {{"BH", Text.From}}),
    SetOf = (bh as text) => let t = Table.SelectRows(Settings, each [BH] = bh) in if Table.RowCount(t) = 0 then [Start = null, End = null] else t{0},
    AsDate = (v) => if v = null then null else if Value.Is(v, type datetime) then Date.From(v) else if Value.Is(v, type date) then v else try Date.From(v) otherwise null,

    // ---------------------------------------------------------------- generic model rows
    Blank = [Key = null, Rec = null, BH = null, Seq = null, Kind = null, Code = null, Label = null, Unit = null,
             N1 = null, N2 = null, N3 = null, N4 = null, N5 = null, N6 = null, N7 = null, N8 = null, N9 = null, N10 = null, N11 = null, N12 = null,
             T1 = null, T2 = null, T3 = null, T4 = null, D1 = null, D2 = null, D3 = null],
    Row = (r as record) => Blank & r,

    RepRows = List.Transform(Table.ToRecords(Report), (r) => Row([Key = "R|" & r[BH] & "|" & Text.From(r[Seq]), Rec = "R", BH = r[BH], Seq = r[Seq], Kind = r[Kind], Code = r[Code],
        Label = r[Label], Unit = r[Unit], N1 = r[BUnits], N2 = r[BRate], N3 = r[BCost], N4 = r[AUnits], N5 = r[ARate], N6 = r[Spent], N7 = r[SC], N8 = r[AUnitsSpent], N9 = r[ARateSpent], N10 = r[Level]])),

    BHs = List.Sort(List.Distinct(Report[BH])),
    Flags = Table.SelectRows(Data, each [Kind] = "CONSO" and [Flag] <> null),
    HeadRows = List.Combine(List.Transform(BHs, (bh) =>
        let
            s = SetOf(bh), st = AsDate(s[Start]), en = AsDate(s[End]),
            asat = List.Max(Table.SelectRows(Data, each [BH] = bh)[AsAt]),
            el = if st = null or en = null or asat = null or en <= st then null else List.Max({0, List.Min({1, Duration.Days(asat - st) / Duration.Days(en - st)})}),
            subs = Table.ToRecords(Table.SelectRows(Report, each [BH] = bh and [Kind] = "sub"))
        in
            List.Transform(subs, (h) =>
                let
                    b = h[BCost] ?? 0, now = h[SC] ?? 0, proj = if el <> null and el > 0.05 then List.Max({now, (h[Spent] ?? 0) / el}) else now,
                    dn = if b > 0 then now / b - 1 else null, dp = if b > 0 then proj / b - 1 else null,
                    band = (d) => if d > 0.25 then "Addendum (beyond 25%)" else if d > 0.2 then "Near addendum (20-25%)" else "Notification (within 25%)",
                    status = if b <= 0 then "" else if dn > 0.0001 then band(dn) else if dp > 0.0001 then "Risk: " & band(dp) & " at the current pace" else "Within budget"
                in
                    Row([Key = "H|" & bh & "|" & h[Code], Rec = "H", BH = bh, Code = h[Code], Label = Text.AfterDelimiter(h[Label], h[Code] & " "),
                         N1 = b, N2 = h[Spent], N3 = now, N4 = dn, N5 = dp, N6 = proj, T1 = status])))),

    Rank = (s as text) => if Text.StartsWith(s, "Addendum") then 4 else if Text.StartsWith(s, "Near") then 3 else if Text.StartsWith(s, "Notification") then 2 else if Text.StartsWith(s, "Risk:") then 1 else 0,
    ProjRows = List.Transform(List.Positions(BHs), (i) =>
        let
            bh = BHs{i}, s = SetOf(bh), st = AsDate(s[Start]), en = AsDate(s[End]),
            d = Table.SelectRows(Data, each [BH] = bh), asat = List.Max(d[AsAt]),
            bud = Table.SelectRows(Budget, each [BH] = bh), b0 = if Table.RowCount(bud) = 0 then [JP = null, Title = null, Contract = null] else bud{0},
            r11 = Table.SelectRows(Report, each [BH] = bh and [Kind] = "total11"), r7 = Table.SelectRows(Report, each [BH] = bh and [Code] = "7"),
            B = if Table.RowCount(r11) = 0 then 0 else r11{0}[BCost], S = if Table.RowCount(r11) = 0 then 0 else r11{0}[Spent], SC = if Table.RowCount(r11) = 0 then 0 else r11{0}[SC],
            el = if st = null or en = null or asat = null or en <= st then null else List.Max({0, List.Min({1, Duration.Days(asat - st) / Duration.Days(en - st)})}),
            used = if B > 0 then SC / B else null,
            heads = List.Select(HeadRows, each [BH] = bh),
            worst = List.Last(List.Sort(List.Transform(heads, each [T1]), (a, b) => Value.Compare(Rank(a), Rank(b))), "Within budget"),
            nf = Table.RowCount(Table.SelectRows(Flags, each [BH] = bh)),
            lines = Table.SelectRows(Report, each [BH] = bh and [Kind] = "line"),
            over = Table.RowCount(Table.SelectRows(lines, each ([BCost] ?? 0) > 0 and ([SC] ?? 0) > [BCost] + 0.5)),
            notb = Table.RowCount(Table.SelectRows(lines, each ([BCost] ?? 0) = 0 and ([SC] ?? 0) > 0.5)),
            unitsOver = Table.RowCount(Table.SelectRows(lines, each ([BUnits] ?? 0) > 0 and ([AUnitsSpent] ?? 0) > [BUnits] + 0.0001))
        in
            Row([Key = "P|" & Text.From(i + 1), Rec = "P", BH = bh, Seq = i + 1, Code = if b0[JP] <> null then "JP" & b0[JP] else "BH" & bh, Label = b0[Title],
                 N1 = B, N2 = S, N3 = SC, N4 = used, N5 = el, N6 = if used = null or el = null then null else Number.Round((used - el) * 100, 1),
                 N7 = over + notb + (if Rank(worst) = 4 then 1 else 0), N8 = nf + unitsOver + (if Rank(worst) = 3 then 1 else 0), N9 = if Table.RowCount(r7) = 0 then 0 else r7{0}[BCost],
                 N10 = if Table.RowCount(r7) = 0 then 0 else r7{0}[Spent], N11 = if Table.RowCount(r7) = 0 then 0 else r7{0}[SC], N12 = B - SC,
                 T1 = b0[Title], T2 = b0[Contract], T3 = b0[JP], T4 = worst, D1 = asat, D2 = st, D3 = en])),
    ProjByBH = List.Transform(ProjRows, (p) => p & [Key = "PB|" & p[BH]]),

    CheckRows = List.Combine(List.Transform(BHs, (bh) =>
        let f = Table.ToRecords(Table.Sort(Table.SelectRows(Flags, each [BH] = bh), {{"FlagAmount", Order.Descending}})) in
            List.Transform(List.Positions(f), (k) => let r = f{k} in Row([Key = "C|" & bh & "|" & Text.From(k + 1), Rec = "C", BH = bh, Seq = k + 1, Code = r[Line],
                Label = r[Flag], T1 = r[Doc], T2 = r[Description], T3 = r[Supplier], N1 = r[FlagAmount], D1 = r[Date]])))),

    Posts = Table.SelectRows(Data, each [Kind] = "POSTING"),
    PostRows = List.Combine(List.Transform(BHs, (bh) =>
        let p = Table.ToRecords(Table.Sort(Table.SelectRows(Posts, each [BH] = bh), {{"Date", Order.Ascending}})) in
            List.Transform(List.Positions(p), (k) => let r = p{k} in Row([Key = "T|" & bh & "|" & Text.From(k + 1), Rec = "T", BH = bh, Seq = k + 1, Code = r[Line],
                Kind = r[Source], Label = r[Description], T1 = r[Doc], T2 = r[PO], T3 = r[Supplier], T4 = r[Posted], N1 = r[Amount], D1 = r[Date],
                N2 = if r[Levy] = true then 1 else 0])))),

    Model = Table.FromRecords(RepRows & ProjRows & ProjByBH & HeadRows & CheckRows & PostRows, Record.FieldNames(Blank), MissingField.UseNull),
    Typed = Table.TransformColumnTypes(Model, {{"Key", type text}, {"Rec", type text}, {"BH", type text}, {"Seq", Int64.Type}, {"Code", type text},
        {"N1", type number}, {"N2", type number}, {"N3", type number}, {"N4", type number}, {"N5", type number}, {"N6", type number}, {"N7", type number},
        {"N8", type number}, {"N9", type number}, {"N10", type number}, {"N11", type number}, {"N12", type number}, {"D1", type date}, {"D2", type date}, {"D3", type date}})
in
    Typed
