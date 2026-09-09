-- ============================================================
-- SGA-M · hardening_storage_audit.sql — Storage privado + auditoria
-- ------------------------------------------------------------
-- OBJETIVO:
-- 1) Bucket manutencao-midia PRIVATE (public=false)
-- 2) Remover policies públicas sga_midia_* (anon+authenticated permissive)
-- 3) Garantir apenas midia_org_* + midia_legado_leitura (authenticated + tenant)
-- COMO APLICAR: Supabase Dashboard > SQL Editor > New query > colar tudo > Run
-- Idempotente.
-- ============================================================

-- ---------- 1. Bucket privado ----------
-- Via SQL (alternativa ao storage.updateBucket via JS):
update storage.buckets set public = false where id = 'manutencao-midia';

-- Verificação:
-- select id, public from storage.buckets where id='manutencao-midia';
-- esperado: public = false

-- ---------- 2. Remover policies públicas ----------
drop policy if exists "sga_midia_leitura_publica" on storage.objects;
drop policy if exists "sga_midia_upload_publico" on storage.objects;
drop policy if exists "sga_midia_atualizacao_publica" on storage.objects;
drop policy if exists "sga_midia_exclusao_publica" on storage.objects;

-- Verificação:
-- select policyname, cmd, roles from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
-- esperado: apenas midia_legado_leitura, midia_org_leitura, midia_org_escrita (3 policies, todas authenticated)

-- ---------- 3. Auditoria — verificar NULL ----------
-- select tabela, acao, count(*) from auditoria_logs where organization_id is null group by tabela, acao;
-- esperado: apenas tabela='sessao' (LOGIN/LOGOUT) com 11 linhas, e 1 memberships NULL anômalo (não exposto via RLS)

-- Policy audit_select já correta:
-- ((organization_id IS NOT NULL AND eh_membro(organization_id)) OR (organization_id IS NULL AND tabela='sessao'))
-- Verificação:
-- select policyname, qual from pg_policies where tablename='auditoria_logs';

-- ---------- 4. Teste cross-tenant storage (manual) ----------
-- Tenant A: o/<orgA>/foto.jpg
-- Tenant B tenta SELECT o/<orgA>/foto.jpg via JWT de B -> deve retornar 0 rows (RLS midia_org_leitura)
-- Teste via JS: s.from('storage.objects').select().eq('name','o/<orgA>/...') com JWT de B

-- ---------- 5. Signed URL ----------
-- src/lib/storage.ts resolverFoto usa svc.storage.createSignedUrl(path, 3600) -> 1h expiração
-- Verificar: SELECT * FROM storage.objects WHERE name='o/<org>/...' deve ter owner via service_role
