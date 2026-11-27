# Architektura platformy VYS

> **Stav k 16. 10. 2026.** Tenhle soubor popisuje **realitu**, ne plán. Předchozí verze (z 5/2026)
> popisovala zamýšlené rozdělení serveru na `routes/` a `services/`, které nikdy nevzniklo.
> Když něco změníš strukturálně, aktualizuj i tohle.

---

## 1. Tři repozitáře, jedna databáze

| # | Repo | Co to je | Běží na |
|---|---|---|---|
| 1 | `~/Documents/GitHub/Vys-app` | Express API + veřejný web teamvys.cz + Supabase migrace | `server-psi-ochre-40.vercel.app`, `teamvys.cz` |
| 2 | `~/Desktop/aplikacevys.cz` | Admin web + landing + právní dokumenty | `aplikacevys.cz` |
| 3 | `~/Desktop/vys-aplikace` | Expo appka (rodič / dítě / trenér / koordinátor) | `app.aplikacevys.cz`, App Store, Google Play |

Všechny tři mluví do **jedné Supabase** `qbelgyhzdjexhlrvttxc` a do **jednoho Stripe**.
GitHub org: `Team-VYS-s-r-o`.

### Tok dat

```
Expo appka ──┐
Admin web  ──┼──► lib/api-client.ts ──► Express (server-psi-ochre-40) ──► Supabase (service role)
teamvys.cz ──┘                                      │                          ▲
                                                    └──► Stripe                │
         Frontendy také čtou Supabase přímo (anon klíč + RLS) ─────────────────┘
```

**Pravidlo:** Stripe secret a Supabase service-role klíč jsou **jen na Expressu**. Frontendy mají
výhradně anon klíč a jsou chráněné přes RLS.

---

## 2. Repo 1 — `Vys-app`

```
server/        Express API — JEDEN soubor server.js (7 353 řádků)
teamvys.cz/    Next.js 15 veřejný web
supabase/      45 migrací + schema.sql + functions/
shared/        4 TS soubory sdílené napříč projekty
docs/          dokumentace (tenhle soubor, nfc-karticka-zaloha.md)
```

### 2.1 `server/` — Express API

- **Express 5.2**, nasazené na Vercel přes `api/index.js`, který jen re-exportuje `../server.js`.
  `vercel.json` posílá veškerý provoz na `/api/index.js`.
- **Vercel projekt `server`** má root-directory `server` → **deploy VŽDY z kořene repa**,
  jinak CLI spadne na „path …/server/server does not exist".
- **117 endpointů** v jednom souboru: 60× POST, 40× GET, 10× DELETE, 7× PATCH.

**Autorizační helpery** (tohle je páteř bezpečnosti):

| Helper | Pustí dál |
|---|---|
| `requireAuthenticatedProfile()` | kohokoliv přihlášeného (Supabase `getUser(token)`) |
| `requireAdmin()` | `app_profiles.role = 'admin'` |
| `requireParentOrAdmin()` | admin, parent, participant |
| `requireStaff()` | coach **se schváleným** `coach_profiles.approval_status` |
| `requireSuperAdminUser()` | admin, jehož e-mail = `SUPER_ADMIN_EMAIL` |
| `adminOrgId()` | vrátí `app_profiles.org_id`, fallback `VYS_ORG_ID` |

Navíc **org write lock**: organizace ve stavu `pending_approval` / `past_due` / `canceled`
mají zablokované všechny zápisové metody.

**Skupiny endpointů:** veřejné (`/api/public/*`, `/api/courses`, `/api/camps`, `/api/ticket/:id`),
autentizace (telefon + trenér), rodič, účastník, **hra Souboj maskotů** (`/api/game/profile|battle-result|upgrade|leaderboard`, sekce „Souboj maskotů“ v server.js — server losuje trofeje ±25–35, hlídá tier bota, denní limit 25 a strop granulí 80), trenér, platby (`/api/payments/*`),
produkty, dokumenty, finance a faktury, broadcasty, koordinátoři,
multi-tenant organizace (`/api/orgs/*`), Stripe webhook a VYS bot (`/api/bot/chat`, Anthropic API).

**Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SMTP_*`, `ANTHROPIC_API_KEY`, `SUPER_ADMIN_EMAIL`, `TICKET_LINK_SECRET`, `CORS_ORIGIN`.

**Konstanty:** `VYS_ORG_ID = 00000000-0000-4000-8000-000000000001`,
`DEFAULT_COURSE_ATTENDANCE_RATE = 500`, `SOLO_COURSE_ATTENDANCE_RATE = 750`,
`WORKSHOP_INTEREST_THRESHOLD = 9`.

**Workshopy (od 27. 11. 2026):** vstupenka se prodává **hned po zveřejnění** produktu typu `Workshop`
(`workshopPurchaseGate`: zavřeno jen při `interest_mode` a po termínu; staré pravidlo „9 zájemců nebo
2 dny před termínem" je zrušené). Nákup jde stejnou cestou jako kroužek (dokumenty → Stripe → e-mail
s QR vstupenkou `/api/ticket/:id`). QR do aplikace vrací `GET /api/parent/purchases/:id/ticket-link`.
Dokumenty workshopu mají vlastní šablony (`document_templates`: „Podmínky a storno workshopu",
„GDPR – workshop" se souhlasem pro kanály hosta). Starší buildy appky u workshopu ukazují jen
„Mám zájem" → `POST /api/workshop-interests` jim pošle zprávu, kde vstupenku koupit.
Web: `teamvys.cz/src/components/workshop-feature.tsx` (`FEATURED` = vypsaný workshop s hostem).

#### Stripe tok — pořadí je důležité

```
POST /api/stripe/webhook
  └─ payment_intent.succeeded
      └─ finalizePaymentIntent
          ├─ metadata.nfc_fee === '1' → finalizeNfcFeePayment   ← MUSÍ být první
          └─ jinak purchaseRowFromPaymentIntent
              └─ upsert parent_purchases (id = stripe-pi-<pi.id>)
                  └─ syncPaidPurchaseSideEffects
                      → produkt, kapacita, enrollment,
                        parent_payments (payment-<purchase.id>),
                        digital_passes
