-- Create trade status enum
create type trade_status as enum (
  'pending', 'accepted', 'declined', 'aborted', 'completed'
);

-- Create trade activity type enum
create type trade_activity_type as enum (
  'edited',
  'created',
  'accepted',
  'declined',
  'aborted',
  'completed',
  'disputed',
  'resolved',
  'countered'
);

-- Create trades table
create table trades (
  id uuid primary key default gen_random_uuid(),
  original_id uuid references trades(id) on delete cascade default null,
  status trade_status not null,
  sender_id uuid references users(id) on delete set null default null,
  sender_disputed boolean default false,
  sender_vaultless boolean default false,
  sender_total integer default 0 check (sender_total >= 0),
  receiver_id uuid references users(id) on delete set null default null,
  receiver_disputed boolean default false,
  receiver_vaultless boolean default false,
  receiver_total integer default 0 check (receiver_total >= 0),
  criteria jsonb default null,
  updated_at timestamptz default null,
  created_at timestamptz default now()
);

-- Add table comment
comment on table trades is 'Trade offers between users';

-- Create trigger function to validate trade creation
create or replace function trades_validate_creation()
returns trigger
set search_path = ''
as $$
begin
  -- Check if original trade exists and is valid for counter-offer
  if new.original_id is not null then
    if not exists (
      select 1 from public.trades
      where id = new.original_id
      and status = 'pending'
      and receiver_id = new.sender_id
    ) then
      raise exception 'Invalid original trade for counter-offer';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security invoker;

-- Create trigger function to validate status changes
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
        if old.status not in ('accepted', 'pending') or 
          -- Enforce both vaultless flags to be equal.
          new.sender_vaultless <> new.receiver_vaultless or
          -- If both are false then check that all selected trade apps have a vault entry assigned.
          (
            new.sender_vaultless = false and 
            exists (
              select 1 from public.trade_apps
              where trade_id = new.id
                and selected = true
                and (vault_entries is null or array_length(vault_entries, 1) = 0)
            )
          ) or
          -- If both are false then check that all assigned vault entries have a value for both sender and receiver.
          (
            new.sender_vaultless = false and 
            exists (
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
            )
          ) or
          -- Check that assigned vault entries for selected trade apps don't already have a trade assigned.
          (
            new.sender_vaultless = false and 
            exists (
              select 1 from public.vault_entries ve
              join public.trade_apps ta on ve.id = any(ta.vault_entries)
              where ta.trade_id = new.id
                and ta.selected = true
                and ve.trade_id is not null
            )
          ) or
          -- Check that for each selected trade_app, the number of distinct vault_entries matches total
          (
            new.sender_vaultless = false and
            exists (
              select 1 from public.trade_apps ta
              where ta.trade_id = new.id
                and ta.selected = true
                and ta.vault_entries is not null
                and array_length(array(select distinct unnest(ta.vault_entries)), 1) != ta.total
            )
          ) or
          -- Verify that the count of selected sender trade apps equals the expected sender_total.
          not exists (
            select 1 from public.trade_apps
            where trade_id = new.id
              and user_id = new.sender_id
              and selected = true
            group by trade_id
            having count(*) = new.sender_total
          ) or
          -- Verify that the count of selected receiver trade apps equals the expected receiver_total.
          not exists (
            select 1 from public.trade_apps
            where trade_id = new.id
              and user_id = new.receiver_id
              and selected = true
            group by trade_id
            having count(*) = new.receiver_total
          )
        then
            raise exception 'Invalid conditions for completing trade';
        end if;
    else
        raise exception 'Invalid status change';
    end case;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger function to validate dispute changes
create or replace function trades_validate_dispute_change()
returns trigger
set search_path = ''
as $$
begin
  if (new.sender_disputed != old.sender_disputed or new.receiver_disputed != old.receiver_disputed)
    and old.status != 'completed' then
    raise exception 'Can only dispute completed trades';
  end if;
  return new;
end;
$$ language plpgsql security invoker;

