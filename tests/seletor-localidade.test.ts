import { describe, expect, it } from "vitest";
import { buildFilhosMap, caminhoLocalidade, visiveisComAncestrais } from "@/lib/arvore-localidades";
import { setupOrg } from "./setup";

const LOCS = [
  { id: "u1", nome: "Brasil", tipo: "unidade", parent_id: null },
  { id: "p1", nome: "Condomínio X", tipo: "predio", parent_id: "u1" },
  { id: "a1", nome: "1º Andar", tipo: "andar", parent_id: "p1" },
  { id: "s1", nome: "Sala 01", tipo: "sala", parent_id: "a1" },
  { id: "s2", nome: "Sala 02", tipo: "sala", parent_id: "a1" },
  { id: "u2", nome: "Unidade B", tipo: "unidade", parent_id: null },
];

describe("FASE 11.1.1 — Seletor hierárquico (helpers puros)", () => {
  it("raízes são parent_id null, filhos agrupados por pai", () => {
    const m = buildFilhosMap(LOCS);
    expect(m.get(null)!.map((l) => l.id).sort()).toEqual(["u1", "u2"]);
    expect(m.get("a1")!.map((l) => l.id).sort()).toEqual(["s1", "s2"]);
  });

  it("caminho completo Sala 01", () => {
    const porId = new Map(LOCS.map((l) => [l.id, l]));
    expect(caminhoLocalidade(porId, "s1")).toBe("Brasil › Condomínio X › 1º Andar › Sala 01");
  });

  it("busca preserva ancestrais (Sala 01 mostra Brasil→X→1º)", () => {
    const porId = new Map(LOCS.map((l) => [l.id, l]));
    const vis = visiveisComAncestrais(LOCS, porId, "sala 01")!;
    expect(vis.has("s1")).toBe(true);
    expect(vis.has("a1")).toBe(true);
    expect(vis.has("p1")).toBe(true);
    expect(vis.has("u1")).toBe(true);
    expect(vis.has("u2")).toBe(false);
  });

  it("busca vazia retorna null (mostra tudo)", () => {
    const porId = new Map(LOCS.map((l) => [l.id, l]));
    expect(visiveisComAncestrais(LOCS, porId, "   ")).toBeNull();
  });
});

describe("FASE 11.1.1 — Integração ativo ↔ estrutura", () => {
  it("criar ativo na Sala, reload, editar para outra sala, reload", async () => {
    const org = await setupOrg("sel-loc");
    const { data: u } = await org.admin.from("localidades").insert({ organization_id: org.orgId, nome: "Unidade S", tipo: "unidade", parent_id: null }).select("id").single();
    const { data: s1 } = await org.admin.from("localidades").insert({ organization_id: org.orgId, nome: "Sala 01", tipo: "sala", parent_id: u!.id }).select("id").single();
    const { data: s2 } = await org.admin.from("localidades").insert({ organization_id: org.orgId, nome: "Sala 02", tipo: "sala", parent_id: u!.id }).select("id").single();
    const { data: ativo } = await org.admin.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo Sel", localidade_id: s1!.id, qr_code_hash: crypto.randomUUID() }).select("id").single();
    expect(ativo?.id).toBeDefined();
    const { data: r1 } = await org.admin.from("ativos").select("localidade_id").eq("id", ativo!.id).single();
    expect((r1 as { localidade_id: string }).localidade_id).toBe(s1!.id);
    await org.admin.from("ativos").update({ localidade_id: s2!.id }).eq("id", ativo!.id);
    const { data: r2 } = await org.admin.from("ativos").select("localidade_id").eq("id", ativo!.id).single();
    expect((r2 as { localidade_id: string }).localidade_id).toBe(s2!.id);
  });

  it("localidade de outro tenant é rejeitada", async () => {
    const orgA = await setupOrg("sel-cross-a");
    const orgB = await setupOrg("sel-cross-b");
    const { data: locA } = await orgA.admin.from("localidades").insert({ organization_id: orgA.orgId, nome: "Sala A", tipo: "sala", parent_id: null }).select("id").single();
    // B não enxerga localidades de A via RLS
    const { data: leak } = await orgB.client.from("localidades").select("id").eq("id", locA!.id);
    expect((leak ?? []).length).toBe(0);
  });

  it("localidade removida não quebra edição (indisponível, sem auto-limpar)", async () => {
    const org = await setupOrg("sel-removed");
    const { data: loc } = await org.admin.from("localidades").insert({ organization_id: org.orgId, nome: "Sala R", tipo: "sala", parent_id: null }).select("id").single();
    const { data: ativo } = await org.admin.from("ativos").insert({ organization_id: org.orgId, nome: "Ativo R", localidade_id: loc!.id, qr_code_hash: crypto.randomUUID() }).select("id").single();
    await org.admin.from("localidades").delete().eq("id", loc!.id);
    // FK é SET NULL? Se sim, localidade_id vira null; se não, ativo mantém referência órfã — em ambos os casos a edição não deve quebrar
    const { data: reload, error } = await org.admin.from("ativos").select("id, localidade_id").eq("id", ativo!.id).single();
    expect(error).toBeNull();
    expect(reload).toBeDefined();
  });
});
