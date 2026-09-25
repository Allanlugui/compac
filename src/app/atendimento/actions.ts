"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { gerarTokenPublico } from "@/lib/tokens";
import { resolverEntrada, type TipoAtendimento } from "@/lib/intake/contexto";
import { novaSessao, proximaPergunta, responder } from "@/lib/intake/engine";
import { mapearChamado, mapearSolicitacao } from "@/lib/intake/mapeamento";
import type { AnexoIntake } from "@/lib/intake/types";

export type ConcluirResult = { ok: true; protocolo: string } | { ok: false; error: string };

const MIME_FOTOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FOTOS = 6;
const BUCKET = "manutencao-midia";

function sanitizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-60);
}

/**
 * Conclusão do atendimento (BLOCO 3): re-resolve o contexto server-side,
 * revalida TODAS as respostas pelo engine (nada do cliente é confiável),
 * faz upload das fotos e cria o ticket real (chamado ou solicitação).
 * Fluxo antigo preservado em paralelo — nada dele é tocado aqui.
 */
export async function concluirAtendimento(formData: FormData): Promise<ConcluirResult> {
  const kind = String(formData.get("kind") ?? "") as TipoAtendimento;
  const ref = String(formData.get("ref") ?? "");
  if (!["a", "l", "u", "c"].includes(kind)) return { ok: false, error: "Atendimento inválido." };

  let respostas: Record<string, unknown>;
  try {
    respostas = JSON.parse(String(formData.get("respostas") ?? "{}")) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Respostas inválidas." };
  }

  const svc = createServiceClient();
  const ctx = await resolverEntrada(svc as never, kind, ref);
  if (!ctx.ok) return { ok: false, error: "Contexto expirado. Recomece pelo link/QR." };
  const entrada = ctx.entrada;

  // Revalidação integral: reconstrói a sessão slot a slot.
  let sessao = novaSessao(entrada.tipo === "compra" ? "compra" : "manutencao", entrada);
  for (;;) {
    const prox = proximaPergunta(sessao);
    if (!prox) break;
    if (prox.tipo === "confirmacao") {
      const r = responder(sessao, prox.id, true);
      if (!r.ok) return { ok: false, error: r.error };
      sessao = r.sessao;
      break;
    }
    const r = responder(sessao, prox.id, respostas[prox.id]);
    if (!r.ok) return { ok: false, error: `Etapa "${prox.id}": ${r.error}` };
    sessao = r.sessao;
  }

  const arquivos = formData.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length > MAX_FOTOS) return { ok: false, error: `Máximo de ${MAX_FOTOS} fotos.` };
  for (const f of arquivos) {
    if (!MIME_FOTOS.has(f.type)) return { ok: false, error: "Apenas fotos JPG, PNG, WebP ou GIF." };
    if (f.size > MAX_BYTES) return { ok: false, error: "Imagem excede 8 MB." };
  }

  if (entrada.tipo === "compra") {
    return concluirCompra(svc, sessao, entrada, arquivos);
  }
  return concluirManutencao(svc, sessao, entrada, arquivos);
}

type Svc = ReturnType<typeof createServiceClient>;
type Sessao = ReturnType<typeof novaSessao>;

async function concluirManutencao(
  svc: Svc,
  sessao: Sessao,
  entrada: Sessao["entrada"],
  arquivos: File[],
): Promise<ConcluirResult> {
  const p = mapearChamado(sessao);
  // Sem colunas de vínculo em `chamados`: contato/acompanhantes vão ao texto (portável pré/pós-migration).
  const extras = [
    p.contato_email && `Contato: ${p.contato_email}${p.contato_telefone ? ` · ${p.contato_telefone}` : ""}`,
    p.acompanhantes.length > 0 && `Acompanhar: ${p.acompanhantes.join(", ")}`,
  ].filter(Boolean);
  const descricao = extras.length > 0 ? `${p.descricao}\n\n${extras.join("\n")}` : p.descricao;

  const id = crypto.randomUUID();
  const { error } = await svc.from("chamados").insert({
    id,
    organization_id: p.organization_id,
    ativo_id: p.ativo_id,
    solicitante: p.solicitante,
    descricao,
    fotos_antes: [],
  });
  if (error) {
    console.error("[atendimento] insert chamado:", error.code ?? "?", (error.message ?? "").slice(0, 200));
    return { ok: false, error: "Não foi possível registrar. Tente novamente." };
  }

  const paths = await salvarFotos(svc, p.organization_id, `chamados/${id}`, arquivos);
  if (paths.length > 0) {
    await svc.from("chamados").update({ fotos_antes: paths }).eq("id", id);
    await svc.from("os_fotos").insert(
      paths.map((path) => ({ organization_id: p.organization_id, chamado_id: id, path, categoria: "antes", user_id: null })),
    );
  }
  await svc.from("auditoria_logs").insert({
    tabela: "chamados",
    registro_id: id,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { via: "atendimento", ativo_id: p.ativo_id, solicitante: p.solicitante, fotos: paths.length },
    executado_por: p.solicitante,
    organization_id: p.organization_id,
  });
  return { ok: true, protocolo: id.slice(0, 8).toUpperCase() };
}

