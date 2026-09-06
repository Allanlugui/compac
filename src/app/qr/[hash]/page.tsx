import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import AtivoStatusBadge from "@/app/admin/_components/AtivoStatusBadge";
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
  // Lookup pública por token: service-side, escopo mínimo (identidade
  // digital: nome, localização, status, categoria — sem custos/auditoria).
  // Hashes legados de 12 chars seguem válidos (compatibilidade).
  const svc = createServiceClient();

  const { data } = await svc
    .from("ativos")
    .select("nome, localizacao, status, categorias(nome)")
    .eq("qr_code_hash", hash)
    .maybeSingle();

  const ativo = (data ?? null) as {
    nome: string;
    localizacao: string | null;
    status: string | null;
    categorias: { nome: string } | { nome: string }[] | null;
  } | null;

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

  const categoria = Array.isArray(ativo.categorias)
    ? (ativo.categorias[0]?.nome ?? null)
    : (ativo.categorias?.nome ?? null);

  // ---------- Identidade digital + abertura ----------
  return (
    <main className="min-h-dvh bg-zinc-100 px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <section className="rounded-2xl bg-zinc-950 p-5 text-white shadow-xl">
          <p className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">
            Ativo · identidade digital
          </p>
          <h1 className="mt-1 truncate text-xl font-black">{ativo.nome}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <AtivoStatusBadge status={ativo.status} />
            {categoria && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold">
                {categoria}
              </span>
            )}
          </div>
          {ativo.localizacao && (
            <p className="mt-2 truncate text-sm text-zinc-400">{ativo.localizacao}</p>
          )}
        </section>
        <TicketForm
          ativo={{ nome: ativo.nome, localizacao: ativo.localizacao }}
          token={hash}
        />
        <p className="mt-4 text-center text-xs text-zinc-400">
          SGA-M · Gestão de Manutenção e Compras
        </p>
      </div>
    </main>
  );
}
