// Avatar moderation + contact email (migration 20260714000015).
//
// The point of review is that a user cannot put a photo in front of strangers
// without someone looking at it first. That only holds if `avatar_url` is
// unwritable by its owner — so that is what this asserts, along with email
// being as private as phone. Run from mobile/.
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

const me = anon();
const { data: a, error: aErr } = await me.auth.signInWithPassword({
  email: "0501111111@phone.dalconnect.app", password: "123456",
});
if (aErr) { console.error("sign-in failed:", aErr.message); process.exit(1); }
const uid = a.user.id;

const admin = anon();
const { data: adm } = await admin.auth.signInWithPassword({
  email: "0503333333@phone.dalconnect.app", password: "123456",
});

const FAKE = "https://example.test/evil.jpg";
const mine = async () => (await me.rpc("get_my_profile").single()).data;

console.log("1. A user can submit a photo for review");
{
  const { error } = await me.from("profiles")
    .update({ pending_avatar_url: FAKE, avatar_status: "pending" }).eq("id", uid);
  check("submitting sets pending + status", !error, error?.message?.slice(0, 55) ?? "");
  const p = await mine();
  check("stored as pending, not live", p.pending_avatar_url === FAKE && p.avatar_status === "pending",
    `status=${p.avatar_status}`);
}

console.log("\n2. But cannot publish it themselves — the point of review");
{
  const { error } = await me.from("profiles").update({ avatar_url: FAKE }).eq("id", uid);
  check("cannot write avatar_url directly", !!error, error?.message?.slice(0, 60) ?? "PUBLISHED IT");
}
{
  const { error } = await me.from("profiles").update({ avatar_status: "approved" }).eq("id", uid);
  check("cannot self-approve the status", !!error, error?.message?.slice(0, 60) ?? "SELF-APPROVED");
}
{
  const { error } = await me.rpc("approve_avatar", { p_user_id: uid });
  const p = await mine();
  check("calling approve_avatar as a normal user does nothing", p.avatar_url !== FAKE,
    error?.message?.slice(0, 45) ?? `avatar_url=${p.avatar_url}`);
}

console.log("\n3. An admin can approve, and that is what publishes it");
{
  const { error } = await admin.rpc("approve_avatar", { p_user_id: uid });
  check("admin approve succeeds", !error, error?.message?.slice(0, 55) ?? "");
  const p = await mine();
  check("photo went live", p.avatar_url === FAKE, `avatar_url=${p.avatar_url}`);
  check("pending was cleared", p.pending_avatar_url === null);
  check("status is approved", p.avatar_status === "approved");
}

console.log("\n4. Rejecting drops the submission and keeps the old photo");
{
  await me.from("profiles").update({ pending_avatar_url: "https://example.test/second.jpg", avatar_status: "pending" }).eq("id", uid);
  const { error } = await admin.rpc("reject_avatar", { p_user_id: uid });
  check("admin reject succeeds", !error, error?.message?.slice(0, 55) ?? "");
  const p = await mine();
  check("submission dropped", p.pending_avatar_url === null);
  check("previously approved photo survived", p.avatar_url === FAKE, `avatar_url=${p.avatar_url}`);
  check("status is rejected", p.avatar_status === "rejected");
}

console.log("\n5. Email is as private as phone");
{
  const { error } = await me.from("profiles").update({ email: "me@example.test" }).eq("id", uid);
  check("owner can set their own email", !error, error?.message?.slice(0, 50) ?? "");
  const p = await mine();
  check("and read it back via get_my_profile", p.email === "me@example.test", `email=${p.email}`);
}
{
  const { data, error } = await me.from("profiles").select("email").neq("id", uid).limit(3);
  check("cannot read anyone else's email", !!error || !data?.length, error?.message?.slice(0, 55) ?? `saw ${data?.length}`);
}
{
  const { data, error } = await me.from("profiles").select("pending_avatar_url").neq("id", uid).limit(3);
  check("cannot read others' pending photos", !!error || !data?.length, error?.message?.slice(0, 55) ?? `saw ${data?.length}`);
}

// leave the demo account as it was
await admin.from("profiles").update({ avatar_url: null, pending_avatar_url: null, avatar_status: "none", email: null }).eq("id", uid);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
