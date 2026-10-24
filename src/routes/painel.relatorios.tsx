import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, PackageX, TrendingDown, TrendingUp, Trophy } from "lucide-react";

function exportCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
import { brl } from "@/lib/mock-data";
import { useEstoque, type Mov } from "@/lib/estoque-store";
import { HOJE, diasSemVenda, vendasPorProduto, vendasPorDia, faturamentoMes } from "@/lib/computed";
import { useProdutos, getProdutos } from "@/lib/produtos-store";

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

export function curvaAbc(movs: Mov[]) {
  const vp = vendasPorProduto(movs);
  const linhas = getProdutos().map((p) => ({ p, fat: (vp[p.id]?.un ?? 0) * p.preco })).sort((a, b) => b.fat - a.fat);
  const total = linhas.reduce((s, l) => s + l.fat, 0);
  let acum = 0;
  return linhas.map((l) => {
    acum += l.fat;
    const pct = total > 0 ? (acum / total) * 100 : 100;
    return { ...l, pct: total > 0 ? (l.fat / total) * 100 : 0, classe: pct <= 80 ? "A" : pct <= 95 ? "B" : "C" };
  });
}

function GraficoBarras({ dias }: { dias: ReturnType<typeof vendasPorDia> }) {
  const max = Math.max(...dias.map((d) => d.valor), 1);
  const CHART_H = 120;
  return (
    <div className="flex h-[160px] items-end gap-[2px]" role="img" aria-label="Gráfico de vendas dos últimos 30 dias">
      {dias.map((d, i) => {
        const barH = Math.max(3, Math.round((d.valor / max) * CHART_H));
        const showLabel = i === 0 || i === 6 || i === 13 || i === 20 || i === 29;
        return (
          <div key={d.data} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <div
              title={`${d.label}: ${brl(d.valor)}`}
              className="w-full cursor-default rounded-t-[2px] bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${barH}px` }}
            />
            {showLabel && (
              <span className="absolute bottom-[-18px] text-[9px] text-muted-foreground">{d.label}</span>
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
  const abc = curvaAbc(est.movs);
  const total = abc.reduce((s, l) => s + l.fat, 0);

  const vp = vendasPorProduto(est.movs);
  const parados = produtos.filter((p) => diasSemVenda(vp[p.id]?.ultimaData ?? null) >= 15);

  const perdas = est.movs.filter((m) => m.tipo === "ajuste" && m.qtd < 0);
  const valorPerdas = perdas.reduce((s, m) => s + Math.abs(m.qtd) * (produtos.find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
  const cor = { A: "bg-success/15 text-success", B: "bg-warning/15 text-warning", C: "bg-muted text-muted-foreground" } as const;

  const dias30 = vendasPorDia(est.movs, 30);
  const mesAtual = HOJE.slice(0, 7);
  const mesAnteriorData = new Date(new Date(HOJE).getTime() - 30 * 86_400_000);
  const mesAnterior = mesAnteriorData.toISOString().slice(0, 7);
  const fatAtual = faturamentoMes(est.movs, mesAtual);
  const fatAnterior = faturamentoMes(est.movs, mesAnterior);
  const varMes = fatAnterior > 0 ? ((fatAtual - fatAnterior) / fatAnterior) * 100 : 0;
  const crescendo = varMes >= 0;

  const top5 = [...abc].slice(0, 5);
  const maxFatTop = top5[0]?.fat ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">{new Date(HOJE).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} · o que mais vende, o que está parado e o que se perdeu.</p>
        </div>
        <button
          onClick={() => {
            const cab = ["Classe", "Produto", "Código", "Categoria", "Faturamento (R$)", "% do Total"];
            const linhas = abc.map((l) => [l.classe, l.p.nome, l.p.codigo, l.p.categoria, l.fat.toFixed(2), l.pct.toFixed(2)]);
            exportCsv([cab, ...linhas], `curva-abc-${new Date().toISOString().slice(0, 7)}.csv`);
          }}
          className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Exportar Curva ABC
        </button>
      </div>

      {/* Tendência + top 5 */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 xl:col-span-2">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Tendência de vendas — últimos 30 dias</h2>
              <p className="text-xs text-muted-foreground">Passe o mouse sobre as barras para ver o valor de cada dia.</p>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${crescendo ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
              {crescendo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(varMes).toFixed(1)}% vs. mês anterior
            </div>
          </div>
          <div className="pb-6">
            <GraficoBarras dias={dias30} />
          </div>
          <div className="mt-2 grid grid-cols-2 divide-x border-t pt-4 text-center text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{new Date(mesAtual + "-01").toLocaleDateString("pt-BR", { month: "long" })}</p>
              <p className="font-display text-lg font-bold">{brl(fatAtual)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{new Date(mesAnterior + "-01").toLocaleDateString("pt-BR", { month: "long" })}</p>
              <p className="font-display text-lg font-bold text-muted-foreground">{brl(fatAnterior)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 font-semibold">Top 5 produtos</h2>
          {top5.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de venda.</p>
          ) : (
            <div className="space-y-4">
              {top5.map((l, idx) => (
                <div key={l.p.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                      <span className="truncate font-medium">{l.p.nome}</span>
                    </div>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{brl(l.fat)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-brand"
                      style={{ width: `${Math.max(4, (l.fat / maxFatTop) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { t: "Faturamento do mês", v: brl(total), i: BarChart3 },
          { t: "Produtos parados (15+ dias)", v: String(parados.length), i: PackageX },
          { t: "Perdas registradas", v: brl(valorPerdas), i: TrendingDown },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border bg-card p-5 shadow-sm">
            <k.i className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{k.t}</p>
            <p className="font-display text-2xl font-bold">{k.v}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Trophy className="h-5 w-5 text-primary" /> Curva ABC
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">A = 80% do faturamento (nunca pode faltar) · B = próximos 15% · C = restante.</p>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de venda este mês.</p>
        ) : (
          <div className="space-y-3">
            {abc.map((l) => (
              <div key={l.p.id} className="flex items-center gap-4">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${cor[l.classe as "A"]}`}>
                  {l.classe}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{l.p.nome}</span>
                    <span>{brl(l.fat)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-gradient-brand" style={{ width: `${l.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Produtos parados</h2>
          {parados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os produtos venderam nos últimos 15 dias.</p>
          ) : (
            parados.map((p) => (
              <div key={p.id} className="flex justify-between border-b py-2 text-sm last:border-0">
                <span>{p.nome}</span>
                <span className="text-warning">sem venda há {diasSemVenda(vp[p.id]?.ultimaData ?? null)} dias</span>
              </div>
            ))
          )}
        </section>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Perdas</h2>
          {perdas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma perda registrada.</p>}
          {perdas.map((m) => (
            <div key={m.id} className="flex justify-between border-b py-2 text-sm last:border-0">
              <span>
                {produtos.find((p) => p.id === m.produtoId)?.nome} · {m.destino}
              </span>
              <span className="text-destructive">{m.qtd} un</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
