import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Activity, AlertTriangle, ArrowRight, Brain, CheckCircle2, ShoppingCart, ShieldAlert, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEstoque } from "@/lib/estoque-store";
import { saudeEstoque, type SaudeGrau, type DimensaoSaude } from "@/lib/computed";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/saude")({
  head: () => ({ meta: [{ title: "Saúde do Estoque — OmniSafe 360" }] }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: SaudePage,
});

// ─── Constantes visuais ───────────────────────────────────────────────────────

const GRAU_COR: Record<SaudeGrau, string> = {
  excelente: "#10b981",
  bom:       "#3b82f6",
  regular:   "#f59e0b",
  critico:   "#ef4444",
};

const GRAU_LABEL: Record<SaudeGrau, string> = {
  excelente: "Excelente",
  bom:       "Bom",
  regular:   "Regular",
  critico:   "Crítico",
};

const GRAU_BG: Record<SaudeGrau, string> = {
  excelente: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  bom:       "bg-primary/10 text-primary",
  regular:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  critico:   "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const DIM_LINKS: Record<string, { label: string; to: string; icon: typeof Brain }> = {
  Cobertura: { label: "Ver Matriz",    to: "/painel/inteligencia", icon: Brain    },
  Reposição: { label: "Sugerir Pedido",to: "/painel/pedidos/sugerir", icon: ShoppingCart },
  Giro:      { label: "Ver Relatórios",to: "/painel/relatorios",   icon: TrendingUp },
  Perdas:    { label: "Ver Prevenção", to: "/painel/antifurto",    icon: ShieldAlert },
};

// ─── SVG gauge ───────────────────────────────────────────────────────────────

const R = 54;
const C = 2 * Math.PI * R;          // ≈ 339.3
const GAP_ANGLE = 60;                // degrees of gap at the bottom
const ARC_FRACTION = (360 - GAP_ANGLE) / 360;   // fraction of circle used

function ScoreGauge({ score, grau }: { score: number; grau: SaudeGrau }) {
  const cor = GRAU_COR[grau];
  const usedArc = C * ARC_FRACTION;
  const filledArc = (score / 100) * usedArc;
  const rotation = 90 + GAP_ANGLE / 2;  // start after the gap

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 120" className="h-44 w-44 drop-shadow-md" aria-label={`Score ${score}`}>
        {/* Track */}
        <circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-muted/40"
          strokeDasharray={`${usedArc} ${C}`}
          strokeDashoffset={0}
          transform={`rotate(${rotation} 60 60)`}
          strokeLinecap="round"
        />
        {/* Fill */}
        <circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke={cor}
          strokeWidth="12"
          strokeDasharray={`${filledArc} ${C}`}
          strokeDashoffset={0}
          transform={`rotate(${rotation} 60 60)`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Score text */}
        <text
          x="60" y="56"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="26"
          fontWeight="700"
          fill={cor}
          fontFamily="system-ui, sans-serif"
        >
          {score}
        </text>
        <text
          x="60" y="72"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="currentColor"
          className="text-muted-foreground"
          fontFamily="system-ui, sans-serif"
        >
          de 100
        </text>
      </svg>
      <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", GRAU_BG[grau])}>
        {GRAU_LABEL[grau]}
      </span>
    </div>
  );
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimCard({ dim }: { dim: DimensaoSaude }) {
  const link = DIM_LINKS[dim.nome];
  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{dim.nome}</CardTitle>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", GRAU_BG[dim.status])}>
            {GRAU_LABEL[dim.status]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-2xl font-bold tabular-nums">{dim.pontos}</span>
          <span className="text-xs text-muted-foreground">/ {dim.max} pts</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(dim.pontos / dim.max) * 100}%`,
              backgroundColor: GRAU_COR[dim.status],
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{dim.detalhe}</p>
        {link && (
          <Link
            to={link.to as never}
            className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <link.icon className="h-3.5 w-3.5" />
            {link.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SaudePage() {
  const estoque = useEstoque();

  const saude = useMemo(
    () => saudeEstoque(estoque.movs, estoque.gondola, estoque.lotes),
    [estoque.movs, estoque.gondola, estoque.lotes],
  );

  const dims = Object.values(saude.dimensoes);
  const pontosMaximos = dims.reduce((s, d) => s + d.max, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Saúde do Estoque
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Índice composto calculado automaticamente a partir de 4 dimensões operacionais
        </p>
      </div>

      {/* Score + dimensões */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Score gauge */}
        <Card className="lg:col-span-2 flex flex-col items-center justify-center py-8">
          <ScoreGauge score={saude.score} grau={saude.grau} />
          <p className="mt-4 text-xs text-muted-foreground text-center px-4">
            {saude.score} de {pontosMaximos} pontos possíveis
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground">
            {([["90–100", "Excelente", "text-emerald-600"], ["75–89", "Bom", "text-primary"], ["60–74", "Regular", "text-amber-600"], ["0–59", "Crítico", "text-rose-600"]] as [string, string, string][]).map(([range, label, cls]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn("font-semibold tabular-nums", cls)}>{range}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Dimension cards */}
        <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2">
          {dims.map((d) => <DimCard key={d.nome} dim={d} />)}
        </div>
      </div>

      {/* Recomendações */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Recomendações da IA
          </CardTitle>
          <CardDescription className="text-xs">
            Ações prioritárias para melhorar o score
          </CardDescription>
        </CardHeader>
        <CardContent>
          {saude.grau === "excelente" ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm">{saude.recomendacoes[0]}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {saude.recomendacoes.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Links rápidos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Matriz de Inteligência", desc: "Ver todos os produtos", to: "/painel/inteligencia", icon: Brain },
          { label: "Sugestão de Pedido",    desc: "Reabastecer críticos",   to: "/painel/pedidos/sugerir", icon: ShoppingCart },
          { label: "Prevenção de Perdas",   desc: "Desvio inteligente",     to: "/painel/antifurto",    icon: ShieldAlert },
          { label: "Alertas Proativos",     desc: "Rupturas iminentes",     to: "/painel/alertas",      icon: AlertTriangle },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to as never}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:bg-muted/50 transition"
          >
            <link.icon className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">{link.label}</p>
              <p className="text-xs text-muted-foreground">{link.desc}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
