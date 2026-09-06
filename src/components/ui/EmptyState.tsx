/**
 * Estado vazio padronizado (Design System).
 * Toda lista/tabela sem resultados deve explicar o porquê e o próximo passo.
 */
export default function EmptyState({
  Icone,
  titulo,
  descricao,
  acao,
}: {
  Icone: (p: { className?: string }) => React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <Icone className="mx-auto size-10 text-zinc-300" />
      <p className="mt-2 font-bold text-zinc-700">{titulo}</p>
      {descricao && <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{descricao}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}
