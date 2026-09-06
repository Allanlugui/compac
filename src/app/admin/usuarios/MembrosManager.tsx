"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  Pencil,
  Trash2,
  TriangleAlert,
  UserPlus,
  Ban,
  CheckCircle2,
} from "lucide-react";
import type { Role } from "@/lib/types";
import {
  convidarMembro,
  editarMembro,
  alternarStatusMembro,
  removerMembro,
} from "./actions";

export interface Membro {
  user_id: string;
  role: Role;
  status: "ativo" | "inativo";
  nome: string;
  setor: string | null;
  departamento: string | null;
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
  const [setor, setSetor] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState({
    nome: "",
    role: "TECNICO" as Role,
    setor: "",
    departamento: "",
  });
  const [credencial, setCredencial] = useState<{
    email: string;
    senha: string;
    emailEnviado: boolean;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(null);
    setCredencial(null);
    setSalvando(true);
    try {
      const r = await convidarMembro({ email, nome, role, setor, departamento });
      if (!r.ok) throw new Error(r.error);
      if (r.senhaProvisoria !== "") {
        // Exibição ÚNICA: a senha não fica salva em lugar nenhum.
        setCredencial({ email, senha: r.senhaProvisoria, emailEnviado: r.emailEnviado });
      }
      setEmail("");
      setNome("");
      setSetor("");
      setDepartamento("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao(m: Membro) {
    setEditando(m.user_id);
    setFormEdit({
      nome: m.nome === "—" ? "" : m.nome,
      role: m.role,
      setor: m.setor ?? "",
      departamento: m.departamento ?? "",
    });
    setErro(null);
  }

  async function salvarEdicao(userId: string) {
    if (processando) return;
    setErro(null);
    setProcessando(userId);
    try {
      const r = await editarMembro({ userId, ...formEdit });
      if (!r.ok) throw new Error(r.error);
      setEditando(null);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setProcessando(null);
    }
  }

  async function alternarStatus(userId: string, status: "ativo" | "inativo") {
    if (processando) return;
    const rotulo = status === "ativo" ? "desbloquear" : "bloquear";
    if (!confirm(`Confirmar ${rotulo} este membro?`)) return;
    setErro(null);
    setProcessando(userId);
    try {
      const r = await alternarStatusMembro({ userId, status });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setProcessando(null);
    }
  }

  async function remover(userId: string, nomeMembro: string) {
    if (processando) return;
    if (
      !confirm(
        `Remover "${nomeMembro}" desta organização? O login é preservado; só o vínculo é excluído.`,
      )
    )
      return;
    setErro(null);
    setProcessando(userId);
    try {
      const r = await removerMembro({ userId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setProcessando(null);
    }
  }

  async function copiarSenha() {
    if (!credencial) return;
    try {
      await navigator.clipboard.writeText(credencial.senha);
    } catch {
      // Clipboard indisponível: seleção manual.
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">Setor</span>
            <input type="text" maxLength={80} value={setor} onChange={(e) => setSetor(e.target.value)} disabled={salvando} placeholder="Ex.: Manutenção" className={campo} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-zinc-700">Departamento</span>
            <input type="text" maxLength={80} value={departamento} onChange={(e) => setDepartamento(e.target.value)} disabled={salvando} placeholder="Ex.: Operações" className={campo} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={salvando} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60">
              {salvando && <LoaderCircle className="size-5 animate-spin" />}
              {salvando ? "Convidando…" : "Enviar convite"}
            </button>
          </div>
        </div>
        {credencial && (
          <div role="status" className="mt-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="flex items-center gap-1.5 text-sm font-black text-amber-900">
              <KeyRound className="size-4" />
              Conta criada! Anote a senha provisória — ela some ao sair daqui.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {credencial.emailEnviado
                ? `Também enviada por e-mail para ${credencial.email}.`
                : "E-mail NÃO enviado (SMTP não configurado) — repasse manualmente."}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-base font-black tracking-widest text-zinc-900 ring-1 ring-amber-200">
                {credencial.senha}
              </code>
              <button
                type="button"
                onClick={copiarSenha}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700"
              >
                {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copiado ? "Copiada!" : "Copiar"}
              </button>
            </div>
          </div>
        )}
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
          {iniciais.map((m) => {
            const emEdicao = editando === m.user_id;
            const ocupado = processando === m.user_id;
            return (
              <li key={m.user_id} className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{m.nome}</p>
                    <p className="text-xs text-zinc-500">
                      {[m.setor, m.departamento].filter(Boolean).join(" · ") || "Sem setor/departamento"}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-400">{m.user_id.slice(0, 8)}…</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${m.status === "ativo" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-zinc-200 text-zinc-500 ring-zinc-300"}`}>
                      {m.role} · {m.status}
                    </span>
                    {ocupado && <LoaderCircle className="size-4 animate-spin text-zinc-400" />}
                  </div>
                </div>

                {emEdicao ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-zinc-700">Nome</span>
                      <input value={formEdit.nome} onChange={(e) => setFormEdit({ ...formEdit, nome: e.target.value })} disabled={ocupado} className={campo} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-zinc-700">Perfil</span>
                      <select value={formEdit.role} onChange={(e) => setFormEdit({ ...formEdit, role: e.target.value as Role })} disabled={ocupado} className={campo}>
                        {ROLES.map((r) => (
                          <option key={r.id} value={r.id}>{r.rotulo}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-zinc-700">Setor</span>
                      <input value={formEdit.setor} onChange={(e) => setFormEdit({ ...formEdit, setor: e.target.value })} disabled={ocupado} maxLength={80} className={campo} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-zinc-700">Departamento</span>
                      <input value={formEdit.departamento} onChange={(e) => setFormEdit({ ...formEdit, departamento: e.target.value })} disabled={ocupado} maxLength={80} className={campo} />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="button" onClick={() => salvarEdicao(m.user_id)} disabled={ocupado} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60">
                        {ocupado ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Salvar
                      </button>
                      <button type="button" onClick={() => setEditando(null)} disabled={ocupado} className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-zinc-200 px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-300 disabled:opacity-60">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => abrirEdicao(m)} disabled={ocupado} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60">
                      <Pencil className="size-3.5" /> Editar
                    </button>
                    {m.status === "ativo" ? (
                      <button type="button" onClick={() => alternarStatus(m.user_id, "inativo")} disabled={ocupado} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-amber-700 ring-1 ring-amber-300 hover:bg-amber-50 disabled:opacity-60">
                        <Ban className="size-3.5" /> Bloquear
                      </button>
                    ) : (
                      <button type="button" onClick={() => alternarStatus(m.user_id, "ativo")} disabled={ocupado} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50 disabled:opacity-60">
                        <CheckCircle2 className="size-3.5" /> Desbloquear
                      </button>
                    )}
                    <button type="button" onClick={() => remover(m.user_id, m.nome)} disabled={ocupado} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-60">
                      <Trash2 className="size-3.5" /> Remover
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-zinc-400">
          Bloquear inativa o vínculo (sem apagar histórico). Remover exclui o vínculo com a organização e preserva login e auditoria.
        </p>
      </section>
    </div>
  );
}
