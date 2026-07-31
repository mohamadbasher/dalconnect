-- Self-service account deletion (store-policy requirement).
-- Deleting the auth user cascades to profiles -> professionals -> bookings etc.
create or replace function delete_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function delete_account() from anon, public;
grant execute on function delete_account() to authenticated;
