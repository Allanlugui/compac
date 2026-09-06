"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, TriangleAlert, Truck } from "lucide-react";
import type { Fornecedor } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import { alternarFornecedor, criarFornecedor, editarFornecedor, type FornecedorInput } from "./actions";

const VAZIO: FornecedorInput = {
  nome: "", razao_social: "", cnpj: "", ie: "", contato: "", telefone: "",
  email: "", site: "", endereco: "", cidade: "", estado: "", cep: "",
  categoria: "", observacoes: "",
};

export default function FornecedoresClient({
  fornecedores,
  totais,
}: {
  fornecedores: Fornecedor[];
  totais: Record<string, { qtd: number; total: number }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FornecedorInput>({ ...VAZIO });
  const [editId, setEditId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  function set(campo: keyof FornecedorInput, valor: string) {
    setForm((a) => ({ ...a, [campo]: valor }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = editId
        ? await editarFornecedor({ id: editId, ...form })
        : await criarFornecedor(form);
      if (!r.ok) throw new Error(r.error);
      setForm({ ...VAZIO });
      setEditId(null);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  function editar(f: Fornecedor) {
    setEditId(f.id);
    setForm({
      nome: f.nome, razao_social: f.razao_social ?? "", cnpj: f.cnpj ?? "",
      ie: f.ie ?? "", contato: f.contato ?? "", telefone: f.telefone ?? "",
      email: f.email ?? "", site: f.site ?? "", endereco: f.endereco ?? "",
      cidade: f.cidade ?? "", estado: f.estado ?? "", cep: f.cep ?? "",
      categoria: f.categoria ?? "", observacoes: f.observacoes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          <Truck className="size-4" /> {editId ? "Editar fornecedor" : "Novo fornecedor"}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input aria-label="Nome fantasia *" required minLength={2} maxLength={160} placeholder="Nome fantasia *" value={form.nome} onChange={(e) => set("nome", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Razão social" maxLength={160} placeholder="Razão social" value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="CNPJ" maxLength={20} placeholder="CNPJ" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="IE" maxLength={20} placeholder="IE" value={form.ie} onChange={(e) => set("ie", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Contato" maxLength={120} placeholder="Contato" value={form.contato} onChange={(e) => set("contato", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Telefone" maxLength={30} placeholder="Telefone" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="E-mail" type="email" maxLength={160} placeholder="E-mail" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Site" maxLength={160} placeholder="Site" value={form.site} onChange={(e) => set("site", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Endereço" maxLength={200} placeholder="Endereço" value={form.endereco} onChange={(e) => set("endereco", e.target.value)} disabled={salvando} className={`${campo} sm:col-span-2`} />
          <input aria-label="Cidade" maxLength={80} placeholder="Cidade" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} disabled={salvando} className={campo} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="UF" maxLength={2} placeholder="UF" value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} disabled={salvando} className={campo} />
            <input aria-label="CEP" maxLength={10} placeholder="CEP" value={form.cep} onChange={(e) => set("cep", e.target.value)} disabled={salvando} className={campo} />
          </div>
          <input aria-label="Categoria" maxLength={80} placeholder="Categoria (ex.: Elétrica)" value={form.categoria} onChange={(e) => set("categoria", e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Observações" maxLength={200} placeholder="Observações" value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} disabled={salvando} className={`${campo} sm:col-span-2`} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={salvando} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60 sm:flex-none sm:px-8">
              {salvando && <LoaderCircle className="size-4 animate-spin" />}
              {editId ? "Salvar" : "Cadastrar"}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ ...VAZIO }); }} disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-zinc-200 px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-300">
                Cancelar
              </button>
            )}
          </div>
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
                      {[f.razao_social, f.categoria, f.telefone, f.cidade && f.estado ? `${f.cidade}/${f.estado}` : f.cidade].filter(Boolean).join(" · ") || "—"}
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
                    <button type="button" onClick={() => editar(f)} className="inline-flex items-center gap-1 font-bold text-zinc-700 underline-offset-2 hover:underline">
                      <Pencil className="size-3" /> editar
                    </button>
                    <button type="button" onClick={() => alternar(f.id, !f.ativo)} className="font-bold text-zinc-700 underline-offset-2 hover:underline">
                      {f.ativo ? "inativar" : "ativar"}
                    </button>
                  </span>
                </div>
                {aberto && (
                  <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2 text-xs">
                    <div><dt className="font-bold text-zinc-500">CNPJ</dt><dd>{f.cnpj || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">IE</dt><dd>{f.ie || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">Contato</dt><dd>{f.contato || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">Telefone</dt><dd>{f.telefone || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">E-mail</dt><dd className="break-all">{f.email || "—"}</dd></div>
                    <div><dt className="font-bold text-zinc-500">Site</dt><dd className="break-all">{f.site || "—"}</dd></div>
                    <div className="col-span-2"><dt className="font-bold text-zinc-500">Endereço</dt><dd>{[f.endereco, f.cidade, f.estado, f.cep].filter(Boolean).join(" · ") || "—"}</dd></div>
                    {f.observacoes && <div className="col-span-2"><dt className="font-bold text-zinc-500">Obs.</dt><dd>{f.observacoes}</dd></div>}
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
