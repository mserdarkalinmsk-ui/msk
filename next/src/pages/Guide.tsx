import { useState } from 'preact/hooks';
import { go, useStore } from '../data/store';

type Lang = 'en' | 'tr';
interface Step { t: Record<Lang, string>; b: Record<Lang, string[]>; to?: string; icon?: string; c?: string }

/** How to use the Portfolio Ledger — one page for the team, in English and Turkish, printable. */
const STEPS: Step[] = [
  { icon: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z', c: '#2f6fb3', t: { en: '1. Your data stays with you', tr: '1. Verileriniz sizde kalır' }, b: {
    en: ['The ledger is one HTML file that works offline. Data is saved in this browser only — nothing is sent anywhere.', 'Back up regularly: Import / backup → Back up now. Keep the backup file on a shared drive.', 'A daily restore point is kept automatically (Reports → Data → Data health shows deleted items you can restore).'],
    tr: ['Uygulama çevrimdışı çalışan tek bir HTML dosyasıdır. Veriler yalnızca bu tarayıcıda saklanır, hiçbir yere gönderilmez.', 'Düzenli yedek alın: Import / backup → Back up now. Yedek dosyasını ortak bir klasörde tutun.', 'Her gün otomatik bir geri yükleme noktası alınır; silinenler Reports → Data → Data health ekranından geri getirilebilir.'] } },
  { icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16', c: 'var(--c3)', t: { en: '2. Load files — Smart import', tr: '2. Dosya yükleme — Smart import' }, to: 'overview', b: {
    en: ['Import / backup → drop all files at once: system extractions (Extraction-Rapport financier), CoE financial report workbooks, budget workbooks, DoA / contract (docx, pdf), logframes, office budget workbooks.', 'Each file is recognised and matched to its project by BH, JP / PMM or contract number. Check the project in the list before importing.', 'Under every report you see a read check: lines and euros must match the file. A red line blocks the import until you tick “Import anyway”.', 'A budget workbook (xlsx) always outranks a budget table inside a DoA.'],
    tr: ['Import / backup → tüm dosyaları birlikte bırakın: sistem çıktıları (Extraction-Rapport financier), CoE finansal rapor dosyaları, bütçe dosyaları, DoA / sözleşme (docx, pdf), logframe, ofis bütçe dosyaları.', 'Her dosya tanınır ve BH, JP / PMM ya da sözleşme numarasıyla projesine eşleşir. İçe aktarmadan önce listedeki projeyi kontrol edin.', 'Her raporun altında okuma kontrolü görünür: satırlar ve tutarlar dosyayla aynı olmalı. Kırmızı satır, “Import anyway” işaretlenmeden içe aktarmayı durdurur.', 'Bütçe Excel’i (xlsx) her zaman DoA içindeki bütçe tablosundan önce gelir.'] } },
  { icon: 'M4 19V5m0 14h16M8 15l4-4 3 3 5-6', c: 'var(--c7)', t: { en: '3. Follow a project', tr: '3. Projeyi takip etme' }, to: 'projects', b: {
    en: ['Projects → open a project. Summary: spent, pace against time, uncommitted balance, activities.', 'Finance: Financial report (official layout), Budget lines (double-click a value to correct it), Annual plan, Justification, Scenario, Revision, Reports, Closure.', 'Results: indicators, activity plan and risks. Staff: contracts and end dates. Documents: files read for the project (Delete needs the admin password).'],
    tr: ['Projects → bir proje açın. Summary: harcanan, zamana göre hız, taahhüt edilmemiş bakiye, faaliyetler.', 'Finance: Financial report (resmî düzen), Budget lines (düzeltmek için değere çift tıklayın), Annual plan, Justification, Scenario, Revision, Reports, Closure.', 'Results: göstergeler, faaliyet planı ve riskler. Staff: sözleşmeler ve bitiş tarihleri. Documents: projeden okunan dosyalar (silmek admin şifresi ister).'] } },
  { icon: 'M3 21h18M5 21V7l7-4 7 4v14M10 21v-4h4v4', c: 'var(--warn)', t: { en: '4. Office budgets', tr: '4. Ofis bütçeleri' }, to: 'offices', b: {
    en: ['Offices: one box per country. Ordinary Budget (BH0127) and LS & Pagoda (BH0128) side by side.', 'Lines with a problem can carry a note (“corrected → line 1.1”); the year-end estimate and a transfer proposal (Word) are built from the latest report.'],
    tr: ['Offices: her ülke için bir kutu. Ordinary Budget (BH0127) ve LS & Pagoda (BH0128) yan yana.', 'Sorunlu satırlara not eklenebilir (“düzeltildi → satır 1.1”); yıl sonu tahmini ve transfer önerisi (Word) son rapordan hazırlanır.'] } },
  { icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6', c: 'var(--critical)', t: { en: '5. Reports for meetings and donors', tr: '5. Toplantı ve donör raporları' }, to: 'reports', b: {
    en: ['Reports → Summary → Monthly pack: the month on a few pages (Save as PDF).', 'Presentation: choose Management or Donor, optionally one page per project and speaker notes; then ⤓ PowerPoint (editable charts) or Save as PDF.', 'Project report: the donor narrative with the explanation of variances (⤓ Word).', 'Finance → Expenditure monitoring prints on A3 landscape. The filters at the top (country, sector) apply to every report.'],
    tr: ['Reports → Summary → Monthly pack: ayın özeti birkaç sayfada (Save as PDF).', 'Presentation: Management ya da Donor seçin; isterseniz proje başına sayfa ve konuşmacı notları; sonra ⤓ PowerPoint (düzenlenebilir grafikler) ya da Save as PDF.', 'Project report: sapma açıklamalarıyla donör anlatımı (⤓ Word).', 'Finance → Expenditure monitoring A3 yatay basılır. Üstteki filtreler (ülke, sektör) tüm raporlara uygulanır.'] } },
  { icon: 'M20 6 9 17l-5-5', c: 'var(--good)', t: { en: '6. Keep the data healthy', tr: '6. Veri sağlığı' }, to: 'reports/health', b: {
    en: ['Reports → Data → Data health lists what is missing, duplicated or does not add up, with one-click fixes (use the approved budget, keep the latest report or document).', 'Deleted items can be restored there. Every change is in Change history; the latest one can also be undone from the message at the bottom of the screen.'],
    tr: ['Reports → Data → Data health eksik, mükerrer ya da tutmayan kayıtları listeler; tek tıkla düzeltme sunar (onaylı bütçeyi kullan, son raporu ya da belgeyi tut).', 'Silinenler oradan geri yüklenebilir. Her değişiklik Change history’de; son değişiklik ekranın altındaki mesajdan da geri alınabilir.'] } },
  { icon: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13', c: 'var(--c1)', t: { en: '7. Share a copy', tr: '7. Kopya paylaşma' }, b: {
    en: ['Share a copy (left menu) saves one HTML file with the selected countries / projects inside.', 'View only is recommended. Donor version leaves out staff names, office budgets and the history.', 'Add a password for sensitive data and send it through another channel (phone, SMS). A forgotten password cannot be recovered.'],
    tr: ['Share a copy (sol menü) seçilen ülke / projelerle tek bir HTML dosyası kaydeder.', 'View only önerilir. Donor version personel isimlerini, ofis bütçelerini ve geçmişi çıkarır.', 'Hassas veride şifre ekleyin ve şifreyi başka bir kanaldan iletin (telefon, SMS). Unutulan şifre geri getirilemez.'] } },
  { icon: 'M12 17h.01M12 7v6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', c: '#6b6f76', t: { en: '8. Good to know', tr: '8. Bilmekte fayda var' }, b: {
    en: ['Deleting (projects, countries, reports, documents, risks, office reports) needs the admin password.', 'Ctrl + K opens the command search: jump to any project or screen.', 'The build date at the bottom of the left menu tells which version you are using; after an update, refresh the page.', 'Opening the app shows “This week”: overdue reports and the next 7 days; dates can be added to your calendar (.ics).'],
    tr: ['Silme işlemleri (proje, ülke, rapor, belge, risk, ofis raporu) admin şifresi ister.', 'Ctrl + K komut aramasını açar: herhangi bir projeye ya da ekrana gidin.', 'Sol menünün altındaki tarih hangi sürümü kullandığınızı gösterir; güncellemeden sonra sayfayı yenileyin.', 'Uygulama açılırken “This week” gelir: geciken raporlar ve önümüzdeki 7 gün; tarihler takvime eklenebilir (.ics).'] } },
];

