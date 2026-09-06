# TeamVYS

Parkourová komunita s mobilní aplikací (Expo) a webem (Next.js). Jedna sdílená Supabase databáze.

## Struktura repa

> Mobilní aplikace (Expo) byla vyčleněna do **samostatného projektu `vys-aplikace/`**
> (vlastní git repo, vedle této složky). Tohle repo `Vys-app/` obsahuje už jen
> web, backend a databázi. Aplikace se sdílenou Supabase databází zůstává propojená.

```
Vys-app/
├── teamvys.cz/       Next.js 15 — public web + platby (rodič, admin)
│   └── Stripe Checkout, Supabase Auth, server actions
├── shared/           Sdílený TypeScript kód (content, brand tokens, types)
├── server/           Express API (Stripe + Supabase service role)
├── supabase/         DB schéma + migrace + Edge functions
└── docs/             Dokumentace architektury

../vys-aplikace/     Expo — mobilní app (účastník, trenér, admin) — App Store / Play Store
```

## Kdo se kde přihlašuje

| Role         | Web (Next.js)         | Mobile (Expo)             |
|--------------|------------------------|----------------------------|
| **Rodič**    | ✅ rezervace + platby Stripe  | ❌ pouze pohled na děti |
| **Admin**    | ✅ správa produktů, financí   | ❌                       |
| **Účastník** | ❌                            | ✅ skill tree, XP, triky |
| **Trenér**   | ❌                            | ✅ docházka, QR, svěřenci |

Důvod rozdělení: **App Store / Play Store** berou 30 % poplatek z in-app digital purchases. Stripe v EU bere ~1,4 % + 5 Kč. Platby tedy běží jen přes web.

## Rychlý start

```bash
# Instalace dependencies pro všechny projekty
npm run install:all

# Spustit web (Next.js, port 3000)
npm run web

# Mobilní app se spouští ze samostatné složky ../vys-aplikace:
#   cd ../vys-aplikace && npm run start

# Spustit Express API (port 3001)
npm run server
```

## Sdílená databáze

Obě klientské aplikace (web i mobile) používají stejný Supabase projekt:

- **Web** se připojuje přímo přes `@supabase/ssr` (server components) a `@supabase/supabase-js` (client).
- **Mobile** se připojuje přes `@supabase/supabase-js` + `AsyncStorage` pro session.
- **Server** (`server/`) používá `SUPABASE_SERVICE_ROLE_KEY` pro admin operace (Stripe webhooks, payouts).

Schema migrace jsou v `supabase/migrations/`. Edge functions v `supabase/functions/`.

## Environmenty

`.env` soubory:
- `.env` — root (sdílené env vars)
- `teamvys.cz/.env.local` — Next.js public + server vars
- `vys-aplikace/.env` — Expo `EXPO_PUBLIC_*` proměnné
- `server/.env` — Stripe secret + Supabase service role

Pro potvrzení plateb e-mailem backend navíc čte `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` a `SMTP_FROM` (případně `PAYMENT_CONFIRMATION_FROM`). E-mail příjemce se bere z aktuálního `app_profiles.email` rodiče.

Vzorové soubory: `.env.example` (root), `teamvys.cz/.env.example`, `vys-aplikace/.env.example`, `server/.env.example`.
