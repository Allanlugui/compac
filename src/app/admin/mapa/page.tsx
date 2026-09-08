import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import PageHeader from "@/components/ui/PageHeader";
import MapaClient from "./MapaClient";
import type { Localidade } from "@/lib/types";

export const metadata: Metadata = { title: "Mapa Operacional · SGA-M" };

export default async function MapaPage() {
  const supabase = await createClient();
  const ctx = await requireOrg();

  const [{ data: locs }, { data: ativos }, { data: chamados }, { data: cats }] = await Promise.all([
    supabase
      .from("localidades")
      .select("id, organization_id, nome, tipo, parent_id, created_at")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true }),
    supabase
      .from("ativos")
      .select("id, organization_id, nome, codigo, status, criticidade, categoria_id, localidade_id, created_at")
      .eq("organization_id", ctx.orgId)
      .order("nome", { ascending: true })
      .limit(1000),
    supabase
      .from("chamados")
      .select("id, ativo_id, os_status, status")
      .eq("organization_id", ctx.orgId)
      .not("ativo_id", "is", null)
      .limit(1000),
    supabase
      .from("categorias")
      .select("id, nome")
      .eq("organization_id", ctx.orgId)
      .eq("tipo", "ativo")
      .eq("ativa", true)
      .order("nome"),
  ]);

  const localidades = (locs ?? []) as Localidade[];
  const ativosData = (ativos ?? []) as {
    id: string;
    organization_id: string;
    nome: string;
    codigo: string | null;
    status: string;
    criticidade: string | null;
    categoria_id: string | null;
    localidade_id: string | null;
    created_at: string;
  }[];
  const chamadosData = (chamados ?? []) as { id: string; ativo_id: string; os_status: string | null; status: string }[];
  const categorias = (cats ?? []) as { id: string; nome: string }[];

  // Verificar se há dados geográficos (latitude/longitude)
  const temCoordenadas = false; // schema atual não possui latitude/longitude

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Mapa Operacional"
        descricao={`${ctx.orgNome} · ${localidades.length} localidades · ${ativosData.length} ativos · localização → ativo → operação`}
      />
      <MapaClient
        localidades={localidades}
        ativos={ativosData}
        chamados={chamadosData}
        categorias={categorias}
        temCoordenadas={temCoordenadas}
      />
    </div>
  );
}
