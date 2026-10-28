import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, ChevronDown, ChevronRight, Calendar, Package, TrendingDown, Hash } from "lucide-react";
import { useDevolicoes } from "@/lib/devolucoes-store";
import { brl } from "@/lib/mock-data";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/historico-fornecedor")({
  head: () => ({
    meta: [
      { title: "Histórico por Fornecedor — OmniSafe 360" },
      { name: "description", content: "Histórico de devoluções ao fornecedor agrupado por empresa." },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: HistoricoFornecedor,
});

const MOTIVO_LABEL: Record<string, string> = {
  avaria: "Avaria",
  vencido: "Vencido",
  excesso: "Excesso",
  troca: "Troca",
  outros: "Outros",
};

const HOJE = new Date().toISOString().slice(0, 10);
function somarDias(data: string, dias: number) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Últimos 30 dias", de: somarDias(HOJE, -29), ate: HOJE },
  { label: "Últimos 90 dias", de: somarDias(HOJE, -89), ate: HOJE },
  { label: "Este mês", de: HOJE.slice(0, 8) + "01", ate: HOJE },
  {
    label: "Mês anterior",
    de: (() => { const d = new Date(HOJE); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); })(),
    ate: (() => { const d = new Date(HOJE); d.setDate(0); return d.toISOString().slice(0, 10); })(),
  },
  { label: "Tudo", de: "2000-01-01", ate: HOJE },
];

