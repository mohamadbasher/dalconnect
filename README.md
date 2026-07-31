# DalConnect — دال كونكت

Service marketplace for Israel: customers find and book trusted local professionals
(electricians, plumbers, AC techs, cleaners, movers, and 20+ other trades). Arabic +
Hebrew, full RTL, light + dark mode. Sibling app to **Dal** (design language) and
**AutoHub** (architecture) — matches their look and Supabase patterns.

Status: **live backend, feature-complete v1 app**, not yet published to app stores.

## Structure

```
mobile/     Expo app (SDK 54, expo-router, Supabase) — customers + professionals
admin/      Next.js 15 admin panel (Tailwind v4, Dal-style RTL dashboard)
supabase/   SQL migrations (schema, RLS, triggers, seed) + the push edge function
scripts/    One-off Node scripts used to provision/seed the live Supabase project
docs/       AGENT_BRIEF.md — internal conventions & foundation API reference
```

## Core product

- **Two booking modes**: book a specific professional (direct), or create an **open
  request** — nearby professionals in that category get notified and send **price
  offers** (price + ETA + message); the customer compares and accepts one (atomic
  `accept_offer` RPC).
- **Job lifecycle**: pending/open → accepted → on the way → in progress → completed →
  rated. Every transition notifies the other side (DB triggers → `notifications` table
  → push).
- **Payments v1**: cash only. The app records the agreed price; a DB trigger computes
  platform commission (`app_settings.commission_rate`, default 10%) into a
  `transactions` ledger. No card/PSP integration yet — see backlog.
- **Chat**: realtime (Supabase Realtime), text / images / location, read receipts,
  typing indicator, failed-message retry.
- **Trust & safety**: verified-pro badge (ID upload → admin approval), stars-only
  reviews, reports/moderation, ban system, self-service account deletion.
- **Admin panel**: users, professionals + verification approvals, bookings, categories,
  cities, reviews, reports, banners, commission settings, push broadcasts.

## Tech stack

- **Mobile**: Expo SDK 54, expo-router (file-based nav), React Native 0.81, TypeScript
  strict, plain `StyleSheet` (no NativeWind), React Context for state (no
  Redux/Zustand), Cairo font (Arabic) + Rubik (Hebrew).
- **Backend**: Supabase — Postgres with row-level security on every table, SQL
  triggers for notifications/commission/ratings, one atomic RPC per multi-step
  operation (`accept_offer`, `become_professional`, `delete_account`), Storage for
  photos/avatars/ID docs, an Edge Function for push delivery.
- **Auth**: phone + password. Phones map to a synthetic email
  (`<digits>@phone.dalconnect.app`) — no SMS provider, no per-message cost. See backlog
  for real OTP.
- **Admin**: Next.js 15 App Router, `@supabase/ssr` cookie auth, server actions using
  the service-role key server-side only.

---

## ⚠️ Important notes — read before touching this repo

1. **No secrets are committed.** `.env`, `.env.local`, and `.supabase-dbpass.txt` are
   gitignored. `admin/.env.example` and `mobile/.env.example` contain placeholders
   only — real keys were written directly to the (gitignored) `.env`/`.env.local`
   files on the dev machine, never to git history.
2. **The Supabase project was provisioned with a management API token that was shared
   in plain chat during setup.** That token has broad account access. **Rotate/revoke
   it** in the Supabase dashboard (Account → Access Tokens) once you've confirmed
   everything works — it should not stay valid long-term.
3. **`SUPABASE_SERVICE_ROLE_KEY` (in `admin/.env.local`) bypasses all RLS.** It must
   only ever be read on the server (Next.js server actions/route handlers) — never
   prefix it with `NEXT_PUBLIC_`, never send it to the client.
4. **Demo/seed accounts exist in the live database** (see below) with the shared
   password `123456`. These are for testing only — **delete them or change their
   passwords before any real user data goes into this project**, and definitely
   before a public launch.
