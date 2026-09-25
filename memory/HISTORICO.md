# HISTORICO.md — SGA-M (COMPAC)

> Log cronológico preservador. Criado na FASE 0 (2026-09-24) a partir de git + memória + docs. Nunca apagar entradas.

- **2026-09-1x → 11 — FASE FINAL → Release 2.0.1:** 135→202 testes, hardening H1–H6, tag `v2.0.1` (`cdf6aac`), produção congelada. Ver `PROJECT_STATUS.md`, `QA_FINAL.md`.
- **2026-09-17 (branch `fix/os-foto-antes-bug`) — FASE 11.2:** Server async em Client congelava O.S.; fix Client síncrono + URLs no pai; 7/7 PASS (`fbbad15`).
- **2026-09-17 — `memory/` criada:** STATUS/TODO/DECISOES/PROBLEMAS a partir do código + regras `F:/dev/memory/` (`bf9dec8`, push origin).
- **2026-09-17 — BLOCO 1:** `departamentos_setores` + `centros_custo` (v23) + `/admin/cadastros` (gates PASS).
- **2026-09-17 — BLOCO 2:** `almoxarifados` + estoque dual + RPC 11 args (v24) + shim PGRST202 (gates PASS).
- **2026-09-17 — BLOCO 3:** `permissoes_custom` overlay + editor em usuários (v25) + split client-safe/server (gates PASS).
- **2026-09-17 — BLOCO 4:** QR compras relacional + rastreabilidade na solicitação (v26) (gates PASS).
- **2026-09-17 — Blocos 1–4 commitados (`a1eac3c`) + push origin.**
- **2026-09-17 — Migrations v23→v26 aplicadas no live + probe confirma** (4 tabelas, 6 colunas, RPC 11 args).
- **2026-09-21 — Reconciliação 209/209** (21 suítes em 4 blocos) + rede de memória global sga-m (SUBCONSCIENTE).
- **2026-09-24 — FASE 0 RESET ARQUITETURAL (`D-RESET-CLIENTE-01`):** roadmap anterior suspenso; feedback do cliente = nova fonte de verdade; `REARQUITETURA-V2.md` produzido; NENHUM código alterado.
- **2026-09-24 — FASE A FUNDAÇÃO (`D-FASEA-01/02`, branch `refactor/fundacao-arquitetura` de `a1eac3c`):** ETAPA 1 achou `origin/master=efa6df6` (FASE 11.2 mergeada); dedup broadcast corrigido + 4/4; pipeline e-mail + convite migrado + 3/3; hub `/admin/configuracoes`; auditoria visibilidade/escopo; link Cadastros>Usuários; sem FASE B, sem tabelas novas.
- **2026-09-24 — FASE A GATE FINAL:** suíte 216/216 + gates + push `refactor/fundacao-arquitetura` (Preview); ancestry documentada (divergência real vs `origin/master`, sem alteração de histórico); commit oficial BLOQUEADO até validação manual do Preview.
- **2026-09-24 — FASE A E2E + COMMIT (autorização explícita):** E2E Playwright 15/15 (screenshots lidos, banco limpo, dev parado); commit `feat(FASE A): ...` + push origin; sem merge/PR/deploy; FASE B bloqueada.
- **2026-09-24 — FASE 1 BLOCO 1 (`refactor/sgam-rearquitetura-cliente` de `a9cb2bc`, `D-RESET-CLIENTE-02`):** navegação 4 grupos + hub 8 destinos + back-link perfil; gates (tsc 0, lint 0+24, build); E2E 17/17 com screenshots; banco limpo; PARADO p/ validação, sem commit.
- **2026-09-24 — FASE 1 BLOCO 2 (Intake Engine):** `src/lib/intake/` puro (slots contextuais, engine, mapeamentos) + 7/7; bug de contrato pego por teste e corrigido; auditoria de reuso registrada; gates PASS; PARADO p/ validação, sem BLOCO 3, sem commit.