-- ============================================================
-- SGA-M · schema_v6.sql — FASE 1: fundação de dados
-- Estrutura organizacional + categorias + perfis + permissões
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schemas v1–v5 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- ---------- 1. localidades (hierarquia flexível) ----------
-- Um nível por linha; parent define a árvore. Org pequena usa só
-- `unidade`; org grande usa unidade→predio→bloco→andar→area→sala.
create table if not exists public.localidades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  tipo text not null check (tipo in ('unidade', 'predio', 'bloco', 'andar', 'area', 'sala')),
  parent_id uuid references public.localidades (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, parent_id, nome)
);

create index if not exists localidades_org_idx on public.localidades (organization_id);
create index if not exists localidades_parent_idx on public.localidades (parent_id);

-- Raízes (parent NULL) não são cobertas pela UNIQUE acima (NULL ≠ NULL):
-- garante nome único por org no nível raiz.
create unique index if not exists localidades_root_uniq
  on public.localidades (organization_id, nome) where parent_id is null;

comment on table public.localidades is
  'Hierarquia física da org (unidade→predio→bloco→andar→area→sala). Níveis opcionais.';

-- ---------- 2. categorias (ativos e produtos) ----------
-- `atributos` define os dados técnicos por categoria (JSONB):
-- [{nome, tipo: texto|numero|selecao|data, obrigatorio, unidade, opcoes[]}]
-- Evita centenas de colunas fixas (§5 do plano).
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  tipo text not null check (tipo in ('ativo', 'produto')),
  atributos jsonb not null default '[]',
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, tipo, nome)
);

create index if not exists categorias_org_idx on public.categorias (organization_id);

comment on column public.categorias.atributos is
  'Schema dos dados técnicos: [{nome, tipo, obrigatorio, unidade, opcoes}].';

-- ---------- 3. profiles: telefone, cargo, matrícula, avatar, acesso ----------
alter table public.profiles add column if not exists telefone text;
alter table public.profiles add column if not exists cargo text;
alter table public.profiles add column if not exists matricula text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists ultimo_acesso timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_contato_len') then
    alter table public.profiles add constraint profiles_contato_len
      check (
        (telefone is null or char_length(telefone) <= 30)
        and (cargo is null or char_length(cargo) <= 80)
        and (matricula is null or char_length(matricula) <= 40)
      );
  end if;
end
$$;

-- ---------- 4. FKs preparatórias (FASE 2 consome; nada quebra) ----------
alter table public.ativos add column if not exists localidade_id uuid
  references public.localidades (id) on delete set null;
alter table public.ativos add column if not exists categoria_id uuid
  references public.categorias (id) on delete set null;
alter table public.produtos add column if not exists categoria_id uuid
  references public.categorias (id) on delete set null;

create index if not exists ativos_localidade_idx on public.ativos (localidade_id);
create index if not exists ativos_categoria_idx on public.ativos (categoria_id);

-- ---------- 5. RLS (padrão: leitura membros; escrita ADMIN/GESTOR) ----------
alter table public.localidades enable row level security;
alter table public.categorias enable row level security;

grant select, insert, update, delete on public.localidades to authenticated;
grant select, insert, update, delete on public.categorias to authenticated;

drop policy if exists "loc_select" on public.localidades;
create policy "loc_select" on public.localidades
  for select to authenticated
  using (public.eh_membro(public.localidades.organization_id));
drop policy if exists "loc_write" on public.localidades;
create policy "loc_write" on public.localidades
  for all to authenticated
  using (
    public.eh_membro(public.localidades.organization_id)
    and public.tem_papel(public.localidades.organization_id, array['ADMIN', 'GESTOR'])
  )
  with check (
    public.eh_membro(public.localidades.organization_id)
    and public.tem_papel(public.localidades.organization_id, array['ADMIN', 'GESTOR'])
  );

drop policy if exists "cat_select" on public.categorias;
create policy "cat_select" on public.categorias
  for select to authenticated
  using (public.eh_membro(public.categorias.organization_id));
drop policy if exists "cat_write" on public.categorias;
create policy "cat_write" on public.categorias
  for all to authenticated
  using (
    public.eh_membro(public.categorias.organization_id)
    and public.tem_papel(public.categorias.organization_id, array['ADMIN', 'GESTOR'])
  )
  with check (
    public.eh_membro(public.categorias.organization_id)
    and public.tem_papel(public.categorias.organization_id, array['ADMIN', 'GESTOR'])
  );
