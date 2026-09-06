-- ============================================================
-- SGA-M · schema_v7.sql — FASE 2: ativos completos + QR
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schemas v1–v6 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado. QRs legados intactos.
-- ============================================================

-- ---------- 1. ativos: cadastro profissional ----------
-- Identificação
alter table public.ativos add column if not exists codigo text;
alter table public.ativos add column if not exists descricao text;
alter table public.ativos add column if not exists numero_serie text;
alter table public.ativos add column if not exists patrimonio text;
alter table public.ativos add column if not exists tag text;
alter table public.ativos add column if not exists fabricante text;
alter table public.ativos add column if not exists modelo text;

-- Status operacional (7 estados; default preserva legados como operacionais)
alter table public.ativos add column if not exists status text
  not null default 'operacional'
  check (status in ('operacional', 'em_manutencao', 'parado', 'em_instalacao', 'em_inspecao', 'inativo', 'desativado'));

-- Classificação
alter table public.ativos add column if not exists criticidade text
  check (criticidade in ('baixa', 'media', 'alta', 'critica'));
alter table public.ativos add column if not exists prioridade_padrao text
  check (prioridade_padrao in ('baixa', 'media', 'alta', 'critica'));
alter table public.ativos add column if not exists centro_custo text;
alter table public.ativos add column if not exists departamento text;
alter table public.ativos add column if not exists responsavel text;
alter table public.ativos add column if not exists equipe text;

-- Aquisição
alter table public.ativos add column if not exists fornecedor_id uuid
  references public.fornecedores (id) on delete set null;
alter table public.ativos add column if not exists nota_fiscal text;
alter table public.ativos add column if not exists data_aquisicao date;
alter table public.ativos add column if not exists valor_aquisicao numeric check (valor_aquisicao is null or valor_aquisicao >= 0);
alter table public.ativos add column if not exists data_instalacao date;
alter table public.ativos add column if not exists garantia_ate date;
alter table public.ativos add column if not exists vida_util_meses integer check (vida_util_meses is null or vida_util_meses > 0);

-- Dados técnicos (JSONB conforme schema da categoria; FASE 1)
alter table public.ativos add column if not exists dados_tecnicos jsonb not null default '{}';

-- QR: metadados (hash e tokens NUNCA mudam aqui; regeneração é app)
alter table public.ativos add column if not exists qr_impresso_em timestamptz;
alter table public.ativos add column if not exists updated_at timestamptz not null default now();

-- Código único por organização (só quando preenchido)
create unique index if not exists ativos_org_codigo_uniq
  on public.ativos (organization_id, codigo) where codigo is not null;

create index if not exists ativos_org_status_idx
  on public.ativos (organization_id, status);
create index if not exists ativos_fornecedor_idx
  on public.ativos (fornecedor_id);

comment on column public.ativos.dados_tecnicos is
  'Valores dos atributos da categoria (chave = nome do atributo).';

-- ---------- 2. ativo_status_historico ----------
create table if not exists public.ativo_status_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ativo_id uuid not null references public.ativos (id) on delete cascade,
  de text,
  para text not null,
  motivo text,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ativo_hist_ativo_idx
  on public.ativo_status_historico (ativo_id, created_at desc);

-- ---------- 3. ativo_documentos ----------
-- categoria: manual, ficha_tecnica, nota_fiscal, certificado, laudo,
-- garantia, contrato, desenho, procedimento, foto, outro.
-- Arquivos em o/{org}/documentos/... ou .../fotos/... (Storage privado).
create table if not exists public.ativo_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ativo_id uuid not null references public.ativos (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 160),
  categoria text not null default 'outro'
    check (categoria in ('manual', 'ficha_tecnica', 'nota_fiscal', 'certificado', 'laudo', 'garantia', 'contrato', 'desenho', 'procedimento', 'foto', 'outro')),
  path text not null,
  tamanho_bytes bigint not null default 0 check (tamanho_bytes >= 0),
  mime text,
  created_at timestamptz not null default now()
);

create index if not exists ativo_docs_ativo_idx
  on public.ativo_documentos (ativo_id, created_at desc);

-- ---------- 4. RLS (leitura membros; escrita AGT = ativos.escrever) ----------
alter table public.ativo_status_historico enable row level security;
alter table public.ativo_documentos enable row level security;

grant select, insert, update, delete on public.ativo_status_historico to authenticated;
grant select, insert, update, delete on public.ativo_documentos to authenticated;

drop policy if exists "ash_select" on public.ativo_status_historico;
create policy "ash_select" on public.ativo_status_historico
  for select to authenticated
  using (public.eh_membro(public.ativo_status_historico.organization_id));
drop policy if exists "ash_write" on public.ativo_status_historico;
create policy "ash_write" on public.ativo_status_historico
  for all to authenticated
  using (
    public.eh_membro(public.ativo_status_historico.organization_id)
    and public.tem_papel(public.ativo_status_historico.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.ativo_status_historico.organization_id)
    and public.tem_papel(public.ativo_status_historico.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

drop policy if exists "adoc_select" on public.ativo_documentos;
create policy "adoc_select" on public.ativo_documentos
  for select to authenticated
  using (public.eh_membro(public.ativo_documentos.organization_id));
drop policy if exists "adoc_write" on public.ativo_documentos;
create policy "adoc_write" on public.ativo_documentos
  for all to authenticated
  using (
    public.eh_membro(public.ativo_documentos.organization_id)
    and public.tem_papel(public.ativo_documentos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.ativo_documentos.organization_id)
    and public.tem_papel(public.ativo_documentos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

-- ---------- 5. enforce_same_org: cobre as tabelas novas ----------
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
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_org_ativo_hist on public.ativo_status_historico;
create trigger trg_org_ativo_hist before insert or update on public.ativo_status_historico
  for each row execute function public.enforce_same_org();

drop trigger if exists trg_org_ativo_docs on public.ativo_documentos;
create trigger trg_org_ativo_docs before insert or update on public.ativo_documentos
  for each row execute function public.enforce_same_org();
