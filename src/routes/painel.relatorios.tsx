import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart3, Download, Package, PackageX, RefreshCw,
  TrendingDown, TrendingUp, Trophy,
} from "lucide-react";
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
      { name: "description", content: "Análise de vendas, Curva ABC, produtos parados e perdas." },
      { property: "og:title", content: "Relatórios — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

// ─── Types & helpers ──────────────────────────────────────────────────────────

type Periodo = "7" | "30" | "90";
type Aba = "vendas" | "produtos" | "operacoes";

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
      classe: (pct <= 80 ? "A" : pct <= 95 ? "B" : "C") as "A" | "B" | "C",
    };
  });
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function GraficoBarras({ dias }: { dias: ReturnType<typeof vendasPorDia> }) {
  const max = Math.max(...dias.map((d) => d.valor), 1);
  const step = Math.max(1, Math.ceil(dias.length / 7));
  return (
    <div className="flex h-44 items-end gap-[2px]" role="img" aria-label="Gráfico de vendas diárias">
      {dias.map((d, i) => {
        const barH = Math.max(3, Math.round((d.valor / max) * 136));
        const isHoje = d.data === HOJE;
        const showLabel = i % step === 0 || i === dias.length - 1;
        return (
          <div key={d.data} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <div
              title={`${d.label}: ${brl(d.valor)}`}
              className={cn(
                "w-full cursor-default rounded-t-sm transition-colors",
                isHoje ? "bg-primary" : "bg-primary/35 group-hover:bg-primary/65",
              )}
              style={{ height: `${barH}px` }}
            />
            {showLabel && (
              <span className="absolute bottom-[-18px] text-[9px] leading-none text-muted-foreground">
                {d.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function Relatorios() {
  const est = useEstoque();
  const produtos = useProdutos();
  const { recebimentos } = useRecebeEstado();
  const { reposicoes } = useRepositorEstado();
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [aba, setAba] = useState<Aba>("vendas");

  const dataInicio = useMemo(() => {
    return new Date(Date.now() - Number(periodo) * 86_400_000).toISOString().slice(0, 10);
  }, [periodo]);

  const movsFiltrados = useMemo(
    () => est.movs.filter((m) => m.data.slice(0, 10) >= dataInicio),
    [est.movs, dataInicio],
  );

  const abc = useMemo(() => curvaAbc(movsFiltrados), [movsFiltrados]);
  const totalFat = abc.reduce((s, l) => s + l.fat, 0);

  const vpPeriodo = useMemo(() => vendasPorProduto(movsFiltrados), [movsFiltrados]);
  const vpTudo = useMemo(() => vendasPorProduto(est.movs), [est.movs]);

  const unVendidas = useMemo(
    () => Object.values(vpPeriodo).reduce((s, v) => s + v.un, 0),
    [vpPeriodo],
  );

  const parados = useMemo(
    () => produtos.filter((p) => diasSemVenda(vpTudo[p.id]?.ultimaData ?? null) >= Number(periodo)),
    [produtos, vpTudo, periodo],
  );

  const perdas = useMemo(() => movsFiltrados.filter((m) => m.tipo === "ajuste" && m.qtd < 0), [movsFiltrados]);
  const valorPerdas = perdas.reduce(
    (s, m) => s + Math.abs(m.qtd) * (produtos.find((p) => p.id === m.produtoId)?.preco ?? 0),
    0,
  );

  const diasGrafico = useMemo(() => vendasPorDia(est.movs, Number(periodo)), [est.movs, periodo]);

  const mesAtual = HOJE.slice(0, 7);
  const mesAnterior = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 7);
  const fatAtual = faturamentoMes(est.movs, mesAtual);
  const fatAnterior = faturamentoMes(est.movs, mesAnterior);
  const varMes = fatAnterior > 0 ? ((fatAtual - fatAnterior) / fatAnterior) * 100 : 0;
  const crescendo = varMes >= 0;

  const top5 = abc.filter((l) => l.fat > 0).slice(0, 5);
  const maxFatTop = top5[0]?.fat ?? 1;

  const corClasse = {
    A: { badge: "bg-success/15 text-success", txt: "text-success" },
    B: { badge: "bg-warning/15 text-warning", txt: "text-warning" },
    C: { badge: "bg-muted text-muted-foreground", txt: "text-muted-foreground" },
  } as const;

  const abcResumo = useMemo(() => ({
    A: { n: abc.filter((l) => l.classe === "A" && l.fat > 0).length, pct: abc.filter((l) => l.classe === "A").reduce((s, l) => s + l.pct, 0) },
    B: { n: abc.filter((l) => l.classe === "B" && l.fat > 0).length, pct: abc.filter((l) => l.classe === "B").reduce((s, l) => s + l.pct, 0) },
    C: { n: abc.filter((l) => l.classe === "C" && l.fat > 0).length, pct: abc.filter((l) => l.classe === "C").reduce((s, l) => s + l.pct, 0) },
  }), [abc]);

  const recebPeriodo = recebimentos.filter((r) => r.data.slice(0, 10) >= dataInicio);
  const reposPeriodo = reposicoes.filter((r) => r.data.slice(0, 10) >= dataInicio);

  const periodoLabel = PERIODOS.find((p) => p.v === periodo)!.label;
  const dataInicioFmt = new Date(dataInicio + "T12:00").toLocaleDateString("pt-BR");
  const hojeLabel = new Date(HOJE + "T12:00").toLocaleDateString("pt-BR");

  const abas: { id: Aba; t: string; desc: string }[] = [
    { id: "vendas", t: "Tendência de Vendas", desc: "Gráfico diário, Top 5 e comparativo de meses" },
    { id: "produtos", t: "Curva de Produtos", desc: "Curva ABC e produtos parados" },
    { id: "operacoes", t: "Operações", desc: "Recebimentos, reposições e perdas" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            {dataInicioFmt} até {hojeLabel} · últimos {periodoLabel}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          {PERIODOS.map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setPeriodo(v)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                periodo === v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-wide">Faturamento</p>
          </div>
          <p className="font-display mt-2 text-2xl font-bold">{brl(totalFat)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">últimos {periodoLabel}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4 text-success" />
            <p className="text-xs uppercase tracking-wide">Unidades vendidas</p>
          </div>
          <p className="font-display mt-2 text-2xl font-bold">{unVendidas}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">últimos {periodoLabel}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            {crescendo
              ? <TrendingUp className="h-4 w-4 text-success" />
              : <TrendingDown className="h-4 w-4 text-destructive" />}
            <p className="text-xs uppercase tracking-wide">vs. mês anterior</p>
          </div>
          <p className={cn("font-display mt-2 text-2xl font-bold", crescendo ? "text-success" : "text-destructive")}>
            {varMes > 0 ? "+" : ""}{varMes.toFixed(1)}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {brl(fatAtual)} vs. {brl(fatAnterior)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingDown className={cn("h-4 w-4", valorPerdas > 0 ? "text-destructive" : "text-muted-foreground")} />
            <p className="text-xs uppercase tracking-wide">Perdas registradas</p>
          </div>
          <p className={cn("font-display mt-2 text-2xl font-bold", valorPerdas > 0 ? "text-destructive" : "")}>
            {brl(valorPerdas)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{perdas.length} evento{perdas.length !== 1 ? "s" : ""} no período</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-0">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "rounded-t-lg border border-b-0 px-5 py-2.5 text-sm font-medium transition",
              aba === a.id
                ? "border-border bg-card text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.t}
          </button>
        ))}
      </div>

      {/* ── Aba: Vendas ─────────────────────────────────────────────────────────── */}
      {aba === "vendas" && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-3">
            {/* Gráfico */}
            <div className="rounded-2xl border bg-card p-6 xl:col-span-2">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Vendas por dia</h2>
                  <p className="text-xs text-muted-foreground">Faturamento diário — barra azul escura = hoje</p>
                </div>
                <span className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                  crescendo ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
                )}>
                  {crescendo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {Math.abs(varMes).toFixed(1)}% vs. mês anterior
                </span>
              </div>
              <div className="pb-6">
                <GraficoBarras dias={diasGrafico} />
              </div>
              <div className="mt-1 grid grid-cols-2 divide-x border-t pt-4 text-center text-sm">
                <div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {new Date(mesAtual + "-01T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </p>
                  <p className="mt-0.5 text-lg font-bold">{brl(fatAtual)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {new Date(mesAnterior + "-01T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-muted-foreground">{brl(fatAnterior)}</p>
                </div>
              </div>
            </div>

            {/* Top 5 */}
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="mb-5 font-semibold">Top 5 produtos</h2>
              {top5.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados de venda no período.</p>
              ) : (
                <div className="space-y-5">
                  {top5.map((l, idx) => (
                    <div key={l.p.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 font-bold text-muted-foreground">#{idx + 1}</span>
                          <Link
                            to="/painel/produtos/$id"
                            params={{ id: l.p.id }}
                            className="truncate font-medium hover:text-primary hover:underline"
                          >
                            {l.p.nome}
                          </Link>
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
        </div>
      )}

      {/* ── Aba: Produtos ───────────────────────────────────────────────────────── */}
      {aba === "produtos" && (
        <div className="space-y-6">
          {/* Curva ABC */}
          <section className="rounded-2xl border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Trophy className="h-5 w-5 text-primary" /> Curva ABC
              </h2>
              <button
                onClick={() => {
                  const cab = ["Classe", "Produto", "Código", "Categoria", "UN vendidas", "Faturamento (R$)", "% Faturamento"];
                  const linhas = abc.map((l) => [l.classe, l.p.nome, l.p.codigo, l.p.categoria, String(vpPeriodo[l.p.id]?.un ?? 0), l.fat.toFixed(2), l.pct.toFixed(2)]);
                  exportCsv([cab, ...linhas], `curva-abc-${HOJE}-${periodo}d.csv`);
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </button>
            </div>

            {/* Resumo das classes */}
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              {(["A", "B", "C"] as const).map((cls) => {
                const dica = cls === "A"
                  ? "Nunca deixe faltar — são a base do faturamento"
                  : cls === "B"
                    ? "Importante, mas com mais margem de reposição"
                    : "Avalie se vale manter em estoque";
                return (
                  <div key={cls} className={cn("rounded-xl border p-4", corClasse[cls].badge)}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{cls}</span>
                      <span className="text-sm font-semibold">{abcResumo[cls].n} produto{abcResumo[cls].n !== 1 ? "s" : ""}</span>
                    </div>
                    <p className="mt-1 text-lg font-bold">{abcResumo[cls].pct.toFixed(1)}% do faturamento</p>
                    <p className="mt-1 text-[11px] opacity-80">{dica}</p>
                  </div>
                );
              })}
            </div>

            {totalFat === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem vendas no período selecionado.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {abc.filter((l) => l.fat > 0).map((l) => (
                  <div key={l.p.id} className="flex items-center gap-4">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold", corClasse[l.classe].badge)}>
                      {l.classe}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <Link
                          to="/painel/produtos/$id"
                          params={{ id: l.p.id }}
                          className="truncate font-medium hover:text-primary hover:underline"
                        >
                          {l.p.nome}
                        </Link>
                        <span className="shrink-0 text-muted-foreground">{brl(l.fat)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${Math.max(0.5, l.pct)}%` }} />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{l.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Produtos parados */}
          <section className="rounded-2xl border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <PackageX className="h-5 w-5 text-warning" /> Produtos parados
              </h2>
              {parados.length > 0 && (
                <button
                  onClick={() => {
                    const cab = ["Produto", "Código", "Categoria", "Dias sem venda"];
                    const linhas = parados.map((p) => [p.nome, p.codigo, p.categoria, String(diasSemVenda(vpTudo[p.id]?.ultimaData ?? null))]);
                    exportCsv([cab, ...linhas], `parados-${HOJE}.csv`);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              )}
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Sem nenhuma venda nos últimos {periodoLabel}.
              {parados.length > 0 && " Considere fazer promoção ou negociar uma devolução ao fornecedor."}
            </p>
            {parados.length === 0 ? (
              <div className="rounded-xl bg-success/5 px-4 py-6 text-center">
                <p className="font-semibold text-success">Todos os produtos venderam no período!</p>
              </div>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {parados.map((p) => {
                  const dias = diasSemVenda(vpTudo[p.id]?.ultimaData ?? null);
                  return (
                    <Link
                      key={p.id}
                      to="/painel/produtos/$id"
                      params={{ id: p.id }}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50 transition"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.nome}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p>
                      </div>
                      <span className={cn(
                        "ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                        dias >= 60 ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning",
                      )}>
                        {dias}d parado
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Aba: Operações ──────────────────────────────────────────────────────── */}
      {aba === "operacoes" && (
        <div className="space-y-6">
          {/* Perdas */}
          <section className="rounded-2xl border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <TrendingDown className="h-5 w-5 text-destructive" /> Perdas e ajustes negativos
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
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              )}
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {perdas.length === 0
                ? "Nenhuma perda registrada no período."
                : `${perdas.length} evento${perdas.length !== 1 ? "s" : ""} — total de ${brl(valorPerdas)} no período.`}
            </p>
            {perdas.length === 0 ? (
              <div className="rounded-xl bg-success/5 px-4 py-6 text-center">
                <p className="font-semibold text-success">Nenhuma perda no período.</p>
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
                        <p className="text-xs text-muted-foreground">
                          {m.data.slice(0, 10).split("-").reverse().join("/")} · {m.destino ?? "Ajuste"}
                        </p>
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

          <div className="grid gap-5 md:grid-cols-2">
            {/* Recebimentos */}
            <section className="rounded-2xl border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <RefreshCw className="h-4 w-4 text-success" /> Recebimentos
                </h2>
                <span className="text-sm text-muted-foreground">{recebPeriodo.length} no período</span>
              </div>
              {recebPeriodo.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhum recebimento no período.</p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {recebPeriodo.slice(0, 20).map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.fornecedor || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.data.slice(0, 10).split("-").reverse().join("/")} · {r.operador}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="text-sm font-semibold text-success">
                          +{r.itens.reduce((s, i) => s + i.qtdUN, 0)} un
                        </p>
                        <p className="text-xs text-muted-foreground">{r.itens.length} iten{r.itens.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Reposições */}
            <section className="rounded-2xl border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Package className="h-4 w-4 text-warning" /> Reposições na gôndola
                </h2>
                <span className="text-sm text-muted-foreground">{reposPeriodo.length} no período</span>
              </div>
              {reposPeriodo.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma reposição no período.</p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {reposPeriodo.slice(0, 20).map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.produtoNome}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.data.slice(0, 10).split("-").reverse().join("/")} · {r.operador}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className={cn("text-sm font-semibold", r.bateu ? "text-success" : "text-warning")}>
                          {r.qtdReposta} un
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.bateu ? "ok" : `diferença: ${r.diferenca}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
