import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarClock, ClipboardList, DollarSign, Package, PackageMinus, RefreshCw, ShoppingCart } from "lucide-react";
import { useEstoque } from "@/lib/estoque-store";
import { useOperacao } from "@/lib/operacao-store";
import { abaixoDoMinimo, HOJE, lotesVencendo, vendasHoje, vendasOntem, vendasPorDia, vendasPorHora } from "@/lib/computed";
import { brl } from "@/lib/mock-data";
import { useConfig } from "@/lib/config-store";
import { useEquipe } from "@/lib/equipe-store";
import { useAuth } from "@/lib/auth";
import { usePedidos } from "@/lib/pedidos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/")({
  head: () => ({
    meta: [
      { title: "Início — OmniSafe 360" },
      { name: "description", content: "Resumo do dia: vendas, reposições, validades e inconsistências da sua loja." },
      { property: "og:title", content: "Início — OmniSafe 360" },
      { property: "og:description", content: "Resumo do dia da sua loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inicio,
});

const tomCls: Record<string, string> = {
  primary: "bg-secondary text-primary",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
};

const STATUS_COLOR: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  parcial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  recebido: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", confirmado: "Confirmado",
  parcial: "Parcial", recebido: "Recebido", cancelado: "Cancelado",
};

function dataFormatada() {
  const s = new Date(HOJE + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Inicio() {
  const est = useEstoque();
  const op = useOperacao();
  const config = useConfig();
  const equipe = useEquipe();
  const auth = useAuth();
  const { pedidos } = usePedidos();
  const dono = equipe[0];

  const hoje = vendasHoje(est.movs);
  const ontem = vendasOntem(est.movs);
  const pct = ontem > 0 ? Math.round(((hoje - ontem) / ontem) * 100) : 0;
  const pctLabel = `${pct >= 0 ? "+" : ""}${pct}% vs. ontem`;

  const abaixo = abaixoDoMinimo(est.gondola);
  const vencendoUrgente = lotesVencendo(est.lotes, config.avisoVencimentoUrgente);
  const vencendoAmanha = vencendoUrgente.filter((l) => l.dias >= 0 && l.dias <= 1).length;
  const inconsAbertas = op.inconsistencias.filter((i) => i.status === "aberta");

  const horas = vendasPorHora(est.movs);
  const maxHora = Math.max(...horas, 1);

  const diasSemana = vendasPorDia(est.movs, 7);
  const maxDia = Math.max(...diasSemana.map((d) => d.valor), 1);

  const reposicao = abaixo.slice(0, 5);
  const validades = lotesVencendo(est.lotes, config.avisoVencimento1).slice(0, 6);

  const pedidosPendentes = pedidos.filter((p) => p.status !== "recebido" && p.status !== "cancelado");
  const totalPedidosPendentes = pedidosPendentes.reduce((s, p) => s + p.total, 0);

  const kpis = [
    {
      label: "Vendas hoje",
      valor: brl(hoje),
      extra: pctLabel,
      icon: DollarSign,
      tom: hoje > 0 ? "success" : "primary",
      href: "/painel/movimentacoes",
    },
    {
      label: "Abaixo do mínimo",
      valor: String(abaixo.length),
      extra: `${abaixo.length === 0 ? "todos ok" : abaixo.length + " aguardam reposição"}`,
      icon: PackageMinus,
      tom: abaixo.length > 0 ? "warning" : "primary",
      href: "/painel/reposicao",
    },
    {
      label: `Vencendo em ${config.avisoVencimentoUrgente}d`,
      valor: String(vencendoUrgente.length),
      extra: vencendoAmanha > 0 ? `${vencendoAmanha} vence${vencendoAmanha > 1 ? "m" : ""} amanhã` : "dentro do prazo",
      icon: CalendarClock,
      tom: vencendoUrgente.length > 0 ? "destructive" : "primary",
      href: "/painel/validades",
    },
    {
      label: "Inconsistências",
      valor: String(inconsAbertas.length),
      extra: inconsAbertas.length === 0 ? "tudo ok" : "aguardando análise",
      icon: AlertTriangle,
      tom: inconsAbertas.length > 0 ? "warning" : "primary",
      href: "/painel/inconsistencias",
    },
    {
      label: "Pedidos em aberto",
      valor: String(pedidosPendentes.length),
      extra: pedidosPendentes.length > 0 ? brl(totalPedidosPendentes) + " em aberto" : "nenhum pendente",
      icon: ClipboardList,
      tom: pedidosPendentes.length > 0 ? "warning" : "primary",
      href: "/painel/pedidos",
    },
  ];

  const atalhos = [
    { label: "PDV", desc: "Registrar venda", href: "/painel/pdv", icon: ShoppingCart, cor: "from-blue-500 to-blue-600" },
    { label: "Reposição", desc: "Repor gôndola", href: "/painel/reposicao", icon: RefreshCw, cor: "from-amber-500 to-orange-500" },
    { label: "Recebimento", desc: "Conferir entrega", href: "/painel/recebimentos", icon: Package, cor: "from-emerald-500 to-teal-600" },
    { label: "Pedidos", desc: "Compras", href: "/painel/pedidos", icon: ClipboardList, cor: "from-purple-500 to-purple-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">{dataFormatada()}</p>
        <h1 className="text-3xl font-bold">
          {saudacao()}, {(auth.nomeProprietario ?? dono?.nome ?? "Gestor").split(" ")[0]} 👋
        </h1>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({ label, valor, extra, icon: Icon, tom, href }) => (
          <Link key={label} to={href} className="group rounded-2xl border bg-card p-5 shadow-elegant transition hover:border-primary/40 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <span className={cn("rounded-lg p-2 transition group-hover:scale-110", tomCls[tom])}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{extra}</p>
          </Link>
        ))}
      </div>

      {/* Atalhos rápidos */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {atalhos.map(({ label, desc, href, icon: Icon, cor }) => (
          <Link
            key={label}
            to={href}
            className="group flex items-center gap-4 rounded-2xl border bg-card px-5 py-4 transition hover:border-primary/40 hover:shadow-elegant"
          >
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white", cor)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* Vendas da semana */}
        <div className="rounded-2xl border bg-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Vendas — últimos 7 dias</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: {brl(diasSemana.reduce((s, d) => s + d.valor, 0))}
              </p>
            </div>
            <span className={cn("flex items-center gap-1 text-sm font-semibold", pct >= 0 ? "text-success" : "text-destructive")}>
              <ArrowUpRight className={cn("h-4 w-4", pct < 0 && "rotate-180")} />
              {Math.abs(pct)}% hoje
            </span>
          </div>
          <div className="mt-6 flex h-48 items-end gap-2">
            {diasSemana.map((d, i) => {
              const isHoje = d.data === HOJE;
              return (
                <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={cn("w-full rounded-t-md transition-all", isHoje ? "bg-gradient-brand" : "bg-muted-foreground/20")}
                      style={{ height: `${Math.max(4, Math.round((d.valor / maxDia) * 160))}px` }}
                    />
                  </div>
                  <span className={cn("text-[10px]", isHoje ? "font-bold text-primary" : "text-muted-foreground")}>{d.label}</span>
                </div>
              );
            })}
          </div>

          {/* Horas de hoje */}
          {horas.some((v) => v > 0) && (
            <div className="mt-6 border-t pt-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoje por hora</p>
              <div className="flex h-16 items-end gap-1">
                {horas.map((v, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-gradient-brand opacity-70"
                        style={{ height: `${Math.max(2, Math.round((v / maxHora) * 52))}px` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{8 + i}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reposição de gôndola */}
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
          {reposicao.length === 0 ? (
            <div className="mt-6 rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Tudo abastecido!</p>
              <p className="mt-1 text-xs text-muted-foreground">Todos os produtos acima do mínimo.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y">
              {reposicao.map((p) => {
                const qtd = est.gondola[p.id] ?? 0;
                const pctBar = Math.min(100, p.minimo > 0 ? (qtd / p.minimo) * 100 : 100);
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{p.nome}</span>
                      <span className={cn("text-xs font-semibold", qtd === 0 ? "text-destructive" : "text-warning")}>
                        {qtd === 0 ? "Zerado" : "Baixo"}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", qtd === 0 ? "bg-destructive" : "bg-warning")}
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
      </div>

      {/* Linha inferior: Validades + Pedidos pendentes */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Lotes perto do vencimento */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="h-4 w-4 text-destructive" />
              Lotes perto do vencimento
            </h2>
            <Link to="/painel/validades" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {validades.length === 0 ? (
            <div className="mt-6 rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Nenhum vencimento próximo</p>
              <p className="mt-1 text-xs text-muted-foreground">Dentro dos próximos {config.avisoVencimento1} dias.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              {validades.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.produto.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">{v.lote} · {v.qtd} un</p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                    v.faixa === "vencido" || v.faixa === "7"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning/15 text-warning",
                  )}>
                    {v.faixa === "vencido" ? "Vencido" : `${v.dias}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pedidos de compra pendentes */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardList className="h-4 w-4 text-warning" />
              Pedidos de compra
            </h2>
            <Link to="/painel/pedidos" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {pedidosPendentes.length === 0 ? (
            <div className="mt-6 rounded-xl bg-success/5 px-4 py-5 text-center">
              <p className="text-sm font-medium text-success">Nenhum pedido pendente</p>
              <p className="mt-1 text-xs text-muted-foreground">Todos os pedidos foram recebidos ou cancelados.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              {pedidosPendentes.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to="/painel/pedidos/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold">{p.numero}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLOR[p.status])}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{p.fornecedorNome || "—"} · {p.itens.length} iten{p.itens.length !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {brl(p.total)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
