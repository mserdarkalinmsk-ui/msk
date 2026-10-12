import { useState } from 'preact/hooks';
import { go } from '../data/store';

type Lang = 'en' | 'tr';
interface Step { t: Record<Lang, string>; b: Record<Lang, string[]>; to?: string }

/** How to use the Portfolio Ledger — one page for the team, in English and Turkish, printable. */
const STEPS: Step[] = [
  { t: { en: '1. Your data stays with you', tr: '1. Verileriniz sizde kalır' }, b: {
    en: ['The ledger is one HTML file that works offline. Data is saved in this browser only — nothing is sent anywhere.', 'Back up regularly: Import / backup → Back up now. Keep the backup file on a shared drive.', 'A daily restore point is kept automatically (Reports → Data → Data health shows deleted items you can restore).'],
    tr: ['Uygulama çevrimdışı çalışan tek bir HTML dosyasıdır. Veriler yalnızca bu tarayıcıda saklanır, hiçbir yere gönderilmez.', 'Düzenli yedek alın: Import / backup → Back up now. Yedek dosyasını ortak bir klasörde tutun.', 'Her gün otomatik bir geri yükleme noktası alınır; silinenler Reports → Data → Data health ekranından geri getirilebilir.'] } },
  { t: { en: '2. Load files — Smart import', tr: '2. Dosya yükleme — Smart import' }, to: 'overview', b: {
    en: ['Import / backup → drop all files at once: system extractions (Extraction-Rapport financier), CoE financial report workbooks, budget workbooks, DoA / contract (docx, pdf), logframes, office budget workbooks.', 'Each file is recognised and matched to its project by BH, JP / PMM or contract number. Check the project in the list before importing.', 'Under every report you see a read check: lines and euros must match the file. A red line blocks the import until you tick “Import anyway”.', 'A budget workbook (xlsx) always outranks a budget table inside a DoA.'],
    tr: ['Import / backup → tüm dosyaları birlikte bırakın: sistem çıktıları (Extraction-Rapport financier), CoE finansal rapor dosyaları, bütçe dosyaları, DoA / sözleşme (docx, pdf), logframe, ofis bütçe dosyaları.', 'Her dosya tanınır ve BH, JP / PMM ya da sözleşme numarasıyla projesine eşleşir. İçe aktarmadan önce listedeki projeyi kontrol edin.', 'Her raporun altında okuma kontrolü görünür: satırlar ve tutarlar dosyayla aynı olmalı. Kırmızı satır, “Import anyway” işaretlenmeden içe aktarmayı durdurur.', 'Bütçe Excel’i (xlsx) her zaman DoA içindeki bütçe tablosundan önce gelir.'] } },
  { t: { en: '3. Follow a project', tr: '3. Projeyi takip etme' }, to: 'projects', b: {
    en: ['Projects → open a project. Summary: spent, pace against time, uncommitted balance, activities.', 'Finance: Financial report (official layout), Budget lines (double-click a value to correct it), Annual plan, Justification, Scenario, Revision, Reports, Closure.', 'Results: indicators, activity plan and risks. Staff: contracts and end dates. Documents: files read for the project (Delete needs the admin password).'],
    tr: ['Projects → bir proje açın. Summary: harcanan, zamana göre hız, taahhüt edilmemiş bakiye, faaliyetler.', 'Finance: Financial report (resmî düzen), Budget lines (düzeltmek için değere çift tıklayın), Annual plan, Justification, Scenario, Revision, Reports, Closure.', 'Results: göstergeler, faaliyet planı ve riskler. Staff: sözleşmeler ve bitiş tarihleri. Documents: projeden okunan dosyalar (silmek admin şifresi ister).'] } },
  { t: { en: '4. Office budgets', tr: '4. Ofis bütçeleri' }, to: 'offices', b: {
    en: ['Offices: one box per country. Ordinary Budget (BH0127) and LS & Pagoda (BH0128) side by side.', 'Lines with a problem can carry a note (“corrected → line 1.1”); the year-end estimate and a transfer proposal (Word) are built from the latest report.'],
    tr: ['Offices: her ülke için bir kutu. Ordinary Budget (BH0127) ve LS & Pagoda (BH0128) yan yana.', 'Sorunlu satırlara not eklenebilir (“düzeltildi → satır 1.1”); yıl sonu tahmini ve transfer önerisi (Word) son rapordan hazırlanır.'] } },
  { t: { en: '5. Reports for meetings and donors', tr: '5. Toplantı ve donör raporları' }, to: 'reports', b: {
    en: ['Reports → Summary → Monthly pack: the month on a few pages (Save as PDF).', 'Presentation: choose Management or Donor, optionally one page per project and speaker notes; then ⤓ PowerPoint (editable charts) or Save as PDF.', 'Project report: the donor narrative with the explanation of variances (⤓ Word).', 'Finance → Expenditure monitoring prints on A3 landscape. The filters at the top (country, sector) apply to every report.'],
    tr: ['Reports → Summary → Monthly pack: ayın özeti birkaç sayfada (Save as PDF).', 'Presentation: Management ya da Donor seçin; isterseniz proje başına sayfa ve konuşmacı notları; sonra ⤓ PowerPoint (düzenlenebilir grafikler) ya da Save as PDF.', 'Project report: sapma açıklamalarıyla donör anlatımı (⤓ Word).', 'Finance → Expenditure monitoring A3 yatay basılır. Üstteki filtreler (ülke, sektör) tüm raporlara uygulanır.'] } },
  { t: { en: '6. Keep the data healthy', tr: '6. Veri sağlığı' }, to: 'reports/health', b: {
    en: ['Reports → Data → Data health lists what is missing, duplicated or does not add up, with one-click fixes (use the approved budget, keep the latest report or document).', 'Deleted items can be restored there. Every change is in Change history; the latest one can also be undone from the message at the bottom of the screen.'],
    tr: ['Reports → Data → Data health eksik, mükerrer ya da tutmayan kayıtları listeler; tek tıkla düzeltme sunar (onaylı bütçeyi kullan, son raporu ya da belgeyi tut).', 'Silinenler oradan geri yüklenebilir. Her değişiklik Change history’de; son değişiklik ekranın altındaki mesajdan da geri alınabilir.'] } },
  { t: { en: '7. Share a copy', tr: '7. Kopya paylaşma' }, b: {
    en: ['Share a copy (left menu) saves one HTML file with the selected countries / projects inside.', 'View only is recommended. Donor version leaves out staff names, office budgets and the history.', 'Add a password for sensitive data and send it through another channel (phone, SMS). A forgotten password cannot be recovered.'],
    tr: ['Share a copy (sol menü) seçilen ülke / projelerle tek bir HTML dosyası kaydeder.', 'View only önerilir. Donor version personel isimlerini, ofis bütçelerini ve geçmişi çıkarır.', 'Hassas veride şifre ekleyin ve şifreyi başka bir kanaldan iletin (telefon, SMS). Unutulan şifre geri getirilemez.'] } },
  { t: { en: '8. Good to know', tr: '8. Bilmekte fayda var' }, b: {
    en: ['Deleting (projects, countries, reports, documents, risks, office reports) needs the admin password.', 'Ctrl + K opens the command search: jump to any project or screen.', 'The build date at the bottom of the left menu tells which version you are using; after an update, refresh the page.', 'Opening the app shows “This week”: overdue reports and the next 7 days; dates can be added to your calendar (.ics).'],
    tr: ['Silme işlemleri (proje, ülke, rapor, belge, risk, ofis raporu) admin şifresi ister.', 'Ctrl + K komut aramasını açar: herhangi bir projeye ya da ekrana gidin.', 'Sol menünün altındaki tarih hangi sürümü kullandığınızı gösterir; güncellemeden sonra sayfayı yenileyin.', 'Uygulama açılırken “This week” gelir: geciken raporlar ve önümüzdeki 7 gün; tarihler takvime eklenebilir (.ics).'] } },
];

