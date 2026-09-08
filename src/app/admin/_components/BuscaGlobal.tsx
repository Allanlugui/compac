"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Search } from "lucide-react";
import { buscarGlobal, type ResultadoBusca } from "@/app/admin/_actions/busca";

const ROTULO_TIPO: Record<ResultadoBusca["tipo"], string> = {
  ativo: "Ativos",
  chamado: "O.S.",
  compra: "Compras",
  pedido: "Pedidos",
  produto: "Estoque",
  fornecedor: "Fornec.",
  solicitacao: "Solicit.",
  pedidocompra: "Pedido C.",
  localidade: "Local",
};

/** Busca global: botão + diálogo (Ctrl+K no desktop, toque no mobile). */
export default function BuscaGlobal({ mobile }: { mobile?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrir();
      }
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  function abrir() {
    setTermo("");
    setResultados([]);
    setBuscando(false);
    setAberto(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function aoDigitar(valor: string) {
    setTermo(valor);
    if (timer.current) clearTimeout(timer.current);
    if (valor.trim().length < 2) {
      setResultados([]);
      setBuscando(false);
    } else {
      setBuscando(true);
    }
  }

  useEffect(() => {
    if (termo.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      try {
        setResultados(await buscarGlobal(termo));
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [termo]);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Buscar (Ctrl+K)"
        className={
          mobile
            ? "inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-200/60"
            : "hidden min-h-[40px] items-center gap-2 rounded-xl bg-white/5 px-3 text-sm text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white md:inline-flex lg:w-56"
        }
      >
        <Search className="size-4 shrink-0" />
        {!mobile && (
          <>
            <span className="flex-1 text-left">Pesquisar…</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
          </>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Busca global"
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
          onClick={() => setAberto(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-zinc-200 px-4">
              <Search className="size-4 shrink-0 text-zinc-400" />
              <input
                ref={inputRef}
                value={termo}
                onChange={(e) => aoDigitar(e.target.value)}
                placeholder="Ativo, O.S., compra, peça… (mín. 2 letras)"
                aria-label="Termo da busca"
                className="min-h-[52px] w-full bg-transparent text-base outline-none placeholder:text-zinc-400"
              />
              {buscando && <LoaderCircle className="size-4 animate-spin text-zinc-400" />}
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {resultados.length === 0 && termo.trim().length >= 2 && !buscando && (
                <li className="px-3 py-6 text-center text-sm text-zinc-500">
                  Nada encontrado para “{termo.trim()}”.
                </li>
              )}
              {resultados.map((r) => (
                <li key={`${r.tipo}-${r.id}`}>
                  <Link
                    href={r.href}
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-zinc-100"
                  >
                    <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {ROTULO_TIPO[r.tipo]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{r.titulo}</span>
                      <span className="block truncate text-xs text-zinc-500">{r.detalhe}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
