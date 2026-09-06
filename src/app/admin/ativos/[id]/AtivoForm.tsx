"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert, Trash2 } from "lucide-react";
import type {
  AtivoCompleto,
  Categoria,
} from "@/lib/types";
import { atualizarAtivo, excluirAtivo } from "../actions";

type FornOpt = { id: string; nome: string };

function Secao({ titulo, aberto, children }: { titulo: string; aberto?: boolean; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm" open={aberto}>
      <summary className="cursor-pointer px-5 py-3.5 text-sm font-black">{titulo}</summary>
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">{children}</div>
    </details>
  );
}

/**
 * Formulário COMPLETO do ativo (seções 1–3, 5–7).
 * Dados técnicos ficam em aba própria (dinâmicos por categoria).
 */
export default function AtivoForm({
  ativo,
  categorias,
  localidades,
  fornecedores,
  podeExcluir,
}: {
  ativo: AtivoCompleto;
  categorias: Pick<Categoria, "id" | "nome">[];
  localidades: { id: string; nome: string; tipo: string }[];
  fornecedores: FornOpt[];
  /** Exclusão física é SÓ ADMIN (com checagem de dependências). */
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    nome: ativo.nome,
    codigo: ativo.codigo ?? "",
    descricao: ativo.descricao ?? "",
    numero_serie: ativo.numero_serie ?? "",
    patrimonio: ativo.patrimonio ?? "",
    tag: ativo.tag ?? "",
    fabricante: ativo.fabricante ?? "",
    modelo: ativo.modelo ?? "",
    categoria_id: ativo.categoria_id ?? "",
    localidade_id: ativo.localidade_id ?? "",
    localizacao: ativo.localizacao ?? "",
    criticidade: ativo.criticidade ?? "",
    prioridade_padrao: ativo.prioridade_padrao ?? "",
    centro_custo: ativo.centro_custo ?? "",
    departamento: ativo.departamento ?? "",
    responsavel: ativo.responsavel ?? "",
    equipe: ativo.equipe ?? "",
    fornecedor_id: ativo.fornecedor_id ?? "",
    nota_fiscal: ativo.nota_fiscal ?? "",
    data_aquisicao: ativo.data_aquisicao ?? "",
    valor_aquisicao: ativo.valor_aquisicao !== null ? String(ativo.valor_aquisicao) : "",
    data_instalacao: ativo.data_instalacao ?? "",
    garantia_ate: ativo.garantia_ate ?? "",
    vida_util_meses: ativo.vida_util_meses !== null ? String(ativo.vida_util_meses) : "",
  });
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function set(campo: keyof typeof f, valor: string) {
    setF((a) => ({ ...a, [campo]: valor }));
    setOk(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const r = await atualizarAtivo({
        id: ativo.id,
        ...f,
        categoria_id: f.categoria_id || null,
        localidade_id: f.localidade_id || null,
        fornecedor_id: f.fornecedor_id || null,
        valor_aquisicao: f.valor_aquisicao.trim() === "" ? null : Number(f.valor_aquisicao),
        vida_util_meses: f.vida_util_meses.trim() === "" ? null : Number(f.vida_util_meses),
        dados_tecnicos: ativo.dados_tecnicos,
      });
      if (!r.ok) throw new Error(r.error);
      setOk(true);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (excluindo) return;
    if (!confirm(`Excluir "${ativo.nome}"? Só é possível sem chamados vinculados.`)) return;
    setErro(null);
    setExcluindo(true);
    try {
      const r = await excluirAtivo({ id: ativo.id });
      if (!r.ok) throw new Error(r.error);
      router.push("/admin/ativos");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setExcluindo(false);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";
  const rotulo = "mb-1 block text-xs font-bold text-zinc-700";

  return (
    <div className="space-y-3">
      <form onSubmit={salvar} className="space-y-3">
        <Secao titulo="1 · Identificação" aberto>
          <label className="block sm:col-span-2"><span className={rotulo}>Nome *</span><input value={f.nome} onChange={(e) => set("nome", e.target.value)} disabled={salvando} required minLength={2} maxLength={120} className={campo} /></label>
          <label className="block"><span className={rotulo}>Código (único na org)</span><input value={f.codigo} onChange={(e) => set("codigo", e.target.value)} disabled={salvando} maxLength={40} className={campo} /></label>
          <label className="block"><span className={rotulo}>Categoria</span><select value={f.categoria_id} onChange={(e) => set("categoria_id", e.target.value)} disabled={salvando} className={campo}><option value="">Sem categoria</option>{categorias.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}</select></label>
          <label className="block"><span className={rotulo}>Fabricante</span><input value={f.fabricante} onChange={(e) => set("fabricante", e.target.value)} disabled={salvando} maxLength={120} className={campo} /></label>
          <label className="block"><span className={rotulo}>Modelo</span><input value={f.modelo} onChange={(e) => set("modelo", e.target.value)} disabled={salvando} maxLength={120} className={campo} /></label>
          <label className="block"><span className={rotulo}>Nº de série</span><input value={f.numero_serie} onChange={(e) => set("numero_serie", e.target.value)} disabled={salvando} maxLength={80} className={campo} /></label>
          <label className="block"><span className={rotulo}>Patrimônio</span><input value={f.patrimonio} onChange={(e) => set("patrimonio", e.target.value)} disabled={salvando} maxLength={80} className={campo} /></label>
          <label className="block"><span className={rotulo}>Tag</span><input value={f.tag} onChange={(e) => set("tag", e.target.value)} disabled={salvando} maxLength={40} className={campo} /></label>
          <label className="block sm:col-span-2"><span className={rotulo}>Descrição</span><textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} disabled={salvando} maxLength={2000} rows={3} className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60" /></label>
        </Secao>

        <Secao titulo="2 · Localização">
          <label className="block"><span className={rotulo}>Local (estrutura)</span><select value={f.localidade_id} onChange={(e) => set("localidade_id", e.target.value)} disabled={salvando} className={campo}><option value="">Sem vínculo</option>{localidades.map((l) => (<option key={l.id} value={l.id}>{l.nome}</option>))}</select></label>
          <label className="block"><span className={rotulo}>Complemento (sala, ponto…)</span><input value={f.localizacao} onChange={(e) => set("localizacao", e.target.value)} disabled={salvando} maxLength={160} className={campo} /></label>
        </Secao>

        <Secao titulo="3 · Classificação e responsáveis">
          <label className="block"><span className={rotulo}>Criticidade</span><select value={f.criticidade} onChange={(e) => set("criticidade", e.target.value)} disabled={salvando} className={campo}><option value="">—</option><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label>
          <label className="block"><span className={rotulo}>Prioridade padrão da O.S.</span><select value={f.prioridade_padrao} onChange={(e) => set("prioridade_padrao", e.target.value)} disabled={salvando} className={campo}><option value="">—</option><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label>
          <label className="block"><span className={rotulo}>Centro de custo</span><input value={f.centro_custo} onChange={(e) => set("centro_custo", e.target.value)} disabled={salvando} maxLength={80} className={campo} /></label>
          <label className="block"><span className={rotulo}>Departamento</span><input value={f.departamento} onChange={(e) => set("departamento", e.target.value)} disabled={salvando} maxLength={80} className={campo} /></label>
          <label className="block"><span className={rotulo}>Responsável</span><input value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} disabled={salvando} maxLength={120} className={campo} /></label>
          <label className="block"><span className={rotulo}>Equipe</span><input value={f.equipe} onChange={(e) => set("equipe", e.target.value)} disabled={salvando} maxLength={120} className={campo} /></label>
        </Secao>

        <Secao titulo="5 · Aquisição e garantia">
          <label className="block"><span className={rotulo}>Fornecedor</span><select value={f.fornecedor_id} onChange={(e) => set("fornecedor_id", e.target.value)} disabled={salvando} className={campo}><option value="">—</option>{fornecedores.map((x) => (<option key={x.id} value={x.id}>{x.nome}</option>))}</select></label>
          <label className="block"><span className={rotulo}>Nota fiscal</span><input value={f.nota_fiscal} onChange={(e) => set("nota_fiscal", e.target.value)} disabled={salvando} maxLength={60} className={campo} /></label>
          <label className="block"><span className={rotulo}>Data de aquisição</span><input type="date" value={f.data_aquisicao} onChange={(e) => set("data_aquisicao", e.target.value)} disabled={salvando} className={campo} /></label>
          <label className="block"><span className={rotulo}>Valor (R$)</span><input type="number" min="0" step="0.01" inputMode="decimal" value={f.valor_aquisicao} onChange={(e) => set("valor_aquisicao", e.target.value)} disabled={salvando} className={campo} /></label>
          <label className="block"><span className={rotulo}>Instalação</span><input type="date" value={f.data_instalacao} onChange={(e) => set("data_instalacao", e.target.value)} disabled={salvando} className={campo} /></label>
          <label className="block"><span className={rotulo}>Garantia até</span><input type="date" value={f.garantia_ate} onChange={(e) => set("garantia_ate", e.target.value)} disabled={salvando} className={campo} /></label>
          <label className="block"><span className={rotulo}>Vida útil (meses)</span><input type="number" min="1" step="1" inputMode="numeric" value={f.vida_util_meses} onChange={(e) => set("vida_util_meses", e.target.value)} disabled={salvando} className={campo} /></label>
        </Secao>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={salvando} className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
            {salvando ? "Salvando…" : "Salvar dados"}
          </button>
          {ok && <span className="text-xs font-bold text-emerald-700">Salvo!</span>}
          <span className="flex-1" />
          {podeExcluir && (
            <button type="button" onClick={excluir} disabled={excluindo || salvando} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
              <Trash2 className="size-4" />
              {excluindo ? "Excluindo…" : "Excluir ativo"}
            </button>
          )}
        </div>
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </form>
    </div>
  );
}
