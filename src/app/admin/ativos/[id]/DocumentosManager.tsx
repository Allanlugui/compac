"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  LoaderCircle,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import type { AtivoDocumento, CategoriaDocumento } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import FotoAnexoInput from "@/app/admin/_components/FotoAnexoInput";
import { excluirDocumento, uploadArquivoAtivo } from "../actions";

const CATS: { id: CategoriaDocumento; rotulo: string }[] = [
  { id: "foto", rotulo: "Foto" },
  { id: "manual", rotulo: "Manual" },
  { id: "ficha_tecnica", rotulo: "Ficha técnica" },
  { id: "nota_fiscal", rotulo: "Nota fiscal" },
  { id: "certificado", rotulo: "Certificado" },
  { id: "laudo", rotulo: "Laudo" },
  { id: "garantia", rotulo: "Garantia" },
  { id: "contrato", rotulo: "Contrato" },
  { id: "desenho", rotulo: "Desenho" },
  { id: "procedimento", rotulo: "Procedimento" },
  { id: "outro", rotulo: "Outro" },
];

export interface DocComUrl extends AtivoDocumento {
  url: string;
}

/** Seção 8 · Fotos e documentos do ativo (Storage privado + signed URL). */
export default function DocumentosManager({
  ativoId,
  docs,
}: {
  ativoId: string;
  docs: DocComUrl[];
}) {
  const router = useRouter();
  const [categoria, setCategoria] = useState<CategoriaDocumento>("foto");
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  async function enviarArquivos(arquivos: File[]) {
    if (enviando || arquivos.length === 0) return;
    setErro(null);
    setOk(false);
    setEnviando(true);
    try {
      for (let i = 0; i < arquivos.length; i++) {
        setFase(`Enviando ${i + 1} de ${arquivos.length}…`);
        const r = await uploadArquivoAtivo({
          ativoId,
          file: arquivos[i],
          categoria,
          nome: nome.trim() || undefined,
        });
        if (!r.ok) throw new Error(r.error);
      }
      setOk(true);
      setNome("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setEnviando(false);
      setFase(null);
    }
  }

  async function remover(id: string, nomeDoc: string) {
    if (removendo) return;
    if (!confirm(`Excluir "${nomeDoc}"? O arquivo sai do Storage.`)) return;
    setErro(null);
    setRemovendo(id);
    try {
      const r = await excluirDocumento({ id });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setRemovendo(null);
    }
  }

  const campo =
    "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-black">
          <Upload className="size-4 text-zinc-500" />
          Adicionar {fase ?? "arquivo"}
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)} disabled={enviando} className={campo}>
              {CATS.map((c) => (
                <option key={c.id} value={c.id}>{c.rotulo}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">Nome (opcional)</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} disabled={enviando} maxLength={160} placeholder="Ex.: Manual do fabricante" className={campo} />
          </label>
        </div>
        <div className="mt-3">
          {categoria === "foto" ? (
            <FotoAnexoInput aoSelecionar={enviarArquivos} desabilitado={enviando} maximo={6} />
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
                Arquivo <span className="font-normal text-zinc-500">(PDF ou foto · máx. 10 MB)</span>
              </span>
              <input
                type="file"
                accept="application/pdf,image/*"
                disabled={enviando}
                onChange={(e) => {
                  if (e.target.files?.[0]) enviarArquivos([e.target.files[0]]);
                  e.target.value = "";
                }}
                className="w-full text-sm file:mr-3 file:min-h-[44px] file:rounded-xl file:border-0 file:bg-zinc-900 file:px-4 file:font-bold file:text-white hover:file:bg-zinc-700 disabled:opacity-60"
              />
            </label>
          )}
        </div>
        {ok && <p className="mt-2 text-xs font-bold text-emerald-700">Enviado!</p>}
        {erro && (
          <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </div>

      {docs.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
          Nenhum arquivo. Fotos da câmera/galeria e documentos ficam aqui.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
              {d.categoria === "foto" && d.url !== "" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.url} alt={d.nome} className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200" />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                  <FileText className="size-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{d.nome}</p>
                <p className="text-xs text-zinc-400">
                  {CATS.find((c) => c.id === d.categoria)?.rotulo} · {formatarDataHora(d.created_at)}
                </p>
                {d.url !== "" && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-zinc-700 underline-offset-2 hover:underline">
                    Abrir original
                  </a>
                )}
              </div>
              <button
                type="button"
                aria-label={`Excluir ${d.nome}`}
                onClick={() => remover(d.id, d.nome)}
                disabled={removendo !== null}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-60"
              >
                {removendo === d.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
