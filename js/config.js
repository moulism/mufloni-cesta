/* ====== NASTAVENÍ MUFLONÍ CESTY ======
 * Bez Supabase běží web v DEMO režimu (vše se ukládá jen v prohlížeči).
 * Pro ostrý provoz vyplň SUPABASE_URL + SUPABASE_ANON_KEY (viz README.md).
 */
window.MC_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // kdo vidí #/admin
  ADMIN_EMAILS: ['matyas.moulis.mm@gmail.com'],

  ORGANIZER: {
    name: 'Mufloní cesta',
    email: 'ahoj@mufloni-cesta.cz',
    phone: '+420 000 000 000',
    instagram: 'mufloni.cesta'
  },

  // kolik hodin před startem se registrovaným ukáže startovní souřadnice (0 = hned po přihlášení)
  REVEAL_START_HOURS: 0,

  // body za dokončení podle levelu
  XP: { easy: 100, medium: 200, hard: 350, hardcore: 600 },
  XP_HINT_PENALTY: 10
};
