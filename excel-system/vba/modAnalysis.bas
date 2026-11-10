Attribute VB_Name = "modAnalysis"
Option Explicit
' ---------------------------------------------------------------------------------------------
' Analysis: every budget line against the approved budget (units used = spent share only),
' headings against the 25% flexibility (notification / near addendum / addendum), now and at the
' current pace. Checks: entries that look posted in error.
' ---------------------------------------------------------------------------------------------

Private Const C_RED As Long = 13421823      ' RGB(255,204,204)
Private Const C_AMBER As Long = 10284031    ' RGB(255,235,156)
Private Const C_GREEN As Long = 13561798    ' RGB(198,239,206)
Private Const C_GREY As Long = 15132390     ' RGB(230,230,230)

' Share of the project time gone at the situation date (0..1).
Public Function TimeGone() As Double
    Dim s As Date, e As Date, a As Date
    s = ToDate(Setting("Project start")): e = ToDate(Setting("Project end")): a = ToDate(Setting("Situation date"))
    If s = 0 Or e <= s Then Exit Function
    If a = 0 Then a = Date
    TimeGone = Application.Max(0, Application.Min(1, (a - s) / (e - s)))
End Function

Private Function PivotVal(code As String, col As Long) As Double
    Dim v As Variant
    v = Application.VLookup(code, Sh(SH_PIVOT).Range("A:E"), col, False)
    If Not IsError(v) Then PivotVal = Num(v)
End Function

