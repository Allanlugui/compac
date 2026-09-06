import type { Metadata } from "next";
import { Receipt, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ChamadoStatus, Compra } from "@/lib/types";
import { formatarMoeda, numeroOS } from "@/lib/format";
import { cn } from "@/lib/utils";
import NovaCompraForm from "./NovaCompraForm";
import TabelaCompras from "./TabelaCompras";

export const metadata: Metadata = {
  title: "Compras · SGA-M",
  description: "Gestão financeira de compras e insumos.",
};

const STATUS_VINCULAVEIS: ChamadoStatus[] = ["aberto", "em_andamento"];

export default async function ComprasPage() {
  const supabase = await createClient();

  const [{ data: comprasData }, { data: chamadosData }] = await Promise.all([
    supabase
      .from("compras")
      .select("*")
      .order("data_compra", { ascending: false }),
    supabase
      .from("chamados")
      .select("id, status, ativos(id, nome)")
      .order("created_at", { ascending: false }),
  ]);

  const compras = ((comprasData ?? []) as Compra[]).slice().sort(
    (a, b) => +new Date(b.data_compra) - +new Date(a.data_compra),
  );

  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  const totalGeral = compras.reduce(
    (soma, c) => soma + Number(c.valor_total ?? 0),
    0,
  );
  const totalMes = compras
    .filter((c) => c.data_compra.slice(0, 7) === mesAtual)
    .reduce((soma, c) => soma + Number(c.valor_total ?? 0), 0);
  const mediaPorCompra = compras.length > 0 ? totalGeral / compras.length : 0;

  // Rótulos "OS XXXXXXXX · Ativo" para os vínculos exibidos na tabela.
  const vinculos: Record<string, string> = {};
  for (const ch of (chamadosData ?? []) as {
    id: string;
    ativos: { nome: string } | { nome: string }[] | null;
  }[]) {
    const ativos = ch.ativos;
    const nome = Array.isArray(ativos)
      ? (ativos[0]?.nome ?? "Ativo removido")
      : (ativos?.nome ?? "Ativo removido");
    vinculos[ch.id] = `OS ${numeroOS(ch.id)} · ${nome}`;
  }

  // Opções de vinculação: apenas chamados ainda não concluídos.
  const opcoesVinculo = ((chamadosData ?? []) as {
    id: string;
    status: ChamadoStatus;
  }[])
    .filter((ch) => STATUS_VINCULAVEIS.includes(ch.status))
    .map((ch) => ({
      id: ch.id,
      rotulo: `${vinculos[ch.id]} (${ch.status === "aberto" ? "aberto" : "em andamento"})`,
    }));

  const kpis = [
    {
      rotulo: "Gasto no mês atual",
      valor: formatarMoeda(totalMes),
      Icone: Wallet,
      classes: "bg-emerald-100 text-emerald-700",
    },
    {
      rotulo: "Média por compra",
      valor: formatarMoeda(mediaPorCompra),
      Icone: TrendingUp,
      classes: "bg-sky-100 text-sky-700",
    },
    {
      rotulo: "Total geral",
      valor: formatarMoeda(totalGeral),
      Icone: Receipt,
      classes: "bg-zinc-900 text-white",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Compras</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Controle financeiro de materiais, peças e despesas gerais.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map(({ rotulo, valor, Icone, classes }) => (
          <div
            key={rotulo}
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                classes,
              )}
            >
              <Icone className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl leading-none font-bold text-zinc-900">
                {valor}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500">{rotulo}</p>
            </div>
          </div>
        ))}
      </div>

      <NovaCompraForm chamados={opcoesVinculo} />
      <TabelaCompras compras={compras} vinculos={vinculos} />
    </div>
  );
}
