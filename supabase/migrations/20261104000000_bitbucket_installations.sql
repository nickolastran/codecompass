-- Bitbucket OAuth connection (one per user), mirrors gitlab_installations
create table public.bitbucket_installations (
  installed_by uuid primary key references public.users (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  created_at timestamptz not null default now()
);

alter table public.bitbucket_installations enable row level security;

create policy bitbucket_installations_own on public.bitbucket_installations for all to authenticated
  using (installed_by = auth.uid()) with check (installed_by = auth.uid());
