import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getMemberships, setActiveOrg } from "@/lib/org";

export const metadata = { title: "Escolher organização · SGA-M" };

/** Troca de organização ativa (multi-org). Validação no servidor. */
export default async function SelecionarOrgPage() {
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/sem-acesso");
  if (memberships.length === 1) redirect("/admin/dashboard");

  async function escolher(form: FormData) {
    "use server";
    const id = String(form.get("org") ?? "");
    await setActiveOrg(id);
    redirect("/admin/dashboard");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
      <form
        action={escolher}
        className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
      >
        <Building2 className="size-10 text-zinc-400" />
        <h1 className="mt-3 text-xl font-black tracking-tight">
          Escolher organização
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Você participa de {memberships.length} organizações. Selecione onde
          atuar agora — dá para trocar depois.
        </p>
        <div className="mt-5 space-y-2">
          {memberships.map((m) => (
            <label
              key={m.organization_id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 p-4 transition has-checked:border-zinc-900 has-checked:bg-zinc-50 has-checked:ring-1 has-checked:ring-zinc-900"
            >
              <input
                type="radio"
                name="org"
                value={m.organization_id}
                required
                className="size-4 accent-zinc-900"
              />
              <span>
                <span className="block text-sm font-black">{m.organizacao_nome}</span>
                <span className="block text-xs text-zinc-500">
                  Perfil {m.role} · /{m.organizacao_slug}
                </span>
              </span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-zinc-900 px-4 font-bold text-white transition hover:bg-zinc-700"
        >
          Continuar
        </button>
      </form>
    </main>
  );
}
