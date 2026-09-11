-- ============================================================
-- SGA-M · schema_v19.sql — FASE 9.2 Meu Perfil (bio + preferencias)
-- ------------------------------------------------------------
-- Adiciona bio e preferencias ao profiles para Meu Perfil.
-- NÃO aplicar em produção nesta fase (FASE 9.2 local apenas).
-- Idempotente.
-- ============================================================

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists preferencias jsonb default '{}'::jsonb;

comment on column public.profiles.bio is 'Bio profissional do usuário (Meu Perfil)';
comment on column public.profiles.preferencias is 'Preferências: {tema, idioma, notificacoes}';

-- Verificação:
-- select column_name from information_schema.columns where table_name='profiles' and column_name in ('bio','preferencias');