Public Sub BuildAnalysis()
    Dim ws As Worksheet, bud As Worksheet, r As Long, br As Long, code As String, el As Double
    Dim b As Double, bu As Double, brt As Double, sp As Double, sc As Double, uu As Double, used As Double, uPct As Double, rt As Double
    Dim stt As String, col As Long, top As String, heads As Object, k As Variant, h() As Double
    Set bud = Sh(SH_BUDGET): Set ws = Fresh(SH_ANALYSIS)
    el = TimeGone()
    ws.Range("A1").Value = "Against the approved budget": ws.Range("A1").Font.Bold = True: ws.Range("A1").Font.Size = 13
    ws.Range("A2").Value = "Situation " & Format$(ToDate(Setting("Situation date")), "dd/mm/yyyy") & " - " & Format$(el, "0%") & " of the project time gone. Units used count only the spent share of a PO (committed units are not used yet)."
    ws.Range("A2").Font.Italic = True
    ' Headings
    Set heads = CreateObject("Scripting.Dictionary")
    For br = 2 To bud.Cells(bud.Rows.Count, 1).End(xlUp).Row
        code = Trim$(CStr(bud.Cells(br, 1).Value))
        If code <> "" And Trim$(CStr(bud.Cells(br, 3).Value)) <> "" Then
            top = Split(code, ".")(0)
            If Not heads.Exists(top) Then heads.Add top, Array(0#, 0#, 0#)
            h = ToD(heads(top))
            h(0) = h(0) + Num(bud.Cells(br, 6).Value): h(1) = h(1) + PivotVal(code, 3): h(2) = h(2) + PivotVal(code, 4)
            heads(top) = h
        End If
    Next br
    ws.Range("A4:H4").Value = Array("Heading", "Name", "Approved budget", "Spent", "Spent + committed", "Difference", "% vs budget", "Status (now / at the current pace)")
    HeadStyle ws.Range("A4:H4")
    r = 5
    For Each k In heads.keys
        h = ToD(heads(k))
        ws.Cells(r, 1).NumberFormat = "@": ws.Cells(r, 1).Value = k: ws.Cells(r, 2).Value = HeadingName(CStr(k))
        ws.Cells(r, 3).Value = h(0): ws.Cells(r, 4).Value = h(1): ws.Cells(r, 5).Value = h(2): ws.Cells(r, 6).Value = h(2) - h(0)
        If h(0) > 0 Then ws.Cells(r, 7).Value = h(2) / h(0) - 1
        ws.Cells(r, 8).Value = FlexStatus(h(0), h(2), IIf(el > 0.05, Application.Max(h(2), h(1) / IIf(el = 0, 1, el)), h(2)), col)
        ws.Range(ws.Cells(r, 1), ws.Cells(r, 8)).Interior.Color = col
        r = r + 1
    Next k
    ws.Range("C5:F" & r).NumberFormat = FMT_EUR: ws.Range("G5:G" & r).NumberFormat = "+0.0%;-0.0%;0.0%"
    ' Lines
    r = r + 2
    ws.Cells(r, 1).Resize(1, 16).Value = Array("Line", "Description", "Unit", "Budget units", "Units used", "Units %", "Budget rate", "Actual rate", "Rate vs budget", "Approved budget", "Spent", "Committed", "Spent + committed", "Available", "Used %", "Status")
    HeadStyle ws.Range(ws.Cells(r, 1), ws.Cells(r, 16))
    Dim first As Long: first = r + 1
    r = r + 1
    For br = 2 To bud.Cells(bud.Rows.Count, 1).End(xlUp).Row
        code = Trim$(CStr(bud.Cells(br, 1).Value))
        If code <> "" And Trim$(CStr(bud.Cells(br, 3).Value)) <> "" Then
            b = Num(bud.Cells(br, 6).Value): bu = Num(bud.Cells(br, 4).Value): brt = Num(bud.Cells(br, 5).Value)
            sp = PivotVal(code, 3): sc = PivotVal(code, 4): uu = PivotVal(code, 5)
            ws.Cells(r, 1).NumberFormat = "@": ws.Cells(r, 1).Value = code
            ws.Cells(r, 2).Value = bud.Cells(br, 2).Value: ws.Cells(r, 3).Value = bud.Cells(br, 3).Value
            ws.Cells(r, 4).Value = bu: ws.Cells(r, 5).Value = uu
            uPct = 0: If bu > 0 Then uPct = uu / bu: ws.Cells(r, 6).Value = uPct
            ws.Cells(r, 7).Value = brt
            rt = 0: If uu > 0 Then rt = sp / uu: ws.Cells(r, 8).Value = rt
            If brt > 0 And rt > 0 Then ws.Cells(r, 9).Value = rt / brt - 1
            ws.Cells(r, 10).Value = b: ws.Cells(r, 11).Value = sp: ws.Cells(r, 12).Value = sc - sp: ws.Cells(r, 13).Value = sc
            ws.Cells(r, 14).Value = b - sc
            used = 0: If b > 0 Then used = sc / b: ws.Cells(r, 15).Value = used
            stt = "On track": col = C_GREEN
            If b = 0 And sc > 0.5 Then
                stt = "Not in the budget": col = C_RED
            ElseIf sc > b + 0.5 Then
                stt = "Over budget": col = C_RED
            ElseIf bu > 0 And uu > bu + 0.0001 Then
                stt = "Units above budget - notification": col = C_RED
            ElseIf bu > 0 And el > 0.05 And uu / el > bu * 1.0001 Then
                stt = "Risk: units above budget by the end - notification": col = C_AMBER
            ElseIf used - el > 0.15 Or (brt > 0 And rt > 0 And rt / brt - 1 > 0.15) Then
                stt = "Ahead of time / rate above budget": col = C_AMBER
            ElseIf el > 0.25 And el - used > 0.3 Then
                stt = "Behind time": col = C_GREY
            End If
            ws.Cells(r, 16).Value = stt
            ws.Range(ws.Cells(r, 1), ws.Cells(r, 16)).Interior.Color = col
            r = r + 1
        End If
    Next br
    ws.Range("D" & first & ":E" & r).NumberFormat = "#,##0.##"
    ws.Range("F" & first & ":F" & r & ",O" & first & ":O" & r).NumberFormat = "0%"
    ws.Range("I" & first & ":I" & r).NumberFormat = "+0%;-0%;0%"
    ws.Range("G" & first & ":H" & r & ",J" & first & ":N" & r).NumberFormat = FMT_EUR
    ws.Columns("A").ColumnWidth = 9: ws.Columns("B").ColumnWidth = 44: ws.Columns("C").ColumnWidth = 14
    ws.Columns("D:O").ColumnWidth = 13: ws.Columns("P").ColumnWidth = 44: ws.Columns("H:H").ColumnWidth = 13
    ws.Range("A3").Value = "Colours: red = over budget, units above budget or not budgeted - amber = ahead of time, rate 15%+ above budget, units heading above budget - green = on track - grey = 30+ points behind time"
    ws.Range("A3").Font.Size = 8
End Sub

' Heading status: within budget / notification (<=20%) / near addendum (20-25%) / addendum (>25%), now and projected.
Private Function FlexStatus(budget As Double, now As Double, proj As Double, ByRef col As Long) As String
    Dim dn As Double, dp As Double, s As String
    col = C_GREEN
    If budget <= 0 Then FlexStatus = "": Exit Function
    dn = now / budget - 1: dp = proj / budget - 1
    s = Band(dn)
    If dn > 0.0001 Then
        col = IIf(dn > 0.2, C_RED, C_AMBER)
        FlexStatus = s & " (now +" & Format$(dn, "0.0%") & ")"
    ElseIf dp > 0.0001 Then
        col = IIf(dp > 0.2, C_AMBER, C_GREY)
        FlexStatus = "Risk: " & Band(dp) & " at the current pace (+" & Format$(dp, "0.0%") & " by the end)"
    Else
        FlexStatus = "Within budget"
    End If
End Function

Private Function Band(d As Double) As String
    If d > 0.25 Then
        Band = "Addendum (beyond 25%)"
    ElseIf d > 0.2 Then
        Band = "Near addendum (20-25%)"
    Else
        Band = "Notification (within 25%)"
    End If
End Function

Private Function ToD(v As Variant) As Double()
    Dim a(0 To 2) As Double, i As Long
    For i = 0 To 2: a(i) = v(i): Next i
    ToD = a
End Function

' ------------------------------------------------------------------ Checks
Private Sub AddCheck(ws As Worksheet, ByRef r As Long, level As String, title As String, doc As String, ln As String, desc As String, amount As Variant)
    ws.Cells(r, 1).Value = level: ws.Cells(r, 2).Value = title: ws.Cells(r, 3).Value = doc
    ws.Cells(r, 4).NumberFormat = "@": ws.Cells(r, 4).Value = ln
    ws.Cells(r, 5).Value = desc: ws.Cells(r, 6).Value = amount
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 6)).Interior.Color = IIf(level = "Error", C_RED, IIf(level = "Check", C_AMBER, C_GREY))
    r = r + 1
