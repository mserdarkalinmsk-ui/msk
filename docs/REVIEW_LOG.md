# Portfolio Ledger 40 — bağımsız inceleme kaydı

Tarih: 10 Ekim 2026. Bu kayıt, kullanıcı tarafından istenen dağıtık ajan
incelemesidir. İnsan uzman veya kurum sertifikasyonu değildir.
[Çalışma protokolü ve tekrar kullanılabilir sorgu](REVIEW_PROTOCOL.md).

## Kapsam ve aday kimliği

Hedef: son yüklenen Ledger 40'ın yapısını koruyarak eklenti katmanını daha güvenilir,
okunabilir ve kullanılabilir hale getirmek. Korunan sınırlar: orijinal dosya,
menüler/rotalar, sayfa ve kart sırası, veri şeması, finansal formüller ve belge
okuyucuları. Önceki `index.html` sürümü bu çalışma kapsamına alınmadı.

| Dosya / tur | SHA256 |
| --- | --- |
| Değişmeyen kullanıcı dosyası | `af4f7a60b46f6b092bd7c84abd4f95e83ca81d041dabc92366f823c3cf2fc45e` |
| İlk inceleme adayı | `8696e3eb0eadd68d1bd9dfc9c6d382ff651b252c7c0cebdee656ca2576855179` |
| Ara düzeltme adayı | `090abaf2f2f912420416f29d50d8f9a48d07af5d51991e2d498099d0ebf006ce` |
| Son inceleme adayı — Professional HTML | `3e005284732d338c1df39de9deac0c717cb596be9eb5c469168a6a30bde10007` |
| Son aday ZIP | `72771a52333f44abac145a3e2e94b162f9c13f57895fabcc34ce37a9dd0b5b1f` |

Koordinatör/genel müdür düzeltmeleri uyguladı. Diğer altı rol salt okunur,
ayrı tarayıcı profillerinde inceleme yaptı; birbirlerinin kanıtlarına itiraz
edebildi. Koordinatör kendi düzeltmelerinin tek onaylayıcısı değildir.

## Birinci tur: bulgular ve düzeltme sorumluluğu

İlk turda altı bağımsız rol değişiklik istedi. Genel müdür kabul ölçütlerini
belirledi ve teslim onayını bekletti. Aşağıdaki düzeltmelerin uygulama sorumlusu
koordinatördür; kapanış kararları ilgili bağımsız inceleyenlere aittir.

