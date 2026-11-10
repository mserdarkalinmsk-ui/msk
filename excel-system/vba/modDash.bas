Attribute VB_Name = "modDash"
Option Explicit
' ---------------------------------------------------------------------------------------------
' Dashboards in the spirit of a BI report: a dark header band, KPI tiles, tables with data bars and
' status colours, and native Excel charts in one palette.
'   Portfolio          every project: tiles, register table, budget vs spent chart, used vs time chart,
'                      monthly spending of the portfolio, heading status heat map
'   Project dashboard  the selected project: tiles, headings chart, cumulative spending vs plan,
'                      heading statuses and the lines that need attention
' ---------------------------------------------------------------------------------------------

Private Const NAVY As Long = 8998687        ' RGB(31,78,137)
Private Const INK As Long = 3355443         ' RGB(51,51,51)
Private Const MUTED As Long = 8421504       ' RGB(128,128,128)
Private Const CARD As Long = 16777215
Private Const PAGE As Long = 16316664       ' RGB(248,248,248)
Private Const C1 As Long = 14054442         ' RGB(42,120,214)  spent
Private Const C2 As Long = 15910829         ' RGB(173,198,242) committed (light)
Private Const C3 As Long = 12566463         ' RGB(191,191,191) budget
Private Const C4 As Long = 3439339          ' RGB(235,123,52)  time / plan
Private Const RED As Long = 5263615         ' RGB(255,80,80)
Private Const AMBER As Long = 3381759       ' RGB(255,153,51)
Private Const GREEN As Long = 5287936       ' RGB(0,176,80)

Private Sub Band(ws As Worksheet, title As String, subtitle As String)
    ws.Cells.Interior.Color = PAGE
    ws.Cells.Font.Name = "Segoe UI": ws.Cells.Font.Size = 10: ws.Cells.Font.Color = INK
    ActiveWindow.DisplayGridlines = False
    With ws.Range("A1:Z3")
        .Interior.Color = NAVY: .Font.Color = vbWhite
    End With
    ws.Range("B1").Value = title: ws.Range("B1").Font.Size = 20: ws.Range("B1").Font.Bold = True
    ws.Range("B2").Value = subtitle: ws.Range("B2").Font.Size = 10
    ws.Rows(1).RowHeight = 30: ws.Rows(2).RowHeight = 18: ws.Rows(3).RowHeight = 8
    ws.Columns("A").ColumnWidth = 2
End Sub

' A KPI tile: label, big value, context line, in a white card spanning cols c..c+w-1, rows r..r+3.
Private Sub Tile(ws As Worksheet, r As Long, c As Long, w As Long, label As String, value As String, ctx As String, Optional accent As Long = -1)
    Dim rg As Range
    Set rg = ws.Range(ws.Cells(r, c), ws.Cells(r + 3, c + w - 1))
    rg.Interior.Color = CARD
    rg.Borders.LineStyle = xlNone
    With rg.Borders(xlEdgeTop)
        .LineStyle = xlContinuous: .Weight = xlThick: .Color = IIf(accent = -1, NAVY, accent)
    End With
    ws.Cells(r, c).Value = UCase$(label): ws.Cells(r, c).Font.Size = 8: ws.Cells(r, c).Font.Bold = True: ws.Cells(r, c).Font.Color = MUTED
    ws.Cells(r + 1, c).Value = value: ws.Cells(r + 1, c).Font.Size = 20: ws.Cells(r + 1, c).Font.Bold = True
    ws.Cells(r + 2, c).Value = ctx: ws.Cells(r + 2, c).Font.Size = 8: ws.Cells(r + 2, c).Font.Color = MUTED
    ws.Range(ws.Cells(r + 1, c), ws.Cells(r + 1, c + w - 1)).Merge
    ws.Range(ws.Cells(r + 2, c), ws.Cells(r + 2, c + w - 1)).Merge
    ws.Range(ws.Cells(r, c), ws.Cells(r + 3, c)).IndentLevel = 1
End Sub

Private Function EurShort(v As Double) As String
    If Abs(v) >= 1000000 Then
        EurShort = Fmt(v / 1000000, "0.00") & "M"
    ElseIf Abs(v) >= 1000 Then
        EurShort = Fmt(v / 1000, "0.0") & "K"
    Else
        EurShort = Fmt(v, "0")
    End If
    EurShort = ChrW(8364) & EurShort
End Function

