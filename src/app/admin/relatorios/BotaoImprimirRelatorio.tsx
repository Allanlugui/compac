"use client";

import { Printer } from "lucide-react";

export default function BotaoImprimirRelatorio() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white transition hover:bg-zinc-800 print:hidden"
    >
      <Printer className="size-4" />
      Imprimir Relatório Gerencial
    </button>
  );
}
