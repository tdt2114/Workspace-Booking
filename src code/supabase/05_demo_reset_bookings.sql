-- Demo/dev helper only. Do not run this against production data.
--
-- Purpose:
-- - Clear active booking quota for the three demo accounts.
-- - Keep a small non-active booking history so demo pages are not empty.
-- - Avoid old or future manual-test bookings blocking new booking scenarios.
--
-- Safe scope:
-- - This script only deletes bookings owned by these demo emails:
--   admin@demo.com, space-owner@demo.com, user@demo.com.
-- - It does not delete users, buildings, floors, workspaces, or storage files.

begin;

with demo_users as (
  select id
  from public.users
  where email in ('admin@demo.com', 'space-owner@demo.com', 'user@demo.com')
)
delete from public.bookings b
using demo_users du
where b.user_id = du.id;

update public.workspaces
set status = 'available'
where qr_code_value in (
  'desk_a_01',
  'desk_a_02',
  'desk_a_03',
  'desk_b_03',
  'room_m_01'
);

with app_user as (
  select id
  from public.users
  where email = 'user@demo.com'
  limit 1
),
completed_workspace as (
  select id
  from public.workspaces
  where qr_code_value = 'desk_a_01'
  limit 1
),
no_show_workspace as (
  select id
  from public.workspaces
  where qr_code_value = 'desk_a_02'
  limit 1
)
insert into public.bookings (
  user_id,
  workspace_id,
  start_time,
  end_time,
  status,
  checked_in_at,
  created_at
)
select
  app_user.id,
  completed_workspace.id,
  date_trunc('day', now()) - interval '2 days' + interval '9 hours',
  date_trunc('day', now()) - interval '2 days' + interval '10 hours',
  'completed',
  date_trunc('day', now()) - interval '2 days' + interval '9 hours 5 minutes',
  now()
from app_user, completed_workspace
union all
select
  app_user.id,
  no_show_workspace.id,
  date_trunc('day', now()) - interval '1 day' + interval '9 hours',
  date_trunc('day', now()) - interval '1 day' + interval '10 hours',
  'no_show',
  null,
  now()
from app_user, no_show_workspace;

commit;

select
  u.email,
  w.name as workspace_name,
  b.start_time,
  b.end_time,
  b.status,
  b.checked_in_at
from public.bookings b
join public.users u on u.id = b.user_id
join public.workspaces w on w.id = b.workspace_id
where u.email in ('admin@demo.com', 'space-owner@demo.com', 'user@demo.com')
order by b.start_time desc;