Private Sub StyleChart(co As ChartObject, title As String)
    With co.Chart
        .HasTitle = True
        .ChartTitle.Text = title
        .ChartTitle.Format.TextFrame2.TextRange.Font.Size = 11
        .ChartTitle.Format.TextFrame2.TextRange.Font.Bold = -1
        .ChartArea.Format.Line.Visible = 0
        .ChartArea.Format.Fill.ForeColor.RGB = CARD
        .PlotArea.Format.Fill.Visible = 0
        .HasLegend = True
        .Legend.Position = xlLegendPositionTop
        .Legend.Format.TextFrame2.TextRange.Font.Size = 8
    End With
    On Error Resume Next
    co.Chart.Axes(xlValue).MajorGridlines.Format.Line.ForeColor.RGB = RGB(230, 230, 230)
    co.Chart.Axes(xlValue).TickLabels.Font.Size = 8
    co.Chart.Axes(xlCategory).TickLabels.Font.Size = 8
    co.Chart.Axes(xlValue).Format.Line.Visible = 0
End Sub

Private Function AddChart(ws As Worksheet, at As Range, wCells As Long, hRows As Long) As ChartObject
    Dim w As Double, h As Double
    w = ws.Range(at, at.Offset(0, wCells - 1)).Width
    h = ws.Range(at, at.Offset(hRows - 1, 0)).Height
    Set AddChart = ws.ChartObjects.Add(at.Left, at.Top, w, h)
End Function

Private Sub Colour(c As Range, status As String)
    If Left$(status, 8) = "Addendum" Or status = "Over budget" Or status = "Not in the budget" Then
        c.Interior.Color = RGB(255, 204, 204): c.Font.Color = RGB(156, 0, 6)
    ElseIf Left$(status, 4) = "Near" Then
        c.Interior.Color = RGB(255, 199, 140): c.Font.Color = RGB(130, 60, 0)
    ElseIf Left$(status, 12) = "Notification" Or Left$(status, 5) = "Units" Then
        c.Interior.Color = RGB(255, 235, 156): c.Font.Color = RGB(156, 101, 0)
    ElseIf Left$(status, 5) = "Risk:" Or Left$(status, 5) = "Ahead" Then
        c.Interior.Color = RGB(255, 242, 204): c.Font.Color = RGB(156, 101, 0)
    ElseIf status = "Behind time" Then
        c.Interior.Color = RGB(235, 235, 235): c.Font.Color = MUTED
    ElseIf status <> "" Then
        c.Interior.Color = RGB(198, 239, 206): c.Font.Color = RGB(0, 97, 0)
    End If
End Sub

