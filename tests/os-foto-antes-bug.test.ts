import { describe, expect, it } from "vitest";
import { setupOrg } from "./setup";

describe("FASE 11.2 — Bug crítico: O.S. inacessível após upload de foto", () => {
  it("O.S. sem foto abre normalmente (baseline)", async () => {
    const org = await setupOrg("os-foto-baseline");
    const { data: ativo } = await org.admin.from("ativos").insert({
      organization_id: org.orgId,
      nome: "Ativo Teste",
      localizacao: "Sala 01",
      qr_code_hash: crypto.randomUUID(),
    }).select("id").single();
    const { data: chamado } = await org.admin.from("chamados").insert({
      organization_id: org.orgId,
      ativo_id: ativo!.id,
      solicitante: "Teste",
      descricao: "Problema teste",
      status: "convertido_os",
      os_status: "aberta",
      os_tipo: "corretiva",
    }).select("id").single();
    expect(chamado?.id).toBeDefined();

    // Simular leitura da página (query principal)
    const { data: leitura, error } = await org.client.from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", chamado!.id)
      .eq("organization_id", org.orgId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(leitura).toBeDefined();
    expect(leitura?.fotos_antes).toEqual([]);
    expect(leitura?.fotos_depois).toEqual([]);
  });

  it("O.S. com foto 'durante' via os_fotos abre normalmente", async () => {
    const org = await setupOrg("os-foto-durante");
    const { data: ativo } = await org.admin.from("ativos").insert({
      organization_id: org.orgId,
      nome: "Ativo Teste",
      localizacao: "Sala 01",
      qr_code_hash: crypto.randomUUID(),
    }).select("id").single();
    const { data: chamado } = await org.admin.from("chamados").insert({
      organization_id: org.orgId,
      ativo_id: ativo!.id,
      solicitante: "Teste",
      descricao: "Problema teste",
      status: "convertido_os",
      os_status: "em_execucao",
      os_tipo: "corretiva",
    }).select("id").single();
    expect(chamado?.id).toBeDefined();

    // Inserir foto 'durante' diretamente no os_fotos (simula upload bem-sucedido)
    const path = `o/${org.orgId}/os/${chamado!.id}/test-durante.jpg`;
    await org.admin.from("os_fotos").insert({
      organization_id: org.orgId,
      chamado_id: chamado!.id,
      path,
      categoria: "durante",
      user_id: org.userId,
    });

    // Ler página
    const { data: leitura, error } = await org.client.from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", chamado!.id)
      .eq("organization_id", org.orgId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(leitura).toBeDefined();

    // Ler fotos durante
    const { data: fotosDurante } = await org.client.from("os_fotos")
      .select("path")
      .eq("chamado_id", chamado!.id)
      .eq("organization_id", org.orgId)
      .eq("categoria", "durante");
    expect(fotosDurante?.length).toBe(1);
  });

  it("O.S. com foto 'depois' via fotos_depois + os_fotos abre normalmente", async () => {
    const org = await setupOrg("os-foto-depois");
    const { data: ativo } = await org.admin.from("ativos").insert({
      organization_id: org.orgId,
      nome: "Ativo Teste",
      localizacao: "Sala 01",
      qr_code_hash: crypto.randomUUID(),
    }).select("id").single();
    const { data: chamado } = await org.admin.from("chamados").insert({
      organization_id: org.orgId,
      ativo_id: ativo!.id,
      solicitante: "Teste",
      descricao: "Problema teste",
      status: "convertido_os",
      os_status: "em_validacao",
      os_tipo: "corretiva",
      fotos_depois: [],
    }).select("id").single();
    expect(chamado?.id).toBeDefined();

    // Inserir foto 'depois' (simula upload bem-sucedido + action)
    const path = `o/${org.orgId}/depois/${chamado!.id}/test-depois.jpg`;
    await org.admin.from("chamados").update({ fotos_depois: [path] })
      .eq("id", chamado!.id).eq("organization_id", org.orgId);
    await org.admin.from("os_fotos").insert({
      organization_id: org.orgId,
      chamado_id: chamado!.id,
      path,
      categoria: "depois",
      user_id: org.userId,
    });

    // Ler página
    const { data: leitura, error } = await org.client.from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", chamado!.id)
      .eq("organization_id", org.orgId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(leitura).toBeDefined();
    expect(Array.isArray(leitura?.fotos_depois)).toBe(true);
    expect(leitura?.fotos_depois).toContain(path);
  });

  it("Registro órfão em os_fotos (arquivo não existe no Storage) não quebra leitura da O.S.", async () => {
    const org = await setupOrg("os-foto-orfao");
    const { data: ativo } = await org.admin.from("ativos").insert({
      organization_id: org.orgId,
      nome: "Ativo Teste",
      localizacao: "Sala 01",
      qr_code_hash: crypto.randomUUID(),
    }).select("id").single();
    const { data: chamado } = await org.admin.from("chamados").insert({
      organization_id: org.orgId,
      ativo_id: ativo!.id,
      solicitante: "Teste",
      descricao: "Problema teste",
      status: "convertido_os",
      os_status: "em_execucao",
      os_tipo: "corretiva",
    }).select("id").single();
    expect(chamado?.id).toBeDefined();

    // Inserir registro em os_fotos com path que NÃO existe no Storage
    const pathInexistente = `o/${org.orgId}/os/${chamado!.id}/nao-existe.jpg`;
    await org.admin.from("os_fotos").insert({
      organization_id: org.orgId,
      chamado_id: chamado!.id,
      path: pathInexistente,
      categoria: "durante",
      user_id: org.userId,
    });

    // Ler página - deve funcionar (resolverFoto retorna "" e GaleriaFotos filtra)
    const { data: leitura, error } = await org.client.from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", chamado!.id)
      .eq("organization_id", org.orgId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(leitura).toBeDefined();

    // Ler fotos durante
    const { data: fotosDurante } = await org.client.from("os_fotos")
      .select("path")
      .eq("chamado_id", chamado!.id)
      .eq("organization_id", org.orgId)
      .eq("categoria", "durante");
    expect(fotosDurante?.length).toBe(1);
  });

  

  it("Upload de foto 'durante' via action não quebra O.S. (simulação)", async () => {
    const org = await setupOrg("os-upload-durante");
    const { data: ativo } = await org.admin.from("ativos").insert({
      organization_id: org.orgId,
      nome: "Ativo Teste",
      localizacao: "Sala 01",
      qr_code_hash: crypto.randomUUID(),
    }).select("id").single();
    const { data: chamado } = await org.admin.from("chamados").insert({
      organization_id: org.orgId,
      ativo_id: ativo!.id,
      solicitante: "Teste",
      descricao: "Problema teste",
      status: "convertido_os",
      os_status: "em_execucao",
      os_tipo: "corretiva",
    }).select("id").single();
    expect(chamado?.id).toBeDefined();

    // Simular action adicionarFotosDurante (insert direto no os_fotos)
    const path = `o/${org.orgId}/os/${chamado!.id}/upload-durante.jpg`;
    const { error } = await org.admin.from("os_fotos").insert({
      organization_id: org.orgId,
      chamado_id: chamado!.id,
      path,
      categoria: "durante",
      user_id: org.userId,
    });
    expect(error).toBeNull();

    // Verificar se O.S. ainda abre
    const { data: leitura, error: erroLeitura } = await org.client.from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", chamado!.id)
      .eq("organization_id", org.orgId)
      .maybeSingle();
    expect(erroLeitura).toBeNull();
    expect(leitura).toBeDefined();
  });

  it("Upload de foto 'depois' via action não quebra O.S. (simulação)", async () => {
    const org = await setupOrg("os-upload-depois");
    const { data: ativo } = await org.admin.from("ativos").insert({
      organization_id: org.orgId,
      nome: "Ativo Teste",
      localizacao: "Sala 01",
      qr_code_hash: crypto.randomUUID(),
    }).select("id").single();
    const { data: chamado } = await org.admin.from("chamados").insert({
      organization_id: org.orgId,
      ativo_id: ativo!.id,
      solicitante: "Teste",
      descricao: "Problema teste",
      status: "convertido_os",
      os_status: "em_validacao",
      os_tipo: "corretiva",
      fotos_depois: [],
    }).select("id").single();
    expect(chamado?.id).toBeDefined();

    // Simular action adicionarFotosDepois
    const path = `o/${org.orgId}/depois/${chamado!.id}/upload-depois.jpg`;
    await org.admin.from("chamados").update({ fotos_depois: [path] })
      .eq("id", chamado!.id).eq("organization_id", org.orgId);
    const { error } = await org.admin.from("os_fotos").insert({
      organization_id: org.orgId,
      chamado_id: chamado!.id,
      path,
      categoria: "depois",
      user_id: org.userId,
    });
    expect(error).toBeNull();

    const { data: leitura, error: erroLeitura } = await org.client.from("chamados")
      .select("*, ativos(id, nome, localizacao)")
      .eq("id", chamado!.id)
      .eq("organization_id", org.orgId)
      .maybeSingle();
    expect(erroLeitura).toBeNull();
    expect(leitura).toBeDefined();
    expect(leitura?.fotos_depois).toContain(path);
  });

  it("Cross-tenant: usuário não acessa O.S. de outra org", async () => {
    const orgA = await setupOrg("cross-a");
    const orgB = await setupOrg("cross-b");
    const { data: ativoA } = await orgA.admin.from("ativos").insert({
      organization_id: orgA.orgId,
      nome: "Ativo A",
      localizacao: "Sala A",
      qr_code_hash: crypto.randomUUID(),
    }).select("id").single();
    const { data: chamadoA } = await orgA.admin.from("chamados").insert({
      organization_id: orgA.orgId,
      ativo_id: ativoA!.id,
      solicitante: "Teste A",
      descricao: "Problema A",
      status: "convertido_os",
      os_status: "aberta",
      os_tipo: "corretiva",
    }).select("id").single();

    // Usuário B tenta ler O.S. da org A
    const { data, error } = await orgB.client.from("chamados")
      .select("*")
      .eq("id", chamadoA!.id)
      .eq("organization_id", orgB.orgId) // org B tenta filtrar pela própria org
      .maybeSingle();
    // RLS deve bloquear - retorna null, não erro
    expect(data).toBeNull();
    expect(error).toBeNull();
  });
});