-- ============================================================
-- SGA-M · schema_v15.sql — RPC: exec_as_user (testes de RLS)
-- ------------------------------------------------------------
-- MOTIVO: testes de isolamento multi-tenant precisam simular
-- conexão autenticada por um user_id específico. Esta RPC
-- injeta o JWT claim via set_config no nível da sessão para
-- que auth.uid() e RLS funcionem corretamente durante os
-- testes automatizados.
--
-- SEGURANÇA: security definer + restricted a service_role.
-- Só pode ser chamada pela service_key (não por anon/authenticated).
-- Em produção, esta função não deve ser usada fora dos testes.
-- PRÉ-REQUISITOS: schemas v1–v14 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente.
-- ============================================================

create or replace function public.exec_as_user(
  p_user_id uuid,
  p_sql text
) returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('role', 'authenticated', true);
  return query execute p_sql;
exception
  when others then
    return query select jsonb_build_object('error', sqlerrm) as r;
end;
$$;

revoke all on function public.exec_as_user(uuid, text) from public;
grant execute on function public.exec_as_user(uuid, text) to service_role;
