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
        If Not SheetExists(CStr(items)) Then Fresh CStr(items), True
    Next items
    For Each items In Array(SH_REPORT, SH_PIVOT, SH_DFP, SH_ANALYSIS, SH_CHECKS, SH_BYDATE, SH_POSTINGS)
        If Not SheetExists(CStr(items)) Then Fresh CStr(items)
    Next items
    ' Control
    Set ws = Fresh(SH_CONTROL)
    ws.Move Before:=ThisWorkbook.Worksheets(1)
    ws.Activate: ActiveWindow.DisplayGridlines = False
    ws.Range("B2").Value = "JP Financial Report - extraction to report": ws.Range("B2").Font.Size = 18: ws.Range("B2").Font.Bold = True
    ws.Range("B3").Value = "Load the extraction exported from the financial system: it is read, laid out as data for pivot -> pivot -> REPORT, and analysed at once."
    ws.Range("B3").Font.Color = RGB(90, 90, 90)
    y = 70
    Button ws, "1. Load approved budget (from a REPORT)", "LoadBudget", y: y = y + 44
    Button ws, "2. Load extraction and analyse", "LoadExtraction", y: y = y + 44
    Button ws, "Refresh (after editing data for pivot, Budget or Settings)", "Refresh", y: y = y + 44
    Button ws, "Export report workbook (REPORT + pivot + data for pivot)", "ExportReport", y: y = y + 44
    ws.Range("B19").Value = "Sheets"
    ws.Range("B19").Font.Bold = True
    items = Array( _
        Array(SH_REPORT, "Official interim/final financial report - linked to pivot by formulas"), _
        Array(SH_PIVOT, "Units, spent and spent + committed by reporting line"), _
        Array(SH_DFP, "Every PO line and GL entry; NBRE_OF_UNITS can be corrected by hand"), _
        Array(SH_ANALYSIS, "Lines and headings against the approved budget: notification / addendum, units, rates"), _
        Array(SH_CHECKS, "Entries that look posted in error"), _
        Array(SH_BYDATE, "Spending between two dates (type the dates)"), _
        Array(SH_POSTINGS, "Every dated invoice and GL entry"), _
        Array(SH_BUDGET, "Approved budget"), _
        Array(SH_SETTINGS, "Project title, dates, signatories"))
    For i = 0 To UBound(items)
        ws.Hyperlinks.Add Anchor:=ws.Cells(20 + i, 2), Address:="", SubAddress:="'" & items(i)(0) & "'!A1", TextToDisplay:=CStr(items(i)(0))
        ws.Cells(20 + i, 3).Value = items(i)(1)
    Next i
    ws.Columns("A").ColumnWidth = 3: ws.Columns("B").ColumnWidth = 22: ws.Columns("C").ColumnWidth = 90
    ws.Activate
    Application.ScreenUpdating = True
    MsgBox "Ready. Fill the Settings sheet, load the approved budget, then load an extraction.", vbInformation
End Sub

Private Sub Button(ws As Worksheet, caption As String, macro As String, top As Double)
    Dim b As Shape
    Set b = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Range("B1").Left, top, 430, 34)
    b.Fill.ForeColor.RGB = RGB(31, 78, 137)
    b.Line.Visible = msoFalse
    With b.TextFrame2.TextRange
        .Text = caption
        .Font.Size = 12: .Font.Bold = msoTrue
        .Font.Fill.ForeColor.RGB = RGB(255, 255, 255)
    End With
    b.TextFrame2.VerticalAnchor = msoAnchorMiddle
    b.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
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
