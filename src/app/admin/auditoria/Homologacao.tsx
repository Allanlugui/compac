import { CircleCheck, CircleX, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckSaude {
  nome: string;
  descricao: string;
  ok: boolean;
}

/** Painel de homologação: verificações vivas do sistema. */
export default function Homologacao({ checks }: { checks: CheckSaude[] }) {
  const tudoOk = checks.length > 0 && checks.every((c) => c.ok);

  return (
    <section className="card-3d rounded-3xl border border-zinc-200/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-base font-black text-zinc-900">
          <span className="icon-3d flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <ShieldCheck className="size-4" />
          </span>
          Homologação do sistema
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1",
            tudoOk
              ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
              : "bg-red-100 text-red-800 ring-red-200",
          )}
        >
          {tudoOk ? (
            <CircleCheck className="size-3.5" />
          ) : (
            <CircleX className="size-3.5" />
          )}
          {tudoOk ? "Todos os checks OK" : "Falha em checks"}
        </span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <li
            key={check.nome}
            className={cn(
              "flex items-start gap-2.5 rounded-2xl p-3 ring-1",
              check.ok
                ? "bg-emerald-50/60 ring-emerald-200/70"
                : "bg-red-50/60 ring-red-200/70",
            )}
          >
            {check.ok ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            ) : (
              <CircleX className="mt-0.5 size-5 shrink-0 text-red-600" />
            )}
            <div>
              <p className="text-sm font-black text-zinc-900">{check.nome}</p>
              <p className="text-xs text-zinc-500">{check.descricao}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
