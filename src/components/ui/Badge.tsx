import { cn } from "@/lib/utils";
import { TOM_CHIP, type Tom } from "./tokens";

/**
 * BLOCO 3.6 — Selo genérico (StatusBadge/OsStatusBadge seguem
 * domínio-específicos onde estão; este cobre rótulos simples).
 */
export default function Badge({
  tom = "zinc",
  children,
  className,
}: {
  tom?: Tom;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1",
        TOM_CHIP[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}
