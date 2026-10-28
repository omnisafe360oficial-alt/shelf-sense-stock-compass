import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart2, CheckCircle2, ChevronDown, ChevronRight,
  History, RotateCcw, ShieldCheck, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProdutos } from "@/lib/produtos-store";
import { useEstoque, ajustarEstoque } from "@/lib/estoque-store";
import { useAuth } from "@/lib/auth";
import { vendasPorProduto, classificarABC, calcularScoreDivergencia, type Classe, type ScoreDivergencia } from "@/lib/computed";
import { getLojaId } from "@/lib/loja-resolver";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/contagem-rotativa")({
  head: () => ({
    meta: [{ title: "Contagem Rotativa ABC — OmniSafe 360" }],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: ContagemRotativa,
});

type ItemABC = { produtoId: string; nome: string; categoria: string; qtdAtual: number; vendas30: number; classe: Classe };

const COR_CLASSE: Record<Classe, string> = {
  A: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  C: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

const DESC_CLASSE: Record<Classe, string> = {
  A: "Alta rotatividade — contar mensalmente",
  B: "Média rotatividade — contar trimestralmente",
  C: "Baixa rotatividade — contar semestralmente",
};

function ContagemRotativa() {
  const produtos = useProdutos();
  const est = useEstoque();
  const auth = useAuth();
  const [aba, setAba] = useState<"contagem" | "score">("contagem");
  const [filtroClasse, setFiltroClasse] = useState<Classe | "todas">("A");
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [contando, setContando] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreDivergencia[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  useEffect(() => {
    async function carregarScores() {
      setLoadingScores(true);
      try {
        const { data } = await supabase
          .from("contagem_rotativa")
          .select("usuario, contado, esperado")
          .eq("concluido", true);
        if (data) setScores(calcularScoreDivergencia(data));
      } finally {
        setLoadingScores(false);
      }
    }
    carregarScores();
  }, []);

  const vendasMap = vendasPorProduto(est.movs);

  const itensABC = useMemo<ItemABC[]>(() => {
    const raw = produtos.map((p) => ({ id: p.id, vendas30: vendasMap[p.id]?.un ?? 0 }));
    const classes = classificarABC(raw);
    return produtos.map((p) => {
      const dep = est.lotes.filter((l) => l.produtoId === p.id && l.qtd > 0).reduce((s, l) => s + l.qtd, 0);
      const gond = est.gondola[p.id] ?? 0;
      return {
        produtoId: p.id,
        nome: p.nome,
        categoria: p.categoria,
        qtdAtual: dep + gond,
        vendas30: vendasMap[p.id]?.un ?? 0,
        classe: classes[p.id] ?? "C",
      };
    }).sort((a, b) => b.vendas30 - a.vendas30);
  }, [produtos, est, vendasMap]);

  const contadosA = itensABC.filter((i) => i.classe === "A").length;
  const contadosB = itensABC.filter((i) => i.classe === "B").length;
  const contadosC = itensABC.filter((i) => i.classe === "C").length;

  const filtrados = itensABC.filter((item) => {
    if (filtroClasse !== "todas" && item.classe !== filtroClasse) return false;
    if (busca && !item.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  async function salvarContagem(item: ItemABC) {
    const val = Number(contando[item.produtoId]);
    if (isNaN(val) || val < 0) { toast.error("Saldo inválido."); return; }
    const lojaId = getLojaId();
    if (!lojaId) { toast.error("Loja não identificada."); return; }
    const usuario = auth.nomeProprietario ?? "Gerente";
    setSalvando(item.produtoId);
    try {
      await supabase.from("contagem_rotativa").insert({
        loja_id: lojaId,
        produto_id: item.produtoId,
        classe: item.classe,
        contado: val,
        esperado: item.qtdAtual,
        usuario,
        concluido: true,
      });
      if (val !== item.qtdAtual) {
        ajustarEstoque(
          est.lotes.find((l) => l.produtoId === item.produtoId)?.id ?? item.produtoId,
          val,
          `Contagem rotativa ${item.classe} — divergência de ${val - item.qtdAtual} un.`,
          usuario,
        );
        toast.success(`"${item.nome}" ajustado: ${item.qtdAtual} → ${val} un.`);
      } else {
        toast.success(`Contagem de "${item.nome}" confirmada sem divergências.`);
      }
      setContando((prev) => { const n = { ...prev }; delete n[item.produtoId]; return n; });
      setExpandido(null);
    } catch {
      toast.error("Erro ao salvar contagem.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" />
            Contagem Rotativa ABC
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Produtos classificados por giro — conte com frequência maior os itens de classe A.
          </p>
        </div>
        <Link to="/painel/inventario">
          <Button variant="outline" size="sm">Inventário completo</Button>
        </Link>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setAba("contagem")}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition flex items-center gap-1.5", aba === "contagem" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          <RotateCcw className="h-4 w-4" />
          Contagem ABC
        </button>
        <button
          onClick={() => setAba("score")}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition flex items-center gap-1.5", aba === "score" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          <Star className="h-4 w-4" />
          Score por Funcionário
        </button>
      </div>

      {aba === "score" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Score de Divergência por Conferência
            </CardTitle>
            <CardDescription className="text-xs">
              Acurácia de cada funcionário nas contagens rotativas registradas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingScores ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Carregando…</div>
            ) : scores.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma contagem registrada ainda. Registre contagens na aba "Contagem ABC".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">#</th>
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Funcionário</th>
                      <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Contagens</th>
                      <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Divergências</th>
                      <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Média absoluta</th>
                      <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Acurácia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((s, idx) => (
                      <tr key={s.usuario} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="py-3 px-4 font-medium">{s.usuario}</td>
                        <td className="py-3 px-4 text-center">{s.totalContagens}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn("font-semibold", s.totalDivergencias > 0 ? "text-destructive" : "text-green-600 dark:text-green-400")}>
                            {s.totalDivergencias}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{s.mediaAbsoluta.toFixed(1)} un.</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", s.taxaAcuracia >= 90 ? "bg-green-500" : s.taxaAcuracia >= 70 ? "bg-amber-500" : "bg-destructive")}
                                style={{ width: `${s.taxaAcuracia}%` }}
                              />
                            </div>
                            <span className={cn("text-xs font-bold min-w-10", s.taxaAcuracia >= 90 ? "text-green-600 dark:text-green-400" : s.taxaAcuracia >= 70 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
                              {s.taxaAcuracia.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {aba === "contagem" && <>
      {/* KPIs por classe */}
      <div className="grid grid-cols-3 gap-4">
        {(["A", "B", "C"] as Classe[]).map((cls) => (
          <Card key={cls} className={cn("cursor-pointer border-2 transition-all", filtroClasse === cls ? "border-primary" : "border-transparent")} onClick={() => setFiltroClasse(filtroClasse === cls ? "todas" : cls)}>
            <CardHeader className="pb-1 pt-4">
              <CardDescription className="flex items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", COR_CLASSE[cls])}>Classe {cls}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-3xl font-bold">{cls === "A" ? contadosA : cls === "B" ? contadosB : contadosC}</p>
              <p className="text-xs text-muted-foreground mt-1">{DESC_CLASSE[cls]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar produto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9 max-w-56"
        />
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          {(["todas", "A", "B", "C"] as const).map((cls) => (
            <button
              key={cls}
              onClick={() => setFiltroClasse(cls)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition", filtroClasse === cls ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {cls === "todas" ? "Todos" : `Classe ${cls}`}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Produtos para contagem
          </CardTitle>
          <CardDescription className="text-xs">
            {filtrados.length} produto(s) · clique para registrar a contagem
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Produto</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Classe</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Vendas 30d</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Estoque atual</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <>
                    <tr
                      key={item.produtoId}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => setExpandido(expandido === item.produtoId ? null : item.produtoId)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {expandido === item.produtoId ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <div>
                            <p className="font-medium text-sm leading-tight">{item.nome}</p>
                            <p className="text-xs text-muted-foreground">{item.categoria}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={cn("text-xs", COR_CLASSE[item.classe])}>
                          {item.classe}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-semibold">{item.vendas30}</td>
                      <td className="py-3 px-4 text-center text-sm">{item.qtdAtual} un.</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to="/painel/produtos/$id"
                          params={{ id: item.produtoId }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary hover:underline"
                        >
                          Ficha →
                        </Link>
                      </td>
                    </tr>
                    {expandido === item.produtoId && (
                      <tr key={`exp-${item.produtoId}`} className="bg-muted/20">
                        <td colSpan={5} className="px-8 py-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            Registrar contagem de "{item.nome}"
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Qtd. contada</p>
                              <Input
                                type="number"
                                min={0}
                                className="h-9 w-32"
                                placeholder={String(item.qtdAtual)}
                                value={contando[item.produtoId] ?? ""}
                                onChange={(e) => setContando((prev) => ({ ...prev, [item.produtoId]: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="pt-5">
                              {contando[item.produtoId] !== undefined && Number(contando[item.produtoId]) !== item.qtdAtual && (
                                <p className={cn("text-xs font-semibold mb-1", Number(contando[item.produtoId]) < item.qtdAtual ? "text-destructive" : "text-success")}>
                                  Divergência: {Number(contando[item.produtoId]) - item.qtdAtual > 0 ? "+" : ""}{Number(contando[item.produtoId]) - item.qtdAtual} un.
                                </p>
                              )}
                              <Button
                                size="sm"
                                disabled={!contando[item.produtoId] || salvando === item.produtoId}
                                onClick={(e) => { e.stopPropagation(); salvarContagem(item); }}
                                className="h-9"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                {salvando === item.produtoId ? "Salvando…" : "Confirmar contagem"}
                              </Button>
                            </div>
                          </div>
                          {contando[item.produtoId] === undefined && (
                            <div className="mt-3 flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                Insira a quantidade física encontrada no estoque. Se divergir do sistema, será registrado e o estoque ajustado automaticamente.
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Nenhum produto encontrado para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <BarChart2 className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
        Classe A = top 80% do faturamento · Classe B = 80–95% · Classe C = os demais.
        Baseado em vendas dos últimos 30 dias.
      </p>
      </>}
    </div>
  );
}
