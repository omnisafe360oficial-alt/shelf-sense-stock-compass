import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronRight, Clock, Copy, Package } from "lucide-react";
import { useRepositorEstado, type Reposicao } from "@/lib/repositor-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repositor/historico")({ component: RepositorHistorico });

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function copiarTexto(texto: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(texto).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }).catch(() => {});
}

function ResumoCard({ r, onClick }: { r: Reposicao; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-4 text-left space-y-2 active:bg-muted transition-colors"
      style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 10%, transparent)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{r.produtoNome}</p>
          <p className="font-mono text-xs text-muted-foreground">{r.produtoCodigo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {r.bateu ? (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
              <CheckCircle2 className="h-3 w-3" /> OK
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              <AlertTriangle className="h-3 w-3" /> Divergência
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatarData(r.data)}
        </span>
        <span>+{r.qtdReposta} un reposta{r.qtdReposta !== 1 ? "s" : ""}</span>
        {!r.bateu && (
          <span className="ml-auto font-semibold text-destructive">
            dif. {r.diferenca > 0 ? "+" : ""}{r.diferenca}
          </span>
        )}
      </div>
    </button>
  );
}

function DetalheReposicao({ r, onBack }: { r: Reposicao; onBack: () => void }) {
  const [copiado, setCopiado] = useState(false);

  const textoRelatorio = [
    `=== Relatório de Reposição ===`,
    `Produto:    ${r.produtoNome}`,
    `Código:     ${r.produtoCodigo}`,
    `Data/hora:  ${formatarData(r.data)}`,
    `Operador:   ${r.operador}`,
    ``,
    `Sistema (gôndola): ${r.qtdSistema} un`,
    `Contagem cega:     ${r.qtdContada} un`,
    `Diferença:         ${r.diferenca > 0 ? "+" : ""}${r.diferenca}`,
    `Resultado:         ${r.bateu ? "OK" : "DIVERGÊNCIA"}`,
    ``,
    `Qtd reposta:       +${r.qtdReposta} un`,
    r.tarefaId ? `Tarefa ID:  ${r.tarefaId}` : "Reposição avulsa",
    `ID registro: ${r.id}`,
  ].join("\n");

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="text-muted-foreground" aria-label="Voltar">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base font-semibold text-foreground">{r.produtoNome}</h1>
          <p className="text-xs text-muted-foreground">{formatarData(r.data)}</p>
        </div>
        <button
          onClick={() => copiarTexto(textoRelatorio, setCopiado)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
            copiado
              ? "border-success/30 bg-success/10 text-success"
              : "border-border text-muted-foreground active:bg-muted",
          )}
        >
          <Copy className="h-3.5 w-3.5" />
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Status badge */}
        <div className={cn(
          "flex items-center gap-3 rounded-xl p-4",
          r.bateu ? "bg-success/10" : "bg-destructive/10",
        )}>
          {r.bateu
            ? <CheckCircle2 className="h-8 w-8 text-success" />
            : <AlertTriangle className="h-8 w-8 text-destructive" />}
          <div>
            <p className={cn("font-display text-base font-semibold", r.bateu ? "text-success" : "text-destructive")}>
              {r.bateu ? "Contagem correta" : "Divergência registrada"}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.bateu
                ? "A contagem cega bateu com o sistema."
                : `Diferença de ${Math.abs(r.diferenca)} unidade${Math.abs(r.diferenca) !== 1 ? "s" : ""} ${r.diferenca < 0 ? "a menos" : "a mais"}.`}
            </p>
          </div>
        </div>

        {/* Contagem */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contagem</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Sistema", val: r.qtdSistema },
              { label: "Contado", val: r.qtdContada, destaque: !r.bateu },
              { label: "Diferença", val: (r.diferenca > 0 ? "+" : "") + r.diferenca, destaque: !r.bateu },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl p-3",
                  item.destaque ? "bg-destructive/10" : "bg-muted",
                )}
              >
                <p className={cn("text-[10px]", item.destaque ? "text-destructive" : "text-muted-foreground")}>
                  {item.label}
                </p>
                <p className={cn("font-display text-xl font-bold", item.destaque ? "text-destructive" : "text-foreground")}>
                  {item.val}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Reposição */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reposição</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quantidade reposta</span>
            <span className="font-display text-lg font-bold text-primary">+{r.qtdReposta} un</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Operador</span>
            <span className="text-sm font-medium text-foreground">{r.operador}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tipo</span>
            <span className="text-sm font-medium text-foreground">{r.tarefaId ? "Por tarefa" : "Avulsa"}</span>
          </div>
        </div>

        {/* Produto */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nome</span>
            <span className="text-sm font-medium text-foreground">{r.produtoNome}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Código</span>
            <span className="font-mono text-sm text-foreground">{r.produtoCodigo}</span>
          </div>
        </div>

        {/* ID */}
        <div className="rounded-xl bg-muted p-3">
          <p className="text-[10px] text-muted-foreground">ID do registro</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground break-all">{r.id}</p>
        </div>
      </div>
    </div>
  );
}

function RepositorHistorico() {
  const { reposicoes } = useRepositorEstado();
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const detalhe = detalheId ? reposicoes.find((r) => r.id === detalheId) : null;

  if (detalhe) {
    return <DetalheReposicao r={detalhe} onBack={() => setDetalheId(null)} />;
  }

  const hoje = new Date().toDateString();
  const repHoje = reposicoes.filter((r) => new Date(r.data).toDateString() === hoje);
  const repAnteriores = reposicoes.filter((r) => new Date(r.data).toDateString() !== hoje);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Clock className="h-4 w-4 text-primary" />
        <h1 className="font-display text-base font-semibold text-foreground">
          Histórico ({reposicoes.length})
        </h1>
      </div>

      {reposicoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma reposição registrada ainda</p>
          <p className="text-xs text-muted-foreground">Conclua uma reposição para ver o histórico</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {repHoje.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hoje</p>
              {repHoje.map((r) => (
                <ResumoCard key={r.id} r={r} onClick={() => setDetalheId(r.id)} />
              ))}
            </div>
          )}
          {repAnteriores.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anteriores</p>
              {repAnteriores.map((r) => (
                <ResumoCard key={r.id} r={r} onClick={() => setDetalheId(r.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
