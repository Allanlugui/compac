-- ============================================================
-- SGA-M · schema_v23.sql — BLOCO 1: cadastros mestres
-- ------------------------------------------------------------
-- Cria as tabelas relacionais `departamentos_setores` e
-- `centros_custo`, vinculadas à árvore física (`localidades`).
-- Hoje esses conceitos são texto livre (ativos/chamados/
-- solicitacoes/memberships com limite 80); a partir daqui passam
-- a ter cadastro próprio com RLS + enforce_same_org.
-- Nenhum dado existente é apagado ou migrado (colunas texto
-- legadas permanecem intactas — compatibilidade total).
-- PRÉ-REQUISITOS: schemas v1–v22 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- ---------- 1. departamentos_setores ----------
create table if not exists public.departamentos_setores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  sigla text check (sigla is null or char_length(sigla) between 1 and 10),
  localidade_id uuid references public.localidades (id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, nome)
);

create index if not exists deptos_org_idx on public.departamentos_setores (organization_id);
create index if not exists deptos_localidade_idx on public.departamentos_setores (localidade_id);

comment on table public.departamentos_setores is
  'Departamentos/setores da org, opcionalmente vinculados a um nó da árvore física (localidades).';

-- ---------- 2. centros_custo ----------
create table if not exists public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  codigo text not null check (char_length(codigo) between 1 and 20),
  nome text not null check (char_length(nome) between 1 and 80),
  departamento_id uuid references public.departamentos_setores (id) on delete set null,
  localidade_id uuid references public.localidades (id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, codigo)
);

create index if not exists cc_org_idx on public.centros_custo (organization_id);
create index if not exists cc_departamento_idx on public.centros_custo (departamento_id);
create index if not exists cc_localidade_idx on public.centros_custo (localidade_id);

comment on table public.centros_custo is
  'Centros de custo da org (código único por org), opcionalmente vinculados a departamento e localidade.';

-- ---------- 3. RLS (padrão v6: leitura membros; escrita ADMIN/GESTOR) ----------
alter table public.departamentos_setores enable row level security;
alter table public.centros_custo enable row level security;

grant select, insert, update, delete on public.departamentos_setores to authenticated;
grant select, insert, update, delete on public.centros_custo to authenticated;

drop policy if exists "deptos_select" on public.departamentos_setores;
create policy "deptos_select" on public.departamentos_setores
  for select to authenticated
  using (public.eh_membro(public.departamentos_setores.organization_id));
drop policy if exists "deptos_write" on public.departamentos_setores;
create policy "deptos_write" on public.departamentos_setores
  for all to authenticated
  using (
    public.eh_membro(public.departamentos_setores.organization_id)
    and public.tem_papel(public.departamentos_setores.organization_id, array['ADMIN', 'GESTOR'])
  )
  with check (
    public.eh_membro(public.departamentos_setores.organization_id)
    and public.tem_papel(public.departamentos_setores.organization_id, array['ADMIN', 'GESTOR'])
  );

drop policy if exists "cc_select" on public.centros_custo;
create policy "cc_select" on public.centros_custo
  for select to authenticated
  using (public.eh_membro(public.centros_custo.organization_id));
drop policy if exists "cc_write" on public.centros_custo;
create policy "cc_write" on public.centros_custo
  for all to authenticated
  using (
    public.eh_membro(public.centros_custo.organization_id)
    and public.tem_papel(public.centros_custo.organization_id, array['ADMIN', 'GESTOR'])
  )
  with check (
    public.eh_membro(public.centros_custo.organization_id)
    and public.tem_papel(public.centros_custo.organization_id, array['ADMIN', 'GESTOR'])
  );

-- ---------- 4. enforce_same_org (estende v18; corpo integral + 3 blocos) ----------
create or replace function public.enforce_same_org()
returns trigger as $$
declare
  v_org uuid;
  v_minha_org uuid;
  j jsonb := to_jsonb(NEW);
begin
  v_minha_org := (j->>'organization_id')::uuid;
  if TG_TABLE_NAME = 'solicitacoes_compra' and (j->>'chamado_id') is not null then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then
      raise exception 'Cross-tenant bloqueado: O.S. de outra organização';
    end if;
  end if;
  if TG_TABLE_NAME = 'chamados' and (j->>'ativo_id') is not null then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'compras' and (j->>'chamado_id') is not null then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: chamado de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'compras' and (j->>'fornecedor_id') is not null then
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'movimentacoes_estoque' then
    select organization_id into v_org from public.produtos where id = (j->>'produto_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: produto de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativo_status_historico' then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativo_documentos' then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and (j->>'categoria_id') is not null then
    select organization_id into v_org from public.categorias where id = (j->>'categoria_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: categoria de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'ativos' and (j->>'fornecedor_id') is not null then
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'os_status_historico' then
    select organization_id into v_org from public.chamados where id = (j->>'os_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
  end if;
  if TG_TABLE_NAME in ('os_atividades', 'os_fotos') then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'os_servicos_externos' then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
    if (j->>'fornecedor_id') is not null then
      select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
    end if;
  end if;
  if TG_TABLE_NAME = 'planos_manutencao' then
    select organization_id into v_org from public.ativos where id = (j->>'ativo_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: ativo de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'checklist_execucoes' and (j->>'chamado_id') is not null then
    select organization_id into v_org from public.chamados where id = (j->>'chamado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: O.S. de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'produto_fornecedores' then
    select organization_id into v_org from public.produtos where id = (j->>'produto_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: produto de outra organização'; end if;
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME in ('solicitacao_itens', 'solicitacao_historico', 'solicitacao_anexos', 'cotacoes') then
    select organization_id into v_org from public.solicitacoes_compra where id = (j->>'solicitacao_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: solicitação de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'cotacoes' and (j->>'fornecedor_id') is not null then
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'pedidos_compra' then
    if (j->>'solicitacao_id') is not null then
      select organization_id into v_org from public.solicitacoes_compra where id = (j->>'solicitacao_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: solicitação de outra organização'; end if;
    end if;
    select organization_id into v_org from public.fornecedores where id = (j->>'fornecedor_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: fornecedor de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'pedido_itens' then
    select organization_id into v_org from public.pedidos_compra where id = (j->>'pedido_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: pedido de outra organização'; end if;
    if (j->>'produto_id') is not null then
      select organization_id into v_org from public.produtos where id = (j->>'produto_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: produto de outra organização'; end if;
    end if;
  end if;
  if TG_TABLE_NAME = 'recebimentos' then
    select organization_id into v_org from public.pedidos_compra where id = (j->>'pedido_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: pedido de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'recebimento_itens' then
    select organization_id into v_org from public.recebimentos where id = (j->>'recebimento_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: recebimento de outra organização'; end if;
  end if;
  -- BLOCO 1 (v23): vínculos das novas tabelas
  if TG_TABLE_NAME = 'departamentos_setores' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'centros_custo' and (j->>'departamento_id') is not null then
    select organization_id into v_org from public.departamentos_setores where id = (j->>'departamento_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: departamento de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'centros_custo' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_departamentos') then
    create trigger trg_org_departamentos before insert or update on public.departamentos_setores
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_centros_custo') then
    create trigger trg_org_centros_custo before insert or update on public.centros_custo
      for each row execute function public.enforce_same_org();
  end if;
end
$$;
