create extension if not exists pgcrypto;
create table if not exists public.diaper_stock (size text primary key check(size in ('RN','P','M','G','XG')),sort_order int not null unique,total int not null check(total>=0));
create table if not exists public.reservations(id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 2 and 80),token_hash text not null unique,created_at timestamptz not null default now(),cancelled_at timestamptz);
create table if not exists public.reservation_items(reservation_id uuid not null references public.reservations(id),size text not null references public.diaper_stock(size),quantity int not null check(quantity between 1 and 100),primary key(reservation_id,size));
insert into public.diaper_stock(size,sort_order,total) values ('RN',1,5),('P',2,10),('M',3,20),('G',4,15),('XG',5,10) on conflict(size) do nothing;
create or replace view public.stock_public with (security_invoker=false) as select s.size,s.sort_order,s.total,coalesce(sum(i.quantity) filter(where r.cancelled_at is null),0)::int as reserved,(s.total-coalesce(sum(i.quantity) filter(where r.cancelled_at is null),0))::int as available from public.diaper_stock s left join public.reservation_items i on i.size=s.size left join public.reservations r on r.id=i.reservation_id group by s.size,s.sort_order,s.total;
create or replace function public.validate_reservation_items(p_items jsonb) returns void
language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'invalid_items'; end if;
 if jsonb_array_length(p_items) not between 1 and 5 then raise exception 'invalid_items'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where
   jsonb_typeof(x) is distinct from 'object'
   or coalesce(x->>'size','') not in ('RN','P','M','G','XG')
   or jsonb_typeof(x->'quantity') is distinct from 'number'
   or (x->>'quantity') !~ '^[0-9]{1,3}$') then raise exception 'invalid_items'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'quantity')::int not between 1 and 100)
 or (select count(distinct x->>'size') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items)
 then raise exception 'invalid_items'; end if;
end $$;
revoke all on function public.validate_reservation_items(jsonb) from public,anon,authenticated;
create or replace function public.create_reservation(p_name text,p_token_hash text,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid; v_item jsonb; v_available int; begin
 perform public.validate_reservation_items(p_items);
 perform 1 from public.diaper_stock order by size for update;
 for v_item in select value from jsonb_array_elements(p_items) loop
 select available into v_available from public.stock_public where size=v_item->>'size';
 if v_available is null or v_available < (v_item->>'quantity')::int then raise exception 'insufficient_stock';end if;
 end loop;
 insert into public.reservations(name,token_hash) values(p_name,p_token_hash) returning id into v_id;
 insert into public.reservation_items(reservation_id,size,quantity) select v_id,x.size,x.quantity from jsonb_to_recordset(p_items) as x(size text,quantity int);
 return v_id;end $$;
create or replace function public.get_reservation(p_token_hash text) returns table(name text,items jsonb) language sql security definer set search_path='' as $$ select r.name,coalesce(jsonb_agg(jsonb_build_object('size',i.size,'quantity',i.quantity) order by i.size),'[]'::jsonb) from public.reservations r join public.reservation_items i on i.reservation_id=r.id where r.token_hash=p_token_hash and r.cancelled_at is null group by r.id $$;
create or replace function public.cancel_reservation(p_token_hash text) returns boolean language plpgsql security definer set search_path='' as $$ declare v_id uuid;begin perform 1 from public.diaper_stock order by size for update;update public.reservations set cancelled_at=now() where token_hash=p_token_hash and cancelled_at is null returning id into v_id;return v_id is not null;end $$;
create or replace function public.update_reservation(p_token_hash text,p_items jsonb) returns boolean language plpgsql security definer set search_path='' as $$ declare v_id uuid;v_item jsonb;v_available int;v_old int;begin
 perform public.validate_reservation_items(p_items);
 perform 1 from public.diaper_stock order by size for update;
 select id into v_id from public.reservations where token_hash=p_token_hash and cancelled_at is null;
 if v_id is null then return false;end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
 select available into v_available from public.stock_public where size=v_item->>'size';
 select coalesce(quantity,0) into v_old from public.reservation_items where reservation_id=v_id and size=v_item->>'size';
 if v_available is null or v_available+coalesce(v_old,0)<(v_item->>'quantity')::int then raise exception 'insufficient_stock';end if;
 end loop;
 delete from public.reservation_items where reservation_id=v_id;
 insert into public.reservation_items(reservation_id,size,quantity) select v_id,x.size,x.quantity from jsonb_to_recordset(p_items) as x(size text,quantity int);
 return true;end $$;
alter table public.diaper_stock enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
revoke all on public.diaper_stock,public.reservations,public.reservation_items from anon,authenticated;
revoke all on public.stock_public from anon,authenticated;
revoke all on function public.create_reservation(text,text,jsonb),public.get_reservation(text),public.cancel_reservation(text),public.update_reservation(text,jsonb) from public,anon,authenticated;
grant select on public.stock_public to service_role;
grant execute on function public.create_reservation(text,text,jsonb),public.get_reservation(text),public.cancel_reservation(text),public.update_reservation(text,jsonb) to service_role;
