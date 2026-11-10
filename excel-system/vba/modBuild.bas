Attribute VB_Name = "modBuild"
Option Explicit
' ---------------------------------------------------------------------------------------------
' Builds, from the raw sheets, the finance team's chain:
'   data for pivot  ->  pivot  ->  REPORT (official interim/final financial report)
' plus Postings (every dated invoice and GL entry) and By date (spending between two dates).
'
' Units in "data for pivot":
'   NBRE_OF_UNITS      official report rule: 0 for a PO with nothing spent, the months paid on a
'                      staff PO ("from dd/mm/yyyy to dd/mm/yyyy", per month), else the units ordered
'   UNITS_ORDERED      as in the extraction
'   UNITS_SPENT_SHARE  analysis rule: only the spent share of a PO (45 days, 760 of 8,550 spent = 4)
' ---------------------------------------------------------------------------------------------

Public Sub BuildAll()
    Status "Building data for pivot...": BuildDataForPivot
    Status "Building pivot...": BuildPivot
    Status "Building the report...": BuildReport
    Status "Listing postings...": BuildPostings
    Status "Spending by date...": BuildByDate
    Application.Calculate
    Status "Analysing against the budget...": BuildAnalysis
    Status "Looking for entries posted in error...": BuildChecks
    Status ""
End Sub

' Months with an invoice on each PO (key: PO number).
Public Function PaidMonths() As Object
    Dim d As Object, ws As Worksheet, r As Long, cPo As Long, cPe As Long, cDg As Long, po As String, m As String, pe As Variant, dg As Variant, inner As Object
    Set d = CreateObject("Scripting.Dictionary")
    Set ws = Sh(RAW_INV)
    If ws.Cells(1, 1).Value = "" Then Set PaidMonths = d: Exit Function
    cPo = ColOf(ws, 1, "numeropo"): cPe = ColOf(ws, 1, "period"): cDg = ColOf(ws, 1, "dategl")
    If cPo = 0 Then Set PaidMonths = d: Exit Function
    For r = 2 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        po = Trim$(CStr(ws.Cells(r, cPo).Value))
        If po <> "" Then
            pe = "": dg = ""
            If cPe > 0 Then pe = ws.Cells(r, cPe).Value
            If cDg > 0 Then dg = ws.Cells(r, cDg).Value
            m = MonthKey(pe, dg)
            If m <> "" Then
                If Not d.Exists(po) Then d.Add po, CreateObject("Scripting.Dictionary")
                Set inner = d(po)
                inner(m) = 1
            End If
        End If
    Next r
    Set PaidMonths = d
End Function

Public Function UnitsUsed(units As Double, spent As Double, sc As Double, desc As String, unitType As String, paid As Long, official As Boolean) As Double
    Dim a As Date, b As Date
    If units = 0 Then Exit Function
    If Abs(spent) < 0.005 Then UnitsUsed = 0: Exit Function
    If InStr(1, unitType, "month", vbTextCompare) > 0 And PeriodOf(desc, a, b) And paid > 0 Then
        UnitsUsed = IIf(paid < units, paid, units): Exit Function
    End If
    If official Then UnitsUsed = units: Exit Function
    If sc > spent + 0.005 And sc > 0 Then UnitsUsed = Round(units * spent / sc, 2) Else UnitsUsed = units
End Function

