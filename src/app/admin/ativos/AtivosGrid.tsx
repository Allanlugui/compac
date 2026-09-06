"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Printer,
  QrCode,
} from "lucide-react";
import type { AtivoCompleto } from "@/lib/types";
import AtivoStatusBadge from "@/app/admin/_components/AtivoStatusBadge";
import EtiquetaQR from "./EtiquetaQR";
import { marcarQrImpresso } from "./actions";

export interface AtivoLista extends Pick<
  AtivoCompleto,
  "id" | "nome" | "codigo" | "status" | "localizacao" | "qr_code_hash" | "created_at"
> {
  categoria_nome: string | null;
  localidade_nome: string | null;
}

interface AtivosGridProps {
  ativos: AtivoLista[];
  /** Origem pública do site (NEXT_PUBLIC_SITE_URL). Se vazio, usa a origem atual. */
  siteUrl: string;
  orgNome: string;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AtivosGrid({ ativos, siteUrl, orgNome }: AtivosGridProps) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<AtivoLista[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const origem =
    siteUrl !== ""
      ? siteUrl.replace(/\/+$/, "")
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  const urlDoAtivo = (ativo: Pick<AtivoLista, "qr_code_hash">) => `${origem}/qr/${ativo.qr_code_hash}`;

  // Limpa as etiquetas após o diálogo de impressão ser fechado.
  useEffect(() => {
    const limpar = () => setEtiquetas(null);
    window.addEventListener("afterprint", limpar);
    return () => window.removeEventListener("afterprint", limpar);
  }, []);

  async function copiarLink(ativo: AtivoLista) {
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

  async function imprimir(lista: AtivoLista[]) {
    if (lista.length === 0) return;
    setEtiquetas(lista);
    try {
      await marcarQrImpresso({ ids: lista.map((a) => a.id) });
    } catch {
      // Best-effort: a impressão segue mesmo sem carimbo.
    }
    // Aguarda as etiquetas entrarem no DOM antes de chamar print().
    setTimeout(() => window.print(), 150);
  }

  function alternar(id: string) {
    setSelecionados((atuais) => {
      const prox = new Set(atuais);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  }

  if (ativos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center print:hidden">
        <QrCode className="mx-auto size-10 text-zinc-300" />
        <p className="mt-2 font-semibold text-zinc-700">
          Nenhum ativo com estes filtros
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Ajuste os filtros ou cadastre um novo ativo acima.
        </p>
      </div>
    );
  }

  const selLista = ativos.filter((a) => selecionados.has(a.id));

  return (
    <>
      {selecionados.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white print:hidden">
          <span>{selecionados.size} selecionado(s)</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => imprimir(selLista)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white px-4 text-zinc-900 transition hover:bg-zinc-200"
            >
              <Printer className="size-4" />
              Imprimir lote
            </button>
            <button
              type="button"
              onClick={() => setSelecionados(new Set())}
              className="inline-flex min-h-[40px] items-center rounded-xl px-3 text-zinc-300 hover:text-white"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {ativos.map((ativo) => {
          const url = urlDoAtivo(ativo);
          const copiado = copiadoId === ativo.id;
          const sel = selecionados.has(ativo.id);
          return (
            <article
              key={ativo.id}
              className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${sel ? "border-zinc-900 ring-2 ring-zinc-900" : "border-zinc-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => alternar(ativo.id)}
                    aria-label={`Selecionar ${ativo.nome} para impressão em lote`}
                    className="size-4 accent-zinc-900"
                  />
                  Lote
                </label>
                <AtivoStatusBadge status={ativo.status} />
              </div>
              <Link href={`/admin/ativos/${ativo.id}`} className="mt-2 block min-w-0 hover:underline">
                <h3 className="truncate text-base font-bold text-zinc-900">
                  {ativo.codigo ? `${ativo.codigo} · ` : ""}{ativo.nome}
                </h3>
              </Link>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-500">
                <MapPin className="size-3.5 shrink-0" />
                {ativo.localidade_nome || ativo.localizacao || "Sem localização"}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <CalendarDays className="size-3.5 shrink-0" />
                {formatarData(ativo.created_at)}
                {ativo.categoria_nome ? ` · ${ativo.categoria_nome}` : ""}
              </p>

              <Link href={`/admin/ativos/${ativo.id}`} className="mx-auto mt-4 rounded-xl bg-white p-3 ring-1 ring-zinc-200 transition hover:ring-zinc-400" aria-label={`Abrir ${ativo.nome}`}>
                <QRCodeSVG
                  value={url}
                  size={140}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </Link>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => copiarLink(ativo)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-zinc-300 px-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  {copiado ? (
                    <>
                      <Check className="size-4 text-emerald-600" />
                      OK
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => imprimir([ativo])}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-zinc-900 px-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
                >
                  <Printer className="size-4" />
                  Etiqueta
                </button>
                <Link
                  href={`/admin/ativos/${ativo.id}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-300 px-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Detalhe
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* Etiquetas: visíveis SOMENTE no @media print (individual ou lote). */}
      {etiquetas && (
        <div className="hidden print:block">
          {etiquetas.map((a) => (
            <div key={a.id} className="mb-6 break-after-page last:mb-0 last:break-after-avoid">
              <EtiquetaQR
                ativo={{ nome: a.nome, codigo: a.codigo, localizacao: a.localidade_nome || a.localizacao, hash: a.qr_code_hash }}
                url={urlDoAtivo(a)}
                orgNome={orgNome}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
