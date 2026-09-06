"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, TriangleAlert, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { auditLogin } from "./actions";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(
    params.get("expired") === "1" ? "Sessão expirada. Entre novamente." : null,
  );

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) throw new Error("E-mail ou senha inválidos.");
      // Auditoria é observabilidade: nunca pode bloquear o login.
      // (No primeiro acesso o proxy redireciona; se a action falhar,
      // a sessão já existe e o refresh mostra o formulário.)
      try {
        await auditLogin();
      } catch {
        // silencioso
      }
      // Recarrega a sessão para ler a flag de senha provisória.
      const { data } = await supabase.auth.getUser();
      const destino =
        data.user?.user_metadata?.must_change_password === true
          ? "/primeiro-acesso"
          : params.get("next") || "/admin/dashboard";
      router.push(destino);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "min-h-[52px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
      <form
        onSubmit={entrar}
        className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
          <Wrench className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-black tracking-tight">SGA-M</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Acesso restrito à equipe operacional.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-zinc-800">
              E-mail corporativo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="senha" className="mb-1.5 block text-sm font-bold text-zinc-800">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={enviando}
              className={campo}
            />
          </div>

          {erro && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-base font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
          >
            {enviando && <LoaderCircle className="size-5 animate-spin" />}
            {enviando ? "Entrando…" : "Entrar"}
          </button>

          <p className="text-center text-sm">
            <Link href="/recuperar-senha" className="font-semibold text-zinc-600 underline-offset-2 hover:underline">
              Esqueci minha senha
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}
