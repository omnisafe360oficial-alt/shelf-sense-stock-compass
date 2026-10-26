import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ChevronRight, ClipboardCheck, MapPin, Package, RefreshCw, Warehouse } from "lucide-react";
import { getLocaisDeposito, getLocaisGondola, useRepositorEstado, resetarTarefas, type TarefaStatus, type TarefaPrioridade } from "@/lib/repositor-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repositor/tarefas")({ component: RepositorTarefas });

type Filtro = "todas" | TarefaStatus;

const PRIORIDADE_CFG: Record<TarefaPrioridade, { label: string; bg: string; text: string; dot: string }> = {
  urgente: { label: "Urgente", bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
  alta: { label: "Alta", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  normal: { label: "Normal", bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
};

const STATUS_CFG: Record<TarefaStatus, { label: string; bg: string; text: string }> = {
  pendente: { label: "Pendente", bg: "bg-muted", text: "text-muted-foreground" },
  em_andamento: { label: "Em andamento", bg: "bg-primary/10", text: "text-primary" },
  concluida: { label: "Concluída", bg: "bg-success/10", text: "text-success" },
  inconsistencia: { label: "Divergência", bg: "bg-destructive/10", text: "text-destructive" },
};

const FILTRO_LABELS: Record<Filtro, string> = {
  todas: "Todas",
  pendente: "Pendentes",
  em_andamento: "Em andamento",
  concluida: "Concluídas",
  inconsistencia: "Divergências",
};

function NivelIndicador({ nivel }: { nivel: "Alto" | "Médio" | "Baixo" }) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      {(["Baixo", "Médio", "Alto"] as const).map((n) => (
        <div
          key={n}
          className={cn(
            "h-1 w-5 rounded-sm",
            n === nivel ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function RepositorTarefas() {
  const { tarefas } = useRepositorEstado();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const filtradas = filtro === "todas" ? tarefas : tarefas.filter((t) => t.status === filtro);
  const pendentes = tarefas.filter((t) => t.status === "pendente" || t.status === "em_andamento");
  const tarefa = detalheId ? tarefas.find((t) => t.id === detalheId) : null;

  if (tarefa) {
    const locDep = getLocaisDeposito()[tarefa.produtoId];
    const locGon = getLocaisGondola()[tarefa.produtoId];
    const cfg = PRIORIDADE_CFG[tarefa.prioridade];
    const sCfg = STATUS_CFG[tarefa.status];
    const podeRepor = tarefa.status === "pendente" || tarefa.status === "em_andamento";

    return (
      <div className="flex min-h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={() => setDetalheId(null)} className="text-muted-foreground">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold text-foreground">{tarefa.produtoNome}</h1>
            <p className="font-mono text-xs text-muted-foreground">{tarefa.produtoCodigo}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.text)}>
            {cfg.label}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {/* Status + contadores */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", sCfg.bg, sCfg.text)}>{sCfg.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Gôndola", val: tarefa.qtdGondola, warn: tarefa.qtdGondola < tarefa.qtdMinima },
                { label: "Mínimo", val: tarefa.qtdMinima, warn: false },
                { label: "Depósito", val: tarefa.qtdDeposito, warn: tarefa.qtdDeposito === 0 },
              ].map((item) => (
                <div key={item.label} className={cn("rounded-lg p-2", item.warn ? "bg-destructive/10" : "bg-muted")}>
                  <p className={cn("text-[10px]", item.warn ? "text-destructive" : "text-muted-foreground")}>{item.label}</p>
                  <p className={cn("font-display text-xl font-bold", item.warn ? "text-destructive" : "text-foreground")}>{item.val}</p>
                </div>
              ))}
            </div>
            {tarefa.qtdSugerida > 0 && (
              <p className="rounded-lg bg-primary/5 px-3 py-2 text-center text-xs font-semibold text-primary">
                Sugestão de reposição: {tarefa.qtdSugerida} unidades
              </p>
            )}
          </div>

          {/* Localização depósito */}
          {locDep && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Localização no Depósito</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Rua", val: locDep.rua },
                  { label: "Prateleira", val: locDep.prateleira },
                  { label: "Nível", val: locDep.nivel },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-muted p-2">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="font-display text-lg font-bold text-foreground">{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Localização gôndola */}
          {locGon && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Localização na Gôndola</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Corredor", val: locGon.corredor },
                  { label: "Gôndola", val: locGon.gondola },
                  { label: "Nível", val: locGon.nivel },
                  { label: "Posição", val: String(locGon.posicao) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-muted p-2">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="font-display text-sm font-bold text-foreground">{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {podeRepor && (
          <div className="border-t border-border px-4 py-4">
            <Link
              to="/repositor/repor"
              search={{ tarefaId: tarefa.id }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
            >
              Iniciar reposição →
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h1 className="font-display text-base font-semibold text-foreground">
            Tarefas ({pendentes.length} pendentes)
          </h1>
        </div>
        <button
          onClick={resetarTarefas}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground active:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reiniciar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        {(["todas", "pendente", "em_andamento", "inconsistencia", "concluida"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              filtro === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {FILTRO_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          filtradas.map((t) => {
            const pCfg = PRIORIDADE_CFG[t.prioridade];
            const sCfg = STATUS_CFG[t.status];
            const locGon = getLocaisGondola()[t.produtoId];
            const pct = Math.min(100, (t.qtdGondola / (t.qtdMinima * 3)) * 100);

            return (
              <button
                key={t.id}
                onClick={() => setDetalheId(t.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left space-y-3 active:bg-muted transition-colors"
                style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 12%, transparent)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.produtoNome}</p>
                    <p className="font-mono text-xs text-muted-foreground">{t.produtoCodigo}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", pCfg.bg, pCfg.text)}>
                      {pCfg.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Gôndola: {t.qtdGondola} / mín. {t.qtdMinima}</span>
                      <span className={cn(sCfg.text, "font-semibold")}>{sCfg.label}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", t.qtdGondola === 0 ? "bg-destructive" : t.qtdGondola < t.qtdMinima ? "bg-warning" : "bg-success")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {locGon && <NivelIndicador nivel={locGon.nivel} />}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {locGon && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Corredor {locGon.corredor} · {locGon.gondola}
                    </span>
                  )}
                  <span>Depósito: {t.qtdDeposito} un</span>
                  {t.qtdDeposito === 0 && (
                    <span className="ml-auto flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Sem estoque
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
