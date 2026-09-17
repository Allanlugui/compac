-- ============================================================
-- SGA-M · schema_v24.sql — BLOCO 2: almoxarifados + estoque dual
-- ------------------------------------------------------------
-- Cria `almoxarifados` físicos (vinculados a `localidades`) e
-- referencia o almoxarifado em `produtos` + `movimentacoes_estoque`.
-- Modelo DUAL e retrocompatível:
--   · `produtos.estoque_atual` segue como saldo GLOBAL (Visão
--     Unificada — somada, sem quebra de telas/relatórios/RPC);
--   · `almoxarifado_id` (nullable) segmenta por almoxarifado
--     (Visão Segmentada). NULL = sem vínculo (legado).
-- A RPC `movimentar_estoque_atomic` ganha 2 parâmetros OPCIONAIS
-- (default NULL): chamadas antigas (9 args, testes inclusos)
-- continuam funcionando sem alteração.
-- Nenhum dado existente é apagado.
-- PRÉ-REQUISITOS: schemas v1–v23 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- ---------- 1. almoxarifados ----------
create table if not exists public.almoxarifados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  codigo text check (codigo is null or char_length(codigo) between 1 and 20),
  localidade_id uuid references public.localidades (id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, nome)
);

create index if not exists almox_org_idx on public.almoxarifados (organization_id);
create index if not exists almox_localidade_idx on public.almoxarifados (localidade_id);

comment on table public.almoxarifados is
  'Almoxarifados físicos da org, opcionalmente vinculados a um nó da árvore física (localidades).';

-- ---------- 2. vínculos (nullable = legado sem vínculo) ----------
alter table public.produtos add column if not exists almoxarifado_id uuid
  references public.almoxarifados (id) on delete set null;
create index if not exists produtos_almox_idx on public.produtos (almoxarifado_id);

alter table public.movimentacoes_estoque add column if not exists almoxarifado_id uuid
  references public.almoxarifados (id) on delete set null;
create index if not exists mov_almox_idx on public.movimentacoes_estoque (almoxarifado_id);

comment on column public.produtos.almoxarifado_id is 'Almoxarifado principal do produto (NULL = sem vínculo). Saldo global segue em estoque_atual.';
comment on column public.movimentacoes_estoque.almoxarifado_id is 'Almoxarifado da movimentação (par transferência: saída=origem, entrada=destino). NULL = legado.';

-- ---------- 3. RLS (padrão v6: leitura membros; escrita ADMIN/GESTOR) ----------
alter table public.almoxarifados enable row level security;

grant select, insert, update, delete on public.almoxarifados to authenticated;

drop policy if exists "almox_select" on public.almoxarifados;
create policy "almox_select" on public.almoxarifados
  for select to authenticated
  using (public.eh_membro(public.almoxarifados.organization_id));
drop policy if exists "almox_write" on public.almoxarifados;
create policy "almox_write" on public.almoxarifados
  for all to authenticated
  using (
    public.eh_membro(public.almoxarifados.organization_id)
    and public.tem_papel(public.almoxarifados.organization_id, array['ADMIN', 'GESTOR'])
  )
  with check (
    public.eh_membro(public.almoxarifados.organization_id)
    and public.tem_papel(public.almoxarifados.organization_id, array['ADMIN', 'GESTOR'])
  );

-- ---------- 4. RPC com almoxarifado opcional (DROP+CREATE: nº de args mudou) ----------
drop function if exists public.movimentar_estoque_atomic(uuid, text, numeric, numeric, uuid, text, text, text, text);

