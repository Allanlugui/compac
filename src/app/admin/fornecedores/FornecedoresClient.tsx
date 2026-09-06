"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert, Truck } from "lucide-react";
import type { Fornecedor } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import { alternarFornecedor, criarFornecedor } from "./actions";

export default function FornecedoresClient({
  fornecedores,
  totais,
}: {
  fornecedores: Fornecedor[];
  totais: Record<string, { qtd: number; total: number }>;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [categoria, setCategoria] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await criarFornecedor({ nome, cnpj: "", contato: "", telefone, email: "", categoria });
      if (!r.ok) throw new Error(r.error);
      setNome(""); setTelefone(""); setCategoria("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(id: string, ativo: boolean) {
    setErro(null);
    const r = await alternarFornecedor({ id, ativo });
    if (!r.ok) setErro(r.error);
    else router.refresh();
  }

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <form onSubmit={salvar} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Truck className="size-4" /> Novo fornecedor
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input aria-label="Nome" required minLength={2} maxLength={160} placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Telefone" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Categoria" placeholder="Categoria (ex.: Elétrica)" value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={salvando} className={campo} />
          <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
            {salvando && <LoaderCircle className="size-4 animate-spin" />}
            Cadastrar
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </form>

      {fornecedores.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Nenhum fornecedor cadastrado.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {fornecedores.map((f) => {
            const t = totais[f.id] ?? { qtd: 0, total: 0 };
            const aberto = expandido === f.id;
            return (
              <li key={f.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{f.nome}</p>
                    <p className="text-xs text-zinc-500">
                      {[f.categoria, f.telefone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ${f.ativo ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-zinc-200 text-zinc-500 ring-zinc-300"}`}>
                    {f.ativo ? "ATIVO" : "INATIVO"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>{t.qtd} compras · {formatarMoeda(t.total)}</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => setExpandido(aberto ? null : f.id)} className="font-bold text-zinc-700 underline-offset-2 hover:underline">
                      {aberto ? "menos" : "detalhes"}
                    </button>
                    <button type="button" onClick={() => alternar(f.id, !f.ativo)} className="font-bold text-zinc-700 underline-offset-2 hover:underline">
                      {f.ativo ? "inativar" : "ativar"}
                    </button>
                  </span>
                </div>
                {aberto && (
                  <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2 text-xs">
                    <div><dt className="font-bold text-zinc-500">CNPJ</dt><dd>{f.cnpj || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">Contato</dt><dd>{f.contato || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">E-mail</dt><dd className="break-all">{f.email || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">Endereço</dt><dd>{f.endereco || "—"}</dd></div>
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