Public Sub BuildDataForPivot()
    Dim src As Worksheet, ws As Worksheet, r As Long, n As Long, lastR As Long, paid As Object
    Dim C As Object, out() As Variant, k As Long, po As String, u As Double, sp As Double, sc As Double, pm As Long
    Dim src0 As String, desc As String, ut As String, ln As String
    Set src = Sh(RAW_CONSO)
    Set paid = PaidMonths()
    Set C = CreateObject("Scripting.Dictionary")
    C("src") = ColOf(src, 1, "source"): C("line") = ColOf(src, 1, "reportingline"): C("ut") = ColOf(src, 1, "unittype")
    C("u") = ColOf(src, 1, "nbreofunits"): C("doc") = ColOf(src, 1, "docnumber"): C("d") = ColOf(src, 1, "description")
    C("dl") = ColOf(src, 1, "descriptionline"): C("sup") = ColOf(src, 1, "supplier"): C("amt") = ColOf(src, 1, "poamounteur")
    C("sp") = ColOf(src, 1, "spenteur"): C("cm") = ColOf(src, 1, "committedeur"): C("sc") = ColOf(src, 1, "spentcomeur")
    C("st") = ColOf(src, 1, "closurestatus"): C("dt") = ColOf(src, 1, "acctdate", "encumbereddate")
    lastR = src.Cells(src.Rows.Count, 1).End(xlUp).Row
    ReDim out(1 To Application.Max(1, lastR), 1 To 16)
    For r = 2 To lastR
        src0 = Trim$(CStr(src.Cells(r, C("src")).Value))
        If src0 <> "" And LCase$(Left$(src0, 5)) <> "total" Then
            k = k + 1
            ln = Trim$(CStr(src.Cells(r, C("line")).Value)): If ln = "" Then ln = "0"
            desc = CStr(src.Cells(r, C("d")).Value): ut = CStr(src.Cells(r, C("ut")).Value)
            po = Trim$(CStr(src.Cells(r, C("doc")).Value))
            u = Num(src.Cells(r, C("u")).Value): sp = Num(src.Cells(r, C("sp")).Value): sc = Num(src.Cells(r, C("sc")).Value)
            pm = 0
            If Left$(src0, 1) = "1" And paid.Exists(po) Then pm = paid(po).Count
            out(k, 1) = src0: out(k, 2) = ln: out(k, 3) = ut
            If Left$(src0, 1) = "1" Then
                out(k, 4) = UnitsUsed(u, sp, sc, desc, ut, pm, True)
                out(k, 6) = UnitsUsed(u, sp, sc, desc, ut, pm, False)
            Else
                out(k, 4) = u: out(k, 6) = u
            End If
            out(k, 5) = u: out(k, 7) = po: out(k, 8) = desc
            out(k, 9) = src.Cells(r, C("dl")).Value
            If C("sup") > 0 Then out(k, 10) = src.Cells(r, C("sup")).Value
            If C("amt") > 0 Then out(k, 11) = Num(src.Cells(r, C("amt")).Value)
            out(k, 12) = sp: out(k, 13) = Num(src.Cells(r, C("cm")).Value): out(k, 14) = sc
            If C("st") > 0 Then out(k, 15) = src.Cells(r, C("st")).Value
            If C("dt") > 0 Then out(k, 16) = src.Cells(r, C("dt")).Value
        End If
    Next r
    Set ws = Fresh(SH_DFP)
    ws.Range("A1:P1").Value = Array("SOURCE", "REPORTING_LINE", "UNIT_TYPE", "NBRE_OF_UNITS", "UNITS_ORDERED", "UNITS_SPENT_SHARE", "DOC_NUMBER", "DESCRIPTION", "DESCRIPTION_LINE", "SUPPLIER", "PO_AMOUNT_EUR", "SPENT_EUR", "COMMITTED_EUR", "SPENT_COM_EUR", "CLOSURE_STATUS", "DATE")
    HeadStyle ws.Range("A1:P1")
    If k > 0 Then
        ws.Range("A2").Resize(k, 16).Value = out
        ws.Range("B2").Resize(k, 1).NumberFormat = "@"
        ws.Range("B2").Resize(k, 1).Value = Application.Index(out, 0, 2)
        ws.Range("K2:N" & k + 1).NumberFormat = FMT_EUR
        ws.Range("P2:P" & k + 1).NumberFormat = "dd/mm/yyyy"
    End If
    ws.Range("D1").Interior.Color = RGB(255, 242, 204)
    ws.Range("D1").AddComment "Units counted by the official report. You may correct a value here: pivot and REPORT follow."
    ws.Columns("A:P").ColumnWidth = 13: ws.Columns("H").ColumnWidth = 50: ws.Columns("I:J").ColumnWidth = 30
    ws.Rows(1).RowHeight = 30
    ws.Activate: ws.Range("A2").Select: ActiveWindow.FreezePanes = False: ActiveWindow.FreezePanes = True
    ws.Range("A1:P1").AutoFilter
End Sub

