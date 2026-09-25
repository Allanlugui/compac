# DESIGN-UX.md — SGA-M

> Inventário + alvo. Criado na FASE 0 (2026-09-24). Padrões vivos: Tailwind + `PageHeader`/`StatCard`/`EmptyState`/`StatusBadge`, Server async + ilhas Client, forms mobile 44px, Ctrl+K 300ms, CSV BOM + print.

## Atual (verificado no código)
- Desktop admin: sidebar fixa (seções) + BottomNav 6 itens (Painel, Chamados, Ativos, Estoque, Solicit., Mapa) + sino + BuscaGlobal.
- Público: qr ativo (verde? App Router pages), qr-compra emerald 1 coluna, tracking por hash.
- Acessibilidade base: labels, foco, min-h 44px. Sem design system formal de tokens.

## Alvo V2 (não implementado)
- Menu 4 grupos compactos (BLOCO 1 FEITO, pendente validação); Cadastros com subníveis (Usuários dentro); Configurações por seções com "testar" (ex.: e-mail teste).
- Portal `/acompanhar/[token]`: 1 coluna, timeline, thread, anexos.
- Chat `/atendimento`: bolhas, progresso, foto, confirmação, QR acompanhamento.
- Mobile `/m/tecnico`, `/m/almox`: bottom nav 4 itens, tarefa-única, alternância de modo.

## BLOCO 3 — chat implementado (NÃO é referência final do redesign)
- Uma pergunta por vez + transcript + resumo + voltar + chips de opção; header com origem; mobile-first 1 coluna.
- E2E 10/10 com screenshots lidos; sem IA, sem mock. Redesign global pendente (diretriz vigente).

## BLOCO 3.6 — fundação aplicada (não é referência final do redesign)
- Primitivos: `tokens`, `Button`, `Card`, `Badge`, `Field`, `Loading`, `ErrorState` (+ `StatCard`, `PageHeader`, `EmptyState` canônicos).
- Dashboard usa `Card`; Configurações em grupos por responsabilidade com ação secundária única.
- E2E 8/8 com screenshots (desktop + 390px sem overflow). Redesign global pendente.
