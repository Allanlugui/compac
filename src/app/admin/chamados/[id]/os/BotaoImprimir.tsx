"use client";

import { Printer } from "lucide-react";

export default function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-950 px-5 text-sm font-bold text-white shadow-xl transition hover:brightness-125"
    >
      <Printer className="size-4" />
      Imprimir / Salvar em PDF
    </button>
  );
}
