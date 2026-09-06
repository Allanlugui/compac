"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

export default function FiltrosPeriodo({
  inicio,
  fim,
}: {
  inicio: string;
  fim: string;
}) {
  const router = useRouter();
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    if (!de || !ate) return;
    const params = new URLSearchParams({ inicio: de, fim: ate });
    router.push(`/admin/relatorios?${params.toString()}`);
  }

  const campo =
    "min-h-[44px] rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none";

  return (
    <form
      onSubmit={aplicar}
      className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end print:hidden"
    >
      <span className="flex items-center gap-2 text-sm font-bold text-zinc-900">
        <CalendarRange className="size-5 text-zinc-500" />
        Período
      </span>
      <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-zinc-600">
        Data inicial
        <input
          type="date"
          required
          value={de}
          onChange={(e) => setDe(e.target.value)}
          className={campo}
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-zinc-600">
        Data final
        <input
          type="date"
          required
          value={ate}
          min={de}
          onChange={(e) => setAte(e.target.value)}
          className={campo}
        />
      </label>
      <button
        type="submit"
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white transition hover:bg-zinc-800"
      >
        Aplicar
      </button>
    </form>
  );
}
