# Supabase setup

This app uses Supabase for dynamic prototype data when these environment variables are set:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Setup steps:

1. Create a Supabase project.
2. Apply the SQL migrations in `supabase/migrations/`. The app schema is mirrored there, so a clean Supabase project does not need hidden/manual tables.
3. If you do not use the Supabase CLI, open the SQL editor and run `supabase/migrations/20260506120000_teamvys_app_schema.sql`, then `supabase/migrations/20260504120000_create_invoices_table.sql`.
4. Copy your project URL and anon key into `.env` using `.env.example` as the template.
5. Restart the Expo dev server.

Auth/dev mode:

- Web and mobile use real Supabase Auth by default.
- Keep `EXPO_PUBLIC_DEV_BYPASS_AUTH=false`, `EXPO_PUBLIC_DEV_BYPASS_ROLE_GUARD=false`, and `NEXT_PUBLIC_DEV_BYPASS_AUTH=false` in production/Vercel.
- To bypass login locally, set `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` for the web app or `EXPO_PUBLIC_DEV_BYPASS_AUTH=true` for Expo.
- To bypass Expo role routing locally, set `EXPO_PUBLIC_DEV_BYPASS_ROLE_GUARD=true`.

Email verification and sender setup:

1. In Supabase Dashboard open Authentication -> Providers -> Email and enable email confirmations.
2. In Authentication -> URL Configuration set Site URL to the production app URL and add redirect URLs for both production frontends:
	- `https://app.aplikacevys.cz/*`
	- `https://vys-web.vercel.app/*`
	- local dev URLs when needed, for example `http://localhost:8081/*` and `http://localhost:3000/*`
3. In Authentication -> Emails/SMTP enable custom SMTP so mails are sent from your domain instead of the default Supabase sender.
4. Fill SMTP host, port, username, password/API key, sender email, and sender name. Recommended sender: `TeamVYS <noreply@your-domain.cz>`.
5. Add the DNS records required by your mail provider: SPF, DKIM, and DMARC. Without these records, confirmation emails may land in spam.

Stripe test setup:

1. Keep the publishable key in `.env` as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Store the secret key only in Supabase, never in the Expo app:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

3. Deploy the Edge Functions:

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-confirm-checkout
supabase functions deploy stripe-send-coach-payout
```

4. For trainer payouts, add the trainer's Stripe Connect account ID (`acct_...`) in the admin finance screen before pressing `Vyplatit`.

Database-backed prototype data:

- parent purchases
- Stripe Checkout session IDs for confirmed purchases
- parent attendance notifications
- physical bracelet confirmations
- profiles and linked participants
- products, FAQs, parent payments, and digital passes
- coach sessions, detailed wards, NFC chip assignments, attendance records, QR events, and manual trick awards
- trainer profile photos shown next to assigned public and parent course listings
- full five-level skill tree trick catalog for trainer QR generation
- coach leaderboard, reward path, and payouts
- monthly Stripe Connect payout transfer history for coaches
- parent reviews and 1-5 trainer ratings visible to coaches and admin

Coach payouts use `500 Kč` per logged training hour in the prototype schema and runtime calculation.
Coach payout transfers are locked to one successful transfer per coach and `YYYY-MM` period. A payout for a month can be sent from the first day of the following month.

If Supabase env vars are missing or a table is not available yet, the app keeps working with AsyncStorage fallback for local prototyping.
