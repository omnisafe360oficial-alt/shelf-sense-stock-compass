import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Package, Plus } from "lucide-react";
import { useRecebeEstado } from "@/lib/recebe-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recebe/")({ component: RecebeInicio });

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function dataFormatada() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function RecebeInicio() {
  const { pedidos, recebimentos } = useRecebeEstado();

  const hoje = new Date().toDateString();
  const recHoje = recebimentos.filter((r) => new Date(r.data).toDateString() === hoje);
  const itensHoje = recHoje.reduce((s, r) => s + r.itens.reduce((ss, i) => ss + i.qtdUN, 0), 0);
  const divergenciasHoje = recHoje.reduce((s, r) => s + r.totalDivergencias, 0);
  const pendentes = pedidos.filter((p) => p.status === "enviado" || p.status === "confirmado");

  return (
    <div className="space-y-6 px-4 py-5 pb-6">
      {/* Saudação */}
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground">
          {saudacao()}, Carlos 👋
        </h1>
        <p className="mt-0.5 text-sm capitalize text-muted-foreground">{dataFormatada()}</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Recebimentos hoje", val: recHoje.length, cor: "" },
          { label: "Itens recebidos", val: itensHoje, cor: "" },
          {
            label: "Divergências",
            val: divergenciasHoje,
            cor: divergenciasHoje > 0 ? "text-destructive" : "text-success",
          },
          {
            label: "Pedidos pendentes",
            val: pendentes.length,
            cor: pendentes.length > 0 ? "text-warning" : "",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-4"
            style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 20%, transparent)" }}
          >
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={cn("mt-1 font-display text-2xl font-bold text-foreground", c.cor)}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* CTA avulso */}
      <Link
        to="/recebe/receber"
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
        style={{
          background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
        }}
      >
        <Plus className="h-4 w-4" />
        Novo recebimento avulso
      </Link>

      {/* Pedidos aguardando */}
      {pendentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">Aguardando recebimento</h2>
          </div>
          <div className="space-y-2">
            {pendentes.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-card p-4"
                style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 15%, transparent)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-primary">{p.numero}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">{p.fornecedor}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          p.status === "confirmado"
                            ? "bg-success/10 text-success"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {p.status === "confirmado" ? "Confirmado" : "Enviado"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{p.dataPrevista}</span>
                      <span className="text-[10px] text-muted-foreground">· {p.itens.length} itens</span>
                    </div>
                  </div>
                  <Link
                    to="/recebe/receber"
                    search={{ pedidoId: p.id }}
                    className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-transform active:scale-95"
                  >
                    Receber →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico recente */}
      {recHoje.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-foreground">Recebimentos de hoje</h2>
            <Link to="/recebe/historico" className="flex items-center gap-0.5 text-xs text-primary">
              Ver todos <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recHoje.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    r.totalDivergencias > 0 ? "bg-warning" : "bg-success",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.fornecedor}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.itens.length} itens ·{" "}
                    {r.totalDivergencias > 0
                      ? `${r.totalDivergencias} divergência(s)`
                      : "sem divergências"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(r.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
