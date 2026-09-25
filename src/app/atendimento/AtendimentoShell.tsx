import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { resolverEntrada, type TipoAtendimento } from "@/lib/intake/contexto";
import type { EntradaIntake } from "@/lib/intake/types";
import AtendimentoChat from "./AtendimentoChat";

export async function carregarAtendimento(kind: TipoAtendimento, ref: string) {
  const svc = createServiceClient();
  const r = await resolverEntrada(svc as never, kind, ref);
  if (!r.ok) return notFound();
  return r;
}

export function PaginaAtendimento({
  entrada,
  origem,
  saudacao,
  kind,
  tokenRef,
}: {
  entrada: EntradaIntake;
  origem: string;
  saudacao: string;
  kind: TipoAtendimento;
  tokenRef: string;
}) {
  return (
    <main className="min-h-dvh bg-zinc-100 px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <AtendimentoChat entrada={entrada} origem={origem} saudacao={saudacao} kind={kind} tokenRef={tokenRef} />
        <p className="mt-4 text-center text-xs text-zinc-400">SGA-M · Atendimento</p>
      </div>
    </main>
  );
}
