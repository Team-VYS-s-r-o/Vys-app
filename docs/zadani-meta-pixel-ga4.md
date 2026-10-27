# Zadání: Meta Pixel + GA4 + Conversions API

Připraveno 27. 10. 2026. Patří do chatu **Marketing** (zadání) → **Technika** (implementace).

## Proč to hoří

Z finanční analýzy (27. 10. 2026):

- Dítě přinese **~9 400 Kč tržby za rok**, po hale a trenérovi zbyde **~6 600 Kč hrubé marže**.
- David může zaplatit **1 500 Kč za získání jednoho dítěte** a pořád vydělá pětinásobek.
  Návratnost ~2 měsíce.
- Dnes: limit **~3 500 Kč/měs na deset měst** = 350 Kč na město.
- Obsazenost kroužků ~25 % → byznys je zhruba na nule (hala i trenér se platí za
  odtrénovanou hodinu bez ohledu na počet dětí).
- Naplnit 10 stávajících měst na 20 dětí = **~100 000 Kč čistého měsíčně**, bez jediné
  nové haly, trenéra nebo města. Je to nejlevnější peníze v celém modelu.

Plán je zvednout rozpočet na nábor řádově — **ale nemá smysl, dokud Meta nevidí konverze.**
Tohle je blokátor číslo jedna.

## Stav ověřený 27. 10. 2026

Grep na `fbq`, `gtag`, `dataLayer`, `connect.facebook.net`, `googletagmanager`:

- `Vys-app/teamvys.cz/src` — **nic**
- `~/Desktop/vys-aplikace` — **nic** (jediný zásah je název balíčku v `package-lock.json`)

Na webu je jen cookie banner (`teamvys.cz/src/components/.../cookie-and-exit.tsx`).

## ⚠️ Nejdůležitější věc — nedávat Pixel jen na teamvys.cz

**Na `teamvys.cz` není checkout.** Rodiče kupují v aplikaci (`~/Desktop/vys-aplikace`,
web export `vys-expo-web-export`). Pixel jen na marketingovém webu tedy **nikdy neuvidí
nákup** a optimalizace na konverze nebude fungovat.

Nutné pokrýt obě místa + předat reklamní proklik přes doménu dál.

## Co nasadit

1. **Meta Pixel + GA4 na `teamvys.cz`** — návštěvy, `ViewContent` na detailu kroužku,
   `Lead` z okamžitých formulářů. Respektovat cookie souhlas.
2. **Meta Pixel + GA4 do web verze appky** (`vys-aplikace`) — `InitiateCheckout`, `Purchase`.
   Deploy web verze **jen** přes `npm run deploy:web` (ruční expo export + vercel rozbije ikony).
3. **Meta Conversions API ze serveru — nejspolehlivější část.**
   V `Vys-app/server/server.js` už existuje `/api/stripe/webhook` → `payment_intent.succeeded`
   → `finalizePaymentIntent`. Tam přidat odeslání `Purchase` do Meta CAPI s hodnotou objednávky
   a `event_id` shodným s browser eventem (deduplikace). Server-side event projde i při
   blokovaných cookies, iOS ATT a cross-domain přechodu — bez něj bude měření děravé
   právě u nejdůležitější události.
4. **GA4** stejná logika: měřicí ID na obě místa, `Purchase` s `value` a `currency: CZK`.

## Události

| Událost | Kde | Pozn. |
|---|---|---|
| `PageView` | web + appka | |
| `ViewContent` | web | parametr město / kroužek |
| `Lead` | web | okamžité formuláře Meta + kontaktní formulář |
| `InitiateCheckout` | appka | start platby |
| `Purchase` | appka + **server CAPI** | hodnota 2190 / 3190, `currency: CZK`, deduplikace přes `event_id` |

## GDPR — nepřeskakovat

- Pixel ani GA4 se **nesmí spustit před souhlasem** v cookie liště.
- Web má banner i stránku `teamvys.cz/ochrana-osobnich-udaju` (vrací 200).
- Do zásad doplnit **Meta Pixel a GA4 jako zpracovatele** — dnes tam nejsou.
- `LEGAL_VERSION` se kvůli cookies bumpovat nemusí (týká se podmínek a souhlasu rodičů
  v appce), ale text zásad je potřeba doplnit.

## Účty

- Meta ads účet: `4591079774500969`, kampaň „Kroužky – nábor říjen 2026"
- Meta Pixel / dataset: **ZALOŽENO 27. 10. 2026** — „Team VYS web", **Pixel ID `1729085625407355`**
  (Events Manager, propojeno s Conversions API přes firemní portfolio; CAPI access token
  vygenerovat v dataset → Nastavení → Conversions API a uložit do Vercel env serveru)
- GA4 property: **UŽ EXISTOVALA** (založena dřív, nikdy nenasazena) — účet `TeamVYS_WEB`,
  property `TeamVYS_Analytics` (a385888174p526330643), stream `TEAMVYS_WEB` → https://teamvys.cz,
  **Measurement ID `G-NSSLDPLBNF`** (stream ID 13680012341). Pro web verzi appky přidat
  v GA4 druhý datový stream (Admin → Datové streamy → Přidat stream), až bude známá doména.

## Jak ověřit

- Meta Events Manager → **Test Events** (browser i server zvlášť, zkontrolovat deduplikaci podle `event_id`)
- GA4 → **DebugView**
- Testovat zvlášť pro web a pro appku — projekt má dvě domény, obě je potřeba ověřit.

Pozn.: nasazení webu `teamvys.cz` nejede automaticky z GitHubu, deployuje se ručně z kořene repa.
