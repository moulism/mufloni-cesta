/* Pomocné funkce: formátování, odpočty, obálky, mapy, kalendář, GPX, toast, modal, konfety, diplom, počasí */
(function () {
  const U = {};

  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.$ = (sel, el = document) => el.querySelector(sel);
  U.$$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  U.LEVELS = {
    easy: { label: 'Easy', cz: 'Pohodová', color: '#7fb069', n: 1 },
    medium: { label: 'Medium', cz: 'Střední', color: '#e3b23c', n: 2 },
    hard: { label: 'Hard', cz: 'Těžká', color: '#e07a2f', n: 3 },
    hardcore: { label: 'Hardcore', cz: 'Extrémní', color: '#d64933', n: 4 }
  };
  U.levelBadge = l => { const L = U.LEVELS[l] || U.LEVELS.easy; return `<span class="lvl lvl-${l}"><i>${'▲'.repeat(L.n)}</i>${L.label}</span>`; };

  U.fmtDate = (d, opts) => new Date(d).toLocaleDateString('cs-CZ', opts || { day: 'numeric', month: 'long', year: 'numeric' });
  U.fmtDateTime = d => new Date(d).toLocaleString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  U.fmtDur = min => { if (min == null) return '–'; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
  U.plural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);

  U.endOf = c => new Date(new Date(c.start).getTime() + (c.durationH || 4) * 3600e3);
  U.status = c => { const now = Date.now(), s = new Date(c.start).getTime(); if (now < s) return 'upcoming'; if (now < U.endOf(c).getTime()) return 'live'; return 'archive'; };
  U.STATUS_LABEL = { upcoming: 'Nadcházející', live: 'Právě probíhá', archive: 'Archiv' };

  /* ---------- odpočet ---------- */
  U.countdownParts = target => {
    let ms = Math.max(0, new Date(target) - Date.now());
    const d = Math.floor(ms / 864e5); ms -= d * 864e5;
    const h = Math.floor(ms / 36e5); ms -= h * 36e5;
    const m = Math.floor(ms / 6e4); ms -= m * 6e4;
    return { d, h, m, s: Math.floor(ms / 1000), done: new Date(target) <= Date.now() };
  };
  U.countdownHTML = (target, big) => `<div class="cd ${big ? 'cd-big' : ''}" data-countdown="${new Date(target).toISOString()}">${U.cdInner(target)}</div>`;
  U.cdInner = target => {
    const p = U.countdownParts(target);
    if (p.done) return '<span class="cd-done">Už to začalo!</span>';
    const box = (v, l) => `<span><b>${String(v).padStart(2, '0')}</b><small>${l}</small></span>`;
    return box(p.d, U.plural(p.d, 'den', 'dny', 'dní')) + box(p.h, 'hod') + box(p.m, 'min') + box(p.s, 'sek');
  };
  let ticker;
  U.startTicker = onDone => {
    clearInterval(ticker);
    ticker = setInterval(() => {
      U.$$('[data-countdown]').forEach(el => {
        const t = el.dataset.countdown; el.innerHTML = U.cdInner(t);
        if (new Date(t) <= Date.now() && !el.dataset.fired) { el.dataset.fired = 1; onDone && onDone(); }
      });
      U.$$('[data-elapsed]').forEach(el => { el.textContent = U.fmtDur((Date.now() - new Date(el.dataset.elapsed)) / 6e4); });
    }, 1000);
  };

  /* ---------- obálka: vrstevnice generované z id ---------- */
  function rng(seed) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
  U.cover = (id, level) => {
    const r = rng(id); const col = (U.LEVELS[level] || U.LEVELS.easy).color;
    const cx = 120 + r() * 360, cy = 80 + r() * 160; let paths = '';
    for (let k = 1; k <= 11; k++) {
      const pts = []; const base = k * 26 + r() * 6;
      for (let a = 0; a < 24; a++) {
        const ang = a / 24 * Math.PI * 2; const rad = base * (0.75 + 0.35 * Math.sin(ang * 3 + k * 0.4 + r() * 0.6));
        pts.push([cx + Math.cos(ang) * rad * 1.5, cy + Math.sin(ang) * rad]);
      }
      let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length; i++) { const p1 = pts[(i + 1) % pts.length], p2 = pts[(i + 2) % pts.length]; d += ` Q${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${((p1[0] + p2[0]) / 2).toFixed(1)},${((p1[1] + p2[1]) / 2).toFixed(1)}`; }
      paths += `<path d="${d}Z" fill="none" stroke="${k % 5 === 0 ? col : '#d8c48a'}" stroke-opacity="${k % 5 === 0 ? .55 : .16}" stroke-width="${k % 5 === 0 ? 1.6 : 1}"/>`;
    }
    const trail = `<path d="M-10,${(260 + r() * 40).toFixed(0)} C${(100 + r() * 80).toFixed(0)},${(180 + r() * 60).toFixed(0)} ${(260 + r() * 80).toFixed(0)},${(260 + r() * 40).toFixed(0)} ${cx.toFixed(0)},${cy.toFixed(0)}" fill="none" stroke="${col}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>`;
    return `<svg class="cover-svg" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="600" height="320" fill="#13221a"/>${paths}${trail}<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="6" fill="${col}"/><circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="14" fill="none" stroke="${col}" stroke-opacity=".5"/></svg>`;
  };

  /* ---------- muflon logo ---------- */
  U.logo = (size = 34) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M24 22c-9-3-16 2-16 10s7 12 13 8c4-3 3-9-1-10-3-1-5 2-3 4"/><path d="M40 22c9-3 16 2 16 10s-7 12-13 8c-4-3-3-9 1-10 3-1 5 2 3 4"/></g><path d="M24 20c2-4 14-4 16 0l-2 22c-1 8-11 8-12 0z" fill="currentColor"/><circle cx="28.5" cy="28" r="1.6" fill="#13221a"/><circle cx="35.5" cy="28" r="1.6" fill="#13221a"/></svg>`;

  /* ---------- mapy ---------- */
  U.fmtCoords = c => c ? `${Math.abs(c.lat).toFixed(5)}°${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lng).toFixed(5)}°${c.lng >= 0 ? 'E' : 'W'}` : '';
  U.mapLinks = c => !c ? '' : `<div class="maplinks">
    <a class="btn btn-sm" target="_blank" rel="noopener" href="https://mapy.com/fnc/v1/showmap?mapset=outdoor&center=${c.lng},${c.lat}&zoom=16&marker=true">Mapy.com</a>
    <a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}">Google Maps</a>
    <a class="btn btn-sm" target="_blank" rel="noopener" href="https://mapy.com/fnc/v1/route?mapset=outdoor&end=${c.lng},${c.lat}&routeType=foot_hiking">Navigovat</a>
    <button class="btn btn-sm btn-ghost" data-copy="${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}">Kopírovat</button></div>`;
  U.mapEmbed = c => !c ? '' : `<iframe class="osm" loading="lazy" title="Mapa" src="https://www.openstreetmap.org/export/embed.html?bbox=${c.lng - 0.012},${c.lat - 0.007},${c.lng + 0.012},${c.lat + 0.007}&layer=cyclosm&marker=${c.lat},${c.lng}"></iframe>`;

  /* ---------- soubory ---------- */
  U.download = (name, content, type) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  U.ics = c => {
    const f = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const url = location.origin + location.pathname + '#/cesta/' + c.id;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mufloni cesta//CZ', 'BEGIN:VEVENT', 'UID:' + c.id + '@mufloni-cesta', 'DTSTAMP:' + f(Date.now()),
      'DTSTART:' + f(c.start), 'DTEND:' + f(U.endOf(c)), 'SUMMARY:' + c.nazev, 'LOCATION:' + c.startArea,
      'DESCRIPTION:' + (c.description || '').replace(/\n/g, ' ') + '\\n' + url, 'URL:' + url,
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Zítra Mufloní cesta!', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  };
  U.gpx = (name, points) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mufloni cesta" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${U.esc(name)}</name></metadata>
${points.map(p => `<wpt lat="${p.lat}" lon="${p.lng}"><name>${U.esc(p.name)}</name></wpt>`).join('\n')}
</gpx>`;
  U.slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ---------- UI ---------- */
  U.toast = (msg, type) => {
    let wrap = U.$('#toasts'); if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; wrap.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
  };
  U.modal = (html, cls) => {
    const m = document.createElement('div'); m.className = 'modal-bg';
    m.innerHTML = `<div class="modal ${cls || ''}" role="dialog"><button class="modal-x" aria-label="Zavřít">×</button>${html}</div>`;
    const close = () => { m.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    m.addEventListener('click', e => { if (e.target === m || e.target.classList.contains('modal-x') || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', esc); document.body.appendChild(m);
    return { el: m, close };
  };
  U.confirm = (text, okLabel) => new Promise(res => {
    const m = U.modal(`<h3>${U.esc(text)}</h3><div class="row gap mt"><button class="btn btn-gold" data-ok>${okLabel || 'Ano'}</button><button class="btn btn-ghost" data-close>Zrušit</button></div>`);
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); res(true); };
    m.el.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === m.el || e.target.classList.contains('modal-x')) res(false); });
  });

  U.confetti = () => {
    const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
    const ctx = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = ['#d4af37', '#7fb069', '#f3e9d2', '#e07a2f', '#ffffff'];
    const P = Array.from({ length: 160 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 5, a: Math.random() * 6, col: cols[Math.floor(Math.random() * cols.length)] }));
    let f = 0; (function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      P.forEach(p => { p.x += p.vx; p.y += p.vy; p.a += .1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
      if (++f < 260) requestAnimationFrame(loop); else c.remove();
    })();
  };

  /* ---------- diplom (PNG) ---------- */
  U.diploma = async ({ name, cesta, durationMin, hints, date, rank }) => {
    await document.fonts.ready;
    const W = 1600, H = 1131; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#f3e9d2'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#1d3326'; x.lineWidth = 18; x.strokeRect(40, 40, W - 80, H - 80);
    x.strokeStyle = '#b8932c'; x.lineWidth = 3; x.strokeRect(70, 70, W - 140, H - 140);
    x.textAlign = 'center'; x.fillStyle = '#1d3326';
    x.font = '600 30px Montserrat, sans-serif'; x.fillText('M U F L O N Í   C E S T A', W / 2, 190);
    x.font = '700 104px "Playfair Display", Georgia, serif'; x.fillText('Diplom', W / 2, 320);
    x.font = 'italic 40px "Cormorant Garamond", Georgia, serif'; x.fillStyle = '#4a5a4f'; x.fillText('Velký Muflon tímto potvrzuje, že', W / 2, 410);
    x.font = '700 84px "Playfair Display", Georgia, serif'; x.fillStyle = '#8a6a12'; x.fillText(name, W / 2, 520, W - 260);
    x.font = 'italic 40px "Cormorant Garamond", Georgia, serif'; x.fillStyle = '#4a5a4f'; x.fillText('úspěšně dokončil(a) cestu', W / 2, 600);
    x.font = '700 64px "Playfair Display", Georgia, serif'; x.fillStyle = '#1d3326'; x.fillText(cesta.nazev, W / 2, 690, W - 260);
    x.font = '500 30px Montserrat, sans-serif'; x.fillStyle = '#1d3326';
    const parts = [`Level: ${U.LEVELS[cesta.level].label}`, `Čas: ${U.fmtDur(durationMin)}`, `Nápovědy: ${hints}`]; if (rank) parts.push(`Pořadí: ${rank}.`);
    x.fillText(parts.join('   ·   '), W / 2, 790);
    x.font = 'italic 32px "Cormorant Garamond", Georgia, serif'; x.fillText(U.fmtDate(date), W / 2, 850);
    // pečeť
    x.save(); x.translate(W - 290, H - 270); x.fillStyle = '#b8932c'; x.beginPath();
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, r = i % 2 ? 92 : 104; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
    x.fillStyle = '#1d3326'; x.beginPath(); x.arc(0, 0, 78, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#d4af37'; x.font = '700 26px Montserrat, sans-serif'; x.fillText('SPLNĚNO', 0, -14); x.font = '700 40px "Playfair Display", serif'; x.fillText('M', 0, 34); x.restore();
    x.font = 'italic 36px "Cormorant Garamond", serif'; x.fillStyle = '#1d3326'; x.textAlign = 'left'; x.fillText('Velký Muflon', 200, H - 210);
    x.strokeStyle = '#1d3326'; x.lineWidth = 2; x.beginPath(); x.moveTo(190, H - 250); x.lineTo(520, H - 250); x.stroke();
    return new Promise(r => c.toBlob(r, 'image/png'));
  };

  /* ---------- počasí (Open-Meteo, bez klíče) ---------- */
  const WMO = { 0: ['☀️', 'Jasno'], 1: ['🌤️', 'Skoro jasno'], 2: ['⛅', 'Polojasno'], 3: ['☁️', 'Zataženo'], 45: ['🌫️', 'Mlha'], 48: ['🌫️', 'Námraza'], 51: ['🌦️', 'Mrholení'], 53: ['🌦️', 'Mrholení'], 55: ['🌧️', 'Mrholení'], 61: ['🌧️', 'Déšť'], 63: ['🌧️', 'Déšť'], 65: ['🌧️', 'Silný déšť'], 71: ['🌨️', 'Sníh'], 73: ['🌨️', 'Sníh'], 75: ['❄️', 'Silný sníh'], 77: ['🌨️', 'Sněhová zrna'], 80: ['🌦️', 'Přeháňky'], 81: ['🌧️', 'Přeháňky'], 82: ['⛈️', 'Prudké přeháňky'], 85: ['🌨️', 'Sněhové přeháňky'], 86: ['🌨️', 'Sněhové přeháňky'], 95: ['⛈️', 'Bouřka'], 96: ['⛈️', 'Bouřka s kroupami'], 99: ['⛈️', 'Bouřka s kroupami'] };
  U.weather = async (coords, startIso, days) => {
    const start = new Date(startIso); const diff = (start - Date.now()) / 864e5;
    if (diff > 15 || diff < -1) return null;
    const d0 = start.toISOString().slice(0, 10); const d1 = new Date(start.getTime() + (days - 1) * 864e5).toISOString().slice(0, 10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Europe%2FPrague&start_date=${d0}&end_date=${d1}`;
    const r = await fetch(url); if (!r.ok) return null; const j = await r.json();
    return j.daily.time.map((t, i) => ({ date: t, icon: (WMO[j.daily.weather_code[i]] || ['🌡️', ''])[0], text: (WMO[j.daily.weather_code[i]] || ['', '–'])[1], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_probability_max[i], wind: j.daily.wind_speed_10m_max[i] }));
  };

  window.U = U;
})();
