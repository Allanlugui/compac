import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import PageHeader from "@/components/ui/PageHeader";
import { notFound } from "next/navigation";

export default async function PerfilOutroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await requireOrg();

  // Validar tenant: membership do alvo deve ser da mesma org e ativo
  const { data: membership } = await supabase.from("memberships").select("id, role, setor, departamento").eq("user_id", id).eq("organization_id", ctx.orgId).eq("status","ativo").maybeSingle();
  if (!membership) return notFound();

  const { data: profile } = await supabase.from("profiles").select("nome, cargo, avatar_url, bio").eq("id", id).maybeSingle();
  if (!profile) return notFound();

  // Field visibility: só dados permitidos (não email/telefone/matricula privados)
  return (
    <div className="space-y-6">
      <PageHeader titulo={profile.nome ?? "Perfil"} descricao={`${(membership as { role: string }).role} · ${ctx.orgNome}`} voltar={{ href: "/admin/organograma", rotulo: "Organograma" }} />
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="font-bold">{profile.nome}</p>
        <p className="text-sm text-zinc-500">{profile.cargo ?? (membership as { role: string }).role}</p>
        {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
        <p className="mt-2 text-xs text-zinc-400">Setor: {(membership as { setor: string }).setor ?? "—"} · Dept: {(membership as { departamento: string }).departamento ?? "—"}</p>
      </div>
    </div>
  );
}
