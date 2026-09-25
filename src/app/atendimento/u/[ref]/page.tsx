import type { Metadata } from "next";
import { PaginaAtendimento, carregarAtendimento } from "../../AtendimentoShell";

export const metadata: Metadata = { title: "Atendimento · SGA-M" };

export default async function AtendimentoUniversalPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await carregarAtendimento("u", ref);
  if (!r.ok) return null;
  return (
    <PaginaAtendimento
      entrada={r.entrada}
      origem={r.rotuloOrigem}
      saudacao={`Bem-vindo ao atendimento ${r.rotuloOrigem}. Como posso ajudar?`}
      kind="u"
      tokenRef={ref}
    />
  );
}