-- Create trigger function to prevent certain field changes
create or replace function trades_prevent_changes()
returns trigger
set search_path = ''
as $$
begin
  -- sender_id cannot change
  if new.sender_id != old.sender_id
  -- receiver_id cannot change
  or new.receiver_id != old.receiver_id
  -- original_id cannot change
  or new.original_id != old.original_id
  -- sender cannot change receiver_disputed or receiver_vaultless
  or ((select auth.uid()) = new.sender_id and (
    new.receiver_disputed != old.receiver_disputed or new.receiver_vaultless != old.receiver_vaultless
    ))
  -- receiver can only change status, receiver_disputed, or receiver_vaultless
  or ((select auth.uid()) = new.receiver_id and (
    new.sender_disputed != old.sender_disputed or
    new.sender_vaultless != old.sender_vaultless or
    new.sender_total != old.sender_total or
    new.receiver_total != old.receiver_total or
    new.criteria != old.criteria
  ))
    then
    raise exception 'Change not allowed';
  end if;
  return new;
end;
$$ language plpgsql security invoker;

-- Create function to send Discord notifications for trades
create or replace function send_discord_notification(p_trade public.trades, p_notification_type text)
returns void
set search_path = ''
as $$
declare
  target_user record;
  other_user record;
  discord_config record;
  message_text text;
  user_link text;
