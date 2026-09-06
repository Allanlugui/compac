# SGA-M — Auditoria de Segurança + Hardening

> Escopo: verificar se o implementado está seguro em **Supabase + Vercel (produção)**.
> Sem redesign, sem dark mode, sem features novas. QR legados preservados, dados preservados.
> Nenhum JWT, senha, service role ou cookie real neste arquivo (regra absoluta).

Legenda: `PASS` · `FAIL` · `BLOCKED` (requer produção) · `N/A`
`[CÓDIGO]` = evidência estática · `[LIVE-LOCAL]` = servidor local · `[LIVE-PROD]` = só em produção

**Correções aplicadas nesta etapa** (ver `git log`): open redirect no callback/login,
`criarChamado` por token (UUID do ativo fora do HTML), allowlist MIME (SVG vetado),
security headers, cookie `Secure` em prod, `notificar` sem override de org,
`marcarLida` escopada, sanitização da busca, gate de papel na auditoria,
`schema_v5 §3` (memberships ADMIN-only, trigger sem `elsif`, audit insert com
membership, checklist_respostas por papel).

---

## 1. Matriz de evidências

| # | Área | Teste | Esperado | Obtido | Status | Obs |
|---|------|-------|----------|--------|--------|-----|
| 1 | AUTH | `GET /admin/dashboard` sem sessão | redirect `/login` | `307 location: /login` `[LIVE-LOCAL]` | PASS | `src/proxy.ts:42` |
| 2 | AUTH | `GET /admin/*` sem sessão (ativos, compras) | redirect | mesma regra do proxy p/ todo `/admin/*` `[CÓDIGO]` | PASS | Sem render antes da sessão |
| 3 | AUTH | Logout invalida sessão | `signOut` + redirect | `src/app/login/actions.ts:25` `sair()` `[CÓDIGO]` | PASS | Reverificar em prod (§7) |
| 4 | AUTH | Recovery usa origem própria | sem URL externa | `redirectTo: origin/atualizar-senha` `[CÓDIGO]` | PASS | Depende das Redirect URLs (§7) |
| 5 | REDIRECT | `/auth/callback?next=https://evil.com` | cai no fallback | `destinoSeguro()` só aceita `/...` interno `[CÓDIGO]` | PASS | **Vuln. corrigida** `src/lib/redirect.ts` |
| 6 | REDIRECT | `/login?next=https://evil.com` | ignora externo | mesmo sanitizador no `LoginForm` `[CÓDIGO]` | PASS | **Vuln. corrigida** |
| 7 | SESSION | Cookie `sga_org` | httpOnly, SameSite, Secure prod | `src/lib/org.ts:112` + `secure` em prod `[CÓDIGO]` | PASS | **Corrigido** (faltava `Secure`) |
| 8 | SESSION | Cookie adulterado p/ outra org | REJEITADO | `requireOrg()` revalida membership+status a cada chamada `[CÓDIGO]` | PASS | Cookie é só UX; teste real §7 |
| 9 | TENANT | Actions aceitam `organization_id` do cliente? | nunca | grep: nenhuma action lê org do input; tudo via `requireOrg()` `[CÓDIGO]` | PASS | Exceção pública documentada (#13) |
| 10 | TENANT | `criarChamado` recebia `ativoId` (UUID) do cliente | resolver por token | agora input é `token` → `qr_code_hash` no servidor `[CÓDIGO]` | PASS | **Vuln. corrigida** `qr/[hash]/actions.ts` |
| 11 | RLS | `memb_write_admin` permitia GESTOR | só ADMIN | recriada ADMIN-only em `schema_v5 §3a` `[CÓDIGO]` | PASS* | *Requer re-run do `schema_v5` no Supabase |
| 12 | RLS | `enforce_same_org` com `elsif` (compra+fornecedor) | checar ambos | reescrita com IFs independentes `§3b` `[CÓDIGO]` | PASS* | *Idem acima |
| 13 | RLS | `audit_insert WITH CHECK (true)` (forja cross-org/NULL) | exige membership | `§3c` `[CÓDIGO]` | PASS* | *Idem acima; limpar linhas NULL legadas (§7) |
| 14 | RLS | `ckr_all` sem papel (SOLICITANTE forja resposta) | ADMIN/GESTOR/TECNICO | `§3d` `[CÓDIGO]` | PASS* | *Idem acima |
| 15 | RLS | Leitura anon de dados operacionais | negada | grants anon = só `INSERT` chamados/solicitações `[CÓDIGO]` | PASS | `schema_v4:372` |
| 16 | ROLES | Matriz Server Actions (24 usos `exigirPapel`) | papel por ação | usuarios=ADMIN; ativos/chamados/checklists=AGT; compras/fornec/estoque=AGC `[CÓDIGO]` | PASS | UI filtrada + servidor barra |
| 17 | ROLES | `/admin/auditoria` sem gate (qualquer membro via) | ADMIN/GESTOR/AUDITOR | gate adicionado `[CÓDIGO]` | PASS | **Endurecido** |
| 18 | ROLES | `notificar()` aceitava `orgId` do chamador | só sessão | parâmetro removido; 4 call sites atualizados `[CÓDIGO]` | PASS | **Vuln. corrigida** (action invocável pelo browser) |
| 19 | QR | `/qr/<hash-12chars>` existente | 200 + form mínimo | `select(nome, localizacao)` + `TicketForm` `[CÓDIGO]` | PASS | Sem rotação; teste HTTP em §7 |
| 20 | QR | Hash inexistente | 200 página amigável (sem vazar dados) | `QrPage` retorna "não encontrado" `[LIVE-LOCAL]` | PASS | Distingue existe/não-existe — aceito (70–140 bits) |
| 21 | QR-PRIVACY | QR expõe custos/compras/auditoria/estoque? | não exposto | página só tem nome/localização + form `[CÓDIGO]` | PASS | UUID do ativo removido do HTML (#10) |
| 22 | QR-ENUM | Novos tokens | CSPRNG ≥140 bits | `crypto.getRandomValues`, 24×58 `[CÓDIGO]` | PASS | `src/lib/tokens.ts` (viés `%58` desprezível) |
| 23 | QR-COMPRA | `/qr-compra/nova` sem token | sem lista de tenants | mensagem genérica + `resolverOrgToken` `[CÓDIGO]` | PASS | Org resolvida server-side |
| 24 | STORAGE | Upload QR: path do cliente? | sempre servidor | `o/{org}/chamados/{id}/{ts}-{rand}-{nome}` `[CÓDIGO]` | PASS | Traversal impossível (`/` vira `_`) |
| 25 | STORAGE | Upload aceitava `image/*` (SVG = XSS armazenado) | allowlist | JPG/PNG/WebP/GIF/HEIC/HEIF + 8 MB `[CÓDIGO]` | PASS | **Vuln. corrigida** `lib/storage.ts:38` |
| 26 | STORAGE | Leitura cross-org (`resolverFoto`) | prefixo validado | `orgIdEsperado` vs `o/{org}/` + signed URL 1h `[CÓDIGO]` | PASS | Legadas `chamados/` = risco residual aceito |
| 27 | SERVICE | `SUPABASE_SERVICE_ROLE_KEY` no client? | só server | imports só em arquivos server (`actions`, `storage`, `service`); bundle `.next/static` sem match `[CÓDIGO]` | PASS | Nenhum `NEXT_PUBLIC_*` novo |
| 28 | CACHE | Dashboard de A servido a B? | impossível | rotas admin `ƒ Dynamic` (cookies→dynamic); `Cache-Control: private, no-cache, no-store` `[LIVE-LOCAL]` | PASS | Sem `fetch` cacheado no código |
| 29 | HEADERS | Baseline sem quebrar app | 4 headers | `nosniff`, `Referrer`, `DENY`, `Permissions` verificados via `curl -I` `[LIVE-LOCAL]` | PASS | Sem CSP (incremental); HSTS = Vercel |
| 30 | INPUT | Busca global quebra `or()` / curinga ILIKE | sanitizada | strip `[%_,()"'\;]` + cap 60 `[CÓDIGO]` | PASS | **Endurecido** `busca.ts` |
| 31 | INPUT | Demais actions (ativos, OS, compras, estoque, usuários) | limites+enums+UUID | length checks, `PRIORIDADES`, regex data/UUID, `Math` bounds `[CÓDIGO]` | PASS | Mensagens genéricas, sem SQL/stack |
| 32 | SQL | `SECURITY DEFINER` | `search_path=public`, mín. | `eh_membro`/`tem_papel` só `SELECT exists` `[CÓDIGO]` | PASS | Sem SQL dinâmico/concat no repo |
| 33 | AUDIT | Eventos gravados com tenant | org em todo log | `organization_id+user_id` nos inserts app `[CÓDIGO]` | PASS | Leitura filtrada por org |
| 34 | LEAK | Secrets no repo/bundle | nenhum | grep `eyJ`/senhas: só hash de integridade no lock; `.env.local` ignorado (`.gitignore:34`); bundle sem match `[CÓDIGO]` | PASS | Rotacionar a senha de app colada no chat |
| 35 | DEPS | `npm audit` | 0 vulns | `0 vulnerabilities` (prod) `[LIVE-LOCAL]` | PASS | Next 16.3.4 / React 19 / Supabase 2.115 |
| 36 | BUILD | `lint + tsc + build` | 0 erros | `lint` 0 · `tsc` 0 · `build` 0 (23 rotas) `[LIVE-LOCAL]` | PASS | — |

## 2. BLOCKED — só com produção + 2 usuários reais

> Rodar com JWTs **só no terminal local** (nunca commitar). Registrar HTTP status + `[]`/`403`.

| # | Teste | Como |
|---|-------|------|
| B1 | Matriz cross-tenant (SELECT/INSERT/UPDATE/DELETE A↔B + trigger `enforce_same_org` com chamado+fornecedor de orgs distintas) | `teste_isolamento.md` (9 itens) |
| B2 | Role escalation ao vivo (TECNICO aprova compra / SOLICITANTE escreve estoque / COMPRAS altera role — via DevTools→action, não via botão) | DevTools + tabela esperado×obtido |
| B3 | Storage cross-org (`GET /storage/v1/object/...` da outra org sem signed URL → negado) | `curl` com JWT A vs objeto de B |
| B4 | QR legado HTTP 200 em prod + upload com foto + signed URL no detalhe | fluxo `/qr/<hash>` ponta a ponta |
| B5 | SMTP fim-a-fim (convite → e-mail → troca forçada) + recovery sem rate-limit | cadastrar usuário teste |
| B6 | Auth settings (Email ON, Site URL, 2 Redirect URLs, SMTP Supabase, SERVICE_ROLE na Vercel, redeploy sem cache) | checklist do runbook |
| B7 | Limpar `auditoria_logs` com `organization_id NULL` (legado v1/v2, hoje visível a todos autenticados) | `select count(*) ... where organization_id is null` → apagar após conferir |
| B8 | Login/logout/recovery sob sessão expirada + cookie `Secure` no Set-Cookie de prod | DevTools → Application → Cookies |

## 3. Riscos residuais aceitos (documentados, não simulados)

1. **Fotos legadas `chamados/...` são legíveis por qualquer autenticado** (compat, sem mover bytes; paths com UUID).
2. **Anon pode INSERT em `chamados`/`solicitacoes_compra` via REST direta** (RLS exige `ativo_id`/org válidos — UUIDs não-enumeráveis; app valida o resto).
3. **Rate limit de upload é em memória por instância** (serverless); login/recovery usam o limiter do Supabase.
4. **Membros da org podem forjar notificações internas** (sem impacto em dados; só confusão visual).
5. **Sem CSP** (headers baseline aplicados; CSP exigiria mapeo de inline do Next — follow-up).
6. **Sem realtime/e2e** (declarado anteriormente, fora do escopo desta etapa).

## 4. Para aplicar (dono, em ordem)

1. SQL Editor → rodar `schema_v5.sql` **inteiro** de novo (inclui `§3` hardening).
2. Vercel → redeploy **sem cache** (headers + callback + actions novas).
3. Executar B1–B8 e colar a tabela aqui → revisão final antes de uso comercial.
