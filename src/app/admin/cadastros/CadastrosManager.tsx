"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { Almoxarifado, CentroCusto, DepartamentoSetor, Localidade } from "@/lib/types";
import {
  criarAlmoxarifado,
  criarCentroCusto,
  criarDepartamento,
  editarAlmoxarifado,
  editarCentroCusto,
  editarDepartamento,
  excluirAlmoxarifado,
  excluirCentroCusto,
  excluirDepartamento,
} from "./actions";

const campo =
  "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:outline-none disabled:opacity-60";
const rotulo = "mb-1 block text-xs font-bold tracking-wide text-zinc-500 uppercase";
const botaoPrimario =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60";
const botaoPerigo =
  "inline-flex size-9 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-zinc-300 hover:bg-red-50 disabled:opacity-40";
const botaoEditar =
  "inline-flex size-9 items-center justify-center rounded-lg bg-white text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-40";

type Aba = "deptos" | "ccs" | "almoxs";

function nomeLoc(locs: Localidade[], id: string | null): string {
  if (!id) return "—";
  const l = locs.find((x) => x.id === id);
  return l ? `${l.nome} · ${l.tipo}` : "—";
}

export default function CadastrosManager({
  iniciaisDeptos,
  iniciaisCCs,
  iniciaisAlmoxs,
  locs,
}: {
  iniciaisDeptos: DepartamentoSetor[];
  iniciaisCCs: CentroCusto[];
  iniciaisAlmoxs: Almoxarifado[];
  locs: Localidade[];
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("deptos");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // --- form departamento ---
  const [editDepto, setEditDepto] = useState<string | null>(null);
  const [deptoNome, setDeptoNome] = useState("");
  const [deptoSigla, setDeptoSigla] = useState("");
  const [deptoLoc, setDeptoLoc] = useState("");
  const [deptoAtivo, setDeptoAtivo] = useState(true);

  // --- form centro de custo ---
  const [editCC, setEditCC] = useState<string | null>(null);
  const [ccCodigo, setCCCodigo] = useState("");
  const [ccNome, setCCNome] = useState("");
  const [ccDepto, setCCDepto] = useState("");
  const [ccLoc, setCCLoc] = useState("");
  const [ccAtivo, setCCAtivo] = useState(true);

  // --- form almoxarifado ---
  const [editAlmox, setEditAlmox] = useState<string | null>(null);
  const [almoxNome, setAlmoxNome] = useState("");
  const [almoxCodigo, setAlmoxCodigo] = useState("");
  const [almoxLoc, setAlmoxLoc] = useState("");
  const [almoxAtivo, setAlmoxAtivo] = useState(true);

  function aposOk() {
    setErro(null);
    router.refresh();
  }

  function iniciarNovoDepto() {
    setEditDepto("novo");
    setDeptoNome("");
    setDeptoSigla("");
    setDeptoLoc("");
    setDeptoAtivo(true);
    setErro(null);
  }

  function iniciarEditarDepto(d: DepartamentoSetor) {
    setEditDepto(d.id);
    setDeptoNome(d.nome);
    setDeptoSigla(d.sigla ?? "");
    setDeptoLoc(d.localidade_id ?? "");
    setDeptoAtivo(d.ativo);
    setErro(null);
  }

  async function salvarDepto() {
    setOcupado(true);
    const r =
      editDepto === "novo"
        ? await criarDepartamento({ nome: deptoNome, sigla: deptoSigla, localidadeId: deptoLoc || null })
        : await editarDepartamento({
            id: editDepto!,
            nome: deptoNome,
            sigla: deptoSigla,
            localidadeId: deptoLoc || null,
            ativo: deptoAtivo,
          });
    setOcupado(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setEditDepto(null);
    aposOk();
  }

  async function removerDepto(id: string) {
    if (!window.confirm("Excluir este departamento?")) return;
    setOcupado(true);
    const r = await excluirDepartamento({ id });
    setOcupado(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    aposOk();
  }

  function iniciarNovoCC() {
    setEditCC("novo");
    setCCCodigo("");
    setCCNome("");
    setCCDepto("");
    setCCLoc("");
    setCCAtivo(true);
    setErro(null);
  }

  function iniciarEditarCC(c: CentroCusto) {
    setEditCC(c.id);
    setCCCodigo(c.codigo);
    setCCNome(c.nome);
    setCCDepto(c.departamento_id ?? "");
    setCCLoc(c.localidade_id ?? "");
    setCCAtivo(c.ativo);
    setErro(null);
  }

  async function salvarCC() {
    setOcupado(true);
    const r =
      editCC === "novo"
        ? await criarCentroCusto({
            codigo: ccCodigo,
            nome: ccNome,
            departamentoId: ccDepto || null,
            localidadeId: ccLoc || null,
          })
        : await editarCentroCusto({
            id: editCC!,
            codigo: ccCodigo,
            nome: ccNome,
            departamentoId: ccDepto || null,
            localidadeId: ccLoc || null,
            ativo: ccAtivo,
          });
    setOcupado(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setEditCC(null);
    aposOk();
  }

  async function removerCC(id: string) {
    if (!window.confirm("Excluir este centro de custo?")) return;
    setOcupado(true);
    const r = await excluirCentroCusto({ id });
    setOcupado(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    aposOk();
  }

  function iniciarNovoAlmox() {
    setEditAlmox("novo");
    setAlmoxNome("");
    setAlmoxCodigo("");
    setAlmoxLoc("");
    setAlmoxAtivo(true);
    setErro(null);
  }

  function iniciarEditarAlmox(a: Almoxarifado) {
    setEditAlmox(a.id);
    setAlmoxNome(a.nome);
    setAlmoxCodigo(a.codigo ?? "");
    setAlmoxLoc(a.localidade_id ?? "");
    setAlmoxAtivo(a.ativo);
    setErro(null);
  }

  async function salvarAlmox() {
    setOcupado(true);
    const r =
      editAlmox === "novo"
        ? await criarAlmoxarifado({ nome: almoxNome, codigo: almoxCodigo, localidadeId: almoxLoc || null })
        : await editarAlmoxarifado({
            id: editAlmox!,
            nome: almoxNome,
            codigo: almoxCodigo,
            localidadeId: almoxLoc || null,
            ativo: almoxAtivo,
          });
    setOcupado(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setEditAlmox(null);
    aposOk();
  }

  async function removerAlmox(id: string) {
    if (!window.confirm("Excluir este almoxarifado?")) return;
    setOcupado(true);
    const r = await excluirAlmoxarifado({ id });
    setOcupado(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    aposOk();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba("deptos")}
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold ring-1 transition sm:flex-none sm:px-5 ${
            aba === "deptos"
              ? "bg-zinc-900 text-white ring-zinc-900"
              : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-100"
          }`}
        >
          <Building2 className="size-4" /> Departamentos
        </button>
        <button
          type="button"
          onClick={() => setAba("ccs")}
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold ring-1 transition sm:flex-none sm:px-5 ${
            aba === "ccs"
              ? "bg-zinc-900 text-white ring-zinc-900"
              : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-100"
          }`}
        >
          <Wallet className="size-4" /> Centros de custo
        </button>
        <button
          type="button"
          onClick={() => setAba("almoxs")}
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold ring-1 transition sm:flex-none sm:px-5 ${
            aba === "almoxs"
              ? "bg-zinc-900 text-white ring-zinc-900"
              : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-100"
          }`}
        >
          <Package className="size-4" /> Almoxarifados
        </button>
        <a
          href="/admin/usuarios"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-zinc-700 ring-1 ring-zinc-300 transition hover:bg-zinc-100 sm:flex-none"
        >
          Usuários →
        </a>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {aba === "deptos" && (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-wide text-zinc-700 uppercase">
              Departamentos / Setores ({iniciaisDeptos.length})
            </h2>
            {editDepto === null && (
              <button type="button" onClick={iniciarNovoDepto} disabled={ocupado} className={botaoPrimario}>
                <Plus className="size-4" /> Novo
              </button>
            )}
          </div>

          {editDepto !== null && (
            <div className="grid gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-2">
              <label className="block">
                <span className={rotulo}>Nome *</span>
                <input value={deptoNome} onChange={(e) => setDeptoNome(e.target.value)} disabled={ocupado} maxLength={80} placeholder="Ex.: Manutenção" className={campo} />
              </label>
              <label className="block">
                <span className={rotulo}>Sigla</span>
                <input value={deptoSigla} onChange={(e) => setDeptoSigla(e.target.value)} disabled={ocupado} maxLength={10} placeholder="Ex.: MAN" className={campo} />
              </label>
              <label className="block">
                <span className={rotulo}>Localidade</span>
                <select value={deptoLoc} onChange={(e) => setDeptoLoc(e.target.value)} disabled={ocupado} className={campo}>
                  <option value="">Sem vínculo</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome} · {l.tipo}
                    </option>
                  ))}
                </select>
              </label>
              {editDepto !== "novo" && (
                <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <input type="checkbox" checked={deptoAtivo} onChange={(e) => setDeptoAtivo(e.target.checked)} disabled={ocupado} className="size-4 accent-zinc-900" />
                  Ativo
                </label>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" onClick={salvarDepto} disabled={ocupado || deptoNome.trim().length < 1} className={botaoPrimario}>
                  {ocupado && <LoaderCircle className="size-4 animate-spin" />} Salvar
                </button>
                <button type="button" onClick={() => setEditDepto(null)} disabled={ocupado} className="inline-flex min-h-[44px] items-center rounded-xl bg-white px-4 text-sm font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {iniciaisDeptos.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Nenhum departamento cadastrado.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {iniciaisDeptos.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900">
                      {d.nome}
                      {d.sigla ? <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-600">{d.sigla}</span> : null}
                      {!d.ativo && <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold text-zinc-500">inativo</span>}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{nomeLoc(locs, d.localidade_id)}</p>
                  </div>
                  <button type="button" aria-label={`Editar ${d.nome}`} onClick={() => iniciarEditarDepto(d)} disabled={ocupado} className={botaoEditar}>
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" aria-label={`Excluir ${d.nome}`} onClick={() => removerDepto(d.id)} disabled={ocupado} className={botaoPerigo}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {aba === "ccs" && (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-wide text-zinc-700 uppercase">
              Centros de custo ({iniciaisCCs.length})
            </h2>
            {editCC === null && (
              <button type="button" onClick={iniciarNovoCC} disabled={ocupado} className={botaoPrimario}>
                <Plus className="size-4" /> Novo
              </button>
            )}
          </div>

          {editCC !== null && (
            <div className="grid gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-2">
              <label className="block">
                <span className={rotulo}>Código *</span>
                <input value={ccCodigo} onChange={(e) => setCCCodigo(e.target.value)} disabled={ocupado} maxLength={20} placeholder="Ex.: CC-101" className={campo} />
              </label>
              <label className="block">
                <span className={rotulo}>Nome *</span>
                <input value={ccNome} onChange={(e) => setCCNome(e.target.value)} disabled={ocupado} maxLength={80} placeholder="Ex.: Manutenção predial" className={campo} />
              </label>
              <label className="block">
                <span className={rotulo}>Departamento</span>
                <select value={ccDepto} onChange={(e) => setCCDepto(e.target.value)} disabled={ocupado} className={campo}>
                  <option value="">Sem vínculo</option>
                  {iniciaisDeptos
                    .filter((d) => d.ativo)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className={rotulo}>Localidade</span>
                <select value={ccLoc} onChange={(e) => setCCLoc(e.target.value)} disabled={ocupado} className={campo}>
                  <option value="">Sem vínculo</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome} · {l.tipo}
                    </option>
                  ))}
                </select>
              </label>
              {editCC !== "novo" && (
                <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <input type="checkbox" checked={ccAtivo} onChange={(e) => setCCAtivo(e.target.checked)} disabled={ocupado} className="size-4 accent-zinc-900" />
                  Ativo
                </label>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={salvarCC}
                  disabled={ocupado || ccCodigo.trim().length < 1 || ccNome.trim().length < 1}
                  className={botaoPrimario}
                >
                  {ocupado && <LoaderCircle className="size-4 animate-spin" />} Salvar
                </button>
                <button type="button" onClick={() => setEditCC(null)} disabled={ocupado} className="inline-flex min-h-[44px] items-center rounded-xl bg-white px-4 text-sm font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {iniciaisCCs.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Nenhum centro de custo cadastrado.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {iniciaisCCs.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900">
                      <span className="mr-1.5 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold text-white">{c.codigo}</span>
                      {c.nome}
                      {!c.ativo && <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold text-zinc-500">inativo</span>}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {(iniciaisDeptos.find((d) => d.id === c.departamento_id)?.nome ?? "—") +
                        " · " +
                        nomeLoc(locs, c.localidade_id)}
                    </p>
                  </div>
                  <button type="button" aria-label={`Editar ${c.codigo}`} onClick={() => iniciarEditarCC(c)} disabled={ocupado} className={botaoEditar}>
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" aria-label={`Excluir ${c.codigo}`} onClick={() => removerCC(c.id)} disabled={ocupado} className={botaoPerigo}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {aba === "almoxs" && (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-wide text-zinc-700 uppercase">
              Almoxarifados ({iniciaisAlmoxs.length})
            </h2>
            {editAlmox === null && (
              <button type="button" onClick={iniciarNovoAlmox} disabled={ocupado} className={botaoPrimario}>
                <Plus className="size-4" /> Novo
              </button>
            )}
          </div>

          {editAlmox !== null && (
            <div className="grid gap-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70 sm:grid-cols-2">
              <label className="block">
                <span className={rotulo}>Nome *</span>
                <input value={almoxNome} onChange={(e) => setAlmoxNome(e.target.value)} disabled={ocupado} maxLength={80} placeholder="Ex.: Almoxarifado central" className={campo} />
              </label>
              <label className="block">
                <span className={rotulo}>Código</span>
                <input value={almoxCodigo} onChange={(e) => setAlmoxCodigo(e.target.value)} disabled={ocupado} maxLength={20} placeholder="Ex.: ALM-01" className={campo} />
              </label>
              <label className="block">
                <span className={rotulo}>Localidade</span>
                <select value={almoxLoc} onChange={(e) => setAlmoxLoc(e.target.value)} disabled={ocupado} className={campo}>
                  <option value="">Sem vínculo</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome} · {l.tipo}
                    </option>
                  ))}
                </select>
              </label>
              {editAlmox !== "novo" && (
                <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <input type="checkbox" checked={almoxAtivo} onChange={(e) => setAlmoxAtivo(e.target.checked)} disabled={ocupado} className="size-4 accent-zinc-900" />
                  Ativo
                </label>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" onClick={salvarAlmox} disabled={ocupado || almoxNome.trim().length < 1} className={botaoPrimario}>
                  {ocupado && <LoaderCircle className="size-4 animate-spin" />} Salvar
                </button>
                <button type="button" onClick={() => setEditAlmox(null)} disabled={ocupado} className="inline-flex min-h-[44px] items-center rounded-xl bg-white px-4 text-sm font-bold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {iniciaisAlmoxs.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Nenhum almoxarifado cadastrado.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {iniciaisAlmoxs.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900">
                      {a.nome}
                      {a.codigo ? <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-600">{a.codigo}</span> : null}
                      {!a.ativo && <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold text-zinc-500">inativo</span>}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{nomeLoc(locs, a.localidade_id)}</p>
                  </div>
                  <button type="button" aria-label={`Editar ${a.nome}`} onClick={() => iniciarEditarAlmox(a)} disabled={ocupado} className={botaoEditar}>
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" aria-label={`Excluir ${a.nome}`} onClick={() => removerAlmox(a.id)} disabled={ocupado} className={botaoPerigo}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
