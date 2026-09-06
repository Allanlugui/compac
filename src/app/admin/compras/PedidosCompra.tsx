"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  Check,
  CircleX,
  Clock,
  LoaderCircle,
  PackageCheck,
  ShoppingCart,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import type { SolicitacaoCompra, SolicitacaoCompraStatus } from "@/lib/types";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { atualizarStatusPedido, efetivarPedido } from "./pedidos";

type Filtro = "todas" | SolicitacaoCompraStatus;

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "aprovado", rotulo: "Aprovados" },
  { id: "rejeitado", rotulo: "Rejeitados" },
  { id: "comprado", rotulo: "Comprados" },
];

const BADGE: Record<
  SolicitacaoCompraStatus,
  { rotulo: string; classes: string; Icone: (p: { className?: string }) => React.ReactNode }
> = {
  rascunho: {
    rotulo: "Rascunho",
    classes: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    Icone: Clock,
  },
  enviada: {
    rotulo: "Enviada",
    classes: "bg-sky-100 text-sky-800 ring-sky-200",
    Icone: Clock,
  },
  em_analise: {
    rotulo: "Em análise",
    classes: "bg-yellow-100 text-yellow-800 ring-yellow-200",
    Icone: Clock,
  },
  aprovada: {
    rotulo: "Aprovada",
    classes: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    Icone: BadgeCheck,
  },
  rejeitada: {
    rotulo: "Rejeitada",
    classes: "bg-red-100 text-red-800 ring-red-200",
    Icone: CircleX,
  },
  em_cotacao: {
    rotulo: "Em cotação",
    classes: "bg-violet-100 text-violet-800 ring-violet-200",
    Icone: ShoppingCart,
  },
  pedido_gerado: {
    rotulo: "Pedido gerado",
    classes: "bg-indigo-100 text-indigo-800 ring-indigo-200",
    Icone: PackageCheck,
  },
  recebida: {
    rotulo: "Recebida",
    classes: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    Icone: PackageCheck,
  },
  encerrada: {
    rotulo: "Encerrada",
    classes: "bg-zinc-200 text-zinc-500 ring-zinc-300",
    Icone: Check,
  },
  cancelada: {
    rotulo: "Cancelada",
    classes: "bg-zinc-200 text-zinc-500 ring-zinc-300",
    Icone: X,
  },
  pendente: {
    rotulo: "Pendente",
    classes: "bg-amber-100 text-amber-800 ring-amber-200",
    Icone: Clock,
  },
  aprovado: {
    rotulo: "Aprovado",
    classes: "bg-sky-100 text-sky-800 ring-sky-200",
    Icone: BadgeCheck,
  },
  rejeitado: {
    rotulo: "Rejeitado",
    classes: "bg-red-100 text-red-800 ring-red-200",
    Icone: CircleX,
  },
  comprado: {
    rotulo: "Comprado",
    classes: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    Icone: PackageCheck,
  },
};

