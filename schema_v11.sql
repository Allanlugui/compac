-- ============================================================
-- SGA-M · schema_v11.sql — FASE 4: suprimentos integrados
-- Solicitações + cotações + pedidos + recebimentos + estoque
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schemas v1–v10 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado. Status legados preservados.
-- ============================================================

-- ---------- 1. produtos: cadastro completo ----------
alter table public.produtos add column if not exists sku text;
alter table public.produtos add column if not exists subcategoria text;
alter table public.produtos add column if not exists ponto_reposicao numeric not null default 0 check (ponto_reposicao >= 0);
alter table public.produtos add column if not exists ultimo_custo numeric not null default 0 check (ultimo_custo >= 0);
alter table public.produtos add column if not exists codigo_fornecedor text;

create unique index if not exists produtos_org_sku_uniq
  on public.produtos (organization_id, sku) where sku is not null;

-- ---------- 2. movimentações: origem/destino (transferência em par) ----------
alter table public.movimentacoes_estoque add column if not exists origem text;
alter table public.movimentacoes_estoque add column if not exists destino text;

-- ---------- 3. fornecedores: cadastro completo ----------
alter table public.fornecedores add column if not exists razao_social text;
alter table public.fornecedores add column if not exists nome_fantasia text;
alter table public.fornecedores add column if not exists ie text;
alter table public.fornecedores add column if not exists site text;
alter table public.fornecedores add column if not exists cidade text;
alter table public.fornecedores add column if not exists estado text;
alter table public.fornecedores add column if not exists cep text;
alter table public.fornecedores add column if not exists observacoes text;

-- ---------- 4. unidades de medida (configuráveis por org) ----------
create table if not exists public.unidades_medida (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sigla text not null check (char_length(sigla) between 1 and 10),
  nome text not null check (char_length(nome) between 1 and 40),
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, sigla)
);

-- Semente por org existente (UN/KG/G/L/ML/M/CM/CX/PCT/KIT) — idempotente.
insert into public.unidades_medida (organization_id, sigla, nome)
select o.id, u.sigla, u.nome
from public.organizations o
cross join (values
  ('UN','Unidade'), ('KG','Quilograma'), ('G','Grama'), ('L','Litro'),
  ('ML','Mililitro'), ('M','Metro'), ('CM','Centímetro'), ('CX','Caixa'),
  ('PCT','Pacote'), ('KIT','Kit')
) as u(sigla, nome)
on conflict (organization_id, sigla) do nothing;

-- ---------- 5. produto × fornecedor (principal + referência) ----------
create table if not exists public.produto_fornecedores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores (id) on delete cascade,
  principal boolean not null default false,
  preco_ref numeric check (preco_ref is null or preco_ref >= 0),
  prazo_medio_dias integer check (prazo_medio_dias is null or prazo_medio_dias >= 0),
  created_at timestamptz not null default now(),
  unique (produto_id, fornecedor_id)
);
create index if not exists pf_prod_idx on public.produto_fornecedores (produto_id);

-- ---------- 6. solicitações: workflow completo ----------
-- Status legados (pendente/aprovado/rejeitado/comprado) preservados no check.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.solicitacoes_compra'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) like '%pendente%'
  loop
    execute format('alter table public.solicitacoes_compra drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'solic_status_check') then
    alter table public.solicitacoes_compra add constraint solic_status_check
      check (status in ('rascunho', 'enviada', 'em_analise', 'aprovada', 'rejeitada',
        'em_cotacao', 'pedido_gerado', 'recebida', 'encerrada', 'cancelada',
        'pendente', 'aprovado', 'rejeitado', 'comprado'));
  end if;
end
$$;

alter table public.solicitacoes_compra add column if not exists origem text
  check (origem in ('qr', 'portal', 'estoque', 'manual'));
alter table public.solicitacoes_compra add column if not exists prioridade text
  check (prioridade in ('baixa', 'media', 'alta', 'critica'));
alter table public.solicitacoes_compra add column if not exists centro_custo text;
alter table public.solicitacoes_compra add column if not exists prazo date;
alter table public.solicitacoes_compra add column if not exists created_by uuid
  references public.profiles (id) on delete set null;
alter table public.solicitacoes_compra add column if not exists aprovado_por text;
alter table public.solicitacoes_compra add column if not exists aprovado_em timestamptz;
alter table public.solicitacoes_compra add column if not exists decisao_obs text;

-- ---------- 7. itens da solicitação ----------
create table if not exists public.solicitacao_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes_compra (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  descricao text not null check (char_length(descricao) between 1 and 200),
  quantidade numeric not null check (quantidade > 0),
  unidade text not null default 'UN' check (char_length(unidade) between 1 and 10),
  justificativa text,
  urgencia text not null default 'normal' check (urgencia in ('baixa', 'normal', 'alta', 'critica')),
  observacao text,
  created_at timestamptz not null default now()
);
create index if not exists soli_itens_sol_idx on public.solicitacao_itens (solicitacao_id);

-- ---------- 8. histórico da solicitação (append-only) ----------
create table if not exists public.solicitacao_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes_compra (id) on delete cascade,
  de text,
  para text not null,
  motivo text,
  user_id uuid references public.profiles (id) on delete set null,
  executado_por text,
  created_at timestamptz not null default now()
);
create index if not exists soli_hist_sol_idx on public.solicitacao_historico (solicitacao_id, created_at desc);

