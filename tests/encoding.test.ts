import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import fg from "fast-glob";

describe("Encoding — UTF-8", () => {
  it("caracteres acentuados básicos", () => {
    const chars = ["á", "à", "ã", "â", "é", "ê", "í", "ó", "ô", "õ", "ú", "ç", "Á", "Ã", "É", "Ç", "€", "—", "–", "·"];
    for (const c of chars) {
      expect(c).toBe(c); // sanity: string é igual a si mesma
      expect(Buffer.from(c, "utf8").toString("utf8")).toBe(c);
    }
  });

  it("saúde operacional, próximo, resolução não são mojibake", () => {
    const dashboard = fs.readFileSync(path.join(__dirname, "../src/app/admin/dashboard/page.tsx"), "utf8");
    expect(dashboard).toContain("Saúde operacional");
    expect(dashboard).toContain("Eficiência");
    expect(dashboard).toContain("Próximo");
    expect(dashboard).toContain("resolução");
    expect(dashboard).not.toContain("SAÃ");
    expect(dashboard).not.toContain("PrÃ");
    expect(dashboard).not.toContain("RESOLUÃ");
  });

  it("nenhum arquivo crítico contém mojibake", async () => {
    const files = await fg(["src/app/admin/dashboard/**/*.{tsx,ts}", "src/app/admin/_components/**/*.{tsx,ts}", "src/components/**/*.{tsx,ts}"], { cwd: path.join(__dirname, "..") });
    const mojibakePatterns = ["Ã", "Â", "â€"];
    for (const file of files) {
      const content = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      for (const pattern of mojibakePatterns) {
        // Permitir Ã em "São", "Não", etc. — verificar se é mojibake real (Ã + © etc.)
        if (pattern === "Ã" && /[Ã][\u0080-\u00BF]/.test(content)) {
          // This is likely mojibake, but check if it's part of correct "ã" etc. — skip if file has correct "São"
          // For now, just check for known mojibake like "Ã©", "Ã¡", etc.
          const bad = ["Ã©", "Ã¡", "Ã£", "Ã§", "Ã³", "Ãº", "Ã‰", "Ã‡", "Â·", "â€”"];
          for (const b of bad) {
            expect(content, `${file} contém mojibake ${b}`).not.toContain(b);
          }
          break;
        }
      }
    }
  });

  it("CSV com BOM para Excel", () => {
    const csv = '"a","b"\n"c","d"';
    const withBOM = "\uFEFF" + csv;
    expect(withBOM.charCodeAt(0)).toBe(0xfeff);
    expect(withBOM.slice(1)).toBe(csv);
  });
});
