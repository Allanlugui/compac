import type { Metadata } from "next";
import { PaginaAtendimento, carregarAtendimento } from "../../AtendimentoShell";

export const metadata: Metadata = { title: "Solicitar material · SGA-M" };

export default async function AtendimentoCompraPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await carregarAtendimento("c", ref);
  if (!r.ok) return null;
  return (
    <PaginaAtendimento
      entrada={r.entrada}
      origem={r.rotuloOrigem}
      saudacao={`Solicitação de material para ${r.rotuloOrigem}. O que você precisa?`}
      kind="c"
      tokenRef={ref}
    />
  );
}
