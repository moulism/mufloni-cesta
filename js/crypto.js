/* Mufloní cesta – šifrování etap.
 * Každá etapa je zašifrovaná kódem, který tým najde v terénu (AES-GCM, klíč z PBKDF2).
 * Bez kódu nejde další etapu přečíst ani ze zdrojáku na GitHubu.
 * Funguje v prohlížeči i v Node 20+ (tools/build.mjs).
 */
(function (root) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function norm(code) {
    return String(code || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function b64(buf) {
    const b = new Uint8Array(buf); let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str); const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  async function deriveKey(code, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptPart(obj, code, iter) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(code, salt, iter);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { s: b64(salt), i: b64(iv), c: b64(ct) };
  }
  async function decryptPart(part, code, iter) {
    try {
      const key = await deriveKey(code, unb64(part.s), iter);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(part.i) }, key, unb64(part.c));
      return JSON.parse(dec.decode(pt));
    } catch (e) { return null; }
  }
  /* stages: [..], finale: {..}, codes: [startCode, kódEtapy1, ...] – délka = stages.length + 1
   * part[i] (etapa i) se odemyká codes[i]; poslední part (cíl) se odemyká codes[stages.length]. */
  async function buildBundle(stages, finale, codes, iter = 60000) {
    if (!Array.isArray(codes) || codes.length !== stages.length + 1)
      throw new Error('Počet kódů musí být počet etap + 1 (startovní kód + kód každé etapy).');
    const parts = [];
    for (let i = 0; i < stages.length; i++) parts.push(await encryptPart(stages[i], codes[i], iter));
    parts.push(await encryptPart(finale, codes[stages.length], iter));
    return { v: 1, iter, n: stages.length, parts };
  }

  const api = { norm, encryptPart, decryptPart, buildBundle };
  root.MCCrypto = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
