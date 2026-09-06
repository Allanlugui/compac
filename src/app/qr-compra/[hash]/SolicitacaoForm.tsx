"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Copy,
  LoaderCircle,
  PackageCheck,
  Send,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { criarSolicitacao } from "./actions";

function hojeLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function SolicitacaoForm({
  tokenOrg,
  contextoSetor = null,
}: {
  tokenOrg: string;
  /** Setor vindo do QR por contexto (não redigitado). */
  contextoSetor?: string | null;
}) {
  const [setor, setSetor] = useState(contextoSetor ?? "");
  const [solicitante, setSolicitante] = useState("");
  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [justificativa, setJustificativa] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const rastreioUrl =
    hash && typeof window !== "undefined"
      ? `${window.location.origin}/qr-compra/${hash}`
      : "";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await criarSolicitacao({
        tokenOrg,
        setor,
        solicitante,
        item,
        quantidade: Number(quantidade),
        justificativa,
        valorEstimado: valorEstimado === "" ? 0 : Number(valorEstimado),
      });
      if (!resultado.ok) throw new Error(resultado.error);
      setHash(resultado.hash);
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function copiar() {
    if (!rastreioUrl) return;
    try {
      await navigator.clipboard.writeText(rastreioUrl);
    } catch {
      const area = document.createElement("textarea");
      area.value = rastreioUrl;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function nova() {
    setHash(null);
    setErro(null);
    setSetor(contextoSetor ?? "");
    setSolicitante("");
    setItem("");
    setQuantidade("1");
    setJustificativa("");
    setValorEstimado("");
  }

  const campo =
    "min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 focus:outline-none disabled:opacity-60";

  // ---------- Confirmação + QR de acompanhamento ----------
  if (hash) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <PackageCheck className="mx-auto size-12 text-emerald-600" />
        <h2 className="mt-3 text-lg font-bold text-emerald-900">
          Solicitação registrada!
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          Guarde o QR Code abaixo para acompanhar o status do pedido.
        </p>
        <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 ring-1 ring-emerald-200">
          <QRCodeSVG
            value={rastreioUrl}
            size={180}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
        <button
          type="button"
          onClick={copiar}
          className="mx-auto mt-3 flex min-h-[44px] max-w-full items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100/50"
        >
          {copiado ? (
            <>
              <Check className="size-4 text-emerald-600" />
              Link copiado!
            </>
          ) : (
            <>
              <Copy className="size-4" />
              <span className="truncate font-mono text-xs">{rastreioUrl}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={nova}
          className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white transition active:scale-[0.99] hover:bg-emerald-700"
        >
          <Send className="size-5" />
          Nova solicitação
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
        <span className="icon-3d flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
          <ShoppingCart className="size-5" />
        </span>
        <div>
          <h1 className="text-base font-bold text-zinc-900">
            Solicitar material
          </h1>
          <p className="text-sm text-zinc-500">{hojeLabel()}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="setor"
              className="mb-1.5 block text-sm font-semibold text-zinc-800"
            >
              Setor / Unidade <span className="text-red-500">*</span>
            </label>
            <input
              id="setor"
              type="text"
              required
              minLength={2}
              maxLength={80}
              placeholder="Ex.: Elétrica"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              disabled={enviando || !!contextoSetor}
              className={campo}
            />
            {contextoSetor && (
              <p className="mt-1 text-xs text-zinc-400">Preenchido pelo QR — sem redigitar.</p>
            )}
          </div>
          <div>
            <label
              htmlFor="solicitante-compra"
              className="mb-1.5 block text-sm font-semibold text-zinc-800"
            >
              Seu nome <span className="text-red-500">*</span>
            </label>
            <input
              id="solicitante-compra"
              type="text"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              placeholder="Ex.: Carlos Souza"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              disabled={enviando}
              className={campo}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div>
            <label
              htmlFor="item"
              className="mb-1.5 block text-sm font-semibold text-zinc-800"
            >
              Item solicitado <span className="text-red-500">*</span>
            </label>
            <input
              id="item"
              type="text"
              required
              minLength={2}
              maxLength={160}
              placeholder="Ex.: Lâmpada LED 12W"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              disabled={enviando}
              className={campo}
            />
          </div>
          <div>
            <label
              htmlFor="quantidade"
              className="mb-1.5 block text-sm font-semibold text-zinc-800"
            >
              Qtd <span className="text-red-500">*</span>
            </label>
            <input
              id="quantidade"
              type="number"
              required
              min="0"
              step="0.01"
              inputMode="decimal"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={enviando}
              className={campo}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="justificativa"
            className="mb-1.5 block text-sm font-semibold text-zinc-800"
          >
            Justificativa <span className="text-red-500">*</span>
          </label>
          <textarea
            id="justificativa"
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            placeholder="Ex.: Reposição das lâmpadas queimadas do corredor do Bloco B."
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            disabled={enviando}
            className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="valor-estimado"
            className="mb-1.5 block text-sm font-semibold text-zinc-800"
          >
            Valor estimado (R$){" "}
            <span className="font-normal text-zinc-500">(opcional)</span>
          </label>
          <input
            id="valor-estimado"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={valorEstimado}
            onChange={(e) => setValorEstimado(e.target.value)}
            disabled={enviando}
            className={campo}
          />
          {valorEstimado !== "" && Number(valorEstimado) >= 0 && (
            <p className="mt-1.5 text-sm text-zinc-500">
              Estimativa total:{" "}
              <strong className="text-zinc-900">
                {formatarMoeda(Number(quantidade) * Number(valorEstimado))}
              </strong>
            </p>
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
            enviando ? "bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700",
          )}
        >
          {enviando ? (
            <>
              <LoaderCircle className="size-5 animate-spin" />
              Registrando…
            </>
          ) : (
            <>
              <Send className="size-5" />
              Enviar solicitação
            </>
          )}
        </button>
      </div>
    </form>
  );
}
