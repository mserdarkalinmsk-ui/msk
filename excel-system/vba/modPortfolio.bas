Attribute VB_Name = "modPortfolio"
Option Explicit
' ---------------------------------------------------------------------------------------------
' Many projects in one workbook.
'   Projects       one row per project (budget head): identity, dates, signatories and the latest
'                  figures (budget, spent, spent + committed, time, flags) - the portfolio register
'   x_<BH>_*       hidden copies of each project's raw extraction and approved budget
'   Monthly        spending by project and month (from the dated postings)
'   Heads          heading status by project (notification / near addendum / addendum)
' The working sheets (REPORT, pivot, data for pivot, Analysis, Checks, By date, Postings, Budget,
' Settings) always show the selected project; Portfolio and Project dashboards draw from the register.
' ---------------------------------------------------------------------------------------------

Public Const SH_PROJECTS As String = "Projects"
Public Const SH_MONTHLY As String = "Monthly"
Public Const SH_HEADS As String = "Heads"
Public Const SH_PORTFOLIO As String = "Portfolio"
Public Const SH_PROJECTDASH As String = "Project dashboard"

' Register columns
Private Const P_BH As Long = 1, P_CODE As Long = 2, P_TITLE As Long = 3, P_CONTRACT As Long = 4, P_JP As Long = 5
Private Const P_START As Long = 6, P_END As Long = 7, P_TYPE As Long = 8, P_RATE As Long = 9, P_SIGN1 As Long = 10
Private Const P_SIGN2 As Long = 11, P_SRC As Long = 12, P_ASAT As Long = 13, P_BUDGET As Long = 14, P_SPENT As Long = 15
Private Const P_SC As Long = 16, P_USED As Long = 17, P_TIME As Long = 18, P_PACE As Long = 19, P_ERR As Long = 20
Private Const P_CHK As Long = 21, P_FLEX As Long = 22, P_UNITS As Long = 23, P_LOADED As Long = 24, P_AVAIL As Long = 25
Private Const P_LAST As Long = 25

Private Function RegHeaders() As Variant
    RegHeaders = Array("BH", "Code", "Project title", "Contract", "JP", "Start", "End", "Report type", "Admin rate", "Signatory 1", _
        "Signatory 2", "Source file", "Situation date", "Budget", "Spent", "Spent + committed", "Used %", "Time %", "Pace (points)", _
        "Errors", "To check", "Worst heading", "Units above budget", "Loaded on", "Available")
End Function

Public Function Reg() As Worksheet
    If Not SheetExists(SH_PROJECTS) Then
        Dim ws As Worksheet
        Set ws = Fresh(SH_PROJECTS)
        ws.Range("A1").Resize(1, P_LAST).Value = RegHeaders()
        HeadStyle ws.Range("A1").Resize(1, P_LAST)
        ws.Columns("A").NumberFormat = "@"
    End If
    Set Reg = Sh(SH_PROJECTS)
End Function

' Row of a budget head in the register (0 when absent).
Public Function RegRow(bh As String) As Long
    Dim ws As Worksheet, r As Long
    Set ws = Reg()
    For r = 2 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        If CStr(ws.Cells(r, P_BH).Value) = bh Then RegRow = r: Exit Function
    Next r
End Function

Public Function EnsureProject(bh As String) As Long
    Dim ws As Worksheet, r As Long
    r = RegRow(bh)
    If r = 0 Then
        Set ws = Reg()
        r = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
        ws.Cells(r, P_BH).NumberFormat = "@": ws.Cells(r, P_BH).Value = bh
        ws.Cells(r, P_CODE).Value = "BH" & bh
        ws.Cells(r, P_TYPE).Value = "Interim": ws.Cells(r, P_RATE).Value = 0.07
    End If
    EnsureProject = r
End Function

Public Function CurrentBH() As String
    CurrentBH = CStr(Setting("Budget head (BH)"))
End Function

' ---------------------------------------------------------------- raw storage per project
Private Function XName(bh As String, part As String) As String
    XName = "x_" & bh & "_" & part
End Function

Private Sub CopyValues(src As Worksheet, dst As Worksheet)
    Dim v As Variant
    dst.Cells.Clear
    If Application.WorksheetFunction.CountA(src.Cells) = 0 Then Exit Sub
    v = src.UsedRange.Value
    If IsArray(v) Then
        dst.Range("A1").Resize(UBound(v, 1), UBound(v, 2)).Value = v
    Else
        dst.Range("A1").Value = v
    End If
End Sub

