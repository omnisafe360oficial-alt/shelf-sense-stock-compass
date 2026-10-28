import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Layers, TrendingUp, ShoppingCart, ArrowLeftRight, BarChart3,
  Truck, Package, AlertTriangle, CalendarClock, ExternalLink,
  TrendingDown, BarChart2,
} from "lucide-react";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { useDevolicoes } from "@/lib/devolucoes-store";
import { brl } from "@/lib/mock-data";
import { abaixoDoMinimo, lotesVencendo, HOJE, faturamentoMes } from "@/lib/computed";

export const Route = createFileRoute("/painel/resumo-relatorios")({
  head: () => ({
    meta: [
      { title: "Resumo de Relatórios — OmniSafe 360" },
      { name: "description", content: "Painel central com resumo de vendas, compras, devoluções e alertas de estoque." },
    ],
  }),
  component: ResumoRelatorios,
});

// ─── Presets ────────────────────────────────────────────────────────────────

type Preset = { label: string; de: string; ate: string };

function buildPresets(): Preset[] {
  const hoje = HOJE;
  const somarDias = (d: string, n: number) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const primeiroDiaMes = hoje.slice(0, 8) + "01";
  const primeiroDiaMesAnterior = (() => { const d = new Date(hoje); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); })();
  const ultimoDiaMesAnterior = (() => { const d = new Date(hoje); d.setDate(0); return d.toISOString().slice(0, 10); })();

  return [
    { label: "Este mês", de: primeiroDiaMes, ate: hoje },
    { label: "Mês anterior", de: primeiroDiaMesAnterior, ate: ultimoDiaMesAnterior },
    { label: "Últimos 30 dias", de: somarDias(hoje, -29), ate: hoje },
    { label: "Últimos 90 dias", de: somarDias(hoje, -89), ate: hoje },
  ];
}

const PRESETS = buildPresets();

// ─── Component ──────────────────────────────────────────────────────────────

