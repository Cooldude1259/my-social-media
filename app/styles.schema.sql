-- Snapshot of the `styles` table (schema: social-media-public).
-- Applied to Supabase project bmfbnydcanksjwquljzb. Kept here for reference;
-- one column per theme token (see app/THEME_API.md and :root in app/styles.css).

create table "social-media-public"."styles" (
  id          bigint generated always as identity primary key,
  name        text not null,
  description text,
  is_default  boolean not null default false,
  is_curated  boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  "primary" text, "primary_hover" text, "primary_deep" text, "primary_soft" text, "brand_grad" text,
  "text" text, "text_body" text, "text_soft" text, "text_muted" text, "text_faint" text, "placeholder" text,
  "bg" text, "surface" text, "surface_2" text, "surface_3" text, "surface_4" text,
  "border" text, "border_2" text, "border_strong" text, "hairline" text,
  "like" text, "danger" text,
  "font_head" text, "font_body" text,
  "radius_card" text, "radius_btn" text, "radius_pill" text, "shadow_card" text
);

-- at most one default style
create unique index styles_one_default on "social-media-public"."styles" (is_default) where is_default;

alter table "social-media-public"."styles" enable row level security;

-- everyone can read; only admins can write
grant select on "social-media-public"."styles" to anon, authenticated;
grant insert, update, delete on "social-media-public"."styles" to authenticated;

create policy "styles_public_read"   on "social-media-public"."styles" for select using (true);
create policy "styles_admin_insert"  on "social-media-public"."styles" for insert with check (auth.uid() in (select user_id from "social-media-public"."admins"));
create policy "styles_admin_update"  on "social-media-public"."styles" for update using (auth.uid() in (select user_id from "social-media-public"."admins"));
create policy "styles_admin_delete"  on "social-media-public"."styles" for delete using (auth.uid() in (select user_id from "social-media-public"."admins"));
