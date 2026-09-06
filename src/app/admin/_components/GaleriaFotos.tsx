import { Images } from "lucide-react";

interface GaleriaFotosProps {
  fotos: string[];
  legenda: string;
  vazio?: string;
}

/** Grade de fotos com link para a imagem original em nova aba. */
export default function GaleriaFotos({ fotos, legenda, vazio }: GaleriaFotosProps) {
  if (fotos.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200">
        <Images className="size-4 shrink-0" />
        {vazio ?? "Nenhuma foto registrada."}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {fotos.map((url, i) => (
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          title={`${legenda} ${i + 1} — abrir original`}
          className="group relative block overflow-hidden rounded-2xl ring-1 ring-zinc-200 transition-shadow hover:shadow-xl hover:ring-zinc-300"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${legenda} ${i + 1}`}
            loading="lazy"
            className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
          />
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {legenda} {i + 1}
          </span>
        </a>
      ))}
    </div>
  );
}
