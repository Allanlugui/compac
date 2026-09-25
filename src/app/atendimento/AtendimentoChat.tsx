"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { novaSessao, proximaPergunta, responder, resumo } from "@/lib/intake/engine";
import type { EntradaIntake, SessaoIntake, SlotDef } from "@/lib/intake/types";
import type { TipoAtendimento } from "@/lib/intake/contexto";
import { concluirAtendimento } from "./actions";

interface Msg {
  de: "agente" | "user";
  texto: string;
}

const campo =
  "min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-60";

export default function AtendimentoChat({
  entrada,
  origem,
  saudacao,
  kind,
  tokenRef,
}: {
  entrada: EntradaIntake;
  origem: string;
  saudacao: string;
  kind: TipoAtendimento;
  tokenRef: string;
}) {
  const [sessao, setSessao] = useState<SessaoIntake>(() =>
    novaSessao(entrada.tipo === "compra" ? "compra" : "manutencao", entrada),
  );
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "agente", texto: saudacao }]);
  const [texto, setTexto] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  // Arquivos sobrevivem ao avanço do slot (state visual é limpo, o envio usa o ref).
  const arquivosRef = useRef(new Map<string, File>());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const atual = useMemo(() => proximaPergunta(sessao), [sessao]);
  const resumoFinal = useMemo(() => (sessao.confirmada ? [] : resumo(sessao)), [sessao]);

  function dizerAgente(textoAgente: string, novaSessao: SessaoIntake, textoUser: string) {
    setMsgs((m) => [...m, { de: "user", texto: textoUser }, { de: "agente", texto: textoAgente }]);
    setSessao(novaSessao);
  }

  function avancar(slot: SlotDef, valor: unknown, rotuloUser: string) {
    const r = responder(sessao, slot.id, valor);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setErro(null);
    setTexto("");
    setArquivos([]);
    const prox = proximaPergunta(r.sessao);
    if (!prox) {
      setMsgs((m) => [...m, { de: "user", texto: rotuloUser }]);
      setSessao(r.sessao);
      return;
    }
    dizerAgente(prox.rotulo, r.sessao, rotuloUser);
  }

  function voltar() {
    if (sessao.concluidos.length === 0 || enviando) return;
    const ultimo = sessao.concluidos[sessao.concluidos.length - 1];
    const respostas = { ...sessao.respostas };
    delete respostas[ultimo];
    setSessao({
      ...sessao,
      respostas,
      concluidos: sessao.concluidos.slice(0, -1),
      confirmada: false,
    });
    setMsgs((m) => m.slice(0, -2));
    setErro(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("ref", tokenRef);
      fd.set("respostas", JSON.stringify(sessao.respostas));
      const lista = sessao.respostas.fotos;
      const metas = Array.isArray(lista) ? lista : [];
      for (const m of metas as { nome: string }[]) {
        const f = arquivosRef.current.get(m.nome);
        if (f) fd.append("fotos", f, f.name);
      }
      const r = await concluirAtendimento(fd);
      if (!r.ok) throw new Error(r.error);
      setConcluido(true);
      arquivosRef.current.clear();
      setMsgs((m) => [
        ...m,
        { de: "agente", texto: "Registrado! Sua solicitação foi criada e a equipe já foi avisada. Guarde este protocolo." },
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Check className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-3 text-lg font-bold text-emerald-900">Recebido!</h1>
        <div className="mt-3 space-y-2 text-left">
          {msgs.slice(-1).map((m, i) => (
            <p key={i} className="text-sm text-emerald-800">{m.texto}</p>
          ))}
        </div>
        <p className="mt-3 text-xs text-emerald-700">Origem: {origem}</p>
      </section>
    );
  }

  return (
    <section aria-label="Atendimento" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-950 px-4 py-3 text-white">
        <p className="text-sm font-black">Atendimento · {origem}</p>
        <p className="text-[11px] text-zinc-400">
          {sessao.concluidos.length} de {sessao.concluidos.length + (atual ? 1 : 0)} etapas
        </p>
      </div>

      <div className="max-h-[46dvh] space-y-2 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.de === "agente" ? "flex justify-start" : "flex justify-end"}>
            <p
              className={
                m.de === "agente"
                  ? "max-w-[85%] rounded-2xl rounded-tl-md bg-zinc-100 px-3 py-2 text-sm text-zinc-900"
                  : "max-w-[85%] rounded-2xl rounded-tr-md bg-zinc-900 px-3 py-2 text-sm text-white"
              }
            >
              {m.texto}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 p-4">
        {erro && (
          <p role="alert" className="mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}

        {atual && atual.tipo !== "confirmacao" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (atual.tipo === "anexo") {
                avancar(atual, arquivos.map((f) => ({ nome: f.name.slice(0, 120), mime: f.type, tamanhoBytes: f.size })), arquivos.length > 0 ? `${arquivos.length} foto(s)` : "Sem foto");
              } else if (atual.tipo === "numero") {
                avancar(atual, texto, texto);
              } else {
                avancar(atual, texto, texto || "—");
              }
            }}
            className="flex gap-2"
          >
            {atual.tipo === "opcao" ? (
              <div className="flex flex-1 flex-wrap gap-2">
                {(atual.opcoes ?? []).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => avancar(atual, o, o)}
                    disabled={enviando}
                    className="min-h-[44px] flex-1 rounded-xl bg-zinc-900 px-3 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-60"
                  >
                    {o}
                  </button>
                ))}
              </div>
            ) : atual.tipo === "anexo" ? (
              <>
                <input
                  aria-label={atual.rotulo}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                  multiple
                  onChange={(e) => {
                    const lista = [...e.target.files ?? []].slice(0, 6);
                    setArquivos(lista);
                    for (const f of lista) arquivosRef.current.set(f.name.slice(0, 120), f);
                  }}
                  disabled={enviando}
                  className="min-h-[44px] flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white disabled:opacity-60"
                />
                <button type="submit" disabled={enviando} aria-label="Enviar" className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-60">
                  <Send className="size-5" />
                </button>
              </>
            ) : (
              <>
                <input
                  aria-label={atual.rotulo}
                  type={atual.tipo === "numero" ? "number" : atual.tipo === "email" ? "email" : atual.tipo === "telefone" ? "tel" : "text"}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={enviando}
                  placeholder={atual.rotulo}
                  autoFocus
                  className={campo}
                />
                <button type="submit" disabled={enviando} aria-label="Enviar" className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-60">
                  <Send className="size-5" />
                </button>
              </>
            )}
          </form>
        )}

        {atual && atual.tipo === "confirmacao" && (
          <div className="space-y-2">
            <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
              {resumoFinal.length === 0 && (
                <p className="text-xs text-zinc-500">Revise acima e confirme o envio.</p>
              )}
              {resumoFinal.map((l, i) => (
                <p key={i} className="py-0.5 text-xs text-zinc-700">
                  <strong>{l.pergunta}:</strong> {l.resposta}
                </p>
              ))}
            </div>
            <form onSubmit={enviar} className="flex gap-2">
              <button type="submit" disabled={enviando} className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                {enviando && <LoaderCircle className="size-5 animate-spin" />}
                Confirmar e enviar
              </button>
            </form>
          </div>
        )}

        {!atual && !sessao.confirmada && (
          <p className="text-xs text-zinc-500">Revise as respostas acima.</p>
        )}

        <div className="mt-2 flex justify-between">
          <button type="button" onClick={voltar} disabled={sessao.concluidos.length === 0 || enviando} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 disabled:opacity-40">
            <ArrowLeft className="size-4" /> Voltar
          </button>
          <span className="self-center text-[11px] text-zinc-400">Sem IA · triagem direta</span>
        </div>
      </div>
    </section>
  );
}
