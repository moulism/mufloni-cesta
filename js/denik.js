/* Generátor offline deníku – jeden HTML soubor, který si účastník stáhne do telefonu.
 * Funguje bez internetu: obsahuje zašifrované etapy a odemyká je kódy z terénu. */
(function () {
  // Tahle funkce se vloží do staženého souboru (proto nesmí používat nic zvenku).
  function runtime(D) {
    const $ = s => document.querySelector(s);
    const KEY = 'denik_' + D.cesta.id;
    let st; try { st = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { st = null; }
    if (!st) st = { codes: D.codes || [], hints: D.hints || [], startedAt: D.startedAt || null };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } };
    const enc = new TextEncoder(), dec = new TextDecoder();
    const norm = c => String(c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    async function decrypt(part, code) {
      try {
        const base = await crypto.subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(part.s), iterations: D.cesta.bundle.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(part.i) }, key, unb64(part.c))));
      } catch (e) { return null; }
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const coords = c => c ? `<div class="coords">📍 ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</div><div class="links"><a href="https://mapy.com/fnc/v1/showmap?mapset=outdoor&center=${c.lng},${c.lat}&zoom=16&marker=true">Mapy.com</a><a href="https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}">Google</a><a href="geo:${c.lat},${c.lng}">Otevřít v aplikaci</a></div>` : '';
    const P = D.cesta.bundle.parts, N = D.cesta.bundle.n;

    async function render() {
      const start = new Date(D.cesta.start);
      let html = '';
      const before = Date.now() < start && !D.retro;
      if (before) {
        const ms = start - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
        html += `<div class="page"><h2>Ještě není čas</h2><p class="hand">Cesta začíná ${start.toLocaleString('cs-CZ')}.</p><p class="big">${d} d ${h} h ${m} min</p></div>`;
      }
      html += `<div class="page"><h2>Start</h2><p>${esc(D.cesta.startArea)}</p>${coords(D.cesta.startCoords)}<p class="note">${esc(D.cesta.meetingNote || '')}</p><div class="prompt">🔎 ${esc(D.cesta.startPrompt)}</div></div>`;
      let i = 0;
      for (; i <= N; i++) {
        if (!st.codes[i]) break;
        const data = await decrypt(P[i], st.codes[i]);
        if (!data) { st.codes.length = i; save(); break; }
        if (i < N) {
          const hintUsed = st.hints.includes(i);
          html += `<div class="page"><div class="num">Stanoviště ${i + 1} / ${N}</div><h2>${esc(data.title)}</h2><p class="hand">„${esc(data.story)}“</p><h3>Úkol</h3><p>${esc(data.task)}</p>
            ${data.nav ? `<h3>Cesta dál</h3>${data.nav.note ? `<p>${esc(data.nav.note)}</p>` : ''}${data.nav.riddle ? `<p class="riddle">🜁 ${esc(data.nav.riddle)}</p>` : ''}${coords(data.nav.coords)}` : ''}
            <div class="prompt">🔎 ${esc(data.codePrompt)}</div>
            ${data.hint ? (hintUsed ? `<p class="hint">💡 ${esc(data.hint)}</p>` : `<button class="ghost" data-hint="${i}" data-pen="${data.hintPenaltyMin || 0}">Nápověda (+${data.hintPenaltyMin || 0} min)</button>`) : ''}</div>`;
        } else {
          html += `<div class="page finale"><div class="num">Cíl</div><h2>${esc(data.title)}</h2><p class="hand">„${esc(data.story)}“</p>${coords(data.coords)}<h3>Poslední úkol</h3><p>${esc(data.photoTask)}</p>
            <a class="cta" href="${esc(D.url)}">Nahrát fotku na web →</a><p class="note">Na webu případně zadej poslední kód: <b>${esc(st.codes[N])}</b></p></div>`;
        }
      }
      if (i <= N && !before) {
        html += `<div class="page unlock"><h3>${i === 0 ? 'Zadej startovní kód' : 'Zadej kód ze stanoviště'}</h3><form id="f"><input id="code" autocomplete="off" autocapitalize="characters" placeholder="KÓD"><button>Odemknout</button></form><p id="err" class="err"></p></div>`;
      }
      $('#app').innerHTML = html;
      const f = $('#f');
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const code = $('#code').value; if (!code.trim()) return;
        $('#err').textContent = 'Ověřuji…';
        const ok = await decrypt(P[i], code);
        if (!ok) { $('#err').textContent = 'Tenhle kód nesedí. Zkus to znovu.'; return; }
        st.codes[i] = norm(code); if (!st.startedAt) st.startedAt = new Date().toISOString(); save(); await render();
        const pages = document.querySelectorAll('.page'); pages[pages.length - (i + 1 > N ? 1 : 2)].scrollIntoView({ behavior: 'smooth' });
      };
      document.querySelectorAll('[data-hint]').forEach(b => b.onclick = () => {
        if (!confirm('Nápověda přidá ' + b.dataset.pen + ' min k tvému času. Opravdu?')) return;
        st.hints.push(+b.dataset.hint); save(); render();
      });
    }
    render();
    setInterval(() => { if (Date.now() < new Date(D.cesta.start)) render(); }, 30000);
  }

  function build(cesta, progress, reg) {
    const pub = {};
    ['id', 'nazev', 'podtitul', 'level', 'start', 'durationH', 'startArea', 'startCoords', 'startPrompt', 'meetingNote', 'bundle', 'gear', 'safety'].forEach(k => pub[k] = cesta[k]);
    const D = { cesta: pub, codes: progress.codes || [], hints: progress.hints || [], startedAt: progress.startedAt, retro: U.status(cesta) === 'archive', url: location.origin + location.pathname + '#/cesta/' + cesta.id + '/pruvodce', team: reg ? reg.team : '' };
    const json = JSON.stringify(D).replace(/</g, '\\u003c');
    const sos = window.MC_CONFIG.ORGANIZER;
    return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deník – ${U.esc(cesta.nazev)}</title><meta name="theme-color" content="#1d3326">
<link href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=IM+Fell+English:ital@0;1&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#2a2016;font-family:"IM Fell English",Georgia,serif;color:#2b2116;line-height:1.55}
header{background:#1d3326;color:#e9d9a6;text-align:center;padding:28px 16px 22px;border-bottom:4px double #b8932c}
header h1{font-family:UnifrakturMaguntia,serif;font-weight:400;font-size:2.2rem;margin:.2em 0}header p{margin:0;font-style:italic;opacity:.8}
#app{max-width:640px;margin:0 auto;padding:14px}
.page{background:#f1e4c4;background-image:radial-gradient(circle at 20% 10%,#f8eed6,transparent 60%),radial-gradient(circle at 80% 90%,#e6d3a6,transparent 55%);border-radius:4px;padding:22px 20px;margin:16px 0;box-shadow:0 6px 18px #0008,inset 0 0 40px #b8932c33;position:relative}
.page h2{font-family:UnifrakturMaguntia,serif;font-weight:400;font-size:1.9rem;margin:.1em 0 .3em;color:#1d3326}.page h3{margin:1em 0 .2em;color:#7a2e1a;font-size:1.05rem;text-transform:uppercase;letter-spacing:.08em}
.num{font-family:Caveat,cursive;color:#7a2e1a;font-size:1.3rem}.hand{font-family:Caveat,cursive;font-size:1.45rem;line-height:1.3;color:#3b2a18}
.riddle{font-style:italic;border-left:3px solid #7a2e1a;padding-left:10px}.coords{font-family:monospace;background:#1d3326;color:#e9d9a6;display:inline-block;padding:6px 10px;border-radius:4px;margin:6px 0}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}.links a{color:#1d3326;border:1px solid #1d3326;border-radius:20px;padding:4px 12px;text-decoration:none;font-size:.9rem}
.prompt{margin-top:14px;padding:12px;border:2px dashed #b8932c;background:#fff6;border-radius:6px}.note{font-size:.9rem;opacity:.8}
.hint{background:#fff3c4;padding:8px 10px;border-radius:6px}.big{font-size:2rem;text-align:center;font-family:Caveat,cursive}
form{display:flex;gap:8px}input{flex:1;font-size:1.3rem;padding:12px;border:2px solid #1d3326;border-radius:6px;text-transform:uppercase;letter-spacing:.15em;font-family:monospace;background:#fffaf0}
button{font:inherit;background:#1d3326;color:#e9d9a6;border:0;border-radius:6px;padding:12px 16px;cursor:pointer}button.ghost{background:none;color:#7a2e1a;border:1px solid #7a2e1a;margin-top:10px;padding:6px 12px}
.err{color:#a1301a;min-height:1.2em}.finale{border:3px solid #b8932c}.cta{display:block;text-align:center;background:#b8932c;color:#1d3326;font-weight:bold;padding:14px;border-radius:6px;text-decoration:none;margin:12px 0}
footer{color:#e9d9a6;text-align:center;font-size:.85rem;padding:20px;opacity:.75}footer a{color:#e9d9a6}
</style></head><body>
<header><p>Deník Velkého Muflona</p><h1>${U.esc(cesta.nazev)}</h1><p>${U.esc(cesta.podtitul || '')}${D.team ? ' · ' + U.esc(D.team) : ''}</p></header>
<main id="app"><div class="page">Načítám deník…</div></main>
<footer>🆘 Nouze: <a href="tel:112">112</a> · Organizátor: <a href="tel:${U.esc(sos.phone)}">${U.esc(sos.phone)}</a><br>Deník funguje i bez signálu. Postup se ukládá v tomto zařízení.</footer>
<script>(${runtime.toString()})(${json});<\/script></body></html>`;
  }

  window.MCDenik = { build };
})();
