"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { uploadFotoAdmin } from "@/lib/storage";
import FotoAnexoInput from "@/app/admin/_components/FotoAnexoInput";
import GaleriaFotos from "@/app/admin/_components/GaleriaFotos";
import { adicionarFotosDurante } from "./actions";

/** Fotos DURANTE a execução (câmera/galeria + metadados usuário/data). */
export default function FotosDurante({
  chamadoId,
  paths,
  orgId,
}: {
  chamadoId: string;
  paths: string[];
  orgId: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(arquivos: File[]) {
    if (enviando || arquivos.length === 0) return;
    setErro(null);
    setEnviando(true);
    try {
      const subidos: string[] = [];
      for (let i = 0; i < arquivos.length; i++) {
        setFase(`Enviando foto ${i + 1} de ${arquivos.length}…`);
        const up = await uploadFotoAdmin(arquivos[i], "os", chamadoId);
        if (!up.ok) throw new Error(up.error);
        subidos.push(up.path);
      }
      setFase("Anexando…");
      const r = await adicionarFotosDurante({ chamadoId, paths: subidos });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setEnviando(false);
      setFase(null);
    }
  }

  return (
    <div className="space-y-3">
      <GaleriaFotos
        fotos={paths}
        legenda="Durante"
        vazio="Nenhuma foto do durante ainda."
        orgId={orgId}
      />
      <FotoAnexoInput
        aoSelecionar={enviar}
        desabilitado={enviando}
        maximo={6}
        rotulo={fase ?? "Adicionar fotos do durante"}
      />
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