' Reporting lines found in data for pivot, sorted (levies on line "0" first).
Public Function LineCodes() As String()
    Dim ws As Worksheet, r As Long, d As Object, a() As String, i As Long, k As Variant
    Set ws = Sh(SH_DFP)
    Set d = CreateObject("Scripting.Dictionary")
    For r = 2 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        If Not d.Exists(CStr(ws.Cells(r, 2).Value)) Then d.Add CStr(ws.Cells(r, 2).Value), 1
    Next r
    If d.Count = 0 Then ReDim a(0 To 0): LineCodes = a: Exit Function
    ReDim a(0 To d.Count - 1)
    For Each k In d.keys: a(i) = k: i = i + 1: Next k
    SortCodes a
    LineCodes = a
End Function

Public Sub BuildPivot()
    Dim ws As Worksheet, codes() As String, i As Long, r As Long, D As String
    Set ws = Fresh(SH_PIVOT)
    D = "'" & SH_DFP & "'!"
    ws.Range("A1:E1").Value = Array("Row Labels", "Sum of NBRE_OF_UNITS", "Sum of SPENT_EUR", "Sum of SPENT_COM_EUR", "Units used (spent share)")
    HeadStyle ws.Range("A1:E1")
    codes = LineCodes()
    r = 2
    For i = LBound(codes) To UBound(codes)
        If codes(i) <> "" Then
            ws.Cells(r, 1).NumberFormat = "@": ws.Cells(r, 1).Value = codes(i)
            ws.Cells(r, 2).Formula = "=SUMIF(" & D & "$B:$B,$A" & r & "," & D & "$D:$D)"
            ws.Cells(r, 3).Formula = "=SUMIF(" & D & "$B:$B,$A" & r & "," & D & "$L:$L)"
            ws.Cells(r, 4).Formula = "=SUMIF(" & D & "$B:$B,$A" & r & "," & D & "$N:$N)"
            ws.Cells(r, 5).Formula = "=SUMIF(" & D & "$B:$B,$A" & r & "," & D & "$F:$F)"
            r = r + 1
        End If
    Next i
    ws.Cells(r, 1).Value = "Grand Total": ws.Cells(r, 1).Font.Bold = True
    ws.Range(ws.Cells(r, 2), ws.Cells(r, 5)).Formula = "=SUM(B2:B" & r - 1 & ")"
    ws.Range(ws.Cells(r, 2), ws.Cells(r, 5)).Font.Bold = True
    ws.Range("C2:D" & r).NumberFormat = FMT_EUR
    ws.Range("B2:B" & r & ",E2:E" & r).NumberFormat = "#,##0.##"
    ws.Columns("A:E").ColumnWidth = 18
    If ws.Cells(2, 1).Value = "0" Then ws.Cells(2, 1).AddComment "Levy on donor tranches: not a line of the report (the report's line 10 is 7% of the direct costs)."
End Sub

