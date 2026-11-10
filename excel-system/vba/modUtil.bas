Attribute VB_Name = "modUtil"
Option Explicit
' ---------------------------------------------------------------------------------------------
' Shared helpers: header search by name (whatever the column order of the extraction),
' dates and periods, numeric sort of reporting-line codes, sheet handling.
' ---------------------------------------------------------------------------------------------

Public Const SH_CONTROL As String = "Control"
Public Const SH_SETTINGS As String = "Settings"
Public Const SH_BUDGET As String = "Budget"
Public Const SH_DFP As String = "data for pivot"
Public Const SH_PIVOT As String = "pivot"
Public Const SH_REPORT As String = "REPORT"
Public Const SH_ANALYSIS As String = "Analysis"
Public Const SH_CHECKS As String = "Checks"
Public Const SH_POSTINGS As String = "Postings"
Public Const SH_BYDATE As String = "By date"
Public Const RAW_CONSO As String = "raw_Conso"
Public Const RAW_PO As String = "raw_PO"
Public Const RAW_INV As String = "raw_Inv"
Public Const RAW_GL As String = "raw_GL"
Public Const RAW_SIT As String = "raw_Situation"

' Lower case, accents removed, letters and digits only: "Montant" & vbLf & "Engagé €" -> "montantengage"
Public Function Norm(ByVal s As Variant) As String
    Dim t As String, i As Long, c As String, out As String
    t = LCase$(CStr(s))
    t = Replace(t, "é", "e"): t = Replace(t, "è", "e"): t = Replace(t, "ê", "e")
    t = Replace(t, "à", "a"): t = Replace(t, "â", "a"): t = Replace(t, "ç", "c")
    t = Replace(t, "ô", "o"): t = Replace(t, "û", "u"): t = Replace(t, "ü", "u"): t = Replace(t, "î", "i")
    For i = 1 To Len(t)
        c = Mid$(t, i, 1)
        If (c >= "a" And c <= "z") Or (c >= "0" And c <= "9") Then out = out & c
    Next i
    Norm = out
End Function

' Row (1-based) of the first row in the first 40 that holds every name in keys (normalised), or 0.
Public Function HeaderRow(ws As Worksheet, keys As Variant) As Long
    Dim r As Long, k As Variant, ok As Boolean, lastC As Long
    lastC = ws.UsedRange.Columns.Count + ws.UsedRange.Column
    For r = 1 To 40
        ok = True
        For Each k In keys
            If ColIn(ws, r, CStr(k), lastC) = 0 Then ok = False: Exit For
        Next k
        If ok Then HeaderRow = r: Exit Function
    Next r
End Function

Private Function ColIn(ws As Worksheet, r As Long, key As String, lastC As Long) As Long
    Dim c As Long
    For c = 1 To lastC
        If Norm(ws.Cells(r, c).Value) = key Then ColIn = c: Exit Function
    Next c
End Function

' Column of the first of the given names in header row r, or 0.
Public Function ColOf(ws As Worksheet, r As Long, ParamArray names() As Variant) As Long
    Dim n As Variant, c As Long, lastC As Long
    lastC = ws.UsedRange.Columns.Count + ws.UsedRange.Column
    For Each n In names
        c = ColIn(ws, r, CStr(n), lastC)
        If c > 0 Then ColOf = c: Exit Function
    Next n
End Function

' The sheet of wb whose header holds all keys; when several do, the one with the most rows.
Public Function SheetWith(wb As Workbook, keys As Variant, ByRef hdr As Long) As Worksheet
    Dim ws As Worksheet, r As Long, best As Worksheet, bestN As Long
    For Each ws In wb.Worksheets
        r = HeaderRow(ws, keys)
        If r > 0 Then
            If ws.UsedRange.Rows.Count - r > bestN Or best Is Nothing Then
                Set best = ws: bestN = ws.UsedRange.Rows.Count - r: hdr = r
            End If
        End If
    Next ws
    Set SheetWith = best
End Function

' Clears (or creates) a sheet of this workbook.
Public Function Fresh(name As String, Optional hidden As Boolean = False) As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(name)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = name
    Else
        ws.Cells.Clear
        Dim shp As Shape
        For Each shp In ws.Shapes: shp.Delete: Next shp
    End If
    ws.Visible = IIf(hidden, xlSheetHidden, xlSheetVisible)
    Set Fresh = ws
End Function

Public Function Sh(name As String) As Worksheet
    Set Sh = ThisWorkbook.Worksheets(name)
End Function

Public Function SheetExists(name As String) As Boolean
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(name)
    SheetExists = Not ws Is Nothing
End Function

' Settings are name / value pairs in columns A:B of the Settings sheet.
Public Function Setting(key As String) As Variant
    Dim r As Long, ws As Worksheet
    Set ws = Sh(SH_SETTINGS)
    For r = 1 To 60
        If Norm(ws.Cells(r, 1).Value) = Norm(key) Then Setting = ws.Cells(r, 2).Value: Exit Function
    Next r
    Setting = Empty
End Function