async function concluirCompra(
  svc: Svc,
  sessao: Sessao,
  entrada: Sessao["entrada"],
  arquivos: File[],
): Promise<ConcluirResult> {
  const p = mapearSolicitacao(sessao);
  // `setor` é NOT NULL: deriva do departamento/centro/localidade ou rótulo neutro.
  let setor = "Atendimento";
  if (entrada.departamentoId) {
    const { data: dep } = await svc
      .from("departamentos_setores")
      .select("nome")
      .eq("id", entrada.departamentoId)
      .maybeSingle();
    const nome = (dep as unknown as { nome?: string } | null)?.nome;
    if (nome) setor = String(nome).slice(0, 80);
  } else if (p.centro_custo_id) {
    const { data: cc } = await svc
      .from("centros_custo")
      .select("codigo, nome")
      .eq("id", p.centro_custo_id)
      .maybeSingle();
    const row = cc as unknown as { codigo?: string; nome?: string } | null;
    if (row?.nome) setor = `${row.codigo ? `${row.codigo} — ` : ""}${row.nome}`.slice(0, 80);
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = crypto.randomUUID();
    const qr_code_hash = gerarTokenPublico(24);
    const { error } = await svc.from("solicitacoes_compra").insert({
      id,
      organization_id: p.organization_id,
      setor,
      solicitante: p.solicitante,
      item: p.item,
      quantidade: p.quantidade,
      justificativa: p.justificativa,
      valor_estimado: 0,
      qr_code_hash,
      ...(p.qr_contexto_id ? { qr_contexto_id: p.qr_contexto_id } : {}),
      ...(entrada.localidadeId ? { localidade_id: entrada.localidadeId } : {}),
      ...(entrada.departamentoId ? { departamento_id: entrada.departamentoId } : {}),
      ...(p.centro_custo_id ? { centro_custo_id: p.centro_custo_id } : {}),
      ...(entrada.almoxarifadoId ? { almoxarifado_id: entrada.almoxarifadoId } : {}),
    });
    if (error) {
      if (error.code === "23505") continue;
      console.error("[atendimento] insert solicitacao:", error.code ?? "?", (error.message ?? "").slice(0, 200));
      return { ok: false, error: "Não foi possível registrar. Tente novamente." };
    }
    await svc.from("solicitacao_itens").insert({
      organization_id: p.organization_id,
      solicitacao_id: id,
      produto_id: null,
      descricao: p.item,
      quantidade: p.quantidade,
      unidade: "UN",
      justificativa: p.justificativa,
      urgencia: "normal",
    });
    const paths = await salvarFotos(svc, p.organization_id, `solicitacoes/${id}`, arquivos);
    for (const path of paths) {
      await svc.from("solicitacao_anexos").insert({
        organization_id: p.organization_id,
        solicitacao_id: id,
        path,
        nome: path.split("/").pop()?.slice(0, 120) ?? "anexo",
      });
    }
    await svc.from("auditoria_logs").insert({
      tabela: "solicitacoes_compra",
      registro_id: id,
      acao: "INSERT",
      dados_anteriores: null,
      dados_novos: { via: "atendimento", item: p.item, quantidade: p.quantidade },
      executado_por: p.solicitante,
      organization_id: p.organization_id,
    });
    return { ok: true, protocolo: qr_code_hash.slice(0, 8).toUpperCase() };
  }
  return { ok: false, error: "Tente novamente em instantes." };
}

async function salvarFotos(svc: Svc, orgId: string, pasta: string, arquivos: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const f of arquivos) {
    const path = `o/${orgId}/${pasta}/${Date.now()}-${Math.floor(Math.random() * 1e6)}-${sanitizar(f.name)}`;
    const { error } = await svc.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || "image/jpeg",
      upsert: false,
    });
    if (error) {
      console.error("[atendimento] upload foto:", error.message?.slice(0, 200));
      continue;
    }
    paths.push(path);
  }
  return paths;
}

export type { AnexoIntake };