' ------------------------------------------------------------------ REPORT
Public Sub BuildReport()
    Dim ws As Worksheet, bud As Worksheet, r As Long, br As Long, lastB As Long, code As String, top As String, curTop As String
    Dim leafs As String, subs As String, unit As String, rate As Double, title As Variant, t As Variant
    Dim r7 As Long, r9 As Long, r10 As Long, hdr As Long, adminRate As Double, final As Boolean, asAt As Date
    Set ws = Fresh(SH_REPORT): Set bud = Sh(SH_BUDGET)
    adminRate = Num(Setting("Administrative costs rate")): If adminRate = 0 Then adminRate = 0.07
    If adminRate > 1 Then adminRate = adminRate / 100
    asAt = ToDate(Setting("Situation date"))
    final = (LCase$(CStr(Setting("Report type"))) = "final")
    ws.Columns("A").ColumnWidth = 62: ws.Columns("B").ColumnWidth = 14
    ws.Columns("C:I").ColumnWidth = 14
    r = 1
    For Each t In Array(Setting("Project title"), Setting("Contract"), IIf(CStr(Setting("JP number")) <> "", "JP " & Setting("JP number") & " - ", "") & IIf(CStr(Setting("Budget head (BH)")) <> "", "BH " & Setting("Budget head (BH)"), ""))
        If Trim$(CStr(t)) <> "" Then
            ws.Cells(r, 1).Value = t
            ws.Range(ws.Cells(r, 1), ws.Cells(r, 9)).Merge
            ws.Cells(r, 1).HorizontalAlignment = xlCenter: ws.Cells(r, 1).Font.Size = 14
            r = r + 1
        End If
    Next t
    r = r + 1: hdr = r
    ws.Cells(r, 1).Value = IIf(final, "Final", "Interim") & " financial report covering period from " & Format$(ToDate(Setting("Project start")), "dd/mm/yyyy") & " to " & Format$(IIf(final, ToDate(Setting("Project end")), asAt), "dd/mm/yyyy")
    ws.Cells(r, 3).Value = "Budget for all Years"
    ws.Cells(r, 6).Value = "Actual expenditure" & vbLf & "as at " & Format$(asAt, "dd/mm/yyyy")
    ws.Cells(r, 9).Value = IIf(final, "", "Spent and committed (2)" & vbLf & "(in EUR)")
    ws.Range(ws.Cells(r, 3), ws.Cells(r, 5)).Merge: ws.Range(ws.Cells(r, 6), ws.Cells(r, 8)).Merge
    ws.Range(ws.Cells(r + 1, 1), ws.Cells(r + 1, 9)).Value = Array("Description", "Unit", "# of units", "Unit rate" & vbLf & "(in EUR)", "Cost" & vbLf & "(in EUR)", "# of units", "Unit rate" & vbLf & "(in EUR)", "Spent (1)" & vbLf & "(in EUR)", "")
    HeadStyle ws.Range(ws.Cells(r, 1), ws.Cells(r + 1, 9))
    ws.Range(ws.Cells(r, 1), ws.Cells(r + 1, 9)).HorizontalAlignment = xlCenter
    ws.Rows(r).RowHeight = 42: ws.Rows(r + 1).RowHeight = 32
    r = r + 2
    lastB = bud.Cells(bud.Rows.Count, 1).End(xlUp).Row
    If lastB < 2 Then
        ws.Cells(r, 1).Value = "Load the approved budget first (Control > Load budget)."
        Exit Sub
    End If
    For br = 2 To lastB
        code = Trim$(CStr(bud.Cells(br, 1).Value))
        If code <> "" Then
            top = Split(code, ".")(0)
            If curTop <> "" And top <> curTop Then r = SubTotal(ws, r, curTop, leafs, subs): leafs = ""
            curTop = top
            unit = Trim$(CStr(bud.Cells(br, 3).Value))
            ws.Cells(r, 1).Value = code & " " & bud.Cells(br, 2).Value
            If unit = "" Then
                ws.Cells(r, 1).Font.Bold = True
            Else
                ws.Cells(r, 2).Value = unit
                ws.Cells(r, 3).Value = bud.Cells(br, 4).Value
                ws.Cells(r, 4).Value = bud.Cells(br, 5).Value
                If IsNumeric(bud.Cells(br, 6).Value) And bud.Cells(br, 6).Value <> "" Then ws.Cells(r, 5).Value = bud.Cells(br, 6).Value Else ws.Cells(r, 5).Formula = "=IF(ISBLANK(C" & r & "),0,C" & r & "*D" & r & ")"
                ws.Cells(r, 6).Formula = "=IFERROR(VLOOKUP(""" & code & """,pivot!$A:$E,2,FALSE),0)"
                ws.Cells(r, 8).Formula = "=IFERROR(VLOOKUP(""" & code & """,pivot!$A:$E,3,FALSE),0)"
                If Not final Then ws.Cells(r, 9).Formula = "=IFERROR(VLOOKUP(""" & code & """,pivot!$A:$E,4,FALSE),0)"
                ws.Cells(r, 7).Formula = "=IF(F" & r & "=0,0,H" & r & "/F" & r & ")"
                leafs = leafs & IIf(leafs = "", "", ",") & r
            End If
            r = r + 1
        End If
    Next br
    If curTop <> "" Then r = SubTotal(ws, r, curTop, leafs, subs)
    ' Totals 7 to 11
    r = r + 1: r7 = r
    ws.Cells(r, 1).Value = "7. Sub-total Direct eligible costs of the action (1+2+3+4+5+6)"
    TotalCells ws, r, "=SUM(" & ListOf(subs, "{c}") & ")", final
    r = r + 2: ws.Cells(r, 1).Value = "8. Provision for contingency reserve (maximum 5% of 7. Sub-total of direct eligible costs of the Action)"
    r = r + 2: r9 = r: ws.Cells(r, 1).Value = "9. Total direct eligible costs of the action (7 + 8)"
    TotalCells ws, r, "={c}" & r7 & "+N({c}" & r7 + 2 & ")", final
    r = r + 2: r10 = r: ws.Cells(r, 1).Value = "10. Administrative costs (maximum 7% of 9. Total direct eligible costs of the action) (3)"
    TotalCells ws, r, "=ROUND({c}" & r9 & "*" & Replace(CStr(adminRate), ",", ".") & ",2)", final
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 9)).Font.Bold = False
    r = r + 2: ws.Cells(r, 1).Value = "11. Total eligible costs (9 + 10)"
    TotalCells ws, r, "={c}" & r9 & "+{c}" & r10, final
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 9)).Borders(xlEdgeBottom).LineStyle = xlDouble
    ' Footnotes, certification, signatures
    r = r + 2
    ws.Cells(r, 1).Value = "(1) Expenditure accounted for in the CoE financial records as of " & Format$(asAt, "dd/mm/yyyy")
    If Not final Then ws.Cells(r + 1, 1).Value = "(2) Committed activities not accounted for as expenditure in the CoE financial records as of " & Format$(asAt, "dd/mm/yyyy")
    ws.Cells(r + 2, 1).Value = "(3) A levy of " & Format$(adminRate, "0%") & " is applied in accordance with the CM decision (CM(2013)123) and adjusted in line with the actual expenditure as presented in this " & IIf(final, "Final", "Interim") & " Financial Report."
    ws.Range(ws.Cells(r, 1), ws.Cells(r + 2, 1)).Font.Size = 9
    r = r + 5
    ws.Cells(r, 1).Value = "Expenditure incurred is in accordance with the Council of Europe Financial Regulations, the costs are eligible under and have been incurred in line with the project budget set out in the Agreement."
    ws.Cells(r, 5).Value = "The total eligible costs presented in this financial report match expenditure accounted for in the Council of Europe financial records."
    ws.Cells(r, 1).WrapText = True: ws.Range(ws.Cells(r, 5), ws.Cells(r, 9)).Merge: ws.Cells(r, 5).WrapText = True: ws.Rows(r).RowHeight = 48
    r = r + 2: ws.Cells(r, 1).Value = "Date:": ws.Cells(r, 5).Value = "Date:"
    r = r + 2
    Dim s1() As String, s2() As String, i As Long
    s1 = Split(CStr(Setting("Signatory 1")), "|"): s2 = Split(CStr(Setting("Signatory 2")), "|")
    For i = 0 To 3
        If i <= UBound(s1) Then ws.Cells(r + i, 1).Value = Trim$(s1(i))
        If i <= UBound(s2) Then ws.Cells(r + i, 5).Value = Trim$(s2(i))
    Next i
    ws.Cells(r, 1).Font.Bold = True: ws.Cells(r, 5).Font.Bold = True
    ' Number formats and print setup
    ws.Range("C" & hdr + 2 & ":I" & r7 + 20).NumberFormat = FMT_EUR
    ws.Range("C" & hdr + 2 & ":C" & r7).NumberFormat = "#,##0.##;-#,##0.##;""-"""
    ws.Range("F" & hdr + 2 & ":F" & r7).NumberFormat = "#,##0.##;-#,##0.##;""-"""
    ws.Range("A" & hdr + 2 & ":A" & r7).WrapText = True
    With ws.PageSetup
        .Orientation = xlPortrait: .Zoom = False: .FitToPagesWide = 1: .FitToPagesTall = 1
        .PrintArea = "A1:I" & r + 4
    End With
    If final Then ws.Columns("I").Hidden = True
