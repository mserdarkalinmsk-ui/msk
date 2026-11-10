Attribute VB_Name = "modImport"
Option Explicit
' ---------------------------------------------------------------------------------------------
' Loads a raw system extraction (Situation Budgétaire, Purchase Orders, Factures a date,
' Ecriture GL, Consolidation...) and runs the whole analysis at once.
' Also loads the approved budget from an official REPORT (or any sheet laid out like it).
' ---------------------------------------------------------------------------------------------

Public Sub LoadExtraction()
    Dim f As Variant, wb As Workbook
    f = Application.GetOpenFilename("Excel files (*.xlsx;*.xlsm;*.xls),*.xlsx;*.xlsm;*.xls", , "Choose the system extraction")
    If VarType(f) = vbBoolean Then Exit Sub
    Busy True
    On Error GoTo fail
    Status "Opening " & Dir$(CStr(f)) & "..."
    Set wb = Workbooks.Open(CStr(f), ReadOnly:=True, UpdateLinks:=False)
    If Not CopyRaw(wb) Then
        wb.Close False: Busy False
        MsgBox "This file has no Consolidation sheet (SOURCE / REPORTING_LINE / SPENT_COM_EUR)." & vbLf & _
               "Choose the extraction exported from the financial system.", vbExclamation
        Exit Sub
    End If
    ReadHeader wb
    wb.Close False
    SetSetting "Source file", Dir$(CStr(f))
    SetSetting "Loaded on", Now
    BuildAll
    Busy False
    Sh(SH_REPORT).Activate
    MsgBox "Extraction loaded and analysed." & vbLf & vbLf & SummaryText(), vbInformation
    Exit Sub
fail:
    Busy False
    MsgBox "Could not read the extraction: " & Err.Description, vbCritical
End Sub

' Copies the sheets that matter as values into hidden raw_ sheets, header on row 1.
Private Function CopyRaw(wb As Workbook) As Boolean
    Dim hdr As Long, ws As Worksheet
    Set ws = SheetWith(wb, Array("source", "reportingline", "spentcomeur"), hdr)
    If ws Is Nothing Then Exit Function
    CopyFrom ws, hdr, RAW_CONSO
    Set ws = SheetWith(wb, Array("ponumber", "descriptionpo"), hdr)
    If Not ws Is Nothing Then CopyFrom ws, hdr, RAW_PO Else Fresh RAW_PO, True
    Set ws = SheetWith(wb, Array("invoiceno", "montantligne"), hdr)
    If Not ws Is Nothing Then CopyFrom ws, hdr, RAW_INV Else Fresh RAW_INV, True
    Set ws = SheetWith(wb, Array("glnumber", "reportingline"), hdr)
    If Not ws Is Nothing Then CopyFrom ws, hdr, RAW_GL Else Fresh RAW_GL, True
    Set ws = SheetWith(wb, Array("ccm", "article", "depensesreelles"), hdr)
    If Not ws Is Nothing Then CopyFrom ws, hdr, RAW_SIT Else Fresh RAW_SIT, True
    CopyRaw = True
End Function

Private Sub CopyFrom(src As Worksheet, hdr As Long, target As String)
    Dim dst As Worksheet, lastR As Long, lastC As Long, v As Variant
    Set dst = Fresh(target, True)
    lastR = src.Cells(src.Rows.Count, 1).End(xlUp).Row
    lastC = src.Cells(hdr, src.Columns.Count).End(xlToLeft).Column
    If lastR <= hdr Then lastR = hdr
    v = src.Range(src.Cells(hdr, 1), src.Cells(lastR, lastC)).Value
    dst.Range("A1").Resize(UBound(v, 1), UBound(v, 2)).Value = v
End Sub

' Situation date and budget head from the header of the Situation Budgétaire sheet.
Private Sub ReadHeader(wb As Workbook)
    Dim ws As Worksheet, r As Long, s As String, i As Long
    For Each ws In wb.Worksheets
        For r = 1 To 12
            s = CStr(ws.Cells(r, 1).Value)
            If s Like "Date : ##/##/####*" Then SetSetting "Situation date", ToDate(Mid$(s, 8, 10))
            i = InStr(s, "BH=")
            If i > 0 Then SetSetting "Budget head (BH)", Trim$(Split(Mid$(s, i + 3) & " ", " ")(0))
        Next r
    Next ws
