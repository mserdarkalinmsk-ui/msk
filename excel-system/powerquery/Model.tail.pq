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