End Sub

Private Function SubTotal(ws As Worksheet, r As Long, top As String, leafs As String, ByRef subs As String) As Long
    ws.Cells(r, 1).Value = "Sub-total " & top & " " & HeadingName(top)
    TotalCells ws, r, IIf(leafs = "", "=0", "=SUM(" & ListOf(leafs, "{c}") & ")"), False
    subs = subs & IIf(subs = "", "", ",") & r
    SubTotal = r + 2
End Function

' Writes formula f (with {c} = column letter) in E, H, I of row r, bold on grey.
Private Sub TotalCells(ws As Worksheet, r As Long, f As String, final As Boolean)
    Dim c As Variant
    For Each c In Array("E", "H", "I")
        ws.Range(c & r).Formula = Replace(f, "{c}", c)
    Next c
    With ws.Range(ws.Cells(r, 1), ws.Cells(r, 9))
        .Font.Bold = True: .Interior.Color = RGB(217, 217, 217)
        .Borders(xlEdgeTop).LineStyle = xlContinuous
    End With
End Sub

' "12,15,20" -> "{c}12,{c}15,{c}20"
Private Function ListOf(rows As String, prefix As String) As String
    Dim p() As String, i As Long, out As String
    p = Split(rows, ",")
    For i = 0 To UBound(p)
        out = out & IIf(out = "", "", ",") & prefix & p(i)
    Next i
    ListOf = out
