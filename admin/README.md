# DalConnect — Admin Panel

Arabic-RTL web dashboard for the DalConnect service marketplace (Next.js 15 App Router + Tailwind CSS v4 + Supabase).

## Setup

1. **Environment** — copy `.env.example` to `.env.local` and fill in:

   | Variable | Description |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (same project as the mobile app) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **server-only**, used by server actions for admin mutations, ID-document signed URLs and banner uploads |

2. **Install & run**

   ```bash
   npm install
   npm run dev
   ```

   Production: `npm run build && npm start`.

3. **Admin account** — sign-in requires a profile with `role = 'admin'`:

   ```sql
   update profiles set role = 'admin' where id = '<auth user uuid>';
   ```

   The login form accepts an email **or** a phone number — phone numbers are mapped to the mobile app's synthetic emails (`<digits>@phone.dalconnect.app`).

## Pages

- `/` overview stats + latest bookings & reports
- `/users` search + ban/unban
- `/professionals` directory + pending ID verifications (approve/reject, signed document links)
- `/bookings` status-filtered list, `/bookings/[id]` detail with offers, photos and admin cancel
- `/categories`, `/cities` inline CRUD
- `/reviews` moderation (delete)
- `/reports` status workflow
- `/banners` image upload to the `banners` bucket + ordering/toggle
- `/settings` platform commission rate
- `/notifications` broadcast to all / customers / professionals (capped at 5000 recipients; pushes are delivered by the DB-webhook → edge function pipeline)

## Notes

- Middleware (`src/middleware.ts`) refreshes the Supabase session and redirects signed-out visitors to `/login`; the dashboard layout additionally verifies `profiles.role = 'admin'` and signs out anyone else.
- Every server action re-verifies the admin role (`requireAdmin()`) before using the service-role client.
- UI strings live in `src/lib/strings.ts` (Arabic-only for v1 — structured so Hebrew can be added later).
