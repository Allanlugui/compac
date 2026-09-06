"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Printer,
  QrCode,
} from "lucide-react";
import type { Ativo } from "@/lib/types";

interface AtivosGridProps {
  ativos: Ativo[];
  /** Origem pública do site (NEXT_PUBLIC_SITE_URL). Se vazio, usa a origem atual. */
  siteUrl: string;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AtivosGrid({ ativos, siteUrl }: AtivosGridProps) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState<Ativo | null>(null);

  const origem =
    siteUrl !== ""
      ? siteUrl.replace(/\/+$/, "")
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  const urlDoAtivo = (ativo: Ativo) => `${origem}/qr/${ativo.qr_code_hash}`;

  // Limpa a etiqueta após o diálogo de impressão ser fechado.
  useEffect(() => {
    const limpar = () => setEtiqueta(null);
    window.addEventListener("afterprint", limpar);
    return () => window.removeEventListener("afterprint", limpar);
  }, []);

  async function copiarLink(ativo: Ativo) {
    const url = urlDoAtivo(ativo);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopiadoId(ativo.id);
    setTimeout(() => {
      setCopiadoId((atual) => (atual === ativo.id ? null : atual));
    }, 2000);
  }

  function imprimir(ativo: Ativo) {
    setEtiqueta(ativo);
    // Aguarda a etiqueta de impressão entrar no DOM antes de chamar print().
    setTimeout(() => window.print(), 100);
  }

  if (ativos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center print:hidden">
        <QrCode className="mx-auto size-10 text-zinc-300" />
        <p className="mt-2 font-semibold text-zinc-700">
          Nenhum ativo cadastrado
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastre o primeiro ativo no formulário acima para gerar seu QR Code.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {ativos.map((ativo) => {
          const url = urlDoAtivo(ativo);
          const copiado = copiadoId === ativo.id;
          return (
            <article
              key={ativo.id}
              className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-zinc-900">
                  {ativo.nome}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-500">
                  <MapPin className="size-3.5 shrink-0" />
                  {ativo.localizacao || "Sem localização"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                  <CalendarDays className="size-3.5 shrink-0" />
                  {formatarData(ativo.created_at)}
                </p>
              </div>

              <div className="mx-auto mt-4 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                <QRCodeSVG
                  value={url}
                  size={160}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="mt-2 truncate text-center font-mono text-[11px] text-zinc-400">
                {url}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => copiarLink(ativo)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  {copiado ? (
                    <>
                      <Check className="size-4 text-emerald-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copiar link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => imprimir(ativo)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  <Printer className="size-4" />
                  Imprimir
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Etiqueta de impressão: visível SOMENTE no @media print. */}
      {etiqueta && (
        <div className="print-label fixed inset-0 hidden items-center justify-center bg-white print:flex">
          <div className="border-2 border-zinc-900 p-8 text-center">
            <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Manutenção · Escaneie para abrir um chamado
            </p>
            <p className="mt-2 text-2xl font-bold text-black">
              {etiqueta.nome}
            </p>
            {etiqueta.localizacao && (
              <p className="mt-1 text-sm text-zinc-600">
                {etiqueta.localizacao}
              </p>
            )}
            <div className="mx-auto mt-4 w-fit bg-white p-2">
              <QRCodeSVG
                value={urlDoAtivo(etiqueta)}
                size={256}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <p className="mt-3 font-mono text-xs break-all text-zinc-500">
              {urlDoAtivo(etiqueta)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
