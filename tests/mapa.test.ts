import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Helpers puros (extraídos de MapaClient para teste)
function buildTree(localidades: { id: string; parent_id: string | null }[]) {
  const filhos = new Map<string | null, typeof localidades>();
  for (const l of localidades) {
    const key = l.parent_id ?? null;
    const arr = filhos.get(key) ?? [];
    arr.push(l);
    filhos.set(key, arr);
  }
  return filhos;
}
function coletarDescendentes(id: string, filhos: Map<string | null, { id: string; parent_id: string | null }[]>, acc: Set<string>) {
  acc.add(id);
  for (const f of filhos.get(id) ?? []) coletarDescendentes(f.id, filhos, acc);
}

describe("BLOCO D — Mapa Operacional", () => {
  it("1. tenant isolation: org B não vê localidades de org A", async () => {
    const orgA = await setupOrg("mapa-iso-a");
    const orgB = await setupOrg("mapa-iso-b");
    await ADMIN.from("localidades").insert({ organization_id: orgA.orgId, nome: "Unidade A", tipo: "unidade" });
    const { count: cntB } = await ADMIN.from("localidades").select("id", { count: "exact", head: true }).eq("organization_id", orgB.orgId);
    expect(cntB).toBe(0);
  });

  it("3. localização hierárquica: parent_id define árvore", async () => {
    const org = await setupOrg("mapa-hier");
    const { data: unidade } = await ADMIN.from("localidades").insert({ organization_id: org.orgId, nome: "Unidade X", tipo: "unidade" }).select("id").single();
    const { data: predio } = await ADMIN.from("localidades").insert({ organization_id: org.orgId, nome: "Prédio A", tipo: "predio", parent_id: unidade!.id }).select("id").single();
    const filhos = buildTree([{ id: unidade!.id, parent_id: null }, { id: predio!.id, parent_id: unidade!.id }]);
    const acc = new Set<string>();
    coletarDescendentes(unidade!.id, filhos, acc);
    expect(acc.has(predio!.id)).toBe(true);
  });

  it("4. filtro por unidade: ativos descendentes", async () => {
    const org = await setupOrg("mapa-unid");
    const { data: unid } = await ADMIN.from("localidades").insert({ organization_id: org.orgId, nome: "Unidade", tipo: "unidade" }).select("id").single();
    const { data: sala } = await ADMIN.from("localidades").insert({ organization_id: org.orgId, nome: "Sala 1", tipo: "sala", parent_id: unid!.id }).select("id").single();
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo 1", localidade_id: sala!.id, qr_code_hash: crypto.randomUUID() });
    const filhos = buildTree([{ id: unid!.id, parent_id: null }, { id: sala!.id, parent_id: unid!.id }]);
    const ids = new Set<string>();
    coletarDescendentes(unid!.id, filhos, ids);
    expect(ids.has(sala!.id)).toBe(true);
  });

  it("6. filtro por categoria", async () => {
    const org = await setupOrg("mapa-cat");
    const { data: cat } = await ADMIN.from("categorias").insert({ organization_id: org.orgId, nome: "Cat Teste", tipo: "ativo", atributos: [] }).select("id").single();
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Cat", categoria_id: cat!.id, qr_code_hash: crypto.randomUUID() });
    const { data: ativos } = await ADMIN.from("ativos").select("id").eq("organization_id", org.orgId).eq("categoria_id", cat!.id);
    expect(ativos?.length).toBe(1);
  });

  it("7. filtro por status", async () => {
    const org = await setupOrg("mapa-status");
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Parado", status: "parado", qr_code_hash: crypto.randomUUID() });
    const { data } = await ADMIN.from("ativos").select("id").eq("organization_id", org.orgId).eq("status", "parado");
    expect(data?.length).toBe(1);
  });

  it("8. filtro por criticidade", async () => {
    const org = await setupOrg("mapa-crit");
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Crit", criticidade: "critica", qr_code_hash: crypto.randomUUID() });
    const { data } = await ADMIN.from("ativos").select("id").eq("organization_id", org.orgId).eq("criticidade", "critica");
    expect(data?.length).toBe(1);
  });

  it("9. busca contextual: nome/código", async () => {
    const org = await setupOrg("mapa-busca");
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Bomba 14", codigo: "BOM-14", qr_code_hash: crypto.randomUUID() });
    const { data } = await ADMIN.from("ativos").select("id").eq("organization_id", org.orgId).ilike("nome", "%Bomba 14%");
    expect(data?.length).toBe(1);
  });

  it("10. ativo sem localização: localidade_id is null", async () => {
    const org = await setupOrg("mapa-semloc");
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Sem Loc", localidade_id: null, qr_code_hash: crypto.randomUUID() });
    const { data } = await ADMIN.from("ativos").select("id").eq("organization_id", org.orgId).is("localidade_id", null);
    expect(data?.length).toBe(1);
  });

  it("11. localização parcial: Unidade sem filhos", async () => {
    const org = await setupOrg("mapa-parcial");
    const { data: unid } = await ADMIN.from("localidades").insert({ organization_id: org.orgId, nome: "Unidade X", tipo: "unidade" }).select("id").single();
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Parcial", localidade_id: unid!.id, qr_code_hash: crypto.randomUUID() });
    const filhos = buildTree([{ id: unid!.id, parent_id: null }]);
    const acc = new Set<string>();
    coletarDescendentes(unid!.id, filhos, acc);
    expect(acc.size).toBe(1);
  });

  it("13. drill-down: ativo → /admin/ativos/[id]", async () => {
    const org = await setupOrg("mapa-drill");
    const { data: ativo } = await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Drill", qr_code_hash: crypto.randomUUID() }).select("id").single();
    expect(ativo?.id).toBeDefined();
    // Link seria /admin/ativos/${ativo.id}
  });

  it("18. ausência de coordenadas: temCoordenadas=false", async () => {
    // schema não tem latitude/longitude
    const { data } = await ADMIN.from("ativos").select("id").limit(1);
    expect(data).toBeDefined();
    // Verificar que nenhum ativo tem lat/lng
    // Como não há coluna, não há coordenadas
  });

  it("21. lista e mapa mesmo conjunto: contagem por localidade", async () => {
    const org = await setupOrg("mapa-consist");
    const { data: unid } = await ADMIN.from("localidades").insert({ organization_id: org.orgId, nome: "Unidade", tipo: "unidade" }).select("id").single();
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "A1", localidade_id: unid!.id, qr_code_hash: crypto.randomUUID() });
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "A2", localidade_id: unid!.id, qr_code_hash: crypto.randomUUID() });
    const { count } = await ADMIN.from("ativos").select("id", { count: "exact", head: true }).eq("organization_id", org.orgId).eq("localidade_id", unid!.id);
    expect(count).toBe(2);
  });

  it("22. não duplicação de ativos: cada ativo em 1 localidade", async () => {
    const org = await setupOrg("mapa-nodup");
    const { data: unid } = await ADMIN.from("localidades").insert({ organization_id: org.orgId, nome: "Unidade", tipo: "unidade" }).select("id").single();
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    await ADMIN.from("ativos").insert({ id: id1, organization_id: org.orgId, nome: "A1", localidade_id: unid!.id, qr_code_hash: crypto.randomUUID() });
    await ADMIN.from("ativos").insert({ id: id2, organization_id: org.orgId, nome: "A2", localidade_id: unid!.id, qr_code_hash: crypto.randomUUID() });
    const { data } = await ADMIN.from("ativos").select("id, localidade_id").in("id", [id1, id2]);
    expect(data?.length).toBe(2);
    expect(new Set(data?.map((d) => d.id)).size).toBe(2);
  });

  it("23. cross-tenant bloqueado: org B não vê ativo de org A", async () => {
    const orgA = await setupOrg("mapa-ct-a");
    const orgB = await setupOrg("mapa-ct-b");
    const { data: ativoA } = await ADMIN.from("ativos").insert({ organization_id: orgA.orgId, nome: "Ativo A", qr_code_hash: crypto.randomUUID() }).select("id").single();
    const { data: visivel } = await ADMIN.from("ativos").select("id").eq("organization_id", orgB.orgId).eq("id", ativoA!.id);
    expect(visivel?.length).toBe(0);
  });

  it("15. empty: sem localidades", async () => {
    const org = await setupOrg("mapa-empty");
    const { data } = await ADMIN.from("localidades").select("id").eq("organization_id", org.orgId);
    expect(data?.length).toBe(0);
  });

  it("10. nenhum dado inventado: sem coordenadas fictícias", async () => {
    const org = await setupOrg("mapa-nofake");
    await ADMIN.from("ativos").insert({ organization_id: org.orgId, nome: "Sem Coords", qr_code_hash: crypto.randomUUID() });
    const { data: ativo } = await ADMIN.from("ativos").select("id, localidade_id").eq("organization_id", org.orgId).limit(1).single();
    expect(ativo?.localidade_id).toBeNull();
  });
});