| Bulgu / karşı inceleme | Önem | Gözlenen sorun ve düzeltme | Yeniden kontrol eden |
| --- | --- | --- | --- |
| PM-01 | Yüksek | Gerçek rol kararları için kayıt yoktu; protokol ve bu sürüme bağlı kayıt oluşturuldu | Proje yöneticisi |
| PM-02 | Orta | README yanlış sürümün `index.html` dosyasına yöneltiyordu; Professional indirme/açma adımları birinci sıraya alındı | Proje yöneticisi |
| PM-03 / AUDIT-04 | Orta / düşük | Genel hız iddiası yerine “Search batching and render reuse” davranış etiketi kullanıldı; ölçüm sınırları korundu | Proje yöneticisi, denetçi |
| CODE-01 / AUDIT-02 | Orta | Aynı görevde gönderilen slider input→Reset olaylarında bekleyen işlem senaryoyu geri getiriyordu; yalnızca geçersiz kalan slider işlemi iptal edildi | Kod mimarı, denetçi |
| CODE-02 / AUDIT-02 | Orta | Preset yükleme bekleyen aramayı iptal etmiyordu; preset yükleme iptal eder, preset kaydetme önce görünür değerleri uygular | Kod mimarı, denetçi |
| CODE-03 / PRODUCT-01 / UX-05 | Orta | Yerel tablo araması orijinal sıralamanın tabloyu yenilemesiyle kayboluyordu; rota/tablo kimliğiyle en çok 64 metin sorgusu korunur | Kod mimarı, ürün, UX/UI |
| CODE-04 | Orta | Çok uzun grafik için sınırsız PNG boyutu; oran korunarak 8192px ve 8 milyon piksel üst sınırı getirildi, SVG seçeneği açıklanır | Kod mimarı |
| PRODUCT-02 / AUDIT-01 | Yüksek | Paylaşılan grafik seçim/senaryo/yöntem bağlamını kaybediyordu; yalnızca dışa aktarılan kopyada görünür başlık, kapsam, tarih penceresi, senaryo, yöntem, açıklama ve çıktı zamanı eklendi | Ürün, denetçi |
| PRODUCT-03 / UX-02 | Orta | Büyük yazı/kompakt aralık bazı alanlarda veya profesyonel görünüm kapalıyken etkisizdi; bağımsız yazı/aralık kuralları eklendi | Ürün, UX/UI |
| UX-01 / USER-02 | Yüksek / orta | Telefonda filtreler ana içeriği geciktiriyor ve kırpılıyordu; mevcut aç/kapat kontrolü küçük ekranda varsayılan kapalı, açıldığında kırpılmadan gösterilir | UX/UI, kullanıcı |
| UX-03 | Yüksek | Aktivite genişletme klavyeyle yapılamıyordu; mevcut SVG gruplarına düğme anlamı, odak, durum ve Enter/Space eklendi | UX/UI |
| UX-04 | Orta | Küçük grafik yazıları; mevcut grafiğin büyük, salt okunur inceleme görünümü ve mevcut tooltip değerlerinden okunabilir liste eklendi | UX/UI, kullanıcı |
| USER-01 | Yüksek | 320px alt menü etiketleri üst üste biniyordu; orijinal mobil 10.5px yazı ve mevcut bağlantılar korundu | Kullanıcı |
| USER-03 | Orta | Telefon segment düğmeleri 31.5px idi; mevcut düğmelerin dokunma yüksekliği 44px oldu | Kullanıcı |
| USER-04 | Orta | CSV hücrelerinde blok metinleri birleşiyordu; görünür metin satır sınırları normalize edilerek aktarılır | Kullanıcı |
| PRODUCT-04 | Düşük | CSV yerel eşleşmeleri, orijinal Print tüm satırları içerir; araç yanında açıkça belirtildi | Ürün |
| AUDIT-03 | Orta | Eski test aktif görünüm önbelleğini kontrol etmiyordu; 108 rota/senaryo/yöntem çıktısının byte eşitliği teste eklendi | Denetçi |

Slider/preset yarışları aynı görevde gönderilen DOM olaylarıyla doğrulanan
entegrasyon sınırlarıdır. Normal klavye kullanımında `change` çoğunlukla önce
uygulanır; her sıradan tıklamanın hatalı olduğu iddia edilmez.

Senaryo önbelleğinin finansal sonucu bozduğu ilk şüphesi kod mimarı ve denetçi
tarafından sorgulandı ve mevcut rotalarda yeniden üretilemedi. 108 bağımsız çıktı
eşleşti; `Array.map` çağrılarının farklı dizi argümanları ilk şüpheyi açıklıyordu.
Bu bulgu doğrulanmış finansal hata olarak kaydedilmedi. `F.k/F.fm` bağımlılık
kontrolü savunmacı iyileştirme olarak eklendi.

## İkinci tur ve son kararlar

Ara adayda bağımsız incelemeler başladı. Genişletilmiş test, programatik host
filtre değişiminde dışa aktarma etiketlerinin gerçek `F` yerine seçili DOM
değerinden okunabildiğini gösterdi. Son adayda etiketler gerçek filtre değeriyle
eşleştirilir. Roller bu değişiklikten haberdar edildi; ara aday onayı son adaya
otomatik aktarılmadı. Her son karar yukarıdaki **3e005…** dosyasına bağlanır.

