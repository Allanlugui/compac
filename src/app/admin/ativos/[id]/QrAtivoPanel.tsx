"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  Download,
  FlaskConical,
  LoaderCircle,
  Printer,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { formatarDataHora } from "@/lib/format";
import EtiquetaQR from "../EtiquetaQR";
import { marcarQrImpresso, regenerarQR } from "../actions";

/** Seção 9 · QR: visualizar, baixar, imprimir, copiar, testar, regenerar. */
export default function QrAtivoPanel({
  ativo,
  url,
  orgNome,
}: {
  ativo: {
    id: string;
    nome: string;
    codigo: string | null;
    localizacao: string | null;
    hash: string;
    impressoEm: string | null;
  };
  url: string;
  orgNome: string;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [regen, setRegen] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function copiar() {
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
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function baixar() {
    const svg = document.getElementById("qr-ativo-svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${ativo.codigo ?? ativo.hash.slice(0, 8)}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function imprimir() {
    try {
      await marcarQrImpresso({ ids: [ativo.id] });
    } catch {
      // Best-effort.
    }
    window.print();
  }

  async function regenerar() {
    if (ocupado) return;
    setErro(null);
    setOcupado(true);
    try {
      const r = await regenerarQR({ id: ativo.id });
      if (!r.ok) throw new Error(r.error);
      setRegen(false);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setOcupado(false);
    }
  }

  const btn =
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm print:border-0 print:shadow-none">
        <div className="mx-auto w-fit rounded-xl bg-white p-3 ring-1 ring-zinc-200 print:ring-0">
          <QRCodeSVG
            id="qr-ativo-svg"
            value={url}
            size={220}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
        <p className="mt-3 font-mono text-xs break-all text-zinc-500">{url}</p>
        <p className="mt-1 text-xs text-zinc-400">
          {ativo.impressoEm
            ? `Última impressão: ${formatarDataHora(ativo.impressoEm)}`
            : "Nunca impresso"}
          {" · "}
          {ativo.hash.length <= 12 ? "QR legado (12)" : "QR seguro (24)"}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
          <button type="button" onClick={copiar} className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}>
            {copiado ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          <button type="button" onClick={baixar} className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}>
            <Download className="size-4" />
            Baixar SVG
          </button>
          <button type="button" onClick={imprimir} className={`${btn} bg-zinc-900 text-white hover:bg-zinc-700`}>
            <Printer className="size-4" />
            Imprimir etiqueta
          </button>
          <a href={url} target="_blank" rel="noreferrer" className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}>
            <FlaskConical className="size-4" />
            Testar QR
          </a>
        </div>

        <div className="mt-3 print:hidden">
          {!regen ? (
            <button
              type="button"
              onClick={() => setRegen(true)}
              className="text-xs font-bold text-red-600 underline-offset-2 hover:underline"
            >
              Regenerar token (invalida etiquetas impressas)
            </button>
          ) : (
            <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
              <p className="text-xs font-bold text-red-800">
                Etiquetas impressas com o QR atual deixarão de funcionar. Confirmar?
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={regenerar} disabled={ocupado} className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60">
                  {ocupado ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Sim, regenerar
                </button>
                <button type="button" onClick={() => setRegen(false)} disabled={ocupado} className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-white px-4 text-xs font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        {erro && (
          <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-700 ring-1 ring-red-200 print:hidden">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </div>

      {/* Etiqueta de impressão (somente @media print). */}
      <div className="hidden print:block">
        <EtiquetaQR
          ativo={{ nome: ativo.nome, codigo: ativo.codigo, localizacao: ativo.localizacao, hash: ativo.hash }}
          url={url}
          orgNome={orgNome}
        />
      </div>
    </div>
  );
}
