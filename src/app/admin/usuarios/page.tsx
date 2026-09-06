import type { Metadata } from "next";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPapel } from "@/lib/roles";
import type { Role } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import MembrosManager from "./MembrosManager";

export const metadata: Metadata = { title: "Usuários · SGA-M" };

export default async function UsuariosPage() {
  let ctx: Awaited<ReturnType<typeof requireOrg>> | null = null;
  try {
    ctx = await requireOrg();
    exigirPapel(ctx, ["ADMIN"]);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Usuários" descricao="Gestão de membros e perfis." />
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <ShieldX className="mx-auto size-10 text-zinc-300" />
          <p className="mt-2 font-bold">Área restrita a administradores</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("user_id, role, status, profiles!inner(nome)")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: true });

  const membros = ((data ?? []) as unknown as {
    user_id: string;
    role: Role;
    status: "ativo" | "inativo";
    profiles: { nome: string | null };
  }[]).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    status: m.status,
    nome: m.profiles?.nome ?? "—",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Usuários"
        descricao={`${ctx.orgNome} · convites, perfis e acesso.`}
      />
      <MembrosManager iniciais={membros} />
    </div>
  );
}
