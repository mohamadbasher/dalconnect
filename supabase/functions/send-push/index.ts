// DalConnect — send-push edge function
// Wire a Database Webhook (INSERT on public.notifications) to this function.
// It looks up the user's Expo push tokens and forwards the notification.
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database webhook shape: { type: 'INSERT', table, record, ... }
    const record = payload.record ?? payload;
    if (!record?.user_id) {
      return new Response("no user_id", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", record.user_id);
    if (error) throw error;
    if (!tokens?.length) return new Response("no tokens", { status: 200 });

    // Send in the recipient's own language (rows carry both; older rows only
    // have the legacy title/body).
    const { data: profile } = await supabase
      .from("profiles")
      .select("lang")
      .eq("id", record.user_id)
      .maybeSingle();
    const he = profile?.lang === "he";
    const title = (he ? record.title_he : record.title_ar) || record.title || "";
    const body = (he ? record.body_he : record.body_ar) || record.body || "";

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body: body || undefined,
      data: record.data ?? {},
      sound: "default",
      channelId: "default",
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    // prune tokens Expo says are dead
    const tickets = Array.isArray(result?.data) ? result.data : [];
    const dead: string[] = [];
    tickets.forEach((ticket: any, i: number) => {
      if (ticket?.details?.error === "DeviceNotRegistered") dead.push(messages[i].to);
    });
    if (dead.length) {
      await supabase.from("push_tokens").delete().in("token", dead);
    }

    return new Response(JSON.stringify({ sent: messages.length, pruned: dead.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 500 });
  }
});
