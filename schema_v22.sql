-- ============================================================
-- SGA-M · schema_v22.sql — FASE 9.6 Mensagens 1:1
-- ------------------------------------------------------------
-- NÃO aplicar em produção nesta fase (local apenas). Idempotente.
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
create index if not exists msg_conv_idx on public.mensagens(conversa_id, created_at);

alter table public.conversas enable row level security;
alter table public.conversa_participantes enable row level security;
alter table public.mensagens enable row level security;

drop policy if exists conv_select on public.conversas;
create policy conv_select on public.conversas for select using (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = conversas.id and cp.user_id = auth.uid())
);
drop policy if exists conv_insert on public.conversas;
create policy conv_insert on public.conversas for insert with check (eh_membro(organization_id));

drop policy if exists part_select on public.conversa_participantes;
create policy part_select on public.conversa_participantes for select using (eh_membro(organization_id) and user_id = auth.uid());
drop policy if exists part_insert on public.conversa_participantes;
create policy part_insert on public.conversa_participantes for insert with check (eh_membro(organization_id));

drop policy if exists msg_select on public.mensagens;
create policy msg_select on public.mensagens for select using (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = mensagens.conversa_id and cp.user_id = auth.uid())
);
drop policy if exists msg_insert on public.mensagens;
create policy msg_insert on public.mensagens for insert with check (
  eh_membro(organization_id) and exists (select 1 from public.conversa_participantes cp where cp.conversa_id = mensagens.conversa_id and cp.user_id = auth.uid())
);
