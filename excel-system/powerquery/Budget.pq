// Budget — the approved budget of every project, read from the REPORT sheet of the official reports in the folder
// named in the cell BudgetsFolder (Home sheet). Project title, contract, JP and BH come from the report's header.
// When several reports exist for one BH, the most recently modified file wins.
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
    Typed
