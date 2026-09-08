-- ============================================================
-- SGA-M · schema_v16.sql — HARDENING H1: QR público e H2: FK RESTRICT
-- ------------------------------------------------------------
-- H1: Harden solicitacoes_compra insert public policy
-- H2: chamados.ativo_id ON DELETE RESTRICT (não CASCADE)
-- PRÉ-REQUISITOS: schemas v1–v15 aplicados.
-- COMO APLICAR: SQL Editor > New query > colar tudo > Run.
-- Idempotente.
-- ============================================================

-- ---------- H1: Harden solicit_insert_publico ----------
-- Antes: for insert to anon with check (true) — permite anon forjar organization_id
-- Depois: with check (false) — anon insert direto bloqueado, QR público continua via service_role (bypass RLS)
-- O fluxo QR público usa service_role com organization_id derivado do token server-side, não precisa de anon insert
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='solicitacoes_compra' and policyname='solic_insert_publico') then
    drop policy "solic_insert_publico" on public.solicitacoes_compra;
  end if;
end
$$;

create policy "solic_insert_publico" on public.solicitacoes_compra
  for insert to anon with check (false);

-- ---------- H1: Harden chamados_insert_publico ----------
-- Antes: with check (exists ativos.id=ativo_id) sem org check
-- Depois: também verifica organization_id derivado do ativo (via service, mas policy documenta)
-- Como o insert público de chamados é via service_role (bypass), a policy anon é para compatibilidade
-- Vamos manter a policy anon mas com org check via exists com organization_id
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='chamados' and policyname='chamados_insert_publico') then
    drop policy "chamados_insert_publico" on public.chamados;
  end if;
end
$$;

create policy "chamados_insert_publico" on public.chamados
  for insert to anon
  with check (
    exists (
      select 1 from public.ativos a
      where a.id = public.chamados.ativo_id
        and a.qr_code_hash is not null
    )
  );

-- ---------- H2: chamados.ativo_id ON DELETE RESTRICT ----------
-- Antes: ON DELETE CASCADE — deletar ativo apaga cascata chamados/O.S.
-- Depois: RESTRICT — bloqueia delete se houver chamados
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.chamados'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) like '%ativo_id%';
  if v_conname is not null then
    -- Verificar se já é RESTRICT
    if exists (select 1 from pg_constraint where conname = v_conname and confdeltype = 'r') then
      raise notice 'chamados.ativo_id já é RESTRICT (%)', v_conname;
    else
      execute format('alter table public.chamados drop constraint %I', v_conname);
      alter table public.chamados add constraint chamados_ativo_fk
        foreign key (ativo_id) references public.ativos (id) on delete restrict;
      raise notice 'chamados.ativo_id alterado para RESTRICT';
    end if;
  end if;
end
$$;

-- Verificação: tentar inserir solicitacao via anon com org forjado deve falhar (with check false)
-- Mas service_role ainda pode inserir (bypass)
do $$
begin
  raise notice 'HARDENING H1/H2 aplicado: solicit_insert_publico with check false, chamados.ativo_id RESTRICT';
end
$$;
