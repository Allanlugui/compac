-- ============================================================
-- SGA-M · schema_v9.sql — integridade de tenant do ativo
-- Estende enforce_same_org(): ativo → localidade/categoria/fornecedor
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schemas v1–v8 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado. QRs legados intactos.
-- ============================================================

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
  if TG_TABLE_NAME = 'ativo_status_historico' then
    select organization_id into v_org from public.ativos where id = new.ativo_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: ativo de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativo_documentos' then
    select organization_id into v_org from public.ativos where id = new.ativo_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: ativo de outra organização';
    end if;
  end if;
  -- FASE 2 (correção de integridade): referências DO ativo.
  if TG_TABLE_NAME = 'ativos' and new.localidade_id is not null then
    select organization_id into v_org from public.localidades where id = new.localidade_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: localidade de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and new.categoria_id is not null then
    select organization_id into v_org from public.categorias where id = new.categoria_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: categoria de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and new.fornecedor_id is not null then
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_org_ativos on public.ativos;
create trigger trg_org_ativos before insert or update on public.ativos
  for each row execute function public.enforce_same_org();
