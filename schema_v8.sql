-- ============================================================
-- SGA-M · schema_v8.sql — correções pós-FASE 2 (§1–§3, §8)
-- Permissões granulares de ativos + histórico append-only
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schemas v1–v7 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- ---------- 1. ativos: split INSERT / UPDATE / DELETE ----------
-- criar → ADMIN/GESTOR · editar/status → AGT (status via action) ·
-- excluir física → SÓ ADMIN (com checagem de dependências na action).
drop policy if exists "ativos_write" on public.ativos;

drop policy if exists "ativos_insert" on public.ativos;
create policy "ativos_insert" on public.ativos
  for insert to authenticated
  with check (
    public.eh_membro(public.ativos.organization_id)
    and public.tem_papel(public.ativos.organization_id, array['ADMIN', 'GESTOR'])
  );

drop policy if exists "ativos_update" on public.ativos;
create policy "ativos_update" on public.ativos
  for update to authenticated
  using (
    public.eh_membro(public.ativos.organization_id)
    and public.tem_papel(public.ativos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.ativos.organization_id)
    and public.tem_papel(public.ativos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

drop policy if exists "ativos_delete" on public.ativos;
create policy "ativos_delete" on public.ativos
  for delete to authenticated
  using (
    public.eh_membro(public.ativos.organization_id)
    and public.tem_papel(public.ativos.organization_id, array['ADMIN'])
  );

-- ---------- 2. ativo_status_historico: APPEND-ONLY ----------
-- SELECT + INSERT por tenant/papel. Sem UPDATE/DELETE para ninguém:
-- o passado nunca é editado; novo status = nova linha.
drop policy if exists "ash_write" on public.ativo_status_historico;

drop policy if exists "ash_insert" on public.ativo_status_historico;
create policy "ash_insert" on public.ativo_status_historico
  for insert to authenticated
  with check (
    public.eh_membro(public.ativo_status_historico.organization_id)
    and public.tem_papel(public.ativo_status_historico.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

-- ---------- 3. auditoria: nova ação QR_REGENERATED ----------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'auditoria_logs_acao_check') then
    alter table public.auditoria_logs drop constraint auditoria_logs_acao_check;
  end if;
end
$$;
alter table public.auditoria_logs add constraint auditoria_logs_acao_check
  check (acao in ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN',
    'LOGOUT', 'APPROVAL', 'REJECTION', 'STOCK_ENTRY', 'STOCK_EXIT',
    'STOCK_ADJUSTMENT', 'MEMBERSHIP_CHANGE', 'ROLE_CHANGE', 'QR_REGENERATED'));
