-- ============================================================
-- SGA-M · schema_v5.sql — gestão de acessos + impacto operacional
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schema.sql (v1), schema_v2.sql (v2), schema_v4.sql (v3)
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado. Backfill preserva tudo.
-- ============================================================

-- ---------- 1. memberships: setor + departamento (por vínculo) ----------
alter table public.memberships add column if not exists setor text;
alter table public.memberships add column if not exists departamento text;

-- Limites defensivos (80 chars, como setor em compras).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_setor_len') then
    alter table public.memberships add constraint memberships_setor_len
      check (setor is null or (char_length(setor) between 1 and 80));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'memberships_departamento_len') then
    alter table public.memberships add constraint memberships_departamento_len
      check (departamento is null or (char_length(departamento) between 1 and 80));
  end if;
end
$$;

comment on column public.memberships.setor is
  'Setor do membro NESTA organização (por vínculo, não global).';
comment on column public.memberships.departamento is
  'Departamento do membro NESTA organização (por vínculo, não global).';

-- ---------- 2. chamados: impacto operacional ----------
-- 5 níveis: baixo, medio, alto, critico, parada_total.
-- Nullable para não quebrar chamados existentes (sem backfill forçado).
alter table public.chamados add column if not exists impacto text
  check (impacto in ('baixo', 'medio', 'alto', 'critico', 'parada_total'));

create index if not exists chamados_impacto_idx on public.chamados (impacto);
create index if not exists chamados_org_impacto_idx
  on public.chamados (organization_id, impacto);

comment on column public.chamados.impacto is
  'Nível de impacto operacional da ocorrência (5 níveis).';

-- ============================================================
-- 3. HARDENING (auditoria de segurança, idempotente)
-- Requer schema_v4 aplicado. Rode junto ou depois das seções 1–2.
-- ============================================================

-- 3a. memberships: escrita SÓ ADMIN (app exige ADMIN; GESTOR via REST
-- direta conseguia se autopromover — escalonamento de privilégio).
drop policy if exists "memb_write_admin" on public.memberships;
create policy "memb_write_admin" on public.memberships
  for all to authenticated
  using (public.tem_papel(public.memberships.organization_id, array['ADMIN']))
  with check (public.tem_papel(public.memberships.organization_id, array['ADMIN']));

-- 3b. enforce_same_org: checar chamado E fornecedor de forma
-- independente. Antes, o `elsif` validava só o primeiro quando ambos
-- estavam preenchidos (compra da org A + fornecedor da org B passava).
create or replace function public.enforce_same_org()
returns trigger as $$
declare
  v_org uuid;
begin
  if TG_TABLE_NAME = 'chamados' and new.ativo_id is not null then
    select organization_id into v_org from public.ativos where id = new.ativo_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: ativo de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'compras' and new.chamado_id is not null then
    select organization_id into v_org from public.chamados where id = new.chamado_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: chamado de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'compras' and new.fornecedor_id is not null then
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'movimentacoes_estoque' then
    select organization_id into v_org from public.produtos where id = new.produto_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: produto de outra organização';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- 3c. auditoria: insert exige membership na org do log. Antes,
-- `with check (true)` permitia forjar logs em qualquer org (inclusive
-- organization_id NULL, visível a TODOS os autenticados).
drop policy if exists "audit_insert" on public.auditoria_logs;
create policy "audit_insert" on public.auditoria_logs
  for insert to authenticated
  with check (public.eh_membro(public.auditoria_logs.organization_id));

-- 3d. checklist_respostas: escrita por papel operacional, como as
-- execuções. Antes, qualquer membro (SOLICITANTE/AUDITOR) podia forjar
-- respostas via REST direta.
drop policy if exists "ckr_all" on public.checklist_respostas;
create policy "ckr_all" on public.checklist_respostas
  for all to authenticated
  using (
    exists (
      select 1 from public.checklist_execucoes ex
      where ex.id = public.checklist_respostas.execucao_id
        and public.eh_membro(ex.organization_id)
        and public.tem_papel(ex.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
    )
  )
  with check (
    exists (
      select 1 from public.checklist_execucoes ex
      where ex.id = public.checklist_respostas.execucao_id
        and public.eh_membro(ex.organization_id)
        and public.tem_papel(ex.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
    )
  );
