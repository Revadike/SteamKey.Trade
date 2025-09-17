set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.send_discord_notification(p_trade trades, p_notification_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trades_handle_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;


