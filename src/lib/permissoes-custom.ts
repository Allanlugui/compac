import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "./types";
import { PERMISSOES, pode, type Permissao } from "./permissoes";
import type { EfeitoPermissao, EscopoPermissao, PermissaoCustom } from "./types";

export type { EfeitoPermissao, EscopoPermissao, PermissaoCustom };

/** Permissões que NÃO aceitam customização (só perfil). */
export const PERMISSOES_BLOQUEADAS: readonly string[] = ["usuarios.administrar"];

/**
 * Escopo suportado por permissão (BLOCO 3, schema_v25).
 * `global` = sem escopo; demais exigem escopo_id do tipo indicado.
 * O catálogo-fonte continua em `PERMISSOES` (permissoes.ts).
 */
function escopoSuportado(permissao: string): EscopoPermissao {
  if (permissao.startsWith("estoque.")) return "almoxarifado";
  if (permissao.startsWith("estrutura.")) return "localidade";
  return "global";
}

export type EscopoRef = { tipo: "localidade" | "almoxarifado"; id: string } | null;

export function escopoDaPermissao(permissao: string): EscopoPermissao {
  return escopoSuportado(permissao);
}

/** Todas as permissões customizáveis, agrupadas por módulo (para o editor). */
export function catalogoCustomizavel(): { modulo: string; permissoes: Permissao[] }[] {
  const grupos = new Map<string, Permissao[]>();
  for (const p of Object.keys(PERMISSOES) as Permissao[]) {
    if ((PERMISSOES_BLOQUEADAS as readonly string[]).includes(p)) continue;
    const modulo = p.split(".")[0];
    const lista = grupos.get(modulo) ?? [];
    lista.push(p);
    grupos.set(modulo, lista);
  }
  return [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([modulo, permissoes]) => ({ modulo, permissoes }));
}

type DbClient = SupabaseClient;

/**
 * Carrega as customizações do usuário na org.
 * Pré-v25 (tabela inexistente) → [] (comportamento legado, sem quebra).
 */
export async function carregarCustom(
  supabase: DbClient,
  orgId: string,
  userId: string,
): Promise<PermissaoCustom[]> {
  const { data, error } = await supabase
    .from("permissoes_custom")
    .select("id, organization_id, user_id, permissao, efeito, escopo_tipo, escopo_id, created_at")
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error || !data) return [];
  return data as unknown as PermissaoCustom[];
}

/**
 * Permissão efetiva = base do perfil + conceder − negar.
 * - `negar` global bloqueia em qualquer escopo;
 * - `negar` com escopo bloqueia naquele escopo;
 * - `conceder` global libera em qualquer escopo;
 * - `conceder` com escopo libera naquele escopo;
 * - sem customização, vale 100% a matriz do perfil.
 */
export function temPermissaoEfetiva(
  role: Role,
  customs: PermissaoCustom[],
  permissao: Permissao,
  escopo: EscopoRef = null,
): boolean {
  const linhas = customs.filter((c) => c.permissao === permissao);
  for (const l of linhas) {
    if (l.efeito !== "negar") continue;
    if (l.escopo_tipo === "global") return false;
    if (escopo && l.escopo_tipo === escopo.tipo && l.escopo_id === escopo.id) return false;
  }
  if (pode({ role }, permissao)) return true;
  for (const l of linhas) {
    if (l.efeito !== "conceder") continue;
    if (l.escopo_tipo === "global") return true;
    if (escopo && l.escopo_tipo === escopo.tipo && l.escopo_id === escopo.id) return true;
  }
  return false;
}

/**
 * NOTA DE ARQUITETURA: a barreira async (`exigirPermissaoEfetiva`,
 * que cria client servidor) vive em `./permissoes-custom-server`
 * para este módulo seguir importável por Client Components
 * (só tipos + lógica pura no bundle — nunca `next/headers`).
 */
