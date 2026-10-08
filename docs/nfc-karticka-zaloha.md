# NFC kartička se zálohou (poplatek 100 Kč)

Zavedeno 2026-10-06. Funkce pokrývá vydávání NFC kartiček dětem, jejich vracení a poplatek při nevrácení/ztrátě/zničení.

## Byznys pravidla
- Trenér vydá dítěti NFC kartičku → zaškrtne v trenérské appce.
- Kartička se vrací: při ukončení kroužku, do **lhůty** (Team VYS: 14 dní) od vypršení permanentky (10/10 vstupů nebo expirace), pokud není koupena nová permanentka.
- Nákup nové permanentky odpočet **resetuje/ruší**.
- Ztráta/zničení → poplatek lze zaplatit **okamžitě** (bez odpočtu).
- Po vypršení lhůty → rodiči se v aplikaci objeví tlačítko platby; platí se **jen kartou přes Stripe** (vše evidováno).
- Celou funkci lze per-organizace vypnout v adminu; lhůta a výše poplatku konfigurovatelné.

## Databáze (migrace: `nfc_card_deposit_feature`, `nfc_return_countdown_column`, `nfc_settings_admin_rpc`)
- `organizations`: `nfc_deposit_enabled` bool (default false; Team VYS true), `nfc_return_deadline_days` int (14), `nfc_deposit_fee` int (100).
- `participants`: `nfc_card_status` text — `none | issued | returned | lost | fee_paid` (+ check constraint), `nfc_card_issued_at`, `nfc_card_returned_at`, `nfc_fee_paid_at` timestamptz, `nfc_fee_payment_intent_id` text, `nfc_return_countdown_started_at` timestamptz.
- RPC `teamvys_set_nfc_card_status(p_participant_id text, p_status text)` — SECURITY DEFINER, jen `teamvys_is_staff()`; `fee_paid` odmítá (nastavuje jen server service-rolí). `issued` nastaví issued_at a vyčistí ostatní; `returned` nastaví returned_at; `none` vše vyčistí.
- RPC `teamvys_update_nfc_settings(p_org_id, p_enabled, p_deadline_days, p_fee)` — SECURITY DEFINER; povoleno super_adminovi nebo adminovi dané organizace (organizations nemá UPDATE RLS policy).

## Server (`server/server.js`)
- Konstanty: `NFC_FEE_PRODUCT_ID='nfc-card-fee'` (syntetický produkt, parent_purchases nemá FK na product_id), `NFC_FEE_TITLE='Poplatek za nevrácenou NFC kartičku'`.
- `parseFlexibleDate()` — digital_passes mají TEXT datumy v mixu formátů (ISO + `d.m.yyyy`).
- `participantHasActiveCoursePass()` — aktivní = zbývající vstupy && neexpirováno; pass_kind `course` (fallback nfc_chip_id začíná 'NFC').
- `nfcCardStateForParticipant()` — líně **persistuje kotvu odpočtu**: když `issued` + žádná aktivní permanentka → zapíše `nfc_return_countdown_started_at = now()`; když se objeví aktivní permanentka → kotvu smaže. Počítá `countdown {startedAt, dueAt, daysLeft, overdue}`. `canPayFee = enabled && fee>0 && (lost || (issued && overdue))`.
- Notifikace rodičům (`parent_notifications`, idempotentní id `nfc-countdown-<pid>-<YYYY-MM-DD>` / `nfc-overdue-…`, upsert ignoreDuplicates, method `NFC kartička`).
- `GET /api/parent/nfc-card/:participantId` — requireParentOrAdmin + assertParticipantAccessible; vrací enabled/status/fee/deadlineDays/countdown/canPayFee.
- `POST /api/payments/nfc-fee/checkout` — validace (409 když vypnuto / fee_paid / none|returned / !canPayFee); Stripe Checkout session, locale cs, metadata `nfc_fee='1'` + product_id `nfc-card-fee` + type `Poplatek`.
- Webhook: `finalizePaymentIntent` na začátku odbočí `metadata.nfc_fee === '1'` → `finalizeNfcFeePayment` (MUSÍ být před generickou větví — `getProduct` by na syntetickém produktu spadl). Zapíše parent_purchases, přepne participanta na `fee_paid`, vynuluje kotvu, synchronizuje parent_payments, pošle potvrzovací e-mail.
- `syncPaidPurchaseSideEffects`: při nákupu typu `Kroužek` smaže kotvu odpočtu (status issued).

