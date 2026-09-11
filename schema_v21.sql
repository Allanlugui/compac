-- ============================================================
-- SGA-M · schema_v21.sql — FASE 9.5 Performance (avaliacoes)
-- ------------------------------------------------------------
-- NÃO aplicar em produção nesta fase (local apenas). Idempotente.
-- ============================================================

create table if not exists public.performance_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  avaliado_membership_id uuid not null references public.memberships(id) on delete cascade,
  avaliador_membership_id uuid not null references public.memberships(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  score_auto int check (score_auto between 0 and 100),
  score_gerencial int check (score_gerencial between 0 and 100),
  score_final int check (score_final between 0 and 100),
  estado text not null check (estado in ('insufficient_data','active','completed','not_rated')),
  versao int not null default 1,
  comentario text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, avaliado_membership_id, periodo_inicio, periodo_fim, versao)
);
create index if not exists perf_eval_org_idx on public.performance_evaluations(organization_id);
create index if not exists perf_eval_avaliado_idx on public.performance_evaluations(avaliado_membership_id);

-- Helper para GESTOR subtree (se reports_to existir, senão fallback para avaliador=self)
create or replace function public.is_subordinado(avaliado uuid, avaliador uuid) returns boolean as $$
declare v_cur uuid; v_depth int:=0;
begin
  select reports_to_membership_id into v_cur from public.memberships where id=avaliado;
  while v_cur is not null and v_depth<20 loop
    if v_cur=avaliador then return true; end if;
    select reports_to_membership_id into v_cur from public.memberships where id=v_cur;
    v_depth:=v_depth+1;
  end loop;
  return false;
end; $$ language plpgsql stable;

alter table public.performance_evaluations enable row level security;
drop policy if exists perf_select on public.performance_evaluations;
create policy perf_select on public.performance_evaluations for select using (
  eh_membro(organization_id) and (
    avaliado_membership_id in (select id from public.memberships where user_id = auth.uid() and organization_id = performance_evaluations.organization_id)
    or avaliador_membership_id in (select id from public.memberships where user_id = auth.uid() and organization_id = performance_evaluations.organization_id)
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.organization_id = performance_evaluations.organization_id and m.role = 'ADMIN')
    or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.organization_id = performance_evaluations.organization_id and m.role = 'GESTOR' and public.is_subordinado(performance_evaluations.avaliado_membership_id, m.id))
  )
);
drop policy if exists perf_insert on public.performance_evaluations;
create policy perf_insert on public.performance_evaluations for insert with check (
  eh_membro(organization_id) and
  avaliador_membership_id in (select id from public.memberships where user_id = auth.uid() and organization_id = performance_evaluations.organization_id)
  and avaliado_membership_id != avaliador_membership_id
);
