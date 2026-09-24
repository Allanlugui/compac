# ARCHITECTURE.md — SGA-M (espelho operacional)

> Detalhe canônico: `ARCHITECTURE.md` (raiz) + `DATA_MODEL.md` + `MODULES.md` + `SECURITY.md`.
> Este espelho registra apenas o delta vivo. Criado na FASE 0 (2026-09-24).

## Baseline vigente (código @ `a1eac3c`)
App Router (RSC + Server Actions) → Supabase (Postgres + Auth + Storage + RLS). Tenant via `requireOrg()` (JWT). RLS dupla barreira + `enforce_same_org`. Ver raiz.

## Delta pós-2.0.1 (em branch, aplicado no live v23→v26)
- Cadastros mestres (`departamentos_setores`, `centros_custo`, `almoxarifados`) + `/admin/cadastros`.
- Estoque dual (saldo global + `almoxarifado_id`) + RPC 11 args opcionais.
- Overlay `permissoes_custom` (conceder/negar + escopo), aplicado em estoque/cadastros.
- QR compras relacional (`qr_contexto_id` + FKs na solicitação).

## Alvo V2 (não implementado)
Ver `REARQUITETURA-V2.md`: Intake Engine determinística + LLM opcional, portal `/acompanhar/[token]`, thread do ticket, pipeline de e-mail, `Configurações do Sistema`, mobile por contexto, menu 4 grupos sem mensagens/organograma/busca-rota.

## FASE A — fundação (branch `refactor/fundacao-arquitetura`, 2026-09-24)
- `existeNaJanela` (dedup NULL-safe) + `revalidatePath` nas ações do sino.
- `lib/email-pipeline.ts` (evento→template→provider→recibo) sobre SMTP existente; `email_logs` em DB fica p/ Fase B.
- `/admin/configuracoes` hub ADMIN (links reais) + item no sidebar; `/admin/usuarios` preservada e linkada (movimento conceitual); Cadastros linka Usuários.
- Sem tabelas novas, sem FASE B, sem remoção de módulos.
- **Gate final:** 216/216 (23 arquivos), tsc 0, lint 0+24, build 43 rotas, push Preview; E2E 15/15; commit autorizado e executado (sem merge/PR/deploy); FASE B bloqueada.
