import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, Pencil, Target, TrendingUp, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarMetas, useMetas } from "@/lib/metas-store";
import { useEstoque } from "@/lib/estoque-store";
import { vendasHoje, vendasPeriodo, vendasPorDia, HOJE } from "@/lib/computed";
import { brl } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/metas")({
  head: () => ({
    meta: [{ title: "Metas de Vendas — OmniSafe 360" }],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Metas,
});

function primeiroDoMes(hoje: string): string {
  return hoje.slice(0, 7) + "-01";
}

function ultimoDoMes(hoje: string): number {
  const [ano, mes] = hoje.split("-").map(Number);
  return new Date(ano!, mes!, 0).getDate();
}

function Metas() {
  const metas = useMetas();
  const est = useEstoque();

  const [editando, setEditando] = useState(false);
  const [fDiaria, setFDiaria] = useState(String(metas.metaDiaria || ""));
  const [fMensal, setFMensal] = useState(String(metas.metaMensal || ""));

  const hoje = vendasHoje(est.movs);
  const primeiroMes = primeiroDoMes(HOJE);
  const totalMes = useMemo(() => vendasPeriodo(est.movs, primeiroMes, HOJE), [est.movs, primeiroMes]);

  const diasDoMes = ultimoDoMes(HOJE);
  const diaAtual = Number(HOJE.slice(8, 10));
  const diasRestantes = diasDoMes - diaAtual;

  const pctDia = metas.metaDiaria > 0 ? Math.min(100, Math.round((hoje / metas.metaDiaria) * 100)) : 0;
  const pctMes = metas.metaMensal > 0 ? Math.min(100, Math.round((totalMes / metas.metaMensal) * 100)) : 0;

  const faltaMes = Math.max(0, metas.metaMensal - totalMes);
  const mediaNecessaria = diasRestantes > 0 ? faltaMes / diasRestantes : 0;

  const diasSemana7 = useMemo(() => vendasPorDia(est.movs, 30), [est.movs]);
  const diasMes = useMemo(() => {
    return diasSemana7.filter((d) => d.data.slice(0, 7) === HOJE.slice(0, 7));
  }, [diasSemana7]);
  const maxDia = Math.max(...diasMes.map((d) => d.valor), metas.metaDiaria, 1);

  function abrirEditar() {
    setFDiaria(metas.metaDiaria > 0 ? String(metas.metaDiaria) : "");
    setFMensal(metas.metaMensal > 0 ? String(metas.metaMensal) : "");
    setEditando(true);
  }

  function salvar() {
    const d = parseFloat(fDiaria.replace(",", ".")) || 0;
    const m = parseFloat(fMensal.replace(",", ".")) || 0;
    salvarMetas({ metaDiaria: d, metaMensal: m });
    setEditando(false);
  }

  const temMeta = metas.metaDiaria > 0 || metas.metaMensal > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Metas de Vendas</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe o desempenho diário e mensal
            </p>
          </div>
        </div>
        {!editando && (
          <Button onClick={abrirEditar} variant="outline" size="sm" className="gap-2">
            <Pencil className="h-4 w-4" /> {temMeta ? "Editar metas" : "Definir metas"}
          </Button>
        )}
      </div>

      {/* Formulário de configuração */}
      {editando && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Configurar metas</h2>
            <button onClick={() => setEditando(false)} className="rounded-lg p-1 hover:bg-muted" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Meta diária de vendas (R$)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Ex: 1500"
                value={fDiaria}
                onChange={(e) => setFDiaria(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Zero = sem meta definida</p>
            </div>
            <div className="space-y-1">
              <Label>Meta mensal de vendas (R$)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Ex: 45000"
                value={fMensal}
                onChange={(e) => setFMensal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Zero = sem meta definida</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar metas</Button>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Meta do dia */}
        <div className={cn(
          "rounded-2xl border p-5",
          pctDia >= 100 ? "border-success/30 bg-success/5" : "bg-card",
        )}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meta do dia
            </p>
            {pctDia >= 100 && <CheckCircle2 className="h-4 w-4 text-success" />}
            {pctDia < 100 && <TrendingUp className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="mt-3 text-3xl font-bold font-display">{brl(hoje)}</p>
          {metas.metaDiaria > 0 ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Meta: {brl(metas.metaDiaria)} · {pctDia}% atingido
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pctDia >= 100 ? "bg-success" : pctDia >= 70 ? "bg-warning" : "bg-primary",
                  )}
                  style={{ width: `${pctDia}%` }}
                />
              </div>
              {pctDia < 100 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Falta {brl(metas.metaDiaria - hoje)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              <button onClick={abrirEditar} className="text-primary hover:underline">
                Definir meta diária →
              </button>
            </p>
          )}
        </div>

        {/* Meta mensal */}
        <div className={cn(
          "rounded-2xl border p-5",
          pctMes >= 100 ? "border-success/30 bg-success/5" : "bg-card",
        )}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meta do mês
            </p>
            {pctMes >= 100 && <CheckCircle2 className="h-4 w-4 text-success" />}
            {pctMes < 100 && <Target className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="mt-3 text-3xl font-bold font-display">{brl(totalMes)}</p>
          {metas.metaMensal > 0 ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Meta: {brl(metas.metaMensal)} · {pctMes}% atingido
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pctMes >= 100 ? "bg-success" : pctMes >= 70 ? "bg-warning" : "bg-primary",
                  )}
                  style={{ width: `${pctMes}%` }}
                />
              </div>
              {pctMes < 100 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Falta {brl(faltaMes)} · {diasRestantes}d restantes
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              <button onClick={abrirEditar} className="text-primary hover:underline">
                Definir meta mensal →
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Projeção */}
      {metas.metaMensal > 0 && pctMes < 100 && diasRestantes > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Projeção para bater a meta</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{diasRestantes}</p>
              <p className="text-xs text-muted-foreground">dias restantes</p>
            </div>
            <div className={cn(
              "rounded-lg p-3",
              mediaNecessaria > (metas.metaDiaria || mediaNecessaria + 1) * 1.2
                ? "bg-destructive/8 text-destructive"
                : "bg-muted/50",
            )}>
              <p className="text-2xl font-bold">{brl(mediaNecessaria)}</p>
              <p className="text-xs text-muted-foreground">necessário/dia</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{brl(totalMes / Math.max(diaAtual, 1))}</p>
              <p className="text-xs text-muted-foreground">média real/dia</p>
            </div>
          </div>
          {mediaNecessaria > (totalMes / Math.max(diaAtual, 1)) * 1.3 && (
            <p className="mt-3 text-xs text-destructive flex items-center gap-1">
              <ArrowDownRight className="h-3.5 w-3.5" />
              Ritmo atual abaixo do necessário para bater a meta mensal.
            </p>
          )}
          {mediaNecessaria <= (totalMes / Math.max(diaAtual, 1)) && (
            <p className="mt-3 text-xs text-success flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Ritmo atual suficiente para bater a meta mensal!
            </p>
          )}
        </div>
      )}

      {/* Gráfico de vendas do mês */}
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Vendas — este mês</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Total: {brl(totalMes)}
          {metas.metaMensal > 0 && ` de ${brl(metas.metaMensal)}`}
        </p>

        {diasMes.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Nenhuma venda registrada este mês ainda.
          </p>
        ) : (
          <div className="mt-6 flex h-44 items-end gap-1">
            {diasMes.map((d, i) => {
              const isHoje = d.data === HOJE;
              const barH = Math.max(4, Math.round((d.valor / maxDia) * 152));
              const metaH = metas.metaDiaria > 0
                ? Math.round((metas.metaDiaria / maxDia) * 152)
                : 0;
              return (
                <div key={i} className="group relative flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end relative">
                    {metaH > 0 && (
                      <div
                        className="absolute bottom-0 w-full border-t-2 border-dashed border-primary/30"
                        style={{ bottom: `${metaH}px` }}
                      />
                    )}
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        isHoje
                          ? d.valor >= (metas.metaDiaria || 0) && metas.metaDiaria > 0
                            ? "bg-success"
                            : "bg-gradient-brand"
                          : d.valor >= (metas.metaDiaria || 0) && metas.metaDiaria > 0
                            ? "bg-success/40"
                            : "bg-muted-foreground/20 hover:bg-muted-foreground/35",
                      )}
                      style={{ height: `${barH}px` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[9px]",
                    isHoje ? "font-bold text-primary" : "text-muted-foreground",
                  )}>
                    {d.label.slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {metas.metaDiaria > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px w-6 border-t-2 border-dashed border-primary/40" />
            Meta diária ({brl(metas.metaDiaria)})
          </div>
        )}
      </div>
    </div>
  );
}
