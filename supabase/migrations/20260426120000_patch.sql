alter type widget add value if not exists 'changelog';

alter table preferences
alter column dashboard_widgets
set default array['welcome', 'users_online', 'stats', 'trade_activity', 'bundles', 'changelog']::widget[];

update preferences
set dashboard_widgets = array['welcome', 'users_online', 'stats', 'trade_activity', 'bundles', 'changelog']::widget[]
where dashboard_widgets is null
  or dashboard_widgets = array['welcome', 'users_online', 'stats', 'trade_activity']::widget[]
  or dashboard_widgets = array['welcome', 'users_online', 'stats', 'trade_activity', 'bundles']::widget[];