Public Sub SetSetting(key As String, v As Variant)
    Dim r As Long, ws As Worksheet
    Set ws = Sh(SH_SETTINGS)
    For r = 1 To 60
        If Norm(ws.Cells(r, 1).Value) = Norm(key) Then ws.Cells(r, 2).Value = v: Exit Sub
    Next r
End Sub

Public Function Num(v As Variant) As Double
    If IsNumeric(v) And Not IsEmpty(v) Then
        Num = CDbl(v)
    Else
        Dim s As String: s = Trim$(CStr(v))
        s = Replace(Replace(s, " ", ""), Chr(160), "")
        If IsNumeric(s) Then Num = CDbl(s) Else Num = 0
    End If
End Function

' "dd/mm/yyyy" text, an Excel date or "OCT-26" -> Date (0 when unknown).
Public Function ToDate(v As Variant) As Date
    Dim s As String, p() As String
    If IsDate(v) And VarType(v) = vbDate Then ToDate = CDate(v): Exit Function
    If IsNumeric(v) And Not IsEmpty(v) Then
        If CDbl(v) > 20000 And CDbl(v) < 80000 Then ToDate = CDate(CDbl(v)): Exit Function
    End If
    s = Trim$(CStr(v))
    If s Like "*#/*#/####*" Then
        p = Split(Split(s, " ")(0), "/")
        If UBound(p) >= 2 Then ToDate = DateSerial(CInt(Left$(p(2), 4)), CInt(p(1)), CInt(p(0))): Exit Function
    End If
    If s Like "???-##" Then ToDate = DateSerial(2000 + CInt(Right$(s, 2)), MonthOf(Left$(s, 3)), 1)
End Function

Public Function MonthOf(m As String) As Integer
    MonthOf = (InStr(1, "JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC", UCase$(m)) + 2) / 3
End Function

' Month key "2026-10" of a period "OCT-26" or of a date.
Public Function MonthKey(period As Variant, d As Variant) As String
    Dim x As Date
    x = ToDate(period)
    If x = 0 Then x = ToDate(d)
    If x = 0 Then MonthKey = "" Else MonthKey = Format$(x, "yyyy-mm")
End Function

' Sort key so that 1.10 comes after 1.9: every part padded to 3 digits.
Public Function CodeKey(code As String) As String
    Dim p() As String, i As Long, out As String
    p = Split(code, ".")
    For i = 0 To UBound(p)
        out = out & Right$("000" & p(i), 3) & "."
    Next i
    CodeKey = out
End Function

Public Function IsCode(s As String) As Boolean
    Dim i As Long, c As String
    If Len(s) = 0 Then Exit Function
    For i = 1 To Len(s)
        c = Mid$(s, i, 1)
        If Not ((c >= "0" And c <= "9") Or c = ".") Then Exit Function
    Next i
    IsCode = Left$(s, 1) <> "." And Right$(s, 1) <> "."
End Function

' The leading code of "1.1.3 Local short-term consultant" -> "1.1.3"
Public Function LeadCode(s As String) As String
    Dim t As String
    t = Trim$(s)
    If InStr(t, " ") > 0 Then t = Left$(t, InStr(t, " ") - 1)
    If IsCode(t) Then LeadCode = t
End Function

' Contract period of a staff PO description "... from 01/01/2026 to 31/12/2026"
Public Function PeriodOf(desc As String, ByRef dFrom As Date, ByRef dTo As Date) As Boolean
    Dim i As Long, j As Long, s As String
    s = LCase$(desc)
    i = InStr(s, "from ")
    j = InStr(s, " to ")
    If i > 0 And j > i Then
        dFrom = ToDate(Mid$(desc, i + 5, 10))
        dTo = ToDate(Mid$(desc, j + 4, 10))
        PeriodOf = (dFrom > 0 And dTo > dFrom)
    End If
End Function

' Sorts a string array by reporting-line code (insertion sort; the lists are short).
Public Sub SortCodes(a() As String)
    Dim i As Long, j As Long, t As String
    For i = LBound(a) + 1 To UBound(a)
        t = a(i): j = i - 1
        Do While j >= LBound(a)
            If CodeKey(a(j)) <= CodeKey(t) Then Exit Do
            a(j + 1) = a(j): j = j - 1
        Loop
        a(j + 1) = t
    Next i
End Sub

Public Sub Busy(onOff As Boolean)
    Application.ScreenUpdating = Not onOff
    Application.EnableEvents = Not onOff
    Application.Calculation = IIf(onOff, xlCalculationManual, xlCalculationAutomatic)
    If Not onOff Then Application.StatusBar = False
End Sub

Public Sub Status(s As String)
    Application.StatusBar = s
    DoEvents
End Sub

Public Sub HeadStyle(r As Range)
    With r
        .Font.Bold = True
        .Interior.Color = RGB(217, 217, 217)
        .WrapText = True
        .VerticalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(160, 160, 160)
    End With
End Sub

Public Const FMT_EUR As String = "#,##0.00;-#,##0.00;""-"""
Public Const FMT_PCT As String = "0.0%"

' Format$ wrapper (used by the dashboard module, which also uses the .Format property of charts).
Public Function Fmt(v As Variant, f As String) As String
    Fmt = Format$(v, f)
End Function
