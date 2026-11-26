/**
 * A small modal question with a masked password field (the browser's own prompt shows what is typed).
 * Resolves with the password, or null when cancelled. `twice` asks for it a second time, for a new password.
 */
export function askPassword(o: { title: string; text?: string; twice?: boolean; ok?: string; check?: (pw: string) => Promise<string | null> | string | null }): Promise<string | null> {
  return new Promise((res) => {
    const d = document.createElement('dialog'); d.className = 'ask';
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    d.innerHTML = `<form method="dialog" class="ask-f"><h2>${esc(o.title)}</h2>${o.text ? `<p>${esc(o.text)}</p>` : ''}
      <label class="field"><span>Password</span><input type="password" name="a" autocomplete="${o.twice ? 'new-password' : 'current-password'}" required /></label>
      ${o.twice ? '<label class="field"><span>Repeat the password</span><input type="password" name="b" autocomplete="new-password" required /></label>' : ''}
      <p class="ask-e" role="alert" hidden></p>
      <div class="ask-a"><button type="button" class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok">${esc(o.ok ?? 'OK')}</button></div></form>`;
    document.body.appendChild(d);
    const f = d.querySelector('form')!, a = f.elements.namedItem('a') as HTMLInputElement, b = f.elements.namedItem('b') as HTMLInputElement | null, e = d.querySelector<HTMLElement>('.ask-e')!;
    const done = (v: string | null) => { d.close(); d.remove(); res(v); };
    const fail = (t: string) => { e.textContent = t; e.hidden = false; a.select(); };
    d.querySelector<HTMLButtonElement>('button[value=cancel]')!.onclick = () => done(null);
    d.addEventListener('cancel', (ev) => { ev.preventDefault(); done(null); });
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      if (b && a.value !== b.value) return fail('The two passwords are not the same.');
      if (o.twice && a.value.length < 6) return fail('Use at least 6 characters.');
      const bad = o.check ? await o.check(a.value) : null;
      if (bad) return fail(bad);
      done(a.value);
    };
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    a.focus();
  });
}
