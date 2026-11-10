Attribute VB_Name = "ThisWorkbook"
Attribute VB_Base = "0{00020819-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Option Explicit

' On open: buttons on the Control sheet, and the analysis built when the data is loaded but not yet built.
Private Sub Workbook_Open()
    On Error Resume Next
    EnsureButtons
    If CStr(Sh(RAW_CONSO).Range("A1").Value) <> "" And CStr(Sh(SH_PIVOT).Range("A1").Value) = "" Then
        Busy True
        BuildAll
        Busy False
        Sh(SH_CONTROL).Activate
    End If
End Sub