5. **The `professionals` ↔ `profiles` embed is ambiguous by default** in PostgREST
   (two relationships exist between them). Every query that joins them **must** use
   the explicit constraint name: `profile:profiles!professionals_id_fkey(*)`. Using
   plain `profiles(*)` will fail at runtime with "more than one relationship found."
   This bit us once already — grep for `professionals_id_fkey` before "simplifying"
   any of these queries.
6. **Email confirmation is disabled** on the Supabase Auth provider (`mailer_autoconfirm:
   true`) — required for the synthetic-email phone signup flow to work without SMS.
   Don't re-enable it without changing the auth flow.
7. **The push edge function is deployed to code but not wired up by default.** You
   must run `supabase functions deploy send-push` and add a Database Webhook
   (table `notifications`, event `INSERT` → the function URL) for push notifications
   to actually send. Everything else in the app works without this.
8. **RLS is the real security boundary**, not client-side checks — e.g. a customer
   cannot self-promote to `admin` (tested live), and `become_professional`/
   `accept_offer`/`delete_account` are all `SECURITY DEFINER` RPCs that validate
   `auth.uid()` internally. If you add new tables, add RLS policies in the same
   migration, not as an afterthought.
9. **This is a private business project** (aiming to be a leading Israeli service
   marketplace) — keep the GitHub repo private unless there's a specific reason to
   open it up.

---

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. Run the SQL in `supabase/migrations/` **in order** (SQL editor, or the
   `scripts/apply-migrations.mjs` helper used during development).
3. Auth → Providers → Email: **disable "Confirm email"** (see note #6 above).
4. Deploy the push function: `supabase functions deploy send-push`, then add a
   **Database Webhook**: table `notifications`, event `INSERT` → that function
   (include the service-role auth header).
5. Storage buckets (`avatars`, `booking-photos`, `gallery`, `chat-images`,
   `id-documents`, `banners`) are created by the seed migration.

### 2. Mobile app
```
cd mobile
npm install
copy .env.example .env   # fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start                # scan the QR with Expo Go
```

### 3. Admin panel
```
cd admin
npm install
copy .env.example .env.local   # URL, anon key, service-role key (server-only!)
npm run dev                    # http://localhost:3000
```
Promote a user to admin from the Supabase SQL editor:
`update profiles set role = 'admin' where phone = '05XXXXXXXX';`

## Demo accounts (testing only — see note #4)

| Role | Phone | Password |
|------|-------|----------|
| Customer | `0501111111` | `123456` |
| Service provider | `0502222222` | `123456` |
| Admin | `0503333333` | `123456` |

Plus 8 additional demo professionals (electrician, plumber, AC, painter, carpenter,
gardener, cleaner, mechanic) with phones `0521000001`–`0521000008`, same password —
so the marketplace has realistic listings while testing. All created via
`scripts/seed-users.mjs` and `scripts/seed-demo-pros.mjs` (safe to re-run; idempotent).

## Scripts (`scripts/`)

One-off Node scripts used to provision the live Supabase project from this machine —
not part of the app runtime:
- `apply-migrations.mjs` — runs SQL files against the project via the Management API.
- `write-env.mjs` — fetches project API keys and writes `mobile/.env` +
  `admin/.env.local`.
- `seed-users.mjs` / `seed-demo-pros.mjs` — create the demo accounts above.
- `smoke-test.mjs` — end-to-end check (signup → RLS → RPCs → booking) against the live
  backend; creates and deletes its own throwaway user.

## v1 limitations / known gaps

- Payments are cash-only; no wallet, no card processing.
- Auth is phone+password, not real SMS OTP.
- No voice messages, coupons, or promoted-listing ads yet.
- Push requires the manual edge-function deploy + webhook step above.

## v2 backlog (designed for, not built)
- Card payments / Apple Pay / Google Pay via an Israeli PSP (PayPlus/Tranzila), wallet
  withdrawals for professionals.
- Real SMS OTP (Twilio/Vonage) replacing password auth.
- Voice messages in chat; coupons; promoted/featured professionals.
