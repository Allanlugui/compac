-- ============================================================
-- SGA-M v3 · schema_v4.sql — correção arquitetural multi-tenant
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS:
--   1. schema.sql (v1) e schema_v2.sql (v2) já aplicados.
--   2. Supabase Auth com provedor Email habilitado.
--   3. NENHUM dado é apagado por este script. Backfill preserva tudo
--      na organização "Operação Principal".
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Re-executável (idempotente). Seções marcadas [DESTRUTIVO-LEVE]
-- apenas DERRUBAM policies permissivas antigas (nunca dados).
-- ============================================================

-- ---------- 0. Ordem de execução ----------
-- A org padrão é semeada na seção 4 (após a criação das tabelas).

-- ---------- 1. TABELAS: organizations / profiles / memberships ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- profiles: identidade mínima. SEM org_id, SEM role (vínculo via memberships).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'SOLICITANTE'
    check (role in ('ADMIN', 'GESTOR', 'TECNICO', 'COMPRAS', 'AUDITOR', 'SOLICITANTE')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_org_idx on public.memberships (organization_id);

comment on table public.memberships is
  'Vínculo usuário↔organização. Role pertence à MEMBERSHIP, nunca global.';

-- Semente da org padrão (ANTES de qualquer backfill que a referencie).
insert into public.organizations (nome, slug)
values ('Operação Principal', 'operacao-principal')
on conflict (slug) do nothing;

-- Token público de entrada (QR de compras): resolve a org SEM listar tenants.
-- 36 hex chars = 144 bits. Gerado no servidor, nunca pelo cliente.
alter table public.organizations add column if not exists entry_token text unique;
update public.organizations
  set entry_token = encode(gen_random_bytes(18), 'hex')
  where entry_token is null;

-- ---------- 2. organization_id nas tabelas de domínio ----------
-- (ADD COLUMN IF EXISTS é nativo e seguro)
alter table public.ativos add column if not exists organization_id uuid;
alter table public.chamados add column if not exists organization_id uuid;
alter table public.compras add column if not exists organization_id uuid;
alter table public.solicitacoes_compra add column if not exists organization_id uuid;
alter table public.auditoria_logs add column if not exists organization_id uuid;
alter table public.auditoria_logs add column if not exists user_id uuid;

-- Estende as ações auditáveis (v2 permitia só INSERT/UPDATE/DELETE).
-- Idempotente: derruba o CHECK original antes de recriar.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'auditoria_logs_acao_check') then
    alter table public.auditoria_logs drop constraint auditoria_logs_acao_check;
  end if;
end
$$;
alter table public.auditoria_logs add constraint auditoria_logs_acao_check
  check (acao in ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN',
    'LOGOUT', 'APPROVAL', 'REJECTION', 'STOCK_ENTRY', 'STOCK_EXIT',
    'STOCK_ADJUSTMENT', 'MEMBERSHIP_CHANGE', 'ROLE_CHANGE'));

-- Campos da O.S. completa (Fase núcleo): responsável, prioridade, prazo,
-- diagnóstico, solução e horímetro.
alter table public.chamados add column if not exists responsavel text;
alter table public.chamados add column if not exists prioridade text
  check (prioridade in ('baixa', 'media', 'alta', 'critica'));
alter table public.chamados add column if not exists prazo date;
alter table public.chamados add column if not exists diagnostico text;
alter table public.chamados add column if not exists solucao text;
alter table public.chamados add column if not exists horimetro numeric;

-- ---------- 3. Tabelas do núcleo (estoque, fornecedores, checklists, notificações) ----------
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  cnpj text,
  contato text,
  telefone text,
  email text,
  endereco text,
  categoria text,
  avaliacao numeric check (avaliacao is null or (avaliacao >= 0 and avaliacao <= 5)),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists fornecedores_org_idx on public.fornecedores (organization_id);

