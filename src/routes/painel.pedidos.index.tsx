import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SkeletonListPage } from "@/components/ui/skeleton-page";
import { useMemo, useState } from "react";
import {
  AlertTriangle, ChevronRight, Lightbulb, Package,
  Plus, Search, ShoppingCart, Sparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePedidos, criarPedido } from "@/lib/pedidos-store";
import type { PedidoStatus } from "@/lib/pedidos-store";
import { useEstoque } from "@/lib/estoque-store";
import { abaixoDoMinimo, abaixoDoMinimoDeposito, HOJE as HOJE_COMPUTED } from "@/lib/computed";
import { brl } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/pedidos/")({
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  head: () => ({
    meta: [
      { title: "Pedidos de Compra — OmniSafe 360" },
      { name: "description", content: "Pedidos de compra: acompanhe rascunhos, envios, confirmações e recebimentos." },
      { property: "og:title", content: "Pedidos de Compra — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PedidosPage,
});

const HOJE = new Date().toISOString().slice(0, 10);

const SIT: Record<PedidoStatus, { t: string; c: string }> = {
  rascunho:   { t: "Rascunho",   c: "bg-muted text-muted-foreground" },
  enviado:    { t: "Enviado",    c: "bg-primary/10 text-primary" },
  confirmado: { t: "Confirmado", c: "bg-success/12 text-success" },
  parcial:    { t: "Parcial",    c: "bg-warning/15 text-warning" },
  recebido:   { t: "Recebido",   c: "bg-success/20 text-success" },
  cancelado:  { t: "Cancelado",  c: "bg-destructive/10 text-destructive" },
};

const fmtData = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

function diasDiff(iso: string): number {
  if (!iso) return 0;
  const diff = new Date(iso).getTime() - new Date(HOJE).getTime();
  return Math.round(diff / 86_400_000);
}

function BadgeEntrega({ dataPrevista, status }: { dataPrevista: string; status: PedidoStatus }) {
  if (!dataPrevista || status === "recebido" || status === "cancelado") return null;
  const dias = diasDiff(dataPrevista);
  if (dias < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
        <AlertTriangle className="h-3 w-3" />
        {Math.abs(dias)}d atraso
      </span>
    );
  }
  if (dias === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
        hoje
      </span>
    );
  }
  if (dias <= 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
        em {dias}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      em {dias}d
    </span>
  );
}

type Aba = "todos" | "aberto" | "recebido" | "cancelado";

