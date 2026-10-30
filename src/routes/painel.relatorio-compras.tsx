import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingCart, Calendar, Package, TrendingDown, ChevronDown, ChevronRight, Download } from "lucide-react";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { brl } from "@/lib/mock-data";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/relatorio-compras")({
  head: () => ({
    meta: [
      { title: "Relatório de Compras — OmniSafe 360" },
      { name: "description", content: "Relatório de compras por fornecedor com unidades recebidas, valor estimado e histórico de entradas." },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: RelatorioCompras,
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

// ─── Types ───────────────────────────────────────────────────────────────────

type EntradaRow = {
  id: string;
  data: string;
  produtoId: string;
  produtoNome: string;
  lote?: string;
  qtd: number;
  custoUnit: number;
  totalEstimado: number;
  usuario: string;
};

type FornecedorGroup = {
  nome: string;
  recebimentos: number;
  unidades: number;
  produtosDistintos: number;
  valorEstimado: number;
  entradas: EntradaRow[];
};

// ─── Component ──────────────────────────────────────────────────────────────

function RelatorioCompras() {
  const est = useEstoque();
  const produtos = useProdutos();

  const [de, setDe] = useState(PRESETS[2].de);
  const [ate, setAte] = useState(PRESETS[2].ate);
  const [presetAtivo, setPresetAtivo] = useState(2);
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const produtoMap = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  // ── Filtrar entradas no período ──
  const entradas = useMemo(() => {
    const deTs = de + "T00:00";
    const ateTs = ate + "T23:59";
    return est.movs.filter(
      (m) => m.tipo === "entrada" && m.data >= deTs && m.data <= ateTs,
    );
  }, [est.movs, de, ate]);

  // ── Agrupar por fornecedor ──
  const grupos = useMemo(() => {
    const map = new Map<string, FornecedorGroup>();
    for (const m of entradas) {
      const fornecedor = m.origem?.trim() || "Fornecedor não informado";
      const prod = produtoMap.get(m.produtoId);
      const prodNome = prod?.nome ?? m.produtoId;
      const custoUnit = prod?.custoUltimaCompra ?? 0;
      const totalEstimado = custoUnit * m.qtd;

      const g = map.get(fornecedor) ?? {
        nome: fornecedor,
        recebimentos: 0,
        unidades: 0,
        produtosDistintos: 0,
        valorEstimado: 0,
        entradas: [],
      };
      g.recebimentos += 1;
      g.unidades += m.qtd;
      g.valorEstimado += totalEstimado;
      g.entradas.push({
        id: m.id,
        data: m.data,
        produtoId: m.produtoId,
        produtoNome: prodNome,
        lote: m.lote,
        qtd: m.qtd,
        custoUnit,
        totalEstimado,
        usuario: m.usuario,
      });
      map.set(fornecedor, g);
    }
    // Calcular produtosDistintos por grupo
    for (const [, g] of map) {
      g.produtosDistintos = new Set(g.entradas.map((e) => e.produtoId)).size;
      g.entradas.sort((a, b) => b.data.localeCompare(a.data));
    }
    return [...map.values()].sort((a, b) => b.valorEstimado - a.valorEstimado);
  }, [entradas, produtoMap]);

  // ── KPIs ──
  const kpis = useMemo(() => ({
    fornecedores: grupos.length,
    recebimentos: entradas.length,
    unidades: entradas.reduce((s, m) => s + m.qtd, 0),
    valorEstimado: grupos.reduce((s, g) => s + g.valorEstimado, 0),
  }), [grupos, entradas]);

  // ── Filtro por busca ──
  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => g.nome.toLowerCase().includes(q));
  }, [grupos, busca]);

  function selecionarPreset(idx: number) {
    setPresetAtivo(idx);
    setDe(PRESETS[idx].de);
    setAte(PRESETS[idx].ate);
  }

  function exportarCSV() {
    const rows = ["Fornecedor,Data,Produto,Lote,Qtd,Custo unit. (R$),Total est. (R$),Usuário"];
    for (const g of grupos) {
      for (const e of g.entradas) {
        rows.push(`"${g.nome.replace(/"/g, '""')}","${e.data.slice(0, 10).split("-").reverse().join("/")}","${e.produtoNome.replace(/"/g, '""')}","${e.lote || ""}",${e.qtd},${e.custoUnit.toFixed(2)},${e.totalEstimado.toFixed(2)},"${(e.usuario ?? "").replace(/"/g, '""')}"`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-compras-${de}-${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleAberto(nome: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  function formatData(iso: string) {
    return iso.slice(0, 10).split("-").reverse().join("/");
  }

  const temCusto = kpis.valorEstimado > 0;
  const maxValor = grupos[0]?.valorEstimado ?? 1;

  return (
    <div className="p-4 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-500" />
            Relatório de Compras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Entradas de estoque por fornecedor com unidades recebidas e valor estimado pelo custo cadastrado.
          </p>
        </div>
        {kpis.recebimentos > 0 && (
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
                  ? "bg-blue-600 text-white border-blue-600"
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
        <Kpi icon={<ShoppingCart className="w-5 h-5 text-blue-500" />} label="Fornecedores" valor={String(kpis.fornecedores)} />
        <Kpi icon={<Package className="w-5 h-5 text-purple-500" />} label="Recebimentos" valor={String(kpis.recebimentos)} />
        <Kpi icon={<Package className="w-5 h-5 text-orange-500" />} label="Unidades recebidas" valor={String(kpis.unidades)} />
        <Kpi
          icon={<TrendingDown className="w-5 h-5 text-blue-600" />}
          label={temCusto ? "Valor estimado" : "Valor estimado*"}
          valor={temCusto ? brl(kpis.valorEstimado) : "—"}
          destaque={temCusto}
        />
      </div>

      {!temCusto && kpis.recebimentos > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          * Cadastre o <strong>custo de última compra</strong> nos produtos para ver o valor estimado.
        </p>
      )}

      {/* ── Top fornecedores (barras) ── */}
      {grupos.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">
            {temCusto ? "Fornecedores por valor estimado" : "Fornecedores por unidades recebidas"}
          </p>
          <div className="space-y-2">
            {grupos.slice(0, 8).map((g, i) => {
              const base = temCusto ? g.valorEstimado : g.unidades;
              const max = temCusto ? maxValor : (grupos[0]?.unidades ?? 1);
              return (
                <div key={g.nome} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm truncate">{g.nome}</span>
                      <span className="text-sm font-semibold text-blue-600 shrink-0">
                        {temCusto ? brl(g.valorEstimado) : `${g.unidades} un`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 bg-blue-500 rounded-full"
                          style={{ width: `${(base / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{g.recebimentos} entradas</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Busca ── */}
      {grupos.length > 3 && (
        <div className="flex items-center gap-2 bg-muted/50 border rounded-lg px-3 py-2">
          <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      )}

      {/* ── Lista expansível por fornecedor ── */}
      {gruposFiltrados.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground text-sm">
          {grupos.length === 0
            ? "Nenhuma entrada de estoque registrada no período selecionado."
            : "Nenhum fornecedor encontrado para a busca."}
        </div>
      ) : (
        <div className="space-y-2">
          {gruposFiltrados.map((g) => {
            const aberto = abertos.has(g.nome);
            return (
              <div key={g.nome} className="bg-card border rounded-xl overflow-hidden">
                {/* Header do fornecedor */}
                <button
                  onClick={() => toggleAberto(g.nome)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  {aberto
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                  <ShoppingCart className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{g.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.recebimentos} {g.recebimentos === 1 ? "entrada" : "entradas"} · {g.unidades} un · {g.produtosDistintos} {g.produtosDistintos === 1 ? "produto" : "produtos"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {temCusto && (
                      <p className="text-sm font-semibold text-blue-600">{brl(g.valorEstimado)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Última: {formatData(g.entradas[0]?.data ?? "")}
                    </p>
                  </div>
                </button>

                {/* Detalhe expandido */}
                {aberto && (
                  <div className="border-t bg-muted/10">
                    {/* Produtos recebidos */}
                    <ProdutosRecebidos entradas={g.entradas} temCusto={temCusto} />

                    {/* Tabela de entradas individuais */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Produto</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Lote</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Qtd</th>
                            {temCusto && (
                              <>
                                <th className="text-right p-3 font-medium text-muted-foreground">Custo/un</th>
                                <th className="text-right p-3 font-medium text-muted-foreground">Total est.</th>
                              </>
                            )}
                            <th className="text-left p-3 font-medium text-muted-foreground">Usuário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.entradas.map((e) => (
                            <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="p-3 text-muted-foreground whitespace-nowrap">{formatData(e.data)}</td>
                              <td className="p-3">{e.produtoNome}</td>
                              <td className="p-3 text-muted-foreground">{e.lote || "—"}</td>
                              <td className="p-3 text-right">{e.qtd}</td>
                              {temCusto && (
                                <>
                                  <td className="p-3 text-right text-muted-foreground">
                                    {e.custoUnit > 0 ? brl(e.custoUnit) : "—"}
                                  </td>
                                  <td className="p-3 text-right font-medium">
                                    {e.totalEstimado > 0 ? brl(e.totalEstimado) : "—"}
                                  </td>
                                </>
                              )}
                              <td className="p-3 text-muted-foreground text-xs">{e.usuario}</td>
                            </tr>
                          ))}
                        </tbody>
                        {temCusto && (
                          <tfoot>
                            <tr className="bg-muted/40 font-semibold">
                              <td className="p-3" colSpan={3}>Total</td>
                              <td className="p-3 text-right">{g.unidades}</td>
                              <td className="p-3" />
                              <td className="p-3 text-right text-blue-600">{brl(g.valorEstimado)}</td>
                              <td className="p-3" />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: produtos recebidos desse fornecedor ─────────────────────

function ProdutosRecebidos({ entradas, temCusto }: { entradas: EntradaRow[]; temCusto: boolean }) {
  const porProduto = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    for (const e of entradas) {
      const atual = map.get(e.produtoId) ?? { nome: e.produtoNome, qtd: 0, valor: 0 };
      map.set(e.produtoId, { nome: atual.nome, qtd: atual.qtd + e.qtd, valor: atual.valor + e.totalEstimado });
    }
    return [...map.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  }, [entradas]);

  const maxQtd = porProduto[0]?.qtd ?? 1;

  return (
    <div className="p-4 border-b">
      <p className="text-xs font-medium text-muted-foreground mb-2">Produtos recebidos</p>
      <div className="space-y-1.5">
        {porProduto.map((p) => (
          <div key={p.nome} className="flex items-center gap-2">
            <span className="text-xs truncate w-40 shrink-0">{p.nome}</span>
            <div className="flex-1 bg-muted rounded-full h-1.5 min-w-0">
              <div
                className="h-1.5 bg-blue-400 rounded-full"
                style={{ width: `${(p.qtd / maxQtd) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{p.qtd} un</span>
            {temCusto && p.valor > 0 && (
              <span className="text-xs font-medium w-20 text-right shrink-0 text-blue-600">{brl(p.valor)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ icon, label, valor, destaque }: { icon: React.ReactNode; label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${destaque ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" : "bg-card"}`}>
      <div className="flex items-center gap-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-xl font-bold ${destaque ? "text-blue-700 dark:text-blue-400" : ""}`}>{valor}</p>
    </div>
  );
}
