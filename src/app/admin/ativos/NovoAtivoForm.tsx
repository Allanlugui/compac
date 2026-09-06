"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import type {
  AtivoStatus,
  Categoria,
} from "@/lib/types";
import { criarAtivo } from "./actions";

const STATUS: { id: AtivoStatus; rotulo: string }[] = [
  { id: "operacional", rotulo: "Operacional" },
  { id: "em_manutencao", rotulo: "Em manutenção" },
  { id: "parado", rotulo: "Parado" },
  { id: "em_instalacao", rotulo: "Em instalação" },
  { id: "em_inspecao", rotulo: "Em inspeção" },
  { id: "inativo", rotulo: "Inativo" },
  { id: "desativado", rotulo: "Desativado" },
];

/** Cadastro RÁPIDO (Nome+Código+Categoria+Local+Status); o resto no detalhe. */
export default function NovoAtivoForm({
  categorias,
  localidades,
}: {
  categorias: Pick<Categoria, "id" | "nome">[];
  localidades: { id: string; nome: string; tipo: string }[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [localidadeId, setLocalidadeId] = useState("");
  const [status, setStatus] = useState<AtivoStatus>("operacional");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await criarAtivo({
        nome,
        codigo,
        categoria_id: categoriaId || null,
        localidade_id: localidadeId || null,
        status,
      });
      if (!r.ok) throw new Error(r.error);
      setNome("");
      setCodigo("");
      setCategoriaId("");
      setLocalidadeId("");
      setStatus("operacional");
      router.refresh();
      if (r.id) router.push(`/admin/ativos/${r.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60 sm:text-sm";

  return (
    <form onSubmit={salvar} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:hidden">
      <h2 className="flex items-center gap-2 text-base font-black">
        <Plus className="size-5 text-zinc-500" />
        Cadastro rápido
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Nome *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} required minLength={2} maxLength={120} placeholder="Ex.: Ar-condicionado recepção" className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Código (único)</span>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} disabled={salvando} maxLength={40} placeholder="Ex.: AC-REC-001" className={campo} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Categoria</span>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={salvando} className={campo}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Localização</span>
          <select value={localidadeId} onChange={(e) => setLocalidadeId(e.target.value)} disabled={salvando} className={campo}>
            <option value="">Sem localização</option>
            {localidades.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as AtivoStatus)} disabled={salvando} className={campo}>
            {STATUS.map((s) => (
              <option key={s.id} value={s.id}>{s.rotulo}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={salvando} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60">
            {salvando && <LoaderCircle className="size-5 animate-spin" />}
            {salvando ? "Salvando…" : "Cadastrar e completar"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-400">Após cadastrar você cai no detalhe para completar dados técnicos, aquisição, documentos e QR.</p>
      {erro && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
