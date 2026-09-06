"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Troca forçada da senha provisória por uma permanente (primeiro acesso). */
export default function PrimeiroAcessoForm() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (senha.length < 8) {
      setErro("A senha permanente precisa de ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      // Troca a senha E limpa a flag numa única chamada.
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { must_change_password: false },
      });
      if (error) throw new Error("Não foi possível salvar. Tente novamente.");
      router.push("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "min-h-[52px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
      <form
        onSubmit={salvar}
        className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <KeyRound className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-black tracking-tight">
          Defina sua senha permanente
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Você entrou com uma senha provisória. Por segurança, crie agora sua
          senha definitiva para continuar.
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="nova" className="mb-1.5 block text-sm font-bold text-zinc-800">
              Nova senha (mín. 8 caracteres)
            </label>
            <input id="nova" type="password" required autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} disabled={enviando} className={campo} />
          </div>
          <div>
            <label htmlFor="confirma" className="mb-1.5 block text-sm font-bold text-zinc-800">
              Confirmar nova senha
            </label>
            <input id="confirma" type="password" required autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} disabled={enviando} className={campo} />
          </div>
          {erro && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {erro}
            </p>
          )}
          <button type="submit" disabled={enviando} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60">
            {enviando && <LoaderCircle className="size-5 animate-spin" />}
            {enviando ? "Salvando…" : "Definir senha e entrar"}
          </button>
        </div>
      </form>
    </main>
  );
}
