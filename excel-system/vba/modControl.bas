Attribute VB_Name = "modControl"
Option Explicit
' ---------------------------------------------------------------------------------------------
' One-time setup (sheets, settings, buttons) and the export of the report workbook.
' Run Setup once after importing the modules; then use the buttons on the Control sheet.
' ---------------------------------------------------------------------------------------------

Public Sub Setup()
    Dim ws As Worksheet, s As Worksheet, b As Worksheet, i As Long, items As Variant, y As Double
    Application.ScreenUpdating = False
    ' Settings (kept if they exist)
    If Not SheetExists(SH_SETTINGS) Then
        Set s = Fresh(SH_SETTINGS)
        items = Array( _
            Array("Project title", "", "As on the first line of the report"), _
            Array("Contract", "", "e.g. Contract n°700001964"), _
            Array("JP number", "", "e.g. 3220"), _
            Array("Budget head (BH)", "", "Filled from the extraction"), _
            Array("Project start", "", "dd/mm/yyyy"), _
            Array("Project end", "", "dd/mm/yyyy"), _
            Array("Situation date", "", "Filled from the extraction (Date : ... of Situation Budgétaire)"), _
            Array("Report type", "Interim", "Interim or Final"), _
            Array("Administrative costs rate", 0.07, "7% of the direct costs (note 3 of the report)"), _
            Array("Signatory 1", "", "Name | Title | Directorate | Council of Europe"), _
            Array("Signatory 2", "", "Name | Title | Department | Council of Europe"), _
            Array("Source file", "", "Last extraction loaded"), _
            Array("Loaded on", "", ""))
        s.Range("A1:C1").Value = Array("Setting", "Value", "Note")
        HeadStyle s.Range("A1:C1")
        For i = 0 To UBound(items)
            s.Cells(i + 2, 1).Value = items(i)(0): s.Cells(i + 2, 2).Value = items(i)(1): s.Cells(i + 2, 3).Value = items(i)(2)
        Next i
        s.Range("B2:B" & UBound(items) + 2).Interior.Color = RGB(255, 242, 204)
        s.Range("B6:B8").NumberFormat = "dd/mm/yyyy": s.Range("B10").NumberFormat = "0%"
        s.Columns("A").ColumnWidth = 28: s.Columns("B").ColumnWidth = 50: s.Columns("C").ColumnWidth = 60
    End If
    ' Budget (kept if it exists)
    If Not SheetExists(SH_BUDGET) Then
        Set b = Fresh(SH_BUDGET)
        b.Range("A1:F1").Value = Array("Code", "Description", "Unit", "# of units", "Unit rate", "Cost")
        HeadStyle b.Range("A1:F1")
        b.Range("A:A").NumberFormat = "@"
        b.Range("D:F").NumberFormat = "#,##0.00"
        b.Columns("A").ColumnWidth = 10: b.Columns("B").ColumnWidth = 60: b.Columns("C").ColumnWidth = 16: b.Columns("D:F").ColumnWidth = 14
        b.Range("H1").Value = "Approved budget: one row per code, headings (no unit) included. Load it from an official REPORT with the button, or paste it."
        b.Range("H1").Font.Italic = True
    End If
    ' Raw sheets
    For Each items In Array(RAW_CONSO, RAW_PO, RAW_INV, RAW_GL, RAW_SIT)
        If Not SheetExists(CStr(items)) Then Call Fresh(CStr(items), True)
    Next items
    For Each items In Array(SH_REPORT, SH_PIVOT, SH_DFP, SH_ANALYSIS, SH_CHECKS, SH_BYDATE, SH_POSTINGS)
        If Not SheetExists(CStr(items)) Then Call Fresh(CStr(items))
    Next items
    ' Control
    Set ws = Fresh(SH_CONTROL)
    ws.Move Before:=ThisWorkbook.Worksheets(1)
    Call BuildHome
    Application.ScreenUpdating = True
    MsgBox "Ready. Fill the Settings sheet, load the approved budget, then load an extraction.", vbInformation
End Sub

Public Sub Button(ws As Worksheet, caption As String, macro As String, top As Double)
    Dim b As Shape
    Set b = ws.Shapes.AddShape(5, ws.Range("B1").Left, top, 430, 34)
    b.Fill.ForeColor.RGB = RGB(31, 78, 137)
    b.Line.Visible = 0
    With b.TextFrame2.TextRange
        .Text = caption
        .Font.Size = 12: .Font.Bold = -1
        .Font.Fill.ForeColor.RGB = RGB(255, 255, 255)
    End With
    b.TextFrame2.VerticalAnchor = 3
    b.TextFrame2.TextRange.ParagraphFormat.Alignment = 2
    b.OnAction = macro
