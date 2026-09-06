import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Ativo } from "@/lib/types";
import NovoAtivoForm from "./NovoAtivoForm";
import AtivosGrid from "./AtivosGrid";

export const metadata: Metadata = {
  title: "Ativos · SGA-M",
  description: "Cadastro de ativos e impressão de QR Codes.",
};

export default async function AdminAtivosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ativos")
    .select("id, nome, localizacao, qr_code_hash, created_at")
    .order("created_at", { ascending: false });

  const ativos = ((data ?? []) as Ativo[]).slice().sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

  // Origem pública usada nos QR Codes. Se NEXT_PUBLIC_SITE_URL não estiver
  // definida, o grid usa a origem atual do navegador como fallback.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">Ativos</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Cadastre equipamentos e locais para gerar os QR Codes de abertura de
          chamados.
        </p>
      </div>

      <NovoAtivoForm />
      <AtivosGrid ativos={ativos} siteUrl={siteUrl} />
    </div>
  );
}
