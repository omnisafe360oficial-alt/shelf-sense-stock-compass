import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRightLeft, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransferirDialog } from "@/components/estoque/TransferirDialog";
import { produtos } from "@/lib/mock-data";
import { useEstoque } from "@/lib/estoque-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/gondola")({
  head: () => ({
    meta: [
      { title: "Gôndola — OmniSafe 360" },
      { name: "description", content: "Quantidade exposta, mínimo e alertas de reposição de cada produto." },
      { property: "og:title", content: "Gôndola — OmniSafe 360" },
      { property: "og:description", content: "Controle da gôndola no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Gondola,
});

function Gondola() {
  const s = useEstoque();
  const [filtro, setFiltro] = useState<"todos" | "repor">("todos");
  const [transf, setTransf] = useState<string | null>(null);
  const itens = produtos.map((p) => ({ p, qtd: s.gondola[p.id] ?? 0, max: p.minimo * 3 }));
  const repor = itens.filter((i) => i.qtd <= i.p.minimo);
  const lista = filtro === "repor" ? repor : itens;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Gôndola</h1><p className="text-muted-foreground">O que está exposto para o cliente agora</p></div>
        <div className="flex rounded-lg bg-muted p-1">
          {(["todos", "repor"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={cn("rounded-md px-4 py-1.5 text-sm font-semibold", filtro === f ? "bg-card shadow-sm" : "text-muted-foreground")}>
              {f === "todos" ? `Todos (${itens.length})` : `Precisa repor (${repor.length})`}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lista.map(({ p, qtd, max }) => {
          const abaixo = qtd <= p.minimo;
          const pct = Math.min(100, (qtd / max) * 100);
          return (
            <div key={p.id} className={cn("rounded-2xl border bg-card p-5", abaixo && "border-warning")}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">{p.nome}</p><p className="text-xs text-muted-foreground">{p.categoria}</p></div>
                {abaixo && <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[11px] font-semibold text-warning"><BellRing className="h-3 w-3" />Repositor avisado</span>}
              </div>
              <p className="mt-4 font-display text-4xl font-bold">{qtd}<span className="text-base font-medium text-muted-foreground"> un</span></p>
              <div className="relative mt-3 h-2 rounded-full bg-muted">
                <div className={cn("h-full rounded-full", abaixo ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
                <div className="absolute -top-1 h-4 w-0.5 bg-foreground/60" style={{ left: `${(p.minimo / max) * 100}%` }} title="Mínimo" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Mínimo {p.minimo}</span><span>Capacidade {max}</span></div>
              <Button variant={abaixo ? "default" : "outline"} className="mt-4 w-full" onClick={() => setTransf(p.id)}><ArrowRightLeft /> Repor do depósito</Button>
            </div>
          );
        })}
      </div>
      {transf && <TransferirDialog produtoId={transf} onClose={() => setTransf(null)} />}
    </div>
  );
}
