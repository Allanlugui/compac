import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import PageHeader from "@/components/ui/PageHeader";
import PerfilClient from "./PerfilClient";

export const metadata = { title: "Meu Perfil · SGA-M" };

export default async function PerfilPage() {
  const supabase = await createClient();
  const ctx = await requireOrg();

  // profiles tem id=nome,telefone,cargo,matricula,avatar_url,ultimo_acesso,created_at
  // bio/preferencias são FASE 9.2 (schema_v19) — fallback se não existirem
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", ctx.userId).maybeSingle();
  const { data: membership } = await supabase.from("memberships").select("role, setor, departamento").eq("user_id", ctx.userId).eq("organization_id", ctx.orgId).maybeSingle();

  const p = (profile ?? {}) as Record<string, unknown>;
  return (
    <div className="space-y-6">
      <PageHeader titulo="Meu Perfil" descricao={`${ctx.orgNome} · ${ctx.email} · ${ctx.role}`} />
      <PerfilClient
        initial={{
          nome: (p.nome as string) ?? "",
          telefone: (p.telefone as string) ?? "",
          cargo: (p.cargo as string) ?? "",
          matricula: (p.matricula as string) ?? "",
          avatar_url: (p.avatar_url as string) ?? "",
          bio: (p.bio as string) ?? "",
          preferencias: (p.preferencias as Record<string, unknown>) ?? {},
          setor: (membership as { setor?: string })?.setor ?? "",
          departamento: (membership as { departamento?: string })?.departamento ?? "",
          email: ctx.email,
          role: ctx.role,
          orgId: ctx.orgId,
          userId: ctx.userId,
        }}
      />
    </div>
  );
}
