// Report — the official financial report of every project, row by row in the layout of the REPORT sheet:
// budget lines (headings included) with budget and actual units, rates and amounts (units as the official report
// counts them), a sub-total after each heading, then 7, 8, 9, 10 (7% of 9) and 11.
// Lines posted in the extraction but missing from the approved budget are listed under their heading.
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
    Typed
