-- ============================================================
-- SGA-M · schema_v25.sql — BLOCO 3: permissões customizáveis
-- ------------------------------------------------------------
-- Cria `permissoes_custom`: overlay granular por usuário sobre a
-- matriz de perfis (`src/lib/permissoes.ts`).
-- Semântica (camada servidor):
--   · base = matriz do perfil (role);
--   · `conceder` ADICIONA (global ou restrito ao escopo);
--   · `negar` BLOQUEIA (global sempre vence; com escopo vence
--     naquele escopo mesmo que o perfil permita).
-- Escopos: `global` (escopo_id NULL), `localidade`, `almoxarifado`.
-- `usuarios.administrar` NÃO é customizável (só perfil ADMIN).
-- Nenhum dado existente é apagado. Sem linhas iniciais: sem
-- customização, o comportamento é 100% o atual (perfis).
-- PRÉ-REQUISITOS: schemas v1–v24 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- ---------- 1. permissoes_custom ----------
create table if not exists public.permissoes_custom (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  permissao text not null check (char_length(permissao) between 1 and 60),
  efeito text not null check (efeito in ('conceder', 'negar')),
  escopo_tipo text not null default 'global' check (escopo_tipo in ('global', 'localidade', 'almoxarifado')),
  escopo_id uuid,
  created_by text,
  created_at timestamptz not null default now(),
  check (
    (escopo_tipo = 'global' and escopo_id is null)
    or (escopo_tipo in ('localidade', 'almoxarifado') and escopo_id is not null)
  )
);

-- Unicidade incluindo NULL (NULL ≠ NULL não bastaria): uma linha por
-- usuário/permissão/escopo. Global usa UUID zero como substituto.
create unique index if not exists permcustom_uniq
  on public.permissoes_custom (
    organization_id, user_id, permissao, escopo_tipo,
    coalesce(escopo_id, '00000000-0000-0000-0000-000000000000')
  );
create index if not exists permcustom_user_idx
  on public.permissoes_custom (organization_id, user_id);

comment on table public.permissoes_custom is
  'Overlay granular por usuário: conceder adiciona, negar bloqueia (global vence tudo). usuarios.administrar fora do modelo (só perfil).';

-- ---------- 2. RLS (leitura membros; escrita só ADMIN) ----------
alter table public.permissoes_custom enable row level security;

grant select, insert, update, delete on public.permissoes_custom to authenticated;

drop policy if exists "permc_select" on public.permissoes_custom;
create policy "permc_select" on public.permissoes_custom
  for select to authenticated
  using (public.eh_membro(public.permissoes_custom.organization_id));
drop policy if exists "permc_write" on public.permissoes_custom;
create policy "permc_write" on public.permissoes_custom
  for all to authenticated
  using (
    public.eh_membro(public.permissoes_custom.organization_id)
    and public.tem_papel(public.permissoes_custom.organization_id, array['ADMIN'])
  )
  with check (
    public.eh_membro(public.permissoes_custom.organization_id)
    and public.tem_papel(public.permissoes_custom.organization_id, array['ADMIN'])
  );

-- ---------- 3. enforce_same_org (estende v24; corpo integral + 1 bloco) ----------
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
  -- BLOCO 1 (v23): vínculos das tabelas de cadastros
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
  -- BLOCO 2 (v24): vínculos de almoxarifado
  if TG_TABLE_NAME = 'almoxarifados' and (j->>'localidade_id') is not null then
    select organization_id into v_org from public.localidades where id = (j->>'localidade_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'produtos' and (j->>'almoxarifado_id') is not null then
    select organization_id into v_org from public.almoxarifados where id = (j->>'almoxarifado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
  end if;
  if TG_TABLE_NAME = 'movimentacoes_estoque' and (j->>'almoxarifado_id') is not null then
    select organization_id into v_org from public.almoxarifados where id = (j->>'almoxarifado_id')::uuid;
    if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
  end if;
  -- BLOCO 3 (v25): alvo deve ser membro ativo da org; escopo na mesma org
  if TG_TABLE_NAME = 'permissoes_custom' then
    perform 1 from public.memberships
      where user_id = (j->>'user_id')::uuid and organization_id = v_minha_org and status = 'ativo';
    if not found then
      raise exception 'Cross-tenant bloqueado: usuário sem vínculo ativo na organização';
    end if;
    if (j->>'escopo_tipo') = 'localidade' then
      select organization_id into v_org from public.localidades where id = (j->>'escopo_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: localidade de outra organização'; end if;
    end if;
    if (j->>'escopo_tipo') = 'almoxarifado' then
      select organization_id into v_org from public.almoxarifados where id = (j->>'escopo_id')::uuid;
      if v_org is distinct from v_minha_org then raise exception 'Cross-tenant bloqueado: almoxarifado de outra organização'; end if;
    end if;
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
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_almoxarifados') then
    create trigger trg_org_almoxarifados before insert or update on public.almoxarifados
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_produtos') then
    create trigger trg_org_produtos before insert or update on public.produtos
      for each row execute function public.enforce_same_org();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_permissoes') then
    create trigger trg_org_permissoes before insert or update on public.permissoes_custom
      for each row execute function public.enforce_same_org();
  end if;
end
$$;
-- `trg_org_mov` (v4) já cobre `movimentacoes_estoque`.
