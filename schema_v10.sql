-- ============================================================
-- SGA-M · schema_v10.sql — FASE 3: manutenção + O.S. + preventiva
-- Reutiliza `chamados` como O.S. (sem duplicar entidades).
-- ------------------------------------------------------------
-- PRÉ-REQUISITOS: schemas v1–v9 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente. Nenhum dado é apagado.
-- ============================================================

-- ---------- 0. estoque: reserva em dois baldes + devolução ----------
-- físico (estoque_atual) × reservado (estoque_reservado); disponível = físico − reservado.
-- Reserva move para o balde reservado SEM baixar o físico; consumo baixa os
-- dois; devolução retorna ao disponível. Sem isso, reservar+consumir contava dobrado.
alter table public.produtos add column if not exists estoque_reservado numeric
  not null default 0 check (estoque_reservado >= 0);

do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.movimentacoes_estoque'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) like '%reserva%'
  loop
    execute format('alter table public.movimentacoes_estoque drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'movimentacoes_tipo_check') then
    alter table public.movimentacoes_estoque add constraint movimentacoes_tipo_check
      check (tipo in ('entrada', 'saida', 'ajuste', 'reserva', 'consumo', 'devolucao'));
  end if;
end
$$;

-- ---------- 1. status do chamado: novos valores (legados mantidos) ----------
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'chamado_status' and e.enumlabel = 'em_triagem') then
    alter type chamado_status add value 'em_triagem';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'chamado_status' and e.enumlabel = 'aguardando_informacao') then
    alter type chamado_status add value 'aguardando_informacao';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'chamado_status' and e.enumlabel = 'convertido_os') then
    alter type chamado_status add value 'convertido_os';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'chamado_status' and e.enumlabel = 'resolvido') then
    alter type chamado_status add value 'resolvido';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'chamado_status' and e.enumlabel = 'cancelado') then
    alter type chamado_status add value 'cancelado';
  end if;
end
$$;

-- Conclusão passa a incluir `resolvido` (além do legado `concluido`).
create or replace function public.set_concluido_em()
returns trigger as $$
begin
  if new.status in ('concluido', 'resolvido') and (old.status is distinct from new.status) then
    new.concluido_em := coalesce(new.concluido_em, now());
  elsif new.status not in ('concluido', 'resolvido') then
    new.concluido_em := null;
  end if;
  return new;
end;
$$ language plpgsql;

-- ---------- 2. chamados: triagem + O.S. (colunas, sem quebrar nada) ----------
-- Triagem
alter table public.chamados add column if not exists origem text
  check (origem in ('qr', 'portal', 'administrador', 'telefone', 'email', 'importacao'));
alter table public.chamados add column if not exists departamento text;
alter table public.chamados add column if not exists contato text;
alter table public.chamados add column if not exists categoria text;
alter table public.chamados add column if not exists subcategoria text;
alter table public.chamados add column if not exists equipe text;
alter table public.chamados add column if not exists criticidade text
  check (criticidade in ('baixa', 'media', 'alta', 'critica'));

-- O.S.: ciclo de vida próprio (nulo até a conversão na triagem)
alter table public.chamados add column if not exists os_tipo text
  check (os_tipo in ('corretiva', 'preventiva', 'preditiva', 'inspecao', 'instalacao', 'melhoria'));
alter table public.chamados add column if not exists os_status text
  check (os_status in ('aberta', 'planejada', 'atribuida', 'em_execucao', 'aguardando_peca', 'aguardando_terceiro', 'em_validacao', 'concluida', 'encerrada'));
alter table public.chamados add column if not exists plano_id uuid;
alter table public.chamados add column if not exists supervisor text;

-- Planejamento
alter table public.chamados add column if not exists planejamento text;
alter table public.chamados add column if not exists ferramentas text;
alter table public.chamados add column if not exists previsao_horas numeric check (previsao_horas is null or previsao_horas > 0);
alter table public.chamados add column if not exists riscos text;

-- Execução (diagnostico/solucao já existiam; soma causa/causa_raiz)
alter table public.chamados add column if not exists causa text;
alter table public.chamados add column if not exists causa_raiz text;
alter table public.chamados add column if not exists data_inicio timestamptz;
alter table public.chamados add column if not exists data_fim timestamptz;
alter table public.chamados add column if not exists horimetro_ini numeric check (horimetro_ini is null or horimetro_ini >= 0);
alter table public.chamados add column if not exists horimetro_fim numeric check (horimetro_fim is null or horimetro_fim >= 0);
alter table public.chamados add column if not exists horimetro_unidade text
  check (horimetro_unidade in ('horas', 'km', 'ciclos', 'unidades'));

