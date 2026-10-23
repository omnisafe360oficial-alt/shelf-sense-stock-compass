import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowRightLeft, ShoppingCart, Wrench } from "lucide-react";
import { produtos } from "@/lib/mock-data";
import { useEstoque, type Mov } from "@/lib/estoque-store";
import { cn } from "@/lib/utils";

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
  component: Movimentacoes,
});

const tipos: Record<Mov["tipo"], { l: string; icon: typeof ShoppingCart; c: string }> = {
  entrada: { l: "Entrada", icon: ArrowDownToLine, c: "bg-success/12 text-success" },
  transferencia: { l: "Transferência", icon: ArrowRightLeft, c: "bg-secondary text-primary" },
  venda: { l: "Venda", icon: ShoppingCart, c: "bg-accent text-accent-foreground" },
  ajuste: { l: "Ajuste", icon: Wrench, c: "bg-destructive/10 text-destructive" },
};

function Movimentacoes() {
  const s = useEstoque();
  const [tipo, setTipo] = useState<Mov["tipo"] | "todos">("todos");
  const lista = [...s.movs]
    .filter((m) => tipo === "todos" || m.tipo === tipo)
    .sort((a, b) => b.data.localeCompare(a.data));
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Movimentações</h1><p className="text-muted-foreground">Tudo que entrou, mudou de lugar ou saiu do estoque</p></div>
      <div className="flex flex-wrap gap-2">
        {(["todos", ...Object.keys(tipos)] as const).map((t) => (
          <button key={t} onClick={() => setTipo(t as Mov["tipo"] | "todos")} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tipo === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {t === "todos" ? "Todas" : tipos[t as Mov["tipo"]].l}
          </button>
        ))}
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
