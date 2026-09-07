-- ============================================================
-- SGA-M · UNIFICADO: fix auditoria + v8 + v9 + v10 + v11 + v12 + v13 + v14 + v15
-- ------------------------------------------------------------
-- PROBLEMA RESOLVIDO: schema_v8.sql falhava ao recriar auditoria_logs_acao_check
-- porque havia linhas legadas com OS_CREATED que nao estavam na lista do v8.
-- SOLUCAO: este script coloca o FIX DA CONSTRAINT ANTES de qualquer
-- migration que recrie a constraint. O fix usa a lista completa (v14).
--
-- PASSO 1: aplicar este script no SQL Editor do Supabase
-- PASSO 2: se ainda houver erro, a mensagem indicara a linha exata
-- ============================================================

-- ============================================================
-- FIX 0: recriar constraint com lista COMPLETA antes de tudo
-- ============================================================
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'auditoria_logs_acao_check') then
    alter table public.auditoria_logs drop constraint auditoria_logs_acao_check;
  end if;
end
$$;
alter table public.auditoria_logs add constraint auditoria_logs_acao_check
  check (acao in (
    'INSERT', 'UPDATE', 'DELETE',
    'STATUS_CHANGE', 'LOGIN', 'LOGOUT',
    'APPROVAL', 'REJECTION',
    'STOCK_ENTRY', 'STOCK_EXIT', 'STOCK_ADJUSTMENT',
    'MEMBERSHIP_CHANGE', 'ROLE_CHANGE',
    'QR_REGENERATED',
    'TRIAGEM',
    'OS_CREATED', 'OS_CONCLUIDA',
    'CHECKLIST_CONCLUIDA',
    'FOTO_ADICIONADA',
    'COST_ADDED',
    'STOCK_CONSUMED'
  ));

-- ============================================================
-- v8.sql (sem o bloco de auditoria — ja feito acima)
-- ============================================================
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
drop policy if exists "ash_write" on public.ativo_status_historico;
drop policy if exists "ash_insert" on public.ativo_status_historico;
create policy "ash_insert" on public.ativo_status_historico
  for insert to authenticated
  with check (
    public.eh_membro(public.ativo_status_historico.organization_id)
    and public.tem_papel(public.ativo_status_historico.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

-- ============================================================
-- v9.sql
-- ============================================================
create or replace function public.enforce_same_org()
returns trigger as $$
declare
  v_org uuid;
  v_refs jsonb;
begin
  v_refs := case TG_TABLE_NAME
    when 'ativos' then jsonb_build_object(
      'localidade_id', new.localidade_id,
      'categoria_id', new.categoria_id,
      'fornecedor_id', new.fornecedor_id
    )
    else jsonb_build_object(
      'ativo_id', new.ativo_id,
      'chamado_id', new.chamado_id,
      'produto_id', new.produto_id,
      'fornecedor_id', new.fornecedor_id
    )
  end;
  if v_refs->>'localidade_id' is not null and
     (select organization_id from public.localidades where id = (v_refs->>'localidade_id')::uuid) is distinct from new.organization_id then
    raise exception 'Cross-tenant bloqueado: localidade de outra organizacao';
  end if;
  if v_refs->>'categoria_id' is not null and
     (select organization_id from public.categorias where id = (v_refs->>'categoria_id')::uuid) is distinct from new.organization_id then
    raise exception 'Cross-tenant bloqueado: categoria de outra organizacao';
  end if;
  if v_refs->>'fornecedor_id' is not null and
     (select organization_id from public.fornecedores where id = (v_refs->>'fornecedor_id')::uuid) is distinct from new.organization_id then
    raise exception 'Cross-tenant bloqueado: fornecedor de outra organizacao';
  end if;
  if v_refs->>'ativo_id' is not null and
     (select organization_id from public.ativos where id = (v_refs->>'ativo_id')::uuid) is distinct from new.organization_id then
    raise exception 'Cross-tenant bloqueado: ativo de outra organizacao';
  end if;
  if v_refs->>'chamado_id' is not null and
     (select organization_id from public.chamados where id = (v_refs->>'chamado_id')::uuid) is distinct from new.organization_id then
    raise exception 'Cross-tenant bloqueado: chamado de outra organizacao';
  end if;
  if v_refs->>'produto_id' is not null and
     (select organization_id from public.produtos where id = (v_refs->>'produto_id')::uuid) is distinct from new.organization_id then
    raise exception 'Cross-tenant bloqueado: produto de outra organizacao';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_org_ativos on public.ativos;
create trigger trg_org_ativos before insert or update on public.ativos
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_compras on public.compras;
create trigger trg_org_compras before insert or update on public.compras
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_movimentacoes on public.movimentacoes_estoque;
create trigger trg_org_movimentacoes before insert or update on public.movimentacoes_estoque
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_ativo_status on public.ativo_status_historico;
create trigger trg_org_ativo_status before insert or update on public.ativo_status_historico
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_ativo_doc on public.ativo_documentos;
create trigger trg_org_ativo_doc before insert or update on public.ativo_documentos
  for each row execute function public.enforce_same_org();