begin
  -- Only handle new_trade and accepted_trade
  if p_notification_type not in ('new_trade', 'accepted_trade') then
    return;
  end if;

  -- Get target user (who receives the Discord notification) and other user data
  if p_notification_type = 'new_trade' then
    select discord_id into target_user from public.users where id = p_trade.receiver_id;
    select display_name, steam_id, custom_url into other_user from public.users where id = p_trade.sender_id;
  else -- accepted_trade
    select discord_id into target_user from public.users where id = p_trade.sender_id;
    select display_name, steam_id, custom_url into other_user from public.users where id = p_trade.receiver_id;
  end if;

  -- If target user doesn't have Discord ID set, end function
  if target_user.discord_id is null then
    return;
  end if;

  -- Construct user link (prefer custom_url, fallback to steam_id)
  user_link := format('https://steamkey.trade/user/%s', 
    coalesce(other_user.custom_url, other_user.steam_id));

  -- Construct message based on notification type
  if p_notification_type = 'new_trade' then
    message_text := format('<@%s> received a **new** [trade](https://steamkey.trade/trade/%s) from [%s](<%s>)',
      target_user.discord_id,
      p_trade.id,
      coalesce(other_user.display_name, 'Unknown User'),
      user_link
    );
  else -- accepted_trade
    message_text := format('[%s](<%s>) **accepted** the [trade](https://steamkey.trade/trade/%s) from <@%s>',
      coalesce(other_user.display_name, 'Unknown User'),
      user_link,
      p_trade.id,
      target_user.discord_id
    );
  end if;

  -- Retrieve Discord credentials from vault
  select 
    (select decrypted_secret from vault.decrypted_secrets where name = 'discord_token' limit 1) as token,
    (select decrypted_secret from vault.decrypted_secrets where name = 'discord_channel' limit 1) as channel
  into discord_config;

  -- If Discord credentials are not available, end function
  if discord_config.token is null or discord_config.channel is null then
    return;
  end if;

  -- Send the HTTP POST request via pg_net
  perform net.http_post(
    url := format('https://discord.com/api/v10/channels/%s/messages', discord_config.channel),
    body := jsonb_build_object('content', message_text),
    headers := jsonb_build_object(
      'Authorization', format('Bot %s', discord_config.token),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 10000
  );

exception
  when others then
    -- Silently ignore errors to prevent breaking the main trade flow
    null;
end;
$$ language plpgsql security definer;

-- Create trigger function to handle notifications for trades
create or replace function trades_handle_notifications()
returns trigger
set search_path = ''
as $$
begin
  -- For new trades, create a notification for the receiver
  if tg_op = 'INSERT' and new.receiver_id is not null then
    -- Only send notification if the user has enabled 'new_trade' notifications
    if exists (
      select 1 from public.preferences
      where user_id = new.receiver_id
      and 'new_trade' = ANY(enabled_notifications)
    ) then
      insert into public.notifications (user_id, type, link)
      values (new.receiver_id, 'new_trade', '/trade/' || new.id);
      
      -- Send Discord notification
      perform public.send_discord_notification(new, 'new_trade');
    end if;
  end if;

  -- For updates, create a notification for the sender if trade is accepted
  if tg_op = 'UPDATE' and new.status = 'accepted' and new.sender_id is not null then
    -- Only send notification if the user has enabled 'accepted_trade' notifications
    if exists (
      select 1 from public.preferences
      where user_id = new.sender_id
      and 'accepted_trade' = ANY(enabled_notifications)
    ) then
      insert into public.notifications (user_id, type, link)
      values (new.sender_id, 'accepted_trade', '/trade/' || new.id);
      
      -- Send Discord notification
      perform public.send_discord_notification(new, 'accepted_trade');
    end if;
  end if;
  
  -- For updates, create a notification for the receiver if trade got disputed by the sender
  if tg_op = 'UPDATE' and new.sender_disputed and not old.sender_disputed then
    -- Only send notification if the user has enabled 'disputed_trade' notifications
    if exists (
      select 1 from public.preferences
      where user_id = new.receiver_id
      and 'disputed_trade' = ANY(enabled_notifications)
    ) then
      insert into public.notifications (user_id, type, link)
      values (new.receiver_id, 'disputed_trade', '/trade/' || new.id);
    end if;
  end if;

  -- For updates, create a notification for the sender if trade got disputed by the receiver
  if tg_op = 'UPDATE' and old.sender_disputed and not new.sender_disputed then
    -- Only send notification if the user has enabled 'resolved_trade' notifications
    if exists (
      select 1 from public.preferences
      where user_id = new.receiver_id
      and 'resolved_trade' = ANY(enabled_notifications)
    ) then
      insert into public.notifications (user_id, type, link)
      values (new.receiver_id, 'resolved_trade', '/trade/' || new.id);
    end if;
  end if;

  -- For updates, create a notification for the sender if trade got disputed by the receiver
  if tg_op = 'UPDATE' and new.receiver_disputed and not old.receiver_disputed then
    -- Only send notification if the user has enabled 'disputed_trade' notifications
    if exists (
      select 1 from public.preferences
      where user_id = new.sender_id
      and 'disputed_trade' = ANY(enabled_notifications)
    ) then
      insert into public.notifications (user_id, type, link)
      values (new.sender_id, 'disputed_trade', '/trade/' || new.id);
    end if;
  end if;

  -- For updates, create a notification for the sender if trade got resolved by the receiver
  if tg_op = 'UPDATE' and old.receiver_disputed and not new.receiver_disputed then
    -- Only send notification if the user has enabled 'resolved_trade' notifications
    if exists (
      select 1 from public.preferences
      where user_id = new.sender_id
      and 'resolved_trade' = ANY(enabled_notifications)
    ) then
      insert into public.notifications (user_id, type, link)
      values (new.sender_id, 'resolved_trade', '/trade/' || new.id);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger function to handle trade activity
create or replace function trades_handle_activity()
returns trigger
set search_path = ''
as $$
begin
  -- For new trades
  if tg_op = 'INSERT' then
    -- Record creation
    insert into public.trade_activity (trade_id, user_id, type)
    values (new.id, new.sender_id, 'created');
    
    -- Record counter if applicable
    if new.original_id is not null then
      insert into public.trade_activity (trade_id, user_id, type)
      values (new.original_id, new.sender_id, 'countered');
      
      -- abort original trade
      update public.trades set status = 'declined' where id = new.original_id;
    end if;
  
  -- For updates
  elsif tg_op = 'UPDATE' then
    -- Status changes
    if new.status != old.status then
      insert into public.trade_activity (trade_id, user_id, type)
      values (new.id, (select auth.uid()), new.status::text::public.trade_activity_type);
    
    -- Dispute changes
    elsif (new.sender_disputed != old.sender_disputed or new.receiver_disputed != old.receiver_disputed) then
      if new.sender_disputed or new.receiver_disputed then
        insert into public.trade_activity (trade_id, user_id, type)
        values (new.id, (select auth.uid()), 'disputed');
      else
        insert into public.trade_activity (trade_id, user_id, type)
        values (new.id, (select auth.uid()), 'resolved');
      end if;
    
    -- Other changes
    else
      insert into public.trade_activity (trade_id, user_id, type)
      values (new.id, (select auth.uid()), 'edited');
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger function to handle if a trade is completed
create or replace function trades_handle_completed()
returns trigger
set search_path = ''
as $$
declare
  v_new_vault_entry public.vault_entries%rowtype;
  v_vault_entry public.vault_entries%rowtype;
  v_user_id uuid;
  v_app_id integer;
  v_master_tradelist_id text;
  v_count integer;
  v_selected_apps integer[];
  v_vault_entry_id uuid;
begin
  -- Skip if the trade is not completed or if vaultless, we are done
  if new.status != 'completed' or new.sender_vaultless = true then
    return new;
  end if;
  -- We assume that the trade is valid (checked in the status change trigger)

  -- Create received vault entries for each selected app and each vault entry in the array
  for v_vault_entry_id in
    select unnest(ta.vault_entries) as vault_entry_id
    from public.trade_apps ta
    where ta.trade_id = new.id
      and ta.selected = true
      and ta.vault_entries is not null
  loop
    select * into v_vault_entry from public.vault_entries where id = v_vault_entry_id;
    -- Create new vault entry
    insert into public.vault_entries (
      user_id,
      type,
      app_id,
      trade_id
    ) values (
      case 
      when v_vault_entry.user_id = new.sender_id then new.receiver_id
      else new.sender_id
      end,
      v_vault_entry.type,
      v_vault_entry.app_id,
      new.id
    ) returning * into v_new_vault_entry;

    -- Copy vault value from original entry to the new entry
    insert into public.vault_values (
      vault_entry_id,
      receiver_id,
      value
    )
    select 
      v_new_vault_entry.id as vault_entry_id,
      receiver_id,
      value
    from public.vault_values
    where vault_entry_id = v_vault_entry.id
    and receiver_id = v_new_vault_entry.user_id;
    
    -- Update the original entry with the completed trade ID (marking it as sent)
    update public.vault_entries
    set trade_id = new.id
    where id = v_vault_entry.id;
  end loop;

  -- Sync master tradelists for both users
  for v_user_id in select unnest(array[new.sender_id, new.receiver_id]) loop
    -- Get all apps this user traded away in this trade
    select array_agg(ta.app_id) into v_selected_apps
    from public.trade_apps ta
    join public.vault_entries ve on ve.id = any(ta.vault_entries)
    where ta.trade_id = new.id
      and ta.selected = true
      and ve.user_id = v_user_id;

    if v_selected_apps is not null then
      -- Find the user's master tradelist
      select id into v_master_tradelist_id
      from public.collections
      where user_id = v_user_id and master = true and type = 'tradelist';

      if v_master_tradelist_id is not null then
        -- For each app, check if user has any more available in their vault
        foreach v_app_id in array v_selected_apps loop
          select count(*) into v_count
          from public.vault_entries
          where user_id = v_user_id
            and app_id = v_app_id
            and trade_id is null;

          if v_count = 0 then
            -- Remove from master tradelist if collection_apps entry is of type 'sync'
            delete from public.collection_apps
            where collection_id = v_master_tradelist_id
              and app_id = v_app_id
              and source = 'sync';
          end if;
        end loop;
      end if;
    end if;
  end loop;

  return new;
end;
$$ language plpgsql security definer;

-- Create triggers
create trigger trades_validate_creation_trigger
before insert on trades
for each row
execute function trades_validate_creation();

create trigger trades_validate_status_change_trigger
before update of status on trades
for each row
execute function trades_validate_status_change();

create trigger trades_validate_dispute_change_trigger
before update of sender_disputed, receiver_disputed on trades
for each row
execute function trades_validate_dispute_change();

create trigger trades_prevent_changes_trigger
before update of sender_id, receiver_id on trades
for each row
execute function trades_prevent_changes();

create trigger trades_handle_activity_trigger
after insert or update on trades
for each row
execute function trades_handle_activity();

create trigger trades_handle_notifications_trigger
after insert or update on trades
for each row
execute function trades_handle_notifications();

create trigger trades_handle_completed_trigger
after update of status on trades
for each row
execute function trades_handle_completed();

-- Add date management triggers
create trigger trades_update_dates
before update on trades
for each row
execute function update_dates();

create trigger trades_insert_dates
before insert on trades
for each row
execute function insert_dates();

-- Enable RLS
alter table trades enable row level security;

-- Allow read access for all users
create policy trades_select on trades
for select
to authenticated, anon
using (true);

-- Allow creation with multiple conditions:
-- 1. User must be the sender
-- 2. Sender and receiver must be different
-- 3. Status must be pending
-- 4. Either receiver or criteria must be set, or both
create policy trades_insert on trades
for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
  and sender_id != receiver_id
  and status = 'pending'
  and (receiver_id is not null or criteria is not null)
);

-- Allow update when user is sender or receiver
create policy trades_update on trades
for update
to authenticated
using (
  ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id)
)
with check (
  ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id)
);

-- Allow deletion with multiple conditions:
-- 1. User must be the sender
-- 2. Trade must be pending
create policy trades_delete on trades
for delete
to authenticated
using (
  (select auth.uid()) = sender_id
  and status = 'pending'
);