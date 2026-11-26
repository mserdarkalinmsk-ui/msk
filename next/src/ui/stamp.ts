/** The note for the next file written, set by the export check and read once by the Excel and Word writers. */
let pending = '';
export const setStamp = (s: string) => { pending = s; };
export const takeStamp = () => { const s = pending; pending = ''; return s; };
