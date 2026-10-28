import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolverInconsistencia, useOperacao } from "@/lib/operacao-store";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

function exportCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/painel/inconsistencias")({
  head: () => ({
    meta: [
      { title: "Inconsistências — OmniSafe 360" },
      { name: "description", content: "Diferenças entre o sistema e as contagens do recebimento e da reposição." },
      { property: "og:title", content: "Inconsistências — OmniSafe 360" },
      { property: "og:description", content: "Análise de divergências de estoque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Inconsistencias,
});

const status = { aberta: "Aberta", ajustada: "Contagem aceita", mantida: "Sistema mantido" } as const;

function Inconsistencias() {
  const op = useOperacao();
  const produtos = useProdutos();
  const [filtro, setFiltro] = useState<"aberta" | "todas">("aberta");
  const lista = op.inconsistencias.filter((i) => filtro === "todas" || i.status === "aberta");
  const abertas = op.inconsistencias.filter((i) => i.status === "aberta").length;

  function handleExport() {
    const cabecalho = ["Data", "Origem", "Referência", "Produto", "Sistema", "Contado", "Diferença", "Quem contou", "Status"];
    const linhas = op.inconsistencias.map((i) => {
      const dif = i.contado - i.sistema;
      return [
        new Date(i.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        i.origem,
        i.referencia,
        produtos.find((p) => p.id === i.produtoId)?.nome ?? i.produtoId,
        String(i.sistema),
        String(i.contado),
        dif > 0 ? `+${dif}` : String(dif),
        i.usuario,
        status[i.status],
      ];
    });
    exportCsv([cabecalho, ...linhas], `inconsistencias-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Inconsistências</h1><p className="text-muted-foreground">Quando a contagem não bate com o sistema, aparece aqui para você decidir</p></div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
          <div className="flex rounded-lg bg-muted p-1">
          {(["aberta", "todas"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={cn("rounded-md px-4 py-1.5 text-sm font-semibold", filtro === f ? "bg-card shadow-sm" : "text-muted-foreground")}>
              {f === "aberta" ? `Abertas (${abertas})` : `Todas (${op.inconsistencias.length})`}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {lista.length === 0 ? <p className="p-10 text-center text-muted-foreground">Nenhuma inconsistência aberta. Tudo certo!</p> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Quando</th><th className="p-3">Origem</th><th className="p-3">Produto</th><th className="p-3">Sistema</th><th className="p-3">Contado</th><th className="p-3">Diferença</th><th className="p-3">Quem contou</th><th className="p-3" /></tr></thead>
            <tbody>
              {lista.map((i) => {
                const dif = i.contado - i.sistema;
                return (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="p-3">{new Date(i.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-3">{i.origem}<p className="text-xs text-muted-foreground">{i.referencia}</p></td>
                    <td className="p-3 font-medium">{produtos.find((p) => p.id === i.produtoId)?.nome}</td>
                    <td className="p-3">{i.sistema}</td><td className="p-3">{i.contado}</td>
                    <td className={cn("p-3 font-bold", dif < 0 ? "text-destructive" : "text-success")}>{dif > 0 ? `+${dif}` : dif}</td>
                    <td className="p-3">{i.usuario}</td>
                    <td className="p-3">{i.status === "aberta" ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => { resolverInconsistencia(i.id, "ajustar"); toast.success("Contagem aceita e estoque ajustado."); }}>Aceitar contagem</Button>
                        <Button size="sm" variant="outline" onClick={() => { resolverInconsistencia(i.id, "manter"); toast("Número do sistema mantido."); }}>Manter sistema</Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">{status[i.status]}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
