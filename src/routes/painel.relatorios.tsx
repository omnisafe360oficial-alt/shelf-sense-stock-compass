import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Download, PackageX, RefreshCw, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { brl } from "@/lib/mock-data";
import { useEstoque, type Mov } from "@/lib/estoque-store";
import { HOJE, diasSemVenda, vendasPorProduto, vendasPorDia, faturamentoMes } from "@/lib/computed";
import { useProdutos, getProdutos } from "@/lib/produtos-store";
import { useRecebeEstado } from "@/lib/recebe-store";
import { useRepositorEstado } from "@/lib/repositor-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — OmniSafe 360" },
      { name: "description", content: "Curva ABC, produtos parados e perdas do mês." },
      { property: "og:title", content: "Relatórios — OmniSafe 360" },
      { property: "og:description", content: "Relatórios de vendas e estoque no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

type Periodo = "7" | "30" | "90";
const PERIODOS: { v: Periodo; label: string }[] = [
  { v: "7", label: "7 dias" },
  { v: "30", label: "30 dias" },
  { v: "90", label: "90 dias" },
];

function exportCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function curvaAbc(movs: Mov[]) {
  const vp = vendasPorProduto(movs);
  const linhas = getProdutos()
    .map((p) => ({ p, fat: (vp[p.id]?.un ?? 0) * p.preco }))
    .sort((a, b) => b.fat - a.fat);
  const total = linhas.reduce((s, l) => s + l.fat, 0);
  let acum = 0;
  return linhas.map((l) => {
    acum += l.fat;
    const pct = total > 0 ? (acum / total) * 100 : 100;
    return {
      ...l,
      pct: total > 0 ? (l.fat / total) * 100 : 0,
      classe: pct <= 80 ? "A" : pct <= 95 ? "B" : ("C" as "A" | "B" | "C"),
    };
  });
}

function GraficoBarras({ dias, maxBarras }: { dias: ReturnType<typeof vendasPorDia>; maxBarras?: number }) {
  const dados = maxBarras ? dias.slice(-maxBarras) : dias;
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const step = Math.ceil(dados.length / 6);
  return (
    <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Gráfico de vendas">
      {dados.map((d, i) => {
        const barH = Math.max(3, Math.round((d.valor / max) * 130));
        const isHoje = d.data === HOJE;
        const showLabel = i % step === 0 || i === dados.length - 1;
        return (
          <div key={d.data} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <div
              title={`${d.label}: ${brl(d.valor)}`}
              className={cn(
                "w-full cursor-default rounded-t-[2px] transition-colors",
                isHoje ? "bg-primary" : "bg-primary/40 group-hover:bg-primary/70",
              )}
              style={{ height: `${barH}px` }}
            />
            {showLabel && (
              <span className="absolute bottom-[-16px] text-[9px] text-muted-foreground">{d.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Relatorios() {
  const est = useEstoque();
  const produtos = useProdutos();
  const { recebimentos } = useRecebeEstado();
  const { reposicoes } = useRepositorEstado();
  const [periodo, setPeriodo] = useState<Periodo>("30");

  const dataInicio = useMemo(() => {
    const dias = Number(periodo);
    return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  }, [periodo]);

  const movsFiltrados = useMemo(
    () => est.movs.filter((m) => m.data.slice(0, 10) >= dataInicio),
    [est.movs, dataInicio],
  );

  const abc = useMemo(() => curvaAbc(movsFiltrados), [movsFiltrados]);
  const totalFat = abc.reduce((s, l) => s + l.fat, 0);

  const vp = vendasPorProduto(est.movs); // all-time for "parados"
  const vpPeriodo = vendasPorProduto(movsFiltrados);
  const parados = produtos.filter((p) => diasSemVenda(vp[p.id]?.ultimaData ?? null) >= Number(periodo));

  const perdas = movsFiltrados.filter((m) => m.tipo === "ajuste" && m.qtd < 0);
  const valorPerdas = perdas.reduce(
    (s, m) => s + Math.abs(m.qtd) * (produtos.find((p) => p.id === m.produtoId)?.preco ?? 0),
    0,
  );

  const diasGrafico = vendasPorDia(est.movs, Number(periodo));

  const mesAtual = HOJE.slice(0, 7);
  const mesAnteriorData = new Date(new Date(HOJE).getTime() - 30 * 86_400_000);
  const mesAnterior = mesAnteriorData.toISOString().slice(0, 7);
  const fatAtual = faturamentoMes(est.movs, mesAtual);
  const fatAnterior = faturamentoMes(est.movs, mesAnterior);
  const varMes = fatAnterior > 0 ? ((fatAtual - fatAnterior) / fatAnterior) * 100 : 0;
  const crescendo = varMes >= 0;

  const top5 = [...abc].filter((l) => l.fat > 0).slice(0, 5);
  const maxFatTop = top5[0]?.fat ?? 1;

  const corClasse = {
    A: "bg-success/15 text-success",
    B: "bg-warning/15 text-warning",
    C: "bg-muted text-muted-foreground",
  } as const;

  // recebimentos e reposicoes do período
  const recebPeriodo = recebimentos.filter((r) => r.data.slice(0, 10) >= dataInicio);
  const reposPeriodo = reposicoes.filter((r) => r.data.slice(0, 10) >= dataInicio);
  const totalRecebido = recebPeriodo.reduce((s, r) => s + r.itens.reduce((si, i) => si + i.qtdUN, 0), 0);
  const totalReposto = reposPeriodo.reduce((s, r) => s + r.qtdReposta, 0);

  const periodoLabel = PERIODOS.find((p) => p.v === periodo)!.label;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análise dos últimos {periodoLabel} · {new Date(dataInicio + "T12:00").toLocaleDateString("pt-BR")} até {new Date(HOJE + "T12:00").toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de período */}
          <div className="flex rounded-lg border bg-card">
            {PERIODOS.map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setPeriodo(v)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition first:rounded-l-lg last:rounded-r-lg",
                  periodo === v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const cab = ["Classe", "Produto", "Código", "Categoria", "Faturamento (R$)", "% do Total"];
              const linhas = abc.map((l) => [l.classe, l.p.nome, l.p.codigo, l.p.categoria, l.fat.toFixed(2), l.pct.toFixed(2)]);
              exportCsv([cab, ...linhas], `curva-abc-${HOJE}.csv`);
            }}
            className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Exportar ABC
          </button>
        </div>
      </div>

      {/* KPIs do período */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Faturamento", valor: brl(totalFat), icon: BarChart3, tom: "text-primary" },
          { label: "Perdas registradas", valor: brl(valorPerdas), icon: TrendingDown, tom: valorPerdas > 0 ? "text-destructive" : "text-muted-foreground" },
          { label: "UN recebidas", valor: String(totalRecebido), icon: RefreshCw, tom: "text-emerald-600" },
          { label: "UN repostas", valor: String(totalReposto), icon: RefreshCw, tom: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <k.icon className={cn("h-4 w-4", k.tom)} />
              <p className="text-sm text-muted-foreground">{k.label}</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{k.valor}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">últimos {periodoLabel}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de vendas + Top 5 */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Tendência de vendas</h2>
              <p className="text-xs text-muted-foreground">Faturamento por dia nos últimos {periodoLabel}</p>
            </div>
            <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", crescendo ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")}>
              {crescendo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(varMes).toFixed(1)}% vs. mês anterior
            </div>
          </div>
          <div className="pb-5">
            <GraficoBarras dias={diasGrafico} />
          </div>
          <div className="mt-1 grid grid-cols-2 divide-x border-t pt-4 text-center text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{new Date(mesAtual + "-01T12:00").toLocaleDateString("pt-BR", { month: "long" })}</p>
              <p className="text-lg font-bold">{brl(fatAtual)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{new Date(mesAnterior + "-01T12:00").toLocaleDateString("pt-BR", { month: "long" })}</p>
              <p className="text-lg font-bold text-muted-foreground">{brl(fatAnterior)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Top 5 produtos</h2>
          {top5.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de venda no período.</p>
          ) : (
            <div className="space-y-4">
              {top5.map((l, idx) => (
                <div key={l.p.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                      <span className="truncate font-medium">{l.p.nome}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{brl(l.fat)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${Math.max(4, (l.fat / maxFatTop) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Curva ABC */}
      <section className="rounded-2xl border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="h-5 w-5 text-primary" /> Curva ABC
          </h2>
          <button
            onClick={() => {
              const cab = ["Classe", "Produto", "Código", "Categoria", "UN vendidas", "Faturamento (R$)", "% Faturamento"];
              const linhas = abc.map((l) => [
                l.classe, l.p.nome, l.p.codigo, l.p.categoria,
                String(vpPeriodo[l.p.id]?.un ?? 0), l.fat.toFixed(2), l.pct.toFixed(2),
              ]);
              exportCsv([cab, ...linhas], `curva-abc-${HOJE}-${periodo}d.csv`);
            }}
            className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          A = top 80% do faturamento · B = próximos 15% · C = restante
        </p>
        {totalFat === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vendas no período selecionado.</p>
        ) : (
          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {abc.filter((l) => l.fat > 0).map((l) => (
              <div key={l.p.id} className="flex items-center gap-4">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold", corClasse[l.classe])}>
                  {l.classe}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{l.p.nome}</span>
                    <span className="shrink-0 text-muted-foreground">{brl(l.fat)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${l.pct}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground w-10 text-right">{l.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Parados + Perdas */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <PackageX className="h-5 w-5 text-warning" /> Produtos parados
            </h2>
            {parados.length > 0 && (
              <button
                onClick={() => {
                  const cab = ["Produto", "Código", "Categoria", "Dias sem venda"];
                  const linhas = parados.map((p) => [p.nome, p.codigo, p.categoria, String(diasSemVenda(vp[p.id]?.ultimaData ?? null))]);
                  exportCsv([cab, ...linhas], `parados-${HOJE}.csv`);
                }}
                className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Sem venda nos últimos {periodoLabel}</p>
          {parados.length === 0 ? (
            <div className="rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Todos os produtos venderam no período!</p>
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {parados.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
                    {diasSemVenda(vp[p.id]?.ultimaData ?? null)}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <TrendingDown className="h-5 w-5 text-destructive" /> Perdas e ajustes
            </h2>
            {perdas.length > 0 && (
              <button
                onClick={() => {
                  const cab = ["Data", "Produto", "Motivo", "Qtd", "Valor (R$)"];
                  const linhas = perdas.map((m) => [
                    m.data.slice(0, 10),
                    produtos.find((p) => p.id === m.produtoId)?.nome ?? m.produtoId,
                    m.destino ?? "—",
                    String(Math.abs(m.qtd)),
                    (Math.abs(m.qtd) * (produtos.find((p) => p.id === m.produtoId)?.preco ?? 0)).toFixed(2),
                  ]);
                  exportCsv([cab, ...linhas], `perdas-${HOJE}.csv`);
                }}
                className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {perdas.length} evento{perdas.length !== 1 ? "s" : ""} · {brl(valorPerdas)} no período
          </p>
          {perdas.length === 0 ? (
            <div className="rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Nenhuma perda no período.</p>
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {perdas.map((m) => {
                const prod = produtos.find((p) => p.id === m.produtoId);
                const valor = Math.abs(m.qtd) * (prod?.preco ?? 0);
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{prod?.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{m.data.slice(0, 10)} · {m.destino ?? "Ajuste"}</p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-sm font-semibold text-destructive">{brl(valor)}</p>
                      <p className="text-xs text-muted-foreground">{Math.abs(m.qtd)} un</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Recebimentos + Reposições */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recebimentos</h2>
            <span className="text-sm text-muted-foreground">{recebPeriodo.length} no período</span>
          </div>
          {recebPeriodo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum recebimento no período.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {recebPeriodo.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.fornecedor || "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.data.slice(0, 10)} · {r.operador}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-sm font-semibold">{r.itens.reduce((s, i) => s + i.qtdUN, 0)} un</p>
                    <p className="text-xs text-muted-foreground">{r.itens.length} iten{r.itens.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Reposições</h2>
            <span className="text-sm text-muted-foreground">{reposPeriodo.length} no período</span>
          </div>
          {reposPeriodo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma reposição no período.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {reposPeriodo.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.produtoNome}</p>
                    <p className="text-xs text-muted-foreground">{r.data.slice(0, 10)} · {r.operador}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className={cn("text-sm font-semibold", r.bateu ? "text-success" : "text-warning")}>
                      {r.qtdReposta} un
                    </p>
                    <p className="text-xs text-muted-foreground">{r.bateu ? "ok" : `Δ${r.diferenca}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
