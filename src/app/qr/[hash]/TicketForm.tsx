"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleCheck,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Ticket,
  TriangleAlert,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { uploadFotoQR } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { criarChamado } from "./actions";

interface TicketFormProps {
  ativo: { id: string; nome: string; localizacao: string | null };
  /** Token público da URL (usado no upload server-side). */
  token: string;
}

interface FotoSelecionada {
  file: File;
  preview: string;
}

const MAX_FOTOS = 6;
const MAX_BYTES_POR_FOTO = 8 * 1024 * 1024; // 8 MB

export default function TicketForm({ ativo, token }: TicketFormProps) {
  const [solicitante, setSolicitante] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fotos, setFotos] = useState<FotoSelecionada[]>([]);
  const [fase, setFase] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [chamadoId, setChamadoId] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const enviando = fase !== null;

  // Libera as object URLs ao desmontar.
  useEffect(() => {
    return () => {
      setFotos((atuais) => {
        atuais.forEach((f) => URL.revokeObjectURL(f.preview));
        return atuais;
      });
    };
  }, []);

  function adicionarFotos(lista: FileList | null) {
    if (!lista) return;
    setErro(null);
    const restantes = MAX_FOTOS - fotos.length;
    if (restantes <= 0) {
      setErro(`Máximo de ${MAX_FOTOS} fotos por chamado.`);
      return;
    }
    const novas: FotoSelecionada[] = [];
    for (const file of Array.from(lista).slice(0, restantes)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_BYTES_POR_FOTO) {
        setErro(`"${file.name}" excede 8 MB e foi ignorada.`);
        continue;
      }
      novas.push({ file, preview: URL.createObjectURL(file) });
    }
    if (novas.length > 0) setFotos((atuais) => [...atuais, ...novas]);
  }

  function removerFoto(preview: string) {
    setFotos((atuais) => {
      const alvo = atuais.find((f) => f.preview === preview);
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return atuais.filter((f) => f.preview !== preview);
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);

    try {
      // 1. Upload via Server Action: path derivado do token no servidor.
      const paths: string[] = [];
      for (let i = 0; i < fotos.length; i++) {
        const { file } = fotos[i];
        setFase(`Enviando foto ${i + 1} de ${fotos.length}…`);
        const up = await uploadFotoQR(token, file);
        if (!up.ok) throw new Error(up.error);
        paths.push(up.path);
      }

      // 2. Registro do chamado via Server Action.
      setFase("Registrando chamado…");
      const resultado = await criarChamado({
        ativoId: ativo.id,
        solicitante,
        descricao,
        fotosAntes: paths,
      });
      if (!resultado.ok) throw new Error(resultado.error);

      // 3. Confirmação.
      fotos.forEach((f) => URL.revokeObjectURL(f.preview));
      setFotos([]);
      setSolicitante("");
      setDescricao("");
      setChamadoId(resultado.id);
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setFase(null);
    }
  }

  function novoChamado() {
    setChamadoId(null);
    setErro(null);
  }

  // ---------- Tela de confirmação ----------
  if (chamadoId) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CircleCheck className="mx-auto size-12 text-emerald-600" />
        <h2 className="mt-3 text-lg font-bold text-emerald-900">
          Chamado registrado!
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          A equipe de manutenção foi acionada para{" "}
          <strong>{ativo.nome}</strong>.
        </p>
        <p className="mt-4 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
          Número do chamado
        </p>
        <p className="mt-1 rounded-lg bg-white px-3 py-2 font-mono text-xs break-all text-zinc-800 ring-1 ring-emerald-200">
          {chamadoId}
        </p>
        <button
          type="button"
          onClick={novoChamado}
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white transition active:scale-[0.99] hover:bg-emerald-700"
        >
          <Ticket className="size-5" />
          Abrir outro chamado
        </button>
      </section>
    );
  }

  // ---------- Formulário ----------
  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <Wrench className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-zinc-900">
            {ativo.nome}
          </h1>
          {ativo.localizacao && (
            <p className="flex items-center gap-1 truncate text-sm text-zinc-500">
              <MapPin className="size-3.5 shrink-0" />
              {ativo.localizacao}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="solicitante"
            className="mb-1.5 block text-sm font-semibold text-zinc-800"
          >
            Seu nome <span className="text-red-500">*</span>
          </label>
          <input
            id="solicitante"
            type="text"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            placeholder="Ex.: Maria da Silva"
            value={solicitante}
            onChange={(e) => setSolicitante(e.target.value)}
            disabled={enviando}
            className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="descricao"
            className="mb-1.5 block text-sm font-semibold text-zinc-800"
          >
            Descrição do problema <span className="text-red-500">*</span>
          </label>
          <textarea
            id="descricao"
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            placeholder="Ex.: Torneira do banheiro pingando sem parar desde ontem."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            disabled={enviando}
            className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Fotos do problema{" "}
            <span className="font-normal text-zinc-500">
              (opcional · máx. {MAX_FOTOS})
            </span>
          </span>
          <input
            ref={inputArquivoRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              adicionarFotos(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputArquivoRef.current?.click()}
            disabled={enviando || fotos.length >= MAX_FOTOS}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
          >
            <ImagePlus className="size-5" />
            {fotos.length === 0
              ? "Adicionar fotos"
              : `Adicionar mais (${fotos.length}/${MAX_FOTOS})`}
          </button>

          {fotos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {fotos.map((foto) => (
                <div key={foto.preview} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.preview}
                    alt="Foto do problema"
                    className="aspect-square w-full rounded-lg object-cover ring-1 ring-zinc-200"
                  />
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => removerFoto(foto.preview)}
                    disabled={enviando}
                    className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-zinc-900 text-white shadow transition hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className={cn(
            "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-bold text-white transition active:scale-[0.99]",
            enviando ? "bg-zinc-400" : "bg-zinc-900 hover:bg-zinc-800",
          )}
        >
          {enviando ? (
            <>
              <LoaderCircle className="size-5 animate-spin" />
              {fase}
            </>
          ) : (
            <>
              <Upload className="size-5" />
              Enviar chamado
            </>
          )}
        </button>
      </div>
    </form>
  );
}
