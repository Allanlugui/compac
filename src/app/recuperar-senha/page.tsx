"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarForm() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/atualizar-senha`,
      });
      if (error) throw new Error("Não foi possível enviar. Confira o e-mail.");
      setOk(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10">
      <form
        onSubmit={enviar}
        className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
      >
        <h1 className="text-xl font-black tracking-tight">Recuperar senha</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enviamos um link de redefinição para seu e-mail.
        </p>
        {ok ? (
          <p role="status" className="mt-6 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
            <Check className="mt-0.5 size-4 shrink-0" />
            E-mail enviado. Verifique sua caixa de entrada (e o spam).
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-zinc-800">
                E-mail cadastrado
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
                className="min-h-[52px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60"
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
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
            >
              {enviando && <LoaderCircle className="size-5 animate-spin" />}
              {enviando ? "Enviando…" : "Enviar link"}
            </button>
          </div>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-semibold text-zinc-600 underline-offset-2 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </form>
    </main>
  );
}
