import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  CircleX,
  Clock,
  PackageCheck,
  SearchX,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { resolverOrgToken } from "./actions";
import type { SolicitacaoCompra, SolicitacaoCompraStatus } from "@/lib/types";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import SolicitacaoForm from "./SolicitacaoForm";

export const metadata: Metadata = {
  title: "Solicitar compra · SGA-M",
  description: "Solicitação de materiais via QR Code com acompanhamento.",
};

interface QrCompraPageProps {
  // Next.js 16: `params` e `searchParams` são assíncronos.
  params: Promise<{ hash: string }>;
  searchParams: Promise<{ t?: string }>;
}

const STATUS: Record<
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
    rotulo: "Aprovado",
    classes: "bg-sky-100 text-sky-800 ring-sky-200",
    Icone: BadgeCheck,
  },
  rejeitada: {
    rotulo: "Rejeitado",
    classes: "bg-red-100 text-red-800 ring-red-200",
    Icone: CircleX,
  },
  em_cotacao: {
    rotulo: "Em cotação",
    classes: "bg-violet-100 text-violet-800 ring-violet-200",
    Icone: Clock,
  },
  pedido_gerado: {
    rotulo: "Pedido gerado",
    classes: "bg-indigo-100 text-indigo-800 ring-indigo-200",
    Icone: PackageCheck,
  },
  recebida: {
    rotulo: "Recebido",
    classes: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    Icone: PackageCheck,
  },
  encerrada: {
    rotulo: "Encerrada",
    classes: "bg-zinc-200 text-zinc-500 ring-zinc-300",
    Icone: PackageCheck,
  },
  cancelada: {
    rotulo: "Cancelada",
    classes: "bg-zinc-200 text-zinc-500 ring-zinc-300",
    Icone: CircleX,
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

const ETAPAS: SolicitacaoCompraStatus[] = ["pendente", "aprovado", "comprado"];

export default async function QrCompraPage({ params, searchParams }: QrCompraPageProps) {
  const { hash } = await params;
  const { t } = await searchParams;

  // ---------- Rota de abertura: /qr-compra/nova?t=<token> ----------
  // Sem token não há como saber a organização — e NÃO listamos tenants.
  if (hash === "nova") {
    const org = await resolverOrgToken(typeof t === "string" ? t : "");
    if (!org.ok) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
          <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <SearchX className="mx-auto size-12 text-zinc-400" />
            <h1 className="mt-3 text-lg font-bold text-zinc-900">
              Escaneie o QR da sua unidade
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              A solicitação de compra é aberta pelo QR Code fixado na sua
              unidade — ele identifica a organização com segurança.
            </p>
          </section>
        </main>
      );
    }
    return (
      <main className="min-h-dvh bg-zinc-100 px-4 py-6">
        <div className="mx-auto w-full max-w-md">
          <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
            Solicitando para {org.nome}
            {org.contexto ? ` · ${org.contexto.nome}` : ""}
          </p>
          <SolicitacaoForm
            tokenOrg={typeof t === "string" ? t : ""}
            contextoSetor={org.contexto?.setor ?? null}
          />
          <p className="mt-4 text-center text-xs text-zinc-400">
            SGA-M · Solicitação de compras
          </p>
        </div>
      </main>
    );
  }

  // Tracking por token: lookup server-side, escopo mínimo.
  const svc = createServiceClient();
  const { data } = await svc
    .from("solicitacoes_compra")
    .select("*")
    .eq("qr_code_hash", hash)
    .maybeSingle();

  const solicitacao = (data ?? null) as SolicitacaoCompra | null;

  // ---------- Hash desconhecido ----------
  if (!solicitacao) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <SearchX className="mx-auto size-12 text-zinc-400" />
          <h1 className="mt-3 text-lg font-bold text-zinc-900">
            Solicitação não encontrada
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Este código não corresponde a nenhum pedido. Verifique o QR Code ou
            abra uma nova solicitação.
          </p>
          <Link
            href="/qr-compra/nova"
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 px-4 font-semibold text-white transition hover:bg-emerald-700"
          >
            Nova solicitação
          </Link>
        </section>
      </main>
    );
  }

  // ---------- Acompanhamento do pedido ----------
  const conf = STATUS[solicitacao.status];
  const indiceEtapa = ETAPAS.indexOf(solicitacao.status);

  return (
    <main className="min-h-dvh bg-zinc-100 px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
                Acompanhamento do pedido
              </p>
              <h1 className="mt-1 truncate text-lg font-bold text-zinc-900">
                {solicitacao.item}
              </h1>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1",
                conf.classes,
              )}
            >
              <conf.Icone className="size-3.5" />
              {conf.rotulo}
            </span>
          </div>

          {/* Linha do tempo */}
          <ol className="mt-4 space-y-0">
            {ETAPAS.map((etapa, i) => {
              const alcancada =
                solicitacao.status !== "rejeitado" && i <= indiceEtapa;
              return (
                <li key={etapa} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                        alcancada
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-200 text-zinc-500",
                      )}
                    >
                      {i + 1}
                    </span>
                    {i < ETAPAS.length - 1 && (
                      <span
                        className={cn(
                          "w-0.5 flex-1",
                          i < indiceEtapa &&
                            solicitacao.status !== "rejeitado"
                            ? "bg-emerald-500"
                            : "bg-zinc-200",
                        )}
                      />
                    )}
                  </div>
                  <p
                    className={cn(
                      "pb-4 text-sm font-semibold",
                      alcancada ? "text-zinc-900" : "text-zinc-400",
                    )}
                  >
                    {STATUS[etapa].rotulo}
                  </p>
                </li>
              );
            })}
          </ol>

          <dl className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-sm">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Setor
              </dt>
              <dd className="font-medium text-zinc-900">{solicitacao.setor}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Solicitante
              </dt>
              <dd className="font-medium text-zinc-900">
                {solicitacao.solicitante}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Quantidade
              </dt>
              <dd className="font-medium text-zinc-900">
                {String(solicitacao.quantidade)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Valor estimado
              </dt>
              <dd className="font-medium text-zinc-900">
                {formatarMoeda(Number(solicitacao.valor_estimado))}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Justificativa
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-zinc-800">
                {solicitacao.justificativa}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Aberta em
              </dt>
              <dd className="font-medium text-zinc-900">
                {formatarDataHora(solicitacao.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Atualizada em
              </dt>
              <dd className="font-medium text-zinc-900">
                {formatarDataHora(solicitacao.updated_at)}
              </dd>
            </div>
          </dl>
        </section>

        <Link
          href="/qr-compra/nova"
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          Abrir nova solicitação
        </Link>
        <p className="text-center text-xs text-zinc-400">
          SGA-M · Solicitação de compras
        </p>
      </div>
    </main>
  );
}
