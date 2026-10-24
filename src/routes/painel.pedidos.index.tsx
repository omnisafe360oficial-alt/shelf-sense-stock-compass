import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePedidos } from "@/lib/pedidos-store";
import type { PedidoStatus } from "@/lib/pedidos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos de Compra — OmniSafe 360" }] }),
  component: PedidosPage,
});

const STATUS_LABEL: Record<PedidoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  confirmado: "Confirmado",
  parcial: "Parcial",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<PedidoStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  parcial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  recebido: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function PedidosPage() {
  const { pedidos } = usePedidos();
  const pendentes = pedidos.filter((p) => !["recebido", "cancelado"].includes(p.status));
  const totalPendente = pendentes.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pedidos de Compra</h1>
          <p className="text-muted-foreground">{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} no sistema</p>
        </div>
        <Link to="/painel/pedidos/novo">
          <Button size="lg"><Plus className="mr-1 h-4 w-4" /> Novo pedido</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Em aberto</p>
          <p className="text-3xl font-bold">{pendentes.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Valor em aberto</p>
          <p className="text-3xl font-bold">
            R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total de pedidos</p>
          <p className="text-3xl font-bold">{pedidos.length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {pedidos.length === 0 && (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nenhum pedido cadastrado ainda.</p>
            <Link to="/painel/pedidos/novo" className="mt-3 inline-block">
              <Button><Plus className="mr-1 h-4 w-4" /> Criar primeiro pedido</Button>
            </Link>
          </div>
        )}
        {pedidos.map((p) => (
          <Link
            key={p.id}
            to="/painel/pedidos/$id"
            params={{ id: p.id }}
            className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card px-6 py-4 transition hover:border-primary/40 hover:shadow-elegant"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm font-semibold">{p.numero}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_COLOR[p.status])}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {p.fornecedorNome || "—"} · {p.itens.length} item{p.itens.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">
                R$ {p.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Emitido {p.dataEmissao}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
