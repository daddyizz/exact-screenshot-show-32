begin;

-- PostgREST upsert with onConflict=user_id,dedupe_key needs a non-partial
-- unique constraint/index it can infer. PostgreSQL still permits multiple
-- NULL dedupe_key values in a normal unique index, so non-deduped
-- notifications continue to work as expected.
drop index if exists public.user_notifications_dedupe_idx;

create unique index user_notifications_dedupe_idx
on public.user_notifications(user_id, dedupe_key);

notify pgrst, 'reload schema';
commit;