alter table public.compras add column if not exists fornecedor_id uuid;

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  codigo text not null,
  descricao text not null,
  categoria text,
  unidade text not null default 'un',
  estoque_atual numeric not null default 0,
  estoque_minimo numeric not null default 0,
  estoque_maximo numeric,
  localizacao text,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  custo_medio numeric not null default 0 check (custo_medio >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index if not exists produtos_org_idx on public.produtos (organization_id);

create table if not exists public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste', 'reserva', 'consumo')),
  quantidade numeric not null check (quantidade > 0),
  custo_unitario numeric not null default 0 check (custo_unitario >= 0),
  chamado_id uuid references public.chamados (id) on delete set null,
  compra_id uuid references public.compras (id) on delete set null,
  observacao text,
  executado_por text not null default 'sistema',
  created_at timestamptz not null default now()
);
create index if not exists mov_produto_idx on public.movimentacoes_estoque (produto_id);
create index if not exists mov_org_data_idx on public.movimentacoes_estoque (organization_id, created_at desc);

create table if not exists public.checklist_modelos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ativo_id uuid references public.ativos (id) on delete cascade,
  titulo text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_itens (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.checklist_modelos (id) on delete cascade,
  texto text not null,
  obrigatorio boolean not null default true,
  ordem integer not null default 0
);

