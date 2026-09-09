begin;

create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  name text not null,
  headline text not null,
  body text,
  image_url text,
  target_url text not null,
  cta_label text not null default 'Learn more',
  is_active boolean not null default true,
  opens_new_tab boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ad_placements enable row level security;

drop policy if exists "Public can read active ads" on public.ad_placements;
create policy "Public can read active ads"
on public.ad_placements for select
to anon, authenticated
using (is_active = true);

insert into public.ad_placements
  (slot_key, name, headline, body, target_url, cta_label, is_active, opens_new_tab)
values
  (
    'landing-mid',
    'BlogPilot House Ad — Landing',
    'Turn your next idea into a publish-ready article',
    'Create your BlogPilot workspace and start planning SEO content in minutes.',
    '/auth',
    'Start free',
    true,
    false
  ),
  (
    'app-top',
    'BlogPilot House Ad — Workspace',
    'Keep your publishing workflow moving',
    'Connect Blogger, build your queue and manage your publishing settings from one workspace.',
    '/settings',
    'Open settings',
    true,
    false
  )
on conflict (slot_key) do nothing;

notify pgrst, 'reload schema';
commit;
