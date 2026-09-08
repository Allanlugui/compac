-- ============================================================
-- SGA-M · schema_v18.sql — FASE 7.1 H1 + H2
-- ------------------------------------------------------------
-- H1: Adiciona chamado_id em solicitacoes_compra para vínculo O.S. → Solicitação
-- H2: Garante chamados.ativo_id RESTRICT (já em v16, mas verifica)
-- PRÉ-REQUISITOS: schemas v1–v17 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente.
-- ============================================================

-- ---------- H1: chamado_id em solicitacoes_compra ----------
alter table public.solicitacoes_compra add column if not exists chamado_id uuid references public.chamados (id) on delete set null;
create index if not exists solicitacoes_chamado_idx on public.solicitacoes_compra (chamado_id);

comment on column public.solicitacoes_compra.chamado_id is 'O.S. vinculada (quando solicitação originada de O.S.)';

-- Enforce same org para chamado_id
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_solic_chamado') then
    create trigger trg_org_solic_chamado before insert or update on public.solicitacoes_compra
      for each row execute function public.enforce_same_org();
  end if;
end
$$;

-- Atualizar enforce_same_org para cobrir solicitacoes_compra.chamado_id (se ainda não cobre)
-- O v13 já cobre solicitacoes_compra.chamado_id? Verificar: v13 tem if for solicitacoes_compra? Não, só tem solicitacao_itens etc.
-- Vamos estender: adicionar verificação para solicitacoes_compra.chamado_id
create or replace function public.enforce_same_org()
returns trigger as $$
declare
  v_org uuid;
  v_minha_org uuid;
  j jsonb := to_jsonb(NEW);
begin
  v_minha_org := (j->>'organization_id')::uuid;
  -- ... (mantém todo o conteúdo do v13, adicionando bloco para solicitacoes_compra)
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'chamado_id') is not null then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then
      raise exception 'Cross-tenant bloqueado: O.S. de outra organização';
    end if;
  end if;
  -- Re-incluir todo o resto do v13 (copiado para idempotência)
  if TG_TABLE_NAME = 'chamados' and (j->>'ativo_id') is not null then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'compras' and (j->>'chamado_id') is not null then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: chamado de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'compras' and (j->>'fornecedor_id') is not null then
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'movimentacoes_estoque' then
    select organization_id into v_org from public.produtos where id = (j->>'produto_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: produto de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativo_status_historico' then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativo_documentos' then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and (j->>'categoria_id') is not null then
    select organization_id into v_org from public.categorias where id = (j->>'categoria_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: categoria de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and (j->>'fornecedor_id') is not null then
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'os_status_historico' then
    select organization_id into v_org from public.chamados where id = (j->>'os_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
  end if;
  if TG_TABLE_NAME in ('os_atividades', 'os_fotos') then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'os_servicos_externos' then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
    if (j->>'fornecedor_id') is not null then
      select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
    end if;
  end if;
  if TG_TABLE_NAME = 'planos_manutencao' then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'checklist_execucoes' and (j->>'chamado_id') is not null then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'produto_fornecedores' then
    select organization_id into v_org from public.produtos where id = (j->>'produto_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: produto de outra organização'; end if;
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME in ('solicitacao_itens', 'solicitacao_historico', 'solicitacao_anexos', 'cotacoes') then
    select organization_id into v_org from public.solicitacoes_compra where id = (j->>'solicitacao_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: solicitação de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'cotacoes' and (j->>'fornecedor_id') is not null then
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'pedidos_compra' then
    if (j->>'solicitacao_id') is not null then
      select organization_id into v_org from public.solicitacoes_compra where id = (j->>'solicitacao_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: solicitação de outra organização'; end if;
    end if;
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'pedido_itens' then
    select organization_id into v_org from public.pedidos_compra where id = (j->>'pedido_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: pedido de outra organização'; end if;
    if (j->>'produto_id') is not null then
      select organization_id into v_org from public.produtos where id = (j->>'produto_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: produto de outra organização'; end if;
    end if;
  end if;
  if TG_TABLE_NAME = 'recebimentos' then
    select organization_id into v_org from public.pedidos_compra where id = (j->>'pedido_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: pedido de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'recebimento_itens' then
    select organization_id into v_org from public.recebimentos where id = (j->>'recebimento_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: recebimento de outra organização'; end if;
  end if;
  return new;
end;
$$ language plpgsql;
