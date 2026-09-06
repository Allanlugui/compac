import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  FileText,
  MapPin,
  Package,
  SearchX,
  Settings2,
  User,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ChamadoComAtivo, Compra } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import StatusBadge from "@/app/admin/_components/StatusBadge";
import GaleriaFotos from "@/app/admin/_components/GaleriaFotos";
import StatusControl from "./StatusControl";
import FotosDepoisUpload from "./FotosDepoisUpload";
import ComprasDoChamado from "./ComprasDoChamado";

export const metadata: Metadata = {
  title: "Detalhe do chamado · SGA-M",
};

interface ChamadoPageProps {
  params: Promise<{ id: string }>;
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-3d rounded-3xl border border-zinc-200/70 p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 text-base font-black text-zinc-900">
        <span className="icon-3d flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
          {icone}
        </span>
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ChamadoPage({ params }: ChamadoPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: chamadoData }, { data: comprasData }] = await Promise.all([
    supabase
      .from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("compras")
      .select("*")
      .eq("id", id)
      .order("data_compra", { ascending: true }),
  ]);

  const chamado = (chamadoData ?? null) as ChamadoComAtivo | null;
  const compras = ((comprasData ?? []) as Compra[]).slice().sort(
    (a, b) => +new Date(a.data_compra) - +new Date(b.data_compra),
  );

  if (!chamado) {
    return (
      <div className="card-3d mx-auto max-w-2xl rounded-3xl border border-zinc-200/70 p-8 text-center">
        <SearchX className="mx-auto size-12 text-zinc-400" />
        <h1 className="mt-3 text-lg font-black text-zinc-900">
          Chamado não encontrado
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          O chamado pode ter sido excluído ou o link está incorreto.
        </p>
        <Link
          href="/admin/dashboard"
          className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white shadow-lg transition hover:bg-zinc-700"
        >
          <ArrowLeft className="size-4" />
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const fotosAntes = Array.isArray(chamado.fotos_antes) ? chamado.fotos_antes : [];
  const fotosDepois = Array.isArray(chamado.fotos_depois)
    ? chamado.fotos_depois
    : [];

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/dashboard"
          className="inline-flex min-h-[40px] w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <Link
          href={`/admin/chamados/${chamado.id}/os`}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-950 px-5 text-sm font-bold text-white shadow-xl transition hover:brightness-125"
        >
          <FileText className="size-4" />
          Gerar Ordem de Serviço Imprimível
        </Link>
      </div>

      {/* Hero do chamado */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 text-white shadow-2xl sm:p-7">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-20 -right-20 size-64 rounded-full blur-3xl",
            chamado.status === "concluido" && "bg-emerald-500/20",
            chamado.status === "em_andamento" && "bg-sky-500/20",
            chamado.status === "aberto" && "bg-amber-500/20",
          )}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="icon-3d flex size-13 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Wrench className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">
              {chamado.ativos?.nome ?? "Ativo removido"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" />
                {chamado.solicitante}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatarDataHora(chamado.created_at)}
              </span>
            </p>
          </div>
          <StatusBadge status={chamado.status} />
        </div>
      </section>

      {/* Informações principais */}
      <Secao
        icone={<Settings2 className="size-4" />}
        titulo="Informações da solicitação"
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                Localização
              </dt>
              <dd className="font-semibold text-zinc-900">
                {chamado.ativos?.localizacao || "—"}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <User className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                Solicitante
              </dt>
              <dd className="font-semibold text-zinc-900">{chamado.solicitante}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
                Abertura
              </dt>
              <dd className="font-semibold text-zinc-900">
                {formatarDataHora(chamado.created_at)}
              </dd>
            </div>
          </div>
          {chamado.concluido_em && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200/70">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <dt className="text-xs font-bold tracking-wide text-emerald-700 uppercase">
                  Conclusão
                </dt>
                <dd className="font-semibold text-zinc-900">
                  {formatarDataHora(chamado.concluido_em)}
                </dd>
              </div>
            </div>
          )}
        </dl>
        <div className="mt-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
          <p className="text-xs font-bold tracking-wide text-zinc-500 uppercase">
            Descrição do problema
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-800">
            {chamado.descricao}
          </p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold tracking-wide text-zinc-500 uppercase">
            Fotos do problema (antes)
          </p>
          <GaleriaFotos
            fotos={fotosAntes}
            legenda="Antes"
            vazio="Nenhuma foto do problema enviada."
          />
        </div>
      </Secao>

      {/* Controle de status */}
      <Secao
        icone={<Settings2 className="size-4" />}
        titulo="Controle de status"
      >
        <StatusControl chamadoId={chamado.id} statusAtual={chamado.status} />
      </Secao>

      {/* Fotos de conclusão */}
      <Secao
        icone={<Camera className="size-4" />}
        titulo="Fotos de conclusão (depois)"
      >
        <div className="space-y-4">
          <GaleriaFotos
            fotos={fotosDepois}
            legenda="Depois"
            vazio="Nenhuma foto de conclusão enviada ainda."
          />
          <FotosDepoisUpload chamadoId={chamado.id} />
        </div>
      </Secao>

      {/* Insumos e compras */}
      <Secao
        icone={<Package className="size-4" />}
        titulo="Insumos e compras vinculados"
      >
        <ComprasDoChamado chamadoId={chamado.id} iniciais={compras} />
      </Secao>
    </div>
  );
}