Private Sub CopyText(src As Worksheet, dst As Worksheet, firstCol As Long)
    ' Budget codes are kept as text (1.10 is not 1.1).
    Dim r As Long, lastR As Long
    Call CopyValues(src, dst)
    lastR = src.Cells(src.Rows.Count, firstCol).End(xlUp).Row
    dst.Columns(firstCol).NumberFormat = "@"
    For r = 1 To lastR
        dst.Cells(r, firstCol).Value = CStr(src.Cells(r, firstCol).Value)
    Next r
End Sub

Public Sub StoreRaw(bh As String)
    Dim p As Variant
    For Each p In Array("Conso", "PO", "Inv", "GL", "Situation")
        Call CopyValues(Sh("raw_" & p), Fresh(XName(bh, CStr(p)), True))
    Next p
End Sub

Public Sub StoreBudget(bh As String)
    Call CopyText(Sh(SH_BUDGET), Fresh(XName(bh, "Budget"), True), 1)
End Sub

' Settings sheet <-> register row
Private Function SettingCols() As Variant
    SettingCols = Array(Array("Project title", P_TITLE), Array("Contract", P_CONTRACT), Array("JP number", P_JP), Array("Budget head (BH)", P_BH), _
        Array("Project start", P_START), Array("Project end", P_END), Array("Situation date", P_ASAT), Array("Report type", P_TYPE), _
        Array("Administrative costs rate", P_RATE), Array("Signatory 1", P_SIGN1), Array("Signatory 2", P_SIGN2), Array("Source file", P_SRC), Array("Loaded on", P_LOADED))
End Function

Public Sub SaveSettings(bh As String)
    Dim r As Long, x As Variant
    If bh = "" Then Exit Sub
    r = EnsureProject(bh)
    For Each x In SettingCols()
        If x(1) <> P_BH Then Reg().Cells(r, x(1)).Value = Setting(CStr(x(0)))
    Next x
End Sub

Public Sub LoadSettings(bh As String)
    Dim r As Long, x As Variant
    r = RegRow(bh)
    If r = 0 Then Exit Sub
    For Each x In SettingCols()
        SetSetting CStr(x(0)), Reg().Cells(r, x(1)).Value
    Next x
    SetSetting "Budget head (BH)", bh
End Sub

' Puts a project on the working sheets and rebuilds them.
Public Sub ActivateProject(bh As String)
    Dim p As Variant
    If RegRow(bh) = 0 Then Exit Sub
    Call LoadSettings(bh)
    For Each p In Array("Conso", "PO", "Inv", "GL", "Situation")
        If SheetExists(XName(bh, CStr(p))) Then
            Call CopyValues(Sh(XName(bh, CStr(p))), Fresh("raw_" & p, True))
        Else
            Call Fresh("raw_" & p, True)
        End If
    Next p
    Sh(SH_BUDGET).Range("A2:F1000").ClearContents
    If SheetExists(XName(bh, "Budget")) Then
        Dim src As Worksheet, n As Long
        Set src = Sh(XName(bh, "Budget"))
        n = src.Cells(src.Rows.Count, 1).End(xlUp).Row
        If n >= 2 Then
            Sh(SH_BUDGET).Range("A2:A" & n).NumberFormat = "@"
            Sh(SH_BUDGET).Range("A2").Resize(n - 1, 6).Value = src.Range("A2").Resize(n - 1, 6).Value
        End If
    End If
    If CStr(Sh(RAW_CONSO).Range("A1").Value) <> "" Then
        Call BuildAll
        Call Summarise(bh)
    End If
End Sub

' ---------------------------------------------------------------- figures of the selected project
Private Function ReportRow(prefix As String) As Long
    Dim ws As Worksheet, r As Long
    Set ws = Sh(SH_REPORT)
    For r = 1 To ws.UsedRange.Rows.Count + ws.UsedRange.Row
        If Left$(CStr(ws.Cells(r, 1).Value), Len(prefix)) = prefix Then ReportRow = r: Exit Function
    Next r
End Function