-- ---------- 9. anexos da solicitação (Storage privado) ----------
create table if not exists public.solicitacao_anexos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes_compra (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 160),
  path text not null,
  tamanho_bytes bigint not null default 0 check (tamanho_bytes >= 0),
  mime text,
  created_at timestamptz not null default now()
);
create index if not exists soli_anex_sol_idx on public.solicitacao_anexos (solicitacao_id);

-- ---------- 10. cotações ----------
create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitacao_id uuid not null references public.solicitacoes_compra (id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores (id) on delete cascade,
  valor numeric not null check (valor >= 0),
  prazo_dias integer check (prazo_dias is null or prazo_dias >= 0),
  condicoes text,
  observacoes text,
  vencedora boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cot_sol_idx on public.cotacoes (solicitacao_id);

-- ---------- 11. pedidos de compra ----------
create table if not exists public.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  solicitacao_id uuid references public.solicitacoes_compra (id) on delete set null,
  fornecedor_id uuid not null references public.fornecedores (id) on delete restrict,
  numero text not null,
  status text not null default 'aberto'
    check (status in ('aberto', 'aprovado', 'recebido', 'encerrado', 'cancelado')),
  frete numeric not null default 0 check (frete >= 0),
  desconto numeric not null default 0 check (desconto >= 0),
  impostos numeric not null default 0 check (impostos >= 0),
  prazo date,
  centro_custo text,
  comprador text,
  observacao text,
  created_at timestamptz not null default now(),
  unique (organization_id, numero)
);
create index if not exists ped_forn_idx on public.pedidos_compra (fornecedor_id);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pedido_id uuid not null references public.pedidos_compra (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  descricao text not null check (char_length(descricao) between 1 and 200),
  quantidade numeric not null check (quantidade > 0),
  unidade text not null default 'UN' check (char_length(unidade) between 1 and 10),
  preco_unitario numeric not null check (preco_unitario >= 0),
  created_at timestamptz not null default now()
);
create index if not exists pedi_itens_ped_idx on public.pedido_itens (pedido_id);

-- ---------- 12. recebimentos (+ itens + divergência + foto) ----------
create table if not exists public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pedido_id uuid not null references public.pedidos_compra (id) on delete cascade,
  status text not null default 'aceito' check (status in ('aceito', 'divergente')),
  lote text,
  validade date,
  motivo_divergencia text,
  foto_path text,
  recebido_por text,
  created_at timestamptz not null default now()
);
create index if not exists rec_ped_idx on public.recebimentos (pedido_id);

create table if not exists public.recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recebimento_id uuid not null references public.recebimentos (id) on delete cascade,
  pedido_item_id uuid not null references public.pedido_itens (id) on delete cascade,
  qtd_recebida numeric not null check (qtd_recebida >= 0),
  qtd_recusada numeric not null default 0 check (qtd_recusada >= 0),
  motivo text,
  created_at timestamptz not null default now()
);

-- ---------- 13. QR contextos (solicitação por unidade/setor/área) ----------
create table if not exists public.qr_contextos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  unidade text,
  setor text,
  area text,
  almoxarifado text,
  centro_custo text,
  token text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists qrc_org_idx on public.qr_contextos (organization_id);

-- ---------- 14. RLS ----------
alter table public.unidades_medida enable row level security;
alter table public.produto_fornecedores enable row level security;
alter table public.solicitacao_itens enable row level security;
alter table public.solicitacao_historico enable row level security;
alter table public.solicitacao_anexos enable row level security;
alter table public.cotacoes enable row level security;
alter table public.pedidos_compra enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.recebimentos enable row level security;
alter table public.recebimento_itens enable row level security;
alter table public.qr_contextos enable row level security;

