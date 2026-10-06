# Vys-app — backend + web teamvys.cz

Tohle repo: Express API server (`server/`), public web (`teamvys.cz/`), Supabase migrace (`supabase/`), sdílený kód (`shared/`), dokumentace (`docs/`).
Mobilní/web aplikace pro rodiče+trenéry je v **samostatném repu** `/Users/davidkropac/Desktop/vys-aplikace`.
Admin web běží z **`/Users/davidkropac/Desktop/aplikacevys.cz`** (aplikacevys.cz) — NE z tohoto repa.

## Jazyk a pravidla
- Uživatel (David) je Čech — **vždy odpovídat česky**.
- Commit, push, build i deploy dělat rovnou bez ptaní (stálé svolení).
- E-maily lidem NEPOSÍLAT — David chce hotové texty, posílá si je sám.

## Deploy serveru — POZOR
Vercel projekt `server` (prj_10j4ed9mkGUeYVMTiC2fVjqOds9b) má root-directory = `server`.
**Deploy VŽDY z kořene repa**, jinak CLI selže ("path …/server/server does not exist"):
```bash
cd /Users/davidkropac/Documents/GitHub/Vys-app && npx vercel deploy --prod --yes
```
Produkční URL API: `https://server-psi-ochre-40.vercel.app` (používá ji `lib/api-client.ts` ve vys-aplikace).
Web teamvys.cz = Vercel projekt `vys-web`, auto-deploy z GitHubu NEJEDE → nasazovat ručně z kořene repa.

## Git push (token z Keychain)
```bash
TOKEN=$(security find-generic-password -s "GitHub - https://api.github.com" -a kropadave -w) && \
git -c credential.helper= -c "http.https://github.com/.extraheader=Authorization: Basic $(printf 'kropadave:%s' "$TOKEN" | base64)" push origin main
```

## Supabase (produkce)
- Projekt `qbelgyhzdjexhlrvttxc`, přístup přes Supabase MCP (`execute_sql` / `apply_migration`).
- `VYS_ORG_ID = '00000000-0000-4000-8000-000000000001'` (Team VYS).
- **Datové typy — pozor:** `participants.id` je TEXT, `organizations.id` je uuid. `digital_passes.expires_at` a `last_scan_at` jsou **TEXT s mixem formátů** (ISO i české `d.m.yyyy`) → na serveru parsovat přes `parseFlexibleDate()`.
- `organizations` NEMÁ UPDATE RLS policy → admin zápisy jen přes SECURITY DEFINER RPC (např. `teamvys_update_nfc_settings`).
- Trenéři nesmí přímo UPDATE `participants` → RPC `teamvys_set_nfc_card_status` hlídané přes `teamvys_is_staff()`.
- `parent_notifications`: povinné `org_id`; idempotence přes deterministická `id` + upsert `ignoreDuplicates`.

## server/server.js — Stripe tok
- Webhook `/api/stripe/webhook` → `payment_intent.succeeded` → `finalizePaymentIntent` → `purchaseRowFromPaymentIntent` (vyžaduje metadata `product_id/participant_id/participant_name/type/title`; řádek id `stripe-pi-<pi.id>`) → upsert `parent_purchases` → `syncPaidPurchaseSideEffects` (produkt, kapacita, enrollment, `parent_payments` řádek `payment-<purchase.id>`, digitální permanentka).
- **NFC poplatek se odbavuje DŘÍV než generická větev** (metadata `nfc_fee === '1'` → `finalizeNfcFeePayment`), protože `getProduct('nfc-card-fee')` by spadl. Detaily: `docs/nfc-karticka-zaloha.md`.
- Externí organizace: `getOrgStripe`/`requireOrgStripe`; Team VYS jede přes platformní Stripe.

## Důležité záznamy
- Legal verze webu: aplikacevys.cz `src/components/legal/legal-layout.tsx` (`LEGAL_VERSION`) + vys-aplikace `lib/legal.ts` — **bumpovat obě současně** při změně podmínek.
- Platby rodičů jen přes web/aplikaci (Stripe), ne in-app purchases (30% poplatek storů).
