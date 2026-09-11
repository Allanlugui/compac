"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrg } from "@/lib/org";
import { exigirPermissao } from "@/lib/permissoes";
import { registrarLog } from "@/lib/auditoria";
import { gerarTokenPublico } from "@/lib/tokens";
import type {
  AtivoStatus,
  AtributoCategoria,
  CategoriaDocumento,
} from "@/lib/types";

export type CriarAtivoResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type AcaoResult = { ok: true } | { ok: false; error: string };

const MAX_NOME = 120;
const MAX_LOCALIZACAO = 160;

const STATUS: AtivoStatus[] = [
  "operacional",
  "em_manutencao",
  "parado",
  "em_instalacao",
  "em_inspecao",
  "inativo",
  "desativado",
];

const CRITICIDADES = ["baixa", "media", "alta", "critica"];

function revalidar(id?: string) {
  revalidatePath("/admin/ativos");
  if (id) revalidatePath(`/admin/ativos/${id}`);
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

function dataISO(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * Cadastro RÁPIDO: Nome + Código + Categoria + Localização + Status.
 * Token novo de 24 chars (~140 bits); legados de 12 seguem válidos.
 * Código único por organização (23505 → mensagem amigável).
 */
export async function criarAtivo(input: {
  nome: string;
  codigo?: string;
  categoria_id?: string | null;
  localidade_id?: string | null;
  localizacao?: string;
  status?: AtivoStatus;
}): Promise<CriarAtivoResult> {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > MAX_NOME) {
    return { ok: false, error: "Nome do ativo: 2 a 120 caracteres." };
  }
  const codigo = texto(input.codigo, 40)?.toUpperCase() ?? null;
  const localizacao = texto(input.localizacao, MAX_LOCALIZACAO);
  const status: AtivoStatus = STATUS.includes(input.status as AtivoStatus)
    ? (input.status as AtivoStatus)
    : "operacional";

  const supabase = await createClient();
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.criar");

  // Vínculos resolvidos no servidor (pertencem à org?).
  let categoria_id: string | null = null;
  if (input.categoria_id) {
    const { data } = await supabase
      .from("categorias")
      .select("id")
      .eq("id", input.categoria_id)
      .eq("organization_id", ctx.orgId)
      .eq("tipo", "ativo")
      .maybeSingle();
    if (!data) return { ok: false, error: "Categoria inválida." };
    categoria_id = input.categoria_id;
  }
  let localidade_id: string | null = null;
  if (input.localidade_id) {
    const { data } = await supabase
      .from("localidades")
      .select("id")
      .eq("id", input.localidade_id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Localização inválida." };
    localidade_id = input.localidade_id;
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const qr_code_hash = gerarTokenPublico(24);
    const { data, error } = await supabase
      .from("ativos")
      .insert({
        organization_id: ctx.orgId,
        nome,
        codigo,
        categoria_id,
        localidade_id,
        localizacao,
        status,
        qr_code_hash,
      })
      .select("id")
      .single();

    if (!error && data) {
      const id = data.id as string;
      await registrarLog(supabase, {
        tabela: "ativos",
        registro_id: id,
        acao: "INSERT",
        dados_anteriores: null,
        dados_novos: { nome, codigo, categoria_id, localidade_id, status },
        executado_por: ctx.email,
        organization_id: ctx.orgId,
        user_id: ctx.userId,
      });
      revalidar();
      return { ok: true, id };
    }
    if (!error || error.code !== "23505") {
      return { ok: false, error: "Não foi possível salvar o ativo." };
    }
    // Colisão de hash (raro) ou código duplicado: distingue pelo retry.
    if (tentativa === 0 && codigo) {
      const { data: existe } = await supabase
        .from("ativos")
        .select("id")
        .eq("organization_id", ctx.orgId)
        .eq("codigo", codigo)
        .maybeSingle();
      if (existe) return { ok: false, error: "Código já existe nesta organização." };
    }
  }

  return { ok: false, error: "Tente novamente em instantes." };
}

export interface AtualizarAtivoInput {
  id: string;
  nome: string;
  codigo?: string;
  descricao?: string;
  numero_serie?: string;
  patrimonio?: string;
  tag?: string;
  fabricante?: string;
  modelo?: string;
  categoria_id?: string | null;
  localidade_id?: string | null;
  localizacao?: string;
  criticidade?: string;
  prioridade_padrao?: string;
  centro_custo?: string;
  departamento?: string;
  responsavel?: string;
  equipe?: string;
  fornecedor_id?: string | null;
  nota_fiscal?: string;
  data_aquisicao?: string;
  valor_aquisicao?: number | null;
  data_instalacao?: string;
  garantia_ate?: string;
  vida_util_meses?: number | null;
  dados_tecnicos?: Record<string, string>;
}

/** Cadastro COMPLETO (todas as seções; valida atributos da categoria). */
export async function atualizarAtivo(input: AtualizarAtivoInput): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.editar");
  if (!input.id) return { ok: false, error: "Ativo inválido." };

  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > MAX_NOME) {
    return { ok: false, error: "Nome do ativo: 2 a 120 caracteres." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("ativos")
    .select("id, nome, codigo, categoria_id")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Ativo não encontrado." };

  const categoria_id = input.categoria_id ?? null;
  let atributos: AtributoCategoria[] = [];
  if (categoria_id) {
    const { data: cat } = await supabase
      .from("categorias")
      .select("atributos")
      .eq("id", categoria_id)
      .eq("organization_id", ctx.orgId)
      .eq("tipo", "ativo")
      .maybeSingle();
    if (!cat) return { ok: false, error: "Categoria inválida." };
    atributos = (cat.atributos ?? []) as AtributoCategoria[];
  }

  let localidade_id: string | null = null;
  if (input.localidade_id) {
    const { data } = await supabase
      .from("localidades")
      .select("id")
      .eq("id", input.localidade_id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Localização inválida." };
    localidade_id = input.localidade_id;
  }

  let fornecedor_id: string | null = null;
  if (input.fornecedor_id) {
    const { data } = await supabase
      .from("fornecedores")
      .select("id")
      .eq("id", input.fornecedor_id)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (!data) return { ok: false, error: "Fornecedor inválido." };
    fornecedor_id = input.fornecedor_id;
  }

  // Dados técnicos: só chaves do schema; obrigatórios preenchidos.
  const dados_tecnicos: Record<string, string> = {};
  if (input.dados_tecnicos && typeof input.dados_tecnicos === "object") {
    const entradas = Object.entries(input.dados_tecnicos).slice(0, 50);
    for (const a of atributos) {
      const v = (entradas.find(([k]) => k === a.nome)?.[1] ?? "").trim().slice(0, 200);
      if (a.obrigatorio && v === "") {
        return { ok: false, error: `Atributo obrigatório: ${a.nome}.` };
      }
      if (v !== "") {
        if (a.tipo === "numero" && !Number.isFinite(Number(v))) {
          return { ok: false, error: `Atributo ${a.nome}: número inválido.` };
        }
        if (a.tipo === "selecao" && a.opcoes && !a.opcoes.includes(v)) {
          return { ok: false, error: `Atributo ${a.nome}: opção inválida.` };
        }
        if (a.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          return { ok: false, error: `Atributo ${a.nome}: data inválida.` };
        }
        dados_tecnicos[a.nome] = v;
      }
    }
  } else if (atributos.some((a) => a.obrigatorio)) {
    return { ok: false, error: "Preencha os dados técnicos obrigatórios." };
  }

  const crit = texto(input.criticidade, 20);
  const prio = texto(input.prioridade_padrao, 20);
  if (crit && !CRITICIDADES.includes(crit)) return { ok: false, error: "Criticidade inválida." };
  if (prio && !CRITICIDADES.includes(prio)) return { ok: false, error: "Prioridade inválida." };

  const valor = input.valor_aquisicao;
  const vida = input.vida_util_meses;
  if (valor !== null && valor !== undefined && (!Number.isFinite(valor) || valor < 0)) {
    return { ok: false, error: "Valor de aquisição inválido." };
  }
  if (vida !== null && vida !== undefined && (!Number.isInteger(vida) || vida <= 0)) {
    return { ok: false, error: "Vida útil inválida." };
  }

  const patch = {
    nome,
    codigo: texto(input.codigo, 40)?.toUpperCase() ?? null,
    descricao: texto(input.descricao, 2000),
    numero_serie: texto(input.numero_serie, 80),
    patrimonio: texto(input.patrimonio, 80),
    tag: texto(input.tag, 40),
    fabricante: texto(input.fabricante, 120),
    modelo: texto(input.modelo, 120),
    categoria_id,
    localidade_id,
    localizacao: texto(input.localizacao, MAX_LOCALIZACAO),
    criticidade: crit,
    prioridade_padrao: prio,
    centro_custo: texto(input.centro_custo, 80),
    departamento: texto(input.departamento, 80),
    responsavel: texto(input.responsavel, 120),
    equipe: texto(input.equipe, 120),
    fornecedor_id,
    nota_fiscal: texto(input.nota_fiscal, 60),
    data_aquisicao: dataISO(input.data_aquisicao),
    valor_aquisicao: valor ?? null,
    data_instalacao: dataISO(input.data_instalacao),
    garantia_ate: dataISO(input.garantia_ate),
    vida_util_meses: vida ?? null,
    dados_tecnicos,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("ativos")
    .update(patch)
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Código já existe nesta organização." };
    return { ok: false, error: "Não foi possível salvar." };
  }

  await registrarLog(supabase, {
    tabela: "ativos",
    registro_id: input.id,
    acao: "UPDATE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { nome, codigo: patch.codigo, categoria_id, localidade_id },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar(input.id);
  return { ok: true };
}

/** Persiste SÓ os dados técnicos (validados contra a categoria). */
export async function salvarDadosTecnicos(input: {
  id: string;
  dados_tecnicos: Record<string, string>;
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.editar");
  if (!input.id) return { ok: false, error: "Ativo inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("ativos")
    .select("id, categoria_id")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Ativo não encontrado." };

  let atributos: AtributoCategoria[] = [];
  const catId = (atual as { categoria_id: string | null }).categoria_id;
  if (catId) {
    const { data: cat } = await supabase
      .from("categorias")
      .select("atributos")
      .eq("id", catId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    atributos = ((cat?.atributos ?? []) as AtributoCategoria[]);
  }

  const dados_tecnicos: Record<string, string> = {};
  const entradas = Object.entries(input.dados_tecnicos ?? {}).slice(0, 50);
  for (const a of atributos) {
    const v = (entradas.find(([k]) => k === a.nome)?.[1] ?? "").trim().slice(0, 200);
    if (a.obrigatorio && v === "") {
      return { ok: false, error: `Atributo obrigatório: ${a.nome}.` };
    }
    if (v !== "") {
      if (a.tipo === "numero" && !Number.isFinite(Number(v))) {
        return { ok: false, error: `Atributo ${a.nome}: número inválido.` };
      }
      if (a.tipo === "selecao" && a.opcoes && !a.opcoes.includes(v)) {
        return { ok: false, error: `Atributo ${a.nome}: opção inválida.` };
      }
      if (a.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return { ok: false, error: `Atributo ${a.nome}: data inválida.` };
      }
      dados_tecnicos[a.nome] = v;
    }
  }

  const { error } = await supabase
    .from("ativos")
    .update({ dados_tecnicos, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar." };

  await registrarLog(supabase, {
    tabela: "ativos",
    registro_id: input.id,
    acao: "UPDATE",
    dados_anteriores: null,
    dados_novos: { dados_tecnicos },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar(input.id);
  return { ok: true };
}

/** Troca de status com histórico + auditoria. */
export async function atualizarStatusAtivo(input: {
  id: string;
  status: AtivoStatus;
  motivo?: string;
}): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.alterar_status");
  if (!input.id || !STATUS.includes(input.status)) {
    return { ok: false, error: "Status inválido." };
  }
  const motivo = texto(input.motivo, 300);

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("ativos")
    .select("status")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Ativo não encontrado." };
  if ((atual as { status: string }).status === input.status) return { ok: true };

  const { error } = await supabase
    .from("ativos")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível alterar o status." };

  await supabase.from("ativo_status_historico").insert({
    organization_id: ctx.orgId,
    ativo_id: input.id,
    de: (atual as { status: string }).status,
    para: input.status,
    motivo,
    user_id: ctx.userId,
  });
  await registrarLog(supabase, {
    tabela: "ativos",
    registro_id: input.id,
    acao: "STATUS_CHANGE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: { status: input.status, motivo },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar(input.id);
  return { ok: true };
}

/**
 * Exclusão FÍSICA (SÓ ADMIN) — último recurso, nunca operação normal.
 * Verifica TODAS as dependências; se houver qualquer uma, BLOQUEIA e
 * orienta o arquivamento (`Inativo` → `Desativado`), que preserva o
 * histórico para auditoria. Sem dependências não há órfãos: documentos
 * são removidos do Storage antes das linhas.
 */
export async function excluirAtivo(input: { id: string }): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.excluir");
  if (!input.id) return { ok: false, error: "Ativo inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("ativos")
    .select("nome, codigo")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Ativo não encontrado." };

  const BLOQUEIO =
    "Este ativo possui histórico ou informações relacionadas. Recomendamos desativá-lo em vez de excluí-lo.";

  const dependencias: string[] = [];
  const contar = async (tabela: string, coluna: string): Promise<number> => {
    const { count } = await supabase
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq(coluna, input.id)
      .eq("organization_id", ctx.orgId);
    return count ?? 0;
  };

  if ((await contar("chamados", "ativo_id")) > 0) dependencias.push("chamados/O.S.");
  if ((await contar("ativo_status_historico", "ativo_id")) > 0) dependencias.push("histórico de status");
  if ((await contar("ativo_documentos", "ativo_id")) > 0) dependencias.push("documentos/fotos");
  if ((await contar("checklist_modelos", "ativo_id")) > 0) dependencias.push("checklists");

  if (dependencias.length > 0) {
    return { ok: false, error: `${BLOQUEIO} (${dependencias.join(", ")}.)` };
  }

  // Sem dependências: remove arquivos do Storage primeiro (anti-órfão),
  // depois registros, depois o ativo.
  const { data: docs } = await supabase
    .from("ativo_documentos")
    .select("path")
    .eq("ativo_id", input.id)
    .eq("organization_id", ctx.orgId);
  const paths = ((docs ?? []) as { path: string }[]).map((d) => d.path).filter(Boolean);
  if (paths.length > 0) {
    const svc = createServiceClient();
    await svc.storage.from("manutencao-midia").remove(paths);
  }

  const { error } = await supabase
    .from("ativos")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await registrarLog(supabase, {
    tabela: "ativos",
    registro_id: input.id,
    acao: "DELETE",
    dados_anteriores: atual as unknown as Record<string, unknown>,
    dados_novos: null,
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar();
  return { ok: true };
}

const MIME_FOTO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const MIME_DOC = new Set([
  ...MIME_FOTO,
  "application/pdf",
]);
const MAX_FOTO = 8 * 1024 * 1024;
const MAX_DOC = 10 * 1024 * 1024;

const CATS_DOC: CategoriaDocumento[] = [
  "manual",
  "ficha_tecnica",
  "nota_fiscal",
  "certificado",
  "laudo",
  "garantia",
  "contrato",
  "desenho",
  "procedimento",
  "foto",
  "outro",
];

function sanitizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-60) || "arquivo";
}

/**
 * Upload de foto/documento do ativo (Storage privado `o/{org}/...`).
 * `categoria=foto` usa o allowlist de imagens; demais aceitam PDF.
 */
export async function uploadArquivoAtivo(input: {
  ativoId: string;
  file: File;
  categoria: CategoriaDocumento;
  nome?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.editar");
  if (!input.ativoId) return { ok: false, error: "Ativo inválido." };
  if (!CATS_DOC.includes(input.categoria)) return { ok: false, error: "Categoria inválida." };

  const ehFoto = input.categoria === "foto";
  const permitidos = ehFoto ? MIME_FOTO : MIME_DOC;
  const limite = ehFoto ? MAX_FOTO : MAX_DOC;
  if (!permitidos.has(input.file.type)) {
    return { ok: false, error: ehFoto ? "Apenas fotos JPG/PNG/WebP/GIF." : "Apenas PDF ou fotos." };
  }
  if (input.file.size <= 0 || input.file.size > limite) {
    return { ok: false, error: `Arquivo excede ${ehFoto ? 8 : 10} MB.` };
  }

  const supabase = await createClient();
  const { data: ativo } = await supabase
    .from("ativos")
    .select("id")
    .eq("id", input.ativoId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!ativo) return { ok: false, error: "Ativo não encontrado." };

  const pasta = ehFoto ? "fotos" : "documentos";
  const path = `o/${ctx.orgId}/ativos/${input.ativoId}/${pasta}/${Date.now()}-${Math.floor(Math.random() * 1e6)}-${sanitizar(input.file.name)}`;

  const svc = createServiceClient();
  const { error: erroUp } = await svc.storage
    .from("manutencao-midia")
    .upload(path, input.file, { contentType: input.file.type || "application/octet-stream", upsert: false });
  if (erroUp) return { ok: false, error: "Falha no envio do arquivo." };

  const nome = texto(input.nome, 160) ?? sanitizar(input.file.name);
  const { data: doc, error } = await supabase
    .from("ativo_documentos")
    .insert({
      organization_id: ctx.orgId,
      ativo_id: input.ativoId,
      nome,
      categoria: input.categoria,
      path,
      tamanho_bytes: input.file.size,
      mime: input.file.type,
    })
    .select("id")
    .single();
  if (error || !doc) {
    await svc.storage.from("manutencao-midia").remove([path]);
    return { ok: false, error: "Não foi possível registrar." };
  }

  await registrarLog(supabase, {
    tabela: "ativo_documentos",
    registro_id: doc.id as string,
    acao: "INSERT",
    dados_anteriores: null,
    dados_novos: { nome, categoria: input.categoria, ativo_id: input.ativoId },
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar(input.ativoId);
  return { ok: true, id: doc.id as string };
}

/** Exclui documento (arquivo + registro). */
export async function excluirDocumento(input: { id: string }): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.editar");
  if (!input.id) return { ok: false, error: "Documento inválido." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("ativo_documentos")
    .select("id, ativo_id, nome, path")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Documento não encontrado." };

  const svc = createServiceClient();
  await svc.storage.from("manutencao-midia").remove([(doc as { path: string }).path]);
  const { error } = await supabase
    .from("ativo_documentos")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível excluir." };

  await registrarLog(supabase, {
    tabela: "ativo_documentos",
    registro_id: input.id,
    acao: "DELETE",
    dados_anteriores: doc as unknown as Record<string, unknown>,
    dados_novos: null,
    executado_por: ctx.email,
    organization_id: ctx.orgId,
    user_id: ctx.userId,
  });
  revalidar((doc as { ativo_id: string }).ativo_id);
  return { ok: true };
}

/**
 * Regenera o token do QR. ATENÇÃO: invalida a etiqueta impressa —
 * a UI exige confirmação explícita. Histórico preservado em auditoria.
 */
export async function regenerarQR(input: { id: string }): Promise<
  { ok: true; hash: string } | { ok: false; error: string }
> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.editar");
  if (!input.id) return { ok: false, error: "Ativo inválido." };

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("ativos")
    .select("qr_code_hash")
    .eq("id", input.id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Ativo não encontrado." };

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const hash = gerarTokenPublico(24);
    const { error } = await supabase
      .from("ativos")
      .update({ qr_code_hash: hash, qr_impresso_em: null, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.orgId);
    if (!error) {
      await registrarLog(supabase, {
        tabela: "ativos",
        registro_id: input.id,
        acao: "QR_REGENERATED",
        dados_anteriores: { qr_code_hash: (atual as { qr_code_hash: string }).qr_code_hash },
        dados_novos: { qr_code_hash: hash, regenerado: true },
        executado_por: ctx.email,
        organization_id: ctx.orgId,
        user_id: ctx.userId,
      });
      revalidar(input.id);
      return { ok: true, hash };
    }
    if (error.code !== "23505") return { ok: false, error: "Não foi possível regenerar." };
  }
  return { ok: false, error: "Tente novamente em instantes." };
}

/** Marca impressão da etiqueta (data da última impressão). */
export async function marcarQrImpresso(input: { ids: string[] }): Promise<AcaoResult> {
  const ctx = await requireOrg();
  exigirPermissao(ctx, "ativos.editar");
  const ids = (Array.isArray(input.ids) ? input.ids : []).filter(
    (id) => typeof id === "string" && id.length >= 8,
  ).slice(0, 100);
  if (ids.length === 0) return { ok: false, error: "Nenhum ativo selecionado." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ativos")
    .update({ qr_impresso_em: now })
    .in("id", ids)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível registrar." };
  for (const aid of ids) {
    await registrarLog(supabase, {
      tabela: "ativos", registro_id: aid, acao: "UPDATE",
      dados_anteriores: null, dados_novos: { qr_impresso_em: now },
      executado_por: ctx.email, organization_id: ctx.orgId, user_id: ctx.userId,
    });
  }
  return { ok: true };
}
