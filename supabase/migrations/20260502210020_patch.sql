create or replace function trades_validate_status_change()
returns trigger
set search_path = ''
as $$
begin
  -- Status change validations
  if new.status != old.status then
    case new.status
      when 'aborted' then
        if old.status != 'accepted' then
          raise exception 'Can only abort accepted trades';
        end if;
      when 'accepted' then
        if old.status != 'pending' or (select auth.uid()) != new.receiver_id then
          raise exception 'Only receiver can accept pending trades';
        end if;
      when 'declined' then
        if old.status != 'pending' or (select auth.uid()) != new.receiver_id then
          raise exception 'Only receiver can decline pending trades';
        end if;
      when 'completed' then
        if old.status not in ('accepted', 'pending') then
          raise exception 'Trade cannot be completed yet.';
        end if;

        -- Enforce both vaultless flags to be equal.
        if coalesce(new.sender_vaultless, false) <> coalesce(new.receiver_vaultless, false) then
          raise exception 'Both sides must agree to do this trade off-platform or not.';
        end if;

        -- Disallow trades where neither side has any selected trade apps.
        if coalesce(new.sender_total, 0) = 0
          and coalesce(new.receiver_total, 0) = 0 then
          raise exception 'At least one side must have an app selected.';
        end if;

        -- If both are false then check that all selected trade apps have a vault entry assigned.
        if coalesce(new.sender_vaultless, false) = false and exists (
          select 1 from public.trade_apps
          where trade_id = new.id
            and selected = true
            and (vault_entries is null or array_length(vault_entries, 1) = 0)
        ) then
          raise exception 'Every selected trade app must have a vault entry assigned.';
        end if;

        -- If both are false then check that all assigned vault entries have a value for both sender and receiver.
        if coalesce(new.sender_vaultless, false) = false and exists (
          select 1 from public.vault_entries ve
          join public.trade_apps ta on ve.id = any(ta.vault_entries)
          where ta.trade_id = new.id
            and ta.selected = true
            and ve.trade_id is null
            and (
              not exists (
                select 1 from public.vault_values vv
                where vv.vault_entry_id = ve.id
                  and vv.receiver_id = new.sender_id
              ) or
              not exists (
                select 1 from public.vault_values vv
                where vv.vault_entry_id = ve.id
                  and vv.receiver_id = new.receiver_id
              )
            )
        ) then
          raise exception 'One or more assigned vault entries are not ready to be sent.';
        end if;

        -- Check that assigned vault entries for selected trade apps don't already have a trade assigned.
        if coalesce(new.sender_vaultless, false) = false and exists (
          select 1 from public.vault_entries ve
          join public.trade_apps ta on ve.id = any(ta.vault_entries)
          where ta.trade_id = new.id
            and ta.selected = true
            and ve.trade_id is not null
        ) then
          raise exception 'One or more assigned vault entries are already linked to another trade.';
        end if;

        -- Check that for each selected trade_app, the number of distinct vault_entries matches total.
        if coalesce(new.sender_vaultless, false) = false and exists (
          select 1 from public.trade_apps ta
          where ta.trade_id = new.id
            and ta.selected = true
            and ta.vault_entries is not null
            and array_length(array(select distinct unnest(ta.vault_entries)), 1) != ta.total
        ) then
          raise exception 'Each selected trade app must contain the expected number of unique vault entries.';
        end if;

        -- Verify that the count of selected sender trade apps equals the expected sender_total.
        if (
          select count(*)
          from public.trade_apps
          where trade_id = new.id
            and user_id = new.sender_id
            and selected = true
        ) != coalesce(new.sender_total, 0) then
          raise exception 'The sender does not have the required number of selected apps.';
        end if;

        -- Verify that the count of selected receiver trade apps equals the expected receiver_total.
        if (
          select count(*)
          from public.trade_apps
          where trade_id = new.id
            and user_id = new.receiver_id
            and selected = true
        ) != coalesce(new.receiver_total, 0) then
          raise exception 'The receiver does not have the required number of selected apps.';
        end if;
    else
        raise exception 'Invalid status change';
    end case;
  end if;
  return new;
end;
$$ language plpgsql security definer;
