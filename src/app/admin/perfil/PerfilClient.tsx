"use client";

import { useState, useTransition } from "react";
import { atualizarPerfil, uploadAvatar } from "./actions";

export default function PerfilClient({ initial }: { initial: { nome: string; telefone: string; cargo: string; matricula: string; avatar_url: string; bio: string; preferencias: Record<string, unknown>; setor: string; departamento: string; email: string; role: string; orgId: string; userId: string } }) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onChange<K extends keyof typeof form>(k: K, v: string) { setForm((s) => ({ ...s, [k]: v })); }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-zinc-900 text-white text-xl font-black">
            {(form.nome || form.email).slice(0, 2).toUpperCase()}
          </div>
          <p className="mt-3 font-bold">{form.nome || form.email}</p>
          <p className="text-xs text-zinc-500">{form.role} · {form.email}</p>
          <p className="text-xs text-zinc-400">{form.setor} {form.departamento ? `· ${form.departamento}` : ""}</p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-bold hover:bg-zinc-50">
            Alterar foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
              const f=e.target.files?.[0]; if(!f) return;
              const fd=new FormData(); fd.set("file",f);
              const r=await uploadAvatar(fd);
              setMsg(r.ok ? "Foto atualizada" : r.error);
              if(r.ok && (r as { path?: string }).path) setForm(s=>({...s, avatar_url:(r as { path: string }).path}));
            }} />
          </label>
          {form.avatar_url && <p className="mt-2 truncate text-xs text-zinc-400">{form.avatar_url}</p>}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">Preferências</h3>
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between text-sm"><span>Tema</span><select value={(form.preferencias.tema as string) ?? "light"} onChange={e=>setForm(s=>({...s, preferencias:{...s.preferencias, tema:e.target.value}}))} className="rounded border px-2 py-1"><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
            <label className="flex items-center justify-between text-sm"><span>Notificações</span><input type="checkbox" checked={(form.preferencias.notificacoes as boolean) ?? true} onChange={e=>setForm(s=>({...s, preferencias:{...s.preferencias, notificacoes:e.target.checked}}))} /></label>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-black">Dados profissionais</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="text-xs font-bold text-zinc-500">Nome</span><input value={form.nome} onChange={e=>onChange("nome", e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label className="text-sm"><span className="text-xs font-bold text-zinc-500">Email (read-only)</span><input value={form.email} disabled className="mt-1 w-full rounded-xl border bg-zinc-50 px-3 py-2 text-zinc-500" /></label>
            <label className="text-sm"><span className="text-xs font-bold text-zinc-500">Telefone</span><input value={form.telefone} onChange={e=>onChange("telefone", e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label className="text-sm"><span className="text-xs font-bold text-zinc-500">Cargo</span><input value={form.cargo} onChange={e=>onChange("cargo", e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label className="text-sm"><span className="text-xs font-bold text-zinc-500">Matrícula</span><input value={form.matricula} onChange={e=>onChange("matricula", e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label className="text-sm"><span className="text-xs font-bold text-zinc-500">Setor</span><input value={form.setor} disabled className="mt-1 w-full rounded-xl border bg-zinc-50 px-3 py-2 text-zinc-500" title="Gerenciado por ADMIN" /></label>
            <label className="sm:col-span-2 text-sm"><span className="text-xs font-bold text-zinc-500">Bio</span><textarea value={form.bio} onChange={e=>onChange("bio", e.target.value)} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Fale sobre seu trabalho..." /></label>
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={isPending} onClick={()=>startTransition(async()=>{
              const r=await atualizarPerfil({nome:form.nome, telefone:form.telefone, cargo:form.cargo, matricula:form.matricula, bio:form.bio, preferencias:form.preferencias});
              setMsg(r.ok ? "Perfil atualizado" : r.error);
            })} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-50">Salvar</button>
            <a href="/atualizar-senha" className="rounded-xl border px-5 py-2.5 text-sm font-bold hover:bg-zinc-50">Alterar senha</a>
          </div>
          {msg && <p className="mt-2 text-sm text-zinc-600">{msg}</p>}
          <p className="mt-2 text-xs text-zinc-400">Role e organização não podem ser alterados pelo próprio usuário.</p>
        </div>
      </div>
    </div>
  );
}
