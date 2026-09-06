"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert, UserPlus } from "lucide-react";
import type { Role } from "@/lib/types";
import { convidarMembro } from "./actions";

export interface Membro {
  user_id: string;
  role: Role;
  status: "ativo" | "inativo";
  nome: string;
}

const ROLES: { id: Role; rotulo: string }[] = [
  { id: "ADMIN", rotulo: "Admin — tudo" },
  { id: "GESTOR", rotulo: "Gestor — operação e suprimentos" },
  { id: "TECNICO", rotulo: "Técnico — chamados e execução" },
  { id: "COMPRAS", rotulo: "Compras — solicitações e pedidos" },
  { id: "AUDITOR", rotulo: "Auditor — somente leitura" },
  { id: "SOLICITANTE", rotulo: "Solicitante — abrir/acompanhar" },
];

export default function MembrosManager({ iniciais }: { iniciais: Membro[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<Role>("TECNICO");
  const [salvando, setSalvando] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await convidarMembro({ email, nome, role });
      if (!r.ok) throw new Error(r.error);
      setEmail("");
      setNome("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60 sm:text-sm";

  return (
    <div className="space-y-4">
      <form onSubmit={convidar} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-black">
          <UserPlus className="size-5 text-zinc-500" />
          Convidar membro
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">E-mail *</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={salvando} placeholder="pessoa@empresa.com" className={campo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">Nome *</span>
            <input type="text" required minLength={2} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} placeholder="Nome completo" className={campo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">Perfil *</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={salvando} className={campo}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.rotulo}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={salvando} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60">
              {salvando && <LoaderCircle className="size-5 animate-spin" />}
              {salvando ? "Convidando…" : "Enviar convite"}
            </button>
          </div>
        </div>
        {erro && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black">Membros ({iniciais.length})</h2>
        <ul className="mt-3 space-y-2">
          {iniciais.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/70">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{m.nome}</p>
                <p className="font-mono text-[11px] text-zinc-400">{m.user_id.slice(0, 8)}…</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${m.status === "ativo" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-zinc-200 text-zinc-500 ring-zinc-300"}`}>
                  {m.role} · {m.status}
                </span>
                {processando === m.user_id && <LoaderCircle className="size-4 animate-spin text-zinc-400" />}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-400">
          Troca de perfil e ativação/inativação via SQL nesta versão — interface completa na próxima iteração.
        </p>
      </section>
    </div>
  );
}