-- Custos diretos (materiais vêm de compras; terceiros de serviços)
alter table public.chamados add column if not exists custo_mao_obra numeric not null default 0 check (custo_mao_obra >= 0);
alter table public.chamados add column if not exists custo_outros numeric not null default 0 check (custo_outros >= 0);
alter table public.chamados add column if not exists custo_outros_desc text;

create index if not exists chamados_os_status_idx on public.chamados (organization_id, os_status);
create index if not exists chamados_plano_idx on public.chamados (plano_id);

-- ---------- 3. os_status_historico (append-only) ----------
create table if not exists public.os_status_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  os_id uuid not null references public.chamados (id) on delete cascade,
  de text,
  para text not null,
  motivo text,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists os_hist_os_idx on public.os_status_historico (os_id, created_at desc);

-- ---------- 4. os_atividades ----------
create table if not exists public.os_atividades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  descricao text not null check (char_length(descricao) between 1 and 500),
  user_id uuid references public.profiles (id) on delete set null,
  executado_por text,
  created_at timestamptz not null default now()
);
create index if not exists os_ativ_chamado_idx on public.os_atividades (chamado_id, created_at);

-- ---------- 5. os_servicos_externos ----------
create table if not exists public.os_servicos_externos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  fornecedor_id uuid references public.fornecedores (id) on delete set null,
  servico text not null check (char_length(servico) between 1 and 200),
  valor numeric not null check (valor >= 0),
  nota text,
  data_servico date,
  observacao text,
  created_at timestamptz not null default now()
);
create index if not exists os_serv_chamado_idx on public.os_servicos_externos (chamado_id);

-- ---------- 6. os_fotos (antes/durante/depois com metadados) ----------
create table if not exists public.os_fotos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  path text not null,
  categoria text not null default 'durante' check (categoria in ('antes', 'durante', 'depois')),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists os_fotos_chamado_idx on public.os_fotos (chamado_id, created_at);

