// Chat integrity (migration 20260714000013).
//
// The first audit pass skipped these ("no conversation to test with") and both
// turned out to be open: a customer could rewrite the professional's message
// text, and either party could re-point the conversation at a different
// professional. Asserts both are closed AND that the legitimate writes the
// policies exist for — read receipts, last-message bookkeeping — still work.
// Run from mobile/.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../mobile/.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const anon = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "OK  " : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

const cust = anon();
const { data: c } = await cust.auth.signInWithPassword({ email: "0501111111@phone.dalconnect.app", password: "123456" });
const cid = c.user.id;
const pro = anon();
const { data: p } = await pro.auth.signInWithPassword({ email: "000001@pro.dalconnect.app", password: "123456" });
const pid = p.user.id;
const outsider = anon();
const { data: o } = await outsider.auth.signInWithPassword({ email: "222222@pro.dalconnect.app", password: "123456" });

// Reuse the thread if one already exists: there is a unique (customer,
// professional) constraint, and `conversations` has no DELETE policy, so a
// previous run's row cannot be cleaned up by a normal user and a plain insert
// would fail on the second run.
let conv;
{
  const { data: existing } = await cust.from("conversations")
    .select("id").eq("customer_id", cid).eq("professional_id", pid).maybeSingle();
  if (existing) conv = existing;
  else {
    const { data, error } = await cust.from("conversations")
      .insert({ customer_id: cid, professional_id: pid }).select("id").single();
    if (error) { console.error("setup failed:", error.message); process.exit(1); }
    conv = data;
  }
}

const { data: proMsg } = await pro.from("messages")
  .insert({ conversation_id: conv.id, sender_id: pid, body: "ORIGINAL from the professional", type: "text" })
  .select("id, body, is_read").single();

console.log("1. History cannot be rewritten");
{
  const { data, error } = await cust.from("messages").update({ body: "TAMPERED" }).eq("id", proMsg.id).select("body");
  const tampered = !error && data?.length && data[0].body === "TAMPERED";
  check("customer cannot edit the professional's message", !tampered, error?.message?.slice(0, 55) ?? (tampered ? "EDITED IT" : ""));
  if (tampered) await pro.from("messages").update({ body: proMsg.body }).eq("id", proMsg.id);
}
{
  const { error } = await pro.from("messages").update({ body: "EDITED BY SENDER" }).eq("id", proMsg.id);
  check("not even the sender can edit their own message", !!error, error?.message?.slice(0, 55) ?? "ALLOWED");
}
{
  const { error } = await cust.from("messages")
    .insert({ conversation_id: conv.id, sender_id: pid, body: "FORGED", type: "text" });
  check("cannot forge a message as someone else", !!error, error?.message?.slice(0, 50) ?? "FORGED IT");
}

console.log("\n2. Conversations cannot be hijacked");
{
  const { data, error } = await cust.from("conversations")
    .update({ professional_id: o.user.id }).eq("id", conv.id).select("professional_id");
  const moved = !error && data?.length && data[0].professional_id === o.user.id;
  check("cannot re-point a conversation at another professional", !moved, error?.message?.slice(0, 55) ?? (moved ? "RE-POINTED" : ""));
}
{
  const { data, error } = await outsider.from("messages").select("body").eq("conversation_id", conv.id);
  check("an outsider still cannot read the thread", !!error || !data?.length, `saw ${data?.length ?? 0}`);
}

console.log("\n3. The legitimate writes still work");
{
  // read receipt — the reason messages_update_read_flag exists
  const { data, error } = await cust.from("messages").update({ is_read: true }).eq("id", proMsg.id).select("is_read");
  check("recipient can still mark a message read", !error && data?.[0]?.is_read === true, error?.message?.slice(0, 55) ?? "");
}
{
  const { data, error } = await cust.from("messages")
    .insert({ conversation_id: conv.id, sender_id: cid, body: "a normal reply", type: "text" }).select("id");
  check("sending a message still works", !error && !!data?.length, error?.message?.slice(0, 55) ?? "");
}
{
  const { data } = await cust.from("conversations").select("last_message_at, last_message_preview").eq("id", conv.id).single();
  check("last-message bookkeeping still updates", !!data?.last_message_preview, `preview="${data?.last_message_preview}"`);
}

// Messages clean up; the conversation row stays (no DELETE policy) and is
// reused by the next run.
await cust.from("messages").delete().eq("conversation_id", conv.id);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
