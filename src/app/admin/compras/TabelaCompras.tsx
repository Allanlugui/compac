"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ListFilter,
  LoaderCircle,
  Pencil,
  Save,
  Trash,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Compra } from "@/lib/types";
import { formatarData, formatarMoeda, rotuloMes } from "@/lib/format";
import { atualizarCompra, excluirCompra } from "./actions";

interface TabelaComprasProps {
  compras: Compra[];
  /** chamado_id → rótulo "OS XXXXXXXX · Nome do ativo". */
  vinculos: Record<string, string>;
}

function LinhaEdicao({
  compra,
  aoSalvar,
  aoCancelar,
  salvando,
}: {
  compra: Compra;
  aoSalvar: (dados: {
    item: string;
    quantidade: number;
    valorUnitario: number;
    setor: string;
    dataCompra: string;
  }) => void;
  aoCancelar: () => void;
  salvando: boolean;
}) {
  const [item, setItem] = useState(compra.item);
  const [quantidade, setQuantidade] = useState(String(compra.quantidade));
  const [valorUnitario, setValorUnitario] = useState(
    String(compra.valor_unitario),
  );
  const [setor, setSetor] = useState(compra.setor ?? "");
  const [dataCompra, setDataCompra] = useState(compra.data_compra);

  const campo =
    "min-h-[40px] w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <tr className="bg-amber-50/60">
      <td className="px-3 py-2">
        <input
          aria-label="Item"
          type="text"
          required
          minLength={2}
          maxLength={160}
          value={item}
          onChange={(e) => setItem(e.target.value)}
          disabled={salvando}
          className={campo}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Quantidade"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          disabled={salvando}
          className={`${campo} w-24`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Valor unitário"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={valorUnitario}
          onChange={(e) => setValorUnitario(e.target.value)}
          disabled={salvando}
          className={`${campo} w-28`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Setor"
          type="text"
          maxLength={80}
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          disabled={salvando}
          className={`${campo} w-32`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Data da compra"
          type="date"
          value={dataCompra}
          onChange={(e) => setDataCompra(e.target.value)}
          disabled={salvando}
          className={campo}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Salvar edição"
            disabled={salvando}
            onClick={() =>
              aoSalvar({
                item,
                quantidade: Number(quantidade),
                valorUnitario: Number(valorUnitario),
                setor,
                dataCompra,
              })
            }
            className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {salvando ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
          </button>
          <button
            type="button"
            aria-label="Cancelar edição"
            disabled={salvando}
            onClick={aoCancelar}
            className="flex size-9 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-60"
          >
            <X className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function TabelaCompras({ compras, vinculos }: TabelaComprasProps) {
  const router = useRouter();
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const setores = useMemo(() => {
    const unicos = new Set<string>();
    for (const c of compras) {
      if (c.setor && c.setor.trim() !== "") unicos.add(c.setor);
    }
    return [...unicos].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [compras]);

  const filtradas = useMemo(() => {
    return compras.filter((c) => {
      if (filtroSetor !== "todos" && (c.setor ?? "") !== filtroSetor) return false;
      if (filtroMes !== "" && c.data_compra.slice(0, 7) !== filtroMes) return false;
      return true;
    });
  }, [compras, filtroSetor, filtroMes]);

  const totalFiltrado = useMemo(
    () => filtradas.reduce((soma, c) => soma + Number(c.valor_total ?? 0), 0),
    [filtradas],
  );

  async function salvarEdicao(
    id: string,
    dados: {
      item: string;
      quantidade: number;
      valorUnitario: number;
      setor: string;
      dataCompra: string;
    },
  ) {
    setErro(null);
    setProcessando(id);
    try {
      const resultado = await atualizarCompra({ id, ...dados, chamadoId: "", fornecedorId: "" });
      if (!resultado.ok) throw new Error(resultado.error);
      setEditId(null);
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setProcessando(null);
    }
  }

  async function excluir(id: string, item: string) {
    if (!window.confirm(`Excluir "${item}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setErro(null);
    setProcessando(id);
    try {
      const resultado = await excluirCompra({ id });
      if (!resultado.ok) throw new Error(resultado.error);
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setProcessando(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
          <ListFilter className="size-5 text-zinc-500" />
          Todas as compras
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row print:hidden">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-zinc-600">Setor</span>
            <select
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="min-h-[40px] rounded-lg border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
            >
              <option value="todos">Todos</option>
              {setores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-zinc-600">Mês</span>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="min-h-[40px] rounded-lg border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
            />
          </label>
          {(filtroSetor !== "todos" || filtroMes !== "") && (
            <button
              type="button"
              onClick={() => {
                setFiltroSetor("todos");
                setFiltroMes("");
              }}
              className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
            >
              <X className="size-4" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {(filtroSetor !== "todos" || filtroMes !== "") && (
        <p className="mt-2 text-xs text-zinc-500 print:hidden">
          Filtrando por{" "}
          {[
            filtroSetor !== "todos" ? `setor "${filtroSetor}"` : null,
            filtroMes !== "" ? `mês ${rotuloMes(filtroMes)}` : null,
          ]
            .filter(Boolean)
            .join(" e ")}
          .
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 print:hidden"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      {filtradas.length === 0 ? (
        <p className="mt-4 rounded-xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          Nenhuma compra encontrada para os filtros atuais.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-zinc-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                <th className="px-3 py-2.5 font-semibold">Item</th>
                <th className="px-3 py-2.5 font-semibold">Qtd</th>
                <th className="px-3 py-2.5 font-semibold">Valor unit.</th>
                <th className="px-3 py-2.5 font-semibold">Total</th>
                <th className="px-3 py-2.5 font-semibold">Setor</th>
                <th className="px-3 py-2.5 font-semibold">Data</th>
                <th className="px-3 py-2.5 font-semibold">Vínculo</th>
                <th className="px-3 py-2.5 font-semibold print:hidden">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtradas.map((compra) =>
                editId === compra.id ? (
                  <LinhaEdicao
                    key={compra.id}
                    compra={compra}
                    salvando={processando === compra.id}
                    aoCancelar={() => setEditId(null)}
                    aoSalvar={(dados) => salvarEdicao(compra.id, dados)}
                  />
                ) : (
                  <tr key={compra.id} className="text-zinc-800">
                    <td className="px-3 py-2.5 font-medium">{compra.item}</td>
                    <td className="px-3 py-2.5">{String(compra.quantidade)}</td>
                    <td className="px-3 py-2.5">
                      {formatarMoeda(Number(compra.valor_unitario))}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">
                      {formatarMoeda(Number(compra.valor_total))}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500">
                      {compra.setor || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500">
                      {formatarData(compra.data_compra)}
                    </td>
                    <td className="px-3 py-2.5">
                      {compra.chamado_id && vinculos[compra.chamado_id] ? (
                        <Link
                          href={`/admin/chamados/${compra.chamado_id}`}
                          className="inline-block max-w-44 truncate rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-200"
                          title={vinculos[compra.chamado_id]}
                        >
                          {vinculos[compra.chamado_id]}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">Geral</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 print:hidden">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          aria-label={`Editar ${compra.item}`}
                          disabled={processando !== null}
                          onClick={() => setEditId(compra.id)}
                          className="flex size-9 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir ${compra.item}`}
                          disabled={processando !== null}
                          onClick={() => excluir(compra.id, compra.item)}
                          className="flex size-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {processando === compra.id ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Trash className="size-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-900 font-bold text-white">
                <td colSpan={3} className="px-3 py-2.5">
                  Total consolidado ({filtradas.length}{" "}
                  {filtradas.length === 1 ? "compra" : "compras"})
                </td>
                <td colSpan={5} className="px-3 py-2.5">
                  {formatarMoeda(totalFiltrado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
