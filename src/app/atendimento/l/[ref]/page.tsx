import type { Metadata } from "next";
import { PaginaAtendimento, carregarAtendimento } from "../../AtendimentoShell";

export const metadata: Metadata = { title: "Atendimento · SGA-M" };

export default async function AtendimentoLocalPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await carregarAtendimento("l", ref);
  if (!r.ok) return null;
  return (
    <PaginaAtendimento
      entrada={r.entrada}
      origem={r.rotuloOrigem}
      saudacao={`Atendimento para ${r.rotuloOrigem}. Como posso ajudar?`}
      kind="l"
      tokenRef={ref}
    />
  );
}