-- ---------- 7. planos_manutencao (preventiva real, geração manual) ----------
create table if not exists public.planos_manutencao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ativo_id uuid not null references public.ativos (id) on delete cascade,
  tipo text not null check (tipo in ('corretiva', 'preventiva', 'preditiva', 'inspecao', 'instalacao', 'melhoria')),
  atividade text not null check (char_length(atividade) between 1 and 500),
  frequencia integer not null check (frequencia > 0),
  unidade text not null check (unidade in ('dias', 'semanas', 'meses', 'horas', 'ciclos')),
  responsavel text,
  checklist_modelo_id uuid references public.checklist_modelos (id) on delete set null,
  ultima_execucao date,
  proxima_execucao date,
  tolerancia_dias integer not null default 0 check (tolerancia_dias >= 0),
  prioridade text check (prioridade in ('baixa', 'media', 'alta', 'critica')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists planos_ativo_idx on public.planos_manutencao (ativo_id);
create index if not exists planos_proxima_idx on public.planos_manutencao (organization_id, proxima_execucao);

-- plano_id passa a referenciar planos (após criação das tabelas)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chamados_plano_fk') then
    alter table public.chamados add constraint chamados_plano_fk
      foreign key (plano_id) references public.planos_manutencao (id) on delete set null;
  end if;
end
$$;

-- ---------- 8. checklist: tipos + regras + snapshot ----------
alter table public.checklist_itens add column if not exists tipo text
  not null default 'ok_nok'
  check (tipo in ('ok_nok', 'sim_nao', 'texto', 'numero', 'selecao', 'data', 'hora', 'foto'));
alter table public.checklist_itens add column if not exists foto_obrigatoria boolean not null default false;
alter table public.checklist_itens add column if not exists obs_obrigatoria boolean not null default false;
alter table public.checklist_itens add column if not exists valor_esperado text;
alter table public.checklist_itens add column if not exists opcoes jsonb not null default '[]';

alter table public.checklist_respostas add column if not exists valor text;

alter table public.checklist_execucoes add column if not exists status text
  not null default 'em_andamento' check (status in ('em_andamento', 'concluida'));
alter table public.checklist_execucoes add column if not exists resultado text
  check (resultado in ('aprovado', 'reprovado', 'ressalvas'));
alter table public.checklist_execucoes add column if not exists user_id uuid
  references public.profiles (id) on delete set null;
-- Snapshot dos itens no início (histórico imutável mesmo se o modelo mudar)
alter table public.checklist_execucoes add column if not exists snapshot jsonb not null default '[]';

-- ---------- 9. RLS (leitura membros; escrita operacional AGT; planos AG) ----------
alter table public.os_status_historico enable row level security;
alter table public.os_atividades enable row level security;
alter table public.os_servicos_externos enable row level security;
alter table public.os_fotos enable row level security;
alter table public.planos_manutencao enable row level security;

grant select, insert on public.os_status_historico to authenticated;
grant select, insert, update, delete on public.os_atividades to authenticated;
grant select, insert, update, delete on public.os_servicos_externos to authenticated;
grant select, insert, update, delete on public.os_fotos to authenticated;
grant select, insert, update, delete on public.planos_manutencao to authenticated;

drop policy if exists "osh_select" on public.os_status_historico;
create policy "osh_select" on public.os_status_historico
  for select to authenticated
  using (public.eh_membro(public.os_status_historico.organization_id));
drop policy if exists "osh_insert" on public.os_status_historico;
create policy "osh_insert" on public.os_status_historico
  for insert to authenticated
  with check (
    public.eh_membro(public.os_status_historico.organization_id)
    and public.tem_papel(public.os_status_historico.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

drop policy if exists "osa_select" on public.os_atividades;
create policy "osa_select" on public.os_atividades
  for select to authenticated
  using (public.eh_membro(public.os_atividades.organization_id));
drop policy if exists "osa_write" on public.os_atividades;
create policy "osa_write" on public.os_atividades
  for all to authenticated
  using (
    public.eh_membro(public.os_atividades.organization_id)
    and public.tem_papel(public.os_atividades.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.os_atividades.organization_id)
    and public.tem_papel(public.os_atividades.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

drop policy if exists "oss_select" on public.os_servicos_externos;
create policy "oss_select" on public.os_servicos_externos
  for select to authenticated
  using (public.eh_membro(public.os_servicos_externos.organization_id));
drop policy if exists "oss_write" on public.os_servicos_externos;
create policy "oss_write" on public.os_servicos_externos
  for all to authenticated
  using (
    public.eh_membro(public.os_servicos_externos.organization_id)
    and public.tem_papel(public.os_servicos_externos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  )
  with check (
    public.eh_membro(public.os_servicos_externos.organization_id)
    and public.tem_papel(public.os_servicos_externos.organization_id, array['ADMIN', 'GESTOR', 'COMPRAS'])
  );

drop policy if exists "osf_select" on public.os_fotos;
create policy "osf_select" on public.os_fotos
  for select to authenticated
  using (public.eh_membro(public.os_fotos.organization_id));
drop policy if exists "osf_write" on public.os_fotos;
create policy "osf_write" on public.os_fotos
  for all to authenticated
  using (
    public.eh_membro(public.os_fotos.organization_id)
    and public.tem_papel(public.os_fotos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  )
  with check (
    public.eh_membro(public.os_fotos.organization_id)
    and public.tem_papel(public.os_fotos.organization_id, array['ADMIN', 'GESTOR', 'TECNICO'])
  );

drop policy if exists "plm_select" on public.planos_manutencao;
create policy "plm_select" on public.planos_manutencao
  for select to authenticated
  using (public.eh_membro(public.planos_manutencao.organization_id));
drop policy if exists "plm_write" on public.planos_manutencao;
create policy "plm_write" on public.planos_manutencao
  for all to authenticated
  using (
    public.eh_membro(public.planos_manutencao.organization_id)
    and public.tem_papel(public.planos_manutencao.organization_id, array['ADMIN', 'GESTOR'])
  )
  with check (
    public.eh_membro(public.planos_manutencao.organization_id)
    and public.tem_papel(public.planos_manutencao.organization_id, array['ADMIN', 'GESTOR'])
  );

-- ---------- 10. enforce_same_org: novas tabelas ----------
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
    -- Fornecedor do serviço na mesma org (gate §9: fornecedor B na O.S. A = NEGADO).
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
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_org_os_hist on public.os_status_historico;
create trigger trg_org_os_hist before insert or update on public.os_status_historico
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_os_ativ on public.os_atividades;
create trigger trg_org_os_ativ before insert or update on public.os_atividades
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_os_serv on public.os_servicos_externos;
create trigger trg_org_os_serv before insert or update on public.os_servicos_externos
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_os_fotos on public.os_fotos;
create trigger trg_org_os_fotos before insert or update on public.os_fotos
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_planos on public.planos_manutencao;
create trigger trg_org_planos before insert or update on public.planos_manutencao
  for each row execute function public.enforce_same_org();
drop trigger if exists trg_org_cke on public.checklist_execucoes;
create trigger trg_org_cke before insert or update on public.checklist_execucoes
  for each row execute function public.enforce_same_org();

-- ---------- 11. auditoria: ações da FASE 3 ----------
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
    'STOCK_ADJUSTMENT', 'MEMBERSHIP_CHANGE', 'ROLE_CHANGE', 'QR_REGENERATED',
    'TRIAGEM', 'OS_CREATED', 'OS_CONCLUIDA', 'CHECKLIST_CONCLUIDA', 'FOTO_ADICIONADA',
    'COST_ADDED', 'STOCK_CONSUMED'));
