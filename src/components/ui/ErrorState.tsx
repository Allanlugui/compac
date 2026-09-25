import { TriangleAlert } from "lucide-react";

/** BLOCO 3.6 — Erro padronizado (substitui caixas vermelhas ad-hoc). */
export default function ErrorState({ erro }: { erro: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      {erro}
    </p>
  );
}
