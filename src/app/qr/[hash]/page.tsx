import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import type { Ativo } from "@/lib/types";
import TicketForm from "./TicketForm";

export const metadata: Metadata = {
  title: "Abrir chamado · SGA-M",
  description: "Abertura de chamado de manutenção via QR Code.",
};

interface QrPageProps {
  // Next.js 16: `params` é assíncrono e deve receber `await`.
  params: Promise<{ hash: string }>;
}

export default async function QrPage({ params }: QrPageProps) {
  const { hash } = await params;
  // Lookup pública por token: service-side, colunas mínimas (escopo mínimo).
  // Hashes legados de 12 chars seguem válidos (compatibilidade).
  const svc = createServiceClient();

  const { data } = await svc
    .from("ativos")
    .select("nome, localizacao")
    .eq("qr_code_hash", hash)
    .maybeSingle();

  const ativo = (data ?? null) as Pick<
    Ativo,
    "nome" | "localizacao"
  > | null;

  // ---------- Ativo não encontrado ----------
  if (!ativo) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <SearchX className="mx-auto size-12 text-zinc-400" />
          <h1 className="mt-3 text-lg font-bold text-zinc-900">
            Ativo não encontrado
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Este QR Code não corresponde a nenhum ativo cadastrado. Verifique a
            etiqueta ou fale com a administração.
          </p>
        </section>
      </main>
    );
  }

  // ---------- Formulário de abertura ----------
  return (
    <main className="min-h-dvh bg-zinc-100 px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <TicketForm ativo={ativo} token={hash} />
        <p className="mt-4 text-center text-xs text-zinc-400">
          SGA-M · Gestão de Manutenção e Compras
        </p>
      </div>
    </main>
  );
}
