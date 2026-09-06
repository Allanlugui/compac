"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarMoeda } from "@/lib/format";

export interface PontoMensal {
  mes: string;
  total: number;
}

export interface FatiaSetor {
  name: string;
  value: number;
}

export interface LinhaRanking {
  name: string;
  chamados: number;
}

const CORES_SETOR = [
  "#18181b",
  "#f59e0b",
  "#0ea5e9",
  "#10b981",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
  "#64748b",
];

const moedaCompacta = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 1,
});

function CartaoGrafico({
  titulo,
  descricao,
  children,
  altura = "h-72",
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  altura?: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm break-inside-avoid print:shadow-none">
      <h2 className="text-base font-bold text-zinc-900">{titulo}</h2>
      <p className="mt-0.5 text-sm text-zinc-500">{descricao}</p>
      <div className={`${altura} mt-4 w-full`}>{children}</div>
    </section>
  );
}

export default function GraficosRelatorio({
  gastosMes,
  gastosSetor,
  ranking,
}: {
  gastosMes: PontoMensal[];
  gastosSetor: FatiaSetor[];
  ranking: LinhaRanking[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CartaoGrafico
        titulo="Evolução dos gastos"
        descricao="Total de compras e insumos por mês"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={gastosMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#d4d4d8" }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => moedaCompacta.format(v)}
            />
            <Tooltip
              formatter={(v) => [formatarMoeda(Number(v)), "Gastos"]}
              contentStyle={{ borderRadius: 12, fontSize: 13 }}
            />
            <Bar dataKey="total" name="Gastos" fill="#18181b" radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </CartaoGrafico>

      <CartaoGrafico
        titulo="Despesas por setor"
        descricao="Distribuição dos gastos no período"
      >
        {gastosSetor.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-zinc-500">
            Sem gastos no período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gastosSetor}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {gastosSetor.map((_, i) => (
                  <Cell key={i} fill={CORES_SETOR[i % CORES_SETOR.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name) => [formatarMoeda(Number(v)), String(name)]}
                contentStyle={{ borderRadius: 12, fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CartaoGrafico>

      <div className="lg:col-span-2">
        <CartaoGrafico
          titulo="Top ativos problemáticos"
          descricao="Ativos com maior número de chamados no período"
          altura="h-80"
        >
          {ranking.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-zinc-500">
              Nenhum chamado no período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ranking}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v) => [`${v} chamado(s)`, "Chamados"]}
                  contentStyle={{ borderRadius: 12, fontSize: 13 }}
                />
                <Bar dataKey="chamados" name="Chamados" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CartaoGrafico>
      </div>
    </div>
  );
}
