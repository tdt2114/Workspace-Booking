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
    'user'
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
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "users_update_own_or_admin" on public.users;
drop policy if exists "users_update_admin_only" on public.users;
create policy "users_update_admin_only"
on public.users
for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  exists (
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

drop policy if exists "buildings_manage_admin_only" on public.buildings;
create policy "buildings_manage_admin_only"
on public.buildings
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "floors_read_authenticated" on public.floors;
create policy "floors_read_authenticated"
on public.floors
for select
to authenticated
using (true);

drop policy if exists "floors_manage_admin_only" on public.floors;
create policy "floors_manage_admin_only"
on public.floors
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "workspaces_read_authenticated" on public.workspaces;
create policy "workspaces_read_authenticated"
on public.workspaces
for select
to authenticated
using (
  approval_status = 'approved'
  or owner_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "workspaces_insert_admin_or_owner" on public.workspaces;
create policy "workspaces_insert_admin_or_owner"
on public.workspaces
for insert
to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
  or (
    owner_id = auth.uid()
    and approval_status in ('draft', 'pending_approval')
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'space_owner'
    )
  )
);

drop policy if exists "workspaces_update_admin_or_owner" on public.workspaces;
create policy "workspaces_update_admin_or_owner"
on public.workspaces
for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
  or (
    owner_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'space_owner'
    )
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
  or (
    owner_id = auth.uid()
    and approval_status in ('draft', 'pending_approval', 'hidden')
    and approved_by is null
    and approved_at is null
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'space_owner'
    )
  )
);

drop policy if exists "workspaces_delete_admin_or_owner" on public.workspaces;
create policy "workspaces_delete_admin_or_owner"
on public.workspaces
for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
  or (
    owner_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'space_owner'
    )
  )
);

drop policy if exists "space_owner_requests_select_own_or_admin" on public.space_owner_requests;
create policy "space_owner_requests_select_own_or_admin"
on public.space_owner_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "space_owner_requests_insert_own_user" on public.space_owner_requests;
create policy "space_owner_requests_insert_own_user"
on public.space_owner_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'user'
  )
);

drop policy if exists "space_owner_requests_update_admin_only" on public.space_owner_requests;
create policy "space_owner_requests_update_admin_only"
on public.space_owner_requests
for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "bookings_select_by_role" on public.bookings;
create policy "bookings_select_by_role"
on public.bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
  or exists (
    select 1
    from public.users u
    join public.workspaces w on w.id = public.bookings.workspace_id
    where u.id = auth.uid()
      and u.role = 'space_owner'
      and w.owner_id = auth.uid()
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

drop policy if exists "bookings_update_own_or_admin" on public.bookings;
create policy "bookings_update_own_or_admin"
on public.bookings
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);

drop policy if exists "bookings_delete_own_or_admin" on public.bookings;
create policy "bookings_delete_own_or_admin"
on public.bookings
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  )
);
