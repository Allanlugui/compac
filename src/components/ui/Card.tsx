import { cn } from "@/lib/utils";

/**
 * Cartão de seção do Design System (estilo enterprise contido).
 * Para superfícies com elevação 3D, usar `.card-3d` diretamente.
 */
export default function Card({
  titulo,
  descricao,
  acao,
  children,
  className,
}: {
  titulo?: string;
  descricao?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {(titulo || acao) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {titulo && (
              <h2 className="text-base font-extrabold text-zinc-900">{titulo}</h2>
            )}
            {descricao && (
              <p className="mt-0.5 text-sm text-zinc-500">{descricao}</p>
            )}
          </div>
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}
