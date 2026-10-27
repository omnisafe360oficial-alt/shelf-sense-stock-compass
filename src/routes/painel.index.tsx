import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight,
  BarChart2, CalendarClock, CheckCircle2, Circle, ClipboardList,
  DollarSign, Package, PackageMinus,
  RefreshCw, ShoppingCart, TrendingUp, Warehouse,
} from "lucide-react";
import { useEstoque } from "@/lib/estoque-store";
import { useOperacao } from "@/lib/operacao-store";
import { useRecebeEstado } from "@/lib/recebe-store";
import { usePedidos } from "@/lib/pedidos-store";
import { useConfig } from "@/lib/config-store";
import { useEquipe } from "@/lib/equipe-store";
import { useAuth } from "@/lib/auth";
import { useProdutos } from "@/lib/produtos-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import {
  abaixoDoMinimo, HOJE, lotesVencendo,
  vendasHoje, vendasOntem, vendasPorDia,
  vendasPorHora, vendasPorProduto,
} from "@/lib/computed";
import { useMetas } from "@/lib/metas-store";
import { brl } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/")({
  head: () => ({
    meta: [
      { title: "Início — OmniSafe 360" },
      { name: "description", content: "Resumo do dia: vendas, reposições, validades e inconsistências da sua loja." },
      { property: "og:title", content: "Início — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inicio,
});

const STATUS_PEDIDO_COR: Record<string, string> = {
  rascunho:   "bg-muted text-muted-foreground",
  enviado:    "bg-primary/10 text-primary",
  confirmado: "bg-success/12 text-success",
  parcial:    "bg-warning/15 text-warning",
  recebido:   "bg-success/20 text-success",
  cancelado:  "bg-muted text-muted-foreground",
};
const STATUS_PEDIDO_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", confirmado: "Confirmado",
  parcial: "Parcial", recebido: "Recebido", cancelado: "Cancelado",
};

const ATALHOS = [
  { label: "PDV",        desc: "Registrar venda",  href: "/painel/pdv",          icon: ShoppingCart, cor: "from-blue-500 to-blue-600"    },
  { label: "Reposição",  desc: "Repor gôndola",    href: "/painel/reposicao",    icon: RefreshCw,    cor: "from-amber-500 to-orange-500"  },
  { label: "Recebimento",desc: "Conferir entrega", href: "/painel/recebimentos", icon: Package,      cor: "from-emerald-500 to-teal-600"  },
  { label: "Estoque",    desc: "Ver posição",      href: "/painel/estoque",      icon: Warehouse,    cor: "from-violet-500 to-purple-600" },
  { label: "Pedidos",    desc: "Compras",          href: "/painel/pedidos/",     icon: ClipboardList,cor: "from-pink-500 to-rose-600"     },
  { label: "Relatórios", desc: "Análises",         href: "/painel/relatorios",   icon: BarChart2,    cor: "from-cyan-500 to-sky-600"      },
] as const;

function dataFormatada() {
  const s = new Date(HOJE + "T12:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Inicio() {
  const est       = useEstoque();
  const op        = useOperacao();
  const { recebimentos } = useRecebeEstado();
  const { pedidos }      = usePedidos();
  const config    = useConfig();
  const equipe    = useEquipe();
  const auth        = useAuth();
  const produtos    = useProdutos();
  const fornecedores = useFornecedores();
  const metas     = useMetas();

  // ── Vendas ───────────────────────────────────────────────────────────────
  const hoje    = vendasHoje(est.movs);
  const ontem   = vendasOntem(est.movs);
  const pct     = ontem > 0 ? Math.round(((hoje - ontem) / ontem) * 100) : 0;
  const transoesHoje = est.movs.filter(
    (m) => m.tipo === "venda" && m.data.startsWith(HOJE),
  ).length;
  const ticketMedio = transoesHoje > 0 ? hoje / transoesHoje : 0;

  // ── Recebimentos hoje ─────────────────────────────────────────────────────
  const recHoje = useMemo(
    () => recebimentos.filter((r) => r.data.startsWith(HOJE)),
    [recebimentos],
  );
  const itensRecHoje = useMemo(
    () => recHoje.reduce((t, r) => t + r.itens.reduce((s, i) => s + i.qtdUN, 0), 0),
    [recHoje],
  );

  // ── Estoque / alertas ─────────────────────────────────────────────────────
  const abaixo          = abaixoDoMinimo(est.gondola);
  const zerados         = abaixo.filter((p) => (est.gondola[p.id] ?? 0) === 0);
  const vencendoUrgente = lotesVencendo(est.lotes, config.avisoVencimentoUrgente);
  const vencidos        = vencendoUrgente.filter((l) => l.dias < 0);
  const validades       = lotesVencendo(est.lotes, config.avisoVencimento1);
  const inconsAbertas   = op.inconsistencias.filter((i) => i.status === "aberta");
  const notasAguardando = op.notas.filter((n) => n.status === "aguardando");
  const totalAlertas    = vencidos.length + inconsAbertas.length;

  // ── Pedidos ───────────────────────────────────────────────────────────────
  const pedidosPendentes = pedidos.filter(
    (p) => !["recebido", "cancelado"].includes(p.status),
  );

  // ── Gráficos ──────────────────────────────────────────────────────────────
  const horas      = vendasPorHora(est.movs);
  const maxHora    = Math.max(...horas, 1);
  const diasSemana = vendasPorDia(est.movs, 7);
  const maxDia     = Math.max(...diasSemana.map((d) => d.valor), 1);

  // ── Top produtos ──────────────────────────────────────────────────────────
  const vendPorProd = useMemo(() => vendasPorProduto(est.movs), [est.movs]);
  const topProdutos = useMemo(() => {
    return Object.entries(vendPorProd)
      .map(([id, v]) => ({ produto: produtos.find((p) => p.id === id), ...v }))
      .filter((x): x is typeof x & { produto: NonNullable<typeof x["produto"]> } =>
        x.produto !== undefined,
      )
      .sort((a, b) => b.un - a.un)
      .slice(0, 5);
  }, [vendPorProd, produtos]);
  const maxTopUn = Math.max(...topProdutos.map((x) => x.un), 1);

  // ── Banner de alerta crítico ───────────────────────────────────────────────
  const alerta = useMemo(() => {
    if (vencidos.length > 0)
      return {
        msg: `${vencidos.length} lote${vencidos.length !== 1 ? "s" : ""} vencido${vencidos.length !== 1 ? "s" : ""} em estoque — retire da gôndola`,
        href: "/painel/validades" as const,
        tom: "destructive" as const,
      };
    if (zerados.length > 0)
      return {
        msg: `${zerados.length} produto${zerados.length !== 1 ? "s" : ""} zerado${zerados.length !== 1 ? "s" : ""} na gôndola — precisa de reposição`,
        href: "/painel/reposicao" as const,
        tom: "destructive" as const,
      };
    if (inconsAbertas.length > 0)
      return {
        msg: `${inconsAbertas.length} inconsistência${inconsAbertas.length !== 1 ? "s" : ""} aberta${inconsAbertas.length !== 1 ? "s" : ""} aguardando análise`,
        href: "/painel/inconsistencias" as const,
        tom: "warning" as const,
      };
    if (notasAguardando.length > 0)
      return {
        msg: `${notasAguardando.length} nota${notasAguardando.length !== 1 ? "s" : ""} fiscal aguardando conferência`,
        href: "/painel/recebimentos" as const,
        tom: "warning" as const,
      };
    return null;
  }, [vencidos, zerados, inconsAbertas, notasAguardando]);

  const nome = (auth.nomeProprietario ?? equipe[0]?.nome ?? "Gestor").split(" ")[0];

  // ── Onboarding checklist ──────────────────────────────────────────────────
  const setup = {
    lojaOk:        true,
    produtosOk:    produtos.length > 0,
    fornecedoresOk: fornecedores.length > 0,
    minimosOk:     produtos.some((p) => p.minimo > 0),
  };
  const setupCompleto = Object.values(setup).every(Boolean);

  return (
    <div className="space-y-8">
      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{dataFormatada()}</p>
          <h1 className="text-3xl font-bold">{saudacao()}, {nome} 👋</h1>
        </div>
        <Link
          to="/painel/pdv"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          <ShoppingCart className="h-4 w-4" /> Abrir PDV
        </Link>
      </div>

      {/* ── Banner de alerta crítico ────────────────────────────────────────── */}
      {alerta && (
        <Link
          to={alerta.href}
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition hover:opacity-80",
            alerta.tom === "destructive"
              ? "border-destructive/40 bg-destructive/8 text-destructive"
              : "border-warning/40 bg-warning/8 text-warning",
          )}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">{alerta.msg}</span>
          <ArrowUpRight className="ml-auto h-4 w-4 shrink-0" />
        </Link>
      )}

      {/* ── Onboarding checklist ───────────────────────────────────────────── */}
      {!setupCompleto && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-base font-semibold">Configure sua loja</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Complete os passos abaixo para aproveitar o sistema por completo.
          </p>
          <div className="mt-4 space-y-1">
            {([
              { label: "Loja criada",               ok: setup.lojaOk,        href: null                   },
              { label: "Adicionar produtos",         ok: setup.produtosOk,    href: "/painel/produtos"      },
              { label: "Cadastrar fornecedores",     ok: setup.fornecedoresOk,href: "/painel/fornecedores"  },
              { label: "Configurar mínimos de estoque", ok: setup.minimosOk, href: "/painel/produtos"      },
            ] as { label: string; ok: boolean; href: string | null }[]).map(({ label, ok, href }) => (
              <div key={label} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", ok && "opacity-50")}>
                {ok
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  : <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />}
                {href && !ok ? (
                  <Link to={href} className="text-sm font-medium text-primary hover:underline">{label}</Link>
                ) : (
                  <span className={cn("text-sm font-medium", ok && "line-through text-muted-foreground")}>{label}</span>
                )}
                {!ok && !href && null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* Vendas hoje */}
        <Link
          to="/painel/movimentacoes"
          className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-elegant transition hover:border-primary/40 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendas hoje</p>
            <span className="rounded-lg bg-success/10 p-2 text-success transition group-hover:scale-110">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{brl(hoje)}</p>
          <div className="mt-1 flex items-center gap-1">
            {pct > 0
              ? <ArrowUpRight className="h-3.5 w-3.5 text-success" />
              : pct < 0
              ? <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
              : null}
            <p className={cn("text-xs", pct > 0 ? "text-success" : pct < 0 ? "text-destructive" : "text-muted-foreground")}>
              {pct >= 0 ? "+" : ""}{pct}% vs. ontem
            </p>
          </div>
        </Link>

        {/* Meta do dia / Ticket médio */}
        {metas.metaDiaria > 0 ? (
          <Link
            to="/painel/metas"
            className={cn(
              "group rounded-2xl border p-5 shadow-elegant transition hover:shadow-lg",
              hoje >= metas.metaDiaria
                ? "border-success/30 bg-success/5 hover:border-success/50"
                : "bg-card hover:border-primary/40",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Meta do dia</p>
              <span className={cn(
                "rounded-lg p-2 transition group-hover:scale-110",
                hoje >= metas.metaDiaria ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
              )}>
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <p className={cn(
              "mt-3 font-display text-3xl font-bold",
              hoje >= metas.metaDiaria && "text-success",
            )}>
              {Math.min(100, Math.round((hoje / metas.metaDiaria) * 100))}%
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  hoje >= metas.metaDiaria ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.round((hoje / metas.metaDiaria) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {brl(hoje)} de {brl(metas.metaDiaria)}
            </p>
          </Link>
        ) : (
          <div className="rounded-2xl border bg-card p-5 shadow-elegant">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ticket médio</p>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{brl(ticketMedio)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {transoesHoje} venda{transoesHoje !== 1 ? "s" : ""} hoje
            </p>
          </div>
        )}

        {/* Recebimentos */}
        <Link
          to="/painel/recebimentos"
          className="group rounded-2xl border bg-card p-5 shadow-elegant transition hover:border-primary/40 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recebimentos</p>
            <span className={cn(
              "rounded-lg p-2 transition group-hover:scale-110",
              recHoje.length > 0 ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
            )}>
              <Package className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{recHoje.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {itensRecHoje > 0 ? `${itensRecHoje} un recebidas hoje` : "nenhuma entrada hoje"}
          </p>
        </Link>

        {/* Reposição */}
        <Link
          to="/painel/reposicao"
          className={cn(
            "group rounded-2xl border p-5 shadow-elegant transition hover:shadow-lg",
            abaixo.length > 0
              ? "border-warning/30 bg-warning/5 hover:border-warning/50"
              : "bg-card hover:border-primary/40",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reposição</p>
            <span className={cn(
              "rounded-lg p-2 transition group-hover:scale-110",
              abaixo.length > 0 ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary",
            )}>
              <PackageMinus className="h-4 w-4" />
            </span>
          </div>
          <p className={cn("mt-3 font-display text-3xl font-bold", abaixo.length > 0 && "text-warning")}>
            {abaixo.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {abaixo.length === 0
              ? "tudo abastecido"
              : `${zerados.length} zerado${zerados.length !== 1 ? "s" : ""}`}
          </p>
        </Link>

        {/* Alertas */}
        <Link
          to="/painel/validades"
          className={cn(
            "group rounded-2xl border p-5 shadow-elegant transition hover:shadow-lg",
            totalAlertas > 0
              ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
              : "bg-card hover:border-primary/40",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alertas</p>
            <span className={cn(
              "rounded-lg p-2 transition group-hover:scale-110",
              totalAlertas > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
            )}>
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className={cn("mt-3 font-display text-3xl font-bold", totalAlertas > 0 && "text-destructive")}>
            {totalAlertas}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalAlertas === 0
              ? "nenhum alerta"
              : [
                  vencidos.length > 0 && `${vencidos.length} vencido${vencidos.length !== 1 ? "s" : ""}`,
                  inconsAbertas.length > 0 && `${inconsAbertas.length} incons.`,
                ].filter(Boolean).join(" · ")}
          </p>
        </Link>
      </div>

      {/* ── Atalhos rápidos ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ATALHOS.map(({ label, desc, href, icon: Icon, cor }) => (
          <Link
            key={label}
            to={href}
            className="group flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-center transition hover:border-primary/30 hover:shadow-elegant sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-4 sm:text-left"
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white transition group-hover:scale-105",
                cor,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 hidden sm:block">
              <p className="truncate text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <p className="text-xs font-semibold sm:hidden">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── Gráfico de vendas + Top produtos ────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* Barras: 7 dias + por hora */}
        <div className="rounded-2xl border bg-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Vendas — últimos 7 dias</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Total: {brl(diasSemana.reduce((s, d) => s + d.valor, 0))}
              </p>
            </div>
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-semibold",
                pct >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {pct >= 0
                ? <ArrowUpRight className="h-4 w-4" />
                : <ArrowDownRight className="h-4 w-4" />}
              {Math.abs(pct)}% hoje
            </span>
          </div>

          <div className="mt-6 flex h-44 items-end gap-2">
            {diasSemana.map((d, i) => {
              const isHoje = d.data === HOJE;
              return (
                <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-all",
                        isHoje
                          ? "bg-gradient-brand"
                          : "bg-muted-foreground/20 hover:bg-muted-foreground/35",
                      )}
                      style={{
                        height: `${Math.max(4, Math.round((d.valor / maxDia) * 152))}px`,
                      }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px]",
                      isHoje ? "font-bold text-primary" : "text-muted-foreground",
                    )}
                  >
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          {horas.some((v) => v > 0) && (
            <div className="mt-6 border-t pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hoje por hora
              </p>
              <div className="flex h-14 items-end gap-1">
                {horas.map((v, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary/40 transition hover:bg-primary/60"
                        style={{
                          height: `${Math.max(2, Math.round((v / maxHora) * 44))}px`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{8 + i}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top 5 produtos */}
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            Top produtos vendidos
          </h2>

          {topProdutos.length === 0 ? (
            <div className="mt-8 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma venda registrada ainda.
              </p>
            </div>
          ) : (
            <ul className="mt-5 space-y-4">
              {topProdutos.map(({ produto, un }, idx) => (
                <li key={produto.id}>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        idx === 0 ? "bg-yellow-400/20 text-yellow-600"
                        : idx === 1 ? "bg-slate-300/50 text-slate-500 dark:bg-slate-600/40 dark:text-slate-300"
                        : idx === 2 ? "bg-amber-700/15 text-amber-700"
                        : "bg-muted text-muted-foreground",
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {produto.nome}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{un} un</span>
                  </div>
                  <div className="mt-1.5 ml-7 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        idx === 0 ? "bg-gradient-brand" : "bg-primary/40",
                      )}
                      style={{ width: `${Math.round((un / maxTopUn) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t pt-4">
            <Link to="/painel/relatorios" className="text-xs text-primary hover:underline">
              Ver relatório completo →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Linha inferior: Reposição + Validades + Pedidos ─────────────────── */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* Reposição urgente */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <RefreshCw className="h-4 w-4 text-warning" />
              Reposição urgente
            </h2>
            {abaixo.length > 5 && (
              <Link to="/painel/reposicao" className="text-xs text-primary hover:underline">
                +{abaixo.length - 5} mais
              </Link>
            )}
          </div>

          {abaixo.length === 0 ? (
            <div className="mt-6 rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Tudo abastecido!</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Todos os produtos acima do mínimo.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y">
              {abaixo.slice(0, 5).map((p) => {
                const qtd    = est.gondola[p.id] ?? 0;
                const pctBar = Math.min(100, p.minimo > 0 ? (qtd / p.minimo) * 100 : 100);
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex justify-between text-sm">
                      <span className="min-w-0 truncate font-medium">{p.nome}</span>
                      <span
                        className={cn(
                          "ml-2 shrink-0 text-xs font-semibold",
                          qtd === 0 ? "text-destructive" : "text-warning",
                        )}
                      >
                        {qtd === 0 ? "Zerado" : "Baixo"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          qtd === 0 ? "bg-destructive" : "bg-warning",
                        )}
                        style={{ width: `${pctBar}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {qtd} na gôndola · mín. {p.minimo}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Validades próximas */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="h-4 w-4 text-destructive" />
              Validades próximas
            </h2>
            <Link to="/painel/validades" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </div>

          {validades.length === 0 ? (
            <div className="mt-6 rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Nenhum vencimento próximo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Dentro dos próximos {config.avisoVencimento1} dias.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              {validades.slice(0, 6).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.produto.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {v.lote} · {v.qtd} un
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      v.faixa === "vencido" || v.faixa === "7"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-warning/15 text-warning",
                    )}
                  >
                    {v.faixa === "vencido" ? "Vencido" : `${v.dias}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pedidos em aberto */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" />
              Pedidos em aberto
            </h2>
            <Link to="/painel/pedidos/" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </div>

          {pedidosPendentes.length === 0 ? (
            <div className="mt-6 rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Nenhum pedido pendente</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Todos os pedidos foram recebidos ou cancelados.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              {pedidosPendentes.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  to="/painel/pedidos/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold">{p.numero}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          STATUS_PEDIDO_COR[p.status],
                        )}
                      >
                        {STATUS_PEDIDO_LABEL[p.status]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.fornecedorNome || "—"} · {p.itens.length} iten{p.itens.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{brl(p.total)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
