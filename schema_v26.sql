-- ============================================================
-- SGA-M · schema_v26.sql — BLOCO 4: QR compras relacional
-- ------------------------------------------------------------
-- Liga `qr_contextos` e `solicitacoes_compra` aos cadastros
-- mestres (Blocos 1–2): localidade, departamento, centro de
-- custo e almoxarifado passam a IDs relacionais.
-- Colunas texto legadas permanecem como snapshot/auditoria e
-- fallback (formulários antigos e QRs já impressos seguem válidos).
-- Nenhum dado existente é apagado.
-- PRÉ-REQUISITOS: schemas v1–v25 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- ---------- 1. qr_contextos: vínculos relacionais ----------
alter table public.qr_contextos add column if not exists localidade_id uuid
  references public.localidades (id) on delete set null;
alter table public.qr_contextos add column if not exists departamento_id uuid
  references public.departamentos_setores (id) on delete set null;
alter table public.qr_contextos add column if not exists centro_custo_id uuid
  references public.centros_custo (id) on delete set null;
alter table public.qr_contextos add column if not exists almoxarifado_id uuid
  references public.almoxarifados (id) on delete set null;

create index if not exists qrc_localidade_idx on public.qr_contextos (localidade_id);
create index if not exists qrc_departamento_idx on public.qr_contextos (departamento_id);
create index if not exists qrc_cc_idx on public.qr_contextos (centro_custo_id);
create index if not exists qrc_almox_idx on public.qr_contextos (almoxarifado_id);

comment on column public.qr_contextos.localidade_id is 'BLOCO 4: vínculo relacional (texto legado mantido como snapshot).';
comment on column public.qr_contextos.departamento_id is 'BLOCO 4: vínculo relacional.';
comment on column public.qr_contextos.centro_custo_id is 'BLOCO 4: vínculo relacional.';
comment on column public.qr_contextos.almoxarifado_id is 'BLOCO 4: vínculo relacional.';

-- ---------- 2. solicitacoes_compra: origem + vínculos do QR ----------
alter table public.solicitacoes_compra add column if not exists qr_contexto_id uuid
  references public.qr_contextos (id) on delete set null;
alter table public.solicitacoes_compra add column if not exists localidade_id uuid
  references public.localidades (id) on delete set null;
alter table public.solicitacoes_compra add column if not exists departamento_id uuid
  references public.departamentos_setores (id) on delete set null;
alter table public.solicitacoes_compra add column if not exists centro_custo_id uuid
  references public.centros_custo (id) on delete set null;
alter table public.solicitacoes_compra add column if not exists almoxarifado_id uuid
  references public.almoxarifados (id) on delete set null;

create index if not exists solic_qrctx_idx on public.solicitacoes_compra (qr_contexto_id);
create index if not exists solic_localidade_idx on public.solicitacoes_compra (localidade_id);
create index if not exists solic_departamento_idx on public.solicitacoes_compra (departamento_id);
create index if not exists solic_cc_idx on public.solicitacoes_compra (centro_custo_id);
create index if not exists solic_almox_idx on public.solicitacoes_compra (almoxarifado_id);

comment on column public.solicitacoes_compra.qr_contexto_id is 'BLOCO 4: QR de origem (rastreabilidade). NULL = portal/manual/legado.';
comment on column public.solicitacoes_compra.localidade_id is 'BLOCO 4: copiado do contexto QR (NULL = sem vínculo).';

-- ---------- 3. enforce_same_org (estende v25; corpo integral + 2 blocos) ----------
create or replace function public.enforce_same_org()
returns trigger as $$
declare
  v_org uuid;
  v_minha_org uuid;
  j jsonb := to_jsonb(NEW);
begin
  v_minha_org := (j->>'organization_id')::uuid;
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'chamado_id') is not null then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then
      raise exception 'Cross-tenant bloqueado: O.S. de outra organização';
    end if;
  end if;
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
  -- BLOCO 1 (v23): vínculos das tabelas de cadastros
  if TG_TABLE_NAME = 'departamentos_setores' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'centros_custo' and (j->>'departamento_id') is not null then
    select organization_id into v_org from public.departamentos_setores where id = (j->>'departamento_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: departamento de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'centros_custo' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  -- BLOCO 2 (v24): vínculos de almoxarifado
  if TG_TABLE_NAME = 'almoxarifados' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'produtos' and (j->>'almoxarifado_id') is not null then
    select organization_id into v_org from public.almoxarifados where id = (j->>'almoxarifado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'movimentacoes_estoque' and (j->>'almoxarifado_id') is not null then
    select organization_id into v_org from public.almoxarifados where id = (j->>'almoxarifado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
  end if;
  -- BLOCO 3 (v25): alvo deve ser membro ativo da org; escopo na mesma org
  if TG_TABLE_NAME = 'permissoes_custom' then
    perform 1 from public.memberships
      where user_id = (j->>'user_id')::uuid and organization_id = v_minha_org and status = 'ativo';
    if not found then
      raise exception 'Cross-tenant bloqueado: usuário sem vínculo ativo na organização';
    end if;
    if (j->>'escopo_tipo') = 'localidade' then
      select organization_id into v_org from public.localidades where id = (j->>'escopo_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
    end if;
    if (j->>'escopo_tipo') = 'almoxarifado' then
      select organization_id into v_org from public.almoxarifados where id = (j->>'escopo_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
    end if;
  end if;
  -- BLOCO 4 (v26): vínculos do QR de compras
  if TG_TABLE_NAME = 'qr_contextos' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'qr_contextos' and (j->>'departamento_id') is not null then
    select organization_id into v_org from public.departamentos_setores where id = (j->>'departamento_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: departamento de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'qr_contextos' and (j->>'centro_custo_id') is not null then
    select organization_id into v_org from public.centros_custo where id = (j->>'centro_custo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: centro de custo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'qr_contextos' and (j->>'almoxarifado_id') is not null then
    select organization_id into v_org from public.almoxarifados where id = (j->>'almoxarifado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'qr_contexto_id') is not null then
    select organization_id into v_org from public.qr_contextos where id = (j->>'qr_contexto_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: contexto QR de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'departamento_id') is not null then
    select organization_id into v_org from public.departamentos_setores where id = (j->>'departamento_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: departamento de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'centro_custo_id') is not null then
    select organization_id into v_org from public.centros_custo where id = (j->>'centro_custo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: centro de custo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'almoxarifado_id') is not null then
    select organization_id into v_org from public.almoxarifados where id = (j->>'almoxarifado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
  end if;
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_departamentos') then
    create trigger trg_org_departamentos before insert or update on public.departamentos_setores
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_centros_custo') then
    create trigger trg_org_centros_custo before insert or update on public.centros_custo
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_almoxarifados') then
    create trigger trg_org_almoxarifados before insert or update on public.almoxarifados
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_produtos') then
    create trigger trg_org_produtos before insert or update on public.produtos
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_permissoes') then
    create trigger trg_org_permissoes before insert or update on public.permissoes_custom
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_qr_contextos') then
    create trigger trg_org_qr_contextos before insert or update on public.qr_contextos
      for each row execute function public.enforce_same_org();
  end if;
end
$$;
-- `trg_org_solic_chamado` (v18) já cobre `solicitacoes_compra`: blocos novos pegam carona.