function PedidosPage() {
  const { pedidos } = usePedidos();
  const est = useEstoque();
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("todos");
  const [q, setQ] = useState("");
  const [criando, setCriando] = useState(false);

  // Produtos com estoque abaixo do mínimo (lógica simples, não depende de vendas)
  const abaixoMinimo = useMemo(
    () => abaixoDoMinimo(est.gondola),
    [est.gondola],
  );

  // Totais do depósito por produto (para exibir na lista e calcular qtd a pedir)
  const totaisDeposito = useMemo(() => {
    const t: Record<string, number> = {};
    for (const l of est.lotes) {
      if (l.qtd > 0) t[l.produtoId] = (t[l.produtoId] ?? 0) + l.qtd;
    }
    return t;
  }, [est.lotes]);

  // Produtos com depósito abaixo do mínimo
  const abaixoMinimoDeposito = useMemo(
    () => abaixoDoMinimoDeposito(est.lotes),
    [est.lotes],
  );

  const idsComPedidoAberto = useMemo(() => {
    const abertos = pedidos.filter((p) => !["recebido", "cancelado"].includes(p.status));
    const ids = new Set<string>();
    for (const p of abertos) for (const i of p.itens) ids.add(i.produtoId);
    return ids;
  }, [pedidos]);

  // Só mostra os que ainda não têm pedido aberto (gôndola)
  const produtosSemPedido = useMemo(
    () => abaixoMinimo.filter((p) => !idsComPedidoAberto.has(p.id)),
    [abaixoMinimo, idsComPedidoAberto],
  );

  // Só mostra os que ainda não têm pedido aberto (depósito)
  const produtosDepositoSemPedido = useMemo(
    () => abaixoMinimoDeposito.filter((p) => !idsComPedidoAberto.has(p.id)),
    [abaixoMinimoDeposito, idsComPedidoAberto],
  );

  async function criarPedidosAutomaticos() {
    if (produtosSemPedido.length === 0) return;
    setCriando(true);
    const porFornecedor: Record<string, typeof produtosSemPedido> = {};
    for (const p of produtosSemPedido) {
      const forn = p.fornecedor || "Sem fornecedor";
      (porFornecedor[forn] = porFornecedor[forn] ?? []).push(p);
    }
    const dp = new Date(HOJE_COMPUTED);
    dp.setDate(dp.getDate() + 7);
    const dataPrevista = dp.toISOString().slice(0, 10);
    let count = 0;
    for (const [fornNome, itens] of Object.entries(porFornecedor)) {
      const fornId = itens.find((p) => p.fornecedorId)?.fornecedorId;
      criarPedido({
        fornecedorId: fornId,
        fornecedorNome: fornNome === "Sem fornecedor" ? "" : fornNome,
        dataPrevista,
        observacao: "Gerado automaticamente — estoque abaixo do mínimo",
        itens: itens.map((p) => ({
          produtoId: p.id,
          qtdSolicitada: Math.max(1, p.minimo - (est.gondola[p.id] ?? 0)),
          precoUnitario: p.preco,
          unidade: "un",
        })),
      });
      count++;
    }
    setCriando(false);
    toast.success(`${count} rascunho${count !== 1 ? "s" : ""} criado${count !== 1 ? "s" : ""} automaticamente!`);
    navigate({ to: "/painel/pedidos" });
  }

  async function criarPedidosDeposito() {
    if (produtosDepositoSemPedido.length === 0) return;
    setCriando(true);
    const porFornecedor: Record<string, typeof produtosDepositoSemPedido> = {};
    for (const p of produtosDepositoSemPedido) {
      const forn = p.fornecedor || "Sem fornecedor";
      (porFornecedor[forn] = porFornecedor[forn] ?? []).push(p);
    }
    const dp = new Date(HOJE_COMPUTED);
    dp.setDate(dp.getDate() + 7);
    const dataPrevista = dp.toISOString().slice(0, 10);
    let count = 0;
    for (const [fornNome, itens] of Object.entries(porFornecedor)) {
      const fornId = itens.find((p) => p.fornecedorId)?.fornecedorId;
      criarPedido({
        fornecedorId: fornId,
        fornecedorNome: fornNome === "Sem fornecedor" ? "" : fornNome,
        dataPrevista,
        observacao: "Gerado automaticamente — depósito abaixo do mínimo",
        itens: itens.map((p) => ({
          produtoId: p.id,
          qtdSolicitada: Math.max(1, (p.minimoDeposito ?? 10) - (totaisDeposito[p.id] ?? 0)),
          precoUnitario: p.preco,
          unidade: "un",
        })),
      });
      count++;
    }
    setCriando(false);
    toast.success(`${count} rascunho${count !== 1 ? "s" : ""} de depósito criado${count !== 1 ? "s" : ""}!`);
    navigate({ to: "/painel/pedidos" });
  }

  const abertos = useMemo(
    () => pedidos.filter((p) => !["recebido", "cancelado"].includes(p.status)),
    [pedidos],
  );
  const atrasados = useMemo(
    () => abertos.filter((p) => p.dataPrevista && p.dataPrevista < HOJE),
    [abertos],
  );
  const recebidos = useMemo(() => pedidos.filter((p) => p.status === "recebido"), [pedidos]);
  const cancelados = useMemo(() => pedidos.filter((p) => p.status === "cancelado"), [pedidos]);
  const valorAberto = useMemo(() => abertos.reduce((s, p) => s + p.total, 0), [abertos]);

  const lista = useMemo(() => {
    const t = q.toLowerCase();
    let f = pedidos;
    if (aba === "aberto") f = abertos;
    if (aba === "recebido") f = recebidos;
    if (aba === "cancelado") f = cancelados;
    if (t) f = f.filter((p) => p.numero.toLowerCase().includes(t) || p.fornecedorNome.toLowerCase().includes(t));
    return f;
  }, [q, aba, pedidos, abertos, recebidos, cancelados]);

  const abas: { id: Aba; t: string; n: number }[] = [
    { id: "todos",     t: "Todos",      n: pedidos.length },
    { id: "aberto",    t: "Em aberto",  n: abertos.length },
    { id: "recebido",  t: "Recebidos",  n: recebidos.length },
    { id: "cancelado", t: "Cancelados", n: cancelados.length },
  ];

  const cabecalho = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">Pedidos de Compra</h1>
        <p className="text-muted-foreground">
          {pedidos.length === 0
            ? "Nenhum pedido cadastrado ainda"
            : `${pedidos.length} pedido${pedidos.length !== 1 ? "s" : ""} no total`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="lg">
          <Link to="/painel/pedidos/sugerir"><Lightbulb className="h-4 w-4" /> Sugerir pedido</Link>
        </Button>
        <Button asChild size="lg">
          <Link to="/painel/pedidos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link>
        </Button>
      </div>
    </div>
  );

  const alertaReposicao = produtosSemPedido.length > 0 && (
    <div className="rounded-2xl border border-warning/40 bg-warning/5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-warning">
              {produtosSemPedido.length} produto{produtosSemPedido.length !== 1 ? "s" : ""} abaixo do mínimo sem pedido aberto
            </p>
            <p className="text-sm text-muted-foreground">
              Crie os rascunhos automaticamente ou revise individualmente em "Sugerir pedido".
            </p>
          </div>
        </div>
        <Button
          onClick={criarPedidosAutomaticos}
          disabled={criando}
          className="shrink-0 bg-warning text-warning-foreground hover:bg-warning/90"
        >
          <Sparkles className="h-4 w-4" />
          {criando ? "Criando…" : "Criar pedidos automáticos"}
        </Button>
      </div>
      <div className="border-t border-warning/20 divide-y divide-warning/10 max-h-56 overflow-y-auto">
        {produtosSemPedido.slice(0, 8).map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <div className="min-w-0">
              <span className="font-medium truncate">{p.nome}</span>
              {p.fornecedor && (
                <span className="ml-2 text-xs text-muted-foreground">{p.fornecedor}</span>
              )}
            </div>
            <div className="ml-4 shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
              <span>Estoque: <strong className="text-warning">{est.gondola[p.id] ?? 0}</strong> / mín {p.minimo}</span>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning">
                pedir {Math.max(1, p.minimo - (est.gondola[p.id] ?? 0))}
              </span>
            </div>
          </div>
        ))}
        {produtosSemPedido.length > 8 && (
          <div className="px-5 py-2 text-xs text-muted-foreground">
            +{produtosSemPedido.length - 8} outros —{" "}
            <Link to="/painel/pedidos/sugerir" className="text-primary hover:underline">ver todos</Link>
          </div>
        )}
      </div>
    </div>
  );

  const alertaDeposito = produtosDepositoSemPedido.length > 0 && (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-primary">
              {produtosDepositoSemPedido.length} produto{produtosDepositoSemPedido.length !== 1 ? "s" : ""} com depósito abaixo do mínimo
            </p>
            <p className="text-sm text-muted-foreground">
              O estoque do depósito está baixo — crie rascunhos de compra automaticamente.
            </p>
          </div>
        </div>
        <Button
          onClick={criarPedidosDeposito}
          disabled={criando}
          variant="outline"
          className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
        >
          <Sparkles className="h-4 w-4" />
          {criando ? "Criando…" : "Criar pedidos (depósito)"}
        </Button>
      </div>
      <div className="border-t border-primary/15 divide-y divide-primary/10 max-h-56 overflow-y-auto">
        {produtosDepositoSemPedido.slice(0, 8).map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <div className="min-w-0">
              <span className="font-medium truncate">{p.nome}</span>
              {p.fornecedor && (
                <span className="ml-2 text-xs text-muted-foreground">{p.fornecedor}</span>
              )}
            </div>
            <div className="ml-4 shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
              <span>Depósito: <strong className="text-primary">{totaisDeposito[p.id] ?? 0}</strong> / mín {p.minimoDeposito ?? 10}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                pedir {Math.max(1, (p.minimoDeposito ?? 10) - (totaisDeposito[p.id] ?? 0))}
              </span>
            </div>
          </div>
        ))}
        {produtosDepositoSemPedido.length > 8 && (
          <div className="px-5 py-2 text-xs text-muted-foreground">
            +{produtosDepositoSemPedido.length - 8} outros —{" "}
            <Link to="/painel/pedidos/sugerir" className="text-primary hover:underline">ver todos</Link>
          </div>
        )}
      </div>
    </div>
  );

  if (pedidos.length === 0) {
    return (
      <div className="space-y-6">
        {cabecalho}
        {alertaReposicao}
        {alertaDeposito}
        {produtosSemPedido.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card py-20 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-xl font-semibold">Nenhum pedido ainda</p>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Crie o primeiro pedido de compra ou use a sugestão automática baseada no estoque.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild variant="outline" size="lg">
                <Link to="/painel/pedidos/sugerir"><Lightbulb className="h-4 w-4" /> Sugerir pedido</Link>
              </Button>
              <Button asChild size="lg">
                <Link to="/painel/pedidos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cabecalho}
      {alertaReposicao}
      {alertaDeposito}

      {/* Banner de pedidos atrasados */}
      {atrasados.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="flex-1 text-sm font-medium text-destructive">
            {atrasados.length === 1
              ? `1 pedido está atrasado — entrega prevista já passou.`
              : `${atrasados.length} pedidos estão atrasados — entregas previstas já passaram.`}
          </p>
          <button
            onClick={() => setAba("aberto")}
            className="shrink-0 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition"
          >
            Ver em aberto
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Em aberto</p>
          <p className="mt-2 font-display text-3xl font-bold">{abertos.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            pedido{abertos.length !== 1 ? "s" : ""} pendente{abertos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor em aberto</p>
          <p className="mt-2 font-display text-3xl font-bold">{brl(valorAberto)}</p>
          <p className="mt-1 text-xs text-muted-foreground">a receber em mercadorias</p>
        </div>
        <button
          onClick={() => setAba(aba === "aberto" ? "todos" : "aberto")}
          className={cn(
            "rounded-2xl border p-5 text-left transition hover:shadow-elegant",
            atrasados.length > 0
              ? "border-destructive/30 bg-destructive/5"
              : "bg-card",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Atrasados</p>
          <p className={cn("mt-2 font-display text-3xl font-bold", atrasados.length > 0 ? "text-destructive" : "")}>
            {atrasados.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {atrasados.length === 0 ? "nenhum em atraso" : `entrega${atrasados.length !== 1 ? "s" : ""} vencida${atrasados.length !== 1 ? "s" : ""}`}
          </p>
        </button>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recebidos</p>
          <p className="mt-2 font-display text-3xl font-bold">{recebidos.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">de {pedidos.length} no total</p>
        </div>
      </div>

      {/* Painel com abas e lista */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {abas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                  aba === a.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a.t}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  aba === a.id ? "bg-primary/10 text-primary" : "bg-muted",
                )}>
                  {a.n}
                </span>
              </button>
            ))}
          </div>
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por fornecedor ou número"
              className="pl-9 pr-9"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="divide-y">
          {lista.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {q
                ? `Nenhum pedido encontrado para "${q}".`
                : aba === "aberto"
                  ? "Nenhum pedido em aberto."
                  : aba === "recebido"
                    ? "Nenhum pedido recebido ainda."
                    : "Nenhum pedido cancelado."}
            </div>
          ) : (
            lista.map((p) => {
              const atrasado = p.dataPrevista && p.dataPrevista < HOJE && !["recebido", "cancelado"].includes(p.status);
              const pctRec = p.itens.length > 0
                ? Math.round((p.itens.reduce((s, i) => s + i.qtdRecebida, 0) / p.itens.reduce((s, i) => s + i.qtdSolicitada, 0)) * 100)
                : 0;
              return (
                <Link
                  key={p.id}
                  to="/painel/pedidos/$id"
                  params={{ id: p.id }}
                  className={cn(
                    "flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-muted/40",
                    atrasado && "border-l-2 border-destructive bg-destructive/[0.02]",
                  )}
                >
                  {/* Ícone / status visual */}
                  <div className={cn(
                    "hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex",
                    p.status === "recebido" ? "bg-success/15 text-success"
                      : p.status === "cancelado" ? "bg-muted text-muted-foreground"
                      : atrasado ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary",
                  )}>
                    <Package className="h-5 w-5" />
                  </div>

                  {/* Info principal */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">{p.numero}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", SIT[p.status].c)}>
                        {SIT[p.status].t}
                      </span>
                      <BadgeEntrega dataPrevista={p.dataPrevista} status={p.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {p.fornecedorNome || "Fornecedor não informado"}
                      {" · "}
                      {p.itens.length} item{p.itens.length !== 1 ? "s" : ""}
                    </p>
                    {/* Barra de progresso de recebimento */}
                    {(p.status === "parcial" || p.status === "recebido") && p.itens.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", p.status === "recebido" ? "bg-success" : "bg-warning")}
                            style={{ width: `${pctRec}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{pctRec}% recebido</span>
                      </div>
                    )}
                  </div>

                  {/* Valor e datas */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{brl(p.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtData(p.dataEmissao)}
                        {p.dataPrevista ? ` → ${fmtData(p.dataPrevista)}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Footer com total */}
        {lista.length > 0 && (
          <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-3 text-xs text-muted-foreground">
            <span>
              {lista.length} pedido{lista.length !== 1 ? "s" : ""}
              {lista.length < pedidos.length ? ` (de ${pedidos.length})` : ""}
            </span>
            <span className="font-semibold text-foreground">
              {brl(lista.reduce((s, p) => s + p.total, 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
