"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, LoaderCircle, Receipt, TriangleAlert } from "lucide-react";
import { formatarMoeda } from "@/lib/format";
import { criarCompra } from "./actions";

export interface ChamadoOpcao {
  id: string;
  rotulo: string;
}

function hojeISO(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export default function NovaCompraForm({
  chamados,
  fornecedores,
}: {
  chamados: ChamadoOpcao[];
  fornecedores: ChamadoOpcao[];
}) {
  const router = useRouter();
  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [setor, setSetor] = useState("");
  const [dataCompra, setDataCompra] = useState(hojeISO());
  const [chamadoId, setChamadoId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      const resultado = await criarCompra({
        item,
        quantidade: Number(quantidade),
        valorUnitario: Number(valorUnitario),
        setor,
        dataCompra,
        chamadoId,
        fornecedorId,
      });
      if (!resultado.ok) throw new Error(resultado.error);
      setItem("");
      setQuantidade("1");
      setValorUnitario("");
      setSetor("");
      setDataCompra(hojeISO());
      setChamadoId("");
      setFornecedorId("");
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60 sm:text-sm";

  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:hidden"
    >
      <h2 className="text-base font-bold text-zinc-900">Registrar compra</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Despesa geral ou vinculada a um chamado — o total é calculado
        automaticamente.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Item <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={160}
            placeholder="Ex.: Disjuntor bipolar 32A"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            disabled={salvando}
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
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
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
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
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Setor
          </span>
          <input
            type="text"
            maxLength={80}
            placeholder="Ex.: Elétrica"
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            disabled={salvando}
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Data da compra
          </span>
          <input
            type="date"
            value={dataCompra}
            onChange={(e) => setDataCompra(e.target.value)}
            disabled={salvando}
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-zinc-800">
            <Link2 className="size-3.5 text-zinc-400" />
            Vincular a chamado (opcional)
          </span>
          <select
            value={chamadoId}
            onChange={(e) => setChamadoId(e.target.value)}
            disabled={salvando}
            className={campo}
          >
            <option value="">Compra geral (sem vínculo)</option>
            {chamados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Fornecedor (opcional)
          </span>
          <select
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            disabled={salvando}
            className={campo}
          >
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-sm text-zinc-600">
          <Receipt className="size-4 text-zinc-400" />
          Total da compra:{" "}
          <strong className="text-base text-zinc-900">
            {formatarMoeda(previaTotal)}
          </strong>
        </p>
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 font-semibold text-white transition active:scale-[0.99] hover:bg-zinc-800 disabled:opacity-60"
        >
          {salvando && <LoaderCircle className="size-5 animate-spin" />}
          {salvando ? "Salvando…" : "Registrar compra"}
        </button>
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