function hojeISO(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function FormEfetivar({
  pedido,
  aoFechar,
  aoSalvar,
  salvando,
}: {
  pedido: SolicitacaoCompra;
  aoFechar: () => void;
  aoSalvar: (dados: { valorUnitario: number; setor: string; dataCompra: string }) => void;
  salvando: boolean;
}) {
  const estimado = Number(pedido.valor_estimado ?? 0);
  const qtd = Number(pedido.quantidade ?? 1);
  const [valorUnitario, setValorUnitario] = useState(
    estimado > 0 && qtd > 0 ? String(Math.round((estimado / qtd) * 100) / 100) : "",
  );
  const [setor, setSetor] = useState(pedido.setor);
  const [dataCompra, setDataCompra] = useState(hojeISO());

  const campo =
    "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar({ valorUnitario: Number(valorUnitario), setor, dataCompra });
      }}
      className="mt-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4"
    >
      <h4 className="flex items-center gap-2 text-sm font-black text-zinc-900">
        <Banknote className="size-4" />
        Efetivar compra
      </h4>
      <p className="mt-0.5 text-xs text-zinc-500">
        Confirme o valor real pago. A compra entra no financeiro e o pedido é
        marcado como comprado.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">
            Valor unitário real (R$) *
          </span>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
            disabled={salvando}
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">Setor</span>
          <input
            type="text"
            maxLength={80}
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            disabled={salvando}
            className={campo}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-zinc-700">
            Data da compra
          </span>
          <input
            type="date"
            value={dataCompra}
            onChange={(e) => setDataCompra(e.target.value)}
            disabled={salvando}
            className={campo}
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-none sm:px-8"
        >
          {salvando ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Confirmar compra
        </button>
        <button
          type="button"
          onClick={aoFechar}
          disabled={salvando}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-4 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-60"
        >
          <X className="size-4" />
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function PedidosCompra({
  pedidos,
}: {
  pedidos: SolicitacaoCompra[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [efetivandoId, setEfetivandoId] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const contagem = useMemo(() => {
    const mapa: Record<Filtro, number> = {
      todas: pedidos.length,
      rascunho: 0,
      enviada: 0,
      em_analise: 0,
      aprovada: 0,
      rejeitada: 0,
      em_cotacao: 0,
      pedido_gerado: 0,
      recebida: 0,
      encerrada: 0,
      cancelada: 0,
      pendente: 0,
      aprovado: 0,
      rejeitado: 0,
      comprado: 0,
    };
    for (const p of pedidos) mapa[p.status] += 1;
    return mapa;
  }, [pedidos]);

  const visiveis = useMemo(
    () => (filtro === "todas" ? pedidos : pedidos.filter((p) => p.status === filtro)),
    [pedidos, filtro],
  );

  async function trocarStatus(id: string, status: SolicitacaoCompraStatus) {
    if (
      status === "rejeitado" &&
      !window.confirm("Rejeitar este pedido? O solicitante verá o status.")
    ) {
      return;
    }
    setErro(null);
    setProcessando(id);
    try {
      const resultado = await atualizarStatusPedido({ id, status });
      if (!resultado.ok) throw new Error(resultado.error);
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setProcessando(null);
    }
  }

  async function salvarEfetivacao(
    id: string,
    dados: { valorUnitario: number; setor: string; dataCompra: string },
  ) {
    setErro(null);
    setProcessando(id);
    try {
      const resultado = await efetivarPedido({ solicitacaoId: id, ...dados });
      if (!resultado.ok) throw new Error(resultado.error);
      setEfetivandoId(null);
      router.refresh();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      );
    } finally {
      setProcessando(null);
    }
  }

  const botaoBase =
    "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold transition disabled:opacity-60";

  return (
    <section className="card-3d rounded-3xl border border-zinc-200/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-zinc-900">
            Pedidos de compra via QR Code
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Aprove, rejeite e efetive as solicitações dos colaboradores.
          </p>
        </div>
        {contagem.pendente > 0 && (
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-zinc-950 tabular-nums">
            {contagem.pendente} aguardando
          </span>
        )}
      </div>

      {/* Filtros por status */}
      <div className="mt-4 flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/70 bg-zinc-200/60 p-1.5">
        {FILTROS.map(({ id, rotulo }) => {
          const ativo = filtro === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              aria-pressed={ativo}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap transition-all",
                ativo
                  ? "scale-[1.02] bg-white text-zinc-900 shadow-md ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:bg-white/50 hover:text-zinc-800",
              )}
            >
              {rotulo}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  ativo ? "bg-zinc-900 text-white" : "bg-zinc-300/60 text-zinc-600",
                )}
              >
                {contagem[id]}
              </span>
            </button>
          );
        })}
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      {visiveis.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
          <ShoppingCart className="mx-auto size-9 text-zinc-300" />
          <p className="mt-2 text-sm font-bold text-zinc-600">
            Nenhum pedido neste filtro
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Novos pedidos chegam pelo QR de compras.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {visiveis.map((pedido) => {
            const badge = BADGE[pedido.status];
            const ocupado = processando === pedido.id;
            const expandido = expandidoId === pedido.id;
            return (
              <li
                key={pedido.id}
                className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-zinc-900">
                      {pedido.item} · {String(pedido.quantidade)}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {pedido.setor} · {pedido.solicitante} ·{" "}
                      {formatarDataHora(pedido.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1",
                      badge.classes,
                    )}
                  >
                    <badge.Icone className="size-3" />
                    {badge.rotulo}
                  </span>
                </div>

                <p
                  className={cn(
                    "mt-2 text-sm text-zinc-600",
                    !expandido && "line-clamp-2",
                  )}
                >
                  {pedido.justificativa}
                </p>
                <button
                  type="button"
                  onClick={() => setExpandidoId(expandido ? null : pedido.id)}
                  className="mt-1 text-xs font-bold text-zinc-500 underline-offset-2 hover:underline"
                >
                  {expandido ? "ver menos" : "ver justificativa completa"}
                </button>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                  <p className="text-xs text-zinc-500">
                    Estimativa:{" "}
                    <strong className="text-sm text-zinc-900">
                      {formatarMoeda(Number(pedido.valor_estimado ?? 0))}
                    </strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pedido.status === "pendente" && (
                      <>
                        <button
                          type="button"
                          disabled={processando !== null}
                          onClick={() => trocarStatus(pedido.id, "aprovado")}
                          className={cn(botaoBase, "bg-sky-600 text-white hover:bg-sky-700")}
                        >
                          {ocupado ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                          Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={processando !== null}
                          onClick={() => trocarStatus(pedido.id, "rejeitado")}
                          className={cn(
                            botaoBase,
                            "border border-red-200 text-red-600 hover:bg-red-50",
                          )}
                        >
                          <X className="size-4" />
                          Rejeitar
                        </button>
                      </>
                    )}
                    {pedido.status === "aprovado" &&
                      (efetivandoId === pedido.id ? null : (
                        <button
                          type="button"
                          disabled={processando !== null}
                          onClick={() => setEfetivandoId(pedido.id)}
                          className={cn(
                            botaoBase,
                            "bg-emerald-600 text-white hover:bg-emerald-700",
                          )}
                        >
                          <PackageCheck className="size-4" />
                          Efetivar compra
                        </button>
                      ))}
                    {pedido.status === "rejeitado" && (
                      <button
                        type="button"
                        disabled={processando !== null}
                        onClick={() => trocarStatus(pedido.id, "pendente")}
                        className={cn(
                          botaoBase,
                          "border border-zinc-300 text-zinc-600 hover:bg-zinc-50",
                        )}
                      >
                        {ocupado ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Undo2 className="size-4" />
                        )}
                        Reabrir
                      </button>
                    )}
                    {pedido.status === "comprado" && (
                      <span className="inline-flex min-h-[40px] items-center text-xs font-bold text-emerald-700">
                        <Check className="mr-1 size-4" />
                        No financeiro
                      </span>
                    )}
                  </div>
                </div>

                {efetivandoId === pedido.id && (
                  <FormEfetivar
                    pedido={pedido}
                    salvando={ocupado}
                    aoFechar={() => setEfetivandoId(null)}
                    aoSalvar={(dados) => salvarEfetivacao(pedido.id, dados)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
