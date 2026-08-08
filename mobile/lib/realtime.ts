// Supabase caches channels by topic: `supabase.channel(topic)` hands back an
// EXISTING channel if one with that topic is still registered, and calling
// `.on(...)` on an already-subscribed channel throws
//   "tried to subscribe multiple times" / "cannot add postgres_changes
//    callbacks after subscribe".
//
// That bites whenever a topic can be live twice at once — a component rendered
// on several screens, the same detail screen pushed twice, or an effect that
// re-runs before `removeChannel` (which is async) has finished tearing the old
// one down.
//
// Fixing it per-case is whack-a-mole, so every subscription gets a topic that
// is unique to that particular subscribe call.
let counter = 0;

/** A fresh, never-reused channel topic. Call it inside the effect that subscribes. */
export function channelTopic(prefix: string): string {
  counter += 1;
  return `${prefix}#${counter}`;
}