Public Sub Summarise(bh As String)
    Dim ws As Worksheet, r As Long, i As Long, an As Worksheet, ck As Worksheet, worst As String, rank As Long, s As String, units As Long
    Application.Calculate
    r = EnsureProject(bh): Set ws = Reg()
    Dim r11 As Long: r11 = ReportRow("11.")
    If r11 > 0 Then
        ws.Cells(r, P_BUDGET).Value = Sh(SH_REPORT).Cells(r11, 5).Value
        ws.Cells(r, P_SPENT).Value = Sh(SH_REPORT).Cells(r11, 8).Value
        ws.Cells(r, P_SC).Value = Sh(SH_REPORT).Cells(r11, 9).Value
        If Num(ws.Cells(r, P_BUDGET).Value) > 0 Then
            ws.Cells(r, P_USED).Value = Num(ws.Cells(r, P_SC).Value) / Num(ws.Cells(r, P_BUDGET).Value)
        End If
        ws.Cells(r, P_AVAIL).Value = Num(ws.Cells(r, P_BUDGET).Value) - Num(ws.Cells(r, P_SC).Value)
    End If
    ws.Cells(r, P_TIME).Value = TimeGone()
    ws.Cells(r, P_PACE).Value = Round((Num(ws.Cells(r, P_USED).Value) - TimeGone()) * 100, 1)
    Set ck = Sh(SH_CHECKS)
    ws.Cells(r, P_ERR).Value = Application.WorksheetFunction.CountIf(ck.Range("A:A"), "Error")
    ws.Cells(r, P_CHK).Value = Application.WorksheetFunction.CountIf(ck.Range("A:A"), "Check")
    ' Headings: worst status, and the heading table of the Heads sheet
    Set an = Sh(SH_ANALYSIS)
    Dim hs As Worksheet: Set hs = HeadsSheet()
    Call ClearRows(hs, 1, bh)
    worst = "Within budget": rank = 0
    For i = 5 To 20
        If CStr(an.Cells(i, 1).Value) = "" Or CStr(an.Cells(i, 1).Value) = "Line" Then Exit For
        s = CStr(an.Cells(i, 8).Value)
        Dim k As Long: k = hs.Cells(hs.Rows.Count, 1).End(xlUp).Row + 1
        hs.Cells(k, 1).NumberFormat = "@": hs.Cells(k, 1).Value = bh
        hs.Cells(k, 2).NumberFormat = "@": hs.Cells(k, 2).Value = CStr(an.Cells(i, 1).Value)
        hs.Cells(k, 3).Value = an.Cells(i, 2).Value: hs.Cells(k, 4).Value = an.Cells(i, 3).Value
        hs.Cells(k, 5).Value = an.Cells(i, 5).Value: hs.Cells(k, 6).Value = an.Cells(i, 7).Value: hs.Cells(k, 7).Value = s
        If Left$(s, 8) = "Addendum" And rank < 4 Then worst = s: rank = 4
        If Left$(s, 4) = "Near" And rank < 3 Then worst = s: rank = 3
        If Left$(s, 12) = "Notification" And rank < 2 Then worst = s: rank = 2
        If Left$(s, 5) = "Risk:" And rank < 1 Then worst = s: rank = 1
    Next i
    ws.Cells(r, P_FLEX).Value = worst
    units = 0
    For i = 5 To an.Cells(an.Rows.Count, 1).End(xlUp).Row
        If InStr(CStr(an.Cells(i, 16).Value), "Units above budget") = 1 Then units = units + 1
    Next i
    ws.Cells(r, P_UNITS).Value = units
    ' Monthly spending of this project
    Dim ms As Worksheet, p As Worksheet, d As Object, j As Long, m As String, key As Variant
    Set ms = MonthlySheet(): Call ClearRows(ms, 1, bh)
    Set p = Sh(SH_POSTINGS): Set d = CreateObject("Scripting.Dictionary")
    For j = 2 To p.Cells(p.Rows.Count, 1).End(xlUp).Row
        If IsDate(p.Cells(j, 1).Value) And CStr(p.Cells(j, 6).Value) <> "0" Then
            m = Format$(p.Cells(j, 1).Value, "yyyy-mm")
            d(m) = d(m) + Num(p.Cells(j, 9).Value)
        End If
    Next j
    For Each key In d.keys
        k = ms.Cells(ms.Rows.Count, 1).End(xlUp).Row + 1
        ms.Cells(k, 1).NumberFormat = "@": ms.Cells(k, 1).Value = bh
        ms.Cells(k, 2).Value = DateSerial(CInt(Left$(key, 4)), CInt(Right$(key, 2)), 1): ms.Cells(k, 3).Value = d(key)
    Next key
    ws.Range("F:G,M:M,X:X").NumberFormat = "dd/mm/yyyy"
    ws.Range("N:P,Y:Y").NumberFormat = FMT_EUR: ws.Range("I:I,Q:R").NumberFormat = "0%"
End Sub