create or replace function public.movimentar_estoque_atomic(
  p_produto uuid,
  p_tipo text,
  p_qtd numeric,
  p_custo numeric,
  p_chamado uuid,
  p_obs text,
  p_origem text,
  p_destino text,
  p_executado_por text,
  p_almoxarifado uuid default null,
  p_almoxarifado_destino uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_fis numeric;
  v_res numeric;
  v_min numeric;
  v_codigo text;
  v_nf numeric;
  v_nr numeric;
  v_disp numeric;
  v_ator text;
  v_almox uuid;
begin
  if p_tipo not in ('entrada', 'saida', 'ajuste', 'reserva', 'consumo', 'devolucao', 'transferencia') then
    return jsonb_build_object('ok', false, 'error', 'Tipo inválido.');
  end if;
  if p_qtd is null or p_qtd <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Quantidade deve ser maior que zero.');
  end if;
  if p_custo is not null and p_custo < 0 then
    return jsonb_build_object('ok', false, 'error', 'Custo negativo.');
  end if;
  v_ator := coalesce(nullif(auth.jwt()->>'email', ''), p_executado_por, 'sistema');

  select organization_id, estoque_atual, estoque_reservado, estoque_minimo, codigo
    into v_org, v_fis, v_res, v_min, v_codigo
    from public.produtos
    where id = p_produto
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Produto não encontrado.');
  end if;
  if not public.eh_membro(v_org) then
    return jsonb_build_object('ok', false, 'error', 'Acesso negado.');
  end if;
  if p_tipo = 'ajuste' and not public.tem_papel(v_org, array['ADMIN', 'GESTOR']) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para ajuste.');
  end if;
  if p_tipo = 'transferencia' and not public.tem_papel(v_org, array['ADMIN', 'GESTOR', 'COMPRAS']) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para transferir.');
  end if;
  if p_tipo in ('entrada', 'saida', 'reserva', 'consumo', 'devolucao')
    and not public.tem_papel(v_org, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO']) then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para movimentar.');
  end if;

  if p_chamado is not null then
    perform 1 from public.chamados where id = p_chamado and organization_id = v_org;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Chamado vinculado não encontrado.');
    end if;
  end if;

  -- BLOCO 2: almoxarifados devem pertencer à mesma org (NULL = legado, aceito).
  if p_almoxarifado is not null then
    perform 1 from public.almoxarifados where id = p_almoxarifado and organization_id = v_org;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Almoxarifado não encontrado.');
    end if;
  end if;
  if p_almoxarifado_destino is not null then
    perform 1 from public.almoxarifados where id = p_almoxarifado_destino and organization_id = v_org;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Almoxarifado de destino não encontrado.');
    end if;
  end if;

  v_disp := v_fis - v_res;
  v_nf := v_fis;
  v_nr := v_res;

  if p_tipo = 'entrada' then
    v_nf := v_fis + p_qtd;
  elsif p_tipo = 'ajuste' then
    if p_qtd < v_res then
      return jsonb_build_object('ok', false, 'error', 'Ajuste abaixo da reserva. Devolva antes.');
    end if;
    v_nf := p_qtd;
  elsif p_tipo = 'saida' then
    if p_qtd > v_disp then
      return jsonb_build_object('ok', false, 'error', 'Disponível insuficiente.');
    end if;
    v_nf := v_fis - p_qtd;
  elsif p_tipo = 'reserva' then
    if p_qtd > v_disp then
      return jsonb_build_object('ok', false, 'error', 'Disponível insuficiente.');
    end if;
    v_nr := v_res + p_qtd;
  elsif p_tipo = 'consumo' then
    if p_qtd > v_fis then
      return jsonb_build_object('ok', false, 'error', 'Saldo físico insuficiente.');
    end if;
    v_nf := v_fis - p_qtd;
    v_nr := greatest(0, v_res - p_qtd);
  elsif p_tipo = 'devolucao' then
    v_nr := greatest(0, v_res - p_qtd);
  elsif p_tipo = 'transferencia' then
    if p_qtd > v_disp then
      return jsonb_build_object('ok', false, 'error', 'Disponível insuficiente para transferir.');
    end if;
    -- Par auditado: rede líquida zero, mesma transação (nunca A−3/B+0).
    -- Saída carrega o almox de origem; entrada, o de destino.
    insert into public.movimentacoes_estoque
      (organization_id, produto_id, tipo, quantidade, custo_unitario, origem, destino, observacao, executado_por, almoxarifado_id)
    values
      (v_org, p_produto, 'saida', p_qtd, coalesce(p_custo, 0), p_origem, p_destino, p_obs, v_ator, p_almoxarifado),
      (v_org, p_produto, 'entrada', p_qtd, coalesce(p_custo, 0), p_origem, p_destino, p_obs, v_ator, coalesce(p_almoxarifado_destino, p_almoxarifado));
    return jsonb_build_object('ok', true, 'fisico', v_fis, 'reservado', v_res, 'codigo', v_codigo, 'minimo', v_min);
  end if;

  update public.produtos
    set estoque_atual = v_nf, estoque_reservado = v_nr
    where id = p_produto;

  insert into public.movimentacoes_estoque
    (organization_id, produto_id, tipo, quantidade, custo_unitario, chamado_id, origem, destino, observacao, executado_por, almoxarifado_id)
  values
    (v_org, p_produto, p_tipo, p_qtd, coalesce(p_custo, 0), p_chamado, p_origem, p_destino, p_obs, v_ator, p_almoxarifado);

  return jsonb_build_object('ok', true, 'fisico', v_nf, 'reservado', v_res, 'codigo', v_codigo, 'minimo', v_min);
end;
$$;

revoke all on function public.movimentar_estoque_atomic(uuid, text, numeric, numeric, uuid, text, text, text, text, uuid, uuid) from public;
grant execute on function public.movimentar_estoque_atomic(uuid, text, numeric, numeric, uuid, text, text, text, text, uuid, uuid) to authenticated;

comment on function public.movimentar_estoque_atomic(uuid, text, numeric, numeric, uuid, text, text, text, text, uuid, uuid) is
  'BLOCO 2: p_almoxarifado/p_almoxarifado_destino opcionais (default NULL). Saldo global em produtos.estoque_atual (Visão Unificada); almoxarifado_id segmenta (Visão Segmentada).';

-- ---------- 5. enforce_same_org (estende v23; corpo integral + 3 blocos) ----------
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
end
$$;
-- `trg_org_mov` (v4) já cobre `movimentacoes_estoque`: bloco novo pega carona.