create table if not exists public.checklist_execucoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  modelo_id uuid not null references public.checklist_modelos (id) on delete restrict,
  chamado_id uuid references public.chamados (id) on delete set null,
  ativo_id uuid references public.ativos (id) on delete set null,
  executado_por text not null default 'sistema',
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_respostas (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.checklist_execucoes (id) on delete cascade,
  item_id uuid not null references public.checklist_itens (id) on delete restrict,
  ok boolean,
  observacao text,
  foto_url text
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descricao text,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on public.notificacoes (user_id, lida, created_at desc);
create index if not exists notif_org_idx on public.notificacoes (organization_id, created_at desc);

-- ---------- 4. BACKFILL (preserva 100% dos dados) ----------
update public.ativos set organization_id =
  (select id from public.organizations where slug = 'operacao-principal')
  where organization_id is null;

update public.chamados set organization_id =
  (select id from public.organizations where slug = 'operacao-principal')
  where organization_id is null;

update public.compras set organization_id =
  (select id from public.organizations where slug = 'operacao-principal')
  where organization_id is null;

update public.solicitacoes_compra set organization_id =
  (select id from public.organizations where slug = 'operacao-principal')
  where organization_id is null;

update public.auditoria_logs set organization_id =
  (select id from public.organizations where slug = 'operacao-principal')
  where organization_id is null;

-- Trava de segurança: aborta se restar órfão (nunca chega ao NOT NULL sujo).
do $$
declare
  v_orfaos integer;
begin
  select count(*) into v_orfaos from public.ativos where organization_id is null;
  select count(*) + v_orfaos into v_orfaos from public.chamados where organization_id is null;
  select count(*) + v_orfaos into v_orfaos from public.compras where organization_id is null;
  select count(*) + v_orfaos into v_orfaos from public.solicitacoes_compra where organization_id is null;
  if v_orfaos > 0 then
    raise exception 'Backfill incompleto: % registros sem organization_id', v_orfaos;
  end if;
end
$$;

alter table public.ativos alter column organization_id set not null;
alter table public.chamados alter column organization_id set not null;
alter table public.compras alter column organization_id set not null;
alter table public.solicitacoes_compra alter column organization_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ativos_org_fk') then
    alter table public.ativos add constraint ativos_org_fk
      foreign key (organization_id) references public.organizations (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chamados_org_fk') then
    alter table public.chamados add constraint chamados_org_fk
      foreign key (organization_id) references public.organizations (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compras_org_fk') then
    alter table public.compras add constraint compras_org_fk
      foreign key (organization_id) references public.organizations (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solic_org_fk') then
    alter table public.solicitacoes_compra add constraint solic_org_fk
      foreign key (organization_id) references public.organizations (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compras_fornecedor_fk') then
    alter table public.compras add constraint compras_fornecedor_fk
      foreign key (fornecedor_id) references public.fornecedores (id) on delete set null;
  end if;
end
$$;

create index if not exists ativos_org_idx on public.ativos (organization_id);
create index if not exists chamados_org_idx on public.chamados (organization_id);
create index if not exists compras_org_idx on public.compras (organization_id);
create index if not exists solic_org_idx on public.solicitacoes_compra (organization_id);
create index if not exists auditoria_org_idx on public.auditoria_logs (organization_id);

-- ---------- 5. Integridade cross-tenant (nível banco) ----------
-- Impede O.S. de A + ativo de B, compra×fornecedor e movimento×produto
-- de orgs distintas, mesmo com IDs válidos.
create or replace function public.enforce_same_org()
returns trigger as $$
declare
  v_org uuid;
begin
  if TG_TABLE_NAME = 'chamados' and new.ativo_id is not null then
    select organization_id into v_org from public.ativos where id = new.ativo_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: ativo de outra organização';
    end if;
  elsif TG_TABLE_NAME = 'compras' and new.chamado_id is not null then
    select organization_id into v_org from public.chamados where id = new.chamado_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: chamado de outra organização';
    end if;
  elsif TG_TABLE_NAME = 'compras' and new.fornecedor_id is not null then
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  elsif TG_TABLE_NAME = 'movimentacoes_estoque' then
    select organization_id into v_org from public.produtos where id = new.produto_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: produto de outra organização';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_org_chamados on public.chamados;
create trigger trg_org_chamados before insert or update on public.chamados
  for each row execute function public.enforce_same_org();

drop trigger if exists trg_org_compras on public.compras;
create trigger trg_org_compras before insert or update on public.compras
  for each row execute function public.enforce_same_org();

drop trigger if exists trg_org_mov on public.movimentacoes_estoque;
create trigger trg_org_mov before insert or update on public.movimentacoes_estoque
  for each row execute function public.enforce_same_org();

-- ---------- 6. Helpers de tenancy p/ RLS (SECURITY DEFINER, search_path fixo) ----------
create or replace function public.eh_membro(p_org uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'ativo'
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.tem_papel(p_org uuid, papeis text[])
returns boolean as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'ativo'
      and m.role = any (papeis)
  );
$$ language sql stable security definer set search_path = public;

-- ---------- 7. [DESTRUTIVO-LEVE] Derruba policies permissivas v1/v2 ----------
drop policy if exists "sga_acesso_total_ativos" on public.ativos;
drop policy if exists "sga_acesso_total_chamados" on public.chamados;
drop policy if exists "sga_acesso_total_compras" on public.compras;
drop policy if exists "sga_acesso_solicitacoes_compra" on public.solicitacoes_compra;
drop policy if exists "sga_acesso_auditoria_logs" on public.auditoria_logs;
drop policy if exists "sga_midia_leitura_publica" on storage.objects;
drop policy if exists "sga_midia_upload_publico" on storage.objects;
drop policy if exists "sga_midia_atualizacao_publica" on storage.objects;
drop policy if exists "sga_midia_exclusao_publica" on storage.objects;

-- ---------- 8. RLS real (aliases via nome qualificado, sem ambiguidade) ----------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.fornecedores enable row level security;
alter table public.produtos enable row level security;
alter table public.movimentacoes_estoque enable row level security;
alter table public.checklist_modelos enable row level security;
alter table public.checklist_itens enable row level security;
alter table public.checklist_execucoes enable row level security;
alter table public.checklist_respostas enable row level security;
alter table public.notificacoes enable row level security;

grant select on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.fornecedores to authenticated;
grant select, insert, update, delete on public.produtos to authenticated;
grant select, insert, update, delete on public.movimentacoes_estoque to authenticated;
grant select, insert, update, delete on public.checklist_modelos to authenticated;
grant select, insert, update, delete on public.checklist_itens to authenticated;
grant select, insert, update, delete on public.checklist_execucoes to authenticated;
grant select, insert, update, delete on public.checklist_respostas to authenticated;
grant select, insert, update, delete on public.notificacoes to authenticated;
grant select, insert on public.auditoria_logs to authenticated;
-- anon: APENAS inserts públicos (QR). Leitura operacional exige login.
grant insert on public.chamados to anon;
grant insert on public.solicitacoes_compra to anon;

-- organizations: visível se membro.
drop policy if exists "org_select_membro" on public.organizations;
create policy "org_select_membro" on public.organizations
  for select to authenticated
  using (public.eh_membro(public.organizations.id));

-- profiles: próprio + membros da mesma org (para exibir autores).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    public.profiles.id = auth.uid()
    or exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m1.organization_id = m2.organization_id
      where m1.user_id = auth.uid() and m1.status = 'ativo'
        and m2.user_id = public.profiles.id and m2.status = 'ativo'
    )
  );
drop policy if exists "profiles_update_proprio" on public.profiles;
create policy "profiles_update_proprio" on public.profiles
  for update to authenticated
  using (public.profiles.id = auth.uid())
  with check (public.profiles.id = auth.uid());

-- memberships: leitura se membro da mesma org; escrita só ADMIN/GESTOR.
drop policy if exists "memb_select" on public.memberships;
create policy "memb_select" on public.memberships
  for select to authenticated
  using (
    public.memberships.user_id = auth.uid()
    or public.eh_membro(public.memberships.organization_id)
  );
drop policy if exists "memb_write_admin" on public.memberships;
create policy "memb_write_admin" on public.memberships
  for all to authenticated
  using (public.tem_papel(public.memberships.organization_id, array['ADMIN', 'GESTOR']))
  with check (public.tem_papel(public.memberships.organization_id, array['ADMIN', 'GESTOR']));

-- ATIVOS: leitura membros; escrita ADMIN/GESTOR/TECNICO.
drop policy if exists "ativos_select" on public.ativos;
create policy "ativos_select" on public.ativos
  for select to authenticated
  using (public.eh_membro(public.ativos.organization_id));
drop policy if exists "ativos_write" on public.ativos;
create policy "ativos_write" on public.ativos
  for all to authenticated
  using (
    public.eh_membro(public.ativos.organization_id)
    and public.tem_papel(public.ativos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.ativos.organization_id)
    and public.tem_papel(public.ativos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

-- CHAMADOS: leitura membros; insert público (QR) + membros; update membros
-- operacionais; delete ADMIN/GESTOR.
drop policy if exists "chamados_select" on public.chamados;
create policy "chamados_select" on public.chamados
  for select to authenticated
  using (public.eh_membro(public.chamados.organization_id));
drop policy if exists "chamados_insert_publico" on public.chamados;
create policy "chamados_insert_publico" on public.chamados
  for insert to anon
  with check (
    exists (
      select 1 from public.ativos a
      where a.id = public.chamados.ativo_id
    )
  );
drop policy if exists "chamados_insert_membro" on public.chamados;
create policy "chamados_insert_membro" on public.chamados
  for insert to authenticated
  with check (public.eh_membro(public.chamados.organization_id));
drop policy if exists "chamados_update" on public.chamados;
create policy "chamados_update" on public.chamados
  for update to authenticated
  using (
    public.eh_membro(public.chamados.organization_id)
    and public.tem_papel(public.chamados.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.chamados.organization_id)
    and public.tem_papel(public.chamados.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );
drop policy if exists "chamados_delete" on public.chamados;
create policy "chamados_delete" on public.chamados
  for delete to authenticated
  using (
    public.eh_membro(public.chamados.organization_id)
    and public.tem_papel(public.chamados.organization_id, array['ADMIN', 'GESTOR'])
  );

-- COMPRAS: leitura membros; escrita ADMIN/GESTOR/COMPRAS (TECNICO lê).
drop policy if exists "compras_select" on public.compras;
create policy "compras_select" on public.compras
  for select to authenticated
  using (public.eh_membro(public.compras.organization_id));
drop policy if exists "compras_write" on public.compras;
create policy "compras_write" on public.compras
  for all to authenticated
  using (
    public.eh_membro(public.compras.organization_id)
    and public.tem_papel(public.compras.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  )
  with check (
    public.eh_membro(public.compras.organization_id)
    and public.tem_papel(public.compras.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  );

-- SOLICITAÇÕES: leitura membros; insert público; update ADMIN/GESTOR/COMPRAS.
drop policy if exists "solic_select" on public.solicitacoes_compra;
create policy "solic_select" on public.solicitacoes_compra
  for select to authenticated
  using (public.eh_membro(public.solicitacoes_compra.organization_id));
drop policy if exists "solic_insert_publico" on public.solicitacoes_compra;
create policy "solic_insert_publico" on public.solicitacoes_compra
  for insert to anon with check (true);
drop policy if exists "solic_update" on public.solicitacoes_compra;
create policy "solic_update" on public.solicitacoes_compra
  for update to authenticated
  using (
    public.eh_membro(public.solicitacoes_compra.organization_id)
    and public.tem_papel(public.solicitacoes_compra.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  )
  with check (
    public.eh_membro(public.solicitacoes_compra.organization_id)
    and public.tem_papel(public.solicitacoes_compra.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  );

-- AUDITORIA: leitura membros (AUDITOR é só-leitura por papel na app);
-- insert membros (trilha best-effort).
drop policy if exists "audit_select" on public.auditoria_logs;
create policy "audit_select" on public.auditoria_logs
  for select to authenticated
  using (
    public.auditoria_logs.organization_id is null
    or public.eh_membro(public.auditoria_logs.organization_id)
  );
drop policy if exists "audit_insert" on public.auditoria_logs;
create policy "audit_insert" on public.auditoria_logs
  for insert to authenticated with check (true);

-- Genérico p/ tabelas novas: leitura membros; escrita por papel.
-- fornecedores / produtos: ADMIN/GESTOR/COMPRAS
drop policy if exists "forn_select" on public.fornecedores;
create policy "forn_select" on public.fornecedores
  for select to authenticated
  using (public.eh_membro(public.fornecedores.organization_id));
drop policy if exists "forn_write" on public.fornecedores;
create policy "forn_write" on public.fornecedores
  for all to authenticated
  using (
    public.eh_membro(public.fornecedores.organization_id)
    and public.tem_papel(public.fornecedores.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  )
  with check (
    public.eh_membro(public.fornecedores.organization_id)
    and public.tem_papel(public.fornecedores.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  );

drop policy if exists "prod_select" on public.produtos;
create policy "prod_select" on public.produtos
  for select to authenticated
  using (public.eh_membro(public.produtos.organization_id));
drop policy if exists "prod_write" on public.produtos;
create policy "prod_write" on public.produtos
  for all to authenticated
  using (
    public.eh_membro(public.produtos.organization_id)
    and public.tem_papel(public.produtos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.produtos.organization_id)
    and public.tem_papel(public.produtos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO'])
  );

-- movimentações: quem movimenta (TECNICO consome, COMPRAS dá entrada).
drop policy if exists "mov_select" on public.movimentacoes_estoque;
create policy "mov_select" on public.movimentacoes_estoque
  for select to authenticated
  using (public.eh_membro(public.movimentacoes_estoque.organization_id));
drop policy if exists "mov_write" on public.movimentacoes_estoque;
create policy "mov_write" on public.movimentacoes_estoque
  for all to authenticated
  using (
    public.eh_membro(public.movimentacoes_estoque.organization_id)
    and public.tem_papel(public.movimentacoes_estoque.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.movimentacoes_estoque.organization_id)
    and public.tem_papel(public.movimentacoes_estoque.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO'])
  );

-- checklists: leitura membros; escrita ADMIN/GESTOR/TECNICO.
drop policy if exists "ckm_select" on public.checklist_modelos;
create policy "ckm_select" on public.checklist_modelos
  for select to authenticated
  using (public.eh_membro(public.checklist_modelos.organization_id));
drop policy if exists "ckm_write" on public.checklist_modelos;
create policy "ckm_write" on public.checklist_modelos
  for all to authenticated
  using (
    public.eh_membro(public.checklist_modelos.organization_id)
    and public.tem_papel(public.checklist_modelos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.checklist_modelos.organization_id)
    and public.tem_papel(public.checklist_modelos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );
drop policy if exists "cki_all" on public.checklist_itens;
create policy "cki_all" on public.checklist_itens
  for all to authenticated
  using (
    exists (
      select 1 from public.checklist_modelos mo
      where mo.id = public.checklist_itens.modelo_id
        and public.eh_membro(mo.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.checklist_modelos mo
      where mo.id = public.checklist_itens.modelo_id
        and public.eh_membro(mo.organization_id)
    )
  );
drop policy if exists "cke_select" on public.checklist_execucoes;
create policy "cke_select" on public.checklist_execucoes
  for select to authenticated
  using (public.eh_membro(public.checklist_execucoes.organization_id));
drop policy if exists "cke_write" on public.checklist_execucoes;
create policy "cke_write" on public.checklist_execucoes
  for all to authenticated
  using (
    public.eh_membro(public.checklist_execucoes.organization_id)
    and public.tem_papel(public.checklist_execucoes.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.checklist_execucoes.organization_id)
    and public.tem_papel(public.checklist_execucoes.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );
drop policy if exists "ckr_all" on public.checklist_respostas;
create policy "ckr_all" on public.checklist_respostas
  for all to authenticated
  using (
    exists (
      select 1 from public.checklist_execucoes ex
      where ex.id = public.checklist_respostas.execucao_id
        and public.eh_membro(ex.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.checklist_execucoes ex
      where ex.id = public.checklist_respostas.execucao_id
        and public.eh_membro(ex.organization_id)
    )
  );

-- notificações: cada um vê as suas + broadcasts da org (user_id null);
-- escrita via app (service/best-effort) — membros podem marcar lida.
drop policy if exists "notif_select" on public.notificacoes;
create policy "notif_select" on public.notificacoes
  for select to authenticated
  using (
    public.eh_membro(public.notificacoes.organization_id)
    and (
      public.notificacoes.user_id is null
      or public.notificacoes.user_id = auth.uid()
    )
  );
drop policy if exists "notif_write" on public.notificacoes;
create policy "notif_write" on public.notificacoes
  for all to authenticated
  using (public.eh_membro(public.notificacoes.organization_id))
  with check (public.eh_membro(public.notificacoes.organization_id));

-- ---------- 9. STORAGE PRIVADO ----------
-- Bucket passa a privado. Fotos legadas em `chamados/...` continuam
-- legíveis para autenticados (compatibilidade, sem mover bytes).
-- Uploads novos usam prefixo o/{org_id}/... (path server-side).
update storage.buckets set public = false where id = 'manutencao-midia';

drop policy if exists "midia_legado_leitura" on storage.objects;
create policy "midia_legado_leitura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'manutencao-midia'
    and (storage.foldername(name))[1] = 'chamados'
  );

drop policy if exists "midia_org_leitura" on storage.objects;
create policy "midia_org_leitura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'manutencao-midia'
    and (storage.foldername(name))[1] = 'o'
    and exists (
      select 1 from public.memberships m
      where m.organization_id::text = (storage.foldername(name))[2]
        and m.user_id = auth.uid()
        and m.status = 'ativo'
    )
  );

-- Upload autenticado restrito ao prefixo da própria org (cinturão extra;
-- o fluxo principal usa service_role com path server-side).
drop policy if exists "midia_org_escrita" on storage.objects;
create policy "midia_org_escrita" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'manutencao-midia'
    and (storage.foldername(name))[1] = 'o'
    and exists (
      select 1 from public.memberships m
      where m.organization_id::text = (storage.foldername(name))[2]
        and m.user_id = auth.uid()
        and m.status = 'ativo'
    )
  );
