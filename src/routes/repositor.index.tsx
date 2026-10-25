import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, ClipboardCheck, PackagePlus, TrendingDown } from "lucide-react";
import { useRepositorEstado } from "@/lib/repositor-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repositor/")({ component: RepositorInicio });

const PRIORIDADE_CFG = {
  urgente: { label: "Urgente", bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
  alta: { label: "Alta", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  normal: { label: "Normal", bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
} as const;

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function RepositorInicio() {
  const { tarefas, reposicoes } = useRepositorEstado();

  const hoje = new Date().toDateString();
  const repHoje = reposicoes.filter((r) => new Date(r.data).toDateString() === hoje);
  const inconsHoje = repHoje.filter((r) => !r.bateu).length;
  const pendentes = tarefas.filter((t) => t.status === "pendente" || t.status === "em_andamento");
  const urgentes = pendentes.filter((t) => t.prioridade === "urgente");
  const altas = pendentes.filter((t) => t.prioridade === "alta");

  return (
    <div className="space-y-6 px-4 py-5 pb-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-foreground">
          {saudacao()}, Pedro 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pendentes", val: pendentes.length, cor: pendentes.length > 0 ? "text-warning" : "" },
          { label: "Concluídas hoje", val: repHoje.length, cor: "" },
          { label: "Divergências", val: inconsHoje, cor: inconsHoje > 0 ? "text-destructive" : "text-success" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-3"
            style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 18%, transparent)" }}
          >
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
            <p className={cn("mt-1 font-display text-2xl font-bold text-foreground", c.cor)}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* CTA avulso */}
      <Link
        to="/repositor/repor"
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
        style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
      >
        <PackagePlus className="h-4 w-4" />
        Reposição avulsa (scanner)
      </Link>

      {/* Urgentes */}
      {urgentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-display text-sm font-semibold text-foreground">Urgente — sem estoque no depósito</h2>
          </div>
          <div className="space-y-2">
            {urgentes.map((t) => (
              <div key={t.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.produtoNome}</p>
                    <p className="text-xs text-muted-foreground">
                      Gôndola: {t.qtdGondola} · Mínimo: {t.qtdMinima} · Depósito: {t.qtdDeposito}
                    </p>
                  </div>
                  <Link
                    to="/repositor/repor"
                    search={{ tarefaId: t.id }}
                    className="shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
                  >
                    Repor →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alta prioridade */}
      {altas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-warning" />
            <h2 className="font-display text-sm font-semibold text-foreground">Prioridade alta</h2>
          </div>
          <div className="space-y-2">
            {altas.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-border bg-card p-4"
                style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 12%, transparent)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.produtoNome}</p>
                    <p className="text-xs text-muted-foreground">
                      Gôndola: {t.qtdGondola} · Depósito: {t.qtdDeposito}
                    </p>
                  </div>
                  <Link
                    to="/repositor/repor"
                    search={{ tarefaId: t.id }}
                    className="shrink-0 rounded-lg border border-warning px-3 py-1.5 text-xs font-semibold text-warning active:scale-95"
                  >
                    Repor →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link para todas as tarefas */}
      {pendentes.length > 0 && (
        <Link to="/repositor/tarefas" className="flex items-center justify-center gap-1 text-sm text-primary">
          <ClipboardCheck className="h-4 w-4" />
          Ver todas as {pendentes.length} tarefas
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Recentes */}
      {repHoje.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-foreground">Concluídas hoje</h2>
          <div className="space-y-2">
            {repHoje.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className={cn("h-2 w-2 shrink-0 rounded-full", r.bateu ? "bg-success" : "bg-warning")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.produtoNome}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.bateu ? "Contagem OK" : `Divergência: ${r.diferenca > 0 ? "+" : ""}${r.diferenca}`} · +{r.qtdReposta} un reposta{r.qtdReposta !== 1 ? "s" : ""}
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

      {pendentes.length === 0 && repHoje.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardCheck className="h-12 w-12 text-success/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Tudo em dia!</p>
          <p className="text-xs text-muted-foreground">Nenhuma reposição pendente no momento.</p>
        </div>
      )}
    </div>
  );
}
