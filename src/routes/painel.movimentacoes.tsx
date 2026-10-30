import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowRightLeft, Calendar, Download, ShoppingCart, Wrench } from "lucide-react";
import { useEstoque, type Mov } from "@/lib/estoque-store";
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

export const Route = createFileRoute("/painel/movimentacoes")({
  head: () => ({
    meta: [
      { title: "Movimentações — OmniSafe 360" },
      { name: "description", content: "Histórico de entradas, transferências, vendas e ajustes de estoque." },
      { property: "og:title", content: "Movimentações — OmniSafe 360" },
      { property: "og:description", content: "Histórico de estoque no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Movimentacoes,
});

const tipos: Record<Mov["tipo"], { l: string; icon: typeof ShoppingCart; c: string }> = {
  entrada: { l: "Entrada", icon: ArrowDownToLine, c: "bg-success/12 text-success" },
  transferencia: { l: "Transferência", icon: ArrowRightLeft, c: "bg-secondary text-primary" },
  venda: { l: "Venda", icon: ShoppingCart, c: "bg-accent text-accent-foreground" },
  ajuste: { l: "Ajuste", icon: Wrench, c: "bg-destructive/10 text-destructive" },
};

const HOJE_MOV = new Date().toISOString().slice(0, 10);

function Movimentacoes() {
  const s = useEstoque();
  const produtos = useProdutos();
  const [tipo, setTipo] = useState<Mov["tipo"] | "todos">("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const lista = [...s.movs]
    .filter((m) => {
      if (tipo !== "todos" && m.tipo !== tipo) return false;
      if (de && m.data.slice(0, 10) < de) return false;
      if (ate && m.data.slice(0, 10) > ate) return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));
  function handleExport() {
    const cabecalho = ["Data", "Hora", "Tipo", "Produto", "Lote", "De", "Para", "Quem", "Qtd"];
    const linhas = lista.map((m) => [
      m.data.slice(0, 10).split("-").reverse().join("/"),
      m.data.slice(11, 16),
      tipos[m.tipo].l,
      produtos.find((p) => p.id === m.produtoId)?.nome ?? m.produtoId,
      m.lote ?? "",
      m.origem,
      m.destino,
      m.usuario,
      String(m.qtd),
    ]);
    exportCsv([cabecalho, ...linhas], `movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Movimentações</h1><p className="text-muted-foreground">Tudo que entrou, mudou de lugar ou saiu do estoque</p></div>
        <button onClick={handleExport} className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {(["todos", ...Object.keys(tipos)] as const).map((t) => (
          <button key={t} onClick={() => setTipo(t as Mov["tipo"] | "todos")} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tipo === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {t === "todos" ? "Todas" : tipos[t as Mov["tipo"]].l}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={de}
            max={ate || HOJE_MOV}
            onChange={(e) => setDe(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
            title="De"
          />
          <span className="text-muted-foreground text-xs">até</span>
          <input
            type="date"
            value={ate}
            min={de}
            max={HOJE_MOV}
            onChange={(e) => setAte(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
            title="Até"
          />
          {(de || ate) && (
            <button
              onClick={() => { setDe(""); setAte(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              limpar
            </button>
          )}
        </div>
      </div>
      <div className="rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">De → Para</th><th className="px-4 py-3">Quem</th><th className="px-4 py-3 text-right">Qtd</th></tr>
          </thead>
          <tbody className="divide-y">
            {lista.map((m) => {
              const t = tipos[m.tipo]; const Icon = t.icon;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-muted-foreground">{m.data.slice(8, 10)}/{m.data.slice(5, 7)} · {m.data.slice(11, 16)}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", t.c)}><Icon className="h-3 w-3" />{t.l}</span></td>
                  <td className="px-4 py-3"><p className="font-medium">{produtos.find((p) => p.id === m.produtoId)?.nome}</p>{m.lote && <p className="font-mono text-xs text-muted-foreground">Lote {m.lote}</p>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.origem} → {m.destino}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.usuario}</td>
                  <td className={cn("px-4 py-3 text-right font-semibold", m.qtd < 0 && "text-destructive")}>{m.qtd > 0 ? `${m.qtd}` : m.qtd}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