-- Leitura membros em todas; escrita por papel (ver matriz de permissões).
-- (Bloco gerado por padrão; policies individuais abaixo.)

-- unidades: leitura membros; escrita ADMIN/GESTOR/COMPRAS.
grant select, insert, update, delete on public.unidades_medida to authenticated;
drop policy if exists "uni_select" on public.unidades_medida;
create policy "uni_select" on public.unidades_medida
  for select to authenticated using (public.eh_membro(public.unidades_medida.organization_id));
drop policy if exists "uni_write" on public.unidades_medida;
create policy "uni_write" on public.unidades_medida
  for all to authenticated
  using (public.eh_membro(public.unidades_medida.organization_id)
    and public.tem_papel(public.unidades_medida.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']))
  with check (public.eh_membro(public.unidades_medida.organization_id)
    and public.tem_papel(public.unidades_medida.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']));

-- produto_fornecedores: leitura membros; escrita AGC.
grant select, insert, update, delete on public.produto_fornecedores to authenticated;
drop policy if exists "pf_select" on public.produto_fornecedores;
create policy "pf_select" on public.produto_fornecedores
  for select to authenticated using (public.eh_membro(public.produto_fornecedores.organization_id));
drop policy if exists "pf_write" on public.produto_fornecedores;
create policy "pf_write" on public.produto_fornecedores
  for all to authenticated
  using (public.eh_membro(public.produto_fornecedores.organization_id)
    and public.tem_papel(public.produto_fornecedores.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']))
  with check (public.eh_membro(public.produto_fornecedores.organization_id)
    and public.tem_papel(public.produto_fornecedores.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']));

-- solicitacao_itens/anexos/cotacoes: leitura membros; escrita AGC (+solicitante cria itens próprios via app).
grant select, insert, update, delete on public.solicitacao_itens to authenticated;
drop policy if exists "sii_select" on public.solicitacao_itens;
create policy "sii_select" on public.solicitacao_itens
  for select to authenticated using (public.eh_membro(public.solicitacao_itens.organization_id));
drop policy if exists "sii_write" on public.solicitacao_itens;
create policy "sii_write" on public.solicitacao_itens
  for all to authenticated
  using (public.eh_membro(public.solicitacao_itens.organization_id)
    and public.tem_papel(public.solicitacao_itens.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO', 'SOLICITANTE']))
  with check (public.eh_membro(public.solicitacao_itens.organization_id)
    and public.tem_papel(public.solicitacao_itens.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO', 'SOLICITANTE']));

grant select, insert, update, delete on public.solicitacao_anexos to authenticated;
drop policy if exists "sia_select" on public.solicitacao_anexos;
create policy "sia_select" on public.solicitacao_anexos
  for select to authenticated using (public.eh_membro(public.solicitacao_anexos.organization_id));
drop policy if exists "sia_write" on public.solicitacao_anexos;
create policy "sia_write" on public.solicitacao_anexos
  for all to authenticated
  using (public.eh_membro(public.solicitacao_anexos.organization_id)
    and public.tem_papel(public.solicitacao_anexos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO', 'SOLICITANTE']))
  with check (public.eh_membro(public.solicitacao_anexos.organization_id)
    and public.tem_papel(public.solicitacao_anexos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS', 'TECNICO', 'SOLICITANTE']));

grant select, insert, update, delete on public.cotacoes to authenticated;
drop policy if exists "cot_select" on public.cotacoes;
create policy "cot_select" on public.cotacoes
  for select to authenticated using (public.eh_membro(public.cotacoes.organization_id));
drop policy if exists "cot_write" on public.cotacoes;
create policy "cot_write" on public.cotacoes
  for all to authenticated
  using (public.eh_membro(public.cotacoes.organization_id)
    and public.tem_papel(public.cotacoes.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']))
  with check (public.eh_membro(public.cotacoes.organization_id)
    and public.tem_papel(public.cotacoes.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']));

-- solicitacao_historico: append-only (select + insert).
grant select, insert on public.solicitacao_historico to authenticated;
drop policy if exists "sih_select" on public.solicitacao_historico;
create policy "sih_select" on public.solicitacao_historico
  for select to authenticated using (public.eh_membro(public.solicitacao_historico.organization_id));
drop policy if exists "sih_insert" on public.solicitacao_historico;
create policy "sih_insert" on public.solicitacao_historico
  for insert to authenticated
  with check (public.eh_membro(public.solicitacao_historico.organization_id));

-- pedidos/itens/recebimentos: leitura membros; escrita AGC.
grant select, insert, update, delete on public.pedidos_compra to authenticated;
drop policy if exists "pdc_select" on public.pedidos_compra;
create policy "pdc_select" on public.pedidos_compra
  for select to authenticated using (public.eh_membro(public.pedidos_compra.organization_id));
drop policy if exists "pdc_write" on public.pedidos_compra;
create policy "pdc_write" on public.pedidos_compra
  for all to authenticated
  using (public.eh_membro(public.pedidos_compra.organization_id)
    and public.tem_papel(public.pedidos_compra.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']))
  with check (public.eh_membro(public.pedidos_compra.organization_id)
    and public.tem_papel(public.pedidos_compra.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']));

grant select, insert, update, delete on public.pedido_itens to authenticated;
drop policy if exists "pdi_select" on public.pedido_itens;
create policy "pdi_select" on public.pedido_itens
  for select to authenticated using (public.eh_membro(public.pedido_itens.organization_id));
drop policy if exists "pdi_write" on public.pedido_itens;
create policy "pdi_write" on public.pedido_itens
  for all to authenticated
  using (public.eh_membro(public.pedido_itens.organization_id)
    and public.tem_papel(public.pedido_itens.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']))
  with check (public.eh_membro(public.pedido_itens.organization_id)
    and public.tem_papel(public.pedido_itens.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']));

grant select, insert, update, delete on public.recebimentos to authenticated;
drop policy if exists "rec_select" on public.recebimentos;
create policy "rec_select" on public.recebimentos
  for select to authenticated using (public.eh_membro(public.recebimentos.organization_id));
drop policy if exists "rec_write" on public.recebimentos;
create policy "rec_write" on public.recebimentos
  for all to authenticated
  using (public.eh_membro(public.recebimentos.organization_id)
    and public.tem_papel(public.recebimentos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']))
  with check (public.eh_membro(public.recebimentos.organization_id)
    and public.tem_papel(public.recebimentos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']));

grant select, insert, update, delete on public.recebimento_itens to authenticated;
drop policy if exists "rci_select" on public.recebimento_itens;
create policy "rci_select" on public.recebimento_itens
  for select to authenticated using (public.eh_membro(public.recebimento_itens.organization_id));
drop policy if exists "rci_write" on public.recebimento_itens;
create policy "rci_write" on public.recebimento_itens
  for all to authenticated
  using (public.eh_membro(public.recebimento_itens.organization_id)
    and public.tem_papel(public.recebimento_itens.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']))
  with check (public.eh_membro(public.recebimento_itens.organization_id)
    and public.tem_papel(public.recebimento_itens.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS']));

-- qr_contextos: leitura membros; escrita AG.
grant select, insert, update, delete on public.qr_contextos to authenticated;
drop policy if exists "qrc_select" on public.qr_contextos;
create policy "qrc_select" on public.qr_contextos
  for select to authenticated using (public.eh_membro(public.qr_contextos.organization_id));
drop policy if exists "qrc_write" on public.qr_contextos;
create policy "qrc_write" on public.qr_contextos
  for all to authenticated
  using (public.eh_membro(public.qr_contextos.organization_id)
    and public.tem_papel(public.qr_contextos.organization_id, array['ADMIN', 'GESTOR']))
  with check (public.eh_membro(public.qr_contextos.organization_id)
    and public.tem_papel(public.qr_contextos.organization_id, array['ADMIN', 'GESTOR']));

-- ---------- 15. enforce_same_org: novas tabelas ----------
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
  end if;
  if TG_TABLE_NAME = 'compras' and new.chamado_id is not null then
    select organization_id into v_org from public.chamados where id = new.chamado_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: chamado de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'compras' and new.fornecedor_id is not null then
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'movimentacoes_estoque' then
    select organization_id into v_org from public.produtos where id = new.produto_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: produto de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativo_status_historico' then
    select organization_id into v_org from public.ativos where id = new.ativo_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: ativo de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativo_documentos' then
    select organization_id into v_org from public.ativos where id = new.ativo_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: ativo de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and new.localidade_id is not null then
    select organization_id into v_org from public.localidades where id = new.localidade_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: localidade de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and new.categoria_id is not null then
    select organization_id into v_org from public.categorias where id = new.categoria_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: categoria de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and new.fornecedor_id is not null then
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'os_status_historico' then
    select organization_id into v_org from public.chamados where id = new.os_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: O.S. de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME in ('os_atividades', 'os_fotos') then
    select organization_id into v_org from public.chamados where id = new.chamado_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: O.S. de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'os_servicos_externos' then
    select organization_id into v_org from public.chamados where id = new.chamado_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: O.S. de outra organização';
    end if;
    if new.fornecedor_id is not null then
      select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
      if v_org is distinct from new.organization_id then
        raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
      end if;
    end if;
  end if;
  if TG_TABLE_NAME = 'planos_manutencao' then
    select organization_id into v_org from public.ativos where id = new.ativo_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: ativo de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'checklist_execucoes' and new.chamado_id is not null then
    select organization_id into v_org from public.chamados where id = new.chamado_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: O.S. de outra organização';
    end if;
  end if;
  -- FASE 4: suprimentos.
  if TG_TABLE_NAME = 'produto_fornecedores' then
    select organization_id into v_org from public.produtos where id = new.produto_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: produto de outra organização';
    end if;
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME in ('solicitacao_itens', 'solicitacao_historico', 'solicitacao_anexos', 'cotacoes') then
    select organization_id into v_org from public.solicitacoes_compra where id = new.solicitacao_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: solicitação de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'cotacoes' and new.fornecedor_id is not null then
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'pedidos_compra' then
    if new.solicitacao_id is not null then
      select organization_id into v_org from public.solicitacoes_compra where id = new.solicitacao_id;
      if v_org is distinct from new.organization_id then
        raise exception 'Cross-tenant bloqueado: solicitação de outra organização';
      end if;
    end if;
    select organization_id into v_org from public.fornecedores where id = new.fornecedor_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: fornecedor de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'pedido_itens' then
    select organization_id into v_org from public.pedidos_compra where id = new.pedido_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: pedido de outra organização';
    end if;
    if new.produto_id is not null then
      select organization_id into v_org from public.produtos where id = new.produto_id;
      if v_org is distinct from new.organization_id then
        raise exception 'Cross-tenant bloqueado: produto de outra organização';
      end if;
    end if;
  end if;
  if TG_TABLE_NAME = 'recebimentos' then
    select organization_id into v_org from public.pedidos_compra where id = new.pedido_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: pedido de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'recebimento_itens' then
    select organization_id into v_org from public.recebimentos where id = new.recebimento_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Cross-tenant bloqueado: recebimento de outra organização';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_org_pf on public.produto_fornecedores;
create trigger trg_org_pf before insert or update on public.produto_fornecedores
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_sii on public.solicitacao_itens;
create trigger trg_org_sii before insert or update on public.solicitacao_itens
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_sih on public.solicitacao_historico;
create trigger trg_org_sih before insert or update on public.solicitacao_historico
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_sia on public.solicitacao_anexos;
create trigger trg_org_sia before insert or update on public.solicitacao_anexos
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_cot on public.cotacoes;
create trigger trg_org_cot before insert or update on public.cotacoes
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_pdc on public.pedidos_compra;
create trigger trg_org_pdc before insert or update on public.pedidos_compra
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_pdi on public.pedido_itens;
create trigger trg_org_pdi before insert or update on public.pedido_itens
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_rec on public.recebimentos;
create trigger trg_org_rec before insert or update on public.recebimentos
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_rci on public.recebimento_itens;
create trigger trg_org_rci before insert or update on public.recebimento_itens
  for each row execute function public.enforce_same_org();

-- ---------- 16. auditoria: ações da FASE 4 ----------
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
    'STOCK_ADJUSTMENT', 'STOCK_RESERVED', 'STOCK_RELEASED', 'STOCK_CONSUMED',
    'STOCK_TRANSFERRED', 'MEMBERSHIP_CHANGE', 'ROLE_CHANGE', 'QR_REGENERATED',
    'TRIAGEM', 'OS_CONCLUIDA', 'CHECKLIST_CONCLUIDA', 'FOTO_ADICIONADA',
    'COST_ADDED', 'REQUEST_CREATED', 'REQUEST_APPROVED', 'REQUEST_REJECTED',
    'QUOTE_CREATED', 'ORDER_CREATED', 'ORDER_APPROVED', 'RECEIPT_CREATED',
    'RECEIPT_ACCEPTED', 'RECEIPT_REJECTED'));
