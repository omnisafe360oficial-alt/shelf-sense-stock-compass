import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart2, TrendingUp, ShoppingBag, Package, Calendar, Download } from "lucide-react";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { brl } from "@/lib/mock-data";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/relatorio-vendas")({
  head: () => ({
    meta: [
      { title: "Relatório de Vendas — OmniSafe 360" },
      { name: "description", content: "Relatório de vendas por período com receita, unidades e produtos mais vendidos." },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: RelatorioVendas,
});

// ─── Presets ────────────────────────────────────────────────────────────────

const HOJE = new Date().toISOString().slice(0, 10);

function somarDias(data: string, dias: number): string {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Hoje", de: HOJE, ate: HOJE },
  { label: "Últimos 7 dias", de: somarDias(HOJE, -6), ate: HOJE },
  { label: "Últimos 30 dias", de: somarDias(HOJE, -29), ate: HOJE },
  { label: "Este mês", de: HOJE.slice(0, 8) + "01", ate: HOJE },
  {
    label: "Mês anterior",
    de: (() => { const d = new Date(HOJE); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); })(),
    ate: (() => { const d = new Date(HOJE); d.setDate(0); return d.toISOString().slice(0, 10); })(),
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

function RelatorioVendas() {
  const est = useEstoque();
  const produtos = useProdutos();

  const [de, setDe] = useState(PRESETS[1].de);
  const [ate, setAte] = useState(PRESETS[1].ate);
  const [presetAtivo, setPresetAtivo] = useState(1);

  const produtoMap = useMemo(
    () => Object.fromEntries(produtos.map((p) => [p.id, p.nome])),
    [produtos],
  );

  // ── Filtrar vendas no período ──
  const vendas = useMemo(() => {
    const deTs = de + "T00:00";
    const ateTs = ate + "T23:59";
    return est.movs.filter(
      (m) => m.tipo === "venda" && m.data >= deTs && m.data <= ateTs,
    );
  }, [est.movs, de, ate]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const receita = vendas.reduce((s, m) => s + (m.precoUnitario ?? 0) * m.qtd, 0);
    const unidades = vendas.reduce((s, m) => s + m.qtd, 0);
    const produtosDistintos = new Set(vendas.map((m) => m.produtoId)).size;
    // Agrupar por data (minuto = agrupamento aproximado de transação)
    const porMinuto = new Map<string, number>();
    for (const m of vendas) {
      const chave = m.data;
      porMinuto.set(chave, (porMinuto.get(chave) ?? 0) + (m.precoUnitario ?? 0) * m.qtd);
    }
    const transacoes = porMinuto.size;
    return { receita, unidades, produtosDistintos, transacoes };
  }, [vendas]);

  // ── Por dia ──
  const porDia = useMemo(() => {
    const map = new Map<string, { receita: number; unidades: number }>();
    for (const m of vendas) {
      const dia = m.data.slice(0, 10);
      const atual = map.get(dia) ?? { receita: 0, unidades: 0 };
      map.set(dia, {
        receita: atual.receita + (m.precoUnitario ?? 0) * m.qtd,
        unidades: atual.unidades + m.qtd,
      });
    }
    // Gerar todos os dias no intervalo
    const dias: { dia: string; receita: number; unidades: number }[] = [];
    const cursor = new Date(de);
    const fim = new Date(ate);
    while (cursor <= fim) {
      const key = cursor.toISOString().slice(0, 10);
      const v = map.get(key) ?? { receita: 0, unidades: 0 };
      dias.push({ dia: key, ...v });
      cursor.setDate(cursor.getDate() + 1);
    }
    return dias;
  }, [vendas, de, ate]);

  const maxReceita = useMemo(
    () => Math.max(...porDia.map((d) => d.receita), 1),
    [porDia],
  );

  // ── Top produtos ──
  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; receita: number }>();
    for (const m of vendas) {
      const nome = produtoMap[m.produtoId] ?? m.produtoId;
      const atual = map.get(m.produtoId) ?? { nome, qtd: 0, receita: 0 };
      map.set(m.produtoId, {
        nome,
        qtd: atual.qtd + m.qtd,
        receita: atual.receita + (m.precoUnitario ?? 0) * m.qtd,
      });
    }
    return [...map.values()].sort((a, b) => b.receita - a.receita).slice(0, 10);
  }, [vendas, produtoMap]);

  function selecionarPreset(idx: number) {
    setPresetAtivo(idx);
    setDe(PRESETS[idx].de);
    setAte(PRESETS[idx].ate);
  }

  function exportarCSV() {
    const rows = ["Data,Unidades,Receita (R$)"];
    for (const { dia, unidades, receita } of porDia) {
      rows.push(`"${dia.split("-").reverse().join("/")}",${unidades},${receita.toFixed(2)}`);
    }
    rows.push("");
    rows.push("Produto,Unidades,Receita (R$)");
    for (const p of topProdutos) {
      rows.push(`"${p.nome.replace(/"/g, '""')}",${p.qtd},${p.receita.toFixed(2)}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-vendas-${de}-${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDia(iso: string) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  return (
    <div className="p-4 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Relatório de Vendas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Receita, unidades e produtos mais vendidos no período selecionado.</p>
        </div>
        {kpis.receita > 0 && (
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        )}
      </div>

      {/* ── Filtro de período ── */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Período</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => selecionarPreset(i)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                presetAtivo === i
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-accent border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <label className="text-xs text-muted-foreground">De</label>
            <input
              type="date"
              value={de}
              max={ate}
              onChange={(e) => { setDe(e.target.value); setPresetAtivo(-1); }}
              className="text-xs border rounded px-2 py-1 bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Até</label>
            <input
              type="date"
              value={ate}
              min={de}
              onChange={(e) => { setAte(e.target.value); setPresetAtivo(-1); }}
              className="text-xs border rounded px-2 py-1 bg-background"
            />
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp className="w-5 h-5 text-green-500" />} label="Receita total" valor={brl(kpis.receita)} destaque />
        <Kpi icon={<ShoppingBag className="w-5 h-5 text-primary" />} label="Transações" valor={String(kpis.transacoes)} />
        <Kpi icon={<Package className="w-5 h-5 text-purple-500" />} label="Unidades vendidas" valor={String(kpis.unidades)} />
        <Kpi icon={<BarChart2 className="w-5 h-5 text-orange-500" />} label="Produtos distintos" valor={String(kpis.produtosDistintos)} />
      </div>

      {/* ── Gráfico de receita por dia ── */}
      {porDia.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Receita por dia</p>
          {porDia.length <= 31 ? (
            <div className="flex items-end gap-1 h-36 overflow-x-auto pb-1">
              {porDia.map(({ dia, receita }) => {
                const pct = (receita / maxReceita) * 100;
                return (
                  <div key={dia} className="flex flex-col items-center gap-1 min-w-[28px] flex-1">
                    <span className="text-[9px] text-muted-foreground leading-none">
                      {receita > 0 ? `R$${(receita / 1000).toFixed(1)}k` : ""}
                    </span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(pct, receita > 0 ? 4 : 0)}%`,
                        background: receita > 0 ? "hsl(var(--primary, 221 83% 53%))" : "hsl(var(--muted))",
                        minHeight: receita > 0 ? "4px" : "0px",
                      }}
                    />
                    <span className="text-[9px] text-muted-foreground leading-none">{formatDia(dia)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {porDia.filter((d) => d.receita > 0).map(({ dia, receita, unidades }) => (
                <div key={dia} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted-foreground text-xs">{dia.split("-").reverse().join("/")}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-primary rounded-full" style={{ width: `${(receita / maxReceita) * 100}%` }} />
                  </div>
                  <span className="w-24 text-right text-xs font-medium">{brl(receita)}</span>
                  <span className="w-16 text-right text-xs text-muted-foreground">{unidades} un</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Top produtos ── */}
      {topProdutos.length > 0 ? (
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Top produtos por receita</p>
          <div className="space-y-2">
            {topProdutos.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm truncate">{p.nome}</span>
                    <span className="text-sm font-semibold text-green-600 shrink-0">{brl(p.receita)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <div
                        className="h-1.5 bg-primary rounded-full"
                        style={{ width: `${(p.receita / (topProdutos[0]?.receita || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{p.qtd} un</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Nenhuma venda registrada no período selecionado.
        </div>
      )}

      {/* ── Tabela diária ── */}
      {porDia.some((d) => d.receita > 0) && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b">
            <p className="text-sm font-semibold">Vendas por dia</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Unidades</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Receita</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">% do total</th>
                </tr>
              </thead>
              <tbody>
                {porDia.filter((d) => d.receita > 0).map(({ dia, unidades, receita }) => (
                  <tr key={dia} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-muted-foreground">{dia.split("-").reverse().join("/")}</td>
                    <td className="p-3 text-right">{unidades}</td>
                    <td className="p-3 text-right font-medium">{brl(receita)}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {kpis.receita > 0 ? `${((receita / kpis.receita) * 100).toFixed(1)}%` : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="p-3">Total</td>
                  <td className="p-3 text-right">{kpis.unidades}</td>
                  <td className="p-3 text-right text-green-600">{brl(kpis.receita)}</td>
                  <td className="p-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, valor, destaque }: { icon: React.ReactNode; label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${destaque ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-card"}`}>
      <div className="flex items-center gap-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-xl font-bold ${destaque ? "text-green-700 dark:text-green-400" : ""}`}>{valor}</p>
    </div>
  );
}