export function Guide() {
  const [lang, setLang] = useState<Lang>(() => { try { return (localStorage.getItem('pl-guide-lang') as Lang) || 'tr'; } catch { return 'tr'; } });
  const pick = (l: Lang) => { setLang(l); try { localStorage.setItem('pl-guide-lang', l); } catch { /* ignore */ } };
  return (
    <article class="card guide">
      <div class="card-h" style={{ alignItems: 'center' }}>
        <div><h2>{lang === 'tr' ? 'Portfolio Ledger — nasıl kullanılır' : 'Portfolio Ledger — how to use it'}</h2><p>{lang === 'tr' ? 'Ekip için tek sayfalık rehber. Yazdırıp paylaşabilirsiniz.' : 'A one-page guide for the team. Print it and share it.'}</p></div>
        <div class="tools"><div class="seg">{(['tr', 'en'] as const).map((l) => <button aria-pressed={lang === l} onClick={() => pick(l)}>{l === 'tr' ? 'Türkçe' : 'English'}</button>)}</div><button class="btn" onClick={() => print()}>⎙ {lang === 'tr' ? 'Yazdır' : 'Print'}</button></div>
      </div>
      <div class="guide-g">{STEPS.map((s) => (
        <section class="guide-s">
          <h3>{s.t[lang]}</h3>
          <ul>{s.b[lang].map((x) => <li>{x}</li>)}</ul>
          {s.to && <button class="linkish no-print" onClick={() => go(s.to!)}>{lang === 'tr' ? 'Ekrana git →' : 'Open the screen →'}</button>}
        </section>))}</div>
    </article>
  );
}