End Sub

' REPORT, pivot and data for pivot copied to a new workbook (formulas kept, linked to each other).
Public Sub ExportReport()
    Dim f As Variant, wb As Workbook, name As String
    name = "BH" & Setting("Budget head (BH)") & "-" & Setting("Report type") & " financial report-" & UCase$(Format$(ToDate(Setting("Situation date")), "mmm-yyyy")) & ".xlsx"
    f = Application.GetSaveAsFilename(name, "Excel workbook (*.xlsx),*.xlsx", , "Save the report workbook")
    If VarType(f) = vbBoolean Then Exit Sub
    Application.ScreenUpdating = False
    ThisWorkbook.Worksheets(Array(SH_REPORT, SH_PIVOT, SH_DFP)).Copy
    Set wb = ActiveWorkbook
    Application.DisplayAlerts = False
    wb.SaveAs CStr(f), xlOpenXMLWorkbook
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    MsgBox "Saved: " & CStr(f), vbInformation
End Sub

' Home screen: always redrawn on open and after each load, so it shows the current state.
Public Sub EnsureButtons()
    Call BuildHome
End Sub

Private Sub Card(ws As Worksheet, x As Double, y As Double, w As Double, h As Double, title As String, desc As String, macro As String, accent As Long, Optional icon As String = "")
    Dim c As Shape, bar As Shape, t As String, n As Long
    Set c = ws.Shapes.AddShape(5, x, y, w, h)
    c.Name = "card_" & macro
    c.Adjustments.Item(1) = 0.08
    c.Fill.ForeColor.RGB = RGB(255, 255, 255)
    c.Line.ForeColor.RGB = RGB(225, 228, 234): c.Line.Weight = 0.75
    c.Shadow.Visible = -1: c.Shadow.ForeColor.RGB = RGB(31, 78, 137): c.Shadow.Transparency = 0.88: c.Shadow.Blur = 10: c.Shadow.OffsetX = 0: c.Shadow.OffsetY = 3
    t = IIf(icon <> "", icon & "   ", "") & title & vbLf & desc
    With c.TextFrame2
        .MarginLeft = 22: .MarginRight = 12: .MarginTop = 10: .MarginBottom = 10
        .VerticalAnchor = 3: .WordWrap = -1
        .TextRange.Text = t
        .TextRange.ParagraphFormat.Alignment = 1
        .TextRange.Font.Name = "Segoe UI"
        .TextRange.Font.Size = 9: .TextRange.Font.Fill.ForeColor.RGB = RGB(110, 117, 128)
        n = Len(IIf(icon <> "", icon & "   ", "") & title)
        .TextRange.Characters(1, n).Font.Size = 13
        .TextRange.Characters(1, n).Font.Bold = -1
        .TextRange.Characters(1, n).Font.Fill.ForeColor.RGB = RGB(31, 41, 55)
    End With
    c.OnAction = macro
    Set bar = ws.Shapes.AddShape(1, x, y + 8, 5, h - 16)
    bar.Name = "bar_" & macro
    bar.Fill.ForeColor.RGB = accent: bar.Line.Visible = 0
    bar.OnAction = macro
End Sub

Private Sub Pill(ws As Worksheet, x As Double, y As Double, w As Double, caption As String, target As String)
    Dim p As Shape
    Set p = ws.Shapes.AddShape(5, x, y, w, 24)
    p.Name = "go_" & target
    p.Adjustments.Item(1) = 0.5
    p.Fill.ForeColor.RGB = RGB(234, 241, 250): p.Line.Visible = 0
    With p.TextFrame2
        .MarginLeft = 4: .MarginRight = 4: .MarginTop = 0: .MarginBottom = 0: .VerticalAnchor = 3
        .TextRange.Text = caption
        .TextRange.ParagraphFormat.Alignment = 2
        .TextRange.Font.Name = "Segoe UI": .TextRange.Font.Size = 9: .TextRange.Font.Bold = -1
        .TextRange.Font.Fill.ForeColor.RGB = RGB(31, 78, 137)
    End With
    p.OnAction = "GoSheet"
End Sub

