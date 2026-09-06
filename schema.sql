-- ============================================================
-- SGA-M · Sistema de Gestão de Manutenção e Compras
-- Schema do banco de dados (Supabase / PostgreSQL)
-- ------------------------------------------------------------
-- COMO APLICAR:
--   1. Supabase Dashboard > SQL Editor > New query
--   2. Cole todo o conteúdo deste arquivo e clique em "Run"
--   3. O script é re-executável (idempotente)
-- ============================================================

-- ---------- 0. Extensão para gen_random_uuid() ----------
create extension if not exists "pgcrypto";

-- ---------- 1. ENUM de status do chamado ----------
do $$
begin
  create type chamado_status as enum ('aberto', 'em_andamento', 'concluido');
exception
  when duplicate_object then null;
end
$$;

-- ---------- 2. TABELA: ativos ----------
create table if not exists public.ativos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  localizacao text,
  qr_code_hash text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.ativos is
  'Equipamentos/locais com QR Code para abertura pública de chamados.';

-- ---------- 3. TABELA: chamados ----------
create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references public.ativos (id) on delete cascade,
  solicitante text not null,
  descricao text not null,
  status chamado_status not null default 'aberto',
  fotos_antes text[] not null default '{}',
  fotos_depois text[] not null default '{}',
  created_at timestamptz not null default now(),
  concluido_em timestamptz
);

comment on table public.chamados is
  'Tickets de manutenção abertos via QR Code e gerenciados no painel admin.';

-- ---------- 4. TABELA: compras ----------
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid references public.chamados (id) on delete set null,
  item text not null,
  quantidade numeric not null check (quantidade > 0),
  valor_unitario numeric not null check (valor_unitario >= 0),
  -- Cálculo automático exigido pelo módulo financeiro (ETAPA 5):
  valor_total numeric generated always as (quantidade * valor_unitario) stored,
  setor text,
  data_compra date not null default current_date,
  created_at timestamptz not null default now()
);

comment on table public.compras is
  'Registro de gastos com materiais/insumos, vinculados ou não a um chamado.';
comment on column public.compras.chamado_id is
  'Opcional. ON DELETE SET NULL preserva o histórico financeiro mesmo se o chamado for excluído.';

-- ---------- 5. ÍNDICES ----------
create index if not exists chamados_ativo_id_idx
  on public.chamados (ativo_id);
create index if not exists chamados_status_idx
  on public.chamados (status);
create index if not exists chamados_created_at_idx
  on public.chamados (created_at desc);
create index if not exists compras_chamado_id_idx
  on public.compras (chamado_id);
create index if not exists compras_data_compra_idx
  on public.compras (data_compra desc);
create index if not exists compras_setor_idx
  on public.compras (setor);

-- ---------- 6. TRIGGER: concluido_em automático ----------
-- Preenche `concluido_em` ao concluir e limpa ao reabrir o chamado.
create or replace function public.set_concluido_em()
returns trigger as $$
begin
  if new.status = 'concluido' and (old.status is distinct from 'concluido') then
    new.concluido_em := coalesce(new.concluido_em, now());
  elsif new.status <> 'concluido' then
    new.concluido_em := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_chamados_concluido_em on public.chamados;
create trigger trg_chamados_concluido_em
  before insert or update of status on public.chamados
  for each row execute function public.set_concluido_em();

-- ---------- 7. SEGURANÇA: RLS + GRANTS ----------
-- NOTA DE SEGURANÇA (MVP de uso pessoal): o painel admin das ETAPAS 4–5
-- usa a ANON KEY sem login, e o formulário público do QR Code (ETAPA 3)
-- também opera sem autenticação. Por isso as policies abaixo são
-- permissivas. Antes de expor o projeto publicamente, implemente o
-- Supabase Auth e restrinja as policies de escrita/leitura de `compras`
-- e `chamados` ao papel `authenticated` (admin).
alter table public.ativos enable row level security;
alter table public.chamados enable row level security;
alter table public.compras enable row level security;

grant usage on type chamado_status to anon, authenticated;
grant select, insert, update, delete on public.ativos to anon, authenticated;
grant select, insert, update, delete on public.chamados to anon, authenticated;
grant select, insert, update, delete on public.compras to anon, authenticated;

drop policy if exists "sga_acesso_total_ativos" on public.ativos;
create policy "sga_acesso_total_ativos"
  on public.ativos for all to anon, authenticated using (true) with check (true);

drop policy if exists "sga_acesso_total_chamados" on public.chamados;
create policy "sga_acesso_total_chamados"
  on public.chamados for all to anon, authenticated using (true) with check (true);

drop policy if exists "sga_acesso_total_compras" on public.compras;
create policy "sga_acesso_total_compras"
  on public.compras for all to anon, authenticated using (true) with check (true);

-- ---------- 8. STORAGE: bucket `manutencao-midia` ----------
-- Bucket PÚBLICO: as fotos precisam de URL pública para a OS
-- imprimível (ETAPA 4) e para o formulário mobile (ETAPA 3).
insert into storage.buckets (id, name, public)
values ('manutencao-midia', 'manutencao-midia', true)
on conflict (id) do update set public = true;

-- RLS já vem habilitado em storage.objects no Supabase; garante idempotência:
-- (mantido como comentário pois `enable row level security` é idempotente,
--  descomente se o seu projeto for auto-hospedado)
-- alter table storage.objects enable row level security;

drop policy if exists "sga_midia_leitura_publica" on storage.objects;
create policy "sga_midia_leitura_publica"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'manutencao-midia');

drop policy if exists "sga_midia_upload_publico" on storage.objects;
create policy "sga_midia_upload_publico"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'manutencao-midia');

drop policy if exists "sga_midia_atualizacao_publica" on storage.objects;
create policy "sga_midia_atualizacao_publica"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'manutencao-midia')
  with check (bucket_id = 'manutencao-midia');

drop policy if exists "sga_midia_exclusao_publica" on storage.objects;
create policy "sga_midia_exclusao_publica"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'manutencao-midia');
