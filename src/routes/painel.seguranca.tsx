import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck, Star, TrendingDown, Truck, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { useConfig } from "@/lib/config-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import { usePedidos } from "@/lib/pedidos-store";
import { calcularAlertas, calcularAlertasPorFuncionario } from "@/lib/antifurto-store";
import { calcularScoreDivergencia, type ScoreDivergencia } from "@/lib/computed";
import { getLojaId } from "@/lib/loja-resolver";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/seguranca")({
  head: () => ({
    meta: [{ title: "Segurança — OmniSafe 360" }],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Seguranca,
});

const COR_SEV: Record<string, string> = {
  alto: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  médio: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  baixo: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

function scoreFornecedor(pedidos: ReturnType<typeof usePedidos>["pedidos"], fornecedorId: string) {
  const todos = pedidos.filter((p) => p.fornecedorId === fornecedorId && p.status !== "cancelado" && p.status !== "rascunho");
  if (todos.length === 0) return null;
  const recebidos = todos.filter((p) => p.status === "recebido").length;
  const parciais = todos.filter((p) => p.status === "parcial").length;
  const pendentes = todos.filter((p) => p.status === "enviado" || p.status === "confirmado");
  const atrasados = pendentes.filter((p) => p.dataPrevista && p.dataPrevista < new Date().toISOString().slice(0, 10)).length;
  const taxaEntrega = (recebidos / todos.length) * 100;
  const taxaParcial = (parciais / todos.length) * 100;
  const taxaAtraso = pendentes.length > 0 ? (atrasados / pendentes.length) * 100 : 0;
  return Math.round(Math.max(0, taxaEntrega * 0.6 - taxaParcial * 0.2 - taxaAtraso * 0.2));
}

function Seguranca() {
  const est = useEstoque();
  const produtos = useProdutos();
  const config = useConfig();
  const fornecedores = useFornecedores();
  const { pedidos } = usePedidos();

  const [scores, setScores] = useState<ScoreDivergencia[]>([]);

  useEffect(() => {
    const lojaId = getLojaId();
    if (!lojaId) return;
    supabase
      .from("contagem_rotativa")
      .select("usuario, contado, esperado")
      .eq("concluido", true)
      .eq("loja_id", lojaId)
      .then(({ data }) => { if (data) setScores(calcularScoreDivergencia(data)); });
  }, []);

  const alertasProduto = useMemo(
    () => calcularAlertas(est.movs, produtos, config.limiteAntifurtoUnidades || 2).slice(0, 5),
    [est.movs, produtos, config.limiteAntifurtoUnidades],
  );

  const alertasFuncionario = useMemo(
    () => calcularAlertasPorFuncionario(est.movs, config.limiteAntifurtoUnidades || 2).slice(0, 5),
    [est.movs, config.limiteAntifurtoUnidades],
  );

  const fornecedoresRisco = useMemo(() => {
    return fornecedores
      .map((f) => ({ ...f, score: scoreFornecedor(pedidos, f.id) }))
      .filter((f) => f.score !== null && f.score < 70)
      .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
      .slice(0, 5);
  }, [fornecedores, pedidos]);

  const scoresRisco = scores.filter((s) => s.taxaAcuracia < 90).slice(0, 5);

  const totalAlertas = alertasProduto.filter((a) => a.severidade === "alto").length
    + alertasFuncionario.filter((a) => a.severidade === "alto").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Painel de Segurança
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão consolidada de antifurto, divergências de contagem e risco de fornecedores.
          </p>
        </div>
        {totalAlertas > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{totalAlertas} alerta{totalAlertas !== 1 ? "s" : ""} de risco alto</span>
          </div>
        )}
      </div>

      {/* KPIs resumo */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Alertas de produto"
          value={alertasProduto.length}
          icon={<TrendingDown className="h-4 w-4" />}
          cor={alertasProduto.some((a) => a.severidade === "alto") ? "destructive" : alertasProduto.length > 0 ? "warning" : "ok"}
        />
        <KpiCard
          label="Funcionários em alerta"
          value={alertasFuncionario.length}
          icon={<Users className="h-4 w-4" />}
          cor={alertasFuncionario.some((a) => a.severidade === "alto") ? "destructive" : alertasFuncionario.length > 0 ? "warning" : "ok"}
        />
        <KpiCard
          label="Fornecedores de risco"
          value={fornecedoresRisco.length}
          icon={<Truck className="h-4 w-4" />}
          cor={fornecedoresRisco.length > 0 ? "warning" : "ok"}
        />
        <KpiCard
          label="Contadores abaixo de 90%"
          value={scoresRisco.length}
          icon={<RotateCcw className="h-4 w-4" />}
          cor={scoresRisco.length > 0 ? "warning" : "ok"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Alertas por produto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              Perdas por produto
            </CardTitle>
            <CardDescription className="text-xs">Ajustes negativos nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {alertasProduto.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} texto="Sem alertas no período" />
            ) : (
              <ul className="divide-y">
                {alertasProduto.map((a) => (
                  <li key={a.produtoId} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <div>
                      <Link to="/painel/produtos/$id" params={{ id: a.produtoId }} className="text-sm font-medium hover:underline">
                        {a.produtoNome}
                      </Link>
                      <p className="text-xs text-muted-foreground">{a.ocorrencias} ocorrência{a.ocorrencias !== 1 ? "s" : ""} · {a.perdaAcumulada} un. perdidas</p>
                    </div>
                    <Badge className={cn("text-xs shrink-0", COR_SEV[a.severidade])}>{a.severidade}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-2 border-t">
              <Link to="/painel/antifurto" className="text-xs text-primary hover:underline">Ver todos os alertas →</Link>
            </div>
          </CardContent>
        </Card>

        {/* Alertas por funcionário */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-rose-500" />
              Perdas por funcionário
            </CardTitle>
            <CardDescription className="text-xs">Funcionários com ajustes negativos recentes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {alertasFuncionario.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} texto="Sem alertas por funcionário" />
            ) : (
              <ul className="divide-y">
                {alertasFuncionario.map((a) => (
                  <li key={a.funcionario} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{a.funcionario}</p>
                      <p className="text-xs text-muted-foreground">{a.ocorrencias} ajuste{a.ocorrencias !== 1 ? "s" : ""} · {a.produtosAfetados} produto{a.produtosAfetados !== 1 ? "s" : ""} · {a.perdaAcumulada} un. perdidas</p>
                    </div>
                    <Badge className={cn("text-xs shrink-0", COR_SEV[a.severidade])}>{a.severidade}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-2 border-t">
              <Link to="/painel/antifurto" className="text-xs text-primary hover:underline">Ver detalhes →</Link>
            </div>
          </CardContent>
        </Card>

        {/* Fornecedores de risco */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-500" />
              Fornecedores de risco
            </CardTitle>
            <CardDescription className="text-xs">Score de qualidade abaixo de 70</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {fornecedoresRisco.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} texto="Nenhum fornecedor de risco" />
            ) : (
              <ul className="divide-y">
                {fornecedoresRisco.map((f) => (
                  <li key={f.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <Link to="/painel/fornecedores/$id" params={{ id: f.id }} className="text-sm font-medium hover:underline truncate block">
                        {f.nome}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", (f.score ?? 0) >= 40 ? "bg-amber-400" : "bg-destructive")}
                            style={{ width: `${f.score ?? 0}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-bold", (f.score ?? 0) >= 40 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
                          {f.score}/100
                        </span>
                      </div>
                    </div>
                    <Badge className="text-xs shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {(f.score ?? 0) >= 40 ? "Regular" : "Crítico"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-2 border-t">
              <Link to="/painel/fornecedores" className="text-xs text-primary hover:underline">Ver fornecedores →</Link>
            </div>
          </CardContent>
        </Card>

        {/* Score de contagem */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Acurácia de contagem
            </CardTitle>
            <CardDescription className="text-xs">Funcionários com acurácia abaixo de 90%</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {scores.length === 0 ? (
              <EmptyState icon={<RotateCcw className="h-6 w-6" />} texto="Nenhuma contagem registrada" />
            ) : scoresRisco.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} texto="Todos acima de 90% de acurácia" />
            ) : (
              <ul className="divide-y">
                {scoresRisco.map((s) => (
                  <li key={s.usuario} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{s.usuario}</p>
                      <p className="text-xs text-muted-foreground">{s.totalContagens} contagens · {s.totalDivergencias} divergências · média {s.mediaAbsoluta.toFixed(1)} un.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", s.taxaAcuracia >= 70 ? "bg-amber-400" : "bg-destructive")}
                          style={{ width: `${s.taxaAcuracia}%` }}
                        />
                      </div>
                      <span className={cn("text-xs font-bold w-10 text-right", s.taxaAcuracia >= 70 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
                        {s.taxaAcuracia.toFixed(0)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-2 border-t">
              <Link to="/painel/contagem-rotativa" className="text-xs text-primary hover:underline">Ver score completo →</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, cor }: { label: string; value: number; icon: React.ReactNode; cor: "ok" | "warning" | "destructive" }) {
  const corMap = {
    ok: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    destructive: "text-destructive",
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className={cn("flex items-center gap-2 mb-1", corMap[cor])}>
          {icon}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className={cn("text-3xl font-bold", corMap[cor])}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
      <div className="opacity-40">{icon}</div>
      <p className="text-xs">{texto}</p>
    </div>
  );
}
