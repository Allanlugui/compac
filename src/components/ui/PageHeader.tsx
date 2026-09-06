import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Cabeçalho padrão das páginas (Design System).
 * Título + descrição + ações alinhadas, com link "voltar" opcional.
 */
export default function PageHeader({
  titulo,
  descricao,
  voltar,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  voltar?: { href: string; rotulo: string };
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {voltar && (
          <Link
            href={voltar.href}
            className="mb-1 inline-flex min-h-[32px] items-center gap-1 text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
          >
            <ArrowLeft className="size-4" />
            {voltar.rotulo}
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
          {titulo}
        </h1>
        {descricao && <p className="mt-0.5 text-sm text-zinc-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
