import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import PageHeader from "@/components/ui/PageHeader";
import OrganogramaClient from "./OrganogramaClient";

export const metadata = { title: "Organograma · SGA-M" };

export default async function OrganogramaPage() {
  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "organograma.ver");

  const [{ data: memberships }, { data: profiles }] = await Promise.all([
    supabase.from("memberships").select("id, user_id, role, setor, departamento, reports_to_membership_id").eq("organization_id", ctx.orgId).eq("status", "ativo"),
    supabase.from("profiles").select("id, nome, cargo, avatar_url").in("id", (await supabase.from("memberships").select("user_id").eq("organization_id", ctx.orgId).eq("status", "ativo")).data?.map(m=>m.user_id) ?? []),
  ]);

  // Fallback: if reports_to column doesn't exist, use storage hierarchy
  const { getHierarchy } = await import("@/lib/hierarchy");
  const storageMap = await getHierarchy(ctx.orgId);

  let nodes = (memberships ?? []).map(m => {
    const p = (profiles ?? []).find(x=>x.id===m.user_id);
    const reportsTo = (m as unknown as { reports_to_membership_id?: string | null }).reports_to_membership_id ?? storageMap[m.id as string] ?? null;
    return { id: m.id as string, user_id: m.user_id as string, role: m.role as string, setor: (m.setor as string) ?? null, departamento: (m as { departamento?: string }).departamento ?? null, reportsTo, nome: p?.nome ?? "—", cargo: p?.cargo ?? null, avatar_url: p?.avatar_url ?? null };
  });

  // Scope: SOLICITANTE só vê sua cadeia (self + ancestrais) — não toda org
  if (ctx.role === "SOLICITANTE") {
    const myId = memberships?.find(m=>m.user_id===ctx.userId)?.id as string | undefined;
    if (myId) {
      const { getAncestors } = await import("@/lib/hierarchy");
      const ancestors = await getAncestors(myId, ctx.orgId);
      const allowed = new Set([myId, ...ancestors]);
      nodes = nodes.filter(n => allowed.has(n.id));
    } else {
      nodes = [];
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader titulo="Organograma" descricao={`${ctx.orgNome} · hierarquia organizacional`} />
      <OrganogramaClient nodes={nodes} currentMembershipId={memberships?.find(m=>m.user_id===ctx.userId)?.id as string} />
    </div>
  );
}
