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

## Core product — request & quote

Customers **do not browse a directory of professionals**. There is no pro search.
The whole product is one flow:

1. **Pick a service.** Home leads with the **most-requested** trades (electrician,
   plumber, AC…) and puts the remaining categories one tap away, on `/search` — 32
   tiles at once was a wall of choice. Which trades lead is **data, not code**:
   `categories.is_popular` / `popular_sort`, editable from the admin
   `/categories` page, so the home screen can be re-curated without an app
   release. The app falls back to a built-in list if nothing is flagged, and the
   grid is 4 tiles per row — a count that isn't a multiple of 4 leaves a ragged
   last row.
2. **Describe the job** — problem, photos, location — and choose **urgency**:
   `same_day` (costs the customer more) or `scheduled` (next day or later, with a
   preferred date/time).
3. **Every available professional in that trade is invited to quote.** A quote is a
   **price range** (`price_min`–`price_max`), an arrival time, and a message.
4. **The customer compares the responders** — their profile, rating, jobs completed,
   verified badge — and **accepts one** or declines individual quotes (declining leaves
   the request open for others).
5. **On acceptance the professional's phone number is revealed** (`get_contact_phone`
   RPC, gated so only the two parties can read it). They agree the details directly.
6. **On completion the professional records the `final_price`** — commission is
   computed from that figure into the `transactions` ledger.
7. **The customer rates the professional.**

Professional profiles are still fully viewable, but only reachable *from a quote* —
never from browsing.

- **Job lifecycle**: open → accepted → on the way → in progress → completed → rated.
  Every transition notifies the other side (DB triggers → `notifications` table → push).
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
- **Auth**: phone + password, no SMS provider and no per-message cost. Supabase needs a
  unique email per account, so each role gets its own synthetic address — and because
  they differ, **one phone number can hold both a customer and a provider account**:
  - customer → `<phone>@phone.dalconnect.app`, signs in with the phone
  - provider → `<provider_no>@pro.dalconnect.app`, signs in with a **six-digit number**
    (the last six digits of their phone, or a random free one if those are taken).
    Modelled on Dal's `merchantNo`; a 6-digit login can never be confused with a
    10-digit phone. Providers **register on their own track** — a customer account is
    never "upgraded".
  Phone numbers are **not verified yet** — see note #13.
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
10. **The legal text in `mobile/app/legal.tsx` is a DRAFT, not legal advice.** It
    exists so the app satisfies the store requirement that terms + a privacy policy
    are reachable in-app. Review it (and fill `LEGAL_CONTACT` — company name, support
    email) before public launch. The admin panel's `/legal` page overrides this text
    at runtime, so you can correct it without shipping a new build.
11. **Commission is currently modelled as 10% of each cash job** (`app_settings.commission_rate`,
    computed by a DB trigger into `transactions`). Be aware this is hard to *collect* —
    the customer pays the professional in cash directly, so the platform never touches
    the money and relies on pros self-reporting. The sibling Dal project hit exactly
    this wall and pivoted to a **flat monthly subscription per professional** plus a
    small buyer-side service fee. Worth deciding before you sign up real pros; the
    schema supports either (see the v2 backlog).
12. **Supabase free-tier projects pause when idle.** If API calls suddenly time out,
    check the project status — it may need restoring from the dashboard (this already
    happened once during development).
13. **Phone numbers are NOT verified — treat this as a launch blocker.** Anyone can
    register with a number they don't own. That matters more here than in a normal app,
    because the phone number *is* the product: it's what gets revealed to a customer
    once they accept a quote. A professional could sign up with a fake or someone
    else's number. The groundwork is in place (`profiles.phone_verified`, defaulting to
    false so no backfill is needed), but no OTP is sent. Deferred by decision — wire up
    Supabase phone auth with an SMS provider (Twilio/Vonage, roughly ₪0.10–0.20 per
    message) before real users.
14. **The "quick request" matcher runs on keywords, not AI, unless you turn AI on.**
    Home's *"don't know which service you need?"* card takes a free-text problem
    ("there's a leak under the sink") and names the trade. Two engines live in
    `mobile/lib/suggest.ts`: a local Arabic+Hebrew keyword matcher (free, instant,
    offline, **34/34** on the phrasings in `scripts/test-suggest.mjs`) and the
    `suggest-category` edge function, which asks Claude and handles paraphrase and
    typos the keyword table can't. The edge function is **written but not deployed**
    and the app never calls it unless `EXPO_PUBLIC_AI_SUGGEST=1`. To enable it:
    `supabase secrets set ANTHROPIC_API_KEY=...` → `supabase functions deploy
    suggest-category` → set the flag. Every AI failure (no key, not deployed, offline,
    8s timeout) silently falls back to keywords — verified in the same test — so the
    customer always gets an answer. **Editing the keyword table? Run
    `node scripts/test-suggest.mjs` after.**

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

Customers sign in with their **phone**; service providers sign in with their
**six-digit number** (the last six digits of their phone). Password for all: `123456`.

| Role | Sign in with | Who |
|------|--------------|-----|
| Customer | `0501111111` | زبون تجريبي |
| Admin (web panel) | `0503333333` | مدير النظام |
| Provider | `222222` | خدمات المدينة — electrician / plumber / AC |
| Provider | `000001` | كهرباء أبو يوسف — electrician + solar |
| Provider | `000002` … `000008` | plumber, AC, painter, carpenter, gardener, cleaner, mechanic |

Seeded by `scripts/seed-users.mjs` and `scripts/seed-demo-pros.mjs` (both idempotent).


## Scripts (`scripts/`)

One-off Node scripts used to provision the live Supabase project from this machine —
not part of the app runtime:
- `apply-migrations.mjs` — runs SQL files against the project via the Management API.
- `write-env.mjs` — fetches project API keys and writes `mobile/.env` +
  `admin/.env.local`.
- `seed-users.mjs` / `seed-demo-pros.mjs` — create the demo accounts above.
- `smoke-test.mjs` — end-to-end check (signup → RLS → RPCs → booking) against the live
  backend; creates and deletes its own throwaway user.
- `test-suggest.mjs` — the one that needs **no** backend: compiles `lib/suggest.ts` and
  runs real customer phrasings (both languages) through the quick-request matcher, plus
  every AI failure mode. Run it after touching the keyword table.

## v1 limitations / known gaps

- Payments are cash-only; no wallet, no card processing.
- Auth is phone+password, not real SMS OTP.
- No voice messages, coupons, or promoted-listing ads yet.
- Push requires the manual edge-function deploy + webhook step above.

## v2 backlog (designed for, not built)
- **Monthly subscription billing for professionals** — a `pro_billing` ledger, one row
  per pro per `YYYY-MM` period, with status pending/paid/waived and per-pro overrides
  (free months, discounts). Far more collectible than per-job commission on cash work.
  See important note #11.
- Card payments / Apple Pay / Google Pay via an Israeli PSP (PayPlus/Tranzila), wallet
  withdrawals for professionals.
- Real SMS OTP (Twilio/Vonage) replacing password auth.
- Coupons / promo codes with race-safe redemption.
- Saved job-site address book (a customer's home/office as reusable addresses).
- Shared-device fraud detection (flag when many accounts share one device id).
- Voice messages in chat.
