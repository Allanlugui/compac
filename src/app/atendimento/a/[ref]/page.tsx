import type { Metadata } from "next";
import { PaginaAtendimento, carregarAtendimento } from "../../AtendimentoShell";

export const metadata: Metadata = { title: "Atendimento · SGA-M" };

export default async function AtendimentoAtivoPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const r = await carregarAtendimento("a", ref);
  if (!r.ok) return null;
  return (
    <PaginaAtendimento
      entrada={r.entrada}
      origem={r.rotuloOrigem}
      saudacao={`Você escaneou ${r.rotuloOrigem}. Como posso ajudar?`}
      kind="a"
      tokenRef={ref}
    />
  );
}
