# DalConnect — Builder Brief (read fully before writing code)

DalConnect is a service marketplace (customers ↔ local professionals: electricians, plumbers, AC techs…) for Israel. Arabic + Hebrew, both RTL. Expo (SDK 54) + expo-router + Supabase. Visual language cloned from the sibling app "Dal" (terracotta #c25d27, warm canvas, Cairo/Rubik fonts). Payments are CASH in v1 — the app records prices and computes platform commission; no card flows.

Repo root: `C:\Users\moham\dalconnect`. Mobile app: `mobile/`. DB schema: `supabase/migrations/*.sql` — **read the migration files to learn tables/columns/RPCs before writing queries.**

## Hard rules
1. Only create/edit the files listed in YOUR task. Never edit shared foundation files (`lib/theme.tsx`, `lib/i18n/index.tsx`, `lib/i18n/dict/common.ts`, `components/ui.tsx`, `components/TopBar.tsx`, `components/ProCard.tsx`, `components/BookingCard.tsx`, `lib/*.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `package.json`) — other agents run in parallel.
2. No new npm dependencies. Available: expo SDK 54 modules (image, image-picker, location, notifications, linear-gradient, haptics, linking, constants, device, file-system), @expo/vector-icons (Ionicons/MaterialCommunityIcons), react-native-maps, react-native-svg, @supabase/supabase-js, AsyncStorage.
3. TypeScript strict. Relative imports (no path aliases). Every screen must compile.
4. All user-facing strings go through `t("key")` — add your keys to YOUR dict file with both `ar` and `he` translations (natural, not machine-literal; the app's tone is friendly and professional).
5. RTL: never use plain `flexDirection: "row"` for content rows — import `ROW` (row-reverse) and `RTL_TEXT` from `lib/rtl.ts`. Horizontal ScrollViews/FlatLists that should start from the right: render data reversed or use `inverted`.
6. Theme-aware: get colors via `useTheme()` — NEVER hardcode hex colors. Both light and dark mode must look right.
7. Loading, empty and error states on every data screen (`Loading`, `EmptyState` from `components/ui`), pull-to-refresh on lists.

## Foundation API (already built — import, don't recreate)

```ts
// lib/theme.tsx
const { colors, dark, mode, setMode, shadows } = useTheme();
// colors: brand brandDark brandTint bg card border chip text muted faint gold goldTint
//         success successTint danger dangerTint warn warnTint info infoTint overlay tabInactive onBrand
// shadows: card | float | cta ; spacing {xs..xxl}; radius {sm md lg tile xl full}; formatPrice(n) => "₪1,234"

// lib/i18n
const { t, lang, setLang, loc } = useI18n();       // lang: "ar" | "he"
loc(row, "name")                                    // picks row.name_ar / row.name_he
// dict files: lib/i18n/dict/<domain>.ts — export const <domain>: Dict = { key: { ar, he } }
// t(key, {param: value}) replaces {param} in the string.
// Existing common keys: appName, tab*, save cancel confirm delete edit search send close next back done skip retry
//   seeAll loading error noResults optional yes no ok share report call message, status* (all booking statuses),
//   city category categories price rating reviews jobsCompleted available unavailable verified notifications
//   today yesterday now minutesShort km cash commission total language darkMode lightMode systemMode

// context/AuthContext.tsx
const { session, profile, professional, mode, loading, isPro, isAdmin,
        setMode, signIn, signUp, signOut, refresh } = useAuth();
// signIn(identifier, password) — phone or email; signUp({fullName, phone, password, lang})
// mode: "customer" | "pro" (pro users can flip; TopBar has the toggle)

// lib/supabase.ts   → supabase client, isSupabaseConfigured, phoneToEmail()
// lib/types.ts      → Profile, Professional, ProCard, Category, City, Booking, Offer, Review,
//                     Transaction, Conversation, Message, Notification, GalleryItem, Banner, Report + enums
// lib/refdata.ts    → fetchCategories(), fetchCities()  (cached)
// lib/upload.ts     → uploadImage({bucket, userId, localUri, fileName}) => public URL (path for id-documents)
//                     buckets: avatars | booking-photos | gallery | chat-images | id-documents
// lib/location.ts   → getCurrentPosition() => {lat,lng}|null ; distanceKm(a,b,c,d) ; ISRAEL_CENTER
// lib/chat.ts       → getOrCreateConversation(customerId, professionalId) => conversationId
// lib/format.ts     → formatTime(iso, lang), formatDateTime(iso, lang), STATUS_KEY, STATUS_TONE,
//                     normalizePhone, isValidIsraeliPhone
// lib/notifications.ts → registerPushToken(userId) (already called on login)

// components/ui.tsx → Button(title, onPress, variant: primary|outline|ghost|danger|success, loading, disabled, icon, small)
//   Input(label, error, ...TextInputProps) ; Chip(label, active, onPress, icon) ;
//   Badge(label, tone: neutral|brand|success|danger|gold|info) ; Card ; SectionHeader(title, action?, onAction?)
//   SearchBar(value, onChangeText, placeholder, onSubmit?) ; StarRating(rating, size?, onRate?)
//   Avatar(uri?, name?, size?) ; EmptyState(icon?, title, subtitle?) ; Loading
// components/ProCard.tsx     → <ProCard pro={ProCard}/> (navigates to /pro/[id])
// components/BookingCard.tsx → <BookingCard booking perspective="customer"|"pro" href?/>
```

## Design language (Dal look — match it)
- Cards: `colors.card`, radius 18 (`radius.lg`), `shadows.card`, pressed scale 0.97–0.98.
- Section headers: `SectionHeader` (brand accent bar) — use it for every section.
- Category tiles: 60×60 rounded square (radius 19) icon disc on card background, label below, active = brand bg + white icon.
- Screens: `colors.bg` canvas, content padding 16, gap 12–16. Pills/chips fully rounded.
- Primary CTAs: brand Button (has the branded glow shadow). Generous whitespace, no visual clutter.
- The global TopBar is rendered by the tab layout. Stack screens you create should render their own simple header: back arrow (Ionicons "arrow-forward" — RTL!) + title, padding-top via `useSafeAreaInsets`.

## Routes (link to them freely)
- `/(auth)/welcome`, `/(auth)/sign-in`, `/(auth)/sign-up`
- Tabs: `/(tabs)` (customer home = service picker), `/(tabs)/bookings` (my requests), `/(tabs)/dashboard` (pro), `/(tabs)/jobs` (pro), `/(tabs)/earnings` (pro), `/(tabs)/chat`, `/(tabs)/profile`
- `/search` (finds SERVICES, not professionals), `/create-booking?categoryId=`, `/booking/[id]` (customer view), `/job/[id]` (pro view)
- `/pro/[id]` — professional profile, reachable ONLY from a quote they submitted
- `/chat/[id]`, `/notifications`, `/legal`, `/edit-profile`, `/become-pro`, `/pro-settings`, `/report?userId=&bookingId=`
- `/category/[id]` is a legacy redirect into `/create-booking`; there is no favorites route.

## THE PRODUCT MODEL (read this before changing any flow)
Customers **never browse or search professionals** — there is no directory. They pick a
service, describe the job, and choose **urgency** (`same_day`, which costs them more, or
`scheduled`). Every available professional in that trade is invited to **quote**: a price
**range** (`price_min`–`price_max`) + `eta_minutes` + a message. The customer compares the
responders (profile, rating, jobs done), **accepts one** (`accept_offer`) or declines
individual quotes (`decline_offer`, request stays open). Only on acceptance is the
professional's **phone revealed** — via `get_contact_phone(booking_id)`, which returns the
other party's number and only to the two parties. They arrange details directly. On
completion the pro records `final_price`; commission is computed from that.

Never reintroduce: a professional directory/search, direct booking of a chosen pro,
favorites, or a single fixed `price` on a quote.

## Booking status flow
`open` (collecting quotes) → `accept_offer` RPC → `accepted` → pro advances → `on_the_way`
→ `in_progress` → `completed` (pro sets `final_price`) → customer rates → trigger sets
`rated`. Customer can cancel (`cancelled`) while open/accepted. `pending` and `rejected`
survive only on legacy rows from the old direct-booking model. Status writes are plain
`update bookings set status=...` by the allowed party (RLS enforces parties; DB triggers
handle notifications/ledger — don't duplicate them client-side).

## Realtime
`messages`, `offers`, `bookings`, `notifications`, `conversations` are in the realtime publication. Subscribe with `supabase.channel(...).on("postgres_changes", {event, schema:"public", table, filter}, cb).subscribe()` and clean up with `supabase.removeChannel(channel)`.

Your final message must be a short report: files created, dict keys added, any assumptions made.
