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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ChamadoComAtivo, Compra } from "@/lib/types";
import { formatarDataHora } from "@/lib/format";
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
        {icone}
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
      <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <SearchX className="mx-auto size-12 text-zinc-400" />
        <h1 className="mt-3 text-lg font-bold text-zinc-900">
          Chamado não encontrado
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          O chamado pode ter sido excluído ou o link está incorreto.
        </p>
        <Link
          href="/admin/dashboard"
          className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
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
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/dashboard"
          className="inline-flex min-h-[40px] w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <Link
          href={`/admin/chamados/${chamado.id}/os`}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white transition hover:bg-zinc-800"
        >
          <FileText className="size-4" />
          Gerar Ordem de Serviço Imprimível
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-zinc-900">
          {chamado.ativos?.nome ?? "Ativo removido"}
        </h1>
        <StatusBadge status={chamado.status} />
      </div>

      {/* Informações principais */}
      <Secao
        icone={<Settings2 className="size-5 text-zinc-500" />}
        titulo="Informações da solicitação"
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Localização
              </dt>
              <dd className="font-medium text-zinc-900">
                {chamado.ativos?.localizacao || "—"}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Solicitante
              </dt>
              <dd className="font-medium text-zinc-900">{chamado.solicitante}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Abertura
              </dt>
              <dd className="font-medium text-zinc-900">
                {formatarDataHora(chamado.created_at)}
              </dd>
            </div>
          </div>
          {chamado.concluido_em && (
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-400" />
              <div>
                <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  Conclusão
                </dt>
                <dd className="font-medium text-zinc-900">
                  {formatarDataHora(chamado.concluido_em)}
                </dd>
              </div>
            </div>
          )}
        </dl>
        <div className="mt-4 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Descrição do problema
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-800">
            {chamado.descricao}
          </p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
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
        icone={<Settings2 className="size-5 text-zinc-500" />}
        titulo="Controle de status"
      >
        <StatusControl chamadoId={chamado.id} statusAtual={chamado.status} />
      </Secao>

      {/* Fotos de conclusão */}
      <Secao
        icone={<Camera className="size-5 text-zinc-500" />}
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
        icone={<Package className="size-5 text-zinc-500" />}
        titulo="Insumos e compras vinculados"
      >
        <ComprasDoChamado chamadoId={chamado.id} iniciais={compras} />
      </Secao>
    </div>
  );
}