function ResumoRelatorios() {
  const est = useEstoque();
  const produtos = useProdutos();
  const devolicoes = useDevolicoes();

  const [presetIdx, setPresetIdx] = useState(0);
  const { de, ate } = PRESETS[presetIdx];

  // ── Vendas no período ──
  const vendas = useMemo(() => {
    const deTs = de + "T00:00";
    const ateTs = ate + "T23:59";
    return est.movs.filter((m) => m.tipo === "venda" && m.data >= deTs && m.data <= ateTs);
  }, [est.movs, de, ate]);

  const kpiVendas = useMemo(() => {
    const receita = vendas.reduce((s, m) => s + (m.precoUnitario ?? 0) * m.qtd, 0);
    const unidades = vendas.reduce((s, m) => s + m.qtd, 0);
    const produtosDistintos = new Set(vendas.map((m) => m.produtoId)).size;
    // top produto
    const porProduto = new Map<string, number>();
    for (const m of vendas) porProduto.set(m.produtoId, (porProduto.get(m.produtoId) ?? 0) + (m.precoUnitario ?? 0) * m.qtd);
    let topProdId = "", topProdVal = 0;
    for (const [id, val] of porProduto) { if (val > topProdVal) { topProdId = id; topProdVal = val; } }
    const topProd = produtos.find((p) => p.id === topProdId)?.nome ?? "—";
    return { receita, unidades, produtosDistintos, topProd, topProdVal };
  }, [vendas, produtos]);

  // Variação em relação ao período anterior
  const varVendas = useMemo(() => {
    const duracao = (new Date(ate).getTime() - new Date(de).getTime()) / 86_400_000 + 1;
    const antDe = new Date(de); antDe.setDate(antDe.getDate() - duracao);
    const antAte = new Date(de); antAte.setDate(antAte.getDate() - 1);
    const antDeStr = antDe.toISOString().slice(0, 10) + "T00:00";
    const antAteStr = antAte.toISOString().slice(0, 10) + "T23:59";
    const ant = est.movs
      .filter((m) => m.tipo === "venda" && m.data >= antDeStr && m.data <= antAteStr)
      .reduce((s, m) => s + (m.precoUnitario ?? 0) * m.qtd, 0);
    return ant > 0 ? ((kpiVendas.receita - ant) / ant) * 100 : null;
  }, [est.movs, de, ate, kpiVendas.receita]);

  // ── Compras no período ──
  const entradas = useMemo(() => {
    const deTs = de + "T00:00";
    const ateTs = ate + "T23:59";
    return est.movs.filter((m) => m.tipo === "entrada" && m.data >= deTs && m.data <= ateTs);
  }, [est.movs, de, ate]);

  const kpiCompras = useMemo(() => {
    const unidades = entradas.reduce((s, m) => s + m.qtd, 0);
    const fornecedores = new Set(entradas.map((m) => m.origem?.trim() || "?")).size;
    const porForn = new Map<string, number>();
    for (const m of entradas) {
      const f = m.origem?.trim() || "Não informado";
      const prod = produtos.find((p) => p.id === m.produtoId);
      porForn.set(f, (porForn.get(f) ?? 0) + (prod?.custoUltimaCompra ?? 0) * m.qtd);
    }
    const valorEstimado = [...porForn.values()].reduce((s, v) => s + v, 0);
    let topForn = "", topFornVal = 0;
    for (const [f, v] of porForn) { if (v > topFornVal) { topForn = f; topFornVal = v; } }
    if (!topForn && entradas.length > 0) {
      const porFornQtd = new Map<string, number>();
      for (const m of entradas) {
        const f = m.origem?.trim() || "Não informado";
        porFornQtd.set(f, (porFornQtd.get(f) ?? 0) + m.qtd);
      }
      for (const [f, v] of porFornQtd) { if (v > topFornVal) { topForn = f; topFornVal = v; } }
    }
    return { unidades, fornecedores, valorEstimado, topForn, recebimentos: entradas.length };
  }, [entradas, produtos]);

  // ── Devoluções no período ──
  const devolucoesPeriodo = useMemo(() => {
    return devolicoes.filter((d) => d.data.slice(0, 10) >= de && d.data.slice(0, 10) <= ate);
  }, [devolicoes, de, ate]);

  const kpiDevolucoes = useMemo(() => {
    const clientes = devolucoesPeriodo.filter((d) => d.tipo === "cliente");
    const fornecedor = devolucoesPeriodo.filter((d) => d.tipo === "fornecedor");
    return {
      totalClientes: clientes.length,
      valorClientes: clientes.reduce((s, d) => s + d.totalValor, 0),
      totalFornecedor: fornecedor.length,
      valorFornecedor: fornecedor.reduce((s, d) => s + d.totalValor, 0),
      topMotivoForn: (() => {
        const cnt = new Map<string, number>();
        for (const d of fornecedor) cnt.set(d.motivo, (cnt.get(d.motivo) ?? 0) + 1);
        let top = "", topN = 0;
        for (const [m, n] of cnt) { if (n > topN) { top = m; topN = n; } }
        return top;
      })(),
    };
  }, [devolucoesPeriodo]);

  // ── Alertas de estoque ──
  const alertas = useMemo(() => {
    const baixos = abaixoDoMinimo(est.gondola);
    const vencendo = lotesVencendo(est.lotes, 15);
    return { baixos, vencendo };
  }, [est.gondola, est.lotes]);

  // ── Faturamento comparativo (para o card de vendas) ──
  const fatMesAtual = useMemo(() => faturamentoMes(est.movs, HOJE.slice(0, 7)), [est.movs]);
  const fatMesAnterior = useMemo(() => {
    const d = new Date(HOJE); d.setMonth(d.getMonth() - 1);
    return faturamentoMes(est.movs, d.toISOString().slice(0, 7));
  }, [est.movs]);

  const MOTIVO_LABEL: Record<string, string> = { avaria: "Avaria", vencido: "Vencido", excesso: "Excesso", troca: "Troca", outros: "Outros" };

  return (
    <div className="p-4 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="w-6 h-6 text-indigo-500" />
          Resumo de Relatórios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada de vendas, compras, devoluções e estoque no período selecionado.
        </p>
      </div>

      {/* Seletor de período */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => setPresetIdx(i)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              presetIdx === i
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-muted hover:bg-accent border-transparent"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-1">
          {de.split("-").reverse().join("/")} – {ate.split("-").reverse().join("/")}
        </span>
      </div>

      {/* Grade de cartões de relatório */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Card: Vendas ── */}
        <ReportCard
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          title="Vendas"
          color="green"
          to="/painel/relatorio-vendas"
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Receita" value={brl(kpiVendas.receita)} highlight="green" />
            <Stat label="Unidades" value={String(kpiVendas.unidades)} />
            <Stat label="Produtos distintos" value={String(kpiVendas.produtosDistintos)} />
            <Stat
              label="vs. período ant."
              value={varVendas !== null ? `${varVendas >= 0 ? "+" : ""}${varVendas.toFixed(1)}%` : "—"}
              highlight={varVendas !== null ? (varVendas >= 0 ? "green" : "red") : undefined}
            />
          </div>
          {kpiVendas.topProd !== "—" && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">Top produto</p>
              <p className="text-sm font-medium truncate">{kpiVendas.topProd}</p>
              <p className="text-xs text-green-600 font-semibold">{brl(kpiVendas.topProdVal)}</p>
            </div>
          )}
          <MiniComparativo
            label1={`${new Date(HOJE.slice(0,7)+"-01T12:00").toLocaleDateString("pt-BR",{month:"short"})}.`}
            val1={fatMesAtual}
            label2={`${new Date(new Date(HOJE).setMonth(new Date(HOJE).getMonth()-1)).toLocaleDateString("pt-BR",{month:"short"})}.`}
            val2={fatMesAnterior}
          />
        </ReportCard>

        {/* ── Card: Compras ── */}
        <ReportCard
          icon={<ShoppingCart className="w-5 h-5 text-blue-500" />}
          title="Compras por Fornecedor"
          color="blue"
          to="/painel/relatorio-compras"
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Recebimentos" value={String(kpiCompras.recebimentos)} />
            <Stat label="Unidades recebidas" value={String(kpiCompras.unidades)} />
            <Stat label="Fornecedores" value={String(kpiCompras.fornecedores)} />
            <Stat
              label="Valor estimado"
              value={kpiCompras.valorEstimado > 0 ? brl(kpiCompras.valorEstimado) : "—"}
              highlight={kpiCompras.valorEstimado > 0 ? "blue" : undefined}
            />
          </div>
          {kpiCompras.topForn && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">Principal fornecedor</p>
              <p className="text-sm font-medium truncate">{kpiCompras.topForn}</p>
            </div>
          )}
        </ReportCard>

        {/* ── Card: Devoluções de clientes ── */}
        <ReportCard
          icon={<ArrowLeftRight className="w-5 h-5 text-orange-500" />}
          title="Devoluções de Clientes"
          color="orange"
          to="/painel/devolucoes"
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Devoluções" value={String(kpiDevolucoes.totalClientes)} />
            <Stat
              label="Valor total"
              value={kpiDevolucoes.valorClientes > 0 ? brl(kpiDevolucoes.valorClientes) : "—"}
              highlight={kpiDevolucoes.valorClientes > 0 ? "orange" : undefined}
            />
          </div>
          {kpiDevolucoes.totalClientes === 0 && (
            <p className="text-xs text-muted-foreground mt-2">Nenhuma devolução de cliente no período.</p>
          )}
        </ReportCard>

        {/* ── Card: Devoluções ao fornecedor ── */}
        <ReportCard
          icon={<Truck className="w-5 h-5 text-red-500" />}
          title="Devoluções ao Fornecedor"
          color="red"
          to="/painel/historico-fornecedor"
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Devoluções" value={String(kpiDevolucoes.totalFornecedor)} />
            <Stat
              label="Valor total"
              value={kpiDevolucoes.valorFornecedor > 0 ? brl(kpiDevolucoes.valorFornecedor) : "—"}
              highlight={kpiDevolucoes.valorFornecedor > 0 ? "red" : undefined}
            />
          </div>
          {kpiDevolucoes.topMotivoForn && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">Motivo mais frequente</p>
              <span className="inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
                {MOTIVO_LABEL[kpiDevolucoes.topMotivoForn] ?? kpiDevolucoes.topMotivoForn}
              </span>
            </div>
          )}
          {kpiDevolucoes.totalFornecedor === 0 && (
            <p className="text-xs text-muted-foreground mt-2">Nenhuma devolução ao fornecedor no período.</p>
          )}
        </ReportCard>

      </div>

      {/* ── Seção de alertas de estoque ── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alertas de estoque
          </p>
          <Link
            to="/painel/relatorios"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Relatórios analíticos <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
          {/* Abaixo do mínimo */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-500" />
                Abaixo do mínimo
              </p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                alertas.baixos.length > 0
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              }`}>
                {alertas.baixos.length}
              </span>
            </div>
            {alertas.baixos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todos os produtos acima do mínimo.</p>
            ) : (
              <div className="space-y-1">
                {alertas.baixos.slice(0, 4).map((p) => (
                  <Link
                    key={p.id}
                    to="/painel/produtos/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between text-xs hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                  >
                    <span className="truncate text-muted-foreground">{p.nome}</span>
                    <span className="shrink-0 ml-2 text-amber-600 font-medium">{p.gondola} un</span>
                  </Link>
                ))}
                {alertas.baixos.length > 4 && (
                  <p className="text-xs text-muted-foreground pl-1">+{alertas.baixos.length - 4} outros</p>
                )}
              </div>
            )}
          </div>

          {/* Lotes vencendo */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-red-500" />
                Lotes vencendo em 15 dias
              </p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                alertas.vencendo.length > 0
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              }`}>
                {alertas.vencendo.length}
              </span>
            </div>
            {alertas.vencendo.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum lote vencendo nos próximos 15 dias.</p>
            ) : (
              <div className="space-y-1">
                {alertas.vencendo.slice(0, 4).map((l) => (
                  <Link
                    key={l.id}
                    to="/painel/produtos/$id"
                    params={{ id: l.produto.id }}
                    className="flex items-center justify-between text-xs hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                  >
                    <span className="truncate text-muted-foreground">{l.produto.nome}</span>
                    <span className={`shrink-0 ml-2 font-medium ${l.dias <= 3 ? "text-red-600" : "text-orange-500"}`}>
                      {l.dias <= 0 ? "vencido" : `${l.dias}d`}
                    </span>
                  </Link>
                ))}
                {alertas.vencendo.length > 4 && (
                  <p className="text-xs text-muted-foreground pl-1">+{alertas.vencendo.length - 4} outros</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Links rápidos para todos os relatórios ── */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Acesso rápido</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Produtos", to: "/painel/produtos", icon: <Package className="w-3.5 h-3.5" /> },
            { label: "Relatórios analíticos", to: "/painel/relatorios", icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { label: "Rel. Vendas", to: "/painel/relatorio-vendas", icon: <BarChart2 className="w-3.5 h-3.5" /> },
            { label: "Rel. Compras", to: "/painel/relatorio-compras", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
            { label: "Hist. Fornecedor", to: "/painel/historico-fornecedor", icon: <Truck className="w-3.5 h-3.5" /> },
            { label: "Devoluções", to: "/painel/devolucoes", icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
          ].map(({ label, to, icon }) => (
            <Link
              key={to}
              to={to as any}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-card hover:bg-muted transition-colors"
            >
              {icon}
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

type Color = "green" | "blue" | "orange" | "red";

const colorBorder: Record<Color, string> = {
  green: "border-l-green-500",
  blue: "border-l-blue-500",
  orange: "border-l-orange-500",
  red: "border-l-red-500",
};

function ReportCard({
  icon, title, color, to, children,
}: {
  icon: React.ReactNode;
  title: string;
  color: Color;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-card border border-l-4 ${colorBorder[color]} rounded-xl p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold flex items-center gap-2">{icon}{title}</p>
        <Link
          to={to as any}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Ver completo <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

const statHighlight: Record<string, string> = {
  green: "text-green-700 dark:text-green-400",
  blue: "text-blue-700 dark:text-blue-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
};

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: Color }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-bold ${highlight ? statHighlight[highlight] : ""}`}>{value}</p>
    </div>
  );
}

function MiniComparativo({ label1, val1, label2, val2 }: { label1: string; val1: number; label2: string; val2: number }) {
  const max = Math.max(val1, val2, 1);
  return (
    <div className="mt-3 pt-3 border-t space-y-1.5">
      <p className="text-xs text-muted-foreground">Comparativo mensal</p>
      {[{ label: label1, val: val1, primary: true }, { label: label2, val: val2, primary: false }].map(({ label, val, primary }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-8 shrink-0">{label}</span>
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${primary ? "bg-green-500" : "bg-muted-foreground/40"}`}
              style={{ width: `${(val / max) * 100}%` }}
            />
          </div>
          <span className={`text-xs w-20 text-right shrink-0 ${primary ? "font-semibold text-green-600" : "text-muted-foreground"}`}>
            {brl(val)}
          </span>
        </div>
      ))}
    </div>
  );
}
