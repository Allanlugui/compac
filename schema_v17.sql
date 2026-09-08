-- ============================================================
-- SGA-M · schema_v17.sql — HARDENING H4: Auditoria NULL
-- ------------------------------------------------------------
-- Auditoria com organization_id NULL: 14 registros (3 memberships, 11 sessao)
-- memberships: MEMBERSHIP_CHANGE com NULL (legado, recuperável via dados_novos)
-- sessao: LOGIN/LOGOUT com NULL (técnico, não vinculado a org, visível a todos via OR)
-- Solução: migrar memberships para ter organization_id, e endurecer policy para não expor NULL
-- PRÉ-REQUISITOS: schemas v1–v16 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente.
-- ============================================================

-- Migrar memberships logs com NULL para ter organization_id (recuperável)
update public.auditoria_logs
set organization_id = (dados_novos->>'organization_id')::uuid
where organization_id is null
  and tabela = 'memberships'
  and dados_novos ? 'organization_id'
  and (dados_novos->>'organization_id') ~ '^[0-9a-f-]{36}$';

-- Verificar quantos restam com NULL após migração
do $$
declare
  v_restantes int;
begin
  select count(*) into v_restantes from public.auditoria_logs where organization_id is null;
  raise notice 'Auditoria NULL restantes após migração: %', v_restantes;
  -- Não falha se ainda houver sessao com NULL (técnico, aceitável)
end
$$;

-- Endurecer policy: remover OR organization_id IS NULL, exigir eh_membro para todos
-- Sessao com NULL continuará visível apenas se for explicitamente permitido, mas por ora mantemos OR para sessao
-- Para não quebrar sessao (que é por user, não org), mantemos OR mas documentamos
-- Se quiser endurecer totalmente: drop e recreate sem OR
-- Por ora, mantemos OR mas com comentário de que sessao é exceção técnica
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='auditoria_logs' and policyname='audit_select') then
    drop policy "audit_select" on public.auditoria_logs;
  end if;
end
$$;

create policy "audit_select" on public.auditoria_logs
  for select to authenticated
  using (
    -- Registros normais: exige membership
    (organization_id is not null and public.eh_membro(organization_id))
    -- Exceção técnica: sessao com NULL (LOGIN/LOGOUT) visível a todos autenticados (não contém dados sensíveis de org)
    or (organization_id is null and tabela = 'sessao')
  );

-- Verificação
do $$
begin
  raise notice 'audit_select endurecida: exige eh_membro para organization_id not null, sessão NULL ainda visível';
end
$$;
