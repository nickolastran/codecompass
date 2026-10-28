-- CodeCompass initial schema

create extension if not exists vector;

create type org_role as enum ('owner', 'teammate');
create type repo_provider as enum ('local', 'github', 'gitlab', 'bitbucket');
create type message_role as enum ('system', 'user', 'assistant');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Users (mirror of auth.users)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.users (id, email, created_at)
select id, email, created_at from auth.users
on conflict (id) do nothing;

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.user_organizations (
  user_id uuid not null references public.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role org_role not null default 'teammate',
  joined_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
create index on public.user_organizations (organization_id);

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Git provider installations
create table public.github_installations (
  id uuid not null unique default gen_random_uuid(),
  installation_id bigint primary key,
  account_login text not null,
  account_type text,
  installed_by uuid references public.users (id) on delete cascade,
  repositories_access text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.github_installations (installed_by);
create trigger github_installations_updated_at before update on public.github_installations
  for each row execute function public.set_updated_at();

create table public.gitlab_installations (
  id uuid primary key default gen_random_uuid(),
  installed_by uuid not null references public.users (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  created_at timestamptz not null default now()
);
create index on public.gitlab_installations (installed_by);

-- Repositories
create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  indexed_by uuid references public.users (id) on delete set null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider repo_provider not null,
  repo_url text,
  object_url text,
  last_indexed_at timestamptz,
  index_status text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on public.repositories (organization_id);

-- Conversations / messages
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repositories (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text,
  repo_version int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.conversations (repo_id, user_id);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index idx_conversation_messages on public.messages (conversation_id, created_at);

create table public.code_snippets (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  file_path text not null,
  code_content text not null,
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.code_snippets (conversation_id);

-- Documentation / pages
create table public.documentation (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repositories (id) on delete cascade,
  title text,
  description text,
  version int not null default 1,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.documentation (repo_id, version desc);
create trigger documentation_updated_at before update on public.documentation
  for each row execute function public.set_updated_at();

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  documentation_id uuid not null references public.documentation (id) on delete cascade,
  title text not null,
  slug text not null,
  content text,
  order_index int not null default 0,
  parent_page_id uuid references public.pages (id) on delete set null,
  repo_version int,
  embedding vector(1536),
  referenced_files jsonb not null default '[]',
  referenced_symbols jsonb not null default '[]',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (documentation_id, slug)
);
create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

-- Code index
create table public.code_files (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repositories (id) on delete cascade,
  file_path text not null,
  file_type text,
  content text,
  line_count int,
  embedding vector(1536),
  symbols jsonb,
  imports jsonb,
  exports jsonb,
  metadata jsonb,
  indexed_at timestamptz not null default now(),
  unique (repo_id, file_path)
);

create table public.code_symbols (
  id uuid primary key default gen_random_uuid(),
  code_file_id uuid not null references public.code_files (id) on delete cascade,
  repo_id uuid not null references public.repositories (id) on delete cascade,
  name text not null,
  symbol_type text not null,
  signature text,
  code_snippet text,
  line_start int,
  line_end int,
  embedding_vector vector(1536),
  metadata jsonb,
  indexed_at timestamptz not null default now()
);
create index on public.code_symbols (repo_id, name);

-- ============================================================================
-- Row level security
-- The backend and createAdminClient() use the secret key and bypass all of this.
-- ============================================================================

-- Helpers are security definer so policies on user_organizations can query
-- user_organizations without infinite recursion.
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_organizations
                 where organization_id = org and user_id = auth.uid());
$$;

create or replace function public.is_org_owner(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_organizations
                 where organization_id = org and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.org_has_members(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_organizations where organization_id = org);
$$;

create or replace function public.shares_org_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_organizations a
                 join public.user_organizations b using (organization_id)
                 where a.user_id = auth.uid() and b.user_id = other);
$$;

create or replace function public.can_access_repo(repo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.repositories r
                 join public.user_organizations m using (organization_id)
                 where r.id = repo and m.user_id = auth.uid());
$$;

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.user_organizations enable row level security;
alter table public.organization_invites enable row level security;
alter table public.github_installations enable row level security;
alter table public.gitlab_installations enable row level security;
alter table public.repositories enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.code_snippets enable row level security;
alter table public.documentation enable row level security;
alter table public.pages enable row level security;
alter table public.code_files enable row level security;
alter table public.code_symbols enable row level security;

-- users: yourself and anyone you share an org with (member list shows emails)
create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));

-- organizations: creator can see it before joining (createOrganization does insert().select())
create policy orgs_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or created_by = auth.uid());
create policy orgs_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy orgs_update on public.organizations for update to authenticated
  using (public.is_org_owner(id));
create policy orgs_delete on public.organizations for delete to authenticated
  using (public.is_org_owner(id));

-- user_organizations: only a new org's creator may add themselves (as owner).
-- Invite acceptance goes through the admin client.
-- user_id = auth.uid() lets insert().select() return the row being inserted
create policy members_select on public.user_organizations for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy members_insert_creator on public.user_organizations for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'owner'
    and not public.org_has_members(organization_id)
    and exists (select 1 from public.organizations o
                where o.id = organization_id and o.created_by = auth.uid())
  );
create policy members_update on public.user_organizations for update to authenticated
  using (public.is_org_owner(organization_id));
create policy members_delete on public.user_organizations for delete to authenticated
  using (public.is_org_owner(organization_id) or user_id = auth.uid());

-- organization_invites: members create/see their org's invites; lookup by token is admin-only
create policy invites_select on public.organization_invites for select to authenticated
  using (public.is_org_member(organization_id));
create policy invites_insert on public.organization_invites for insert to authenticated
  with check (public.is_org_member(organization_id) and created_by = auth.uid());

-- installations: your own only
create policy github_installations_own on public.github_installations for all to authenticated
  using (installed_by = auth.uid()) with check (installed_by = auth.uid());
create policy gitlab_installations_own on public.gitlab_installations for all to authenticated
  using (installed_by = auth.uid()) with check (installed_by = auth.uid());

-- repositories: any org member
create policy repos_all on public.repositories for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- conversations/messages/snippets: your own, on repos you can access
create policy conversations_own on public.conversations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_repo(repo_id));
create policy messages_own on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id and c.user_id = auth.uid()));
create policy code_snippets_own on public.code_snippets for all to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id and c.user_id = auth.uid()));

-- indexed output: read-only for org members, written by the backend
create policy documentation_select on public.documentation for select to authenticated
  using (public.can_access_repo(repo_id));
create policy pages_select on public.pages for select to authenticated
  using (exists (select 1 from public.documentation d
                 where d.id = documentation_id and public.can_access_repo(d.repo_id)));
create policy code_files_select on public.code_files for select to authenticated
  using (public.can_access_repo(repo_id));
create policy code_symbols_select on public.code_symbols for select to authenticated
  using (public.can_access_repo(repo_id));

-- ============================================================================
-- Storage: zip uploads for local repos
-- ============================================================================

-- ponytail: public bucket because the code uses getPublicUrl(); anyone with the URL
-- can download the zip. Make it private + signed URLs if uploads hold private code.
insert into storage.buckets (id, name, public)
values ('local_repos', 'local_repos', true)
on conflict (id) do nothing;

create policy local_repos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'local_repos');
create policy local_repos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'local_repos' and owner_id = auth.uid()::text);
