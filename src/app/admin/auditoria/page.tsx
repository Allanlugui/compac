import type { Metadata } from "next";
import { Activity, Database, FileClock, ScrollText, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import type { AuditoriaLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import LogsAuditoria from "./LogsAuditoria";
import Homologacao, { type CheckSaude } from "./Homologacao";

export const metadata: Metadata = {
  title: "Auditoria · SGA-M",
  description: "Central de auditoria, histórico de logs e homologação.",
};

const LIMITE_LOGS = 300;
const TABELAS_MONITORADAS = [
  "ativos",
  "chamados",
  "compras",
  "solicitacoes_compra",
  "auditoria_logs",
] as const;

async function checar(
  nome: string,
  descricao: string,
  fn: () => Promise<unknown>,
): Promise<CheckSaude> {
  try {
    await fn();
    return { nome, descricao, ok: true };
  } catch {
    return { nome, descricao, ok: false };
  }
}

export default async function AuditoriaPage() {
  const supabase = await createClient();
  let ctx: Awaited<ReturnType<typeof requireOrg>>;
  try {
    ctx = await requireOrg();
    // Trilha administrativa: só ADMIN, GESTOR e AUDITOR.
    // TECNICO/COMPRAS/SOLICITANTE veem "restrito" (actions seguem barrando).
    exigirPermissao(ctx, "auditoria.ver");
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">
            Auditoria
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Trilha de mutações do sistema e homologação da plataforma.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita (ADMIN, GESTOR, AUDITOR)</p>
        </div>
      </div>
    );
  }

  const { data: logsData } = await supabase
    .from("auditoria_logs")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(LIMITE_LOGS);

  const logs = ((logsData ?? []) as AuditoriaLog[]).slice().sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

  // ---------- Homologação: verificações vivas ----------
  const checks: CheckSaude[] = await Promise.all([
    checar(
      "Variáveis de ambiente",
      "SUPABASE_URL e ANON_KEY presentes no servidor",
      async () => {
        if (
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ) {
          throw new Error("env ausente");
        }
      },
    ),
    ...TABELAS_MONITORADAS.map((tabela) =>
      checar(`Tabela ${tabela}`, "Leitura via anon key (RLS)", async () => {
        const { error } = await supabase.from(tabela).select("id").limit(1);
        if (error) throw error;
      }),
    ),
    checar(
      "Bucket manutencao-midia",
      "Listagem no Storage (fotos antes/depois)",
      async () => {
        const { error } = await supabase.storage
          .from("manutencao-midia")
          .list("", { limit: 1 });
        if (error) throw error;
      },
    ),
  ]);

  // ---------- KPIs ----------
  const agora = +new Date();
  const hojeISO = new Date().toISOString().slice(0, 10);
  const porAcao: Record<string, number> = { INSERT: 0, UPDATE: 0, DELETE: 0 };
  let hoje = 0;
  let seteDias = 0;
  for (const log of logs) {
    if (log.acao in porAcao) porAcao[log.acao] += 1;
    if (log.created_at.slice(0, 10) === hojeISO) hoje += 1;
    if (agora - +new Date(log.created_at) <= 7 * 86400000) seteDias += 1;
  }

  const kpis = [
    {
      rotulo: `Eventos (últimos ${logs.length >= LIMITE_LOGS ? `${LIMITE_LOGS}+` : logs.length})`,
      valor: String(logs.length),
      Icone: ScrollText,
      classes: "bg-zinc-900 text-white",
    },
    {
      rotulo: "Eventos hoje",
      valor: String(hoje),
      Icone: Activity,
      classes: "bg-emerald-100 text-emerald-700",
    },
    {
      rotulo: "Últimos 7 dias",
      valor: String(seteDias),
      Icone: FileClock,
      classes: "bg-sky-100 text-sky-700",
    },
    {
      rotulo: "Criações · Alterações · Exclusões",
      valor: `${porAcao.INSERT} · ${porAcao.UPDATE} · ${porAcao.DELETE}`,
      Icone: Database,
      classes: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900">
          Auditoria
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Trilha de mutações do sistema e homologação da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ rotulo, valor, Icone, classes }) => (
          <div
            key={rotulo}
            className="card-3d flex items-center gap-3 rounded-3xl border border-zinc-200/70 p-4"
          >
            <span
              className={cn(
                "icon-3d flex size-11 shrink-0 items-center justify-center rounded-2xl",
                classes,
              )}
            >
              <Icone className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl leading-none font-black text-zinc-900 tabular-nums">
                {valor}
              </p>
              <p className="mt-1 truncate text-xs font-medium text-zinc-500">
                {rotulo}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Homologacao checks={checks} />
      <LogsAuditoria logs={logs} />
    </div>
  );
}
