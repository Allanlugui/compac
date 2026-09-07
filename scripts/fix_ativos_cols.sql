-- ============================================================
-- SGA-M · fix_ativos_cols.sql — adiciona colunas faltantes em ativos
-- ------------------------------------------------------------
-- Apos aplicar v8-v15, varias colunas historicas nao foram
-- criadas (porque o v1 schema so tem o basico). Este fix
-- adiciona as colunas que o codigo do app + o codigo de teste
-- assumem existir.
-- ============================================================

-- Colunas historicas do v2-v8 que faltam em ativos
alter table public.ativos add column if not exists tipo text
  check (tipo in ('equipamento', 'veiculo', 'imovel', 'infraestrutura', 'outro'));
alter table public.ativos add column if not exists marca text;
alter table public.ativos add column if not exists modelo text;
alter table public.ativos add column if not exists ano_fabricacao integer;
alter table public.ativos add column if not exists numero_patrimonio text;
alter table public.ativos add column if not exists numero_serie text;
alter table public.ativos add column if not exists data_aquisicao date;
alter table public.ativos add column if not exists valor_aquisicao numeric;
alter table public.ativos add column if not exists vida_util_meses integer;
alter table public.ativos add column if not exists estado_conservacao text
  check (estado_conservacao in ('otimo', 'bom', 'regular', 'ruim', 'pessimo'));
alter table public.ativos add column if not exists criticidade text
  check (criticidade in ('baixa', 'media', 'alta', 'critica'));
alter table public.ativos add column if not exists responsavel text;
alter table public.ativos add column if not exists qr_code text;
alter table public.ativos add column if not exists qr_hash text unique;
alter table public.ativos add column if not exists qr_ativo boolean not null default true;
alter table public.ativos add column if not exists qr_impresso_em timestamptz;
alter table public.ativos add column if not exists descricao text;
alter table public.ativos add column if not exists horimetro numeric;
alter table public.ativos add column if not exists horimetro_unidade text
  check (horimetro_unidade in ('horas', 'km', 'ciclos', 'unidades'));

create index if not exists ativos_qr_hash_idx on public.ativos (qr_hash) where qr_hash is not null;
create index if not exists ativos_tipo_idx on public.ativos (organization_id, tipo);