const FLOW: { icon: string; t: Record<Lang, string>; d: Record<Lang, string> }[] = [
  { icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16', t: { en: 'Import', tr: 'Yükle' }, d: { en: 'Drop the files', tr: 'Dosyaları bırak' } },
  { icon: 'M20 6 9 17l-5-5', t: { en: 'Check', tr: 'Kontrol et' }, d: { en: 'Read check · Data health', tr: 'Okuma kontrolü · Veri sağlığı' } },
  { icon: 'M4 19V5m0 14h16M8 15l4-4 3 3 5-6', t: { en: 'Follow', tr: 'Takip et' }, d: { en: 'Projects · Offices', tr: 'Projeler · Ofisler' } },
  { icon: 'M6 3h9l4 4v14H6zM14 3v5h5', t: { en: 'Report', tr: 'Raporla' }, d: { en: 'Pack · PowerPoint · Word', tr: 'Paket · PowerPoint · Word' } },
  { icon: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13', t: { en: 'Share', tr: 'Paylaş' }, d: { en: 'Protected copy', tr: 'Şifreli kopya' } },
];
const Ico = ({ d, size = 18 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>;

export function Guide() {
  const [lang, setLang] = useState<Lang>(() => { try { return (localStorage.getItem('pl-guide-lang') as Lang) || 'tr'; } catch { return 'tr'; } });
  const pick = (l: Lang) => { setLang(l); try { localStorage.setItem('pl-guide-lang', l); } catch { /* ignore */ } };
  const tr = lang === 'tr';
  const title = useStore((st) => st.ledger.brand?.title) || 'Portfolio Ledger';
  return (
    <article class="guide">
      <header class="gd-hero">
        <div>
          <div class="gd-k">{tr ? 'Kullanım rehberi' : 'User guide'}</div>
          <h1>{title}</h1>
          <p>{tr ? 'Proje ve ofis bütçelerini tek yerden izleyin, raporları dakikalar içinde hazırlayın. Bu sayfa ekibin ihtiyaç duyduğu her şeyi özetler.' : 'Follow project and office budgets in one place and prepare reports in minutes. This page sums up what the team needs.'}</p>
        </div>
        <div class="gd-tools no-print">
          <div class="seg">{(['tr', 'en'] as const).map((l) => <button aria-pressed={lang === l} onClick={() => pick(l)}>{l === 'tr' ? 'Türkçe' : 'English'}</button>)}</div>
          <button class="btn" onClick={() => print()}>⎙ {tr ? 'Yazdır' : 'Print'}</button>
        </div>
      </header>

      <ol class="gd-flow" aria-label={tr ? 'İş akışı' : 'Workflow'}>{FLOW.map((f, i) => (
        <li><span class="gd-fi"><Ico d={f.icon} /></span><div><b>{i + 1}. {f.t[lang]}</b><small>{f.d[lang]}</small></div></li>))}</ol>

      <div class="guide-g">{STEPS.map((s) => (
        <section class="guide-s" style={{ '--gc': s.c } as Record<string, string>}>
          <div class="gd-sh"><span class="gd-si"><Ico d={s.icon!} /></span><h3>{s.t[lang].replace(/^\d+\.\s*/, '')}</h3><span class="gd-n">{s.t[lang].match(/^\d+/)?.[0]}</span></div>
          <ul>{s.b[lang].map((x) => <li>{x}</li>)}</ul>
          {s.to && <button class="gd-go no-print" onClick={() => go(s.to!)}>{tr ? 'Ekrana git' : 'Open the screen'} <span aria-hidden="true">→</span></button>}
        </section>))}</div>

      <footer class="gd-foot">
        <b>{tr ? 'Bir sorun mu var?' : 'Something wrong?'}</b>
        <span>{tr ? 'Önce Reports → Data → Data health ekranına bakın. Rakam tutmuyorsa dosyayı tekrar yükleyin; okuma kontrolü farkı gösterir.' : 'Look at Reports → Data → Data health first. If a figure does not add up, load the file again — the read check shows the difference.'}</span>
      </footer>
    </article>
  );
}
