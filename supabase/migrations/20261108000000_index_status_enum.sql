-- Repo indexing lifecycle: not indexed -> indexing -> indexed | failed.
-- Was free text; an unknown value (e.g. the old "pending") left cards stuck. Mirror: IndexStatus in web/src/app/types/supabase.ts
create type index_status as enum ('not indexed', 'indexing', 'indexed', 'failed');

update public.repositories
  set index_status = 'not indexed'
  where index_status is null
     or index_status not in ('not indexed', 'indexing', 'indexed', 'failed');

alter table public.repositories
  alter column index_status type index_status using index_status::index_status,
  alter column index_status set default 'not indexed',
  alter column index_status set not null;