End Function

Public Function HeadingName(top As String) As String
    Dim bud As Worksheet, r As Long
    Set bud = Sh(SH_BUDGET)
    For r = 2 To bud.Cells(bud.Rows.Count, 1).End(xlUp).Row
        If Trim$(CStr(bud.Cells(r, 1).Value)) = top Then HeadingName = bud.Cells(r, 2).Value: Exit Function
    Next r
    Select Case top
        Case "1": HeadingName = "Human resources"
        Case "2": HeadingName = "Travel"
        Case "3": HeadingName = "Equipment and supplies"
        Case "4": HeadingName = "Local office"
        Case "5": HeadingName = "Other costs, services"
        Case "6": HeadingName = "Other"
    End Select
End Function

' ------------------------------------------------------------------ Postings and By date
Public Sub BuildPostings()
    Dim ws As Worksheet, inv As Worksheet, gl As Worksheet, po As Worksheet, r As Long, k As Long, out() As Variant, n As Long
    Dim poLine As Object, poSup As Object, poDesc As Object, key As String, c As Object
    Set inv = Sh(RAW_INV): Set gl = Sh(RAW_GL): Set po = Sh(RAW_PO)
    Set poLine = CreateObject("Scripting.Dictionary"): Set poSup = CreateObject("Scripting.Dictionary"): Set poDesc = CreateObject("Scripting.Dictionary")
    Set c = CreateObject("Scripting.Dictionary")
    If po.Cells(1, 1).Value <> "" Then
        c("po") = ColOf(po, 1, "ponumber"): c("na") = ColOf(po, 1, "nature"): c("ln") = ColOf(po, 1, "reportingline")
        c("sup") = ColOf(po, 1, "supplier"): c("d") = ColOf(po, 1, "descriptionpo")
        For r = 2 To po.Cells(po.Rows.Count, 1).End(xlUp).Row
            key = Trim$(CStr(po.Cells(r, c("po")).Value))
            If key <> "" Then
                If c("na") > 0 Then
                    poLine(key & "|" & Trim$(CStr(po.Cells(r, c("na")).Value))) = CStr(po.Cells(r, c("ln")).Value)
                End If
                If Not poLine.Exists(key) Then poLine(key) = CStr(po.Cells(r, c("ln")).Value)
                If c("sup") > 0 Then
                    poSup(key) = po.Cells(r, c("sup")).Value
                End If
                poDesc(key) = po.Cells(r, c("d")).Value
            End If
        Next r
    End If
    n = Application.Max(1, inv.UsedRange.Rows.Count + gl.UsedRange.Rows.Count)
    ReDim out(1 To n, 1 To 10)
    If inv.Cells(1, 1).Value <> "" Then
        Dim iDg As Long, iPe As Long, iNo As Long, iD As Long, iAm As Long, iPo As Long, iNa As Long, iPf As Long, pk As String, na As String
        iDg = ColOf(inv, 1, "dategl"): iPe = ColOf(inv, 1, "period"): iNo = ColOf(inv, 1, "invoiceno"): iD = ColOf(inv, 1, "description")
        iAm = ColOf(inv, 1, "montantengage", "montantligne"): iPo = ColOf(inv, 1, "numeropo"): iNa = ColOf(inv, 1, "nature"): iPf = ColOf(inv, 1, "postedflag")
        For r = 2 To inv.Cells(inv.Rows.Count, 1).End(xlUp).Row
            If Trim$(CStr(inv.Cells(r, iNo).Value)) <> "" And IsNumeric(inv.Cells(r, iAm).Value) Then
                k = k + 1
                pk = Trim$(CStr(inv.Cells(r, iPo).Value))
                out(k, 1) = ToDate(inv.Cells(r, iDg).Value): If out(k, 1) = 0 Then out(k, 1) = ToDate(inv.Cells(r, iPe).Value)
                out(k, 2) = inv.Cells(r, iPe).Value: out(k, 3) = "Invoice": out(k, 4) = inv.Cells(r, iNo).Value: out(k, 5) = pk
                na = ""
                If iNa > 0 Then na = pk & "|" & Trim$(CStr(inv.Cells(r, iNa).Value))
                If na <> "" And poLine.Exists(na) Then
                    out(k, 6) = poLine(na)
                ElseIf poLine.Exists(pk) Then
                    out(k, 6) = poLine(pk)
                End If
                If poSup.Exists(pk) Then out(k, 7) = poSup(pk)
                If poDesc.Exists(pk) Then
                    out(k, 8) = poDesc(pk)
                ElseIf iD > 0 Then
                    out(k, 8) = inv.Cells(r, iD).Value
                End If
                out(k, 9) = Num(inv.Cells(r, iAm).Value)
                If iPf > 0 Then out(k, 10) = inv.Cells(r, iPf).Value
            End If
        Next r
    End If
    If gl.Cells(1, 1).Value <> "" Then
        Dim gAd As Long, gPe As Long, gNo As Long, gLn As Long, gD As Long, gDl As Long, gSp As Long, gPf As Long
        gAd = ColOf(gl, 1, "accountingdate"): gPe = ColOf(gl, 1, "period"): gNo = ColOf(gl, 1, "glnumber"): gLn = ColOf(gl, 1, "reportingline")
        gD = ColOf(gl, 1, "description"): gDl = ColOf(gl, 1, "linedescription"): gSp = ColOf(gl, 1, "spent"): gPf = ColOf(gl, 1, "postingflag")
        For r = 2 To gl.Cells(gl.Rows.Count, 1).End(xlUp).Row
            If Trim$(CStr(gl.Cells(r, gNo).Value)) <> "" And IsNumeric(gl.Cells(r, gSp).Value) Then
                k = k + 1
                out(k, 1) = ToDate(gl.Cells(r, gAd).Value): If out(k, 1) = 0 Then out(k, 1) = ToDate(gl.Cells(r, gPe).Value)
                out(k, 2) = gl.Cells(r, gPe).Value: out(k, 3) = "GL": out(k, 4) = gl.Cells(r, gNo).Value
                out(k, 6) = CStr(gl.Cells(r, gLn).Value): If out(k, 6) = "" Then out(k, 6) = "0"
                out(k, 8) = gl.Cells(r, gD).Value
                If gDl > 0 Then
                    If CStr(gl.Cells(r, gDl).Value) <> "" Then out(k, 8) = out(k, 8) & " - " & gl.Cells(r, gDl).Value
                End If
                out(k, 9) = Num(gl.Cells(r, gSp).Value)
                If gPf > 0 Then out(k, 10) = gl.Cells(r, gPf).Value
            End If
        Next r
    End If
    Set ws = Fresh(SH_POSTINGS)
    ws.Range("A1:J1").Value = Array("Date", "Period", "Type", "Document", "PO", "Line", "Supplier", "Description", "Amount", "Posted")
    HeadStyle ws.Range("A1:J1")
    If k > 0 Then
        ws.Range("F2").Resize(k, 1).NumberFormat = "@"
        ws.Range("A2").Resize(k, 10).Value = out
        ws.Range("A1").Resize(k + 1, 10).Sort Key1:=ws.Range("A1"), Order1:=xlAscending, Header:=xlYes
        ws.Range("A2:A" & k + 1).NumberFormat = "dd/mm/yyyy"
        ws.Range("I2:I" & k + 1).NumberFormat = FMT_EUR
    End If
    ws.Columns("A:J").ColumnWidth = 12: ws.Columns("D").ColumnWidth = 30: ws.Columns("G").ColumnWidth = 30: ws.Columns("H").ColumnWidth = 60
    ws.Range("A1:J1").AutoFilter
