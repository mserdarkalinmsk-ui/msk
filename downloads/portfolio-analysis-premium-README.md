# Portfolio Analysis Premium — ilk geliştirme paketi

`portfolio-analysis-premium.html` dosyasını modern bir tarayıcıda açın. Python ile sunmak için bu klasörde `python3 -m http.server 8002 --bind 127.0.0.1` çalıştırılabilir. Uygulama dili mevcut İngilizce olarak korundu.

Eklenenler: seçili portföye göre finansal kaynak kapsamı ve tarihleri; iki ayrı tarihli gerçek harcama görüntüsü ve son 180 günde rapor şartıyla Overview tahmini; eksik/eski kanıtla finansal tempo uyarılarının bastırılması; açılışı engellemeyen haftalık özet; uyarıya sorumlu, tarih, durum ve not kaydı; ayrı takip yedeği dışa aktarma ve eksik kayıtları geri yükleme.

Takipler bu tarayıcı/originde `pl-premium-followups-v1` altında tutulur. Portföyün mevcut yedek dosyasına otomatik dahil edilmez; Follow-up backup bölümünden ayrıca dışa aktarın. Kaynak koşulu değişirse yeni takip açılır; çözüm kaydı uyarıyı gizlemez. Bunlar ortak sunucuda tutulan ekip görevleri değildir.

Tahmin yeterlilik kuralı ve kaynak paneli Overview içindir. Mevcut diğer raporların hesaplama yöntemleri yeniden yazılmadı. Kayıtlı finansal toplamlar korunur; panel, bunların kaynak kapsamının eksik olabileceğini açıklar. 180 gün ve iki rapor koşulu bu sürümün açıkça belirtilen ürün varsayımıdır; kurumun raporlama politikasına göre uyarlanabilir. Kaynak tarihi tek başına tüm bütçe satırlarının eksiksiz olduğunu kanıtlamaz.

Orijinal yükleme `original.html` olarak değişmeden saklanır. Ek bileşenler `premium.js` ve `premium.css` dosyalarında; tekrarlanabilir üretim `python3 build.py` komutuyla yapılır. Asıl uygulama yüklenmiş derlenmiş HTML olduğundan bu, tüm uygulamanın kaynak modüllere ayrıldığı anlamına gelmez.

Doğrulama: Chromium'da açılış, takip kaydı ve yeniden yükleme, JSON dışa aktarma/geri yükleme, 390px mobil genişlik ve tarayıcı hata kontrolü geçti. Ayrıca sıfır gerçek harcama, eksik/eski/gelecek tarihli raporlar, aynı tarihli raporlar ve değişen uyarı kimliği için 9 kontrol geçti. Mevcut uygulamanın bütün finans/ithalat işlevleri yeniden doğrulanmadı.