End Sub

Public Sub BuildChecks()
    Dim ws As Worksheet, d As Worksheet, po As Worksheet, inv As Worksheet, bud As Worksheet, r As Long, i As Long, n As Long
    Dim codes As Object, code As String, s As String, bh As String, st As Date, en As Date, x As Date
    Set ws = Fresh(SH_CHECKS): Set d = Sh(SH_DFP): Set po = Sh(RAW_PO): Set inv = Sh(RAW_INV): Set bud = Sh(SH_BUDGET)
    ws.Range("A1:F1").Value = Array("Level", "Check", "Document", "Line", "Description", "Amount")
    HeadStyle ws.Range("A1:F1")
    r = 2
    Set codes = CreateObject("Scripting.Dictionary")
    For i = 2 To bud.Cells(bud.Rows.Count, 1).End(xlUp).Row
        codes(Trim$(CStr(bud.Cells(i, 1).Value))) = 1
    Next i
    n = d.Cells(d.Rows.Count, 1).End(xlUp).Row
    bh = CStr(Setting("Budget head (BH)"))
    st = ToDate(Setting("Project start")): en = ToDate(Setting("Project end"))

    ' 1. No reporting line (levies on tranches excepted) / 2. line not in the budget
    For i = 2 To n
        code = CStr(d.Cells(i, 2).Value): s = CStr(d.Cells(i, 8).Value)
        If code = "0" Then
            If Not (s Like "*TRANCHE*" Or s Like "*PRELEV*" Or s Like "*tranche*") Then AddCheck ws, r, "Check", "No reporting line", CStr(d.Cells(i, 7).Value), code, s, d.Cells(i, 14).Value
        ElseIf codes.Count > 1 And Not codes.Exists(code) Then
            AddCheck ws, r, "Error", "Line not in the approved budget", CStr(d.Cells(i, 7).Value), code, s, d.Cells(i, 14).Value
        End If
    Next i

    ' 3. Purchase orders invoiced more than 5% (and 250) above the amount ordered (missions, petty cash, staff excepted)
    Dim agg As Object, k As Variant, a As Variant, key As String, cpo As Long, camt As Long, csp As Long, cd As Long, cn As Long, csup As Long
    Set agg = CreateObject("Scripting.Dictionary")
    If po.Cells(1, 1).Value <> "" Then
        cpo = ColOf(po, 1, "ponumber"): camt = ColOf(po, 1, "poamountineur"): csp = ColOf(po, 1, "spentineur")
        cd = ColOf(po, 1, "descriptionpo"): cn = ColOf(po, 1, "descriptionpoline"): csup = ColOf(po, 1, "supplier")
        If camt > 0 And csp > 0 Then
            For i = 2 To po.Cells(po.Rows.Count, 1).End(xlUp).Row
                key = Trim$(CStr(po.Cells(i, cpo).Value))
                s = CStr(po.Cells(i, cd).Value) & " " & CStr(po.Cells(i, cn).Value) & " " & IIf(csup > 0, CStr(po.Cells(i, IIf(csup > 0, csup, 1)).Value), "")
                If key <> "" And Not (UCase$(s) Like "OM##*" Or UCase$(s) Like "*PETTY CASH*" Or UCase$(s) Like "*MISSION*" Or UCase$(s) Like "*PERSONNEL*" Or UCase$(s) Like "*PAIE*") Then
                    If agg.Exists(key) Then a = agg(key) Else a = Array(0#, 0#, CStr(po.Cells(i, cd).Value))
                    a(0) = a(0) + Num(po.Cells(i, camt).Value): a(1) = a(1) + Num(po.Cells(i, csp).Value)
                    agg(key) = a
                End If
            Next i
            For Each k In agg.keys
                a = agg(k)
                If a(0) > 0 And a(1) - a(0) > Application.Max(250, a(0) * 0.05) Then
                    AddCheck ws, r, "Check", "Invoiced above the PO (amendment needed)", "PO " & k, "", a(2) & " - " & Format$(a(1), "#,##0.00") & " on " & Format$(a(0), "#,##0.00"), a(1) - a(0)
                End If
            Next k
        End If
    End If

    ' 4. Staff POs that do not cover the months left of the contract (committed understated)
    Dim paid As Object, dFrom As Date, dTo As Date, lastM As String, perM As Double, left_ As Long, mk As Variant, tot As Double, bal As Double
    Set paid = PaidMonths()
    For i = 2 To n
        If Left$(CStr(d.Cells(i, 1).Value), 1) = "1" And InStr(1, CStr(d.Cells(i, 3).Value), "month", vbTextCompare) > 0 _
           And UCase$(CStr(d.Cells(i, 15).Value)) = "OPEN" And PeriodOf(CStr(d.Cells(i, 8).Value), dFrom, dTo) Then
            key = CStr(d.Cells(i, 7).Value)
            If paid.Exists(key) Then
                lastM = "": tot = Num(d.Cells(i, 12).Value)
                For Each mk In paid(key).keys
                    If mk > lastM Then lastM = mk
                Next mk
                perM = tot / paid(key).Count
                left_ = DateDiff("m", DateSerial(CInt(Left$(lastM, 4)), CInt(Right$(lastM, 2)), 1), dTo)
                bal = Num(d.Cells(i, 13).Value)
                If left_ > 0 And perM * left_ - bal > 100 Then
                    AddCheck ws, r, "Check", "Staff PO does not cover the months left", "PO " & key, CStr(d.Cells(i, 2).Value), _
                        d.Cells(i, 8).Value & " - " & left_ & " month(s) still to pay ~ " & Format$(perM * left_, "#,##0.00") & ", PO balance " & Format$(bal, "#,##0.00"), perM * left_ - bal
                End If
            End If
        End If
    Next i

    ' 5. Possible duplicate invoices: same PO, same GL date, same amount (100 or more)
    Dim seen As Object, iPo As Long, iDg As Long, iAm As Long, iNo As Long
    Set seen = CreateObject("Scripting.Dictionary")
    If inv.Cells(1, 1).Value <> "" Then
        iPo = ColOf(inv, 1, "numeropo"): iDg = ColOf(inv, 1, "dategl"): iAm = ColOf(inv, 1, "montantengage", "montantligne"): iNo = ColOf(inv, 1, "invoiceno")
        If iPo > 0 And iDg > 0 And iAm > 0 Then
            For i = 2 To inv.Cells(inv.Rows.Count, 1).End(xlUp).Row
                If Abs(Num(inv.Cells(i, iAm).Value)) >= 100 Then
                    key = inv.Cells(i, iPo).Value & "|" & Format$(ToDate(inv.Cells(i, iDg).Value), "yyyy-mm-dd") & "|" & Format$(Num(inv.Cells(i, iAm).Value), "0.00")
                    If seen.Exists(key) Then
                        AddCheck ws, r, "Check", "Possible duplicate invoice", CStr(inv.Cells(i, iNo).Value) & " / " & seen(key), "", "PO " & inv.Cells(i, iPo).Value & ", same day and amount", Num(inv.Cells(i, iAm).Value)
                    Else
                        seen.Add key, CStr(inv.Cells(i, iNo).Value)
                    End If
                End If
            Next i
        End If
    End If

    ' 6. Postings outside the project dates / another budget head named / not posted
    Dim p As Worksheet: Set p = Sh(SH_POSTINGS)
    For i = 2 To p.Cells(p.Rows.Count, 1).End(xlUp).Row
        x = ToDate(p.Cells(i, 1).Value): s = CStr(p.Cells(i, 8).Value)
        If st > 0 And x > 0 And (x < st Or (en > 0 And x > en)) Then AddCheck ws, r, "Check", "Dated outside the project", CStr(p.Cells(i, 4).Value), CStr(p.Cells(i, 6).Value), Format$(x, "dd/mm/yyyy") & " - " & s, p.Cells(i, 9).Value
        If bh <> "" And InStr(1, s, "BH", vbTextCompare) > 0 And InStr(1, s, "BH" & bh, vbTextCompare) = 0 And InStr(1, s, "BH " & bh, vbTextCompare) = 0 Then AddCheck ws, r, "Note", "Names another budget head", CStr(p.Cells(i, 4).Value), CStr(p.Cells(i, 6).Value), s, p.Cells(i, 9).Value
        If UCase$(Left$(CStr(p.Cells(i, 10).Value), 1)) = "N" Then AddCheck ws, r, "Note", "Not posted yet", CStr(p.Cells(i, 4).Value), CStr(p.Cells(i, 6).Value), s, p.Cells(i, 9).Value
    Next i

    ' 7. From the analysis: lines over budget, units above budget, headings beyond the flexibility
    Dim an As Worksheet: Set an = Sh(SH_ANALYSIS)
    For i = 5 To an.Cells(an.Rows.Count, 1).End(xlUp).Row
        s = CStr(an.Cells(i, 16).Value)
        If s = "Over budget" Or s = "Not in the budget" Or Left$(s, 5) = "Units" Then AddCheck ws, r, IIf(s = "Units above budget - notification", "Check", "Error"), s, "", CStr(an.Cells(i, 1).Value), CStr(an.Cells(i, 2).Value), an.Cells(i, 13).Value - an.Cells(i, 10).Value
        s = CStr(an.Cells(i, 8).Value)
        If Left$(s, 8) = "Addendum" Then AddCheck ws, r, "Error", "Heading beyond the 25% flexibility - addendum", "", CStr(an.Cells(i, 1).Value), CStr(an.Cells(i, 2).Value) & " - " & s, an.Cells(i, 6).Value
        If Left$(s, 4) = "Near" Then AddCheck ws, r, "Check", "Heading close to the addendum threshold", "", CStr(an.Cells(i, 1).Value), CStr(an.Cells(i, 2).Value) & " - " & s, an.Cells(i, 6).Value
    Next i

    If r = 2 Then ws.Cells(2, 2).Value = "No entry needs a second look."
    ws.Range("F2:F" & r).NumberFormat = FMT_EUR
    ws.Columns("A").ColumnWidth = 8: ws.Columns("B").ColumnWidth = 40: ws.Columns("C").ColumnWidth = 24
    ws.Columns("D").ColumnWidth = 9: ws.Columns("E").ColumnWidth = 90: ws.Columns("F").ColumnWidth = 15
    ws.Range("A1:F1").AutoFilter
End Sub
