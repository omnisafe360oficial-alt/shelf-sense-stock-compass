import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lightbulb, Plus, Search, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePedidos } from "@/lib/pedidos-store";
import type { PedidoStatus } from "@/lib/pedidos-store";
import { brl } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/pedidos/")({
  head: () => ({
    meta: [
      { title: "Pedidos de Compra — OmniSafe 360" },
      { name: "description", content: "Pedidos de compra: acompanhe rascunhos, envios, confirmações e recebimentos." },
      { property: "og:title", content: "Pedidos de Compra — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PedidosPage,
});

const SIT: Record<PedidoStatus, { t: string; c: string }> = {
  rascunho:   { t: "Rascunho",   c: "bg-muted text-muted-foreground" },
  enviado:    { t: "Enviado",    c: "bg-primary/10 text-primary" },
  confirmado: { t: "Confirmado", c: "bg-success/12 text-success" },
  parcial:    { t: "Parcial",    c: "bg-warning/15 text-warning" },
  recebido:   { t: "Recebido",   c: "bg-success/20 text-success" },
  cancelado:  { t: "Cancelado",  c: "bg-destructive/10 text-destructive" },
};

type Aba = "todos" | "aberto" | "recebido" | "cancelado";

const fmtData = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

function PedidosPage() {
  const { pedidos } = usePedidos();
  const [aba, setAba] = useState<Aba>("todos");
  const [q, setQ] = useState("");

  const abertos = useMemo(
    () => pedidos.filter((p) => !["recebido", "cancelado"].includes(p.status)),
    [pedidos],
  );
  const recebidos = useMemo(() => pedidos.filter((p) => p.status === "recebido"), [pedidos]);
  const cancelados = useMemo(() => pedidos.filter((p) => p.status === "cancelado"), [pedidos]);
  const valorAberto = useMemo(() => abertos.reduce((s, p) => s + p.total, 0), [abertos]);

  const lista = useMemo(() => {
    const t = q.toLowerCase();
    let f = pedidos;
    if (aba === "aberto") f = abertos;
    if (aba === "recebido") f = recebidos;
    if (aba === "cancelado") f = cancelados;
    if (t) f = f.filter((p) => p.numero.toLowerCase().includes(t) || p.fornecedorNome.toLowerCase().includes(t));
    return f;
  }, [q, aba, pedidos, abertos, recebidos, cancelados]);

  const abas: { id: Aba; t: string; n: number }[] = [
    { id: "todos", t: "Todos", n: pedidos.length },
    { id: "aberto", t: "Em aberto", n: abertos.length },
    { id: "recebido", t: "Recebidos", n: recebidos.length },
    { id: "cancelado", t: "Cancelados", n: cancelados.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pedidos de Compra</h1>
          <p className="text-muted-foreground">
            {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} no total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg">
            <Link to="/painel/pedidos/sugerir"><Lightbulb className="h-4 w-4" /> Sugerir pedido</Link>
          </Button>
          <Button asChild size="lg">
            <Link to="/painel/pedidos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Em aberto</p>
          <p className="font-display text-3xl font-bold">{abertos.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">pedido{abertos.length !== 1 ? "s" : ""} pendente{abertos.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Valor em aberto</p>
          <p className="font-display text-3xl font-bold">{brl(valorAberto)}</p>
          <p className="mt-1 text-sm text-muted-foreground">a receber em mercadorias</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Recebidos</p>
          <p className="font-display text-3xl font-bold">{recebidos.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">de {pedidos.length} no total</p>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card py-20 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-xl font-semibold">Nenhum pedido ainda</p>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Crie o primeiro pedido de compra ou use a sugestão automática baseada no estoque.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link to="/painel/pedidos/sugerir"><Lightbulb className="h-4 w-4" /> Sugerir pedido</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/painel/pedidos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          {/* Abas + busca */}
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {abas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    aba === a.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.t}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", aba === a.id ? "bg-primary/10 text-primary" : "bg-muted")}>
                    {a.n}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por fornecedor ou número"
                className="pl-9"
              />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="divide-y">
            {lista.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {q
                  ? `Nenhum pedido encontrado para "${q}".`
                  : aba === "aberto"
                    ? "Nenhum pedido em aberto."
                    : aba === "recebido"
                      ? "Nenhum pedido recebido ainda."
                      : "Nenhum pedido cancelado."}
              </div>
            ) : (
              lista.map((p) => (
                <Link
                  key={p.id}
                  to="/painel/pedidos/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{p.numero}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", SIT[p.status].c)}>
                        {SIT[p.status].t}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.fornecedorNome || "Fornecedor não informado"}
                      {" · "}
                      {p.itens.length} item{p.itens.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{brl(p.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      Emitido {fmtData(p.dataEmissao)}
                      {p.dataPrevista ? ` · Entrega ${fmtData(p.dataPrevista)}` : ""}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
