import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * BLOCO 3.6 — Botão canônico (consolida `botaoPrimario` espalhados).
 * Primária = 1 por contexto; demais = `secondary`/`ghost`/`danger`.
 */
type Variante = "primary" | "secondary" | "danger" | "ghost";
type Tamanho = "md" | "sm";

const VARIANTES: Record<Variante, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700 ring-zinc-900",
  secondary: "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-100",
  danger: "bg-white text-red-600 ring-red-300 hover:bg-red-50",
  ghost: "text-zinc-600 hover:bg-zinc-100",
};

const TAMANHOS: Record<Tamanho, string> = {
  md: "min-h-[44px] px-4 text-sm",
  sm: "min-h-[40px] px-3 text-xs",
};

export default function Button({
  variante = "primary",
  tamanho = "md",
  href,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: Tamanho;
  href?: string;
}) {
  const cls = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold ring-1 transition disabled:opacity-60",
    VARIANTES[variante],
    TAMANHOS[tamanho],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {props.children}
      </Link>
    );
  }
  return <button type="button" className={cls} {...props} />;
}
