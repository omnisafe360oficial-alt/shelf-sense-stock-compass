import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
import { useRecebeEstado, CATALOGO_PRODUTOS, type PedidoStatus } from "@/lib/recebe-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recebe/pedidos")({ component: RecebePedidos });

type Filtro = "todos" | PedidoStatus;

const STATUS_CFG: Record<PedidoStatus, { label: string; bg: string; text: string }> = {
  enviado: { label: "Enviado", bg: "bg-primary/10", text: "text-primary" },
  confirmado: { label: "Confirmado", bg: "bg-success/10", text: "text-success" },
  parcial: { label: "Parcial", bg: "bg-warning/10", text: "text-warning" },
  recebido: { label: "Recebido", bg: "bg-muted", text: "text-muted-foreground" },
  cancelado: { label: "Cancelado", bg: "bg-destructive/10", text: "text-destructive" },
};

function RecebePedidos() {
  const { pedidos } = useRecebeEstado();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const filtrados =
    filtro === "todos" ? pedidos : pedidos.filter((p) => p.status === filtro);

  const pedidoDetalhe = detalheId ? pedidos.find((p) => p.id === detalheId) : null;

  if (pedidoDetalhe) {
    const totalSolicitado = pedidoDetalhe.itens.reduce((t, i) => t + i.qtdSolicitada, 0);
    const totalRecebido = pedidoDetalhe.itens.reduce((t, i) => t + i.qtdRecebida, 0);
    const pct = totalSolicitado > 0 ? Math.round((totalRecebido / totalSolicitado) * 100) : 0;
    const podeReceber = pedidoDetalhe.status === "enviado" || pedidoDetalhe.status === "confirmado" || pedidoDetalhe.status === "parcial";

    return (
      <div className="flex min-h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={() => setDetalheId(null)} className="text-muted-foreground">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <h1 className="font-display text-base font-semibold text-foreground">{pedidoDetalhe.numero}</h1>
            <p className="text-xs text-muted-foreground">{pedidoDetalhe.fornecedor}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {/* Progresso geral */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do recebimento</span>
              <span className="font-display font-semibold text-foreground">{pct}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalRecebido} UN recebidas</span>
              <span>{totalSolicitado} UN solicitadas</span>
            </div>
          </div>

          {/* Lista de itens */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Itens do pedido</p>
            {pedidoDetalhe.itens.map((item) => {
              const produto = CATALOGO_PRODUTOS.find((p) => p.id === item.produtoId);
              const pctItem = item.qtdSolicitada > 0 ? Math.round((item.qtdRecebida / item.qtdSolicitada) * 100) : 0;
              const cor = pctItem >= 100 ? "bg-success" : pctItem > 0 ? "bg-warning" : "bg-border";

              return (
                <div key={item.produtoId} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 shrink-0 rounded-full", cor)} />
                    <p className="text-sm font-medium text-foreground">
                      {produto?.nome ?? `Produto ${item.produtoId}`}
                    </p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", cor)}
                      style={{ width: `${Math.min(pctItem, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Recebido: {item.qtdRecebida} {item.unidade}</span>
                    <span>Solicitado: {item.qtdSolicitada} {item.unidade}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {podeReceber && (
          <div className="border-t border-border px-4 py-4">
            <Link
              to="/recebe/receber"
              search={{ pedidoId: pedidoDetalhe.id }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
              }}
            >
              Iniciar recebimento deste pedido →
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h1 className="font-display text-base font-semibold text-foreground">Pedidos de compra</h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        {(["todos", "enviado", "confirmado", "parcial", "recebido", "cancelado"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              filtro === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {f === "todos"
              ? "Todos"
              : STATUS_CFG[f as PedidoStatus].label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          filtrados.map((p) => {
            const totalSolicitado = p.itens.reduce((t, i) => t + i.qtdSolicitada, 0);
            const totalRecebido = p.itens.reduce((t, i) => t + i.qtdRecebida, 0);
            const pct = totalSolicitado > 0 ? Math.round((totalRecebido / totalSolicitado) * 100) : 0;
            const cfg = STATUS_CFG[p.status];

            return (
              <button
                key={p.id}
                onClick={() => setDetalheId(p.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left space-y-3 active:bg-muted transition-colors"
                style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 15%, transparent)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-primary">{p.numero}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">{p.fornecedor}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.text)}>
                      {cfg.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{p.dataPrevista} · {p.itens.length} itens</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