Private Function MonthlySheet() As Worksheet
    If Not SheetExists(SH_MONTHLY) Then
        Dim ws As Worksheet: Set ws = Fresh(SH_MONTHLY, True)
        ws.Range("A1:C1").Value = Array("BH", "Month", "Spent")
    End If
    Set MonthlySheet = Sh(SH_MONTHLY)
End Function

Private Function HeadsSheet() As Worksheet
    If Not SheetExists(SH_HEADS) Then
        Dim ws As Worksheet: Set ws = Fresh(SH_HEADS, True)
        ws.Range("A1:G1").Value = Array("BH", "Heading", "Name", "Budget", "Spent + committed", "% vs budget", "Status")
    End If
    Set HeadsSheet = Sh(SH_HEADS)
End Function

' Deletes the rows whose column c equals v (bottom up).
Private Sub ClearRows(ws As Worksheet, c As Long, v As String)
    Dim r As Long
    For r = ws.Cells(ws.Rows.Count, c).End(xlUp).Row To 2 Step -1
        If CStr(ws.Cells(r, c).Value) = v Then ws.Rows(r).Delete
    Next r
End Sub

' ---------------------------------------------------------------- loading many files at once
Public Sub LoadExtractions()
    Dim files As Variant, f As Variant, wb As Workbook, bh As String, done As Object, n As Long, skipped As String, k As Variant
    files = Application.GetOpenFilename("Excel files (*.xlsx;*.xlsm;*.xls),*.xlsx;*.xlsm;*.xls", , "Choose one or more system extractions", , True)
    If Not IsArray(files) Then Exit Sub
    Set done = CreateObject("Scripting.Dictionary")
    Busy True
    On Error GoTo fail
    For Each f In files
        Status "Reading " & Dir$(CStr(f)) & "..."
        Set wb = Workbooks.Open(CStr(f), ReadOnly:=True, UpdateLinks:=False)
        If CopyRaw(wb) Then
            SetSetting "Budget head (BH)", ""
            Call ReadHeader(wb)
            bh = CurrentBH()
            If bh = "" Then bh = InputBox("Budget head (BH) of " & Dir$(CStr(f)) & "?", "Budget head")
            If bh <> "" Then
                Call EnsureProject(bh)
                Call StoreRaw(bh)
                Reg().Cells(RegRow(bh), P_SRC).Value = Dir$(CStr(f))
                Reg().Cells(RegRow(bh), P_ASAT).Value = Setting("Situation date")
                Reg().Cells(RegRow(bh), P_LOADED).Value = Now
                done(bh) = 1
            End If
        Else
            skipped = skipped & vbLf & Dir$(CStr(f))
        End If
        wb.Close False
    Next f
    For Each k In done.keys
        Status "Analysing BH " & k & "...": Call ActivateProject(CStr(k)): n = n + 1
    Next k
    Call BuildPortfolio
    Busy False
    Sh(SH_PORTFOLIO).Activate
    MsgBox n & " project(s) loaded and analysed." & IIf(skipped <> "", vbLf & vbLf & "Not an extraction (skipped):" & skipped, ""), vbInformation
    Exit Sub
fail:
    Busy False
    MsgBox "Could not read " & Dir$(CStr(f)) & ": " & Err.Description, vbCritical
End Sub

' Re-analyses every project and redraws the dashboards.
Public Sub RefreshAll()
    Dim ws As Worksheet, r As Long, cur As String
    Busy True
    cur = CurrentBH()
    If cur <> "" Then Call SaveSettings(cur): Call StoreBudget(cur)
    Set ws = Reg()
    For r = 2 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        Status "Analysing BH " & ws.Cells(r, 1).Value & "..."
        Call ActivateProject(CStr(ws.Cells(r, 1).Value))
    Next r
    If cur <> "" Then Call ActivateProject(cur)
    Call BuildPortfolio
    Busy False
    Sh(SH_PORTFOLIO).Activate
End Sub

' Selection from the Portfolio / Project dashboard drop-down.
Public Sub OpenSelected()
    Dim v As String, bh As String
    v = CStr(Sh(SH_PROJECTDASH).Range("C4").Value)
    If v = "" Then Exit Sub
    bh = Trim$(Split(v, " ")(0))
    bh = Replace(bh, "BH", "")
    Busy True
    If CurrentBH() <> "" And CurrentBH() <> bh Then Call SaveSettings(CurrentBH()): Call StoreBudget(CurrentBH())
    Call ActivateProject(bh)
    Call BuildProjectDashboard
    Busy False
    Sh(SH_PROJECTDASH).Activate
End Sub
