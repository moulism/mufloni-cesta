// Sestaví veřejný soubor data/cesty.js ze soukromého zdroje private/cesty-src.json.
// Etapy a cíl se zašifrují kódy z terénu → na GitHubu je nikdo nepřečte.
// Použití:  node tools/build.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCCrypto = require(path.join(root, 'js/crypto.js'));

const SECRET = ['stages', 'finale', 'codes'];

const src = JSON.parse(await readFile(path.join(root, 'private/cesty-src.json'), 'utf8'));
const out = [];
for (const c of src) {
  const pub = {};
  for (const [k, v] of Object.entries(c)) if (!SECRET.includes(k)) pub[k] = v;
  pub.stagesCount = c.stages.length;
  pub.bundle = await MCCrypto.buildBundle(c.stages, c.finale, c.codes);
  out.push(pub);
  console.log(`✔ ${c.id} – ${c.stages.length} etap zašifrováno`);
}
const js = '/* VYGENEROVÁNO: node tools/build.mjs – needituj ručně, uprav private/cesty-src.json nebo použij #/admin */\n' +
  'window.MC_CESTY = ' + JSON.stringify(out, null, 1) + ';\n';
await writeFile(path.join(root, 'data/cesty.js'), js);
console.log(`Hotovo → data/cesty.js (${out.length} cest)`);
