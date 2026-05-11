insert into public.buildings (name, address, total_floors, open_time, close_time)
select 'Head Office', 'Bangkok', 1, '08:00', '18:00'
where not exists (
  select 1 from public.buildings where name = 'Head Office'
);

with b as (
  select id from public.buildings where name = 'Head Office' limit 1
)
insert into public.floors (building_id, floor_number, name, svg_map_url)
select b.id, 1, 'Floor 1', null
from b
where not exists (
  select 1 from public.floors f
  where f.building_id = b.id and f.floor_number = 1
);

with f as (
  select floors.id
  from public.floors
  join public.buildings on buildings.id = floors.building_id
  where buildings.name = 'Head Office' and floors.floor_number = 1
  limit 1
)
insert into public.workspaces (
  floor_id, name, type, status, svg_element_id, qr_code_value, capacity, features
)
select f.id, v.name, 'desk', 'available', v.svg_element_id, v.qr_code_value, 1, '{}'::jsonb
from f
cross join (
  values
    ('Desk A-01', 'desk_a_01', 'desk_a_01'),
    ('Desk A-02', 'desk_a_02', 'desk_a_02'),
    ('Desk A-03', 'desk_a_03', 'desk_a_03'),
    ('Desk A-04', 'desk_a_04', 'desk_a_04'),
    ('Desk A-05', 'desk_a_05', 'desk_a_05'),
    ('Desk B-01', 'desk_b_01', 'desk_b_01'),
    ('Desk B-02', 'desk_b_02', 'desk_b_02'),
    ('Desk B-03', 'desk_b_03', 'desk_b_03'),
    ('Desk B-04', 'desk_b_04', 'desk_b_04'),
    ('Desk B-05', 'desk_b_05', 'desk_b_05')
) as v(name, svg_element_id, qr_code_value)
where not exists (
  select 1 from public.workspaces w
  where w.floor_id = f.id and w.svg_element_id = v.svg_element_id
);

-- Sau khi tao 3 user trong Authentication -> Users, chay phan update role nay
-- de gan role dung cho tai khoan demo.
update public.users set role = 'admin' where email = 'admin@demo.com';
update public.users set role = 'space_owner' where email = 'space-owner@demo.com';
update public.users set role = 'user' where email = 'user@demo.com';
