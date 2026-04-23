alter table public.workspaces
drop constraint if exists workspaces_type_check;

alter table public.workspaces
add constraint workspaces_type_check
check (
  type in ('desk', 'meeting_room', 'focus_room', 'lab', 'room', 'parking')
);

alter table public.workspaces
drop constraint if exists workspaces_status_check;

alter table public.workspaces
add constraint workspaces_status_check
check (
  status in ('available', 'maintenance', 'inactive')
);
