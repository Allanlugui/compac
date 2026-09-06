-- ============================================================
-- SGA-M · schema_v5.sql — gestão de acessos + impacto operacional
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schema.sql (v1), schema_v2.sql (v2), schema_v4.sql (v3)
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado. Backfill preserva tudo.
-- ============================================================

-- ---------- 1. memberships: setor + departamento (por vínculo) ----------
alter table public.memberships add column if not exists setor text;
alter table public.memberships add column if not exists departamento text;

-- Limites defensivos (80 chars, como setor em compras).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_setor_len') then
    alter table public.memberships add constraint memberships_setor_len
      check (setor is null or (char_length(setor) between 1 and 80));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'memberships_departamento_len') then
    alter table public.memberships add constraint memberships_departamento_len
      check (departamento is null or (char_length(departamento) between 1 and 80));
  end if;
end
$$;

comment on column public.memberships.setor is
  'Setor do membro NESTA organização (por vínculo, não global).';
comment on column public.memberships.departamento is
  'Departamento do membro NESTA organização (por vínculo, não global).';

-- ---------- 2. chamados: impacto operacional ----------
-- 5 níveis: baixo, medio, alto, critico, parada_total.
-- Nullable para não quebrar chamados existentes (sem backfill forçado).
alter table public.chamados add column if not exists impacto text
  check (impacto in ('baixo', 'medio', 'alto', 'critico', 'parada_total'));

create index if not exists chamados_impacto_idx on public.chamados (impacto);
create index if not exists chamados_org_impacto_idx
  on public.chamados (organization_id, impacto);

comment on column public.chamados.impacto is
  'Nível de impacto operacional da ocorrência (5 níveis).';
