-- ============================================================
-- SGA-M · FIX: auditoria_logs_acao_check (pós-migration)
-- ------------------------------------------------------------
-- Problema: v8/v10 não incluem OS_CREATED na lista do CHECK,
-- mas os dados existentes têm OS_CREATED (1 linha). O migration
-- falha ao tentar adicionar a constraint restritiva demais.
-- Solução: recria a constraint com TODOS os valores possíveis.
-- Deve ser executado ANTES de continuar as migrations v10→v15.
-- ============================================================

-- Verifica qual é a constraint atual
do $$
declare
  v_constraint_exists boolean;
  v_current_def text;
begin
  select exists(
    select 1 from pg_constraint where conname = 'auditoria_logs_acao_check'
  ) into v_constraint_exists;

  if v_constraint_exists then
    select pg_get_constraintdef(oid) into v_current_def
    from pg_constraint where conname = 'auditoria_logs_acao_check';
    raise notice 'Constraint atual: %', v_current_def;
  else
    raise notice 'Constraint auditoria_logs_acao_check NAO existe no banco.';
  end if;
end;
$$;

-- Reseta a constraint com a versão mais completa (v14 + extras)
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
    'LOGIN', 'LOGOUT', 'APPROVAL', 'REJECTION',
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

raise notice 'Constraint auditoria_logs_acao_check atualizada com sucesso.';
