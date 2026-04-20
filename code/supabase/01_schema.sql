create extension if not exists "pgcrypto";
create extension if not exists btree_gist;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'employee'
    check (role in ('admin', 'manager', 'employee')),
  department text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  total_floors integer not null default 1 check (total_floors >= 1),
  open_time time,
  close_time time,
  created_at timestamptz not null default now()
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  floor_number integer not null,
  name text,
  svg_map_url text,
  created_at timestamptz not null default now(),
  unique (building_id, floor_number)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  name text not null,
  type text not null default 'desk' check (type in ('desk')),
  status text not null default 'available'
    check (status in ('available', 'maintenance')),
  svg_element_id text not null,
  qr_code_value text not null unique,
  capacity integer not null default 1 check (capacity >= 1),
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (floor_id, svg_element_id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.bookings
drop constraint if exists bookings_no_overlap;

alter table public.bookings
add constraint bookings_no_overlap
exclude using gist (
  workspace_id with =,
  tstzrange(start_time, end_time, '[)') with &&
)
where (status in ('confirmed', 'checked_in'));

create index if not exists idx_floors_building_id
  on public.floors(building_id);

create index if not exists idx_workspaces_floor_id
  on public.workspaces(floor_id);

create index if not exists idx_bookings_user_id
  on public.bookings(user_id);

create index if not exists idx_bookings_workspace_id
  on public.bookings(workspace_id);

create index if not exists idx_bookings_status
  on public.bookings(status);

create index if not exists idx_bookings_start_time
  on public.bookings(start_time);

alter table public.users enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.workspaces enable row level security;
alter table public.bookings enable row level security;
