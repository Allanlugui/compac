"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, LoaderCircle, Plus, Printer, Trash2, TriangleAlert } from "lucide-react";
import type { QrContexto } from "@/lib/types";
import { alternarContexto, criarContexto, excluirContexto } from "./actions";

export default function QrComprasManager({
  contextos,
  siteUrl,
}: {
  contextos: QrContexto[];
  siteUrl: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("");
  const [setor, setSetor] = useState("");
  const [area, setArea] = useState("");
  const [almoxarifado, setAlmoxarifado] = useState("");
  const [centro, setCentro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const origem =
    siteUrl !== "" ? siteUrl.replace(/\/+$/, "") : typeof window !== "undefined" ? window.location.origin : "";
  const urlDe = (token: string): string => `${origem}/qr-compra/nova?t=${token}`;

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await criarContexto({
        nome, unidade, setor, area, almoxarifado, centro_custo: centro,
      });
      if (!r.ok) throw new Error(r.error);
      setNome(""); setUnidade(""); setSetor(""); setArea(""); setAlmoxarifado(""); setCentro("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(id: string, ativo: boolean) {
    if (ocupado) return;
    setErro(null);
    setOcupado(id);
    try {
      const r = await alternarContexto({ id, ativo });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  async function excluir(id: string, nomeCtx: string) {
    if (ocupado) return;
    if (!confirm(`Excluir "${nomeCtx}"? O QR impresso deixará de funcionar.`)) return;
    setErro(null);
    setOcupado(id);
    try {
      const r = await excluirContexto({ id });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(urlDe(token));
    } catch {
      // fallback silencioso
    }
    setCopiado(token);
    setTimeout(() => setCopiado((a) => (a === token ? null : a)), 2000);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={salvar} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-black">
          <Plus className="size-5 text-zinc-500" />
          Novo QR por contexto
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          O solicitante não redigita o contexto: unidade, setor e centro já vêm preenchidos.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input aria-label="Nome *" required minLength={2} maxLength={80} placeholder="Nome * (ex.: Almoxarifado Central)" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Unidade" maxLength={80} placeholder="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Setor" maxLength={80} placeholder="Setor" value={setor} onChange={(e) => setSetor(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Área" maxLength={80} placeholder="Área" value={area} onChange={(e) => setArea(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Almoxarifado" maxLength={80} placeholder="Almoxarifado" value={almoxarifado} onChange={(e) => setAlmoxarifado(e.target.value)} disabled={salvando} className={campo} />
          <input aria-label="Centro de custo" maxLength={80} placeholder="Centro de custo" value={centro} onChange={(e) => setCentro(e.target.value)} disabled={salvando} className={campo} />
        </div>
        <button type="submit" disabled={salvando} className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
          {salvando && <LoaderCircle className="size-4 animate-spin" />}
          Gerar QR
        </button>
        {erro && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </form>

      {contextos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Nenhum contexto. Crie o primeiro acima.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contextos.map((c) => {
            const url = urlDe(c.token);
            return (
              <li key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{c.nome}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {[c.unidade, c.setor, c.area].filter(Boolean).join(" · ") || "Contexto geral"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ${c.ativo ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-zinc-200 text-zinc-500 ring-zinc-300"}`}>
                    {c.ativo ? "ATIVO" : "INATIVO"}
                  </span>
                </div>
                <div className="mx-auto mt-3 w-fit rounded-xl bg-white p-2 ring-1 ring-zinc-200">
                  <QRCodeSVG value={url} size={140} level="M" bgColor="#ffffff" fgColor="#000000" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={() => copiar(c.token)} className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50">
                    {copiado === c.token ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                    {copiado === c.token ? "OK" : "Link"}
                  </button>
                  <button type="button" onClick={() => window.print()} className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-zinc-900 px-2 text-xs font-bold text-white hover:bg-zinc-700">
                    <Printer className="size-4" />
                    Imprimir
                  </button>
                  <button type="button" onClick={() => excluir(c.id, c.nome)} disabled={ocupado !== null} className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-red-300 px-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                    <Trash2 className="size-4" />
                    Excluir
                  </button>
                </div>
                <button type="button" onClick={() => alternar(c.id, !c.ativo)} disabled={ocupado !== null} className="mt-2 text-xs font-bold text-zinc-500 underline-offset-2 hover:underline disabled:opacity-60">
                  {c.ativo ? "desativar" : "ativar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
