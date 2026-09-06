-- ============================================================
-- SGA-M v2.0 · schema_v2.sql — expansão da Fase 1
-- ------------------------------------------------------------
-- COMO APLICAR:
--   1. Garanta que `schema.sql` (v1) já foi aplicado.
--   2. Supabase Dashboard > SQL Editor > New query
--   3. Cole todo o conteúdo deste arquivo e clique em "Run"
--   4. O script é re-executável (idempotente) e NÃO altera
--      nenhuma tabela criada pelo `schema.sql`.
-- ============================================================

-- ---------- 1. TABELA: solicitacoes_compra ----------
-- Pedidos de material abertos por qualquer colaborador via QR Code.
-- Cada solicitação recebe um `qr_code_hash` único que serve como
-- link de acompanhamento: /qr-compra/{hash}.
create table if not exists public.solicitacoes_compra (
  id uuid primary key default gen_random_uuid(),
  setor text not null,
  solicitante text not null,
  item text not null,
  justificativa text not null,
  quantidade numeric not null check (quantidade > 0),
  valor_estimado numeric not null default 0 check (valor_estimado >= 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'rejeitado', 'comprado')),
  qr_code_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.solicitacoes_compra is
  'Solicitações de compra via QR Code com acompanhamento público de status.';

create index if not exists solicitacoes_status_idx
  on public.solicitacoes_compra (status);
create index if not exists solicitacoes_created_at_idx
  on public.solicitacoes_compra (created_at desc);

-- Mantém `updated_at` sempre atual sem depender da aplicação.
create or replace function public.sga_touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_solicitacoes_updated_at on public.solicitacoes_compra;
create trigger trg_solicitacoes_updated_at
  before update on public.solicitacoes_compra
  for each row execute function public.sga_touch_updated_at();

-- ---------- 2. TABELA: auditoria_logs ----------
-- Trilha de auditoria/homologação (Fase 4 consome estes dados).
-- Gravada pela aplicação via Server Actions, após cada mutação.
create table if not exists public.auditoria_logs (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  executado_por text not null default 'sistema',
  created_at timestamptz not null default now()
);

comment on table public.auditoria_logs is
  'Log imutável de mutações para auditoria e homologação.';

create index if not exists auditoria_registro_idx
  on public.auditoria_logs (tabela, registro_id);
create index if not exists auditoria_created_at_idx
  on public.auditoria_logs (created_at desc);

-- ---------- 3. SEGURANÇA: RLS + GRANTS ----------
-- Mesma nota do schema.sql v1 (MVP de uso pessoal): policies
-- permissivas porque o acompanhamento /qr-compra/[hash] é público
-- e o admin ainda opera sem login. Restringir com Supabase Auth
-- antes de expor publicamente.
alter table public.solicitacoes_compra enable row level security;
alter table public.auditoria_logs enable row level security;

grant select, insert, update, delete on public.solicitacoes_compra to anon, authenticated;
grant select, insert on public.auditoria_logs to anon, authenticated;

drop policy if exists "sga_acesso_solicitacoes_compra" on public.solicitacoes_compra;
create policy "sga_acesso_solicitacoes_compra"
  on public.solicitacoes_compra for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "sga_acesso_auditoria_logs" on public.auditoria_logs;
create policy "sga_acesso_auditoria_logs"
  on public.auditoria_logs for all to anon, authenticated
  using (true) with check (true);
