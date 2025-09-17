alter table "public"."users" add column "discord_id" text;

CREATE UNIQUE INDEX users_discord_id_key ON public.users USING btree (discord_id);

alter table "public"."users" add constraint "users_discord_id_check" CHECK (((discord_id ~ '^\d{17,19}$'::text) AND ((discord_id IS NULL) OR ((length(discord_id) >= 17) AND (length(discord_id) <= 19))))) not valid;

alter table "public"."users" validate constraint "users_discord_id_check";

alter table "public"."users" add constraint "users_discord_id_key" UNIQUE using index "users_discord_id_key";
