import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Link do sino com badge (recebe a contagem por prop — usável
 * dentro de Client Components como a sidebar).
 */
export default function SinoLink({
  total,
  mobile,
}: {
  total: number;
  mobile?: boolean;
}) {
  return (
    <Link
      href="/admin/notificacoes"
      aria-label={total > 0 ? `${total} notificações não lidas` : "Notificações"}
      title="Notificações"
      className={
        mobile
          ? "relative inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-200/60"
          : "relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/5 hover:text-white"
      }
    >
      <Bell className="size-5 shrink-0" />
      {total > 0 && (
        <span
          className={cn(
            "absolute flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white tabular-nums",
            mobile ? "top-0.5 right-0.5" : "-top-0.5 -right-0.5",
          )}
        >
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}
