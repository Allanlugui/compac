-- ============================================================
-- SGA-M · schema_v22.sql — FASE 9.6 Mensagens 1:1 (HOTFIX)
-- ------------------------------------------------------------
-- NÃO aplicar em produção nesta fase (local apenas). Idempotente.
-- Hotfix: RLS participants, 1:1 pair, last_read_at, updated_at
-- ============================================================

create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.conversa_participantes (
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversa_id, user_id)
);
-- 1:1 unicidade: par ordenado + hash
create table if not exists public.conversa_pares (
  conversa_id uuid primary key references public.conversas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  par_hash text not null,
  unique(organization_id, par_hash)
);
create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_membership_id uuid not null references public.memberships(id) on delete cascade,
  conteudo text not null check (char_length(conteudo) between 1 and 2000),
  created_at timestamptz default now()
);
create index if not exists conv_org_idx on public.conversas(organization_id);
create index if not exists part_conv_idx on public.conversa_participantes(conversa_id);
create index if not exists part_user_idx on public.conversa_participantes(user_id);
create index if not exists msg_conv_idx on public.mensagens(conversa_id, created_at);
create index if not exists pares_hash_idx on public.conversa_pares(par_hash);

-- Helper para evitar recursão RLS em conversa_participantes (SECURITY DEFINER)
create or replace function public.is_conversa_participant(p_conversa_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.conversa_participantes where conversa_id = p_conversa_id and user_id = auth.uid())
$$;

alter table public.conversas enable row level security;
alter table public.conversa_participantes enable row level security;
alter table public.conversa_pares enable row level security;
alter table public.mensagens enable row level security;

-- conversas: só participante pode SELECT
drop policy if exists conv_select on public.conversas;
create policy conv_select on public.conversas for select using (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = conversas.id and cp.user_id = auth.uid())
);
drop policy if exists conv_insert on public.conversas;
create policy conv_insert on public.conversas for insert with check (eh_membro(organization_id));
-- UPDATE updated_at: só participante
drop policy if exists conv_update on public.conversas;
create policy conv_update on public.conversas for update using (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = conversas.id and cp.user_id = auth.uid())
) with check (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = conversas.id and cp.user_id = auth.uid())
);

-- participantes: SELECT só da própria conversa (participante daquela conversa) — via helper SECURITY DEFINER para evitar recursão
drop policy if exists part_select on public.conversa_participantes;
create policy part_select on public.conversa_participantes for select using (
  eh_membro(organization_id) and public.is_conversa_participant(conversa_id)
);
-- INSERT: mesma org, membership ativo, participante autorizado (app cria ambos em transação com advisory lock)
drop policy if exists part_insert on public.conversa_participantes;
create policy part_insert on public.conversa_participantes for insert with check (
  eh_membro(organization_id) and exists (select 1 from public.memberships m where m.id = membership_id and m.organization_id = conversa_participantes.organization_id and m.status='ativo')
);
-- UPDATE last_read_at: só própria linha
drop policy if exists part_update on public.conversa_participantes;
create policy part_update on public.conversa_participantes for update using (
  eh_membro(organization_id) and user_id = auth.uid()
) with check (
  eh_membro(organization_id) and user_id = auth.uid()
);

-- pares: mesma lógica de conversas (participante)
alter table public.conversa_pares enable row level security;
drop policy if exists pares_select on public.conversa_pares;
create policy pares_select on public.conversa_pares for select using (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = conversa_pares.conversa_id and cp.user_id = auth.uid())
);
drop policy if exists pares_insert on public.conversa_pares;
create policy pares_insert on public.conversa_pares for insert with check (eh_membro(organization_id));

drop policy if exists msg_select on public.mensagens;
create policy msg_select on public.mensagens for select using (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = mensagens.conversa_id and cp.user_id = auth.uid())
);
drop policy if exists msg_insert on public.mensagens;
create policy msg_insert on public.mensagens for insert with check (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = mensagens.conversa_id and cp.user_id = auth.uid())
);

-- RPC transacional para 1:1 (advisory lock + pair unique)
create or replace function public.criar_ou_obter_conversa(p_destinatario membership_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my record;
  v_dest record;
  v_pair_hash text;
  v_conv_id uuid;
begin
  select * into v_my from public.memberships where user_id = auth.uid() and status='ativo' limit 1;
  if not found then raise exception 'Membership não encontrada'; end if;
  select * into v_dest from public.memberships where id = p_destinatario and status='ativo';
  if not found then raise exception 'Destinatário inválido'; end if;
  if v_my.organization_id != v_dest.organization_id then raise exception 'Cross-tenant bloqueado'; end if;
  if v_my.id = v_dest.id then raise exception 'Self conversation bloqueada'; end if;
  v_pair_hash := array_to_string(array(select unnest(array[v_my.id::text, v_dest.id::text]) order by 1), '|');
  -- advisory lock por par
  perform pg_advisory_xact_lock(hashtext(v_pair_hash));
  select conversa_id into v_conv_id from public.conversa_pares where organization_id = v_my.organization_id and par_hash = v_pair_hash;
  if found then return v_conv_id; end if;
  v_conv_id := gen_random_uuid();
  insert into public.conversas(id, organization_id) values (v_conv_id, v_my.organization_id);
  insert into public.conversa_pares(conversa_id, organization_id, par_hash) values (v_conv_id, v_my.organization_id, v_pair_hash);
  insert into public.conversa_participantes(conversa_id, user_id, organization_id, membership_id) values
    (v_conv_id, v_my.user_id, v_my.organization_id, v_my.id),
    (v_conv_id, v_dest.user_id, v_dest.organization_id, v_dest.id);
  return v_conv_id;
end;
$$;

-- RPC para last_read_at só próprio
create or replace function public.marcar_conversa_lida(p_conversa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_my record;
begin
  select * into v_my from public.memberships where user_id = auth.uid() and status='ativo' limit 1;
  update public.conversa_participantes set last_read_at = now() where conversa_id = p_conversa_id and user_id = auth.uid();
end;
$$;