End Sub

Public Sub BuildByDate()
    Dim ws As Worksheet, codes() As String, i As Long, r As Long, P As String, keepFrom As Variant, keepTo As Variant
    On Error Resume Next
    keepFrom = Sh(SH_BYDATE).Range("B3").Value: keepTo = Sh(SH_BYDATE).Range("B4").Value
    On Error GoTo 0
    Set ws = Fresh(SH_BYDATE)
    P = "'" & SH_POSTINGS & "'!"
    ws.Range("A1").Value = "Spending between two dates (invoices on POs by GL date + GL entries)": ws.Range("A1").Font.Bold = True: ws.Range("A1").Font.Size = 13
    ws.Range("A3").Value = "From": ws.Range("A4").Value = "To"
    If IsDate(keepFrom) Then ws.Range("B3").Value = keepFrom Else ws.Range("B3").Value = DateSerial(Year(Date), 1, 1)
    If IsDate(keepTo) Then ws.Range("B4").Value = keepTo Else ws.Range("B4").Value = Date
    ws.Range("B3:B4").NumberFormat = "dd/mm/yyyy": ws.Range("B3:B4").Interior.Color = RGB(255, 242, 204)
    ws.Range("C3").Value = "<- type the dates; the table follows"
    ws.Range("A6:D6").Value = Array("Line", "Description", "Spent in range", "Postings")
    HeadStyle ws.Range("A6:D6")
    codes = LineCodes()
    r = 7
    For i = LBound(codes) To UBound(codes)
        If codes(i) <> "" Then
            ws.Cells(r, 1).NumberFormat = "@": ws.Cells(r, 1).Value = codes(i)
            ws.Cells(r, 2).Value = IIf(codes(i) = "0", "Levy on donor tranches / no reporting line", BudgetName(codes(i)))
            ws.Cells(r, 3).Formula = "=SUMIFS(" & P & "$I:$I," & P & "$F:$F,$A" & r & "," & P & "$A:$A,"">=""&$B$3," & P & "$A:$A,""<=""&$B$4)"
            ws.Cells(r, 4).Formula = "=COUNTIFS(" & P & "$F:$F,$A" & r & "," & P & "$A:$A,"">=""&$B$3," & P & "$A:$A,""<=""&$B$4)"
            r = r + 1
        End If
    Next i
    ws.Cells(r, 1).Value = "Total": ws.Cells(r, 3).Formula = "=SUM(C7:C" & r - 1 & ")": ws.Cells(r, 4).Formula = "=SUM(D7:D" & r - 1 & ")"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 4)).Font.Bold = True
    ws.Range("C7:C" & r).NumberFormat = FMT_EUR
    ws.Columns("A").ColumnWidth = 12: ws.Columns("B").ColumnWidth = 55: ws.Columns("C:D").ColumnWidth = 16
    ' By month
    Dim m As Date, c As Long
    ws.Range("F6").Value = "Month": ws.Range("G6").Value = "Spent": HeadStyle ws.Range("F6:G6")
    m = DateSerial(Year(ws.Range("B3").Value), Month(ws.Range("B3").Value), 1)
    c = 7
    Do While m <= ws.Range("B4").Value And c < 80
        ws.Cells(c, 6).Value = m: ws.Cells(c, 6).NumberFormat = "mmm yyyy"
        ws.Cells(c, 7).Formula = "=SUMIFS(" & P & "$I:$I," & P & "$A:$A,"">=""&F" & c & "," & P & "$A:$A,""<=""&EOMONTH(F" & c & ",0))"
        c = c + 1: m = DateSerial(Year(m), Month(m) + 1, 1)
    Loop
    ws.Range("G7:G" & c).NumberFormat = FMT_EUR
    ws.Columns("F:G").ColumnWidth = 14
    ws.Range("F5").Value = "(re-run Refresh after changing the dates to rebuild the month list)"
    ws.Range("F5").Font.Italic = True: ws.Range("F5").Font.Size = 8
End Sub

Public Function BudgetName(code As String) As String
    Dim bud As Worksheet, r As Long
    Set bud = Sh(SH_BUDGET)
    For r = 2 To bud.Cells(bud.Rows.Count, 1).End(xlUp).Row
        If Trim$(CStr(bud.Cells(r, 1).Value)) = code Then BudgetName = bud.Cells(r, 2).Value: Exit Function
    Next r
End Function

Public Sub Refresh()
    Busy True
    BuildAll
    Busy False
End Sub
