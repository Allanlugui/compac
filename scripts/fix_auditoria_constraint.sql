-- ============================================================
-- SGA-M · fix_auditoria_constraint.sql
-- ------------------------------------------------------------
-- ESTADO ATUAL DO BANCO (após v8-v11 parciais):
--   - v8 dropou a constraint
--   - v10 e v11 falharam ao recriar (dados legados com OS_CREATED)
--
-- ESTE SCRIPT:
--   1. Recria a constraint com a lista UNIFICADA (v14) — compatível
--      com todos os valores que existem ou podem vir a existir.
--   2. Depois disso, as migrations v8-v15 podem ser re-aplicadas
--      com segurança.
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

do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint where conname = 'auditoria_logs_acao_check';
  raise notice 'Constraint ativa: %', v_def;
end;
$$;