End Sub

' Approved budget: every "code description" row of an official REPORT (or budget) sheet with its unit,
' number of units, unit rate and cost. Heading rows are kept so the report shows their names.
Public Sub LoadBudget()
    Dim f As Variant, wb As Workbook, ws As Worksheet, src As Worksheet, r As Long, lastR As Long
    Dim code As String, out As Long, bud As Worksheet, cHead As Long
    f = Application.GetOpenFilename("Excel files (*.xlsx;*.xlsm;*.xls),*.xlsx;*.xlsm;*.xls", , "Choose a financial report or budget (REPORT sheet)")
    If VarType(f) = vbBoolean Then Exit Sub
    Busy True
    On Error GoTo fail
    Set wb = Workbooks.Open(CStr(f), ReadOnly:=True, UpdateLinks:=False)
    For Each ws In wb.Worksheets
        If UCase$(ws.Name) = "REPORT" Or UCase$(ws.Name) = "BUDGET" Then Set src = ws: Exit For
    Next ws
    If src Is Nothing Then Set src = wb.Worksheets(1)
    Set bud = Sh(SH_BUDGET)
    bud.Range("A2:F500").ClearContents
    out = 2
    lastR = src.Cells(src.Rows.Count, 1).End(xlUp).Row
    For r = 1 To lastR
        code = LeadCode(CStr(src.Cells(r, 1).Value))
        If code <> "" And InStr(CStr(src.Cells(r, 1).Value), "Sub-total") = 0 Then
            If Val(Split(code, ".")(0)) <= 6 And Not (code Like "#." Or code Like "##.") Then
                bud.Cells(out, 1).Value = "'" & code
                bud.Cells(out, 2).Value = Trim$(Mid$(Trim$(CStr(src.Cells(r, 1).Value)), Len(code) + 1))
                bud.Cells(out, 3).Value = src.Cells(r, 2).Value
                If IsNumeric(src.Cells(r, 3).Value) Then bud.Cells(out, 4).Value = src.Cells(r, 3).Value
                If IsNumeric(src.Cells(r, 4).Value) Then bud.Cells(out, 5).Value = src.Cells(r, 4).Value
                If IsNumeric(src.Cells(r, 5).Value) Then bud.Cells(out, 6).Value = src.Cells(r, 5).Value
                out = out + 1
            End If
        End If
        ' Title lines and contract from the top of the report.
        If r <= 12 Then
            If InStr(1, CStr(src.Cells(r, 1).Value), "Contract n", vbTextCompare) > 0 And Setting("Contract") = "" Then
                SetSetting "Contract", Trim$(Mid$(CStr(src.Cells(r, 1).Value), InStr(1, CStr(src.Cells(r, 1).Value), "Contract n", vbTextCompare)))
            End If
        End If
    Next r
    wb.Close False
    Busy False
    If out = 2 Then
        MsgBox "No budget line (code, unit, units, rate, cost) found in " & Dir$(CStr(f)) & ".", vbExclamation
    Else
        MsgBox (out - 2) & " budget rows loaded from " & Dir$(CStr(f)) & "." & vbLf & "Check them on the Budget sheet, then load the extraction.", vbInformation
        Sh(SH_BUDGET).Activate
    End If
    Exit Sub
fail:
    Busy False
    MsgBox "Could not read the budget: " & Err.Description, vbCritical
End Sub

Public Function SummaryText() As String
    Dim ws As Worksheet, r As Long, s As String
    Set ws = Sh(SH_REPORT)
    For r = 1 To ws.UsedRange.Rows.Count + 5
        If Left$(CStr(ws.Cells(r, 1).Value), 3) = "11." Then
            s = "Total eligible costs: spent " & Format$(ws.Cells(r, 8).Value, "#,##0.00") & " / spent + committed " & Format$(ws.Cells(r, 9).Value, "#,##0.00")
        End If
    Next r
    SummaryText = s & vbLf & Application.WorksheetFunction.CountIf(Sh(SH_CHECKS).Range("A:A"), "Error") & " errors, " & _
        Application.WorksheetFunction.CountIf(Sh(SH_CHECKS).Range("A:A"), "Check") & " items to check (Checks sheet)."
End Function