| Rol | Son aday kararı | Kanıt / kapsam |
| --- | --- | --- |
| Genel müdür / director | Onay | Altı ayrı son aday kararı alındı; kapsam/hash, 12 kontrol grubu, masaüstü/telefon görüntüleri ve teslim açıklığı kontrol edildi |
| Proje yöneticisi | Onay | Protokol/kayıt, doğru sürüm yönlendirmesi, somut optimizasyon etiketi, kaynak/ZIP eşitliği ve sınır açıklamaları bağımsız doğrulandı |
| Kod mimarı | Onay | Dört teknik bulgu kapatıldı; son değişikliğin yalnızca gerçek filtre etiketi düzeltmesi olduğu hash ile doğrulandı ve programatik filtre çıktısı kontrol edildi |
| UX/UI direktörü | Onay | 390/320px ilk grafik y578/y597; açılan filtreler kırpılmaz, klavye genişletme, büyük yazı ve arama→sıralama→CSV doğrulandı |
| Ürün değerlendirme uzmanı | Onay, düşük öncelikli notla | Gerçek SVG/PNG bağlamı görsel olarak kontrol edildi, sorgu/sıralama/CSV ve bağımsız ayarlar doğrulandı |
| Bağımsız denetçi | Onay | Byte eşitliği, bağımsız 108 aktif görünüm karşılaştırması, gerçek kapsamlı SVG/PNG, timer düzeltmesi, ZIP ve son test/ölçüm belgeleri doğrulandı |
| Deneyimli kullanıcı | Onay | Son hash ile 320/390/1440px yeniden kontrol; dört bulgu kapatıldı, arama/sıralama/CSV/Inspect/indirme görevleri tamamlandı |

**Son karar:** Yedi rol aynı son aday için kendi kararını verdi. Açık bloklayıcı,
yüksek veya orta önem taşıyan bulgu kalmadı; birinci turdaki ilgili bulgular
bağımsız yeniden kontrolle kapatıldı. Genel müdür diğer rollerin vetosunu
geçersiz kılmadı. Önceden tanımlanan kabul ölçütleri geçtiği için bu geliştirme
döngüsü tamamlandı. Bu karar ürünün sınırsız koşullarda kusursuz olduğu iddiası
değildir; aşağıdaki düşük öncelikli notlar ve doğrulama sınırları korunur.

Koordinatörün son aday testinde 12 kontrol grubu geçti: 42 önce/sonra rota
karşılaştırması, 108 aktif önbellek çıktısı, gerçek CSV/SVG/PNG, sıfırlama/preset
entegrasyonu, ayarların hesaplanmış stil etkisi, telefon/klavye etkileşimi, orijinal
form/undo/redo/JSON yedeği ve 1.000 projelik sınırlı PNG. Test geçişi rol onayı
yerine geçmez.

Kabul edilen düşük öncelikli sonraki işler: grafik inceleme penceresinin Close
düğmesi 40px (grafik araçları 44px); dışa aktarılan bazı orijinal legend öğeleri
arasına daha belirgin metin ayıracı eklenebilir. İlgili UX ve ürün rolleri bunları
bu aday için bloklayıcı saymadı. Kullanılabilirlik onayı tüm olası veri kümelerini
ve tam ekran okuyucu uygunluğunu kapsamaz.

## Doğrulama sınırları

Orijinal okuyucular ve finansal yorumlar korunur; tüm belge türleri için yeni
ayrıntılı parser denetimi yapılmış sayılmaz. Yönetilen bulut tarayıcısı `file://`
açmayı engeller: tek dosya, dış varlık istemeden tarayıcı rotasından çalıştırılır;
bu gerçek `file://` testi olarak sunulmaz.

Performans ölçümü yedi Analytics HTML üretiminin medyanıdır; DOM/yerleşim ve
belge ayrıştırma dahil değildir. Kaynak hesaplarının azalması her ölçekte daha
kısa süre garantisi değildir. Çok uzun PNG grafikleri sınırlar nedeniyle küçülür;
tam ölçek ayrıntı için SVG kullanılmalıdır.
