-- ============================================================
-- SGA-M · schema_v27.sql — BLOCO 3: universal + ticket sem ativo
-- ------------------------------------------------------------
-- 1. Orgs criadas após a v4 nascem com entry_token NULL (a v4 só fez
--    backfill). Sem token não há link universal de atendimento.
--    Garante default para novas linhas + preenche as nulas.
-- 2. `chamados.ativo_id` passa a NULLABLE: atendimento universal (sem
--    ativo identificado) precisa criar ticket. Trigger enforce_same_org
--    já tolera NULL (`is not null`); RLS inalterada; histórico preservado.
-- PRÉ-REQUISITOS: schemas v1–v26 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado. NÃO APLICADA (aguarda validação).
-- ============================================================

alter table public.organizations
  alter column entry_token set default encode(gen_random_bytes(18), 'hex');

update public.organizations
  set entry_token = encode(gen_random_bytes(18), 'hex')
  where entry_token is null;

alter table public.chamados
  alter column ativo_id drop not null;
