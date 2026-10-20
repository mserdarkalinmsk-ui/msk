
type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> };
type ClaudeHost = { use: (n: string) => Promise<unknown> };

/**
 * Saves a generated file. Inside the claude.ai viewer the page may not download directly, so the
 * `downloads` capability asks the viewer to confirm; opened as a local file it is a normal download.
 */
export async function saveFile(name: string, data: Blob) {
  // Accented letters in a download name can make the browser fall back to "download": keep plain letters (Türkiye → Turkiye).
  const filename = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/°/g, 'o').replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/[^\x20-\x7e]/g, '_');
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const dl = (await host.use('downloads').catch(() => null)) as Downloads | null;
    if (dl) {
      try { await dl.save({ filename, data }); } catch (e) {
        const { toast } = await import('../data/store');
        const code = (e as { code?: string }).code;
        if (code === 'rate_limited') toast('A save is already waiting for your confirmation');
        else if (code !== 'declined') toast('Saving files is not available in this view');
      }
      return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
