-- ============================================================
-- SGA-M · schema_v12.sql — GATE FASE 4: atomicidade do estoque
-- RPC transacional (lock de linha) p/ concorrência + transferência par
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schemas v1–v11 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- Leitura + validação + escrita + movimento(s) numa ÚNICA transação.
-- Duas operações simultâneas no mesmo produto se serializam no
-- SELECT ... FOR UPDATE: A→4 ok, B→4 negado com disponível 1.
-- Tenant e papel validados DENTRO da função (SECURITY DEFINER não
-- passa pelo RLS): membership obrigatória; papéis por tipo.
create or replace function public.movimentar_estoque_atomic(
  p_produto uuid,
  p_tipo text,
  p_qtd numeric,
  p_custo numeric,
  p_chamado uuid,
  p_obs text,
  p_origem text,
  p_destino text,
  p_executado_por text
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
begin
  if p_tipo not in ('entrada', 'saida', 'ajuste', 'reserva', 'consumo', 'devolucao', 'transferencia') then
    return jsonb_build_object('ok', false, 'error', 'Tipo inválido.');
  end if;
  if p_qtd is null or p_qtd <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Quantidade deve ser maior que zero.');
  end if;

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
    insert into public.movimentacoes_estoque
      (organization_id, produto_id, tipo, quantidade, custo_unitario, origem, destino, observacao, executado_por)
    values
      (v_org, p_produto, 'saida', p_qtd, coalesce(p_custo, 0), p_origem, p_destino, p_obs, p_executado_por),
      (v_org, p_produto, 'entrada', p_qtd, coalesce(p_custo, 0), p_origem, p_destino, p_obs, p_executado_por);
    return jsonb_build_object('ok', true, 'fisico', v_fis, 'reservado', v_res, 'codigo', v_codigo, 'minimo', v_min);
  end if;

  update public.produtos
    set estoque_atual = v_nf, estoque_reservado = v_nr
    where id = p_produto;

  insert into public.movimentacoes_estoque
    (organization_id, produto_id, tipo, quantidade, custo_unitario, chamado_id, origem, destino, observacao, executado_por)
  values
    (v_org, p_produto, p_tipo, p_qtd, coalesce(p_custo, 0), p_chamado, p_origem, p_destino, p_obs, p_executado_por);

  return jsonb_build_object('ok', true, 'fisico', v_nf, 'reservado', v_nr, 'codigo', v_codigo, 'minimo', v_min);
end;
$$;

revoke all on function public.movimentar_estoque_atomic(uuid, text, numeric, numeric, uuid, text, text, text, text) from public;
grant execute on function public.movimentar_estoque_atomic(uuid, text, numeric, numeric, uuid, text, text, text, text) to authenticated;

comment on function public.movimentar_estoque_atomic(uuid, text, numeric, numeric, uuid, text, text, text, text) is
  'Movimentação atômica com lock de linha (concorrência) + tenant/papel internos.';
