/* Mufloní cesta – hlavní aplikace (hash router + pohledy) */
(async function () {
  const S = window.MCStore, C = window.MC_CONFIG, { esc, $, $$ } = U;
  const app = $('#app');
  const state = { fStatus: 'all', fLevel: 'all', galleryCesta: 'all', adminTab: 'cesty' };

  await S.initAuth();
  S.onAuth(() => { renderNav(); route(); });

  /* ================= ROUTER ================= */
  const routes = [
    [/^#?\/?$/, renderHome],
    [/^#\/cesty$/, renderHome],
    [/^#\/cesta\/([\w-]+)$/, m => renderDetail(m[1])],
    [/^#\/cesta\/([\w-]+)\/pruvodce$/, m => renderGuide(m[1])],
    [/^#\/galerie$/, renderGallery],
    [/^#\/profil$/, renderProfile],
    [/^#\/prihlaseni(?:\?next=(.*))?$/, m => renderLogin(m[1] ? decodeURIComponent(m[1]) : '')],
    [/^#\/jak-to-funguje$/, renderHow],
    [/^#\/admin$/, renderAdmin]
  ];
  async function route() {
    const h = location.hash || '#/';
    for (const [re, fn] of routes) {
      const m = h.match(re);
      if (m) { try { await fn(m); } catch (e) { console.error(e); app.innerHTML = `<section class="wrap pad"><h2>Něco se pokazilo</h2><p class="muted">${esc(e.message)}</p></section>`; } markNav(); return; }
    }
    app.innerHTML = `<section class="wrap pad center"><h1 class="display">404</h1><p>Tahle stezka nikam nevede.</p><a class="btn btn-gold" href="#/">Zpět na start</a></section>`;
  }
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); $('#nav').classList.remove('open'); });

  /* ================= NAV ================= */
  function renderNav() {
    const u = S.user();
    $('#nav').innerHTML = `<div class="wrap nav-in">
      <a class="brand" href="#/">${U.logo(34)}<span>Mufloní<br><b>cesta</b></span></a>
      <button class="burger" aria-label="Menu" onclick="document.getElementById('nav').classList.toggle('open')"><i></i><i></i><i></i></button>
      <nav class="links">
        <a href="#/cesty" data-nav="cesty">Cesty</a>
        <a href="#/galerie" data-nav="galerie">Galerie</a>
        <a href="#/jak-to-funguje" data-nav="jak-to-funguje">Jak to funguje</a>
        ${S.isAdmin() ? '<a href="#/admin" data-nav="admin">Admin</a>' : ''}
        ${u ? `<a class="btn btn-sm btn-gold" href="#/profil" data-nav="profil">${esc(u.name)}</a>` : `<a class="btn btn-sm btn-gold" href="#/prihlaseni">Přihlásit</a>`}
      </nav></div>`;
  }
  function markNav() { const k = (location.hash.split('/')[1] || '').split('?')[0]; $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === k)); }

  /* ================= SDÍLENÉ KOUSKY ================= */
  const phys = n => `<span class="phys" title="Fyzická náročnost ${n}/5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const statusPill = st => `<span class="pill pill-${st}">${st === 'live' ? '<i class="dot"></i>' : ''}${U.STATUS_LABEL[st]}</span>`;

  function card(c, counts) {
    const st = U.status(c);
    const left = c.capacity ? Math.max(0, c.capacity - (counts[c.id] || 0)) : null;
    return `<a class="card" href="#/cesta/${c.id}">
      <div class="card-cover">${U.cover(c.id, c.level)}<div class="card-tags">${U.levelBadge(c.level)}${statusPill(st)}</div></div>
      <div class="card-body">
        <div class="card-date">${U.fmtDate(c.start, { day: 'numeric', month: 'short', year: 'numeric' })} · ${esc(c.region)}</div>
        <h3>${esc(c.nazev)}</h3><p class="muted">${esc(c.podtitul || '')}</p>
        <div class="facts"><span>🥾 ${c.distanceKm} km</span><span>⏱ ${c.durationH} h</span><span>⛰ ${c.elevationM} m</span><span>${phys(c.physical)}</span></div>
        <div class="card-foot">${st === 'upcoming' ? U.countdownHTML(c.start) + (left != null ? `<small class="muted">${left ? `zbývá ${left} míst` : 'obsazeno'}</small>` : '') : st === 'live' ? '<b class="gold">Probíhá teď →</b>' : '<span class="muted">Odchoď ji zpětně →</span>'}</div>
      </div></a>`;
  }
  function loginForm(next, label) {
    return `<form class="stack" data-login data-next="${esc(next || '')}">
      <label>E-mail<input type="email" name="email" required placeholder="tvuj@email.cz" autocomplete="email"></label>
      <button class="btn btn-gold btn-block">${label || 'Pokračovat e-mailem'}</button>
      <p class="tiny muted">${S.mode === 'demo' ? 'Demo režim: přihlásíš se hned, bez ověření.' : 'Pošleme ti odkaz pro přihlášení – žádné heslo.'}</p></form>`;
  }
  function bindLogin(root) {
    $$('[data-login]', root).forEach(f => f.onsubmit = async e => {
      e.preventDefault(); const btn = f.querySelector('button'); btn.disabled = true;
      try {
        const r = await S.signIn(f.email.value);
        if (r.magicLink) f.innerHTML = `<div class="ok-box">📬 Poslali jsme ti odkaz na <b>${esc(f.email.value)}</b>. Klikni na něj a jsi přihlášen.</div>`;
        else { U.toast('Vítej, muflone!'); if (f.dataset.next) location.hash = f.dataset.next; }
      } catch (err) { U.toast(err.message, 'err'); btn.disabled = false; }
    });
  }

  /* ================= HOME ================= */
  async function renderHome() {
    const cesty = S.getCesty(); const counts = await S.regCounts();
    const next = cesty.find(c => U.status(c) === 'live') || cesty.find(c => U.status(c) === 'upcoming');
    const comps = (await S.getCompletions()).filter(c => c.isPublic !== false).slice(0, 8);
    const stats = { cesty: cesty.length, km: cesty.reduce((a, c) => a + (c.distanceKm || 0), 0), done: (await S.getCompletions()).length };

    app.innerHTML = `
    ${next ? `<section class="hero">
      <div class="hero-bg">${U.cover(next.id, next.level)}</div>
      <div class="wrap hero-in">
        <p class="eyebrow">${U.status(next) === 'live' ? 'Právě probíhá' : 'Další cesta začíná za'}</p>
        ${U.status(next) === 'upcoming' ? U.countdownHTML(next.start, true) : ''}
        <h1 class="display">${esc(next.nazev)}</h1>
        <p class="lead">${esc(next.podtitul || '')}</p>
        <div class="hero-meta">${U.levelBadge(next.level)}<span>📅 ${U.fmtDateTime(next.start)}</span><span>📍 ${esc(next.region)}</span><span>🥾 ${next.distanceKm} km</span></div>
        <div class="row gap mt"><a class="btn btn-gold btn-lg" href="#/cesta/${next.id}">Chci jít →</a><a class="btn btn-ghost btn-lg" href="#/jak-to-funguje">Jak to funguje?</a></div>
      </div></section>` : ''}

    <section class="wrap pad">
      <div class="steps">
        <div><b>1</b><h4>Přihlas se</h4><p>Vyber cestu podle levelu a přihlas se e-mailem.</p></div>
        <div><b>2</b><h4>Dostaneš start</h4><p>Uvidíš jen souřadnice startu. Nic víc.</p></div>
        <div><b>3</b><h4>Následuj deník</h4><p>Kódy z terénu odemykají další stanoviště, mapy a úkoly.</p></div>
        <div><b>4</b><h4>Fotka v cíli</h4><p>Nahraj fotku z cíle – cesta je splněná a jsi v galerii.</p></div>
      </div>
    </section>

    <section class="wrap pad" id="cesty">
      <div class="sec-head"><h2>Cesty</h2>
        <div class="filters">
          ${['all', 'upcoming', 'live', 'archive'].map(s => `<button class="chip ${state.fStatus === s ? 'on' : ''}" data-fs="${s}">${s === 'all' ? 'Vše' : U.STATUS_LABEL[s]}</button>`).join('')}
          <span class="sep"></span>
          ${['all', 'easy', 'medium', 'hard', 'hardcore'].map(l => `<button class="chip chip-${l} ${state.fLevel === l ? 'on' : ''}" data-fl="${l}">${l === 'all' ? 'Každý level' : U.LEVELS[l].label}</button>`).join('')}
        </div></div>
      <div class="grid cards" id="cardgrid"></div>
    </section>

    <section class="band"><div class="wrap stats">
      <div><b>${stats.cesty}</b><span>${U.plural(stats.cesty, 'cesta', 'cesty', 'cest')}</span></div>
      <div><b>${stats.km}</b><span>km stezek</span></div>
      <div><b>${stats.done}</b><span>dokončení</span></div>
      <div><b>4</b><span>levely</span></div></div></section>

    <section class="wrap pad">
      <div class="sec-head"><h2>Z cíle</h2><a href="#/galerie">Celá galerie →</a></div>
      ${comps.length ? `<div class="gal">${comps.map(galItem).join('')}</div>` : '<p class="muted">Zatím tu nic není. Buď první.</p>'}
    </section>

    <section class="wrap pad"><div class="newsletter">
      <div><h2>Nechceš propásnout další cestu?</h2><p class="muted">Napíšeme ti, jakmile vypíšeme novou. Max. jednou za měsíc.</p></div>
      <form class="row gap" id="nl"><input type="email" name="email" required placeholder="tvuj@email.cz"><button class="btn btn-gold">Dej mi vědět</button></form>
    </div></section>`;

    const paint = () => {
      const list = cesty.filter(c => (state.fStatus === 'all' || U.status(c) === state.fStatus) && (state.fLevel === 'all' || c.level === state.fLevel));
      // nadcházející a probíhající nahoru, archiv od nejnovější
      list.sort((a, b) => { const sa = U.status(a) === 'archive', sb = U.status(b) === 'archive'; if (sa !== sb) return sa ? 1 : -1; return sa ? new Date(b.start) - new Date(a.start) : new Date(a.start) - new Date(b.start); });
      $('#cardgrid').innerHTML = list.length ? list.map(c => card(c, counts)).join('') : '<p class="muted">Žádná cesta neodpovídá filtru.</p>';
    };
    paint();
    $$('[data-fs]').forEach(b => b.onclick = () => { state.fStatus = b.dataset.fs; $$('[data-fs]').forEach(x => x.classList.toggle('on', x === b)); paint(); });
    $$('[data-fl]').forEach(b => b.onclick = () => { state.fLevel = b.dataset.fl; $$('[data-fl]').forEach(x => x.classList.toggle('on', x === b)); paint(); });
    $('#nl').onsubmit = async e => { e.preventDefault(); try { await S.joinWaitlist(e.target.email.value); e.target.innerHTML = '<p class="gold">✓ Hotovo, ozveme se.</p>'; } catch (err) { U.toast(err.message, 'err'); } };
    bindGallery(app, comps);
    if (location.hash === '#/cesty') setTimeout(() => $('#cesty').scrollIntoView(), 30);
  }

  /* ================= DETAIL ================= */
  async function renderDetail(id) {
    const c = S.getCesta(id); if (!c) { app.innerHTML = '<section class="wrap pad"><h2>Cesta nenalezena</h2><a href="#/">Zpět</a></section>'; return; }
    const st = U.status(c), u = S.user();
    const [reg, counts, comps, ratings, progress] = await Promise.all([S.getRegistration(id), S.regCounts(), S.getCompletions(id), S.getRatings(id), S.getProgress(id)]);
    const mine = u ? comps.find(x => x.userId === u.id) : null;
    const board = comps.slice().sort((a, b) => (a.retro - b.retro) || (a.durationMin - b.durationMin)); // nejdřív průchody v termínu, pak zpětné
    const avg = ratings.length ? ratings.reduce((a, r) => a + r.stars, 0) / ratings.length : 0;
    const gearDone = S.local.get('gear_' + id, []);
    const L = U.LEVELS[c.level];

    app.innerHTML = `
    <section class="dhero"><div class="hero-bg">${U.cover(c.id, c.level)}</div>
      <div class="wrap dhero-in">
        <a class="back" href="#/cesty">← Všechny cesty</a>
        <div class="row gap wrap-row">${U.levelBadge(c.level)}${statusPill(st)}${(c.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>
        <h1 class="display">${esc(c.nazev)}</h1><p class="lead">${esc(c.podtitul || '')}</p>
        ${st === 'upcoming' ? U.countdownHTML(c.start, true) : ''}
        ${ratings.length ? `<p class="stars-line">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))} <span class="muted">${avg.toFixed(1)} (${ratings.length})</span></p>` : ''}
      </div></section>

    <section class="wrap detail">
      <div class="main">
        <div class="panel"><p class="story">${esc(c.story || '')}</p><p>${esc(c.description || '')}</p></div>

        <h2>Detaily</h2>
        <div class="specs">
          <div><span>Start</span><b>${U.fmtDateTime(c.start)}</b></div>
          <div><span>Délka trvání</span><b>${c.durationH} h${c.overnight ? ' · s přespáním' : ''}</b></div>
          <div><span>Kde</span><b>${esc(c.region)}</b><small>${esc(c.startArea)}</small></div>
          <div><span>Vzdálenost</span><b>${c.distanceKm} km</b></div>
          <div><span>Převýšení</span><b>${c.elevationM} m</b></div>
          <div><span>Fyzická náročnost</span><b>${phys(c.physical)} ${c.physical}/5</b></div>
          <div><span>Level</span><b style="color:${L.color}">${L.label}</b><small>${L.cz}</small></div>
          <div><span>Stanoviště</span><b>${c.stagesCount}</b><small>+ cíl</small></div>
          <div><span>Terén</span><b>${esc(c.terrain || '–')}</b></div>
          <div><span>Tým</span><b>${esc(c.teamSize || '1+')} lidí</b></div>
          <div><span>Min. věk</span><b>${c.minAge ? c.minAge + '+' : 'Bez omezení'}</b></div>
          <div><span>Pes</span><b>${c.dogs ? 'Ano 🐕' : 'Ne'}</b></div>
          <div><span>Noční část</span><b>${c.night ? 'Ano 🌙' : 'Ne'}</b></div>
          <div><span>Doprava</span><b>${esc(c.transport || '–')}</b></div>
          <div><span>Kapacita</span><b>${c.capacity || '∞'}</b><small>${counts[id] || 0} přihlášeno</small></div>
          <div><span>Cena</span><b>${esc(c.price || 'Zdarma')}</b></div>
        </div>

        <div class="two">
          <div class="panel"><h3>Co s sebou <small class="muted">(odškrtávej)</small></h3>
            <ul class="check">${(c.gear || []).map((g, i) => `<li><label><input type="checkbox" data-gear="${i}" ${gearDone.includes(i) ? 'checked' : ''}> ${esc(g)}</label></li>`).join('')}</ul>
            <div class="bar"><i style="width:${c.gear && c.gear.length ? gearDone.length / c.gear.length * 100 : 0}%"></i></div></div>
          <div class="panel"><h3>Co je potřeba</h3><ul class="dots">${(c.requirements || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
            <h3 class="mt">Bezpečnost</h3><ul class="dots">${(c.safety || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
        </div>

        <div id="weather"></div>

        <h2>Síň slávy</h2>
        ${board.length ? `<table class="table"><thead><tr><th>#</th><th>Tým</th><th>Čas</th><th>Nápovědy</th><th>Datum</th></tr></thead><tbody>
          ${board.map((b, i) => `<tr class="${u && b.userId === u.id ? 'me' : ''}"><td>${i < 3 && !b.retro ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${esc(b.name)} ${b.retro ? '<span class="tag">zpětně</span>' : ''}</td><td>${U.fmtDur(b.durationMin)}</td><td>${b.hints || 0}</td><td>${U.fmtDate(b.createdAt, { day: 'numeric', month: 'numeric', year: 'numeric' })}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted">Zatím nikdo nedošel do cíle.</p>'}

        ${comps.length ? `<h2>Fotky z cíle</h2><div class="gal">${comps.filter(x => x.isPublic !== false).map(galItem).join('')}</div>` : ''}

        <h2>Hodnocení</h2>
        ${mine ? `<form class="panel stack" id="rate"><div class="rate-stars">${[5, 4, 3, 2, 1].map(n => `<label><input type="radio" name="s" value="${n}" ${n === 5 ? 'checked' : ''}><span>★</span></label>`).join('')}</div><textarea name="t" rows="2" placeholder="Jak se ti cesta líbila?"></textarea><button class="btn btn-sm btn-gold">Odeslat hodnocení</button></form>` : ''}
        ${ratings.length ? ratings.map(r => `<div class="review"><b>${esc(r.name)}</b> <span class="gold">${'★'.repeat(r.stars)}</span><p>${esc(r.text || '')}</p></div>`).join('') : (mine ? '' : `<p class="muted">Hodnotit můžou ti, kdo cestu dokončili.</p>`)}
      </div>

      <aside class="side"><div class="regbox" id="regbox">${regBox(c, st, u, reg, mine, counts, progress)}</div>
        <div class="panel tiny-panel"><button class="btn btn-ghost btn-block" data-share="${id}">↗ Pozvat kamaráda</button></div></aside>
    </section>`;

    bindRegBox(c, reg, progress, mine, board);
    bindGallery(app, comps);
    $$('[data-gear]').forEach(cb => cb.onchange = () => {
      const v = $$('[data-gear]').filter(x => x.checked).map(x => +x.dataset.gear); S.local.set('gear_' + id, v);
      cb.closest('.panel').querySelector('.bar i').style.width = (v.length / c.gear.length * 100) + '%';
    });
    const rf = $('#rate'); if (rf) rf.onsubmit = async e => { e.preventDefault(); await S.rate(id, +rf.s.value, rf.t.value); U.toast('Díky za hodnocení!'); route(); };

    if (st !== 'archive') U.weather(c.startCoords, c.start, Math.min(3, Math.ceil(c.durationH / 24) || 1)).then(w => {
      if (!w || !$('#weather')) return;
      $('#weather').innerHTML = `<h2>Předpověď na start</h2><div class="weather">${w.map(d => `<div><span class="wi">${d.icon}</span><b>${U.fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'numeric' })}</b><span>${Math.round(d.min)}° / ${Math.round(d.max)}°</span><small>${d.text} · ☔ ${d.rain ?? 0}% · 💨 ${Math.round(d.wind)} km/h</small></div>`).join('')}</div><p class="tiny muted">Zdroj: Open-Meteo</p>`;
    }).catch(() => { });
  }

  function regBox(c, st, u, reg, mine, counts, progress) {
    const full = c.capacity && (counts[c.id] || 0) >= c.capacity;
    const revealAt = new Date(c.start).getTime() - (C.REVEAL_START_HOURS || 0) * 36e5;
    const showStart = !C.REVEAL_START_HOURS || Date.now() >= revealAt || st !== 'upcoming';
    if (mine) return `<div class="done-badge">🏆</div><h3>Splněno!</h3><p class="muted">Došel jsi do cíle za <b>${U.fmtDur(mine.durationMin)}</b>.</p>
      <img class="done-photo" src="${esc(mine.photo)}" alt="Fotka z cíle"><button class="btn btn-gold btn-block" data-diploma>Stáhnout diplom</button>
      <a class="btn btn-ghost btn-block" href="#/cesta/${c.id}/pruvodce">Znovu projít deník</a>`;
    if (!u) return `<h3>${st === 'archive' ? 'Odchoď ji zpětně' : 'Přihlas se na cestu'}</h3>
      <p class="muted">${st === 'archive' ? 'Cesta už proběhla, ale stanoviště zůstala. Projdi ji kdykoliv.' : 'Po přihlášení uvidíš souřadnice startu.'}</p>${loginForm('#/cesta/' + c.id)}`;
    if (!reg) {
      if (st !== 'archive' && full) return `<h3>Obsazeno</h3><p class="muted">Kapacita je plná. Dej nám e-mail – když se uvolní místo, napíšeme.</p>
        <form class="stack" id="wl"><input type="email" name="email" required value="${esc(u.email)}"><button class="btn btn-gold btn-block">Na čekací listinu</button></form>`;
      return `<h3>${st === 'archive' ? 'Odchodit zpětně' : 'Přihláška'}</h3>
        <form class="stack" id="regf">
          <label>Jméno týmu / tvoje jméno<input name="team" required maxlength="40" value="${esc(u.name)}"></label>
          <label>Kolik vás půjde<select name="size">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option ${n === 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="cb"><input type="checkbox" required> Beru na vědomí, že jdu na vlastní nebezpečí a přečetl jsem <a href="#/jak-to-funguje" target="_blank">pravidla</a>.</label>
          <button class="btn btn-gold btn-block btn-lg">${st === 'archive' ? 'Jdu na to' : 'Přihlásit se'}</button>
          ${c.capacity && st !== 'archive' ? `<p class="tiny muted center">Volných míst: ${c.capacity - (counts[c.id] || 0)} z ${c.capacity}</p>` : ''}
        </form>`;
    }
    const startBlock = showStart ? `<div class="startbox"><span class="eyebrow">Start</span><b>${esc(c.startArea)}</b><code>${U.fmtCoords(c.startCoords)}</code>${U.mapLinks(c.startCoords)}${c.meetingNote ? `<p class="tiny">${esc(c.meetingNote)}</p>` : ''}</div>`
      : `<div class="startbox"><span class="eyebrow">Start</span><p>Souřadnice odhalíme ${U.fmtDateTime(revealAt)}.</p></div>`;
    const tools = `<div class="row gap wrap-row mt"><button class="btn btn-sm" data-denik>⬇ Deník (offline)</button><button class="btn btn-sm" data-gpx>⬇ GPX</button>${st === 'upcoming' ? '<button class="btn btn-sm" data-ics>📅 Do kalendáře</button>' : ''}</div>`;
    const done = progress.codes.length;
    if (st === 'upcoming') return `<div class="ok-box">✓ Jsi přihlášen jako <b>${esc(reg.team)}</b> (${reg.size} os.)</div>${startBlock}
      <p class="muted center mt">Průvodce se odemkne za</p>${U.countdownHTML(c.start)}${tools}
      <button class="btn btn-link tiny" data-unreg>Odhlásit se</button>`;
    return `<div class="ok-box">✓ ${esc(reg.team)}${reg.retro ? ' · zpětně' : ''}</div>${startBlock}
      <a class="btn btn-gold btn-block btn-lg mt" href="#/cesta/${c.id}/pruvodce">${done ? `Pokračovat (${Math.min(done, c.stagesCount)}/${c.stagesCount})` : 'Otevřít průvodce'} →</a>${tools}`;
  }

  function bindRegBox(c, reg, progress, mine, board) {
    const box = $('#regbox'); bindLogin(box);
    const f = $('#regf', box);
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      try { await S.register(c.id, { team: f.team.value.trim(), size: f.size.value, retro: U.status(c) === 'archive' }); U.toast('Jsi přihlášen! 🐏'); U.confetti(); route(); }
      catch (err) { U.toast(err.message, 'err'); }
    };
    const wl = $('#wl', box); if (wl) wl.onsubmit = async e => { e.preventDefault(); await S.joinWaitlist(wl.email.value, c.id); wl.innerHTML = '<p class="gold">✓ Jsi na čekací listině.</p>'; };
    const un = $('[data-unreg]', box); if (un) un.onclick = async () => { if (await U.confirm('Opravdu se odhlásit z cesty?', 'Odhlásit')) { await S.unregister(c.id); route(); } };
    const ics = $('[data-ics]', box); if (ics) ics.onclick = () => U.download(c.id + '.ics', U.ics(c), 'text/calendar');
    const gpx = $('[data-gpx]', box); if (gpx) gpx.onclick = async () => {
      const pts = [{ ...c.startCoords, name: 'Start – ' + c.startArea }];
      const dec = await decryptAll(c, progress.codes);
      dec.stages.forEach((s, i) => s.nav && s.nav.coords && pts.push({ ...s.nav.coords, name: `Stanoviště ${i + 2}` }));
      if (dec.finale && dec.finale.coords) pts.push({ ...dec.finale.coords, name: 'Cíl' });
      U.download(c.id + '.gpx', U.gpx(c.nazev, pts), 'application/gpx+xml'); U.toast('GPX obsahuje jen body, které máš odemčené.');
    };
    const dn = $('[data-denik]', box); if (dn) dn.onclick = () => { U.download(`denik-${c.id}.html`, MCDenik.build(c, progress, reg), 'text/html'); U.toast('Deník stažen – otevři ho v telefonu, funguje i offline.'); };
    const dp = $('[data-diploma]', box); if (dp) dp.onclick = async () => {
      const rank = board.findIndex(b => b.id === mine.id) + 1;
      U.download(`diplom-${c.id}.png`, await U.diploma({ name: mine.name, cesta: c, durationMin: mine.durationMin, hints: mine.hints || 0, date: mine.createdAt, rank }));
    };
  }

  /* ================= PRŮVODCE ================= */
  async function decryptAll(c, codes) {
    const out = { stages: [], finale: null, valid: 0 };
    const P = c.bundle.parts, N = c.bundle.n;
    for (let i = 0; i <= N && codes[i]; i++) {
      const d = await MCCrypto.decryptPart(P[i], codes[i], c.bundle.iter);
      if (!d) break;
      if (i < N) out.stages.push(d); else out.finale = d;
      out.valid = i + 1;
    }
    return out;
  }

  async function renderGuide(id) {
    const c = S.getCesta(id); if (!c) return route404();
    const u = S.user();
    if (!u) { location.hash = '#/prihlaseni?next=' + encodeURIComponent('#/cesta/' + id + '/pruvodce'); return; }
    const reg = await S.getRegistration(id);
    if (!reg) { U.toast('Nejdřív se na cestu přihlas.'); location.hash = '#/cesta/' + id; return; }
    const st = U.status(c);
    if (st === 'upcoming') {
      app.innerHTML = `<section class="wrap pad center guide-wait">${U.logo(80)}<h1 class="display">${esc(c.nazev)}</h1><p class="lead">Průvodce se otevře v den startu.</p>${U.countdownHTML(c.start, true)}
        <div class="startbox left">${'<span class="eyebrow">Start</span>'}<b>${esc(c.startArea)}</b><code>${U.fmtCoords(c.startCoords)}</code>${U.mapLinks(c.startCoords)}</div>
        <a class="btn btn-ghost mt" href="#/cesta/${id}">← Zpět na detail</a></section>`;
      return;
    }
    let progress = await S.getProgress(id);
    const N = c.bundle.n;
    const dec = await decryptAll(c, progress.codes);
    if (dec.valid !== progress.codes.length) { progress.codes = progress.codes.slice(0, dec.valid); await S.saveProgress(id, progress); }
    const unlocked = dec.valid; // 0 = nic, N+1 = cíl
    const comps = await S.getCompletions(id);
    const mine = comps.find(x => x.userId === u.id);

    const stepDots = Array.from({ length: N + 2 }, (_, i) => {
      const label = i === 0 ? 'Start' : i === N + 1 ? 'Cíl' : i;
      const done = i < unlocked || (i === N + 1 && mine);
      return `<li class="${done ? 'done' : ''} ${i === unlocked && !mine ? 'cur' : ''}"><span>${label}</span></li>`;
    }).join('');

    const stageCard = (s, i) => {
      const hintUsed = (progress.hints || []).includes(i);
      const isCurrent = i === unlocked - 1 && unlocked <= N;
      return `<details class="stage" ${isCurrent ? 'open' : ''}><summary><span class="snum">${i + 1}</span><span>${esc(s.title)}</span>${isCurrent ? '<span class="pill pill-live">teď</span>' : '<span class="muted">✓</span>'}</summary>
        <div class="stage-body"><p class="diary">„${esc(s.story)}“</p>
        <h4>Úkol</h4><p>${esc(s.task)}</p>
        ${s.nav ? `<h4>Cesta dál</h4>${s.nav.note ? `<p>${esc(s.nav.note)}</p>` : ''}${s.nav.riddle ? `<p class="riddle">${esc(s.nav.riddle)}</p>` : ''}${s.nav.coords ? `<code>${U.fmtCoords(s.nav.coords)}</code>${U.mapLinks(s.nav.coords)}${isCurrent ? U.mapEmbed(s.nav.coords) : ''}` : ''}` : ''}
        <div class="codeprompt">🔎 ${esc(s.codePrompt)}</div>
        ${s.hint ? (hintUsed ? `<div class="hintbox">💡 ${esc(s.hint)}</div>` : (isCurrent ? `<button class="btn btn-sm btn-ghost" data-hint="${i}" data-pen="${s.hintPenaltyMin || 0}">💡 Nápověda (+${s.hintPenaltyMin || 0} min)</button>` : '')) : ''}
        </div></details>`;
    };

    const finale = dec.finale;
    app.innerHTML = `
    <section class="guide wrap">
      <div class="guide-head"><a class="back" href="#/cesta/${id}">← ${esc(c.nazev)}</a>
        <div class="row gap">${progress.startedAt && !mine ? `<span class="timer">⏱ <b data-elapsed="${progress.startedAt}">${U.fmtDur((Date.now() - new Date(progress.startedAt)) / 6e4)}</b></span>` : ''}
        <button class="btn btn-sm" data-denik2>⬇ Offline deník</button></div></div>
      <ol class="track">${stepDots}</ol>

      <details class="stage" ${unlocked === 0 ? 'open' : ''}><summary><span class="snum">S</span><span>Start – ${esc(c.startArea)}</span>${unlocked === 0 ? '<span class="pill pill-live">teď</span>' : '<span class="muted">✓</span>'}</summary>
        <div class="stage-body"><code>${U.fmtCoords(c.startCoords)}</code>${U.mapLinks(c.startCoords)}${unlocked === 0 ? U.mapEmbed(c.startCoords) : ''}
        ${c.meetingNote ? `<p>${esc(c.meetingNote)}</p>` : ''}<div class="codeprompt">🔎 ${esc(c.startPrompt)}</div></div></details>

      ${dec.stages.map(stageCard).join('')}

      ${unlocked <= N ? `<form class="unlock" id="unlock">
          <label>${unlocked === 0 ? 'Startovní kód' : `Kód ze stanoviště ${unlocked}`}</label>
          <div class="row gap"><input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="KÓD" required><button class="btn btn-gold">Odemknout</button></div>
          <p class="tiny muted">Na velikosti písmen ani diakritice nezáleží.</p></form>` : ''}

      ${finale ? `<div class="finale panel"><span class="eyebrow">Cíl</span><h2>${esc(finale.title)}</h2><p class="diary">„${esc(finale.story)}“</p>
          ${finale.coords ? `<code>${U.fmtCoords(finale.coords)}</code>${U.mapLinks(finale.coords)}` : ''}
          <h4>Poslední úkol</h4><p>${esc(finale.photoTask)}</p>
          ${mine ? `<div class="ok-box">🏆 Splněno za ${U.fmtDur(mine.durationMin)}. <a href="#/cesta/${id}">Zobrazit v síni slávy →</a></div><img class="done-photo" src="${esc(mine.photo)}" alt="">`
          : `<form class="stack" id="finish">
              <label class="upload"><input type="file" name="photo" accept="image/*" capture="environment" required><span id="upl">📷 Vyfotit / vybrat fotku z cíle</span></label>
              <img id="prev" class="done-photo hidden" alt="">
              <label>Jméno do síně slávy<input name="name" required maxlength="40" value="${esc(reg.team || u.name)}"></label>
              <label>Vzkaz (nepovinné)<input name="note" maxlength="140" placeholder="Jak to šlo?"></label>
              <label class="cb"><input type="checkbox" name="pub" checked> Zobrazit fotku ve veřejné galerii</label>
              <button class="btn btn-gold btn-lg btn-block">Nahrát a dokončit cestu 🏁</button></form>`}
        </div>` : ''}
    </section>
    <button class="sos" id="sos" aria-label="Nouze">SOS</button>`;

    const uf = $('#unlock');
    if (uf) {
      setTimeout(() => uf.code.focus({ preventScroll: true }), 50);
      uf.onsubmit = async e => {
        e.preventDefault(); const btn = uf.querySelector('button'); btn.disabled = true; btn.textContent = 'Ověřuji…';
        const ok = await MCCrypto.decryptPart(c.bundle.parts[unlocked], uf.code.value, c.bundle.iter);
        if (!ok) { btn.disabled = false; btn.textContent = 'Odemknout'; uf.classList.remove('shake'); void uf.offsetWidth; uf.classList.add('shake'); U.toast('Tenhle kód nesedí.', 'err'); return; }
        progress.codes[unlocked] = MCCrypto.norm(uf.code.value);
        if (!progress.startedAt) progress.startedAt = new Date().toISOString();
        await S.saveProgress(id, progress);
        U.toast(unlocked === N ? 'Cíl odemčen! 🏁' : `Stanoviště ${unlocked + 1} odemčeno!`); if (unlocked === N) U.confetti();
        await renderGuide(id);
        const t = unlocked === N ? $('.finale') : $$('.stage')[unlocked + 1]; t && t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }
    $$('[data-hint]').forEach(b => b.onclick = async () => {
      if (!await U.confirm(`Nápověda přidá ${b.dataset.pen} min k tvému času. Chceš ji?`, 'Ukázat nápovědu')) return;
      progress.hints = (progress.hints || []).concat(+b.dataset.hint); progress.penalty = (progress.penalty || 0) + (+b.dataset.pen);
      await S.saveProgress(id, progress); renderGuide(id);
    });
    const ff = $('#finish');
    if (ff) {
      ff.photo.onchange = () => { const f = ff.photo.files[0]; if (!f) return; $('#prev').src = URL.createObjectURL(f); $('#prev').classList.remove('hidden'); $('#upl').textContent = '📷 Změnit fotku'; };
      ff.onsubmit = async e => {
        e.preventDefault(); const btn = ff.querySelector('button'); btn.disabled = true; btn.textContent = 'Nahrávám…';
        try {
          const started = progress.startedAt ? new Date(progress.startedAt) : new Date();
          const durationMin = Math.round((Date.now() - started) / 6e4) + (progress.penalty || 0);
          await S.complete(id, ff.photo.files[0], { name: ff.name.value.trim(), note: ff.note.value.trim(), durationMin, hints: (progress.hints || []).length, retro: !!reg.retro, isPublic: ff.pub.checked });
          U.confetti(); U.toast('Cesta splněna! 🏆');
          setTimeout(() => location.hash = '#/cesta/' + id, 900);
        } catch (err) { U.toast('Nahrání selhalo: ' + err.message, 'err'); btn.disabled = false; btn.textContent = 'Nahrát a dokončit cestu 🏁'; }
      };
    }
    $('[data-denik2]').onclick = () => U.download(`denik-${c.id}.html`, MCDenik.build(c, progress, reg), 'text/html');
    $('#sos').onclick = sosModal;
  }
  function route404() { app.innerHTML = '<section class="wrap pad"><h2>Cesta nenalezena</h2><a href="#/">Zpět</a></section>'; }

  function sosModal() {
    const o = C.ORGANIZER;
    const m = U.modal(`<h2>🆘 Nouze</h2>
      <a class="btn btn-danger btn-block btn-lg" href="tel:112">Volat 112</a>
      <a class="btn btn-block mt" href="tel:1210">Horská služba 1210</a>
      <a class="btn btn-block mt" href="tel:${esc(o.phone)}">Organizátor ${esc(o.phone)}</a>
      <div class="panel mt"><b>Moje poloha</b><p id="geo" class="muted">Zjišťuji…</p></div>
      <p class="tiny muted">Při volání řekni: kdo jsi, co se stalo, kde jsi (souřadnice výše), kolik lidí je zraněno.</p>`);
    if (!navigator.geolocation) { $('#geo', m.el).textContent = 'Poloha není dostupná.'; return; }
    navigator.geolocation.getCurrentPosition(p => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude }; const t = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
      $('#geo', m.el).innerHTML = `<code>${t}</code> <span class="tiny">±${Math.round(p.coords.accuracy)} m</span>
        <div class="row gap mt"><button class="btn btn-sm" data-copy="${t}">Kopírovat</button><a class="btn btn-sm" href="sms:${esc(o.phone)}?&body=${encodeURIComponent('Mufloní cesta – potřebuju pomoc. Poloha: ' + t + ' https://mapy.com/fnc/v1/showmap?center=' + c.lng + ',' + c.lat + '&zoom=17&marker=true')}">Poslat SMS organizátorovi</a></div>`;
    }, () => $('#geo', m.el).textContent = 'Nepodařilo se získat polohu – povol ji v prohlížeči.', { enableHighAccuracy: true, timeout: 15000 });
  }

  /* ================= GALERIE ================= */
  function galItem(x) {
    const c = S.getCesta(x.cestaId);
    return `<figure class="gal-item" data-photo="${esc(x.id)}"><img loading="lazy" src="${esc(x.photo)}" alt="${esc(x.name)}"><figcaption><b>${esc(x.name)}</b><span>${c ? esc(c.nazev) : ''}</span></figcaption></figure>`;
  }
  function bindGallery(root, list) {
    $$('[data-photo]', root).forEach(el => el.onclick = () => {
      const x = list.find(p => p.id === el.dataset.photo); if (!x) return; const c = S.getCesta(x.cestaId);
      U.modal(`<img class="lb-img" src="${esc(x.photo)}" alt=""><h3>${esc(x.name)}</h3><p class="muted">${c ? `<a href="#/cesta/${c.id}" data-close>${esc(c.nazev)}</a> · ` : ''}${U.fmtDate(x.createdAt)} · ${U.fmtDur(x.durationMin)}${x.retro ? ' · zpětně' : ''}</p>${x.note ? `<p class="diary">„${esc(x.note)}“</p>` : ''}`, 'modal-wide');
    });
  }
  async function renderGallery() {
    const all = (await S.getCompletions()).filter(c => c.isPublic !== false);
    const cesty = S.getCesty().filter(c => all.some(x => x.cestaId === c.id));
    const paint = () => {
      const l = state.galleryCesta === 'all' ? all : all.filter(x => x.cestaId === state.galleryCesta);
      $('#galgrid').innerHTML = l.length ? l.map(galItem).join('') : '<p class="muted">Žádné fotky.</p>'; bindGallery(app, l);
    };
    app.innerHTML = `<section class="wrap pad"><p class="eyebrow">Galerie</p><h1 class="display">Kdo došel do cíle</h1>
      <p class="lead">Každá fotka = jedna splněná cesta.</p>
      <div class="filters mt"><button class="chip ${state.galleryCesta === 'all' ? 'on' : ''}" data-g="all">Všechny (${all.length})</button>
      ${cesty.map(c => `<button class="chip ${state.galleryCesta === c.id ? 'on' : ''}" data-g="${c.id}">${esc(c.nazev)} (${all.filter(x => x.cestaId === c.id).length})</button>`).join('')}</div>
      <div class="gal gal-big mt" id="galgrid"></div></section>`;
    $$('[data-g]').forEach(b => b.onclick = () => { state.galleryCesta = b.dataset.g; $$('[data-g]').forEach(x => x.classList.toggle('on', x === b)); paint(); });
    paint();
  }

  /* ================= PROFIL ================= */
  const RANKS = [[0, 'Kůzle'], [200, 'Mladý muflon'], [600, 'Muflon'], [1200, 'Starý muflon'], [2500, 'Velký Muflon']];
  const BADGES = [
    { id: 'first', icon: '👣', name: 'První stopa', desc: 'Dokonči první cestu', test: d => d.comps.length >= 1 },
    { id: 'easy', icon: '🌿', name: 'Pohodář', desc: 'Dokonči Easy cestu', test: d => d.levels.has('easy') },
    { id: 'medium', icon: '🌲', name: 'Lesák', desc: 'Dokonči Medium cestu', test: d => d.levels.has('medium') },
    { id: 'hard', icon: '⛰️', name: 'Horal', desc: 'Dokonči Hard cestu', test: d => d.levels.has('hard') },
    { id: 'hardcore', icon: '🔥', name: 'Hardcore', desc: 'Dokonči Hardcore cestu', test: d => d.levels.has('hardcore') },
    { id: 'nohint', icon: '🧠', name: 'Bez nápovědy', desc: 'Dokonči cestu bez jediné nápovědy', test: d => d.comps.some(c => !c.hints) },
    { id: 'night', icon: '🌙', name: 'Noční tvor', desc: 'Dokonči cestu s noční částí', test: d => d.comps.some(c => (S.getCesta(c.cestaId) || {}).night) },
    { id: 'retro', icon: '📜', name: 'Archivář', desc: 'Odchoď cestu zpětně', test: d => d.comps.some(c => c.retro) },
    { id: 'three', icon: '🐏', name: 'Věrný muflon', desc: 'Dokonči 3 cesty', test: d => d.comps.length >= 3 },
    { id: 'all4', icon: '👑', name: 'Všechny levely', desc: 'Dokonči cestu v každém levelu', test: d => d.levels.size === 4 }
  ];
  async function renderProfile() {
    const u = S.user(); if (!u) { location.hash = '#/prihlaseni?next=' + encodeURIComponent('#/profil'); return; }
    const [regs, comps] = await Promise.all([S.myRegistrations(), S.myCompletions()]);
    const levels = new Set(comps.map(c => (S.getCesta(c.cestaId) || {}).level).filter(Boolean));
    const xp = comps.reduce((a, c) => { const ce = S.getCesta(c.cestaId); return a + Math.max(20, (C.XP[ce ? ce.level : 'easy'] || 100) - (c.hints || 0) * C.XP_HINT_PENALTY); }, 0);
    let ri = 0; RANKS.forEach((r, i) => { if (xp >= r[0]) ri = i; });
    const nextR = RANKS[ri + 1];
    const pct = nextR ? (xp - RANKS[ri][0]) / (nextR[0] - RANKS[ri][0]) * 100 : 100;
    const d = { comps, levels };
    const myCesty = regs.map(r => ({ r, c: S.getCesta(r.cestaId), done: comps.find(x => x.cestaId === r.cestaId) })).filter(x => x.c).sort((a, b) => new Date(b.c.start) - new Date(a.c.start));

    app.innerHTML = `<section class="wrap pad profile">
      <div class="prof-head panel"><div class="avatar">${U.logo(56)}</div>
        <div class="grow"><p class="eyebrow">${RANKS[ri][1]}</p><h1>${esc(u.name)}</h1><p class="muted tiny">${esc(u.email)}</p>
          <div class="xp"><div class="bar"><i style="width:${pct}%"></i></div><small>${xp} XP${nextR ? ` · do „${nextR[1]}“ zbývá ${nextR[0] - xp}` : ' · maximum!'}</small></div></div>
        <div class="stack"><button class="btn btn-sm" id="rename">Změnit jméno</button><button class="btn btn-sm btn-ghost" id="logout">Odhlásit</button></div></div>

      <h2>Odznaky <small class="muted">${BADGES.filter(b => b.test(d)).length}/${BADGES.length}</small></h2>
      <div class="badges">${BADGES.map(b => { const on = b.test(d); return `<div class="badge ${on ? 'on' : ''}" title="${esc(b.desc)}"><span>${b.icon}</span><b>${b.name}</b><small>${b.desc}</small></div>`; }).join('')}</div>

      <h2>Moje cesty</h2>
      ${myCesty.length ? `<div class="mylist">${myCesty.map(({ r, c, done }) => `<a class="myrow" href="#/cesta/${c.id}">
        <div class="mini-cover">${U.cover(c.id, c.level)}</div>
        <div class="grow"><b>${esc(c.nazev)}</b><small class="muted">${U.fmtDate(c.start)} · ${esc(r.team)}${r.retro ? ' · zpětně' : ''}</small></div>
        ${done ? `<span class="pill pill-done">🏆 ${U.fmtDur(done.durationMin)}</span>` : statusPill(U.status(c))}</a>`).join('')}</div>`
        : `<div class="panel center"><p>Ještě nejsi přihlášený na žádnou cestu.</p><a class="btn btn-gold" href="#/cesty">Vybrat cestu</a></div>`}
    </section>`;
    $('#logout').onclick = async () => { await S.signOut(); location.hash = '#/'; };
    $('#rename').onclick = () => {
      const m = U.modal(`<h3>Jméno</h3><form class="stack" id="rn"><input name="n" value="${esc(u.name)}" maxlength="40" required><button class="btn btn-gold">Uložit</button></form>`);
      $('#rn', m.el).onsubmit = async e => { e.preventDefault(); await S.setName(e.target.n.value); m.close(); };
    };
  }

  /* ================= PŘIHLÁŠENÍ ================= */
  async function renderLogin(next) {
    if (S.user()) { location.hash = next || '#/profil'; return; }
    app.innerHTML = `<section class="wrap pad narrow center">${U.logo(72)}<h1 class="display">Přihlášení</h1><p class="lead">Bez hesla. Jen e-mail.</p><div class="panel left">${loginForm(next || '#/profil')}</div></section>`;
    bindLogin(app);
  }

  /* ================= JAK TO FUNGUJE ================= */
  async function renderHow() {
    const faq = [
      ['Co když kód nenajdu?', 'Každé stanoviště má nápovědu. Použití nápovědy přidá k tvému času pár minut (penalizace se ukáže předem).'],
      ['Potřebuju signál?', 'Ne. Stáhni si offline deník (HTML soubor) – funguje v telefonu i bez internetu. Fotku nahraješ, až budeš mít signál.'],
      ['Můžu jít cestu, která už proběhla?', 'Ano! Každá cesta zůstává v archivu. Kódy jsou na místech, která nezmizí (cedule, kříže, rozcestníky). Zpětné průchody se v síni slávy značí „zpětně“.'],
      ['Jak se počítá čas?', 'Od zadání startovního kódu do nahrání fotky z cíle + penalizace za nápovědy.'],
      ['Můžu jít sám?', 'Na Easy a Medium ano. Na Hard a Hardcore jen v týmu – kvůli bezpečnosti.'],
      ['Jak to, že nejde podvádět?', 'Každé stanoviště je zašifrované kódem z terénu. Bez kódu ho nepřečte ani nikdo, kdo by se díval do zdrojového kódu webu.'],
      ['Co s fotkou?', 'Fotka z cíle je důkaz, že jsi došel. Můžeš ji skrýt z veřejné galerie – v síni slávy budeš i tak.']
    ];
    app.innerHTML = `<section class="wrap pad narrow">
      <p class="eyebrow">Jak to funguje</p><h1 class="display">Následuj Velkého Muflona</h1>
      <p class="lead">Mufloní cesta je venkovní hra – něco mezi bojovkou, geocachingem a survivalem. Každá cesta má příběh, stanoviště, úkoly a cíl, kde se vyfotíš.</p>
      <ol class="how">
        <li><b>Vyber cestu</b> podle levelu, termínu a fyzické náročnosti. U každé vidíš délku, převýšení, terén a co s sebou.</li>
        <li><b>Přihlas se e-mailem.</b> Hned uvidíš souřadnice startu – nic víc.</li>
        <li><b>V den startu</b> se odemkne průvodce. Na startu najdeš první kód.</li>
        <li><b>Každý kód odemkne další stanoviště</b>: příběh z deníku, úkol, souřadnice, hádanku nebo mapu.</li>
        <li><b>V cíli se vyfoť</b> a nahraj fotku. Cesta je splněná, dostaneš odznak, XP a diplom.</li>
      </ol>
      <h2>Levely</h2>
      <div class="levels">${Object.entries(U.LEVELS).map(([k, L]) => `<div class="lvlcard" style="--c:${L.color}">${U.levelBadge(k)}<p>${{ easy: 'Do 10 km, zpevněné cesty, pro rodiny a začátečníky. Jednoduché hádanky.', medium: '10–20 km, les a kopce. Buzola se hodí, úkoly chtějí přemýšlet.', hard: '15–30 km, noc nebo přespání, náročnější terén a fyzické výzvy.', hardcore: '40+ km, 24 h, hory, noc bez spánku. Jen pro zkušené.' }[k]}</p></div>`).join('')}</div>
      <h2>Pravidla</h2>
      <ul class="dots">
        <li>Jdeš na vlastní nebezpečí. Respektuj přírodu, majetek a zákazy vstupu.</li>
        <li>Stanoviště neničíme a kódy nesdílíme s jinými týmy.</li>
        <li>Žádný odpad v přírodě. Oheň jen tam, kde je to povolené.</li>
        <li>Děti do 15 let jen s dospělým.</li>
        <li>Při bouřce, zranění nebo únavě cestu přeruš – průvodce si pamatuje, kde jsi skončil.</li>
      </ul>
      <h2>Časté otázky</h2>
      <div class="faq">${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
      <div class="panel mt center"><p>Máš nápad na cestu nebo dotaz?</p><a class="btn btn-gold" href="mailto:${esc(C.ORGANIZER.email)}">${esc(C.ORGANIZER.email)}</a></div>
    </section>`;
  }

  /* ================= ADMIN ================= */
  const TEMPLATE = {
    id: 'nova-cesta', nazev: 'Nová cesta', podtitul: '', level: 'easy', start: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 16) + ':00+01:00',
    durationH: 4, region: '', startArea: '', startCoords: { lat: 49.7477, lng: 13.3776 }, startPrompt: 'Kde na startu najdou první kód…', meetingNote: '',
    distanceKm: 10, elevationM: 100, physical: 2, terrain: '', capacity: 30, price: 'Zdarma', minAge: 0, teamSize: '1–5', dogs: true, overnight: false, night: false, transport: '',
    tags: [], description: '', story: '', gear: [], requirements: [], safety: [],
    stages: [{ title: 'Stanoviště 1', story: 'Úryvek z Muflonova deníku…', task: 'Co mají udělat', nav: { coords: { lat: 49.75, lng: 13.38 }, note: 'Jak se dostat dál', riddle: '' }, codePrompt: 'Kde najdou kód pro další stanoviště', hint: 'Nápověda', hintPenaltyMin: 10 }],
    finale: { title: 'Cíl', story: 'Text v cíli', coords: { lat: 49.76, lng: 13.39 }, photoTask: 'Co má být na fotce' },
    codes: ['STARTKOD', 'KOD1']
  };
  async function renderAdmin() {
    if (!S.isAdmin()) { app.innerHTML = `<section class="wrap pad narrow"><h2>Admin</h2><p class="muted">Sem má přístup jen organizátor (e-mail v js/config.js → ADMIN_EMAILS).</p>${S.user() ? '' : loginForm('#/admin')}</section>`; bindLogin(app); return; }
    const tab = state.adminTab;
    app.innerHTML = `<section class="wrap pad admin"><p class="eyebrow">Admin · režim ${S.mode}</p><h1 class="display">Správa</h1>
      <div class="filters">${[['cesty', 'Cesty'], ['regs', 'Přihlášky'], ['photos', 'Fotky'], ['wl', 'Odběr novinek']].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="atab" class="mt"></div></section>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { state.adminTab = b.dataset.tab; renderAdmin(); });
    const box = $('#atab');

    if (tab === 'cesty') {
      const src = S.local.get('admin_src', null);
      box.innerHTML = `<div class="panel stack">
        <p>Tady upravuješ <b>zdroj cest</b> (i s kódy a etapami). Po sestavení se etapy zašifrují a stáhneš <code>data/cesty.js</code> – ten nahraď v projektu a dej Sync. Zdroj s kódy patří do <code>private/cesty-src.json</code> (na GitHub se nenahrává).</p>
        <div class="row gap wrap-row"><label class="btn btn-sm">📂 Načíst cesty-src.json<input type="file" id="srcfile" accept=".json" hidden></label>
          <button class="btn btn-sm" id="addtpl">+ Přidat novou cestu (šablona)</button>
          <button class="btn btn-sm" id="validate">✓ Zkontrolovat</button></div>
        <textarea id="src" class="code" rows="24" spellcheck="false" placeholder="Načti private/cesty-src.json nebo přidej šablonu…">${esc(src ? JSON.stringify(src, null, 2) : '')}</textarea>
        <p id="vmsg" class="tiny"></p>
        <div class="row gap wrap-row"><button class="btn btn-gold" id="build">🔐 Zašifrovat + náhled na webu</button><button class="btn" id="dljs">⬇ Stáhnout data/cesty.js</button><button class="btn" id="dlsrc">⬇ Stáhnout cesty-src.json</button>
          ${S.hasOverride() ? '<button class="btn btn-ghost" id="clr">Zrušit náhled</button>' : ''}</div>
        <p class="tiny muted">Tip: kódy dávej na místa, která nezmizí (cedule, letopočty, rozcestníky) – cesta pak půjde odchodit i zpětně. Počet kódů = počet stanovišť + 1.</p></div>`;
      const ta = $('#src');
      const parse = () => { try { const v = JSON.parse(ta.value); if (!Array.isArray(v)) throw new Error('Musí to být pole [ ... ]'); return v; } catch (e) { $('#vmsg').innerHTML = `<span class="err">JSON chyba: ${esc(e.message)}</span>`; return null; } };
      const validate = list => {
        const errs = []; const ids = new Set();
        list.forEach((c, i) => {
          const n = `#${i + 1} ${c.id || '?'}`;
          ['id', 'nazev', 'level', 'start', 'startCoords', 'stages', 'finale', 'codes'].forEach(k => { if (c[k] == null) errs.push(`${n}: chybí „${k}“`); });
          if (ids.has(c.id)) errs.push(`${n}: duplicitní id`); ids.add(c.id);
          if (c.level && !U.LEVELS[c.level]) errs.push(`${n}: level musí být easy/medium/hard/hardcore`);
          if (c.start && isNaN(new Date(c.start))) errs.push(`${n}: špatné datum startu`);
          if (c.stages && c.codes && c.codes.length !== c.stages.length + 1) errs.push(`${n}: kódů je ${c.codes.length}, má být ${c.stages.length + 1}`);
          if (c.codes) c.codes.forEach((k, j) => { if (!MCCrypto.norm(k)) errs.push(`${n}: kód ${j} je prázdný`); });
        });
        $('#vmsg').innerHTML = errs.length ? `<span class="err">${errs.map(esc).join('<br>')}</span>` : `<span class="gold">✓ ${list.length} cest v pořádku</span>`;
        return !errs.length;
      };
      ta.oninput = () => { const v = (() => { try { return JSON.parse(ta.value); } catch (e) { return null; } })(); if (v) S.local.set('admin_src', v); };
      $('#srcfile').onchange = async e => { const t = await e.target.files[0].text(); ta.value = JSON.stringify(JSON.parse(t), null, 2); ta.oninput(); U.toast('Načteno'); };
      $('#addtpl').onclick = () => { const l = ta.value.trim() ? parse() : []; if (!l) return; l.push(JSON.parse(JSON.stringify(TEMPLATE))); ta.value = JSON.stringify(l, null, 2); ta.oninput(); ta.scrollTop = ta.scrollHeight; };
      $('#validate').onclick = () => { const l = parse(); l && validate(l); };
      const build = async () => {
        const l = parse(); if (!l || !validate(l)) return null;
        $('#vmsg').textContent = 'Šifruji…'; const out = [];
        for (const c of l) { const p = {}; Object.entries(c).forEach(([k, v]) => { if (!['stages', 'finale', 'codes'].includes(k)) p[k] = v; }); p.stagesCount = c.stages.length; p.bundle = await MCCrypto.buildBundle(c.stages, c.finale, c.codes); out.push(p); }
        $('#vmsg').innerHTML = `<span class="gold">✓ Zašifrováno ${out.length} cest</span>`; return out;
      };
      $('#build').onclick = async () => { const o = await build(); if (o) { S.setCestyOverride(o); U.toast('Náhled aktivní – web teď ukazuje upravené cesty (jen v tomto prohlížeči).'); } };
      $('#dljs').onclick = async () => { const o = await build(); if (o) U.download('cesty.js', '/* VYGENEROVÁNO v #/admin */\nwindow.MC_CESTY = ' + JSON.stringify(o, null, 1) + ';\n', 'text/javascript'); };
      $('#dlsrc').onclick = () => { const l = parse(); l && U.download('cesty-src.json', JSON.stringify(l, null, 2), 'application/json'); };
      const clr = $('#clr'); if (clr) clr.onclick = () => { S.clearCestyOverride(); renderAdmin(); };
    }
    if (tab === 'regs') {
      const regs = await S.allRegistrations();
      box.innerHTML = `<div class="row gap"><button class="btn btn-sm" id="csv">⬇ CSV</button><span class="muted">${regs.length} přihlášek · ${regs.reduce((a, r) => a + (+r.size || 1), 0)} lidí</span></div>
        <table class="table mt"><thead><tr><th>Cesta</th><th>Tým</th><th>E-mail</th><th>Lidí</th><th>Typ</th><th>Kdy</th></tr></thead><tbody>
        ${regs.map(r => `<tr><td>${esc((S.getCesta(r.cestaId) || {}).nazev || r.cestaId)}</td><td>${esc(r.team)}</td><td>${esc(r.email)}</td><td>${r.size}</td><td>${r.retro ? 'zpětně' : 'termín'}</td><td>${U.fmtDate(r.createdAt, { day: 'numeric', month: 'numeric', year: 'numeric' })}</td></tr>`).join('')}</tbody></table>`;
      $('#csv').onclick = () => U.download('prihlasky.csv', '﻿cesta;tym;email;lidi;zpetne;datum\n' + regs.map(r => [r.cestaId, r.team, r.email, r.size, r.retro ? 1 : 0, r.createdAt].join(';')).join('\n'), 'text/csv');
    }
    if (tab === 'photos') {
      const comps = (await S.getCompletions()).filter(c => !c.demo);
      box.innerHTML = comps.length ? `<div class="gal">${comps.map(x => `<figure class="gal-item"><img src="${esc(x.photo)}"><figcaption><b>${esc(x.name)}</b><span>${esc((S.getCesta(x.cestaId) || {}).nazev || '')} · ${U.fmtDur(x.durationMin)}</span><button class="btn btn-sm btn-danger" data-del="${esc(x.id)}">Smazat</button></figcaption></figure>`).join('')}</div>` : '<p class="muted">Zatím žádné nahrané fotky.</p>';
      $$('[data-del]').forEach(b => b.onclick = async () => { if (await U.confirm('Smazat dokončení i s fotkou?', 'Smazat')) { await S.deleteCompletion(b.dataset.del); renderAdmin(); } });
    }
    if (tab === 'wl') {
      const wl = await S.getWaitlist();
      box.innerHTML = `<button class="btn btn-sm" id="wcsv">⬇ CSV</button><table class="table mt"><thead><tr><th>E-mail</th><th>Cesta (čekací listina)</th><th>Kdy</th></tr></thead><tbody>${wl.map(w => `<tr><td>${esc(w.email)}</td><td>${esc(w.cestaId || '– novinky –')}</td><td>${U.fmtDate(w.createdAt)}</td></tr>`).join('')}</tbody></table>`;
      $('#wcsv').onclick = () => U.download('odber.csv', '﻿email;cesta;datum\n' + wl.map(w => [w.email, w.cestaId || '', w.createdAt].join(';')).join('\n'), 'text/csv');
    }
  }

  /* ================= GLOBÁLNÍ ================= */
  document.addEventListener('click', async e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); U.toast('Zkopírováno'); } catch (_) { prompt('Zkopíruj:', cp.dataset.copy); } }
    const sh = e.target.closest('[data-share]');
    if (sh) {
      const c = S.getCesta(sh.dataset.share); const url = location.origin + location.pathname + '#/cesta/' + c.id;
      const text = `Jdeš se mnou na ${c.nazev}? ${U.fmtDate(c.start)} · ${U.LEVELS[c.level].label}`;
      if (navigator.share) navigator.share({ title: c.nazev, text, url }).catch(() => { });
      else { try { await navigator.clipboard.writeText(text + ' ' + url); U.toast('Odkaz zkopírován – pošli ho kámošům'); } catch (_) { prompt('Pošli odkaz:', url); } }
    }
  });

  if (S.mode === 'demo') $('#demo-bar').innerHTML = `DEMO režim – data se ukládají jen v tomto prohlížeči. <a href="#/jak-to-funguje">Info</a>`;
  renderNav();
  await route();
  U.startTicker(() => setTimeout(route, 1200));
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