```

NFC větev je první schválně — `getProduct('nfc-card-fee')` neexistuje a generická větev by spadla.

### 2.2 `teamvys.cz/` — veřejný web

Next.js 15.5, React 19, App Router, Tailwind, framer-motion, Leaflet.
**23 stránek.** Veřejné: `/`, `/o-nas`, `/krouzky`, `/krouzky/[id]`, `/tabory`, `/workshopy`,
`/aplikace`, `/kontakty`, `/pomocnik` (VYS bot), `/ochrana-osobnich-udaju`, `/sign-in`,
`/nastaveni-hesla`. Dál `/rodic`, `/admin`, `/checkout/*` a `/app/*` (přesměrování na appku).

- **Nákupy tu nejsou** — rodiče kupují v appce. Checkout routy jsou legacy.
- Vercel projekt **`vys-web`**, **auto-deploy z GitHubu NEJEDE** → nasazovat ručně z kořene repa.

### 2.3 `supabase/`

45 migrací (`20260504` → `20261012`) + `schema.sql` + edge functions.
Velké vlny: core schéma (5/2026), XP a gamifikace (6/2026), **multi-tenant** (11 migrací, 6/2026),
NFC kartičky (10/2026).

### 2.4 `shared/`

`brand.ts` (barvy), `types.ts` (AppRole, Course, Camp…), `content.ts` (statická data kroužků),
`feature-flags.ts` — `VYS_FEATURE_FLAGS` (vše zapnuté) vs `EXTERNAL_FEATURE_FLAGS`
(cizí organizace nemají gamifikaci dětí). Kopie žijí i v `aplikacevys.cz/shared/`
a `vys-aplikace/lib/feature-flags.ts` — **měnit všechny tři najednou**.
Per-org přepínatelný flag `coordinator_forgotten_attendance` (default zapnuto):
koordinátor smí zapsat trenérům zapomenutou docházku (`POST /api/coordinator/attendance`,
status „Zapsáno koordinátorem"); admin to vypíná/zapíná přes `PATCH /api/admin/feature-flags`
(whitelist klíčů na serveru), toggle v admin webu v sekci Koordinátoři.

**Veřejný seznam trenérů:** `GET /api/public/coaches` vrací i fotky jako base64 (data: URL z `coach_profiles.profile_photo_url`)
— celá odpověď má ~5,5 MB. Appka proto volá `?lite=1` (jen jména, lokality a odkaz na fotku) a obrázek bere z
`GET /api/public/coaches/:id/photo` (jen schválení trenéři, cache 1 den / CDN 7 dní). Weby zatím používají plný seznam.

**Dokumenty dítěte u koordinátora:** `GET /api/coordinator/participants/:id/documents` — platné verze `course_documents` jednoho dítěte
(znění při podpisu, vyplněné údaje, kdo a kdy podepsal; bez IP). Jen děti z jeho kraje a jen s oprávněním `children_data`.
V appce: karta účastníka (`components/coordinator/participant-modal.tsx`) → sekce Dokumenty → `signed-document.tsx` (na PC iPhone + důkaz o podpisu v okně).

**Mapa měst koordinátora:** `GET /api/coordinator/overview` vrací i `locations` (+ `locationsMissingPins`) —
rozpad kraje po městech (`buildRegionLocations`): souřadnice, termíny, děti, trenéři, dokumenty dětí,
hodnocení, zisk a výdaje za tento/minulý měsíc/celkem, smlouvy s halou (`product_admin_info`) a faktury
podle `invoices.gym_place`. Finance, smlouvy a faktury jen s oprávněním `finance`. Soubory otevírá
`GET /api/coordinator/location-file-url` (ověří, že patří do kraje). Appka: `components/coordinator/locations-map.tsx`
(Leaflet dokument `lib/locations-map-html.ts` — iframe na webu, WebView v nativu). Stejná mapa pro admina
je v aplikacevys.cz (`locations-overview-map.tsx`), ta si data skládá v prohlížeči.

**Barvy koordinátorů na mapě:** kolečko špendlíku nese barvu koordinátora, kterému město patří (podle `products.region`);
město bez koordinátora je černé. Barvy žijí v `organizations.feature_flags.coordinator_colors` (`{ <id>: '#RRGGBB' }`),
bez uložené barvy se bere paleta podle pořadí založení. `GET /api/admin/coordinators/colors` (lehký seznam pro mapu),
`PATCH /api/admin/coordinators/:id/color` (admin → Koordinátoři → „Barva na mapě").

---

## 3. Repo 2 — `aplikacevys.cz` (admin)

Next.js 15, Vercel projekt **`aplikacevys-web`**, `force-dynamic` všude (žádné cachování).

**Stránky:** `/` (landing s ceníkem SaaS 2 490 Kč/měs + ceník zprovoznění), `/registrace` (self-service nové organizace),
`/admin` + `/admin/prihlaseni` + `/admin/organizace`, `/koordinator`,
a právní: `/obchodni-podminky`, `/ochrana-osobnich-udaju`, `/zpracovatelska-smlouva`, `/smazani-uctu`.

`/nastaveni-hesla` (nové heslo správce — sem vede e-mail ze „Zapomenutého hesla").

**Prodejní web (landing) a přihlášení — přestavba 21. 11. 2026:**
- Sekce v `src/components/landing/`: `showcase-section` (admin v MacBooku se záložkami, koordinátor, telefony trenér/rodič/dítě),
  `hand-story-section` (ruka s telefonem, obrazovky se střídají při scrollu), `pricing-section` (jedna cena s přepínačem
  období, kalkulačka na dítě, zprovoznění, FAQ), `app-showcase` (App Store, návod pro rodiče). Rámečky zařízení: `device-frames.tsx`.
- Přihlášení, registrace i nastavení hesla sdílí tmavý `src/components/auth/auth-shell.tsx` (`AuthShell`, `AuthCollapse`);
  registrace je tříkrokový průvodce. Styl polí: `.auth-input` v `globals.css`.
- **Screenshoty a videa jsou s vymyšlenými daty včetně kroužků** (`public/fotky/v2/*.webp`, `navod-*.mp4`). Přefocení:
  `scripts/demo-shots/` — `fixture-server.mjs` (místní server, tváří se jako Supabase REST i API) + `fake-products.mjs`
  (vymyšlený katalog) + launch konfigurace `aplikacevys-demo` (port 3111) + `admin-shots.mjs`; telefonní obrazovky a
  koordinátora fotí `site-app-shots.mjs` z dev náhledu appky (390×797, stavový řádek dokresluje `PhoneScreen`), videa
  návodu natáčí `guide-videos.mjs`. Zařízení (`MacbookFrame`, `PhoneFrame`) jsou kreslená v CSS.
- Ceny na webu musí sedět na třech místech: `ORG_PLANS` (server), `pricing-section.tsx`, `registration-form.tsx`.

**Vlastní API routes jsou jen 4** (`/api/admin/org-logo`, `/api/admin/coaches/approval`,
`/api/admin/coaches/delete`, `/api/participants/link`) — zbytek jde přes `src/lib/api-client.ts`
na Express.

### `admin-dashboard.tsx` — 11 204 řádků, 14 sekcí

| Klíč | Sekce | Obsah |
|---|---|---|
| `overview` | Přehled | finanční souhrn, chybějící dokumenty, DPP, pending requesty |
| `attendance` | Docházka | kalendář lekcí, turnusy táborů, workshopy, ruční zápis |
| `participants` | Účastníci | seznam + detail (dokumenty, docházka, skills, kontakty) |
| `registry` | Registr | historicky všichni účastníci |
| `products` | Produkty | kroužky / tábory / workshopy, ceny, trenéři, dokumenty |
| `documents` | Dokumenty | šablony PDF, DPP šablony |
| `messages` | Zprávy | broadcasty rodičům i trenérům |
| `voting` | Hlasování | triky týdne (jen VYS) |
| `coaches` | Trenéři | profily, schvalování, DPP, docházka, XP, finance |
| `coordinators` | Koordinátoři | regionální koordinátoři a provize |
| `payouts` | Výplaty | Stripe výplaty trenérům |
| `invoices` | Faktury | přijaté faktury od trenérů |
| `finance` | Finance | cash flow, nájmy hal, trend |
| `nfc` | NFC kartičky | záloha, lhůta, poplatek (přes RPC) |

UI vzory: `Panel`, `SectionTitle`, `FinanceCollapse`, `EmptyState`;
styl `rounded-[14px] bg-brand-purple … font-black`.

**`src/components/legal/legal-layout.tsx`** drží `LEGAL_ENTITY` (Team VYS s.r.o., IČO 30059496,
Ruprechtov 198, oddíl C vložka 154077, účet 3730284010/3030) a **`LEGAL_VERSION = '2026-10-06'`**.
Admin dashboard podle ní počítá, kdo ještě neodsouhlasil nové podmínky.

---

## 4. Repo 3 — `vys-aplikace` (Expo)

Expo 54, React 19, React Native 0.81, Expo Router, `typedRoutes` + `reactCompiler`.
Verze **1.0.3**, Android versionCode **18**, iOS buildNumber **26**, bundle `com.teamvys.app`.
37 souborů v `lib/`, 29 hooks, 40 komponent.

### Čtyři role = čtyři skupiny obrazovek

| Skupina | Role | Obrazovky |
|---|---|---|
| `(tabs)` | **dítě** | home, tricks, rewards, dochazka, souboj (skrytá, spouští ji FIGHT u arény; hra kočka vs pes, `lib/battle/engine.ts`), leaderboard, tutorials |
| `(parent)` | **rodič** | rodic, deti, platby, organizace, profil |
| `(coach)` | **trenér** | coach, attendance, qr, wards, ward-detail, coach-leaderboard, coach-profile, coach-games, coach-inspiration, participant-search |
| `(koordinator)` | **koordinátor** | koordinator, krouzky, dochazka, treneri, navrhy, ukoly, vyplaty |

Mimo skupiny: `sign-in`, `index`, `qr-claim` (vázání dítěte QR kódem, bez loginu), `spots` (mapa).

**Koordinátor na PC (web, šířka ≥ 1100):** `useCoordDesktop()` v `components/coordinator/ui.tsx` přepíná
obrazovky na PC rozložení — tabulky a číselné karty z `components/coordinator/desktop.tsx`, detaily v okně
(`SheetModal` se `size`). Na PC se nic nerozbaluje do stránky; `CollapsiblePanel` se tam sám změní na dlaždici
s oknem. Telefon a nativní appka jedou původním rozložením.

**Route guard** je v `app/_layout.tsx`: role se drží v AsyncStorage pod `vys.role`,
nepřihlášený letí na `/sign-in`, neschválený trenér se odhlásí, špatná sekce → přesměrování.
Obejde se přes `EXPO_PUBLIC_DEV_BYPASS_AUTH` a `EXPO_PUBLIC_DEV_BYPASS_ROLE_GUARD`.

**NFC:** `lib/nfc.native.ts` (iOS CoreNFC TAG session + Android `registerTagEvent`) a
`lib/nfc.ts` (Web NFC fallback pro Chrome na Androidu). Hlavní vstup je
`app/(coach)/attendance.tsx` — trenér pípne čip, ten se mapuje na dítě a zapíše docházku.
iOS potřebuje TAG session, protože NDEF-only session nevidí prázdné čipy.

**Tutoriál:** `SpotlightTour`, klíče `vys.tour.<role>.v2` v AsyncStorage. Reset = smazat je.

**`lib/legal.ts`:** `LEGAL_BASE_URL = 'https://aplikacevys.cz'`, `LEGAL_VERSION = '2026-10-06'`.

---

## 5. Supabase — co tam reálně je

**63 tabulek**, **42 funkcí** (z toho 40 `SECURITY DEFINER`), **7 storage bucketů**.
Reálná data: 170 dětí, 132 rodičů, 11 trenérů, 2 admini, 1 koordinátor, 35 produktů, 88 permanentek.

**Jedna jediná organizace — Team VYS** (`00000000-0000-4000-8000-000000000001`).
Multi-tenancy je kompletně postavená a otestovaná, ale zatím ji nikdo zvenčí nepoužívá.

### Buckety

| Bucket | Veřejný | Na co |
|---|---|---|
| `product-contracts` | ❌ | smlouvy k tělocvičnám (signed URL 300 s) |
| `dpp-files` | ❌ | DPP trenérů |
| `invoices` | ❌ | faktury |
| `participant-docs` | ❌ | dokumenty dětí |
| `document-templates` | ✅ | šablony |
| `org-assets` | ✅ | loga organizací |
| `product-videos` | ✅ | videa u produktů |

### Důležité RPC

`teamvys_is_staff()`, `teamvys_app_role()`, `teamvys_actor_in_org()` — základ RLS.
`teamvys_scan_digital_pass()` — pípnutí čipu. `teamvys_set_nfc_card_status()` — trenér mění stav
kartičky. `teamvys_update_nfc_settings()` / `teamvys_update_org_name()` — zápis do `organizations`.
`teamvys_record_manual_attendance()`, `teamvys_recalculate_coach_payout()`,
`teamvys_approve_coach()` / `_reject_coach()` / `_delete_coach()`.

---

## 6. Pasti, na které se dá naletět

1. **Datum jako TEXT.** `digital_passes.expires_at`, `last_scan_at`, `parent_purchases.paid_at`
   a `expires_at`, `products.expires_at` jsou **TEXT** a obsahují mix ISO a českého `d.m.yyyy`.
   Vždy parsovat přes `parseFlexibleDate()`. Naproti tomu `created_at` je normální timestamptz.
2. **`participants.id` je TEXT, `organizations.id` je uuid.** Většina `*_id` sloupců je TEXT,
   jen `org_id` je uuid. Join bez přetypování selže.
3. **`products` má public-read RLS.** Cokoliv tam přidáš přečte kdokoliv s anon klíčem.
   Interní data patří do `product_admin_info` (RLS zapnuté, žádné policies → jen service role).
   `products.gym_contact` je kvůli tomu veřejně čitelný — legacy.
4. **`organizations` nemá UPDATE policy** → zápis jen přes SECURITY DEFINER RPC.
5. **Trenéři nesmí přímo UPDATE `participants`** → přes `teamvys_set_nfc_card_status`.
6. **`parent_notifications`** vyžaduje `org_id` a idempotenci řeší deterministické `id`
   + upsert s `ignoreDuplicates`.
7. **NFC větev ve Stripe webhooku musí zůstat před generickou.**
8. **Deploy serveru jen z kořene repa.**
9. **`LEGAL_VERSION` je na dvou místech** — bumpovat obě současně, jinak se rodičům
   rozsype počítání souhlasů.
10. **Nativní buildy zaostávají za webem.** `npm run deploy:web` nasadí web okamžitě,
    ale appka ve storech má pořád starý kód, dokud neproběhne `eas build`.
11. **`teamvys_org_match(org_id)` vrací pro nepřihlášeného TRUE** (`auth.uid() is null`).
    Policy typu `using (true AND teamvys_org_match(org_id))` nebo policy bez `to authenticated`
    (tj. pro roli `public`) proto pustí kohokoli s anon klíčem. Takhle do 21. 11. 2026 unikaly
    `parent_purchases` a `parent_notifications` (staré „prototype" policies vytvořené mimo migrace;
    zrušeno migrací `20261121120000_drop_prototype_public_policies.sql`). Každá nová policy musí
    mít `to authenticated` a podmínku na `auth.uid()` / roli. Kontrola:
    `select tablename, policyname, cmd, qual from pg_policies where schemaname='public' and roles::text ~ 'public|anon';`
    — s `true` smí zůstat jen `products` a `product_faqs`.

---

## 7. Deploy — rychlá tabulka

| Co | Příkaz | Vercel projekt |
|---|---|---|
| Express API | `cd ~/Documents/GitHub/Vys-app && npx vercel deploy --prod --yes` | `server` |
| teamvys.cz | totéž z kořene repa (auto-deploy nejede) | `vys-web` |
| Admin | `cd ~/Desktop/aplikacevys.cz && npm run build && npx vercel --prod --yes` | `aplikacevys-web` |
| Web appka | `cd ~/Desktop/vys-aplikace && npm run deploy:web` | `vys-expo-web-export` |
| Store buildy | `npx eas-cli build --platform all --profile production --auto-submit` | — |

Web appka má veřejnou URL **`https://app.aplikacevys.cz`**. Odkazy nehardcodovat —
používat `lib/app-urls.ts` (`webAppUrl()`), jinak uživatel po návratu z Stripe přijde o session.

### Git push (token z Keychainu)

```bash
TOKEN=$(security find-generic-password -s "GitHub - https://api.github.com" -a kropadave -w) && \
git -c credential.helper= -c "http.https://github.com/.extraheader=Authorization: Basic $(printf 'kropadave:%s' "$TOKEN" | base64)" push origin main
```

---

## 8. Známé nesrovnalosti (k 16. 10. 2026)

- **Značka se píše „Team VYS" S MEZEROU.** Nikdy `TeamVYS`. Sjednoceno 16. 10. 2026 napříč všemi
  třemi repy (předměty e-mailů v `server/server.js`, Stripe `description`, PDF potvrzení,
  obchodní podmínky, GDPR, store listing) i ve 3 řádcích `participants.last_name`.
  **Výjimka, která zůstat musí: `"slug": "TeamVYS"` v `vys-aplikace/app.json`** — identifikátor
  Expo/EAS projektu, změna rozbije buildy. Historické migrace se nepřepisují.
- **Šablony Supabase Auth e-mailů pořád říkají „TeamVYS".** Předmět „Obnova hesla TeamVYS" nejde
  z kódu — žije v Supabase dashboardu (Authentication → Emails). Opravit ručně.
- **Fallback příjmení při registraci bez příjmení je název firmy.** Trigger
  `handle_new_user` dosazuje `last_name = 'Team VYS'` → v DB jsou děti „Mytlepek Team VYS",
  „Deniel Team VYS", „Matyáš Team VYS". Chtělo by to doplnit skutečná příjmení a změnit fallback.
- **Supabase běží na FREE plánu a NEMÁ ŽÁDNÉ ZÁLOHY.** Org `rnmnlhlauakvsfypxbmt`
  („kropadave's Org"), plán `free`, compute NANO, region eu-west-1, Postgres 17.6.
  Free plán neumí PITR ani denní zálohy → v DB je 170 dětí, 132 rodičů a 85 reálných plateb
  bez možnosti obnovy. **Největší otevřené riziko celé platformy.**
- **Security advisors (16. 10. 2026):** 1× ERROR `security_definer_view` na
  `public.camp_medical_overview` (**opraveno 21. 11. 2026** — `security_invoker = true`); 6× tabulka s RLS bez policies (`coordinator_*`,
  `product_admin_info`, `product_interests` — záměr: service-role only); 40 `SECURITY DEFINER`
  RPC volatelných rolí `anon`; `teamvys_coach_session_is_workshop` a `teamvys_touch_document_slot`
  mají mutable `search_path`; vypnutá ochrana proti uniklým heslům v Auth.
- ~~**`workshop_xp_awards` měla otevřenou policy** `workshop_xp_awards prototype all`~~ — **zavřeno
  21. 11. 2026** (migrace `20261121150000_close_client_writes_purchases_workshop_xp.sql`). XP za
  workshop zapisuje jen SECURITY DEFINER RPC `teamvys_claim_workshop_xp(p_product_id,
  p_product_title, p_ts, p_coach_id, p_participant_id)`: smí ji volat přihlášený účastník sám za
  sebe nebo rodič za své dítě, XP počítá server z `coach_tricks` (1 ze 2 triků = polovina).
  Čtení: vlastník, rodič dítěte, staff. Dvojice triků workshopu je v té funkci **a** ve
  `vys-aplikace/lib/workshop-ticket.ts` (`workshopSkillIds`) — nový workshop doplnit na obou místech.
  Pozn.: řádek ve `workshop_xp_awards` je jen záznam, do `participants.xp` se nepřičítá (tak to
  bylo i dřív).
- ~~**`parent_purchases scoped write` dovolovala přihlášenému rodiči vložit vlastní řádek**~~ —
  **zavřeno 21. 11. 2026** (stejná migrace). Zápisová policy zrušena bez náhrady a rolím `anon`
  i `authenticated` odebrána práva INSERT/UPDATE/DELETE: do `parent_purchases` zapisuje **jen
  server** (service role). Žádný klient tam nepíše — admin jen čte. V appce odstraněn
  `addParentPurchase`; „Skrýt z profilu" u vypršelé workshop vstupenky ji schová jen v zařízení
  (`hideParentPurchase`, AsyncStorage), řádek nákupu zůstává jako doklad o platbě.
- **Kontaktní e-mail je rozdvojený.** `LEGAL_ENTITY` v obchodních podmínkách, `shared/content.ts`
  i `vys-aplikace/lib/public-content.ts` uvádějí **`ahoj@teamvys.cz`**, zatímco Stripe účtenky
  a Google Play mají **`info@teamvys.cz`**.
  **Rozhodnutí Davida (16. 10. 2026):** `ahoj@` je skutečná schránka, `info@` je skupina,
  ale navenek se má všude používat **`info@teamvys.cz`** → nahrazovat `ahoj@` za `info@`.
- **Telefon je rozdvojený.** V kódu a DB `734 167 417`, na plakátech a v náboru `602 120 115`.
- **Na webu není Meta Pixel ani GA4** → konverze z reklam se neměří.
- **Zastaralý duplikát repa** v `~/Desktop/VYSE-vše/Vys-app` (poslední commit 24. 9. 2026)
  a vedle něj `Vys-app (kopie)`. Celkem **24 GB**. Needitovat — pracovní kopie je v
  `~/Documents/GitHub/Vys-app`.
- **POZOR: „VYSE" není „VYS".** Složka `~/Desktop/VYSE-vše/` a Vercel projekty `vyse` / `vyse-app`
  patří k **úplně jinému, staršímu Davidovu projektu** (appka na online coaching) a s Team VYS
  nemají nic společného. Nemíchat je dohromady.

## Elektronické podpisy dokumentů rodičů (od 19. 11. 2026)

- Rodič podepisuje sloty z `document_slots` (šablona `document_templates.body` = intro/clauses/fields) v `vys-aplikace/components/document-slots-checklist.tsx`; brána před platbou `components/purchase-doc-gate.tsx` + server `assertRequiredDocumentsSigned`.
- **Podpis zapisuje jen server:** `POST /api/course-documents/sign` (`requireParentOrAdmin` + `assertParticipantAccessible`). Ukládá do `course_documents` navíc `signed_by_profile_id`, `signed_by_role` (parent / participant / **admin = zapsáno za rodiče**), `signed_at`, `signed_ip`, `signed_user_agent`, `template_snapshot` (celá šablona, jak ji rodič viděl), `template_version` (sha256 + updated_at), `legal_version`, `app_version`. Nahraný sken jde stejným endpointem (`scan: {path, filename}`), soubor se nahrává do storage z klienta.
- **Verzování:** podepsaný řádek se nikdy nepřepisuje. Nový podpis téhož slotu = nový řádek `version+1` (id s příponou `-v<N>`), starý dostane `superseded_by`. Čtení aktuálního stavu vždy filtrovat `superseded_by is null` (appka, admin, `assertRequiredDocumentsSigned`, vstupenka).
- **RLS** `course_documents parent write`: rodič z klienta nesmí vkládat/měnit řádky se `status='signed'` (čtení přes `scoped read` zůstává). Migrace `20261119120000_course_documents_signature_provenance.sql`.
- Po podpisu jde rodiči automatický e-mail (SMTP přes `paymentEmailer`, jen Team VYS org) se zněním dokumentu, hodnotami a časem podpisu.
- Admin (aplikacevys.cz, sekce dokumentů) ukazuje u podepsaného řádku kdo · kdy přesně · roli · verzi · IP a náhled „Znění dokumentu v okamžiku podpisu“ ze snapshotu.

## SMS leadům z reklam (od 23. 11. 2026)

Leady z Meta formulářů **nejsou v DB** — žijí v Google Tabulkách „Leady Meta - <Město>". Aby jim šla poslat SMS přes stejnou bránu (BulkGate) jako rodičům:

- **Tabulka `lead_sms_outbox`** (`supabase/migrations/20261123170000_lead_sms_outbox.sql`): `phone`, `body`, `city`, `dedupe_key` (unikát `telefon|město` → stejné číslo nedostane návod dvakrát), `status` queued → sending → sent/failed, `provider_response`. RLS zapnuté bez policies = jen service role.
- **`POST /api/lead-sms/flush`** (server.js, hned za `sendSmsToParents`): odešle, co je ve frontě (max 60 na zavolání, atomické převzetí řádku), vrátí `{sent, failed, remaining, credit}`. **Nepřijímá číslo ani text**, proto je veřejný — bez zápisu do DB přes něj nikdo SMS neodešle. Jen čísla +420, text bez diakritiky max 306 znaků (2 segmenty), **mimo 8–21 h neposílá** (vrací `deferred`).
- **Kdo do fronty zapisuje:** marketingový autopilot skriptem `~/.claude/scheduled-tasks/marketing-autopilot/lead_sms.py <Mesto> <telefony…>` (SQL přes `npx supabase db query --linked`, pak flush). Šablona SMS a rozvrhy měst jsou v tom skriptu — při změně rozvrhu upravit i tam.
- Kredit BulkGate: ~2 kredity za SMS (2 segmenty); stav vrací flush (`credit.credit`).
