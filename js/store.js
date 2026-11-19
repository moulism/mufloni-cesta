/* Datová vrstva. Dva režimy:
 *  - DEMO: vše v localStorage (funguje hned, bez backendu, na jednom zařízení)
 *  - SUPABASE: přihlášení e-mailem (magic link), data a fotky v cloudu
 */
(function () {
  const CFG = window.MC_CONFIG;
  const useSB = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const sb = useSB ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const LS = {
    get(k, d) { try { const v = localStorage.getItem('mc_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem('mc_' + k, JSON.stringify(v)); }
      catch (e) { alert('Úložiště prohlížeče je plné. V demo režimu se fotky ukládají jen lokálně – zapoj Supabase.'); throw e; }
    }
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(16).slice(2));
  const nowIso = () => new Date().toISOString();

  let currentUser = null;
  const listeners = [];
  function emit() { listeners.forEach(fn => fn(currentUser)); }

  /* ---------- seed (ukázkové dokončení pro demo) ---------- */
  function seedPhoto(label, hue) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='hsl(${hue},45%,72%)'/><stop offset='1' stop-color='hsl(${hue + 20},40%,40%)'/></linearGradient></defs>
<rect width='800' height='600' fill='url(#s)'/><circle cx='620' cy='160' r='60' fill='#f6e7b4' opacity='.85'/>
<path d='M0 420 L120 260 L230 400 L340 220 L470 410 L590 280 L800 430 L800 600 L0 600Z' fill='hsl(${hue + 40},35%,22%)'/>
<path d='M0 470 L90 380 L180 470 L280 360 L400 480 L520 370 L660 480 L800 400 L800 600 L0 600Z' fill='hsl(${hue + 60},40%,14%)'/>
<g fill='#0d140f'><circle cx='330' cy='455' r='16'/><rect x='318' y='470' width='24' height='60' rx='10'/><circle cx='380' cy='450' r='16'/><rect x='368' y='465' width='24' height='65' rx='10'/><circle cx='430' cy='458' r='15'/><rect x='419' y='472' width='22' height='58' rx='10'/></g>
<text x='40' y='70' font-family='Georgia' font-size='34' fill='#fff' opacity='.9'>${label}</text>
<text x='40' y='560' font-family='Georgia' font-size='18' fill='#fff' opacity='.6'>ukázková fotka</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const SEED = [
    { id: 's1', cestaId: 'prolog-2026', userId: 'seed', name: 'Tým Alfa', durationMin: 1490, hints: 1, retro: false, createdAt: '2026-06-07T16:50:00+02:00', photo: seedPhoto('Tým Alfa', 95), demo: true },
    { id: 's2', cestaId: 'prolog-2026', userId: 'seed', name: 'Tým Beta', durationMin: 1562, hints: 3, retro: false, createdAt: '2026-06-07T18:02:00+02:00', photo: seedPhoto('Tým Beta', 30), demo: true },
    { id: 's3', cestaId: 'prolog-2026', userId: 'seed', name: 'Tým Gama', durationMin: 1611, hints: 2, retro: false, createdAt: '2026-06-07T18:51:00+02:00', photo: seedPhoto('Tým Gama', 200), demo: true },
    { id: 's4', cestaId: 'prolog-2026', userId: 'seed', name: 'Bráchové', durationMin: 1320, hints: 0, retro: true, createdAt: '2026-09-12T15:10:00+02:00', photo: seedPhoto('Bráchové', 140), demo: true }
  ];

  /* ---------- AUTH ---------- */
  async function initAuth() {
    if (useSB) {
      const { data } = await sb.auth.getSession();
      currentUser = data.session ? mapSbUser(data.session.user) : null;
      sb.auth.onAuthStateChange((_e, session) => { currentUser = session ? mapSbUser(session.user) : null; emit(); });
      if (currentUser) {
        const { data: p } = await sb.from('profiles').select('name').eq('user_id', currentUser.id).maybeSingle();
        if (p && p.name) currentUser.name = p.name;
      }
    } else {
      currentUser = LS.get('user', null);
    }
    return currentUser;
  }
  function mapSbUser(u) { return { id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || u.email.split('@')[0] }; }

  async function signIn(email) {
    email = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Zadej platný e-mail.');
    if (useSB) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname + location.hash } });
      if (error) throw error;
      return { magicLink: true };
    }
    const users = LS.get('users', {});
    currentUser = users[email] || { id: uid(), email, name: email.split('@')[0] };
    users[email] = currentUser; LS.set('users', users); LS.set('user', currentUser);
    emit();
    return { magicLink: false };
  }
  async function signOut() {
    if (useSB) await sb.auth.signOut(); else LS.set('user', null);
    currentUser = null; emit();
  }
  async function setName(name) {
    name = String(name).trim().slice(0, 40); if (!name || !currentUser) return;
    currentUser.name = name;
    if (useSB) await sb.from('profiles').upsert({ user_id: currentUser.id, name });
    else { const users = LS.get('users', {}); users[currentUser.email] = currentUser; LS.set('users', users); LS.set('user', currentUser); }
    emit();
  }
  const isAdmin = () => !!currentUser && CFG.ADMIN_EMAILS.map(e => e.toLowerCase()).includes(currentUser.email);

  /* ---------- CESTY ---------- */
  function getCesty() {
    const override = LS.get('cesty_override', null); // z adminu (demo / náhled)
    const list = (override || window.MC_CESTY || []).slice();
    return list.sort((a, b) => new Date(a.start) - new Date(b.start));
  }
  const getCesta = id => getCesty().find(c => c.id === id);

  /* ---------- REGISTRACE ---------- */
  async function register(cestaId, { team, size, retro }) {
    if (!currentUser) throw new Error('Nejdřív se přihlas.');
    const row = { cesta_id: cestaId, user_id: currentUser.id, email: currentUser.email, team: team || currentUser.name, size: +size || 1, retro: !!retro };
    if (useSB) {
      const { error } = await sb.from('registrations').upsert(row, { onConflict: 'cesta_id,user_id' });
      if (error) throw error;
    } else {
      const regs = LS.get('regs', []).filter(r => !(r.cestaId === cestaId && r.userId === currentUser.id));
      regs.push({ id: uid(), cestaId, userId: currentUser.id, email: currentUser.email, team: row.team, size: row.size, retro: row.retro, createdAt: nowIso() });
      LS.set('regs', regs);
    }
  }
  async function unregister(cestaId) {
    if (!currentUser) return;
    if (useSB) await sb.from('registrations').delete().eq('cesta_id', cestaId).eq('user_id', currentUser.id);
    else LS.set('regs', LS.get('regs', []).filter(r => !(r.cestaId === cestaId && r.userId === currentUser.id)));
  }
  async function myRegistrations() {
    if (!currentUser) return [];
    if (useSB) {
      const { data } = await sb.from('registrations').select('*').eq('user_id', currentUser.id);
      return (data || []).map(r => ({ cestaId: r.cesta_id, team: r.team, size: r.size, retro: r.retro, createdAt: r.created_at }));
    }
    return LS.get('regs', []).filter(r => r.userId === currentUser.id);
  }
  async function getRegistration(cestaId) { return (await myRegistrations()).find(r => r.cestaId === cestaId) || null; }
  async function regCounts() {
    if (useSB) {
      const { data } = await sb.rpc('registration_counts');
      const m = {}; (data || []).forEach(r => m[r.cesta_id] = r.people); return m;
    }
    const m = {}; LS.get('regs', []).filter(r => !r.retro).forEach(r => m[r.cestaId] = (m[r.cestaId] || 0) + (r.size || 1)); return m;
  }
  async function allRegistrations() {
    if (useSB) { const { data } = await sb.from('registrations').select('*').order('created_at'); return (data || []).map(r => ({ cestaId: r.cesta_id, email: r.email, team: r.team, size: r.size, retro: r.retro, createdAt: r.created_at })); }
    return LS.get('regs', []);
  }

  /* ---------- POSTUP (odemčené kódy) ---------- */
  async function getProgress(cestaId) {
    const empty = { codes: [], hints: [], startedAt: null };
    if (!currentUser) return empty;
    if (useSB) {
      const { data } = await sb.from('progress').select('data').eq('cesta_id', cestaId).eq('user_id', currentUser.id).maybeSingle();
      return Object.assign(empty, data ? data.data : {});
    }
    return Object.assign(empty, LS.get('progress', {})[currentUser.id + ':' + cestaId] || {});
  }
  async function saveProgress(cestaId, p) {
    if (!currentUser) return;
    if (useSB) await sb.from('progress').upsert({ cesta_id: cestaId, user_id: currentUser.id, data: p, updated_at: nowIso() });
    else { const all = LS.get('progress', {}); all[currentUser.id + ':' + cestaId] = p; LS.set('progress', all); }
  }

  /* ---------- DOKONČENÍ + FOTKY ---------- */
  async function compressImage(file, max = 1400, q = 0.78) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(b => res({ blob: b, dataUrl: c.toDataURL('image/jpeg', q) }), 'image/jpeg', q));
  }
  async function complete(cestaId, file, { name, note, durationMin, hints, retro, isPublic }) {
    if (!currentUser) throw new Error('Nejdřív se přihlas.');
    const demo = !useSB;
    const img = await compressImage(file, demo ? 1000 : 1600, demo ? 0.7 : 0.82);
    if (useSB) {
      const path = `${currentUser.id}/${cestaId}-${Date.now()}.jpg`;
      const up = await sb.storage.from('photos').upload(path, img.blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      const url = sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
      const { error } = await sb.from('completions').insert({ cesta_id: cestaId, user_id: currentUser.id, name, note, photo_url: url, duration_min: durationMin, hints, retro, is_public: isPublic !== false });
      if (error) throw error;
    } else {
      const list = LS.get('completions', []).filter(c => !(c.cestaId === cestaId && c.userId === currentUser.id));
      list.push({ id: uid(), cestaId, userId: currentUser.id, name, note, photo: img.dataUrl, durationMin, hints, retro, isPublic: isPublic !== false, createdAt: nowIso() });
      LS.set('completions', list);
    }
  }
  async function getCompletions(cestaId) {
    let list;
    if (useSB) {
      let q = sb.from('completions').select('*').order('created_at', { ascending: false });
      if (cestaId) q = q.eq('cesta_id', cestaId);
      const { data } = await q;
      list = (data || []).map(r => ({ id: r.id, cestaId: r.cesta_id, userId: r.user_id, name: r.name, note: r.note, photo: r.photo_url, durationMin: r.duration_min, hints: r.hints, retro: r.retro, isPublic: r.is_public, createdAt: r.created_at }));
    } else {
      list = LS.get('completions', []).concat(SEED);
      if (cestaId) list = list.filter(c => c.cestaId === cestaId);
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }
  async function myCompletions() { if (!currentUser) return []; return (await getCompletions()).filter(c => c.userId === currentUser.id); }
  async function deleteCompletion(id) {
    if (useSB) await sb.from('completions').delete().eq('id', id);
    else LS.set('completions', LS.get('completions', []).filter(c => c.id !== id));
  }

  /* ---------- HODNOCENÍ ---------- */
  async function rate(cestaId, stars, text) {
    if (!currentUser) return;
    const row = { cesta_id: cestaId, user_id: currentUser.id, name: currentUser.name, stars, text };
    if (useSB) await sb.from('ratings').upsert(row, { onConflict: 'cesta_id,user_id' });
    else { const l = LS.get('ratings', []).filter(r => !(r.cestaId === cestaId && r.userId === currentUser.id)); l.push({ cestaId, userId: currentUser.id, name: currentUser.name, stars, text, createdAt: nowIso() }); LS.set('ratings', l); }
  }
  async function getRatings(cestaId) {
    if (useSB) { const { data } = await sb.from('ratings').select('*').eq('cesta_id', cestaId).order('created_at', { ascending: false }); return (data || []).map(r => ({ userId: r.user_id, name: r.name, stars: r.stars, text: r.text, createdAt: r.created_at })); }
    return LS.get('ratings', []).filter(r => r.cestaId === cestaId).reverse();
  }

  /* ---------- ODBĚR NOVINEK ---------- */
  async function joinWaitlist(email, cestaId) {
    email = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Zadej platný e-mail.');
    if (useSB) { const { error } = await sb.from('waitlist').insert({ email, cesta_id: cestaId || null }); if (error && error.code !== '23505') throw error; }
    else { const l = LS.get('waitlist', []); if (!l.some(w => w.email === email && w.cestaId === (cestaId || null))) l.push({ email, cestaId: cestaId || null, createdAt: nowIso() }); LS.set('waitlist', l); }
  }
  async function getWaitlist() {
    if (useSB) { const { data } = await sb.from('waitlist').select('*'); return (data || []).map(w => ({ email: w.email, cestaId: w.cesta_id, createdAt: w.created_at })); }
    return LS.get('waitlist', []);
  }

  /* ---------- ADMIN: náhled upravených cest ---------- */
  function setCestyOverride(list) { LS.set('cesty_override', list); }
  function clearCestyOverride() { localStorage.removeItem('mc_cesty_override'); }
  const hasOverride = () => !!LS.get('cesty_override', null);

  window.MCStore = {
    mode: useSB ? 'supabase' : 'demo',
    initAuth, signIn, signOut, setName, isAdmin,
    user: () => currentUser, onAuth: fn => listeners.push(fn),
    getCesty, getCesta,
    register, unregister, myRegistrations, getRegistration, regCounts, allRegistrations,
    getProgress, saveProgress,
    complete, getCompletions, myCompletions, deleteCompletion,
    rate, getRatings, joinWaitlist, getWaitlist,
    setCestyOverride, clearCestyOverride, hasOverride,
    local: LS
  };
})();
