# JP Financial Report — Excel (VBA) sistemi

Sistemden çekilen **ham döküm** (Situation Budgétaire, Purchase Orders, Factures a date, Ecriture GL, Consolidation…) seçildiği anda:

1. **data for pivot** → **pivot** → **REPORT** zincirini kurar (resmi interim/final financial report, formüllerle bağlı),
2. bütçeye göre **analiz** eder (satır ve başlık; notification / near addendum / addendum; birim aşımı; birim fiyatı),
3. **hatalı girişleri** listeler,
4. **tarih aralığına göre harcamayı** verir.

## Kurulum (bir kez, ~5 dakika)

1. Excel'de **boş bir çalışma kitabı** aç → **Farklı Kaydet → Excel Macro-Enabled Workbook (*.xlsm)** → örn. `JP-Financial-Report.xlsm`.
2. **Alt + F11** (VBA düzenleyici) → **File → Import File…** → `vba` klasöründeki 5 dosyayı tek tek içe aktar:
   `modUtil.bas`, `modImport.bas`, `modBuild.bas`, `modAnalysis.bas`, `modControl.bas`
3. Düzenleyiciyi kapat → **Alt + F8** → **Setup** → **Run**.
   Control, Settings, Budget ve diğer sayfalar ile butonlar oluşur.
4. Kaydet. (Makrolar engellenirse: dosyaya sağ tık → Özellikler → *Engellemeyi kaldır*, ya da Güven Merkezi'nde klasörü güvenilir konum yap.)

> Windows Excel gereklidir (Scripting.Dictionary kullanılır). Mac Excel'de çalışmaz.

## Her ay kullanım

| Adım | Ne yapar |
|---|---|
| **Settings** | Proje adı, kontrat, JP no, başlangıç/bitiş, rapor tipi (Interim/Final), %7, imza blokları (`Ad | Unvan | Birim | Council of Europe`). BH ve rapor tarihi dökümden otomatik dolar. |
| **1. Load approved budget** | Onaylı bütçeyi resmi bir REPORT dosyasından okur (kod, açıklama, birim, birim sayısı, birim fiyatı, tutar; başlıklar dahil). Bir kez yeterli; revizyonda tekrar. |
| **2. Load extraction and analyse** | Ham dökümü seç → her şey kurulur ve analiz edilir. |
| **Refresh** | data for pivot'ta elle birim düzelttikten, Budget veya Settings değiştikten sonra. |
| **Export report workbook** | REPORT + pivot + data for pivot'u ayrı bir .xlsx olarak kaydeder (formüller bağlı kalır). |

## Kurallar

**Birimler**
- *data for pivot → NBRE_OF_UNITS* (resmi rapor kuralı): hiç harcanmamış PO = 0; personel PO'su ("from dd/mm/yyyy to dd/mm/yyyy", aylık) = **faturası kesilmiş ay sayısı**; diğer PO = sipariş edilen birim. Elle düzeltilebilir (sarı başlık) → REPORT formülle güncellenir.
- *UNITS_SPENT_SHARE* (analiz kuralı): sadece harcanan oran (45 gün, 8.550'nin 760'ı harcanmış → 4 gün). Analysis sayfası bunu kullanır.

**Toplamlar** (resmi raporla aynı): 7 = alt toplamların toplamı · 9 = 7 + 8 · **10 = 9 × %7** (dilimlerden kesilen tutar değil) · 11 = 9 + 10.

**Analysis**
- Başlık: bütçenin üstünde ≤%20 → *Notification*, %20–25 → *Near addendum*, >%25 → *Addendum*; şu an aşım yoksa bu hızla proje sonundaki durum *Risk:* olarak.
- Satır: bütçe aşımı, bütçede olmayan satır, **birim aşımı → notification**, bu hızla birim aşımı riski, süreden hızlı gidiş / birim fiyatı %15+ yüksek, süreden 30+ puan geri.

**Checks**: raporlama satırı yok (dilim kesintileri hariç) · bütçede olmayan satır · PO'nun %5'ten (ve 250 €) fazla üstünde faturalanmış (misyon, petty cash, personel hariç) · **kalan ayları karşılamayan personel PO'ları** (committed eksik) · olası mükerrer fatura (aynı PO, gün, tutar) · proje tarihleri dışında · başka BH geçen kayıt · post edilmemiş kayıt · bütçe/esneklik bulguları.

**By date**: B3/B4'e tarihleri yaz → satır bazında harcama ve kayıt sayısı anında hesaplanır (fatura GL tarihi + GL kayıt tarihi). Ay listesi için Refresh.
