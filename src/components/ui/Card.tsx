import Link from "next/link";

/**
 * BLOCO 3.6 — Card canônico (consolida o `Card` local do dashboard).
 * Título + valor + detalhe + estados de dados + link opcional.
 */
export type EstadoCard = "ok" | "empty" | "insufficient_data" | "no_deadline" | "error";

export default function Card({
  titulo,
  valor,
  sub,
  href,
  estado = "ok",
}: {
  titulo: string;
  valor: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  estado?: EstadoCard;
}) {
  const inner = (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <div className="mt-2">
        {estado === "insufficient_data" ? (
          <p className="text-sm font-medium text-amber-700">Dados insuficientes</p>
        ) : estado === "empty" ? (
          <p className="text-sm text-zinc-500">Nenhum dado no período</p>
        ) : estado === "no_deadline" ? (
          <p className="text-sm text-zinc-500">Sem prazo</p>
        ) : estado === "error" ? (
          <p className="text-sm text-red-600">Erro ao carregar</p>
        ) : (
          <p className="text-2xl font-black tabular-nums">{valor}</p>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block transition hover:shadow-md">
        {inner}
      </Link>
    );
  }
  return inner;
}