' ======================================================================= Portfolio
Public Sub BuildPortfolio()
    Dim ws As Worksheet, rg As Worksheet, n As Long, r As Long, i As Long, tb As Double, ts As Double, tsc As Double, te As Long, tc As Long
    Dim t0 As Long, row0 As Long, wtime As Double
    Set rg = Reg()
    Set ws = Fresh(SH_PORTFOLIO)
    ws.Activate
    n = rg.Cells(rg.Rows.Count, 1).End(xlUp).Row - 1
    Call Band(ws, "Portfolio", n & " project(s) - figures as at each project's latest extraction - " & Fmt(Now, "dd/mm/yyyy hh:nn"))
    For r = 2 To n + 1
        tb = tb + Num(rg.Cells(r, 14).Value): ts = ts + Num(rg.Cells(r, 15).Value): tsc = tsc + Num(rg.Cells(r, 16).Value)
        te = te + Num(rg.Cells(r, 20).Value): tc = tc + Num(rg.Cells(r, 21).Value)
        wtime = wtime + Num(rg.Cells(r, 18).Value) * Num(rg.Cells(r, 14).Value)
    Next r
    If tb > 0 Then wtime = wtime / tb
    ws.Columns("B:Y").ColumnWidth = 9.5
    Call Tile(ws, 5, 2, 3, "Projects", CStr(n), "budget heads in this workbook")
    Call Tile(ws, 5, 6, 3, "Total budget", EurShort(tb), "total eligible costs")
    Call Tile(ws, 5, 10, 3, "Spent", EurShort(ts), Fmt(IIf(tb > 0, ts / tb, 0), "0%") & " of budget", C1)
    Call Tile(ws, 5, 14, 3, "Spent + committed", EurShort(tsc), Fmt(IIf(tb > 0, tsc / tb, 0), "0%") & " used - " & Fmt(wtime, "0%") & " of time", C1)
    Call Tile(ws, 5, 18, 3, "Available", EurShort(tb - tsc), "budget not yet spent or committed", GREEN)
    Call Tile(ws, 5, 22, 3, "Flags", te & " / " & tc, "errors / items to check", IIf(te > 0, RED, AMBER))
    ' Register table
    row0 = 10
    ws.Cells(row0, 2).Value = "Projects": ws.Cells(row0, 2).Font.Size = 12: ws.Cells(row0, 2).Font.Bold = True
    Dim hdr As Variant: hdr = Array("Code", "Project", "BH", "Budget", "Spent", "Spent + committed", "Used", "Time", "Pace", "Worst heading", "Errors", "Check", "As at")
    Dim cols As Variant: cols = Array(2, 3, 7, 8, 10, 12, 14, 15, 16, 17, 21, 22, 23)
    For i = 0 To UBound(hdr)
        ws.Cells(row0 + 1, cols(i)).Value = hdr(i)
    Next i
    ws.Range(ws.Cells(row0 + 1, 2), ws.Cells(row0 + 1, 24)).Font.Bold = True
    ws.Range(ws.Cells(row0 + 1, 2), ws.Cells(row0 + 1, 24)).Font.Color = MUTED
    ws.Range(ws.Cells(row0 + 1, 2), ws.Cells(row0 + 1, 24)).Borders(xlEdgeBottom).Color = NAVY
    For r = 2 To n + 1
        i = row0 + r
        ws.Cells(i, 2).Value = rg.Cells(r, 2).Value
        ws.Cells(i, 3).Value = rg.Cells(r, 3).Value: ws.Range(ws.Cells(i, 3), ws.Cells(i, 6)).Merge
        ws.Cells(i, 7).NumberFormat = "@": ws.Cells(i, 7).Value = CStr(rg.Cells(r, 1).Value)
        ws.Cells(i, 8).Value = rg.Cells(r, 14).Value: ws.Range(ws.Cells(i, 8), ws.Cells(i, 9)).Merge
        ws.Cells(i, 10).Value = rg.Cells(r, 15).Value: ws.Range(ws.Cells(i, 10), ws.Cells(i, 11)).Merge
        ws.Cells(i, 12).Value = rg.Cells(r, 16).Value: ws.Range(ws.Cells(i, 12), ws.Cells(i, 13)).Merge
        ws.Cells(i, 14).Value = rg.Cells(r, 17).Value: ws.Cells(i, 15).Value = rg.Cells(r, 18).Value
        ws.Cells(i, 16).Value = rg.Cells(r, 19).Value
        ws.Cells(i, 17).Value = rg.Cells(r, 22).Value: ws.Range(ws.Cells(i, 17), ws.Cells(i, 20)).Merge
        Call Colour(ws.Range(ws.Cells(i, 17), ws.Cells(i, 20)), CStr(rg.Cells(r, 22).Value))
        ws.Cells(i, 21).Value = rg.Cells(r, 20).Value: ws.Cells(i, 22).Value = rg.Cells(r, 21).Value
        ws.Cells(i, 23).Value = rg.Cells(r, 13).Value: ws.Range(ws.Cells(i, 23), ws.Cells(i, 24)).Merge
        If Num(rg.Cells(r, 20).Value) > 0 Then ws.Cells(i, 21).Font.Color = RED: ws.Cells(i, 21).Font.Bold = True
        ws.Range(ws.Cells(i, 2), ws.Cells(i, 24)).Interior.Color = CARD
        ws.Range(ws.Cells(i, 2), ws.Cells(i, 24)).Borders(xlEdgeBottom).Color = RGB(230, 230, 230)
        If Num(rg.Cells(r, 19).Value) < -15 Then ws.Cells(i, 16).Font.Color = AMBER
        If Num(rg.Cells(r, 19).Value) > 15 Then ws.Cells(i, 16).Font.Color = RED
    Next r
    If n > 0 Then
        ws.Range(ws.Cells(row0 + 2, 8), ws.Cells(row0 + n + 1, 13)).NumberFormat = "#,##0"
        ws.Range(ws.Cells(row0 + 2, 14), ws.Cells(row0 + n + 1, 15)).NumberFormat = "0%"
        ws.Range(ws.Cells(row0 + 2, 16), ws.Cells(row0 + n + 1, 16)).NumberFormat = "+0;-0;0"
        ws.Range(ws.Cells(row0 + 2, 23), ws.Cells(row0 + n + 1, 23)).NumberFormat = "dd/mm/yyyy"
        With ws.Range(ws.Cells(row0 + 2, 14), ws.Cells(row0 + n + 1, 14)).FormatConditions.AddDatabar
            .BarColor.Color = C1: .MinPoint.Modify newtype:=xlConditionValueNumber, newvalue:=0: .MaxPoint.Modify newtype:=xlConditionValueNumber, newvalue:=1
        End With
    End If
    ' Chart data (hidden helper block, columns AB onwards)
    Dim h As Long: h = 6
    ws.Range("AB5:AF5").Value = Array("Project", "Budget", "Spent", "Committed", "Used %")
    ws.Range("AG5").Value = "Time %"
    For r = 2 To n + 1
        ws.Cells(h + r - 2, 28).Value = rg.Cells(r, 2).Value
        ws.Cells(h + r - 2, 29).Value = rg.Cells(r, 14).Value
        ws.Cells(h + r - 2, 30).Value = rg.Cells(r, 15).Value
        ws.Cells(h + r - 2, 31).Value = Num(rg.Cells(r, 16).Value) - Num(rg.Cells(r, 15).Value)
        ws.Cells(h + r - 2, 32).Value = rg.Cells(r, 17).Value
        ws.Cells(h + r - 2, 33).Value = rg.Cells(r, 18).Value
    Next r
    t0 = row0 + n + 4
    If n > 0 Then
        Dim co As ChartObject, s As Series
        ' 1. Budget, spent, committed by project
        Set co = AddChart(ws, ws.Cells(t0, 2), 11, 18)
        co.Chart.ChartType = xlBarStacked
        Do While co.Chart.SeriesCollection.Count > 0: co.Chart.SeriesCollection(1).Delete: Loop
        Set s = co.Chart.SeriesCollection.NewSeries: s.Name = "Spent": s.Values = ws.Range(ws.Cells(h, 30), ws.Cells(h + n - 1, 30)): s.XValues = ws.Range(ws.Cells(h, 28), ws.Cells(h + n - 1, 28)): s.Format.Fill.ForeColor.RGB = C1
        Set s = co.Chart.SeriesCollection.NewSeries: s.Name = "Committed": s.Values = ws.Range(ws.Cells(h, 31), ws.Cells(h + n - 1, 31)): s.XValues = ws.Range(ws.Cells(h, 28), ws.Cells(h + n - 1, 28)): s.Format.Fill.ForeColor.RGB = C2
        Set s = co.Chart.SeriesCollection.NewSeries: s.Name = "Budget": s.Values = ws.Range(ws.Cells(h, 29), ws.Cells(h + n - 1, 29)): s.XValues = ws.Range(ws.Cells(h, 28), ws.Cells(h + n - 1, 28))
        s.AxisGroup = xlSecondary: s.ChartType = xlBarClustered: s.Format.Fill.Visible = 0: s.Format.Line.ForeColor.RGB = INK: s.Format.Line.Weight = 1.25
        On Error Resume Next
        co.Chart.Axes(xlValue, xlSecondary).MinimumScale = 0: co.Chart.Axes(xlValue, xlPrimary).MinimumScale = 0
        co.Chart.Axes(xlValue, xlSecondary).MaximumScale = co.Chart.Axes(xlValue, xlPrimary).MaximumScale
        co.Chart.HasAxis(xlValue, xlSecondary) = False
        co.Chart.Axes(xlCategory).ReversePlotOrder = True
        On Error GoTo 0
        Call StyleChart(co, "Budget, spent and committed by project")
        ' 2. Used vs time
        Set co = AddChart(ws, ws.Cells(t0, 14), 11, 18)
        co.Chart.ChartType = xlBarClustered
        Do While co.Chart.SeriesCollection.Count > 0: co.Chart.SeriesCollection(1).Delete: Loop
        Set s = co.Chart.SeriesCollection.NewSeries: s.Name = "Used (spent + committed)": s.Values = ws.Range(ws.Cells(h, 32), ws.Cells(h + n - 1, 32)): s.XValues = ws.Range(ws.Cells(h, 28), ws.Cells(h + n - 1, 28)): s.Format.Fill.ForeColor.RGB = C1
        Set s = co.Chart.SeriesCollection.NewSeries: s.Name = "Time elapsed": s.Values = ws.Range(ws.Cells(h, 33), ws.Cells(h + n - 1, 33)): s.XValues = ws.Range(ws.Cells(h, 28), ws.Cells(h + n - 1, 28)): s.Format.Fill.ForeColor.RGB = C4
        On Error Resume Next
        co.Chart.Axes(xlValue).TickLabels.NumberFormat = "0%": co.Chart.Axes(xlValue).MinimumScale = 0
        co.Chart.Axes(xlCategory).ReversePlotOrder = True
        On Error GoTo 0
        Call StyleChart(co, "Used against time elapsed")
    End If
    ' 3. Monthly spending of the portfolio
    Dim ms As Worksheet, months As Object, k As Variant, j As Long, mrow As Long
    If SheetExists(SH_MONTHLY) Then
        Set ms = Sh(SH_MONTHLY): Set months = CreateObject("Scripting.Dictionary")
        For j = 2 To ms.Cells(ms.Rows.Count, 1).End(xlUp).Row
            k = Fmt(ms.Cells(j, 2).Value, "yyyy-mm")
            months(k) = months(k) + Num(ms.Cells(j, 3).Value)
        Next j
        If months.Count > 0 Then
            Dim keys() As String, cum As Double
            ReDim keys(0 To months.Count - 1): j = 0
            For Each k In months.keys: keys(j) = k: j = j + 1: Next k
            Call SortCodes(keys)
            ws.Range("AI5:AK5").Value = Array("Month", "Spent", "Cumulative")
            For j = 0 To UBound(keys)
                cum = cum + months(keys(j))
                ws.Cells(6 + j, 35).Value = DateSerial(CInt(Left$(keys(j), 4)), CInt(Right$(keys(j), 2)), 1)
                ws.Cells(6 + j, 36).Value = months(keys(j)): ws.Cells(6 + j, 37).Value = cum
            Next j
            ws.Range("AI6:AI" & 6 + UBound(keys)).NumberFormat = "mmm yy"
            mrow = t0 + 20
            Set co = AddChart(ws, ws.Cells(mrow, 2), 23, 16)
            co.Chart.ChartType = xlColumnClustered
            Do While co.Chart.SeriesCollection.Count > 0: co.Chart.SeriesCollection(1).Delete: Loop
            Set s = co.Chart.SeriesCollection.NewSeries: s.Name = "Spent in the month": s.Values = ws.Range("AJ6:AJ" & 6 + UBound(keys)): s.XValues = ws.Range("AI6:AI" & 6 + UBound(keys)): s.Format.Fill.ForeColor.RGB = C1
            Set s = co.Chart.SeriesCollection.NewSeries: s.Name = "Cumulative": s.Values = ws.Range("AK6:AK" & 6 + UBound(keys)): s.XValues = ws.Range("AI6:AI" & 6 + UBound(keys))
            s.ChartType = xlLine: s.AxisGroup = xlSecondary: s.Format.Line.ForeColor.RGB = C4: s.Format.Line.Weight = 2.25
            Call StyleChart(co, "Spending of the portfolio by month (invoices and GL postings)")
        End If
    End If
    ' 4. Heading status heat map
    Dim hs As Worksheet, hr As Long, hc As Long, top As Long
    top = t0 + 38
    ws.Cells(top, 2).Value = "Headings against the 25% flexibility": ws.Cells(top, 2).Font.Size = 12: ws.Cells(top, 2).Font.Bold = True
    ws.Cells(top + 1, 2).Value = "Spent + committed against the heading budget - green within budget - yellow notification - orange near addendum (20-25%) - red addendum (>25%) - pale = risk at the current pace"
    ws.Cells(top + 1, 2).Font.Size = 8: ws.Cells(top + 1, 2).Font.Color = MUTED
    For hc = 1 To 6
        ws.Cells(top + 2, 6 + (hc - 1) * 3).Value = hc & " " & Choose(hc, "Human resources", "Travel", "Equipment", "Local office", "Other costs", "Other")
        ws.Cells(top + 2, 6 + (hc - 1) * 3).Font.Bold = True: ws.Cells(top + 2, 6 + (hc - 1) * 3).Font.Color = MUTED
    Next hc
    If SheetExists(SH_HEADS) Then
        Set hs = Sh(SH_HEADS)
        For r = 2 To n + 1
            hr = top + 1 + r
            ws.Cells(hr, 2).Value = rg.Cells(r, 2).Value: ws.Cells(hr, 2).Font.Bold = True
            For j = 2 To hs.Cells(hs.Rows.Count, 1).End(xlUp).Row
                If CStr(hs.Cells(j, 1).Value) = CStr(rg.Cells(r, 1).Value) And Val(hs.Cells(j, 2).Value) >= 1 And Val(hs.Cells(j, 2).Value) <= 6 Then
                    hc = 6 + (Val(hs.Cells(j, 2).Value) - 1) * 3
                    With ws.Range(ws.Cells(hr, hc), ws.Cells(hr, hc + 2))
                        .Merge
                        .Value = IIf(Num(hs.Cells(j, 4).Value) > 0, Fmt(Num(hs.Cells(j, 5).Value) / Num(hs.Cells(j, 4).Value), "0%"), "-")
                        .HorizontalAlignment = xlCenter
                    End With
                    Call Colour(ws.Range(ws.Cells(hr, hc), ws.Cells(hr, hc + 2)), CStr(hs.Cells(j, 7).Value))
                    ws.Cells(hr, hc).AddComment CStr(hs.Cells(j, 3).Value) & ": " & CStr(hs.Cells(j, 7).Value)
                End If
            Next j
        Next r
    End If
    ws.Columns("AB:AK").Hidden = True
    ws.Range("A1").Select
    With ws.PageSetup
        .Orientation = xlLandscape: .Zoom = False: .FitToPagesWide = 1: .FitToPagesTall = False
    End With
