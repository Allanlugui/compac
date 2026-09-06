"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { criarChamadoManual } from "../[id]/actions";

/** Abertura manual (portal/admin/telefone/e-mail) com ativo da org. */
export default function NovoChamadoForm({
  ativos,
}: {
  ativos: { id: string; nome: string; codigo: string | null }[];
}) {
  const router = useRouter();
  const [ativoId, setAtivoId] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [contato, setContato] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [origem, setOrigem] = useState("portal");
  const [prioridade, setPrioridade] = useState("media");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await criarChamadoManual({
        ativoId,
        solicitante,
        contato,
        departamento,
        descricao,
        origem,
        prioridade,
      });
      if (!r.ok) throw new Error(r.error);
      router.push(`/admin/chamados/${r.id}`);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60 sm:text-sm";
  const rotulo = "mb-1 block text-xs font-bold text-zinc-700";

  return (
    <form onSubmit={salvar} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={rotulo}>Ativo *</span>
          <select value={ativoId} onChange={(e) => setAtivoId(e.target.value)} disabled={salvando} required className={campo}>
            <option value="">Selecionar ativo…</option>
            {ativos.map((a) => (
              <option key={a.id} value={a.id}>{a.codigo ? `${a.codigo} · ` : ""}{a.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={rotulo}>Solicitante *</span>
          <input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} disabled={salvando} required minLength={2} maxLength={120} className={campo} />
        </label>
        <label className="block">
          <span className={rotulo}>Contato</span>
          <input value={contato} onChange={(e) => setContato(e.target.value)} disabled={salvando} maxLength={120} placeholder="Telefone/e-mail" className={campo} />
        </label>
        <label className="block">
          <span className={rotulo}>Departamento</span>
          <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} disabled={salvando} maxLength={80} className={campo} />
        </label>
        <label className="block">
          <span className={rotulo}>Origem *</span>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} disabled={salvando} className={campo}>
            <option value="portal">Portal</option>
            <option value="administrador">Administrador</option>
            <option value="telefone">Telefone</option>
            <option value="email">E-mail</option>
          </select>
        </label>
        <label className="block">
          <span className={rotulo}>Prioridade *</span>
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} disabled={salvando} className={campo}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className={rotulo}>Descrição *</span>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={salvando} required minLength={5} maxLength={2000} rows={4} className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" />
        </label>
      </div>
      <button type="submit" disabled={salvando} className="mt-4 inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-zinc-900 px-6 font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
        {salvando && <LoaderCircle className="size-5 animate-spin" />}
        {salvando ? "Criando…" : "Criar chamado"}
      </button>
      {erro && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </form>
  );
}