## Klienti
- **Trenér** (`vys-aplikace/app/(coach)/ward-detail.tsx`): panel „NFC kartička (záloha)" — tlačítka Vydána / Vrácena / Ztracena-zničena přes RPC; zobrazuje se jen když `organizations.nfc_deposit_enabled`. Typy v `lib/coach-content.ts` (`NfcCardStatus`, `nfcCardStatusLabel`), data v `hooks/use-coach-wards.ts`.
- **Rodič** (`vys-aplikace/app/(parent)/deti.tsx`): karta „NFC kartička" — stav, odpočet (dny + datum), tlačítko `Zaplatit poplatek X Kč kartou` (jen při canPayFee) → `apiClient.nfcFeeCheckout` → Stripe Checkout URL. API metody `nfcCardStatus` / `nfcFeeCheckout` v `lib/api-client.ts`.
- **Admin** (`aplikacevys.cz/src/components/admin/admin-dashboard.tsx`, FinanceOverviewSection): panel „NFC kartičky – záloha" — toggle, lhůta, poplatek → RPC `teamvys_update_nfc_settings`.
- **Podmínky**: klauzule v `aplikacevys.cz/src/app/obchodni-podminky/page.tsx` (sekce 5); LEGAL_VERSION `2026-10-06` v obou repech.

## Dodatečné odsouhlasení podmínek (2026-10-07)
Rodiče registrovaní před verzí `2026-10-06` mají v `app_profiles.terms_version` starou hodnotu (`2026-07-11` nebo NULL) → klauzuli o kartičce nikdy neodsouhlasili.
- Hook `vys-aplikace/hooks/use-legal-consent.ts` (`useLegalConsent`) porovná `terms_version` s `LEGAL_VERSION`; `accept()` zapíše novou verzi + `terms_accepted_at` (RLS „app_profiles own update").
- Komponenta `vys-aplikace/components/legal-consent-required-card.tsx` — žlutá karta s checkboxem; vykreslená v `app/(parent)/rodic.tsx` a `app/(parent)/platby.tsx`, po potvrzení zmizí.
- `startPurchase()` v `platby.tsx` nákup zablokuje, dokud souhlas chybí.
- Jednorázové upozornění rozesláno přes `parent_broadcasts` + `parent_broadcast_recipients` (audience `selected`, 113 rodičů Team VYS).
- Admin sekce NFC kartičky ukazuje panel „Souhlas s podmínkami o NFC kartičce" (Potvrzeno / Čeká).

## Sklad kartiček vs. spárované čipy (2026-10-07)
Sklad se původně počítal jen z `participants.nfc_card_status='issued'`, takže už nahrané čipy sklad nesnížily (admin hlásil 230 ks na skladě, i když 64 kartiček bylo fyzicky u dětí).
- `NfcCardsSection` v adminu načítá navíc `digital_passes` (`participant_id, holder_name, nfc_chip_id` where `nfc_chip_id is not null`) → `chipParticipantIds`.
- `chipOnlyOut` = děti se spárovaným čipem, které **nemají žádný záznam v `cards`** (tj. `nfc_card_status` je `none`/NULL). Filtr proti dvojímu počítání a proti držení „vrácených" kartiček venku (čip v `digital_passes` po vrácení zůstává).
- `cardsOut = issuedCalm + withCountdown + chipOnlyOut`; `cardsInStock = purchased − cardsOut − cardsGone`.
- **Odpočet na vrácení spárovaný čip nespouští** — kotvu `nfc_return_countdown_started_at` zapisuje server až pro status `issued`, takže rodičům nehrozí poplatek, dokud trenér neodklikne „Vydána". Proto se status v DB záměrně nebackfilloval.
- Nový dlaždice „Z toho spárovaný čip" + vysvětlující věta pod přehledem.