End Sub

' ======================================================================= Project dashboard
Public Sub BuildProjectDashboard()
    Dim ws As Worksheet, rg As Worksheet, r As Long, bh As String, an As Worksheet, i As Long, n As Long, list As String
    Dim b As Double, s As Double, sc As Double, tg As Double
    bh = CurrentBH()
    Set rg = Reg(): Set an = Sh(SH_ANALYSIS)
    Set ws = Fresh(SH_PROJECTDASH)
    ws.Activate
    r = RegRow(bh)
    Call Band(ws, CStr(IIf(r > 0, rg.Cells(r, 3).Value, "Project")), "BH " & bh & " - situation " & Fmt(ToDate(Setting("Situation date")), "dd/mm/yyyy") & " - " & CStr(Setting("Source file")))
    ws.Columns("B:Y").ColumnWidth = 9.5
    ' Project picker
    ws.Range("B4").Value = "Project": ws.Range("B4").Font.Bold = True
    For i = 2 To rg.Cells(rg.Rows.Count, 1).End(xlUp).Row
        list = list & IIf(list = "", "", ",") & "BH" & rg.Cells(i, 1).Value & " " & Replace(Left$(CStr(rg.Cells(i, 2).Value), 30), ",", " ")
        If CStr(rg.Cells(i, 1).Value) = bh Then ws.Range("C4").Value = "BH" & bh & " " & Replace(Left$(CStr(rg.Cells(i, 2).Value), 30), ",", " ")
    Next i
    ws.Range("C4:G4").Merge: ws.Range("C4").Interior.Color = RGB(255, 242, 204)
    If list <> "" Then
        With ws.Range("C4").Validation
            .Delete
            .Add Type:=xlValidateList, Formula1:=list
        End With
    End If
    Dim btn As Shape
    Set btn = ws.Shapes.AddShape(5, ws.Range("H4").Left + 4, ws.Range("H4").Top, 90, ws.Range("H4").Height)
    btn.Fill.ForeColor.RGB = NAVY: btn.Line.Visible = 0
    btn.TextFrame2.TextRange.Text = "Open": btn.TextFrame2.TextRange.Font.Size = 9: btn.TextFrame2.TextRange.Font.Bold = -1
    btn.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = vbWhite: btn.TextFrame2.VerticalAnchor = 3: btn.TextFrame2.TextRange.ParagraphFormat.Alignment = 2
    btn.OnAction = "OpenSelected"
    ' Tiles
    Dim r11 As Long, rep As Worksheet
    Set rep = Sh(SH_REPORT)
    For i = 1 To rep.UsedRange.Rows.Count + rep.UsedRange.Row
        If Left$(CStr(rep.Cells(i, 1).Value), 3) = "11." Then r11 = i
    Next i
    If r11 > 0 Then b = Num(rep.Cells(r11, 5).Value): s = Num(rep.Cells(r11, 8).Value): sc = Num(rep.Cells(r11, 9).Value)
    tg = TimeGone()
    Call Tile(ws, 6, 2, 3, "Budget", EurShort(b), "total eligible costs")
    Call Tile(ws, 6, 6, 3, "Spent", EurShort(s), Fmt(IIf(b > 0, s / b, 0), "0%") & " of budget", C1)
    Call Tile(ws, 6, 10, 3, "Committed", EurShort(sc - s), "not yet spent", C2)
    Call Tile(ws, 6, 14, 3, "Used vs time", Fmt(IIf(b > 0, sc / b, 0), "0%") & " / " & Fmt(tg, "0%"), "spent + committed / time elapsed", IIf(b > 0 And sc / b - tg < -0.15, AMBER, C1))
    Call Tile(ws, 6, 18, 3, "Available", EurShort(b - sc), "budget not yet spent or committed", GREEN)
    Call Tile(ws, 6, 22, 3, "Flags", Application.WorksheetFunction.CountIf(Sh(SH_CHECKS).Range("A:A"), "Error") & " / " & Application.WorksheetFunction.CountIf(Sh(SH_CHECKS).Range("A:A"), "Check"), "errors / items to check (Checks)", RED)
    ' Heading table from Analysis (rows 5.. until blank)
    Dim t As Long: t = 12
    ws.Cells(t, 2).Value = "Headings": ws.Cells(t, 2).Font.Size = 12: ws.Cells(t, 2).Font.Bold = True
    ws.Range(ws.Cells(t + 1, 2), ws.Cells(t + 1, 12)).Value = Array("", "Heading", "", "", "Budget", "", "Spent", "", "S + C", "", "Status")
    ws.Range(ws.Cells(t + 1, 2), ws.Cells(t + 1, 16)).Font.Color = MUTED: ws.Range(ws.Cells(t + 1, 2), ws.Cells(t + 1, 16)).Font.Bold = True
    n = 0
    For i = 5 To 20
        If CStr(an.Cells(i, 1).Value) = "" Or CStr(an.Cells(i, 1).Value) = "Line" Then Exit For
        n = n + 1
        r = t + 1 + n
        ws.Cells(r, 2).NumberFormat = "@": ws.Cells(r, 2).Value = CStr(an.Cells(i, 1).Value)
        ws.Cells(r, 3).Value = an.Cells(i, 2).Value: ws.Range(ws.Cells(r, 3), ws.Cells(r, 5)).Merge
        ws.Cells(r, 6).Value = an.Cells(i, 3).Value: ws.Range(ws.Cells(r, 6), ws.Cells(r, 7)).Merge
        ws.Cells(r, 8).Value = an.Cells(i, 4).Value: ws.Range(ws.Cells(r, 8), ws.Cells(r, 9)).Merge
        ws.Cells(r, 10).Value = an.Cells(i, 5).Value: ws.Range(ws.Cells(r, 10), ws.Cells(r, 11)).Merge
        ws.Cells(r, 12).Value = an.Cells(i, 8).Value: ws.Range(ws.Cells(r, 12), ws.Cells(r, 16)).Merge
        Call Colour(ws.Range(ws.Cells(r, 12), ws.Cells(r, 16)), CStr(an.Cells(i, 8).Value))
        ws.Range(ws.Cells(r, 2), ws.Cells(r, 11)).Interior.Color = CARD
        ' chart helper
        ws.Cells(5 + n, 28).Value = CStr(an.Cells(i, 1).Value) & " " & Left$(CStr(an.Cells(i, 2).Value), 18)
        ws.Cells(5 + n, 29).Value = an.Cells(i, 3).Value: ws.Cells(5 + n, 30).Value = an.Cells(i, 4).Value
        ws.Cells(5 + n, 31).Value = Num(an.Cells(i, 5).Value) - Num(an.Cells(i, 4).Value)
    Next i
    ws.Range(ws.Cells(t + 2, 6), ws.Cells(t + 1 + n, 11)).NumberFormat = "#,##0"
    Dim co As ChartObject, se As Series, top As Long
    top = t + n + 3
    If n > 0 Then
        Set co = AddChart(ws, ws.Cells(top, 2), 11, 17)
        co.Chart.ChartType = xlColumnStacked
        Do While co.Chart.SeriesCollection.Count > 0: co.Chart.SeriesCollection(1).Delete: Loop
        Set se = co.Chart.SeriesCollection.NewSeries: se.Name = "Spent": se.Values = ws.Range(ws.Cells(6, 30), ws.Cells(5 + n, 30)): se.XValues = ws.Range(ws.Cells(6, 28), ws.Cells(5 + n, 28)): se.Format.Fill.ForeColor.RGB = C1
        Set se = co.Chart.SeriesCollection.NewSeries: se.Name = "Committed": se.Values = ws.Range(ws.Cells(6, 31), ws.Cells(5 + n, 31)): se.XValues = ws.Range(ws.Cells(6, 28), ws.Cells(5 + n, 28)): se.Format.Fill.ForeColor.RGB = C2
        Set se = co.Chart.SeriesCollection.NewSeries: se.Name = "Budget": se.Values = ws.Range(ws.Cells(6, 29), ws.Cells(5 + n, 29)): se.XValues = ws.Range(ws.Cells(6, 28), ws.Cells(5 + n, 28))
        se.ChartType = xlLineMarkers: se.Format.Line.Visible = 0: se.MarkerStyle = xlMarkerStyleDash: se.MarkerSize = 20: se.MarkerForegroundColor = INK: se.MarkerBackgroundColor = INK
        Call StyleChart(co, "Headings: spent and committed against the budget")
    End If
    ' Cumulative spending against a straight plan
    Dim ms As Worksheet, j As Long, k As Long, cum As Double, st As Date, en As Date, months As Long
    st = ToDate(Setting("Project start")): en = ToDate(Setting("Project end"))
    If SheetExists(SH_MONTHLY) Then
        Set ms = Sh(SH_MONTHLY)
        ws.Range("AH5:AK5").Value = Array("Month", "Cumulative spent", "Straight plan", "Spent")
        k = 0
        For j = 2 To ms.Cells(ms.Rows.Count, 1).End(xlUp).Row
            If CStr(ms.Cells(j, 1).Value) = bh Then
                k = k + 1
                ws.Cells(5 + k, 34).Value = ms.Cells(j, 2).Value: ws.Cells(5 + k, 37).Value = ms.Cells(j, 3).Value
            End If
        Next j
        If k > 0 Then
            ws.Range(ws.Cells(6, 34), ws.Cells(5 + k, 37)).Sort Key1:=ws.Cells(6, 34), Order1:=xlAscending, Header:=xlNo
            For j = 1 To k
                cum = cum + Num(ws.Cells(5 + j, 37).Value): ws.Cells(5 + j, 35).Value = cum
                If st > 0 And en > st Then ws.Cells(5 + j, 36).Value = b * Application.Max(0, Application.Min(1, (DateSerial(Year(ws.Cells(5 + j, 34).Value), Month(ws.Cells(5 + j, 34).Value) + 1, 0) - st) / (en - st))) / (1 + Num(Setting("Administrative costs rate")))
            Next j
            ws.Range(ws.Cells(6, 34), ws.Cells(5 + k, 34)).NumberFormat = "mmm yy"
            Set co = AddChart(ws, ws.Cells(top, 14), 11, 17)
            co.Chart.ChartType = xlLine
            Do While co.Chart.SeriesCollection.Count > 0: co.Chart.SeriesCollection(1).Delete: Loop
            Set se = co.Chart.SeriesCollection.NewSeries: se.Name = "Cumulative spent (direct)": se.Values = ws.Range(ws.Cells(6, 35), ws.Cells(5 + k, 35)): se.XValues = ws.Range(ws.Cells(6, 34), ws.Cells(5 + k, 34)): se.Format.Line.ForeColor.RGB = C1: se.Format.Line.Weight = 2.5
            Set se = co.Chart.SeriesCollection.NewSeries: se.Name = "Straight plan": se.Values = ws.Range(ws.Cells(6, 36), ws.Cells(5 + k, 36)): se.XValues = ws.Range(ws.Cells(6, 34), ws.Cells(5 + k, 34)): se.Format.Line.ForeColor.RGB = C4: se.Format.Line.DashStyle = 4
            Call StyleChart(co, "Cumulative spending against a straight plan")
        End If
    End If
    ' Lines that need attention
    Dim lr As Long: lr = top + 19
    ws.Cells(lr, 2).Value = "Lines that need attention": ws.Cells(lr, 2).Font.Size = 12: ws.Cells(lr, 2).Font.Bold = True
    ws.Range(ws.Cells(lr + 1, 2), ws.Cells(lr + 1, 18)).Font.Color = MUTED: ws.Range(ws.Cells(lr + 1, 2), ws.Cells(lr + 1, 18)).Font.Bold = True
    ws.Cells(lr + 1, 2).Value = "Line": ws.Cells(lr + 1, 3).Value = "Description": ws.Cells(lr + 1, 9).Value = "Budget": ws.Cells(lr + 1, 11).Value = "S + C": ws.Cells(lr + 1, 13).Value = "Used": ws.Cells(lr + 1, 14).Value = "Units": ws.Cells(lr + 1, 15).Value = "Status"
    k = lr + 1
    For i = 5 To an.Cells(an.Rows.Count, 1).End(xlUp).Row
        Dim stt As String: stt = CStr(an.Cells(i, 16).Value)
        If stt <> "" And stt <> "On track" And stt <> "Status" Then
            k = k + 1
            ws.Cells(k, 2).NumberFormat = "@": ws.Cells(k, 2).Value = CStr(an.Cells(i, 1).Value)
            ws.Cells(k, 3).Value = an.Cells(i, 2).Value: ws.Range(ws.Cells(k, 3), ws.Cells(k, 8)).Merge
            ws.Cells(k, 9).Value = an.Cells(i, 10).Value: ws.Range(ws.Cells(k, 9), ws.Cells(k, 10)).Merge
            ws.Cells(k, 11).Value = an.Cells(i, 13).Value: ws.Range(ws.Cells(k, 11), ws.Cells(k, 12)).Merge
            ws.Cells(k, 13).Value = an.Cells(i, 15).Value: ws.Cells(k, 14).Value = an.Cells(i, 6).Value
            ws.Cells(k, 15).Value = stt: ws.Range(ws.Cells(k, 15), ws.Cells(k, 22)).Merge
            Call Colour(ws.Range(ws.Cells(k, 15), ws.Cells(k, 22)), stt)
            ws.Range(ws.Cells(k, 2), ws.Cells(k, 14)).Interior.Color = CARD
        End If
    Next i
    If k = lr + 1 Then ws.Cells(k + 1, 2).Value = "Every line is on track."
    ws.Range(ws.Cells(lr + 2, 9), ws.Cells(k, 12)).NumberFormat = "#,##0"
    ws.Range(ws.Cells(lr + 2, 13), ws.Cells(k, 14)).NumberFormat = "0%"
    ws.Columns("AB:AK").Hidden = True
    ws.Range("C4").Select
    With ws.PageSetup
        .Orientation = xlLandscape: .Zoom = False: .FitToPagesWide = 1: .FitToPagesTall = False
    End With
End Sub
