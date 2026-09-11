begin;

-- Normalize historical rows so every stored meta description respects the
-- product's 150-character limit.
update public.posts
set meta_description = case
  when char_length(trim(meta_description)) <= 150 then trim(meta_description)
  else trim(trailing from left(trim(meta_description), 147)) || '...'
end
where meta_description is not null
  and (char_length(meta_description) > 150 or meta_description <> trim(meta_description));

-- Enforce the limit at the database boundary as a final safety net for every
-- write path (AI planning, article generation, manual edits, imports, etc.).
alter table public.posts
  drop constraint if exists posts_meta_description_max_150;

alter table public.posts
  add constraint posts_meta_description_max_150
  check (meta_description is null or char_length(meta_description) <= 150);

notify pgrst, 'reload schema';

commit;
