import Link from "next/link";
import { ShieldX } from "lucide-react";

export const metadata = { title: "Sem acesso · SGA-M" };

/** Usuário autenticado sem membership ativa em nenhuma organização. */
export default function SemAcessoPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xl">
        <ShieldX className="mx-auto size-12 text-zinc-400" />
        <h1 className="mt-3 text-lg font-black">Sem acesso</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sua conta não está vinculada a nenhuma organização. Fale com o
          administrador para receber um convite.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-900 px-4 font-bold text-white transition hover:bg-zinc-700"
        >
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
