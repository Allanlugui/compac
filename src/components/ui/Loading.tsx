import { LoaderCircle } from "lucide-react";

/** BLOCO 3.6 — Carregamento padronizado (substitui spinners ad-hoc). */
export default function Loading({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-sm text-zinc-500">
      <LoaderCircle className="size-4 animate-spin" />
      {texto}
    </p>
  );
}