' Pill buttons: the shape name carries the sheet to open.
Public Sub GoSheet()
    Dim n As String
    n = Mid$(CStr(Application.Caller), 4)
    If n = SH_PORTFOLIO Then
        Call GoPortfolio
    ElseIf n = SH_PROJECTDASH Then
        Call GoProject
    ElseIf SheetExists(n) Then
        Sh(n).Activate
    End If
End Sub

Public Sub BuildHome()
    Dim ws As Worksheet, shp As Shape, x As Double, y As Double, w As Double, h As Double, i As Long
    Dim rg As Worksheet, n As Long, te As Long, tc As Long, last As Variant, asat As Variant, r As Long
    Set ws = Sh(SH_CONTROL)
    For Each shp In ws.Shapes: shp.Delete: Next shp
    ws.Cells.Clear
    ws.Cells.Interior.Color = RGB(244, 246, 250)
    ws.Cells.Font.Name = "Segoe UI": ws.Cells.Font.Size = 10
    ws.Columns("A:Z").ColumnWidth = 9: ws.Rows("1:60").RowHeight = 15
    ws.Activate: ActiveWindow.DisplayGridlines = False: ActiveWindow.DisplayHeadings = False
    ' Header band
    Dim band As Shape
    Set band = ws.Shapes.AddShape(1, 0, 0, 1400, 92)
    band.Name = "band": band.Fill.ForeColor.RGB = RGB(22, 54, 99): band.Line.Visible = 0
    band.Fill.TwoColorGradient 2, 1: band.Fill.ForeColor.RGB = RGB(31, 78, 137): band.Fill.BackColor.RGB = RGB(16, 42, 80)
    With band.TextFrame2
        .MarginLeft = 34: .VerticalAnchor = 3
        .TextRange.Text = "JP Financial Reports" & vbLf & "From the system extraction to the official report, the analysis and the portfolio - in one workbook"
        .TextRange.Font.Name = "Segoe UI": .TextRange.Font.Size = 10: .TextRange.Font.Fill.ForeColor.RGB = RGB(200, 214, 235)
        .TextRange.ParagraphFormat.Alignment = 1
        .TextRange.Characters(1, 20).Font.Size = 24: .TextRange.Characters(1, 20).Font.Bold = -1
        .TextRange.Characters(1, 20).Font.Fill.ForeColor.RGB = RGB(255, 255, 255)
    End With
    band.OnAction = ""
    ' Action cards (2 x 3)
    x = 30: y = 116: w = 300: h = 74
    Call Card(ws, x, y, w, h, "Load approved budgets", "From official REPORT files - several at once; each goes to its project by BH", "LoadBudget", RGB(0, 150, 136), "1")
    Call Card(ws, x + w + 18, y, w, h, "Load extractions", "System extractions - several at once; read, laid out and analysed", "LoadExtractions", RGB(42, 120, 214), "2")
    Call Card(ws, x, y + h + 16, w, h, "Refresh all projects", "Re-analyse every project after a change in Budget, Settings or data for pivot", "RefreshAll", RGB(124, 77, 255))
    Call Card(ws, x + w + 18, y + h + 16, w, h, "Export the report", "REPORT + pivot + data for pivot of the selected project, linked by formulas", "ExportReport", RGB(235, 123, 52))
    Call Card(ws, x, y + 2 * (h + 16), w, h, "Portfolio dashboard", "Every project: tiles, charts, heading heat map", "GoPortfolio", RGB(31, 78, 137))
    Call Card(ws, x + w + 18, y + 2 * (h + 16), w, h, "Project dashboard", "Pick a project: tiles, charts, lines that need attention", "GoProject", RGB(31, 78, 137))
    ' Status panel
    Set rg = Reg()
    n = rg.Cells(rg.Rows.Count, 1).End(xlUp).Row - 1
    For r = 2 To n + 1
        te = te + Num(rg.Cells(r, 20).Value): tc = tc + Num(rg.Cells(r, 21).Value)
        If IsDate(rg.Cells(r, 24).Value) Then If IsEmpty(last) Or rg.Cells(r, 24).Value > last Then last = rg.Cells(r, 24).Value
        If IsDate(rg.Cells(r, 13).Value) Then If IsEmpty(asat) Or rg.Cells(r, 13).Value > asat Then asat = rg.Cells(r, 13).Value
    Next r
    Dim st As Shape, sx As Double
    sx = x + 2 * w + 40
    Set st = ws.Shapes.AddShape(5, sx, y, 330, 3 * h + 32)
    st.Name = "status": st.Adjustments.Item(1) = 0.04
    st.Fill.ForeColor.RGB = RGB(255, 255, 255): st.Line.ForeColor.RGB = RGB(225, 228, 234)
    st.Shadow.Visible = -1: st.Shadow.Transparency = 0.9: st.Shadow.Blur = 10: st.Shadow.OffsetY = 3
    Dim txt As String
    txt = "STATUS" & vbLf & vbLf & _
          n & " project(s)" & vbLf & _
          "Latest situation: " & IIf(IsEmpty(asat), "-", Fmt(asat, "dd/mm/yyyy")) & vbLf & _
          "Last loaded: " & IIf(IsEmpty(last), "-", Fmt(last, "dd/mm/yyyy hh:nn")) & vbLf & _
          "Errors: " & te & "    To check: " & tc & vbLf & vbLf
    For r = 2 To Application.Min(n + 1, 9)
        txt = txt & Left$(CStr(rg.Cells(r, 2).Value) & Space(10), 10) & "  " & Fmt(Num(rg.Cells(r, 17).Value), "0%") & " used  -  " & IIf(CStr(rg.Cells(r, 22).Value) = "", "-", Left$(CStr(rg.Cells(r, 22).Value), 28)) & vbLf
    Next r
    If n > 8 Then txt = txt & "... and " & n - 8 & " more (Portfolio)"
    If n = 0 Then txt = txt & "Start with 1 and 2."
    With st.TextFrame2
        .MarginLeft = 20: .MarginRight = 16: .MarginTop = 16: .VerticalAnchor = 1: .WordWrap = -1
        .TextRange.Text = txt
        .TextRange.Font.Name = "Segoe UI": .TextRange.Font.Size = 9.5: .TextRange.Font.Fill.ForeColor.RGB = RGB(55, 65, 81)
        .TextRange.ParagraphFormat.Alignment = 1
        .TextRange.Characters(1, 6).Font.Size = 9: .TextRange.Characters(1, 6).Font.Bold = -1
        .TextRange.Characters(1, 6).Font.Fill.ForeColor.RGB = RGB(110, 117, 128)
        .TextRange.Characters(9, Len(CStr(n)) + 11).Font.Size = 18: .TextRange.Characters(9, Len(CStr(n)) + 11).Font.Bold = -1
        .TextRange.Characters(9, Len(CStr(n)) + 11).Font.Fill.ForeColor.RGB = RGB(31, 41, 55)
    End With
    ' Navigation pills
    Dim lab As Shape, tg As Variant, px As Double
    Set lab = ws.Shapes.AddTextbox(1, x, y + 3 * (h + 16) + 14, 200, 18)
    lab.Name = "navlabel": lab.Line.Visible = 0: lab.Fill.Visible = 0
    lab.TextFrame2.TextRange.Text = "GO TO": lab.TextFrame2.TextRange.Font.Size = 8: lab.TextFrame2.TextRange.Font.Bold = -1
    lab.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(110, 117, 128): lab.TextFrame2.MarginLeft = 0
    px = x
    For Each tg In Array(SH_PORTFOLIO, SH_PROJECTDASH, SH_PROJECTS, SH_REPORT, SH_PIVOT, SH_DFP, SH_ANALYSIS, SH_CHECKS, SH_BYDATE, SH_POSTINGS, SH_BUDGET, SH_SETTINGS)
        Call Pill(ws, px, y + 3 * (h + 16) + 34, 7 * Len(CStr(tg)) + 26, CStr(tg), CStr(tg))
        px = px + 7 * Len(CStr(tg)) + 34
    Next tg
    ' Footer
    Dim ft As Shape
    Set ft = ws.Shapes.AddTextbox(1, x, y + 3 * (h + 16) + 74, 960, 40)
    ft.Name = "footer": ft.Line.Visible = 0: ft.Fill.Visible = 0: ft.TextFrame2.MarginLeft = 0
    ft.TextFrame2.TextRange.Text = "Units in the official report: months paid on staff POs, 0 for a PO with nothing spent, else the units ordered (correct them in data for pivot). " & _
        "The analysis counts only the spent share of a PO. Administrative costs = 7% of the direct costs. Headings: notification within 25%, addendum beyond."
    ft.TextFrame2.TextRange.Font.Size = 8: ft.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(140, 146, 156): ft.TextFrame2.WordWrap = -1
    ws.Range("A1").Select
End Sub
