import type { Contract } from '../domain/contracts';
import type { Ledger } from '../domain/types';
import { TODAY } from '../today';
import { downloadDocx } from './docxwrite';

const long = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
const el = (tag: string, text: string) => { const x = document.createElement(tag); x.textContent = text; return x; };

/**
 * The notice that a contract will not be renewed beyond its end, to send to the provider before the notice deadline.
 * Only what the contract holds is written (reference, end, notice period); the address block is the one saved for letters.
 */
export function noticeLetterDocx(name: string, c: Contract, ledger: Ledger) {
  if (!c.end) return;
  const brand = ledger.brand ?? {}, who = brand.name?.trim(), ref = c.ref?.trim();
  const d = document.createElement('div');
  d.append(el('p', dmy(TODAY)), el('p', name));
  d.append(el('h1', `${ref ? `Contract ${ref}` : 'Contract'} — notice of non-renewal`));
  d.append(el('p', 'Dear Sir or Madam,'));
  d.append(el('p', `With reference to the contract${ref ? ` ${ref}` : ''} between ${who || 'our organisation'} and ${name}${c.start ? `, in force since ${long(c.start)}` : ''}, we hereby give notice that the contract will not be renewed beyond ${long(c.end)}.`));
  if (c.noticeDays) d.append(el('p', `This notice is given within the notice period of ${c.noticeDays} days the contract provides.`));
  d.append(el('p', `The services under the contract continue to be provided, and are paid, until ${long(c.end)}. We thank you for the cooperation.`));
  d.append(el('p', 'Yours faithfully,'));
  if (brand.sign1) d.append(el('p', brand.sign1));
  const file = `${(ref || name).replace(/[^\w.-]+/g, '-').slice(0, 40)}-notice-${TODAY.toISOString().slice(0, 10)}.docx`;
  return downloadDocx(file, d, `${ref ? `Contract ${ref}` : name} — notice of non-renewal`, [brand.logo, brand.logo2], { letter: true, vars: { provider: name, reference: ref ?? '', end: long(c.end) } });
}
