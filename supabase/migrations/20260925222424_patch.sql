-- Allow a user's public key to be cleared only as part of a vault reset, which
-- removes the user's credentials first. Any other change to an already set
-- public key remains forbidden.
create or replace function users_prevent_key_changes()
returns trigger
set search_path = ''
as $$
begin
  -- Prevent changing id or steam_id
  if new.id != old.id or new.steam_id != old.steam_id then
    raise exception 'Cannot change id or steam_id';
  end if;

  -- Prevent changing public_key once set. Clearing the key is only allowed
  -- when the user's credentials have already been removed (vault reset).
  if old.public_key is not null
    and new.public_key != old.public_key
    and (
      new.public_key is not null
      or exists (select 1 from public.credentials where user_id = new.id)
    ) then
    raise exception 'Cannot change public_key once set';
  end if;

  return new;
end;
$$ language plpgsql security invoker;

-- Destroy the current user's vault: reset their public key, remove their
-- stored credentials (encrypted private key), and delete every vault entry
-- they own. This is a destructive operation so it runs with the privileges of
-- the function owner (SECURITY DEFINER) to bypass RLS, and is locked down to
-- the authenticated user's own account via auth.uid().
create or replace function reset_vault()
returns void
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Destroy the user's stored credentials (encrypted private key).
  delete from public.credentials
  where user_id = v_user_id;

  -- Destroy every vault entry owned by the user. This removes their unsent,
  -- sent and received entries. Values already delivered to other vaults live
  -- on vault entries owned by the receiving users (created when a trade is
  -- completed), so they are left untouched.
  delete from public.vault_entries
  where user_id = v_user_id;

  -- Reset the user's public key so the vault can be set up again from scratch.
  update public.users
  set public_key = null
  where id = v_user_id;
end;
$$ language plpgsql security definer;

-- Restrict execution to authenticated users only. Supabase grants EXECUTE to
-- public, anon, authenticated and service_role by default, so revoke the broad
-- grants before re-granting to authenticated.
revoke execute on function public.reset_vault() from public;
revoke execute on function public.reset_vault() from anon;
grant execute on function public.reset_vault() to authenticated;
