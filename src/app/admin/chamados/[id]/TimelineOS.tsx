import { formatarDataHora } from "@/lib/format";

export interface EventoOS {
  quando: string;
  titulo: string;
  detalhe?: string;
}

/**
 * Timeline da O.S. derivada de dados reais: abertura, mudanças de
 * status (auditoria), compras vinculadas e conclusão. Sem tabela nova.
 */
export default function TimelineOS({ eventos }: { eventos: EventoOS[] }) {
  const ordenados = [...eventos].sort((a, b) => +new Date(a.quando) - +new Date(b.quando));

  if (ordenados.length === 0) {
    return <p className="text-sm text-zinc-500">Sem eventos registrados.</p>;
  }

  return (
    <ol className="space-y-0">
      {ordenados.map((ev, i) => (
        <li key={`${ev.quando}-${i}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1 size-2.5 shrink-0 rounded-full bg-zinc-900" />
            {i < ordenados.length - 1 && <span className="w-0.5 flex-1 bg-zinc-200" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-black text-zinc-900">{ev.titulo}</p>
            <p className="text-xs text-zinc-500">{formatarDataHora(ev.quando)}</p>
            {ev.detalhe && <p className="mt-0.5 text-sm text-zinc-600">{ev.detalhe}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
