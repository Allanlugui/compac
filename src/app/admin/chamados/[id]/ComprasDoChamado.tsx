"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PackagePlus, Receipt, TriangleAlert } from "lucide-react";
import type { Compra } from "@/lib/types";
import { formatarData, formatarMoeda } from "@/lib/format";
import { registrarCompra } from "./actions";

function hojeISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export default function ComprasDoChamado({
  chamadoId,
  iniciais,
}: {
  chamadoId: string;
  iniciais: Compra[];
}) {
  const router = useRouter();
  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [setor, setSetor] = useState("");
  const [dataCompra, setDataCompra] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const totalCompras = iniciais.reduce(
    (soma, c) => soma + Number(c.valor_total ?? 0),
    0,
  );

  const previaTotal =
    Number(quantidade) > 0 && Number(valorUnitario) >= 0
      ? Number(quantidade) * Number(valorUnitario)
      : 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const resultado = await registrarCompra({
        chamadoId,
        item,
        quantidade: Number(quantidade),
        valorUnitario: Number(valorUnitario),
        setor,
        dataCompra,
      });
      if (!resultado.ok) throw new Error(resultado.error);
      setItem("");
      setQuantidade("1");
      setValorUnitario("");
      setSetor("");
      setDataCompra(hojeISO());
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      {iniciais.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200">
          Nenhum insumo vinculado a este chamado ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-zinc-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                <th className="px-4 py-2.5 font-semibold">Item</th>
                <th className="px-4 py-2.5 font-semibold">Qtd</th>
                <th className="px-4 py-2.5 font-semibold">Valor unit.</th>
                <th className="px-4 py-2.5 font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Setor</th>
                <th className="px-4 py-2.5 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {iniciais.map((compra) => (
                <tr key={compra.id} className="text-zinc-800">
                  <td className="px-4 py-2.5 font-medium">{compra.item}</td>
                  <td className="px-4 py-2.5">{String(compra.quantidade)}</td>
                  <td className="px-4 py-2.5">
                    {formatarMoeda(Number(compra.valor_unitario))}
                  </td>
                  <td className="px-4 py-2.5 font-semibold">
                    {formatarMoeda(Number(compra.valor_total))}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">
                    {compra.setor || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">
                    {formatarData(compra.data_compra)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 font-bold text-zinc-900">
                <td colSpan={3} className="px-4 py-2.5">
                  Total de insumos
                </td>
                <td colSpan={3} className="px-4 py-2.5">
                  {formatarMoeda(totalCompras)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <form
        onSubmit={enviar}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4"
      >
        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
          <PackagePlus className="size-4" />
          Vincular insumo / compra
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-xs font-semibold text-zinc-700">
              Item <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={160}
              placeholder="Ex.: Torneira 1/2 pol"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              disabled={salvando}
              className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-700">
              Quantidade <span className="text-red-500">*</span>
            </span>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              inputMode="decimal"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={salvando}
              className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-700">
              Valor unitário (R$) <span className="text-red-500">*</span>
            </span>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0,00"
              value={valorUnitario}
              onChange={(e) => setValorUnitario(e.target.value)}
              disabled={salvando}
              className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-700">
              Setor
            </span>
            <input
              type="text"
              maxLength={80}
              placeholder="Ex.: Hidráulica"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              disabled={salvando}
              className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-700">
              Data da compra
            </span>
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              disabled={salvando}
              className="min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
            />
          </label>
          <div className="flex items-end">
            <p className="flex min-h-[44px] w-full items-center gap-1.5 rounded-lg bg-white px-3 text-sm ring-1 ring-zinc-200">
              <Receipt className="size-4 text-zinc-400" />
              Total:{" "}
              <strong className="text-zinc-900">
                {formatarMoeda(previaTotal)}
              </strong>
            </p>
          </div>
        </div>

        {erro && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {salvando && <LoaderCircle className="size-4 animate-spin" />}
          {salvando ? "Vinculando…" : "Vincular ao chamado"}
        </button>
      </form>
    </div>
  );
}