function HistoricoFornecedor() {
  const devolucoes = useDevolicoes();

  const [de, setDe] = useState(PRESETS[0].de);
  const [ate, setAte] = useState(PRESETS[0].ate);
  const [presetAtivo, setPresetAtivo] = useState(0);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");

  function selecionarPreset(idx: number) {
    setPresetAtivo(idx);
    setDe(PRESETS[idx].de);
    setAte(PRESETS[idx].ate);
  }

  function toggleExpand(nome: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(nome) ? next.delete(nome) : next.add(nome);
      return next;
    });
  }

  // Filtrar devoluções ao fornecedor no período
  const devolucoesFiltradas = useMemo(() => {
    const deTs = de + "T00:00";
    const ateTs = ate + "T23:59";
    return devolucoes.filter(
      (d) =>
        d.tipo === "fornecedor" &&
        d.data >= deTs &&
        d.data <= ateTs,
    );
  }, [devolucoes, de, ate]);

  // Agrupar por fornecedor
  type GrupoFornecedor = {
    nome: string;
    totalDevolucoes: number;
    totalItens: number;
    totalValor: number;
    motivos: Record<string, number>;
    ultimaData: string;
    devolucoes: typeof devolucoesFiltradas;
  };

  const grupos = useMemo((): GrupoFornecedor[] => {
    const map = new Map<string, GrupoFornecedor>();
    for (const d of devolucoesFiltradas) {
      const nome = d.fornecedorNome?.trim() || "Fornecedor não informado";
      const atual = map.get(nome) ?? {
        nome,
        totalDevolucoes: 0,
        totalItens: 0,
        totalValor: 0,
        motivos: {},
        ultimaData: "",
        devolucoes: [],
      };
      atual.totalDevolucoes += 1;
      atual.totalItens += d.totalItens;
      atual.totalValor += d.totalValor;
      atual.motivos[d.motivo] = (atual.motivos[d.motivo] ?? 0) + 1;
      if (!atual.ultimaData || d.data > atual.ultimaData) atual.ultimaData = d.data;
      atual.devolucoes.push(d);
      map.set(nome, atual);
    }
    return [...map.values()].sort((a, b) => b.totalValor - a.totalValor);
  }, [devolucoesFiltradas]);

  const gruposFiltrados = useMemo(() => {
    if (!busca.trim()) return grupos;
    const q = busca.toLowerCase();
    return grupos.filter((g) => g.nome.toLowerCase().includes(q));
  }, [grupos, busca]);

  // KPIs globais
  const kpis = useMemo(() => ({
    fornecedores: grupos.length,
    devolucoes: devolucoesFiltradas.length,
    itens: devolucoesFiltradas.reduce((s, d) => s + d.totalItens, 0),
    valor: devolucoesFiltradas.reduce((s, d) => s + d.totalValor, 0),
  }), [grupos, devolucoesFiltradas]);

  function formatData(iso: string) {
    return iso.slice(0, 10).split("-").reverse().join("/");
  }

  const motivoMaisFrequente = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of devolucoesFiltradas) map[d.motivo] = (map[d.motivo] ?? 0) + 1;
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return entries[0] ? MOTIVO_LABEL[entries[0][0]] ?? entries[0][0] : "—";
  }, [devolucoesFiltradas]);

  return (
    <div className="p-4 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="w-6 h-6 text-orange-500" />
          Histórico por Fornecedor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Devoluções ao fornecedor agrupadas por empresa, com totais e motivos.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Período</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => selecionarPreset(i)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                presetAtivo === i
                  ? "bg-orange-600 text-white border-orange-600"
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Truck className="w-5 h-5 text-orange-500" />} label="Fornecedores" valor={String(kpis.fornecedores)} />
        <Kpi icon={<Hash className="w-5 h-5 text-blue-500" />} label="Devoluções" valor={String(kpis.devolucoes)} />
        <Kpi icon={<Package className="w-5 h-5 text-purple-500" />} label="Unidades devolvidas" valor={String(kpis.itens)} />
        <Kpi icon={<TrendingDown className="w-5 h-5 text-red-500" />} label="Valor total" valor={brl(kpis.valor)} destaque />
      </div>

      {/* Motivo mais frequente */}
      {devolucoesFiltradas.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Motivo mais frequente no período: <strong>{motivoMaisFrequente}</strong>
        </div>
      )}

      {/* Busca */}
      {grupos.length > 3 && (
        <input
          type="text"
          placeholder="Buscar fornecedor…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
        />
      )}

      {/* Lista por fornecedor */}
      {gruposFiltrados.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground text-sm">
          {devolucoesFiltradas.length === 0
            ? "Nenhuma devolução ao fornecedor no período selecionado."
            : "Nenhum fornecedor encontrado."}
        </div>
      ) : (
        <div className="space-y-2">
          {gruposFiltrados.map((g) => {
            const aberto = expandidos.has(g.nome);
            const motivoPrincipal = Object.entries(g.motivos).sort((a, b) => b[1] - a[1])[0];
            return (
              <div key={g.nome} className="bg-card border rounded-xl overflow-hidden">
                {/* Cabeçalho do fornecedor */}
                <button
                  onClick={() => toggleExpand(g.nome)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{g.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.totalDevolucoes} devolução{g.totalDevolucoes !== 1 ? "ões" : ""} · {g.totalItens} un · última em {formatData(g.ultimaData)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-2">
                    <p className="font-bold text-red-600 dark:text-red-400">{brl(g.totalValor)}</p>
                    {motivoPrincipal && (
                      <p className="text-xs text-muted-foreground">{MOTIVO_LABEL[motivoPrincipal[0]] ?? motivoPrincipal[0]}</p>
                    )}
                  </div>
                  {aberto ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Detalhe expandido */}
                {aberto && (
                  <div className="border-t">
                    {/* Resumo de motivos */}
                    <div className="px-4 py-3 bg-muted/20 flex flex-wrap gap-2">
                      {Object.entries(g.motivos).map(([mot, cnt]) => (
                        <span key={mot} className="text-xs bg-background border rounded-full px-2 py-0.5">
                          {MOTIVO_LABEL[mot] ?? mot}: {cnt}
                        </span>
                      ))}
                    </div>
                    {/* Tabela de devoluções */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-3 font-medium text-muted-foreground text-xs">Data</th>
                            <th className="text-left p-3 font-medium text-muted-foreground text-xs">Motivo</th>
                            <th className="text-right p-3 font-medium text-muted-foreground text-xs">Itens</th>
                            <th className="text-right p-3 font-medium text-muted-foreground text-xs">Unidades</th>
                            <th className="text-right p-3 font-medium text-muted-foreground text-xs">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.devolucoes.map((d) => (
                            <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="p-3 text-muted-foreground">{formatData(d.data)}</td>
                              <td className="p-3">{MOTIVO_LABEL[d.motivo] ?? d.motivo}</td>
                              <td className="p-3 text-right">{d.itens.length}</td>
                              <td className="p-3 text-right">{d.totalItens}</td>
                              <td className="p-3 text-right font-medium text-red-600 dark:text-red-400">{brl(d.totalValor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30 font-semibold text-sm">
                            <td className="p-3" colSpan={2}>Total</td>
                            <td className="p-3 text-right">{g.totalDevolucoes}</td>
                            <td className="p-3 text-right">{g.totalItens}</td>
                            <td className="p-3 text-right text-red-600 dark:text-red-400">{brl(g.totalValor)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {/* Produtos devolvidos */}
                    <ProdutosDevolvidos devolucoes={g.devolucoes} />
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

function ProdutosDevolvidos({ devolucoes }: { devolucoes: ReturnType<typeof useDevolicoes> }) {
  const produtos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    for (const d of devolucoes) {
      for (const item of d.itens) {
        const atual = map.get(item.produtoId) ?? { nome: item.produtoNome, qtd: 0, valor: 0 };
        map.set(item.produtoId, {
          nome: item.produtoNome,
          qtd: atual.qtd + item.qtd,
          valor: atual.valor + item.qtd * item.precoUnitario,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.qtd - a.qtd);
  }, [devolucoes]);

  if (produtos.length === 0) return null;

  return (
    <div className="px-4 py-3 border-t">
      <p className="text-xs font-medium text-muted-foreground mb-2">Produtos devolvidos</p>
      <div className="space-y-1">
        {produtos.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-32 truncate">{p.nome}</span>
            <div className="flex-1 bg-muted rounded-full h-1.5">
              <div
                className="h-1.5 bg-orange-400 rounded-full"
                style={{ width: `${(p.qtd / (produtos[0]?.qtd || 1)) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right">{p.qtd} un</span>
            <span className="w-20 text-right text-muted-foreground">{brl(p.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ icon, label, valor, destaque }: { icon: React.ReactNode; label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${destaque ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" : "bg-card"}`}>
      <div className="flex items-center gap-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-xl font-bold ${destaque ? "text-red-700 dark:text-red-400" : ""}`}>{valor}</p>
    </div>
  );
}
