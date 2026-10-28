# DalConnect — دال كونكت

**A home-services marketplace app for Israel.** Customers describe a job, local professionals (electricians, plumbers, AC technicians, cleaners and 20+ other trades) send price quotes, and the customer picks one. Arabic and Hebrew, fully right-to-left, with light and dark mode.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)

**Status:** live backend and a feature-complete v1 app, not yet published to the app stores.

## How it works

1. **Pick a service.** The home screen leads with the most-requested trades. Which trades appear
   there is data the admin can change, not code, so it can be re-curated without an app release.
2. **Describe the job**: problem, photos, location, and urgency (same day or scheduled).
3. **Every available professional in that trade is invited to quote** a price range and arrival time.
4. **The customer compares quotes** by profile, rating, completed jobs and verified badge, and accepts one.
5. **Only then is the professional's phone number revealed**, and only to the two parties.
6. **The job moves through its lifecycle** (accepted → on the way → in progress → completed → rated),
   and every step notifies the other side by push notification.

Not sure which trade you need? Type the problem in plain words ("there's a leak under the sink")
and the app suggests the right one, using an offline Arabic + Hebrew keyword matcher with an
optional AI fallback.

## Features

- **Customer app and professional app in one codebase**, with separate sign-in tracks for each role
- **Realtime chat** with text, images, location, read receipts, typing indicator and retry on failure
- **Trust and safety:** ID verification for professionals (admin-approved), reviews, reports,
  moderation, bans, and self-service account deletion
- **Commission ledger:** a database trigger computes the platform fee from each completed job
- **Admin panel (Next.js):** users, professional verification, bookings, categories, cities,
  reviews, reports, banners, commission settings and push broadcasts

## Engineering highlights

- **Security lives in the database.** Every table has row-level security (RLS), and every
  multi-step operation (accepting a quote, becoming a professional, deleting an account) is one
  atomic Postgres function that checks the caller itself.
- **Attack-tested, not just reviewed.** `scripts/security-audit.mjs` signs in as a real customer and a
  real professional and *tries* the attacks against the live backend. It found seven real holes,
  for example a customer closing their own job with a price of 0, or a professional granting
  themselves the verified badge. All seven were closed with migrations and re-verified by the
  same script.
- **Column-level protection on top of RLS.** RLS controls which rows you can write, not which
  columns, so guard triggers stop users from editing fields they shouldn't (price, status,
  rating). The trigger order is deliberate and documented.
- **Phone privacy:** the `phone` column is hidden from table reads entirely and is only returned
  by a function that checks the caller is a party to an accepted job.
- **Push notifications without a custom server:** database triggers write notifications, and an
  Edge Function delivers them through Expo push.
- **18 SQL migrations and 14 automated test and audit scripts** covering the quote flow,
  booking guards, chat integrity, phone privacy, notification routing and provider approval.

## Tech stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 54, React Native 0.81, Expo Router, TypeScript (strict) |
| Backend | Supabase: PostgreSQL with RLS, SQL triggers and functions, Realtime, Storage, Edge Functions |
| Admin | Next.js 15 (App Router), Tailwind CSS v4, server actions |
| Languages | Arabic and Hebrew, full RTL |

## Project structure

```
mobile/     Expo app for customers and professionals
admin/      Next.js admin panel
supabase/   SQL migrations (schema, RLS, triggers, seed) and Edge Functions
scripts/    provisioning, seeding, end-to-end tests and the security audit
docs/       developer notes and internal conventions
```

## Run it locally

You need your own Supabase project. Full setup steps, including migrations, storage buckets and
the push webhook, are in [docs/DEVELOPER-NOTES.md](docs/DEVELOPER-NOTES.md#setup).

```bash
# mobile app
cd mobile
cp .env.example .env      # add your Supabase URL and anon key
npm install
npx expo start

# admin panel
cd admin
cp .env.example .env.local
npm install
npm run dev
```

---

Built by [Mohamad Basher](https://github.com/mohamadbasher).
