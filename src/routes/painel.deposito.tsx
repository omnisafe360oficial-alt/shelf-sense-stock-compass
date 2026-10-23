import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRightLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TransferirDialog } from "@/components/estoque/TransferirDialog";
import { diasAte, useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/deposito")({
  head: () => ({
    meta: [
      { title: "Depósito — OmniSafe 360" },
      { name: "description", content: "Estoque do depósito por lote, validade e localização." },
      { property: "og:title", content: "Depósito — OmniSafe 360" },
      { property: "og:description", content: "Estoque do depósito por lote no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Deposito,
});

function Deposito() {
  const s = useEstoque();
  const produtos = useProdutos();
  const [q, setQ] = useState("");
  const [transf, setTransf] = useState<string | null>(null);
  const lista = produtos
    .map((p) => ({ p, lotes: s.lotes.filter((l) => l.produtoId === p.id && l.qtd > 0).sort((a, b) => a.validade.localeCompare(b.validade)) }))
    .filter(({ p }) => p.nome.toLowerCase().includes(q.toLowerCase()) || p.codigo.includes(q));
  const totalUn = s.lotes.reduce((t, l) => t + l.qtd, 0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Depósito</h1><p className="text-muted-foreground">{totalUn} unidades em {s.lotes.filter((l) => l.qtd > 0).length} lotes</p></div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Produto ou código de barras" className="h-11 pl-9" />
      </div>
      <div className="space-y-4">
        {lista.map(({ p, lotes }) => {
          const total = lotes.reduce((t, l) => t + l.qtd, 0);
          return (
            <div key={p.id} className="rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                <div><p className="font-semibold">{p.nome}</p><p className="font-mono text-xs text-muted-foreground">{p.codigo}</p></div>
                <div className="flex items-center gap-6">
                  <div className="text-right"><p className="text-xs text-muted-foreground">No depósito</p><p className="font-display text-xl font-bold">{total}</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Na gôndola</p><p className="font-display text-xl font-bold">{s.gondola[p.id] ?? 0}</p></div>
                  <Button variant="outline" disabled={!total} onClick={() => setTransf(p.id)}><ArrowRightLeft /> Levar à gôndola</Button>
                </div>
              </div>
              {lotes.length ? (
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {lotes.map((l, i) => {
                      const d = diasAte(l.validade);
                      return (
                        <tr key={l.id}>
                          <td className="px-5 py-3 font-mono text-xs">{l.lote}{i === 0 && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase text-primary">sai primeiro</span>}</td>
                          <td className="px-5 py-3 text-muted-foreground">{l.local}</td>
                          <td className="px-5 py-3">{l.validade.split("-").reverse().join("/")}</td>
                          <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", d <= 7 ? "bg-destructive/10 text-destructive" : d <= 30 ? "bg-warning/15 text-warning" : "bg-success/12 text-success")}>{d <= 0 ? "vence hoje" : `${d} dias`}</span></td>
                          <td className="px-5 py-3 text-right font-semibold">{l.qtd} un</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className="p-5 text-sm text-muted-foreground">Sem estoque no depósito.</p>}
            </div>
          );
        })}
      </div>
      {transf && <TransferirDialog produtoId={transf} onClose={() => setTransf(null)} />}
    </div>
  );
}
