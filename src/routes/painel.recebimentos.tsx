import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, ChevronUp,
  EyeOff, Package, PackageCheck, Plus, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { conferirNota, emUnidades, useOperacao } from "@/lib/operacao-store";
import { useRecebeEstado } from "@/lib/recebe-store";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/recebimentos")({
  head: () => ({
    meta: [
      { title: "Recebimentos — OmniSafe 360" },
      { name: "description", content: "Controle de entradas de mercadoria: conferência de notas fiscais, pedidos e histórico." },
      { property: "og:title", content: "Recebimentos — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Recebimentos,
});

const fmtData = (iso: string) =>
  iso ? (iso.split("T")[0] ?? iso).split("-").reverse().join("/") : "—";

const fmtHora = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

type Aba = "conferencias" | "pedidos" | "historico";

const STATUS_NOTA = {
  aguardando: { label: "Aguardando conferência", cor: "bg-warning/15 text-warning" },
  conferida:  { label: "Conferida",               cor: "bg-success/12 text-success" },
  divergente: { label: "Com divergência",          cor: "bg-destructive/10 text-destructive" },
} as const;

const STATUS_PEDIDO = {
  rascunho:   { label: "Rascunho",   cor: "bg-muted text-muted-foreground" },
  enviado:    { label: "Enviado",    cor: "bg-primary/10 text-primary" },
  confirmado: { label: "Confirmado", cor: "bg-success/12 text-success" },
  parcial:    { label: "Parcial",    cor: "bg-warning/15 text-warning" },
  recebido:   { label: "Recebido",   cor: "bg-success/20 text-success" },
  cancelado:  { label: "Cancelado",  cor: "bg-muted text-muted-foreground" },
} as const;

function Recebimentos() {
  const op = useOperacao();
  const { pedidos, recebimentos } = useRecebeEstado();
  const produtos = useProdutos();

  const [aba, setAba] = useState<Aba>("conferencias");
  const [selNota, setSelNota] = useState<string | null>(null);
  const [cont, setCont] = useState<Record<string, { emb: string; un: string }>>({});
  const [q, setQ] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const nota = op.notas.find((n) => n.id === selNota);

  // ─── KPIs ────────────────────────────────────────────────────────────────

  const mesAtual = new Date().toISOString().slice(0, 7);

  const recMes = useMemo(
    () => recebimentos.filter((r) => r.data.slice(0, 7) === mesAtual),
    [recebimentos, mesAtual],
  );

  const itensMes = useMemo(
    () => recMes.reduce((t, r) => t + r.itens.reduce((s, i) => s + i.qtdUN, 0), 0),
    [recMes],
  );

  const aguardando = useMemo(
    () => op.notas.filter((n) => n.status === "aguardando").length,
    [op.notas],
  );

  const divergMes = useMemo(
    () => recMes.filter((r) => r.totalDivergencias > 0).length,
    [recMes],
  );

  const pedidosPendentes = useMemo(
    () => pedidos.filter((p) => ["enviado", "confirmado", "parcial"].includes(p.status)),
    [pedidos],
  );

  // ─── Conferência inline ───────────────────────────────────────────────────

  function abrirConferencia(id: string) {
    setSelNota((prev) => (prev === id ? null : id));
    setCont({});
  }

  function setCampo(pid: string, campo: "emb" | "un", v: string) {
    setCont((c) => ({ ...c, [pid]: { emb: c[pid]?.emb ?? "", un: c[pid]?.un ?? "", [campo]: v } }));
  }

  function finalizar() {
    if (!nota) return;
    const contado = Object.fromEntries(
      nota.itens.map((i) => [
        i.produtoId,
        emUnidades(Number(cont[i.produtoId]?.emb) || 0, i.fator, Number(cont[i.produtoId]?.un) || 0),
      ]),
    );
    const novas = conferirNota(nota.id, contado, "Painel");
    if (novas.length) {
      toast.warning(`${novas.length} item(ns) não bateram com a nota. Inconsistência registrada.`);
    } else {
      toast.success("Tudo conferido. Mercadoria entrou no depósito.");
    }
    setSelNota(null);
  }

  // ─── Histórico filtrado ───────────────────────────────────────────────────

  const histFiltrado = useMemo(() => {
    if (!q.trim()) return recebimentos;
    const t = q.toLowerCase();
    return recebimentos.filter((r) => r.fornecedor.toLowerCase().includes(t));
  }, [recebimentos, q]);

  // ─── Abas ─────────────────────────────────────────────────────────────────

  const ABAS: { id: Aba; label: string; badge?: number | undefined }[] = [
    { id: "conferencias", label: "Notas fiscais", badge: aguardando || undefined },
    { id: "pedidos",      label: "Pedidos",        badge: pedidosPendentes.length || undefined },
    { id: "historico",    label: "Histórico" },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Recebimentos</h1>
          <p className="text-muted-foreground">
            Controle de entradas de mercadoria no depósito
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/recebe/receber">
            <Plus className="h-4 w-4" /> Novo recebimento
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Este mês</p>
          <p className="font-display text-3xl font-bold">{recMes.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            recebimento{recMes.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Itens recebidos</p>
          <p className="font-display text-3xl font-bold">{itensMes}</p>
          <p className="mt-1 text-sm text-muted-foreground">unidades no mês</p>
        </div>

        <div
          className={cn(
            "rounded-2xl border p-5",
            aguardando > 0 ? "border-warning bg-warning/5" : "bg-card",
          )}
        >
          <p className="text-xs uppercase text-muted-foreground">Aguardando</p>
          <p className={cn("font-display text-3xl font-bold", aguardando > 0 && "text-warning")}>
            {aguardando}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            nota{aguardando !== 1 ? "s" : ""} para conferir
          </p>
        </div>

        <div
          className={cn(
            "rounded-2xl border p-5",
            divergMes > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card",
          )}
        >
          <p className="text-xs uppercase text-muted-foreground">Com divergência</p>
          <p className={cn("font-display text-3xl font-bold", divergMes > 0 && "text-destructive")}>
            {divergMes}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">recebimento{divergMes !== 1 ? "s" : ""} no mês</p>
        </div>
      </div>

      {/* Painel com abas */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Barra de abas */}
        <div className="flex flex-wrap gap-1 border-b p-2">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition",
                aba === a.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {a.label}
              {a.badge !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    aba === a.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-warning/20 text-warning",
                  )}
                >
                  {a.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Notas fiscais (conferência cega) ──────────────────────────────── */}
        {aba === "conferencias" && (
          <div>
            {op.notas.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground/25 mb-3" />
                <p className="text-muted-foreground">Nenhuma nota fiscal registrada.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  As notas fiscais aparecerão aqui quando chegarem ao depósito.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {op.notas.map((n) => (
                  <div key={n.id}>
                    {/* Linha da nota */}
                    <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {n.numero}
                          {n.fornecedor && <span className="font-normal text-muted-foreground"> · {n.fornecedor}</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {n.itens.length} item{n.itens.length !== 1 ? "ns" : ""} · chegou {fmtHora(n.chegada)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          STATUS_NOTA[n.status].cor,
                        )}
                      >
                        {STATUS_NOTA[n.status].label}
                      </span>
                      {n.status === "aguardando" && (
                        <Button
                          size="sm"
                          variant={selNota === n.id ? "outline" : "default"}
                          onClick={() => abrirConferencia(n.id)}
                        >
                          {selNota === n.id ? "Fechar" : "Conferir"}
                        </Button>
                      )}
                    </div>

                    {/* Formulário de conferência cega inline */}
                    {selNota === n.id && nota && (
                      <div className="border-t bg-muted/20 p-4 space-y-4">
                        <div className="flex items-center gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm font-medium text-primary">
                          <EyeOff className="h-4 w-4 shrink-0" />
                          Conferência cega — as quantidades da nota estão ocultas
                        </div>

                        <div className="space-y-3">
                          {nota.itens.map((i) => {
                            const p = produtos.find((x) => x.id === i.produtoId);
                            const total = emUnidades(
                              Number(cont[i.produtoId]?.emb) || 0,
                              i.fator,
                              Number(cont[i.produtoId]?.un) || 0,
                            );
                            const embLabel = i.embalagem
                              ? i.embalagem.split(" ")[0] + "s fechadas"
                              : "Embalagens";
                            return (
                              <div key={i.produtoId} className="rounded-xl border bg-card p-4">
                                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold">{p?.nome ?? "Produto"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {i.embalagem} · Lote {i.lote} · Val. {fmtData(i.validade)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Total contado</p>
                                    <p className="text-2xl font-bold">{total} un</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <label className="space-y-1 text-sm">
                                    <span className="text-muted-foreground">{embLabel}</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={cont[i.produtoId]?.emb ?? ""}
                                      onChange={(e) => setCampo(i.produtoId, "emb", e.target.value)}
                                      placeholder="0"
                                    />
                                  </label>
                                  <label className="space-y-1 text-sm">
                                    <span className="text-muted-foreground">Unidades soltas</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={cont[i.produtoId]?.un ?? ""}
                                      onChange={(e) => setCampo(i.produtoId, "un", e.target.value)}
                                      placeholder="0"
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <Button variant="outline" onClick={() => setSelNota(null)}>
                            Cancelar
                          </Button>
                          <Button onClick={finalizar}>
                            <PackageCheck className="h-4 w-4" /> Finalizar conferência
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Pedidos aguardando recebimento ────────────────────────────────── */}
        {aba === "pedidos" && (
          <div>
            {pedidos.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground/25 mb-3" />
                <p className="text-muted-foreground">Nenhum pedido de compra registrado.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crie pedidos em{" "}
                  <Link to="/painel/pedidos" className="text-primary hover:underline">
                    Pedidos de Compra
                  </Link>{" "}
                  para acompanhar o recebimento.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {pedidos.slice(0, 20).map((p) => {
                    const conf = STATUS_PEDIDO[p.status];
                    const qtdTotal = p.itens.reduce((t, i) => t + i.qtdSolicitada, 0);
                    const qtdRecebida = p.itens.reduce((t, i) => t + i.qtdRecebida, 0);
                    const pendente = ["enviado", "confirmado", "parcial"].includes(p.status);
                    const pct = qtdTotal > 0 ? Math.round((qtdRecebida / qtdTotal) * 100) : 0;
                    return (
                      <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {p.fornecedor || "Fornecedor não informado"}
                            </p>
                            <span className="font-mono text-xs text-muted-foreground">
                              {p.numero}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  pct === 100 ? "bg-success" : pct > 0 ? "bg-warning" : "bg-muted-foreground/30",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {qtdRecebida}/{qtdTotal} un
                              {p.dataPrevista && ` · Previsão ${fmtData(p.dataPrevista)}`}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            conf.cor,
                          )}
                        >
                          {conf.label}
                        </span>
                        {pendente && (
                          <Button asChild size="sm">
                            <Link to="/recebe/receber" search={{ pedidoId: p.id }}>
                              Receber <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t p-3 text-right">
                  <Link to="/painel/pedidos" className="text-sm text-primary hover:underline">
                    Ver todos os pedidos →
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Histórico ─────────────────────────────────────────────────────── */}
        {aba === "historico" && (
          <div>
            <div className="border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por fornecedor…"
                  className="pl-9 pr-9"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {histFiltrado.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {q
                  ? `Nenhum recebimento encontrado para "${q}".`
                  : "Nenhum recebimento registrado ainda."}
              </div>
            ) : (
              <div className="divide-y">
                {histFiltrado.map((r) => {
                  const aberto = expandido === r.id;
                  const totalUn = r.itens.reduce((t, i) => t + i.qtdUN, 0);
                  return (
                    <div key={r.id}>
                      <button
                        onClick={() => setExpandido(aberto ? null : r.id)}
                        className="flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left transition hover:bg-muted/40"
                      >
                        <div
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            r.totalDivergencias > 0 ? "bg-destructive" : "bg-success",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {r.fornecedor || "Recebimento avulso"}
                            {r.pedidoNumero && (
                              <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                                {r.pedidoNumero}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.itens.length} produto{r.itens.length !== 1 ? "s" : ""} · {totalUn} un ·{" "}
                            {r.totalDivergencias > 0
                              ? `${r.totalDivergencias} divergência${r.totalDivergencias !== 1 ? "s" : ""}`
                              : "sem divergências"}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{fmtData(r.data)}</p>
                          <p>{r.operador}</p>
                        </div>
                        {aberto ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>

                      {aberto && (
                        <div className="border-t bg-muted/20 px-4 pb-4 pt-3 space-y-2">
                          {r.itens.map((i) => {
                            const temDiv =
                              i.qtdEsperada !== undefined &&
                              Math.abs(i.qtdUN - i.qtdEsperada) > 0;
                            return (
                              <div
                                key={i.id}
                                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
                              >
                                <div
                                  className={cn(
                                    "h-2 w-2 shrink-0 rounded-full",
                                    temDiv ? "bg-destructive" : "bg-success",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{i.produtoNome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {i.qtdContada} {i.unidade}
                                    {i.fator !== 1 && ` = ${i.qtdUN} UN`}
                                    {i.lote && ` · Lote ${i.lote}`}
                                    {i.validade && ` · Val. ${fmtData(i.validade)}`}
                                  </p>
                                </div>
                                {temDiv && i.qtdEsperada !== undefined && (
                                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                                    Esp. {i.qtdEsperada} · Rec. {i.qtdUN}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {r.observacaoGeral && (
                            <p className="pt-1 text-xs italic text-muted-foreground">
                              "{r.observacaoGeral}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
