Attribute VB_Name = "modImport"
Option Explicit
' ---------------------------------------------------------------------------------------------
' Loads a raw system extraction (Situation Budgétaire, Purchase Orders, Factures a date,
' Ecriture GL, Consolidation...) and runs the whole analysis at once.
' Also loads the approved budget from an official REPORT (or any sheet laid out like it).
' ---------------------------------------------------------------------------------------------

Public Sub LoadExtraction()
    Call LoadExtractions
End Sub

' Copies the sheets that matter as values into hidden raw_ sheets, header on row 1.
Public Function CopyRaw(wb As Workbook) As Boolean
    Dim hdr As Long, ws As Worksheet
    Set ws = SheetWith(wb, Array("source", "reportingline", "spentcomeur"), hdr)
    If ws Is Nothing Then Exit Function
    CopyFrom ws, hdr, RAW_CONSO
    Set ws = SheetWith(wb, Array("ponumber", "descriptionpo"), hdr)
    If Not ws Is Nothing Then
        CopyFrom ws, hdr, RAW_PO
    Else
        Call Fresh(RAW_PO, True)
    End If
    Set ws = SheetWith(wb, Array("invoiceno", "montantligne"), hdr)
    If Not ws Is Nothing Then
        CopyFrom ws, hdr, RAW_INV
    Else
        Call Fresh(RAW_INV, True)
    End If
    Set ws = SheetWith(wb, Array("glnumber", "reportingline"), hdr)
    If Not ws Is Nothing Then
        CopyFrom ws, hdr, RAW_GL
    Else
        Call Fresh(RAW_GL, True)
    End If
    Set ws = SheetWith(wb, Array("ccm", "article", "depensesreelles"), hdr)
    If Not ws Is Nothing Then
        CopyFrom ws, hdr, RAW_SIT
    Else
        Call Fresh(RAW_SIT, True)
    End If
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
Public Sub ReadHeader(wb As Workbook)
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
    Dim files As Variant, f As Variant, n As Long, msg As String, bh As String
    files = Application.GetOpenFilename("Excel files (*.xlsx;*.xlsm;*.xls),*.xlsx;*.xlsm;*.xls", , "Choose one or more financial reports or budgets (REPORT sheet)", , True)
    If Not IsArray(files) Then Exit Sub
    Busy True
    For Each f In files
        bh = BudgetFromFile(CStr(f), n)
        msg = msg & vbLf & Dir$(CStr(f)) & ": " & IIf(bh = "", "no budget head found - kept on the Budget sheet only", n & " rows -> BH " & bh)
    Next f
    Busy False
    MsgBox "Approved budget loaded:" & msg & vbLf & vbLf & "Then load the extraction(s), or press Refresh all.", vbInformation
End Sub

' Reads the REPORT (or budget) sheet of one file into the Budget sheet; title, contract, JP and BH from its header.
' The budget is stored with its project (by BH). Returns the BH ("" when the file names none).
Public Function BudgetFromFile(path As String, ByRef rows As Long) As String
    Dim wb As Workbook, ws As Worksheet, src As Worksheet, r As Long, lastR As Long, code As String, out As Long, bud As Worksheet
    Dim t As String, bh As String, jp As String, title As String, contract As String, k As Long
    Set wb = Workbooks.Open(path, ReadOnly:=True, UpdateLinks:=False)
    For Each ws In wb.Worksheets
        If UCase$(ws.Name) = "REPORT" Or UCase$(ws.Name) = "BUDGET" Then Set src = ws: Exit For
    Next ws
    If src Is Nothing Then Set src = wb.Worksheets(1)
    Set bud = Sh(SH_BUDGET)
    bud.Range("A2:F1000").ClearContents
    out = 2
    lastR = src.Cells(src.Rows.Count, 1).End(xlUp).Row
    For r = 1 To lastR
        t = CStr(src.Cells(r, 1).Value)
        If r <= 14 Then
            k = InStr(1, t, "BH ", vbTextCompare): If k > 0 And bh = "" Then bh = Trim$(Split(Mid$(t, k + 3) & " ", " ")(0))
            k = InStr(1, t, "JP ", vbTextCompare): If k > 0 And jp = "" Then jp = Trim$(Split(Mid$(t, k + 3) & " ", " ")(0))
            If InStr(1, t, "Contract n", vbTextCompare) > 0 And contract = "" Then contract = Trim$(Split(Mid$(t, InStr(1, t, "Contract n", vbTextCompare)) & vbLf, vbLf)(0))
            If title = "" And Len(Trim$(t)) > 8 And LeadCode(t) = "" And InStr(1, t, "Contract", vbTextCompare) = 0 Then title = Trim$(Split(t & vbLf, vbLf)(0))
        End If
        code = LeadCode(t)
        If code <> "" And InStr(t, "Sub-total") = 0 Then
            If Val(Split(code, ".")(0)) <= 6 Then
                bud.Cells(out, 1).NumberFormat = "@": bud.Cells(out, 1).Value = code
                bud.Cells(out, 2).Value = Trim$(Split(Mid$(Trim$(t), Len(code) + 1) & vbLf, vbLf)(0))
                bud.Cells(out, 3).Value = src.Cells(r, 2).Value
                If IsNumeric(src.Cells(r, 3).Value) Then bud.Cells(out, 4).Value = src.Cells(r, 3).Value
                If IsNumeric(src.Cells(r, 4).Value) Then bud.Cells(out, 5).Value = src.Cells(r, 4).Value
                If IsNumeric(src.Cells(r, 5).Value) Then bud.Cells(out, 6).Value = src.Cells(r, 5).Value
                out = out + 1
            End If
        End If
    Next r
    wb.Close False
    rows = out - 2
    If bh <> "" And rows > 0 Then
        Dim rr As Long
        rr = EnsureProject(bh)
        If title <> "" Then Reg().Cells(rr, 3).Value = title
        If contract <> "" Then Reg().Cells(rr, 4).Value = contract
        If jp <> "" Then Reg().Cells(rr, 5).Value = jp: Reg().Cells(rr, 2).Value = "JP" & jp
        Call StoreBudget(bh)
    End If
    BudgetFromFile = bh
End Function

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
