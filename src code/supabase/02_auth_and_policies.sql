create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop policy if exists "users_select_own_or_admin" on public.users;
create policy "users_select_own_or_admin"
on public.users
for select
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
);

drop policy if exists "users_update_own_or_admin" on public.users;
create policy "users_update_own_or_admin"
on public.users
for update
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "buildings_read_authenticated" on public.buildings;
create policy "buildings_read_authenticated"
on public.buildings
for select
to authenticated
using (true);

drop policy if exists "buildings_manage_admin_manager" on public.buildings;
create policy "buildings_manage_admin_manager"
on public.buildings
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
);

drop policy if exists "floors_read_authenticated" on public.floors;
create policy "floors_read_authenticated"
on public.floors
for select
to authenticated
using (true);

drop policy if exists "floors_manage_admin_manager" on public.floors;
create policy "floors_manage_admin_manager"
on public.floors
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
);

drop policy if exists "workspaces_read_authenticated" on public.workspaces;
create policy "workspaces_read_authenticated"
on public.workspaces
for select
to authenticated
using (true);

drop policy if exists "workspaces_manage_admin_manager" on public.workspaces;
create policy "workspaces_manage_admin_manager"
on public.workspaces
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
);

drop policy if exists "bookings_select_own_or_admin_manager" on public.bookings;
create policy "bookings_select_own_or_admin_manager"
on public.bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
);

drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists "bookings_update_own_or_admin_manager" on public.bookings;
create policy "bookings_update_own_or_admin_manager"
on public.bookings
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
);

drop policy if exists "bookings_delete_own_or_admin_manager" on public.bookings;
create policy "bookings_delete_own_or_admin_manager"
on public.bookings
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'manager')
  )
);
