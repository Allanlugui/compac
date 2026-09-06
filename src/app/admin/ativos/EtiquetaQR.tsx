"use client";

import { QRCodeSVG } from "qrcode.react";

export interface DadosEtiqueta {
  nome: string;
  codigo: string | null;
  localizacao: string | null;
  hash: string;
}

/**
 * Etiqueta profissional do ativo (FASE 2):
 * SGA-M · nome · código · QR · instrução. Reuso individual e em lote.
 */
export default function EtiquetaQR({
  ativo,
  url,
  orgNome,
  tamanho = 220,
}: {
  ativo: DadosEtiqueta;
  url: string;
  orgNome: string;
  tamanho?: number;
}) {
  return (
    <div className="border-2 border-zinc-900 bg-white p-6 text-center text-black">
      <p className="text-xs font-black tracking-widest uppercase">
        {orgNome} · SGA-M
      </p>
      {ativo.codigo && (
        <p className="mt-1 font-mono text-sm font-bold tracking-widest">
          {ativo.codigo}
        </p>
      )}
      <p className="mt-1 text-xl font-black">{ativo.nome}</p>
      {ativo.localizacao && (
        <p className="mt-0.5 text-sm text-zinc-600">{ativo.localizacao}</p>
      )}
      <div className="mx-auto mt-4 w-fit bg-white p-2">
        <QRCodeSVG
          value={url}
          size={tamanho}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <p className="mt-3 text-xs font-semibold tracking-wide uppercase">
        Escaneie para solicitar manutenção
      </p>
      <p className="mt-1 font-mono text-[10px] break-all text-zinc-500">{url}</p>
    </div>
  );
}
