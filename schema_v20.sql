-- ============================================================
-- SGA-M · schema_v20.sql — FASE 9.4 Hierarquia (membership → reports_to)
-- ------------------------------------------------------------
-- reports_to_membership_id pertence à MEMBERSHIP (tenant-scoped), não ao profiles.
-- NÃO aplicar em produção nesta fase (FASE 9.4 local apenas). Idempotente.
-- ============================================================

alter table public.memberships add column if not exists reports_to_membership_id uuid references public.memberships(id) on delete set null;
create index if not exists memberships_reports_to_idx on public.memberships(reports_to_membership_id);

comment on column public.memberships.reports_to_membership_id is 'Hierarquia: superior direto (membership da mesma organization_id)';

-- Tenant + ciclo + self
create or replace function public.check_membership_hierarchy()
returns trigger as $$
declare
  v_parent_org uuid;
  v_depth int := 0;
  v_cur uuid := NEW.reports_to_membership_id;
begin
  if NEW.reports_to_membership_id is null then return NEW; end if;
  if NEW.reports_to_membership_id = NEW.id then raise exception 'reports_to não pode ser self'; end if;

  select organization_id into v_parent_org from public.memberships where id = NEW.reports_to_membership_id;
  if v_parent_org is distinct from NEW.organization_id then
    raise exception 'Cross-tenant hierarquia bloqueada';
  end if;

  -- ciclo: seguir cadeia até 20 níveis
  while v_cur is not null and v_depth < 20 loop
    if v_cur = NEW.id then raise exception 'Ciclo detectado na hierarquia'; end if;
    select reports_to_membership_id into v_cur from public.memberships where id = v_cur;
    v_depth := v_depth + 1;
  end loop;
  if v_depth >= 20 then raise exception 'Hierarquia muito profunda'; end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_check_membership_hierarchy on public.memberships;
create trigger trg_check_membership_hierarchy before insert or update of reports_to_membership_id on public.memberships
for each row execute function public.check_membership_hierarchy();

-- Verificação:
-- select column_name from information_schema.columns where table_name='memberships' and column_name='reports_to_membership_id';
