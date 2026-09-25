import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntradaIntake, TipoEntrada } from "./types";

/**
 * BLOCO 3 — Resolução server-side do contexto de entrada.
 * Reutiliza os tokens já existentes (sem tabela nova, sem mecanismo paralelo):
 *   a) `ativos.qr_code_hash` → manutenção com ativo (+ localidade do ativo);
 *   b) `qr_contextos.token` → manutenção com vínculos (localidade/depto/CC/almox);
 *   c) `organizations.entry_token` → manutenção universal;
 *   d) `qr_contextos.token` → compra (mesma tabela, fluxo distinto pelo path).
 * Tenant e entidade derivam da LINHA encontrada — nunca do cliente.
 * Módulo client-safe (só tipos): o DB entra por parâmetro.
 */

export type TipoAtendimento = "a" | "l" | "u" | "c";

export type ErroContexto = "ref-invalida" | "nao-encontrado" | "inativo";

export type ResultadoContexto =
  | { ok: true; entrada: EntradaIntake; rotuloOrigem: string }
  | { ok: false; error: ErroContexto };

type Db = SupabaseClient;

function refOk(ref: string): boolean {
  return typeof ref === "string" && ref.trim().length >= 8 && ref.trim().length <= 120;
}

export async function resolverEntrada(
  db: Db,
  kind: TipoAtendimento,
  ref: string,
): Promise<ResultadoContexto> {
  const token = (ref ?? "").trim();
  if (!refOk(token)) return { ok: false, error: "ref-invalida" };

  if (kind === "a") {
    const { data } = await db
      .from("ativos")
      .select("id, organization_id, nome, localidade_id")
      .eq("qr_code_hash", token)
      .maybeSingle();
    const a = data as unknown as {
      id: string; organization_id: string; nome: string; localidade_id: string | null;
    } | null;
    if (!a?.organization_id) return { ok: false, error: "nao-encontrado" };
    return {
      ok: true,
      rotuloOrigem: a.nome,
      entrada: {
        organizacaoId: a.organization_id,
        tipo: "manutencao" satisfies TipoEntrada,
        ativoId: a.id,
        localidadeId: a.localidade_id,
        rotulos: { ativoNome: a.nome },
      },
    };
  }

  if (kind === "l" || kind === "c") {
    const { data } = await db
      .from("qr_contextos")
      .select("id, organization_id, nome, ativo, localidade_id, departamento_id, centro_custo_id, almoxarifado_id")
      .eq("token", token)
      .eq("ativo", true)
      .maybeSingle();
    const c = data as unknown as {
      id: string; organization_id: string; nome: string;
      localidade_id: string | null; departamento_id: string | null;
      centro_custo_id: string | null; almoxarifado_id: string | null;
    } | null;
    if (!c?.organization_id) return { ok: false, error: "nao-encontrado" };
    return {
      ok: true,
      rotuloOrigem: c.nome,
      entrada: {
        organizacaoId: c.organization_id,
        tipo: (kind === "c" ? "compra" : "manutencao") satisfies TipoEntrada,
        localidadeId: c.localidade_id,
        departamentoId: c.departamento_id,
        centroCustoId: c.centro_custo_id,
        almoxarifadoId: c.almoxarifado_id,
        qrContextoId: c.id,
      },
    };
  }

  // kind === "u": link universal pela entry_token da org.
  const { data } = await db
    .from("organizations")
    .select("id, nome")
    .eq("entry_token", token)
    .maybeSingle();
  const o = data as unknown as { id: string; nome: string } | null;
  if (!o?.id) return { ok: false, error: "nao-encontrado" };
  return {
    ok: true,
    rotuloOrigem: o.nome,
    entrada: { organizacaoId: o.id, tipo: "manutencao" satisfies TipoEntrada },
  };
}
