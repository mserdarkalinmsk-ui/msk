# Portfolio Ledger — Enterprise edition (offline)

Bu sürüm, yüklenen Portfolio Analysis uygulamasının üzerine kaynakları izlenebilir bir karar alanı ekler. Tek HTML olarak çevrimdışı çalışır. **Sunuculu, çok kullanıcılı bir kurumsal hizmet değildir.**

## Çalıştırma

ZIP içindeki `portfolio-analysis-enterprise.html` dosyasını güncel Chrome/Edge/Firefox ile açın. Tarayıcı depolama davranışı dosya adreslerinde değişebilir; kalıcı bir origin için depo kökünden şu komut önerilir:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory .
```

Dosya deponun `downloads/` klasöründedir. Önceki Premium HTML ve ZIP paketi korunmuştur. Farklı dosya/origin/profildeki eski tarayıcı kayıtları kendiliğinden taşınmaz; önce eski uygulamadan yedek alın.

## Bu sürümde neler var?

- **Decision room:** kanıt kapsamına göre KPI'lar, rapor yükümlülükleri, kaynak koşulları, sahip/tarih/not içeren takipler ve proje kartları.
- **Finance:** kapsam eksikse portföy toplamını gizler; kapsanan alt kümenin değerini ve proje sayısını ayrıca gösterir. Kümülatif raporlar toplanmaz.
- **Evidence:** seçilen raporlama tarihine kadar olan kaynaklar, kaynak yaşı, gerçek harcama alanı kapsamı ve tahmin engelleri.
- **Scenarios:** yalnızca uygun projeler için yakın dönem harcama hızını ve ek maliyeti değiştirerek senaryo karşılaştırması. Asıl kayıtları değiştirmez.
- **Executive brief:** seçili kapsamı, kaynak tarihlerini, belirsizlikleri ve takipleri taşıyan bağımsız HTML, yazdırma/PDF, kanıt JSON ve CSV çıktıları.
- **Project decision review:** aynı kanıt kurallarıyla proje incelemesi. **Original project workspace** üzerinden belge okuyucuları, bütçe, personel, risk ve faaliyet araçlarına erişilir.
- Tarayıcıya özel adlandırılmış görünümler, portföyle saklanan takipler, geri alma, takip geçmişi ve eklemeli takip yedeği geri yükleme.

Uygulama dili mevcut İngilizce olarak korundu. Yeni görünüm açık/koyu temayı, azaltılmış hareket tercihini ve 320px genişliğe kadar mobil düzeni destekler. Tablolar gerektiğinde kendi içinde yatay kayar.

## Hesaplama sözleşmesi

1. Eksik değer **bilinmiyor** olarak kalır. Kaynakta kayıtlı sıfır, geçerli sıfırdır.
2. Geçersiz ve raporlama tarihinden sonraki raporlar dışarıda bırakılır. Aynı tarihli farklı kaynak sürümleri çözülmeden kesin toplam/tahmin verilmez.
3. Harcama ve taahhüt kapsamı kaynak bütçe satırlarıyla değerlendirilir. Alt satırlar varsa üst toplam tekrar eklenmez. Onaylı bütçedeki sıfır alanları, gerçek harcama kaynağı kabul edilmez.
4. Dönem değişimi yalnızca tam gerçek harcama alanları ve aynı satır kodları olan iki rapor arasında hesaplanır. Kod eşleşmesi anlamsal eşdeğerliği garanti etmez. Farklı dönemler bir portföy dönem toplamı gibi toplanmaz.
5. Senaryo için iki karşılaştırılabilir rapor, en az **30 gün** aralık, son raporda **180 gün** güncellik, tam taahhüt alanları, doğrulanmış takvim ve pozitif kayıtlı bütçe gerekir. Bunlar bu sürümün açık ürün varsayımlarıdır; resmi kurum politikası iddiası değildir.
6. Senaryo, yakın dönem farkından çıkan hızı proje sonuna uzatır. Taahhütler taban oluşturur; bütçeyi aşan tutar gizlenmez. Negatif geçmiş farkları görünür kalır; gelecek hızının tabanı sıfırdır. Ek maliyet her uygun projeye ayrı uygulanır.
7. Tüm tutarlar EUR olarak ele alınır; kur dönüşümü yapılmaz. Tarihsel onaylı bütçe yeniden kurulmaz; mevcut kayıtlı bütçe kullanılır. Finansal tempo, teslimat başarısı değildir.
8. Yeni kurallar karar alanına uygulanır. **Original analytics**, özgün proje çalışma alanı ve diğer eski ekranlar özgün hesaplarını korur; bunlar ayrıca kaynak kapsamı kurallarına geçirilmiş değildir.

## Verilerin korunması

Takipler `ledger.enterprise.followups` alanında, uygulamanın normal kayıt/denetim/geri alma akışıyla saklanır. Kayıt başarı mesajı öncesinde IndexedDB işlemi doğrulanır. Görüntüleme amaçlı paylaşımlarda takip yazımı kapalıdır.

Kaynak koşulu, ayrıntısı veya kaynak tarihi değişince yeni takip kimliği oluşur. Eski kayıtlar geçmişte tutulur; çözüm kaydı, devam eden kaynak koşulunu gizlemez. Önceki Premium sürümünün aynı origindeki yerel takipleri açık bir içe aktarma düğmesiyle taşınabilir; bunlar tarihsel kayıt olarak korunur.

**Data portability & recovery** bölümünden tam portföy JSON veya ayrı takip JSON dışa aktarılabilir. Takip geri yükleme, mevcut kayıtları ezmez; bilinmeyen projeleri atlar. Portföy JSON, ayrı IndexedDB alanlarında tutulan özgün ikili belge eklerini içermez. Asıl belgeleri ayrıca saklayın; yedekleri ayrı bir tarayıcı profilinde doğrulayın.

Bu sürüm ortak veri tabanı, kullanıcı hesabı, ekip senkronizasyonu, rol tabanlı yetkilendirme, sunucu denetim günlüğü, çoklu para birimi, OCR veya yapay zekâ hizmeti eklemez. Bunlar için ayrı sunucu/işletim tasarımı gerekir. Dış servise yeni veri gönderimi eklenmemiştir.

## Kaynak yapısı ve geliştirme

`vendor/portfolio-analysis-original.html` yüklenen orijinal motorun değişmeyen kopyasıdır. SHA-256 değeri üretim sırasında doğrulanır. Orijinal motorun tüm kaynak kodunun yeniden yazıldığı veya modüllere ayrıldığı iddia edilmez; yeni karar katmanı okunabilir modüllerdedir:

| Dosya | Görev |
|---|---|
| `src/domain.js` | Tarayıcıdan bağımsız kanıt, kapsam, değişim, senaryo ve yedek doğrulaması |
| `src/bridge.js` | Mevcut uygulama durumu, kayıt akışı ve veri adaptörü |
| `src/components.js` | Kaynaklar, takipler, projeler, senaryolar ve taşınabilirlik |
| `src/overview.js` | Karar çalışma alanı ve adlandırılmış görünümler |
| `src/report.js` | Aynı rapor verisinden güvenli HTML/JSON/CSV üretimi |
| `src/enterprise.css` | Sınırlandırılmış tasarım sistemi, mobil/koyu tema ve yazdırma |

Depo kökünden:

```sh
python3 enterprise/build.py
node enterprise/tests/domain.cjs
node enterprise/tests/browser.cjs
```

Üretim yalnızca Python standart kütüphanesini kullanır. Tarayıcı testleri Node 20+, Playwright 1.62.1 ve Chromium ister. Kilitli test bağımlılıklarını `cd enterprise && npm ci` ile kurabilirsiniz. Sistem Chromium'u `/usr/bin/chromium` değilse `CHROMIUM_PATH` belirleyin; test portu `LEDGER_ENTERPRISE_TEST_PORT` ile değiştirilebilir.

ZIP'ten geliştirmek için `python3 enterprise/build.py` çalıştırın; `downloads/` çıktıları oluşturulur. Testler kendi sunucularını ve geçici profillerini kullanır, sonuçlar `test-results/enterprise/` altına yazılır. Sınırlandırılmış test kancaları yalnızca tarayıcı testinin yanıtına eklenir; dağıtılabilir HTML'ye girmez.

Doğrulamanın kapsamı için `VALIDATION.md` dosyasına bakın.
