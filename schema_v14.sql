-- ============================================================
-- SGA-M · schema_v14.sql — RPC: criar_os_a_partir_de_triagem
-- ------------------------------------------------------------
-- MOTIVO: corrigir inconsistência entre UX e máquina de estados
-- (FASE 4). O botão "Criar O.S." a partir de `aberto` precisa
-- passar por `em_triagem` antes de `convertido_os`. A UX não
-- pode exigir dois cliques nem permitir salto arbitrário
-- (aberto → convertido_os). Esta RPC executa o fluxo COMPOSTO
-- `aberto → em_triagem → convertido_os + O.S.` em uma única
-- transação atômica. Idempotente. Sem alteração em
-- TRANSICOES_CHAMADO.
-- PRÉ-REQUISITOS: schemas v1–v13 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Sem migração de dados.
-- ============================================================

-- ---------- 0. auditoria_logs: expandir CHECK para TRIAGEM / OS_CREATED ----------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'auditoria_logs_acao_check') then
    alter table public.auditoria_logs drop constraint auditoria_logs_acao_check;
  end if;
end
$$;
alter table public.auditoria_logs add constraint auditoria_logs_acao_check
  check (acao in (
    'INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE',
    'LOGIN', 'LOGOUT',
    'APPROVAL', 'REJECTION',
    'STOCK_ENTRY', 'STOCK_EXIT', 'STOCK_ADJUSTMENT',
    'STOCK_RESERVED', 'STOCK_RELEASED', 'STOCK_CONSUMED', 'STOCK_TRANSFERRED',
    'MEMBERSHIP_CHANGE', 'ROLE_CHANGE',
    'QR_REGENERATED',
    'TRIAGEM',
    'OS_CREATED', 'OS_CONCLUIDA',
    'CHECKLIST_CONCLUIDA',
    'FOTO_ADICIONADA',
    'COST_ADDED',
    'REQUEST_CREATED', 'REQUEST_APPROVED', 'REQUEST_REJECTED',
    'QUOTE_CREATED', 'ORDER_CREATED', 'ORDER_APPROVED',
    'RECEIPT_CREATED', 'RECEIPT_ACCEPTED', 'RECEIPT_REJECTED'
  ));

create or replace function public.criar_os_a_partir_de_triagem(
  p_chamado_id uuid,
  p_organization_id uuid,
  p_user_id uuid,
  p_executado_por text,
  p_prioridade text,
  p_impacto text,
  p_criticidade text,
  p_categoria text,
  p_subcategoria text,
  p_departamento text,
  p_responsavel text,
  p_equipe text,
  p_prazo date,
  p_os_tipo text,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_os_status text;
  v_anterior_status text;
  v_result jsonb;
begin
  -- Carrega estado atual com lock para evitar conversão concorrente.
  select status, os_status
    into v_status, v_os_status
    from public.chamados
   where id = p_chamado_id
     and organization_id = p_organization_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Chamado não encontrado.');
  end if;

  -- Idempotência: se já é O.S., não duplica. Suave para o cliente.
  if v_os_status is not null then
    return jsonb_build_object('ok', true, 'ja_convertido', true);
  end if;

  -- Estados de origem aceitos
  if v_status not in ('aberto', 'em_triagem', 'aguardando_informacao') then
    return jsonb_build_object(
      'ok', false,
      'message', 'Não é possível criar O.S. a partir de "' || v_status || '".'
    );
  end if;

  v_anterior_status := v_status;

  -- PASSO 1: aberto → em_triagem (apenas se estiver em "aberto")
  if v_status = 'aberto' then
    update public.chamados
       set status = 'em_triagem'
     where id = p_chamado_id
       and organization_id = p_organization_id;
    -- Auditoria da primeira transição
    insert into public.auditoria_logs
      (organization_id, tabela, registro_id, acao,
       dados_anteriores, dados_novos, executado_por, user_id)
    values
      (p_organization_id, 'chamados', p_chamado_id, 'STATUS_CHANGE',
       jsonb_build_object('status', v_anterior_status),
       jsonb_build_object('status', 'em_triagem'),
       p_executado_por, p_user_id);
    v_status := 'em_triagem';
  end if;

  -- PASSO 2: aplica classificação + decisão final
  update public.chamados
     set status           = 'convertido_os',
         os_status        = 'aberta',
         os_tipo          = p_os_tipo,
         prioridade       = p_prioridade,
         impacto          = p_impacto,
         criticidade      = p_criticidade,
         categoria        = p_categoria,
         subcategoria     = p_subcategoria,
         departamento     = p_departamento,
         responsavel      = p_responsavel,
         equipe           = p_equipe,
         prazo            = p_prazo
   where id = p_chamado_id
     and organization_id = p_organization_id;

  -- Auditoria: triagem (classificação)
  insert into public.auditoria_logs
    (organization_id, tabela, registro_id, acao,
     dados_anteriores, dados_novos, executado_por, user_id)
  values
    (p_organization_id, 'chamados', p_chamado_id, 'TRIAGEM',
     jsonb_build_object('status', v_anterior_status),
     jsonb_build_object(
       'status', 'convertido_os',
       'prioridade', p_prioridade,
       'impacto', p_impacto,
       'criticidade', p_criticidade,
       'categoria', p_categoria,
       'subcategoria', p_subcategoria,
       'departamento', p_departamento,
       'responsavel', p_responsavel,
       'equipe', p_equipe,
       'prazo', p_prazo,
       'os_tipo', p_os_tipo,
       'motivo', p_motivo
     ),
     p_executado_por, p_user_id);

  -- Auditoria: OS_CREATED
  insert into public.auditoria_logs
    (organization_id, tabela, registro_id, acao,
     dados_anteriores, dados_novos, executado_por, user_id)
  values
    (p_organization_id, 'chamados', p_chamado_id, 'OS_CREATED',
     jsonb_build_object('os_status', null),
     jsonb_build_object('os_status', 'aberta', 'os_tipo', p_os_tipo),
     p_executado_por, p_user_id);

  return jsonb_build_object('ok', true, 'ja_convertido', false);
end;
$$;

revoke all on function public.criar_os_a_partir_de_triagem(
  uuid, uuid, uuid, text,
  text, text, text, text, text, text, text, text, date, text, text
) from public;

grant execute on function public.criar_os_a_partir_de_triagem(
  uuid, uuid, uuid, text,
  text, text, text, text, text, text, text, text, date, text, text
) to authenticated, service_role;
