"use client";

import { Download, FileText } from "lucide-react";

export default function ExportButtons({
  data,
  periodo,
  aba,
}: {
  data: Record<string, unknown>;
  periodo: string;
  aba: string;
}) {
  function exportCSV() {
    const rows: string[][] = [["Relatorio", aba], ["Periodo", periodo], ["Gerado em", new Date().toISOString()], []];
    for (const [k, v] of Object.entries(data)) {
      rows.push([k, String(v ?? "")]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${aba}-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    window.print();
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button
        type="button"
        onClick={exportCSV}
        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold hover:bg-zinc-50"
      >
        <Download className="size-4" />
        CSV
      </button>
      <button
        type="button"
        onClick={exportPDF}
        className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800"
      >
        <FileText className="size-4" />
        PDF
      </button>
    </div>
  );
}
