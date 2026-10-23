import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EyeOff, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { conferirNota, emUnidades, useOperacao } from "@/lib/operacao-store";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/recebimentos")({
  head: () => ({
    meta: [
      { title: "Recebimentos — OmniSafe 360" },
      { name: "description", content: "Notas chegando e conferência cega da mercadoria, com conversão de caixas e fardos." },
      { property: "og:title", content: "Recebimentos — OmniSafe 360" },
      { property: "og:description", content: "Recebimento de mercadorias com conferência cega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Recebimentos,
});

const rotulo = { aguardando: "Aguardando conferência", conferida: "Conferida", divergente: "Com divergência" } as const;
const tom = { aguardando: "bg-warning/15 text-warning", conferida: "bg-success/15 text-success", divergente: "bg-destructive/10 text-destructive" } as const;

function Recebimentos() {
  const op = useOperacao();
  const produtos = useProdutos();
  const [sel, setSel] = useState<string | null>(null);
  const [cont, setCont] = useState<Record<string, { emb: string; un: string }>>({});
  const nota = op.notas.find((n) => n.id === sel);

  function abrir(id: string) { setSel(id); setCont({}); }
  function setCampo(pid: string, campo: "emb" | "un", v: string) {
    setCont((c) => ({ ...c, [pid]: { emb: c[pid]?.emb ?? "", un: c[pid]?.un ?? "", [campo]: v } }));
  }

  function finalizar() {
    if (!nota) return;
    const contado = Object.fromEntries(nota.itens.map((i) => [i.produtoId, emUnidades(Number(cont[i.produtoId]?.emb) || 0, i.fator, Number(cont[i.produtoId]?.un) || 0)]));
    const novas = conferirNota(nota.id, contado, "Recebimento · João");
    if (novas.length) toast.warning(`${novas.length} item(ns) não bateram com a nota. Inconsistência aberta.`);
    else toast.success("Tudo bateu com a nota. Mercadoria entrou no depósito.");
    setSel(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recebimentos</h1>
        <p className="text-muted-foreground">Quem recebe não vê a nota: conta a mercadoria e o sistema compara.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {op.notas.map((n) => (
          <div key={n.id} className="flex items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm">
            <div>
              <p className="font-semibold">{n.numero} · {n.fornecedor}</p>
              <p className="text-sm text-muted-foreground">{n.itens.length} itens · chegou {new Date(n.chegada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", tom[n.status])}>{rotulo[n.status]}</span>
            </div>
            {n.status === "aguardando" && <Button onClick={() => abrir(n.id)}><PackageOpen className="mr-2 h-4 w-4" />Conferir</Button>}
          </div>
        ))}
      </div>

      {nota && (
        <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-6 shadow-elegant">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Conferência cega · {nota.numero}</h2>
            <p className="flex items-center gap-2 text-xs font-semibold text-primary"><EyeOff className="h-4 w-4" />Quantidades da nota escondidas</p>
          </div>
          {nota.itens.map((i) => {
            const p = produtos.find((x) => x.id === i.produtoId)!;
            const total = emUnidades(Number(cont[i.produtoId]?.emb) || 0, i.fator, Number(cont[i.produtoId]?.un) || 0);
            return (
              <div key={i.produtoId} className="grid items-end gap-3 rounded-lg border p-4 md:grid-cols-[1fr_140px_140px_120px]">
                <div><p className="font-semibold">{p.nome}</p><p className="text-xs text-muted-foreground">Embalagem: {i.embalagem} · Lote {i.lote}</p></div>
                <label className="text-sm">{i.embalagem.split(" ")[0]}s fechadas
                  <Input aria-label={`Embalagens ${p.nome}`} type="number" min={0} value={cont[i.produtoId]?.emb ?? ""} onChange={(e) => setCampo(i.produtoId, "emb", e.target.value)} className="mt-1" />
                </label>
                <label className="text-sm">Unidades soltas
                  <Input aria-label={`Soltas ${p.nome}`} type="number" min={0} value={cont[i.produtoId]?.un ?? ""} onChange={(e) => setCampo(i.produtoId, "un", e.target.value)} className="mt-1" />
                </label>
                <div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{total} un</p></div>
              </div>
            );
          })}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSel(null)}>Cancelar</Button>
            <Button onClick={finalizar}>Finalizar conferência</Button>
          </div>
        </div>
      )}
    </div>
  );
}
