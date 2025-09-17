-- Create region enum
create type country_code as enum (
  'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV',
  'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN',
  'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'HR', 'CU', 'CW', 'CY', 'CZ', 'CI', 'DK',
  'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI',
  'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU',
  'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR',
  'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW',
  'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV',
  'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA',
  'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO',
  'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK',
  'RO', 'RU', 'RW', 'RE', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA',
  'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK',
  'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT',
  'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'UM', 'US', 'UY', 'UZ', 'VU', 'VE',
  'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW', 'AX'
);

-- Create users table
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  steam_id text not null unique,
  discord_id text default null unique check (
    -- Discord ID must be numeric
    (discord_id ~ '^\d{17,19}$')
    -- Discord ID must be between 17 and 19 characters
    and (discord_id is null or length(discord_id) between 17 and 19)
  ),
  custom_url text default null unique check (
    -- Custom URL must be alphanumeric
    (custom_url ~ '^[a-zA-Z0-9]+$')
    -- Custom URL must be between 1 and 32 characters
    and (custom_url is null or length(custom_url) between 1 and 32)
    -- Custom URL must not be a Steam ID
    and (custom_url !~ '^76561\d{12}$')
  ),
  display_name text default null,
  avatar text default null check (
    avatar is null or is_allowed_host(avatar, array[
      'localhost',
      '127.0.0.1',
      'avatars.steamstatic.com',
      '*.supabase.co'
    ])
  ),
  background text default null check (
    background is null or is_allowed_host(background, array[
      'localhost',
      '127.0.0.1',
      '*.supabase.co'
    ])
  ),
  bio text default null,
  region country_code default null,
  public_key text default null,
  updated_at timestamptz default null,
  created_at timestamptz default now()
);

-- Add table comment
comment on table users is 'User profiles';

-- Enable realtime for this table
alter publication supabase_realtime add table users;

-- Create trigger function to prevent changing certain fields
create or replace function users_prevent_key_changes()
returns trigger
set search_path = ''
as $$
begin
  -- Prevent changing id or steam_id
  if new.id != old.id or new.steam_id != old.steam_id then
    raise exception 'Cannot change id or steam_id';
  end if;

  -- Prevent changing public_key if already set
  if old.public_key is not null and new.public_key != old.public_key then
    raise exception 'Cannot change public_key once set';
  end if;

  return new;
end;
$$ language plpgsql security invoker;

-- Create trigger
create trigger users_prevent_key_changes_trigger
before update on users
for each row
execute function users_prevent_key_changes();

-- Add date management triggers
create trigger users_update_dates
before update on users
for each row
execute function update_dates();

create trigger users_insert_dates
before insert on users
for each row
execute function insert_dates();

-- Enable RLS
alter table users enable row level security;

-- Allow read access for all users
create policy users_select on users
for select
to authenticated, anon
using (true);

-- Allow update for own profile only
create policy users_update on users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Disallow deletion for all users
