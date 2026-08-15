-- ============================================================
-- DalConnect — chat integrity
--
-- The first audit pass reported "no conversation to test with" and skipped
-- these two. Tested properly against a real conversation, both were open:
--
--   * a customer could rewrite the PROFESSIONAL's message text. Chat is where
--     the two sides agree what the job actually involves, and it is the
--     evidence anyone would look at in a dispute or a report — being able to
--     edit what the other person said makes the whole thread worthless.
--   * either party could re-point conversations.professional_id at a DIFFERENT
--     professional, moving a thread (and its history) onto someone who was
--     never part of it.
--
-- Both policies exist for legitimate reasons — read receipts, and the trigger
-- that keeps last_message_at/preview current — but both are `for update using
-- (...)` with no WITH CHECK, so they permitted every other column too.
-- ============================================================

create or replace function guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('dalconnect.trusted_write', true), '') = 'on' then
    return new;
  end if;
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  -- A message is a record of what someone said. Nobody edits it — not the
  -- other party, and not even the sender: the app has no edit affordance, so
  -- any such write is either a bug or an attempt to rewrite history.
  -- These are exactly public.messages' columns; `payload` and friends belong to
  -- realtime.messages, a different table entirely, and naming one here makes
  -- the trigger raise on EVERY update — including the read receipts it is
  -- supposed to permit.
  if new.body           is distinct from old.body
  or new.type           is distinct from old.type
  or new.image_url      is distinct from old.image_url
  or new.lat            is distinct from old.lat
  or new.lng            is distinct from old.lng
  or new.sender_id      is distinct from old.sender_id
  or new.conversation_id is distinct from old.conversation_id
  or new.created_at     is distinct from old.created_at then
    raise exception 'a sent message cannot be altered' using errcode = '42501';
  end if;

  -- What remains is the read receipt, which is the point of the policy.
  return new;
end;
$$;

drop trigger if exists a_guard_message_update_trigger on messages;
create trigger a_guard_message_update_trigger
  before update on messages
  for each row execute function guard_message_update();

create or replace function guard_conversation_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('dalconnect.trusted_write', true), '') = 'on' then
    return new;
  end if;
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  -- Who a conversation is between is fixed when it is created. Only the
  -- last-message bookkeeping may move.
  if new.customer_id     is distinct from old.customer_id
  or new.professional_id is distinct from old.professional_id then
    raise exception 'a conversation cannot be moved to another person' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists a_guard_conversation_update_trigger on conversations;
create trigger a_guard_conversation_update_trigger
  before update on conversations
  for each row execute function guard_conversation_update();
