# 🐏 Mufloní cesta

Web pro venkovní hry po stopách Velkého Muflona. Odpočty, přihlášení e-mailem, startovní souřadnice, šifrovaný deník se stanovišti, fotka v cíli, galerie, síň slávy a archiv cest k odchození zpětně.

Čisté HTML/CSS/JS – žádný build, hostuje se na **GitHub Pages**.

## Spuštění

- **Lokálně:** ve VS Code pravým na `index.html` → *Open with Live Server* (nebo prostě otevřít v prohlížeči).
- **Online:** GitHub → repo → *Settings → Pages → Deploy from branch → main / root*. Web poběží na `https://<ucet>.github.io/mufloni-cesta/`.

Bez Supabase běží v **DEMO režimu** – vše se ukládá jen v prohlížeči (na zkoušení ideální).

## Jak fungují cesty

1. Účastník se přihlásí e-mailem → uvidí jen **souřadnice startu**.
2. V den startu se otevře **průvodce**. Na startu najde **startovní kód**.
3. Každý kód odemkne další **stanoviště** (příběh, úkol, souřadnice, hádanka, mapa) a říká, kde hledat další kód.
4. Poslední kód odemkne **cíl** → fotka → cesta splněná, fotka v galerii, čas v síni slávy, diplom.

Etapy jsou **zašifrované (AES-GCM)** kódem z terénu. Ve zdrojáku na GitHubu je nikdo nepřečte.
Deník se dá stáhnout jako **jeden HTML soubor** – funguje v telefonu offline.

## Úprava a přidání cest

Zdroj s etapami a kódy je v `private/cesty-src.json` (**na GitHub se nenahrává**, je v `.gitignore` – zálohuj si ho!).

Možnost A – v prohlížeči: `#/admin` → načíst `cesty-src.json` → upravit → **Stáhnout data/cesty.js** → nahradit v projektu → Sync.

Možnost B – v terminálu:
```bash
node tools/build.mjs
```

Pravidla:
- `codes` = startovní kód + kód každého stanoviště → **počet etap + 1**.
- Kódy dávej na věci, které nezmizí (cedule, letopočty, rozcestníky) → cesta půjde odchodit i zpětně.
- `level`: `easy` | `medium` | `hard` | `hardcore`.

## Ostrý provoz (Supabase)

1. Na [supabase.com](https://supabase.com) založ projekt.
2. *SQL Editor* → spusť `supabase/schema.sql`.
3. *Authentication → URL Configuration* → přidej URL webu (GitHub Pages) do *Redirect URLs*.
4. Do `js/config.js` vyplň `SUPABASE_URL` a `SUPABASE_ANON_KEY` (*Project Settings → API*).

Pak funguje: přihlášení přes odkaz v e-mailu, přihlášky, postup na více zařízeních, fotky v cloudu, společná galerie a síň slávy.

## Funkce

- Odpočet do každé cesty, filtry podle stavu a levelu (Easy → Hardcore)
- Detail: kde, kdy, km, převýšení, čas, fyzická náročnost, terén, kapacita, cena, věk, pes, noc…
- Přihlášení e-mailem (bez hesla), přihláška týmu, kapacita + čekací listina
- Šifrovaná stanoviště odemykaná kódy z terénu (nejde podvádět)
- Nápovědy s časovou penalizací
- Offline deník ke stažení (HTML) + PWA (web funguje bez signálu)
- GPX export + odkazy do Mapy.com / Google + vložená mapa
- Přidání do kalendáře (.ics s připomínkou den předem)
- Předpověď počasí na start (Open-Meteo)
- Interaktivní checklist výbavy
- SOS tlačítko: 112, Horská služba, SMS organizátorovi s polohou
- Fotka v cíli = splněno, galerie všech cest, lightbox
- Síň slávy (časy, nápovědy, zpětné průchody)
- Profil: XP, hodnosti (Kůzle → Velký Muflon), 10 odznaků
- Diplom ke stažení (PNG)
- Hodnocení cest hvězdičkami
- Pozvi kamaráda (sdílení)
- Archiv – staré cesty jdou odchodit zpětně
- Admin: editor cest se šifrováním, přihlášky (CSV), moderace fotek, odběr novinek

## Struktura

```
index.html            vstup
css/style.css         vzhled
js/config.js          NASTAVENÍ (Supabase, admin, kontakty)
js/app.js             stránky a logika
js/store.js           data (demo / Supabase)
js/crypto.js          šifrování etap
js/denik.js           generátor offline deníku
js/utils.js           pomocné funkce
data/cesty.js         veřejná data cest (vygenerované, zašifrované)
private/              zdroj cest s kódy – NENAHRÁVÁ SE
tools/build.mjs       sestavení data/cesty.js
supabase/schema.sql   databáze
sw.js, manifest       offline / instalace do telefonu
```
