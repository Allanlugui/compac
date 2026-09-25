/**
 * BLOCO 3.6 — Tokens do Design System SGA-M.
 * Base: Tailwind + tons semânticos já usados. Sem nova identidade.
 * Regras: touch ≥44px, raio padrão 2xl, foco sempre visível.
 */

export const TOUCH_MD = "min-h-[44px]";
export const TOUCH_SM = "min-h-[40px]";

export const RADIUS = "rounded-2xl";
export const RADIUS_SM = "rounded-xl";

export const SURFACE = "border border-zinc-200 bg-white shadow-sm";
export const SURFACE_SOFT = "bg-zinc-50 ring-1 ring-zinc-200/70";

export const FOCUS =
  "focus:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20";

export const TEXT_TITULO = "text-2xl font-extrabold tracking-tight text-zinc-900";
export const TEXT_SECAO = "text-sm font-black uppercase tracking-wide text-zinc-700";
export const TEXT_ROTULO = "mb-1 block text-xs font-bold tracking-wide text-zinc-500 uppercase";
export const TEXT_CORPO = "text-sm text-zinc-900";
export const TEXT_APOIO = "text-xs text-zinc-500";

export const CAMPO_BASE = `min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:opacity-60 ${FOCUS}`;

export type Tom = "amber" | "sky" | "emerald" | "violet" | "rose" | "zinc";

export const TOM_CHIP: Record<Tom, string> = {
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  rose: "bg-rose-100 text-rose-700",
  zinc: "bg-zinc-900 text-white",
};
