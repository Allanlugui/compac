# SGA-M — Protocolo de Teste Real de Isolamento Multi-Tenant

> REGRAS: nunca salvar JWT em arquivos, nunca commitar tokens, nunca colar
> tokens neste documento. JWTs vivem SÓ no terminal local durante o teste.
> Aqui se registra apenas: HTTP status + evidência resumida (ex.: `[]`, `403`).

## 0. Pré-requisitos

- [ ] `schema_v4.sql` aplicado no SQL Editor (sem erros)
- [ ] Auth Email habilitado; `SUPABASE_SERVICE_ROLE_KEY` na Vercel (server-only)
- [ ] Variáveis: `URL` = `NEXT_PUBLIC_SUPABASE_URL`

## 1. Preparação (SQL Editor, como dono)

```sql
-- 1a. Criar 2 usuários pelo Dashboard Auth (Authentication > Users > Add user),
--     com e-mails reais de teste (ex.: a@teste.com, b@teste.com).
-- 1b. Descobrir os ids:
select id, email from auth.users where email in ('A@teste.com', 'B@teste.com');
-- 1c. Criar orgs + memberships (substitua os UUIDs):
insert into public.organizations (nome, slug) values
  ('Empresa A', 'empresa-a'), ('Empresa B', 'empresa-b');
insert into public.memberships (organization_id, user_id, role)
values
  ((select id from public.organizations where slug='empresa-a'), '<UUID_A>', 'ADMIN'),
  ((select id from public.organizations where slug='empresa-b'), '<UUID_B>', 'GESTOR');
-- 1d. Semente: 1 ativo em cada org (via app logado ou SQL com organization_id).
```

## 2. Captura local dos JWTs (terminal local, NÃO salvar em arquivo)

```bash
# Login via API e export SOMENTE na sessão do shell:
export JWT_A=$(curl -s "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"A@teste.com","password":"..."}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).access_token))")
# Repetir para JWT_B. Ao final: unset JWT_A JWT_B
```

## 3. Bateria (executar com JWT_A e depois com JWT_B)

| # | Comando (curl) | Esperado A | Esperado B | Obtido |
|---|---|---|---|---|
| 1 | `GET /rest/v1/ativos?select=id,organization_id` | só org A | só org B | |
| 2 | `GET /rest/v1/ativos?id=eq.<ID_ATIVO_B>` (com JWT_A) | `[]` | — | |
| 3 | `POST /rest/v1/chamados` com `organization_id` de B (JWT_A) | 403/RLS | — | |
| 4 | `PATCH /rest/v1/ativos?id=eq.<ID_B>` (JWT_A) | 0 linhas | — | |
| 5 | `DELETE /rest/v1/compras?id=eq.<ID_B>` (JWT_A) | 0 linhas/403 | — | |
| 6 | `GET /rest/v1/auditoria_logs?select=id` (JWT_A) | só org A | — | |
| 7 | Storage: `GET` objeto `o/<ORG_B>/...` sem signed URL | 403/404 | — | |
| 8 | UI: cookie `sga_org` adulterado p/ outra org | redirect /selecionar-org | — | |
| 9 | UI: TECNICO chama aprovar compra (DevTools → action) | erro "Sem permissão" | — | |

## 4. Critério

Multi-tenancy validado se TODAS as linhas 1–9 baterem com o esperado
nos dois sentidos (A↛B e B↛A). Qualquer divergência = bloqueador.
