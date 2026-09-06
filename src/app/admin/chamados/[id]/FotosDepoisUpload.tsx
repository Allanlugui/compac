"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adicionarFotosDepois } from "./actions";

const MAX_FOTOS_POR_ENVIO = 6;
const MAX_BYTES_POR_FOTO = 8 * 1024 * 1024; // 8 MB
const BUCKET = "manutencao-midia";

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-60);
}

export default function FotosDepoisUpload({ chamadoId }: { chamadoId: string }) {
  const router = useRouter();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [fase, setFase] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enviando = fase !== null;

  function adicionar(lista: FileList | null) {
    if (!lista) return;
    setErro(null);
    const restantes = MAX_FOTOS_POR_ENVIO - arquivos.length;
    if (restantes <= 0) {
      setErro(`Máximo de ${MAX_FOTOS_POR_ENVIO} fotos por envio.`);
      return;
    }
    const novas: File[] = [];
    for (const file of Array.from(lista).slice(0, restantes)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_BYTES_POR_FOTO) {
        setErro(`"${file.name}" excede 8 MB e foi ignorada.`);
        continue;
      }
      novas.push(file);
    }
    if (novas.length > 0) setArquivos((atuais) => [...atuais, ...novas]);
  }

  async function enviar() {
    if (enviando || arquivos.length === 0) return;
    setErro(null);
    try {
      const supabase = createClient();
      const urls: string[] = [];
      for (let i = 0; i < arquivos.length; i++) {
        const file = arquivos[i];
        setFase(`Enviando foto ${i + 1} de ${arquivos.length}…`);
        const caminho = `chamados/${chamadoId}/depois/${Date.now()}-${i + 1}-${sanitizarNomeArquivo(file.name)}`;
        const { error: erroUpload } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });
        if (erroUpload) throw new Error("Falha no envio das fotos.");
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
        urls.push(data.publicUrl);
      }
      setFase("Salvando no chamado…");
      const resultado = await adicionarFotosDepois({ chamadoId, urls });
      if (!resultado.ok) throw new Error(resultado.error);
      setArquivos([]);
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setFase(null);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          adicionar(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
        >
          <Camera className="size-5" />
          {arquivos.length === 0
            ? "Selecionar fotos do depois"
            : `${arquivos.length} foto(s) selecionada(s)`}
        </button>
        {arquivos.length > 0 && (
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {enviando && <LoaderCircle className="size-4 animate-spin" />}
            {enviando ? fase : "Enviar fotos"}
          </button>
        )}
      </div>

      {arquivos.length > 0 && !enviando && (
        <ul className="mt-2 space-y-1">
          {arquivos.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`Remover ${file.name}`}
                onClick={() =>
                  setArquivos((atuais) => atuais.filter((_, j) => j !== i))
                }
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
