import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";

const BUCKET = "manutencao-midia";
function pathFor(orgId: string) { return `o/${orgId}/organograma/hierarchy.json`; }

export async function getHierarchy(orgId: string): Promise<Record<string, string | null>> {
  const svc = createServiceClient();
  const { data } = await svc.storage.from(BUCKET).download(pathFor(orgId));
  if (!data) return {};
  try { const txt = await data.text(); return JSON.parse(txt) as Record<string, string | null>; } catch { return {}; }
}

export async function setHierarchy(orgId: string, map: Record<string, string | null>): Promise<void> {
  const svc = createServiceClient();
  await svc.storage.from(BUCKET).upload(pathFor(orgId), Buffer.from(JSON.stringify(map)), { contentType: "application/json", upsert: true });
}

export async function getSuperior(membershipId: string, orgId: string): Promise<string | null> {
  const map = await getHierarchy(orgId);
  return map[membershipId] ?? null;
}

export async function getSubordinados(managerId: string, orgId: string): Promise<string[]> {
  const map = await getHierarchy(orgId);
  return Object.entries(map).filter(([, v]) => v === managerId).map(([k]) => k);
}

export async function getSubtree(rootId: string, orgId: string): Promise<string[]> {
  const map = await getHierarchy(orgId);
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    const childs = Object.entries(map).filter(([, v]) => v === cur).map(([k]) => k);
    for (const c of childs) { if (!out.includes(c)) { out.push(c); stack.push(c); } }
  }
  return out;
}

export async function getAncestors(membershipId: string, orgId: string): Promise<string[]> {
  const map = await getHierarchy(orgId);
  const out: string[] = [];
  let cur = map[membershipId];
  while (cur && out.length < 20) {
    if (out.includes(cur)) break; // ciclo
    out.push(cur);
    cur = map[cur] ?? null;
  }
  return out;
}

// Server-side validation for set (same-tenant, no cycle, not self)
export async function validateHierarchy(orgId: string, membershipId: string, reportsTo: string | null): Promise<string | null> {
  if (!reportsTo) return null;
  if (reportsTo === membershipId) return "reports_to não pode ser self";
  const supabase = await createClient();
  const ctx = await requireOrg();
  if (ctx.orgId !== orgId) return "Cross-tenant bloqueado";
  const { data: parent } = await supabase.from("memberships").select("id, organization_id").eq("id", reportsTo).eq("organization_id", orgId).maybeSingle();
  if (!parent) return "Superior não encontrado na mesma organização";
  const ancestors = await getAncestors(reportsTo, orgId);
  if (ancestors.includes(membershipId)) return "Ciclo detectado";
  return null;
}
