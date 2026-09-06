"use client";

import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";

/**
 * Entrada transversal de fotos (FASE 2): câmera OU galeria.
 * Funciona em smartphone (câmera nativa via `capture`), tablet e desktop
 * (o navegador abre o seletor quando não há câmera). Validação real de
 * MIME/tamanho acontece no servidor (allowlist).
 */
export default function FotoAnexoInput({
  aoSelecionar,
  desabilitado,
  maximo = 6,
  rotulo,
}: {
  aoSelecionar: (arquivos: File[]) => void;
  desabilitado?: boolean;
  maximo?: number;
  rotulo?: string;
}) {
  const refCamera = useRef<HTMLInputElement>(null);
  const refGaleria = useRef<HTMLInputElement>(null);

  function receber(lista: FileList | null) {
    if (!lista) return;
    aoSelecionar(Array.from(lista).slice(0, maximo));
  }

  const botao =
    "inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:opacity-50";

  return (
    <div>
      {rotulo && (
        <p className="mb-1.5 text-sm font-semibold text-zinc-800">{rotulo}</p>
      )}
      <input
        ref={refCamera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          receber(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={refGaleria}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          receber(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => refCamera.current?.click()}
          disabled={desabilitado}
          className={`${botao} bg-zinc-900 text-white hover:bg-zinc-700`}
        >
          <Camera className="size-5" />
          Tirar foto
        </button>
        <button
          type="button"
          onClick={() => refGaleria.current?.click()}
          disabled={desabilitado}
          className={`${botao} border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100`}
        >
          <ImagePlus className="size-5" />
          Galeria
        </button>
      </div>
    </div>
  );
}
