-- Migrates the app to the proposal-aligned role model:
-- user -> space_owner -> admin, plus owner requests and workspace approval.

begin;

alter table public.users
drop constraint if exists users_role_check;

update public.users
set role = 'user'
where role not in ('admin', 'space_owner', 'user');

alter table public.users
alter column role set default 'user';

alter table public.users
add constraint users_role_check
check (role in ('admin', 'space_owner', 'user'));

create table if not exists public.space_owner_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('none', 'pending', 'approved', 'rejected')),
  message text,
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.workspaces
add column if not exists owner_id uuid references public.users(id) on delete set null;

alter table public.workspaces
add column if not exists approval_status text not null default 'approved';

alter table public.workspaces
add column if not exists rejection_reason text;

alter table public.workspaces
add column if not exists approved_by uuid references public.users(id) on delete set null;

alter table public.workspaces
add column if not exists approved_at timestamptz;

alter table public.workspaces
drop constraint if exists workspaces_approval_status_check;

alter table public.workspaces
add constraint workspaces_approval_status_check
check (approval_status in ('draft', 'pending_approval', 'approved', 'rejected', 'hidden'));

create index if not exists idx_workspaces_owner_id
  on public.workspaces(owner_id);

create index if not exists idx_workspaces_approval_status
  on public.workspaces(approval_status);

create index if not exists idx_space_owner_requests_user_id
  on public.space_owner_requests(user_id);

create index if not exists idx_space_owner_requests_status
  on public.space_owner_requests(status);

drop trigger if exists set_space_owner_requests_updated_at on public.space_owner_requests;
create trigger set_space_owner_requests_updated_at
before update on public.space_owner_requests
for each row execute function public.set_updated_at();

alter table public.space_owner_requests enable row level security;

commit;
