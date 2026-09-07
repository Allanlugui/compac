-- ============================================================
-- SGA-M · schema_v15.sql — RPC: exec_as_user (testes de RLS)
-- ------------------------------------------------------------
-- MOTIVO: testes de isolamento multi-tenant precisam simular
-- conexão autenticada por um user_id específico. Esta RPC
-- injeta o JWT claim via set_config no nível da sessão para
-- que auth.uid() e RLS funcionem corretamente durante os
-- testes automatizados.
--
-- ⚠️  ATENÇÃO — EXCLUSIVO PARA INFRAESTRUTURA DE TESTE.
-- Esta função é executada apenas pela service_role (chave
-- service_role do Supabase). NUNCA deve ser chamada por
-- anon ou authenticated — sua exposição permitiria escalonamento
-- de privilégio (escolha arbitrária de user_id).
--
-- SEGURANÇA:
--   - SECURITY DEFINER: executa como owner da função
--   - search_path = public: evita hijacking via search_path
--   - Revogação EXPLÍCITA de public, anon e authenticated
--   - Grant SOMENTE para service_role
--   - Não usar em código de produção / Server Actions
--
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
  when insufficient_privilege then
    raise;
  when others then
    raise;
end;
$$;

alter function public.exec_as_user(uuid, text) owner to postgres;

revoke all on function public.exec_as_user(uuid, text) from public;
revoke all on function public.exec_as_user(uuid, text) from anon;
revoke all on function public.exec_as_user(uuid, text) from authenticated;
grant execute on function public.exec_as_user(uuid, text) to service_role;

-- Validação automática: aborta a migration se a configuração de grants
-- não estiver exatamente como esperado. Protege contra edições acidentais.
do $$
declare
  v_bad_grants int;
begin
  select count(*) into v_bad_grants
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'exec_as_user'
    and grantee in ('public', 'anon', 'authenticated')
    and privilege_type = 'EXECUTE';
  if v_bad_grants > 0 then
    raise exception 'exec_as_user tem grants não permitidos (%). Esperado: apenas service_role.', v_bad_grants;
  end if;
end
$$;

comment on function public.exec_as_user(uuid, text) is
  'INFRAESTRUTURA DE TESTE. SECURITY DEFINER, restrita a service_role. Não expor em código de produção.';
