"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode, Printer } from "lucide-react";
import type { AtivoLista } from "./AtivosGrid";
import AtivoStatusBadge from "@/app/admin/_components/AtivoStatusBadge";

export default function AtivosTable({
  ativos,
  siteUrl,
}: {
  ativos: AtivoLista[];
  siteUrl: string;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setSelecionados((atuais) => {
      const prox = new Set(atuais);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  }

  const todosSelecionados = ativos.length > 0 && selecionados.size === ativos.length;

  function toggleTodos() {
    if (todosSelecionados) setSelecionados(new Set());
    else setSelecionados(new Set(ativos.map((a) => a.id)));
  }

  if (ativos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
        <QrCode className="mx-auto size-10 text-zinc-300" />
        <p className="mt-2 font-semibold text-zinc-700">Nenhum ativo com estes filtros</p>
        <p className="mt-1 text-sm text-zinc-500">Ajuste os filtros ou cadastre um novo ativo acima.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {selecionados.size > 0 && (
        <div className="flex items-center justify-between gap-2 bg-zinc-900 px-4 py-2 text-sm font-bold text-white">
          <span>{selecionados.size} selecionado(s)</span>
          <button type="button" onClick={() => setSelecionados(new Set())} className="text-zinc-300 hover:text-white">
            Limpar
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} aria-label="Selecionar todos" className="size-4 accent-zinc-900" />
              </th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="hidden px-3 py-2 sm:table-cell">Categoria</th>
              <th className="hidden px-3 py-2 lg:table-cell">Localização</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">O.S.</th>
              <th className="px-3 py-2">QR</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ativos.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-50">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selecionados.has(a.id)} onChange={() => alternar(a.id)} aria-label={`Selecionar ${a.nome}`} className="size-4 accent-zinc-900" />
                </td>
                <td className="px-3 py-2 font-mono text-xs font-bold">{a.codigo ?? "—"}</td>
                <td className="max-w-[200px] truncate px-3 py-2 font-medium" title={a.nome}>
                  <Link href={`/admin/ativos/${a.id}`} className="hover:underline">
                    {a.nome}
                  </Link>
                </td>
                <td className="hidden px-3 py-2 text-xs sm:table-cell">{a.categoria_nome ?? "—"}</td>
                <td className="hidden max-w-[160px] truncate px-3 py-2 text-xs lg:table-cell" title={a.localidade_nome ?? a.localizacao ?? ""}>
                  {a.localidade_nome || a.localizacao || <span className="text-amber-600">Sem localização</span>}
                </td>
                <td className="px-3 py-2">
                  <AtivoStatusBadge status={a.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">—</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <QrCode className="size-3.5" />
                    {a.qr_code_hash.slice(0, 8)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/ativos/${a.id}`} className="inline-flex rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800">
                    Detalhe
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        {ativos.length} ativos · {selecionados.size} selecionados
      </div>
    </div>
  );
}
