import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BadgePercent, CalendarClock, CalendarX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/mock-data";
import { useProdutos } from "@/lib/produtos-store";
import { diasAte, exibirValidade, faixaValidade, registrarPerda, useEstoque, type Faixa, type TipoPerda } from "@/lib/estoque-store";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

const TIPOS_PERDA: { id: TipoPerda; label: string }[] = [
  { id: "vencido", label: "Vencido" },
  { id: "avariado", label: "Avariado" },
  { id: "furto", label: "Furto" },
  { id: "outros", label: "Outros" },
];

export const Route = createFileRoute("/painel/validades")({
  head: () => ({
    meta: [
      { title: "Validades — OmniSafe 360" },
      { name: "description", content: "Lotes vencidos e perto do vencimento, com ações de promoção e baixa." },
      { property: "og:title", content: "Validades — OmniSafe 360" },
      { property: "og:description", content: "Controle de validade por lote no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Validades,
});

const faixas: { id: Faixa; t: string; c: string; ring: string }[] = [
  { id: "vencido", t: "Vencidos", c: "bg-destructive text-destructive-foreground", ring: "border-destructive" },
  { id: "7", t: "Até 7 dias", c: "bg-destructive/10 text-destructive", ring: "border-destructive/50" },
  { id: "15", t: "8 a 15 dias", c: "bg-warning/15 text-warning", ring: "border-warning" },
  { id: "30", t: "16 a 30 dias", c: "bg-secondary text-primary", ring: "border-primary/40" },
];

function Validades() {
  const s = useEstoque();
  const produtos = useProdutos();
  const [sel, setSel] = useState<Faixa | "todas">("todas");
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaTipo, setBaixaTipo] = useState<TipoPerda>("vencido");
  const [baixaObs, setBaixaObs] = useState("");
  const lotes = s.lotes
    .filter((l) => l.qtd > 0)
    .map((l) => ({ l, p: produtos.find((p) => p.id === l.produtoId)!, dias: diasAte(l.validade) }))
    .map((x) => ({ ...x, faixa: faixaValidade(x.dias) }))
    .filter((x) => x.faixa !== "ok")
    .sort((a, b) => a.dias - b.dias);
  const lista = sel === "todas" ? lotes : lotes.filter((x) => x.faixa === sel);
  const emRisco = lotes.filter((x) => x.faixa !== "vencido").reduce((t, x) => t + x.l.qtd * x.p.preco, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Validades</h1><p className="text-muted-foreground">Lotes que precisam de atenção nos próximos 30 dias</p></div>
        <div className="rounded-2xl bg-gradient-brand px-6 py-4 text-primary-foreground"><p className="text-xs uppercase text-primary-foreground/70">Valor em risco</p><p className="font-display text-2xl font-bold">{brl(emRisco)}</p></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {faixas.map((f) => {
          const n = lotes.filter((x) => x.faixa === f.id).length;
          return (
            <button key={f.id} onClick={() => setSel(sel === f.id ? "todas" : f.id)} className={cn("rounded-2xl border-2 bg-card p-5 text-left transition", sel === f.id ? f.ring : "border-transparent hover:border-border")}>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", f.c)}>{f.t}</span>
              <p className="mt-3 font-display text-3xl font-bold">{n} <span className="text-base font-medium text-muted-foreground">lotes</span></p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center p-14 text-center text-muted-foreground"><CalendarClock className="mb-3 h-8 w-8" />Nenhum lote nessa faixa.</div>
        ) : (
          <ul className="divide-y">
            {lista.map(({ l, p, dias, faixa }) => {
              const f = faixas.find((x) => x.id === faixa)!;
              return (
                <li key={l.id} className="flex flex-col p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-center", f.c)}>
                      {faixa === "vencido" ? <CalendarX className="h-5 w-5" /> : <><span className="font-display text-lg font-bold leading-none">{dias}</span><span className="text-[10px]">{dias === 1 ? "dia" : "dias"}</span></>}
                    </span>
                    <div className="min-w-48 flex-1">
                      <p className="font-semibold">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">Lote <span className="font-mono">{l.lote}</span> · vence {exibirValidade(l.validade)} · {l.local}</p>
                    </div>
                    <div className="text-right"><p className="font-semibold">{l.qtd} un</p><p className="text-xs text-muted-foreground">{brl(l.qtd * p.preco)}</p></div>
                    <div className="flex gap-2">
                      {faixa !== "vencido" && (
                        <Button variant="outline" size="sm" onClick={() => toast.success(`Promoção sugerida: ${p.nome} por ${brl(p.preco * (faixa === "7" ? 0.7 : 0.85))}`, { description: `${faixa === "7" ? "30" : "15"}% de desconto no lote ${l.lote}` })}>
                          <BadgePercent /> Promoção
                        </Button>
                      )}
                      <Button variant={faixa === "vencido" ? "destructive" : "ghost"} size="sm"
                        onClick={() => { setBaixaId(l.id); setBaixaTipo(faixa === "vencido" ? "vencido" : "avariado"); setBaixaObs(""); }}>
                        <Trash2 /> Dar baixa
                      </Button>
                    </div>
                  </div>
                  {baixaId === l.id && (
                    <div className="mt-3 rounded-xl border bg-destructive/5 p-4 space-y-3">
                      <p className="text-sm font-semibold">Tipo de perda</p>
                      <div className="flex flex-wrap gap-2">
                        {TIPOS_PERDA.map((t) => (
                          <button key={t.id} onClick={() => setBaixaTipo(t.id)}
                            className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition",
                              baixaTipo === t.id ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:border-destructive/60 hover:text-destructive")}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <Input placeholder="Observação (opcional)" value={baixaObs} onChange={(e) => setBaixaObs(e.target.value)} className="h-9" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => {
                          registrarPerda(l.id, baixaTipo, baixaObs || undefined);
                          toast.success(`Baixa de ${l.qtd} un do lote ${l.lote}`);
                          setBaixaId(null);
                          setBaixaObs("");
                        }}>Confirmar baixa</Button>
                        <Button size="sm" variant="outline" onClick={() => { setBaixaId(null); setBaixaObs(""); }}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
