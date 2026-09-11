"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Node = { id: string; user_id: string; role: string; setor: string | null; departamento: string | null; reportsTo: string | null; nome: string; cargo: string | null; avatar_url: string | null };

export default function OrganogramaClient({ nodes, currentMembershipId }: { nodes: Node[]; currentMembershipId: string | null }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<Node | null>(null);
  const [filterRole, setFilterRole] = useState<string>("todos");
  const containerRef = useRef<HTMLDivElement>(null);

  const roots = nodes.filter(n => !n.reportsTo || !nodes.some(x=>x.id===n.reportsTo));
  const children = (id: string) => nodes.filter(n => n.reportsTo === id);

  function onWheel(e: React.WheelEvent) { setScale(s => Math.min(2, Math.max(0.5, s - e.deltaY * 0.001))); }
  function localizarMe() {
    const me = nodes.find(n=>n.id===currentMembershipId);
    if(me) setSelected(me);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={()=>setScale(s=>Math.min(2,s+0.2))} className="rounded-xl border px-3 py-1 text-sm font-bold">Zoom +</button>
        <button onClick={()=>setScale(s=>Math.max(0.5,s-0.2))} className="rounded-xl border px-3 py-1 text-sm font-bold">Zoom -</button>
        <button onClick={()=>{setScale(1); setPan({x:0,y:0});}} className="rounded-xl border px-3 py-1 text-sm font-bold">Centralizar</button>
        <button onClick={localizarMe} className="rounded-xl bg-zinc-900 px-3 py-1 text-sm font-bold text-white">Localizar-me</button>
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} className="rounded-xl border px-2 py-1 text-sm">
          <option value="todos">Todos</option>
          <option value="ADMIN">ADMIN</option><option value="GESTOR">GESTOR</option><option value="TECNICO">TECNICO</option><option value="COMPRAS">COMPRAS</option><option value="AUDITOR">AUDITOR</option><option value="SOLICITANTE">SOLICITANTE</option>
        </select>
        <input placeholder="Busca nome/cargo" className="rounded-xl border px-3 py-1 text-sm" onChange={e=>{ const v=e.target.value.toLowerCase(); const f=nodes.find(n=>n.nome.toLowerCase().includes(v)); if(f) setSelected(f); }} />
      </div>

      <div ref={containerRef} onWheel={onWheel} className="h-[60vh] overflow-auto rounded-2xl border bg-white p-4 shadow-sm" style={{ cursor: "grab" }}
        onMouseDown={e=>{ const start={x:e.clientX-pan.x, y:e.clientY-pan.y}; const move=(ev:MouseEvent)=>setPan({x:ev.clientX-start.x, y:ev.clientY-start.y}); const up=()=>{window.removeEventListener("mousemove",move); window.removeEventListener("mouseup",up);}; window.addEventListener("mousemove",move); window.addEventListener("mouseup",up); }}>
        <div style={{ transform:`translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin:"top left" }}>
          {roots.filter(n=>filterRole==="todos"||n.role===filterRole).map(r=>(
            <div key={r.id} className="mb-4">
              <div onClick={()=>setSelected(r)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${selected?.id===r.id?"bg-zinc-900 text-white":"bg-zinc-50"}`}>
                <span className="font-bold">{r.nome}</span><span className="text-xs">{r.cargo ?? r.role}</span>
              </div>
              <div className="ml-6 mt-2 space-y-2">
                {children(r.id).map(c=>(
                  <div key={c.id} onClick={()=>setSelected(c)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ml-4 ${selected?.id===c.id?"bg-zinc-900 text-white":"bg-white"}`}>
                    <span>{c.nome}</span><span className="text-xs">{c.cargo ?? c.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {nodes.length===0 && <p className="text-sm text-zinc-500">Nenhuma hierarquia cadastrada. ADMIN pode definir superior em /admin/usuarios.</p>}
        </div>
      </div>

      {selected && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="font-black">{selected.nome}</h3>
          <p className="text-sm text-zinc-500">{selected.cargo ?? selected.role} · {selected.setor ?? ""} {selected.departamento ?? ""}</p>
          <div className="mt-2 flex gap-2">
            <Link href={`/admin/perfil/${selected.user_id}`} className="rounded-xl border px-3 py-1 text-sm font-bold">Ver perfil</Link>
            <Link href={`/admin/mensagens?to=${selected.user_id}`} className="rounded-xl bg-zinc-900 px-3 py-1 text-sm font-bold text-white">Enviar mensagem</Link>
          </div>
          <p className="mt-2 text-xs text-zinc-400">Superior: {selected.reportsTo ? nodes.find(n=>n.id===selected.reportsTo)?.nome ?? "—" : "Raiz"}</p>
          <p className="text-xs text-zinc-400">Subordinados: {children(selected.id).map(c=>c.nome).join(", ") || "—"}</p>
        </div>
      )}
    </div>
  );
}
