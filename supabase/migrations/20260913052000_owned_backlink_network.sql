begin;

create table if not exists public.owned_backlink_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  topics text not null default '',
  anchor_hint text,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owned_backlink_sites_url_http check (url ~* '^https?://')
);

alter table public.owned_backlink_sites enable row level security;
revoke all on table public.owned_backlink_sites from public, anon, authenticated;
grant select, insert, update, delete on table public.owned_backlink_sites to service_role;

create or replace function public.apply_owned_backlink_to_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  best_candidate record;
  haystack text;
  score integer;
  best_score integer := 0;
  topic text;
  marker text;
begin
  if new.body is null or btrim(new.body) = '' then
    return new;
  end if;

  if new.status <> 'drafted' then
    return new;
  end if;

  if new.body like '%<!-- blogpilot-owned-backlink:%' then
    return new;
  end if;

  haystack := lower(coalesce(new.title, '') || ' ' || coalesce(new.keywords, '') || ' ' || coalesce(new.outline, ''));

  for candidate in
    select id, name, url, topics, anchor_hint
    from public.owned_backlink_sites
    where enabled = true
    order by created_at asc
  loop
    score := 0;
    foreach topic in array regexp_split_to_array(lower(coalesce(candidate.topics, '')), '\s*,\s*')
    loop
      if length(btrim(topic)) >= 3 and haystack like '%' || btrim(topic) || '%' then
        score := score + 1;
      end if;
    end loop;

    if score > best_score then
      best_score := score;
      best_candidate := candidate;
    end if;
  end loop;

  if best_score > 0 and best_candidate.id is not null then
    marker := '<!-- blogpilot-owned-backlink:' || best_candidate.id::text || ' -->';
    new.body := rtrim(new.body) || E'\n\n---\n\n**Further reading:** [' ||
      coalesce(nullif(btrim(best_candidate.anchor_hint), ''), best_candidate.name) || '](' || best_candidate.url || ')' || E'\n' || marker;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_owned_backlink_to_post on public.posts;
create trigger trg_apply_owned_backlink_to_post
before insert or update of body, status, keywords, title, outline on public.posts
for each row
execute function public.apply_owned_backlink_to_post();

notify pgrst, 'reload schema';
commit;
