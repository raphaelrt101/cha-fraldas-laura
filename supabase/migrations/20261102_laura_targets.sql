-- Execute uma vez no SQL Editor do projeto Supabase existente.
-- Também é seguro repetir: não apaga participantes, itens ou reservas.
begin;
-- Mesmo bloqueio e mesma ordem usados pelas funções de reserva/cancelamento.
select size from public.diaper_stock order by size for update;
do $$
begin
  if exists (
    select 1 from public.stock_public s
    join (values ('RN',2),('P',5),('M',7),('G',6),('XG',0)) as targets(size,total)
    on s.size=targets.size
    where s.reserved > targets.total
  ) then
    raise exception 'Existem reservas acima das novas metas. Nenhuma quantidade foi alterada. Revise as reservas antes de aplicar.';
  end if;
end $$;
update public.diaper_stock s
set total=targets.total
from (values ('RN',2),('P',5),('M',7),('G',6),('XG',0)) as targets(size,total)
where s.size=targets.size;
commit;
select size,total,reserved,available from public.stock_public order by sort_order;
