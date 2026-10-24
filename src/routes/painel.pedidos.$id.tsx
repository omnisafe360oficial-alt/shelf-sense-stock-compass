import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Package, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePedidos, atualizarStatusPedido, receberItemPedido } from "@/lib/pedidos-store";
import { useProdutos } from "@/lib/produtos-store";
import type { PedidoStatus } from "@/lib/pedidos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/pedidos/$id")({
  head: () => ({ meta: [{ title: "Pedido — OmniSafe 360" }] }),
  component: DetalhesPedido,
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

function DetalhesPedido() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { pedidos } = usePedidos();
  const produtos = useProdutos();
  const pedido = pedidos.find((p) => p.id === id);
  const [qtds, setQtds] = useState<Record<string, number>>({});

  if (!pedido) return (
    <div className="space-y-4">
      <Link to="/painel/pedidos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar aos pedidos
      </Link>
      <p className="text-muted-foreground">Pedido não encontrado.</p>
    </div>
  );

  const nomeProduto = (pid: string) => produtos.find((p) => p.id === pid)?.nome ?? "Produto";

  const podaReceber = pedido.status === "confirmado" || pedido.status === "parcial";

  const handleReceber = () => {
    let alguma = false;
    for (const item of pedido.itens) {
      const qtd = qtds[item.id] ?? item.qtdRecebida;
      if (qtd !== item.qtdRecebida) {
        receberItemPedido(pedido.id, item.id, qtd);
        alguma = true;
      }
    }
    if (alguma) toast.success("Recebimento registrado!");
    else toast.info("Nenhuma quantidade foi alterada");
  };

  const handleCancelar = () => {
    atualizarStatusPedido(pedido.id, "cancelado");
    toast.success("Pedido cancelado");
    navigate({ to: "/painel/pedidos" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/painel/pedidos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar aos pedidos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{pedido.numero}</h1>
            <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", STATUS_COLOR[pedido.status])}>
              {STATUS_LABEL[pedido.status]}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{pedido.fornecedorNome || "Sem fornecedor"}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {pedido.status === "rascunho" && (
            <Button onClick={() => { atualizarStatusPedido(pedido.id, "enviado"); toast.success("Pedido enviado!"); }} className="gap-2">
              <Send className="h-4 w-4" /> Enviar pedido
            </Button>
          )}
          {pedido.status === "enviado" && (
            <Button variant="outline" onClick={() => { atualizarStatusPedido(pedido.id, "confirmado"); toast.success("Pedido confirmado!"); }} className="gap-2">
              <CheckCircle className="h-4 w-4" /> Confirmar pedido
            </Button>
          )}
          {podaReceber && (
            <Button onClick={handleReceber} className="gap-2">
              <Package className="h-4 w-4" /> Registrar recebimento
            </Button>
          )}
          {!["recebido", "cancelado"].includes(pedido.status) && (
            <Button variant="destructive" onClick={handleCancelar} className="gap-2">
              <XCircle className="h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Emitido em</p>
          <p className="font-semibold">{pedido.dataEmissao || "—"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Entrega prevista</p>
          <p className="font-semibold">{pedido.dataPrevista || "—"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="font-semibold">R$ {pedido.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {pedido.observacao && (
        <div className="rounded-2xl border bg-muted/50 px-5 py-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observação</p>
          <p className="mt-1">{pedido.observacao}</p>
        </div>
      )}

      {/* Itens */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Itens do pedido ({pedido.itens.length})</h2>
        </div>
        <div className="divide-y">
          {pedido.itens.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{nomeProduto(item.produtoId)}</p>
                <p className="text-sm text-muted-foreground">
                  {item.qtdSolicitada} {item.unidade} × R$ {item.precoUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  R$ {(item.qtdSolicitada * item.precoUnitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                {podaReceber ? (
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="text-xs text-muted-foreground">Recebido:</span>
                    <Input
                      type="number"
                      min="0"
                      max={item.qtdSolicitada}
                      value={qtds[item.id] ?? item.qtdRecebida}
                      onChange={(e) => setQtds((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                      className="h-7 w-20 text-right text-sm"
                    />
                    <span className="text-xs text-muted-foreground">/ {item.qtdSolicitada}</span>
                  </div>
                ) : item.qtdRecebida > 0 && (
                  <p className="text-xs text-muted-foreground">Recebido: {item.qtdRecebida} / {item.qtdSolicitada}</p>
                )}
              </div>
            </div>
          ))}
          {pedido.itens.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              Nenhum item neste pedido.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
