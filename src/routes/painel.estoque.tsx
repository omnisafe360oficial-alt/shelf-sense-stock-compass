import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRightLeft, BellRing, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TransferirDialog } from "@/components/estoque/TransferirDialog";
import { useEstoque, diasAte, exibirValidade, faixaValidade, type Faixa } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — OmniSafe 360" },
      { name: "description", content: "Visão consolidada do estoque: posição por produto, gôndola, validades e movimentações." },
      { property: "og:title", content: "Estoque — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Estoque,
});

const fmtData = (iso: string) => (iso.split("T")[0] ?? iso).split("-").reverse().join("/");

type Aba = "posicao" | "gondola" | "validades" | "movs";

const FAIXAS = {
  vencido: { label: "Vencidos",    cor: "bg-destructive/10 text-destructive" },
  "7":     { label: "Até 7 dias",  cor: "bg-warning/15 text-warning" },
  "15":    { label: "8–15 dias",   cor: "bg-warning/10 text-warning" },
  "30":    { label: "16–30 dias",  cor: "bg-primary/10 text-primary" },
} as const;

const TIPOS_MOV = {
  entrada:       { label: "Entrada",        cor: "bg-success/12 text-success" },
  transferencia: { label: "Transferência",  cor: "bg-primary/10 text-primary" },
  venda:         { label: "Venda",          cor: "bg-muted text-muted-foreground" },
  ajuste:        { label: "Ajuste",         cor: "bg-warning/15 text-warning" },
} as const;

function Estoque() {
  const s = useEstoque();
  const produtos = useProdutos();
  const [aba, setAba] = useState<Aba>("posicao");
  const [transf, setTransf] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroFaixa, setFiltroFaixa] = useState<keyof typeof FAIXAS | "todos">("todos");
  const [filtroGondola, setFiltroGondola] = useState<"todos" | "repor">("todos");

  // ─── KPIs ────────────────────────────────────────────────────────────────

  const totalDeposito = useMemo(
    () => s.lotes.reduce((t, l) => t + l.qtd, 0),
    [s.lotes],
  );

  const totalGondola = useMemo(
    () => Object.values(s.gondola).reduce((t, v) => t + v, 0),
    [s.gondola],
  );

  const qtdAbaixoMinimo = useMemo(
    () => produtos.filter((p) => (s.gondola[p.id] ?? 0) <= p.minimo).length,
    [produtos, s.gondola],
  );

  const lotesAlerta = useMemo(
    () => s.lotes.filter((l) => l.qtd > 0 && faixaValidade(diasAte(l.validade)) !== "ok"),
    [s.lotes],
  );

  // ─── Tab: Posição por produto ─────────────────────────────────────────────

  const itensPosicao = useMemo(() => {
    const t = busca.toLowerCase();
    return produtos
      .map((p) => {
        const deposito = s.lotes
          .filter((l) => l.produtoId === p.id)
          .reduce((acc, l) => acc + l.qtd, 0);
        const gondola = s.gondola[p.id] ?? 0;
        const abaixo  = gondola <= p.minimo;
        return { p, deposito, gondola, total: deposito + gondola, abaixo };
      })
      .filter((i) => !t || i.p.nome.toLowerCase().includes(t) || i.p.codigo.includes(t));
  }, [produtos, s.lotes, s.gondola, busca]);

  // ─── Tab: Gôndola ─────────────────────────────────────────────────────────

  const itensGondola = useMemo(() => {
    const todos = produtos.map((p) => ({
      p,
      qtd: s.gondola[p.id] ?? 0,
      max: p.maximo && p.maximo > 0 ? p.maximo : Math.max(p.minimo * 3, 1),
    }));
    return filtroGondola === "repor" ? todos.filter((i) => i.qtd <= i.p.minimo) : todos;
  }, [produtos, s.gondola, filtroGondola]);

  const qtdRepor = useMemo(
    () => produtos.filter((p) => (s.gondola[p.id] ?? 0) <= p.minimo).length,
    [produtos, s.gondola],
  );

  // ─── Tab: Validades ───────────────────────────────────────────────────────

  const contagemFaixas = useMemo(() => {
    const r: Record<string, number> = { vencido: 0, "7": 0, "15": 0, "30": 0 };
    s.lotes
      .filter((l) => l.qtd > 0)
      .forEach((l) => {
        const f = faixaValidade(diasAte(l.validade));
        if (f !== "ok") r[f] = (r[f] ?? 0) + 1;
      });
    return r;
  }, [s.lotes]);

  const itensValidades = useMemo(() => {
    return s.lotes
      .filter((l) => l.qtd > 0)
      .map((l) => {
        const prod  = produtos.find((p) => p.id === l.produtoId);
        const dias  = diasAte(l.validade);
        const faixa = faixaValidade(dias);
        return { l, prod, dias, faixa };
      })
      .filter((i) => {
        if (i.faixa === "ok") return false;
        return filtroFaixa === "todos" || i.faixa === filtroFaixa;
      })
      .sort((a, b) => a.dias - b.dias);
  }, [s.lotes, produtos, filtroFaixa]);

  // ─── Tab: Movimentações ───────────────────────────────────────────────────

  const ultMovs = useMemo(() => s.movs.slice(0, 30), [s.movs]);

  // ─── Abas ─────────────────────────────────────────────────────────────────

  const ABAS: { id: Aba; label: string }[] = [
    { id: "posicao",   label: "Por produto" },
    { id: "gondola",   label: "Gôndola" },
    { id: "validades", label: "Validades" },
    { id: "movs",      label: "Movimentações" },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold">Estoque</h1>
        <p className="text-muted-foreground">
          Visão completa do que você tem no depósito e na gôndola
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Depósito</p>
          <p className="font-display text-3xl font-bold">{totalDeposito}</p>
          <p className="mt-1 text-sm text-muted-foreground">unidades guardadas</p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Gôndola</p>
          <p className="font-display text-3xl font-bold">{totalGondola}</p>
          <p className="mt-1 text-sm text-muted-foreground">unidades expostas</p>
        </div>

        <div
          className={cn(
            "rounded-2xl border p-5",
            qtdAbaixoMinimo > 0 ? "border-warning bg-warning/5" : "bg-card",
          )}
        >
          <p className="text-xs uppercase text-muted-foreground">Abaixo do mínimo</p>
          <p
            className={cn(
              "font-display text-3xl font-bold",
              qtdAbaixoMinimo > 0 && "text-warning",
            )}
          >
            {qtdAbaixoMinimo}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            produto{qtdAbaixoMinimo !== 1 ? "s" : ""} para repor
          </p>
        </div>

        <div
          className={cn(
            "rounded-2xl border p-5",
            lotesAlerta.length > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card",
          )}
        >
          <p className="text-xs uppercase text-muted-foreground">Alertas de validade</p>
          <p
            className={cn(
              "font-display text-3xl font-bold",
              lotesAlerta.length > 0 && "text-destructive",
            )}
          >
            {lotesAlerta.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            lote{lotesAlerta.length !== 1 ? "s" : ""} a vencer em 30 dias
          </p>
        </div>
      </div>

      {/* Painel com abas */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Barra de abas */}
        <div className="flex flex-wrap gap-1 border-b p-2">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => { setAba(a.id); setBusca(""); }}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                aba === a.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* ── Por produto ───────────────────────────────────────────────────── */}
        {aba === "posicao" && (
          <div>
            <div className="border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto pelo nome ou código…"
                  className="pl-9 pr-9"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {itensPosicao.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {busca
                  ? `Nenhum produto encontrado para "${busca}".`
                  : "Nenhum produto cadastrado."}
              </div>
            ) : (
              <div className="divide-y">
                {itensPosicao.map(({ p, deposito, gondola, total, abaixo }) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {p.codigo} · {p.categoria}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center min-w-[52px]">
                        <p className="text-xs text-muted-foreground">Depósito</p>
                        <p className="font-semibold">{deposito}</p>
                      </div>
                      <div className="text-center min-w-[52px]">
                        <p className="text-xs text-muted-foreground">Gôndola</p>
                        <p className={cn("font-semibold", abaixo && "text-warning")}>{gondola}</p>
                      </div>
                      <div className="text-center min-w-[44px]">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-bold">{total}</p>
                      </div>
                    </div>
                    {abaixo && (
                      <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
                        Repor
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setTransf(p.id)}>
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Transferir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Gôndola ───────────────────────────────────────────────────────── */}
        {aba === "gondola" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div className="flex rounded-lg bg-muted p-1">
                {(["todos", "repor"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltroGondola(f)}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm font-semibold transition",
                      filtroGondola === f ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {f === "todos"
                      ? `Todos (${itensGondola.length})`
                      : `Precisa repor (${qtdRepor})`}
                  </button>
                ))}
              </div>
              <Link to="/painel/gondola" className="text-sm text-primary hover:underline">
                Ver gôndola completa →
              </Link>
            </div>

            <div className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
              {itensGondola.map(({ p, qtd, max }) => {
                const abaixo = qtd <= p.minimo;
                const pct    = Math.min(100, (qtd / max) * 100);
                return (
                  <div key={p.id} className={cn("rounded-2xl border bg-muted/30 p-5", abaixo && "border-warning")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.categoria}</p>
                      </div>
                      {abaixo && (
                        <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[11px] font-semibold text-warning">
                          <BellRing className="h-3 w-3" /> Repor
                        </span>
                      )}
                    </div>
                    <p className="mt-4 font-display text-4xl font-bold">
                      {qtd}
                      <span className="text-base font-medium text-muted-foreground"> un</span>
                    </p>
                    <div className="relative mt-3 h-2 rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", abaixo ? "bg-warning" : "bg-success")}
                        style={{ width: `${pct}%` }}
                      />
                      <div
                        className="absolute -top-1 h-4 w-0.5 bg-foreground/60"
                        style={{ left: `${(p.minimo / max) * 100}%` }}
                        title="Mínimo"
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>Mínimo {p.minimo}</span>
                      <span>Capacidade {max}</span>
                    </div>
                    <Button
                      variant={abaixo ? "default" : "outline"}
                      className="mt-4 w-full"
                      onClick={() => setTransf(p.id)}
                    >
                      <ArrowRightLeft className="h-4 w-4" /> Repor do depósito
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Validades ─────────────────────────────────────────────────────── */}
        {aba === "validades" && (
          <div>
            <div className="flex flex-wrap gap-2 border-b p-4">
              <button
                onClick={() => setFiltroFaixa("todos")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  filtroFaixa === "todos"
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
              >
                Todos ({Object.values(contagemFaixas).reduce((a, b) => a + b, 0)})
              </button>
              {(["vencido", "7", "15", "30"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroFaixa(f)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    filtroFaixa === f
                      ? FAIXAS[f].cor + " ring-2 ring-inset ring-current/40"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {FAIXAS[f].label} ({contagemFaixas[f] ?? 0})
                </button>
              ))}
            </div>

            {itensValidades.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                {filtroFaixa === "todos"
                  ? "Nenhum lote com alerta de validade."
                  : "Nenhum lote nesta faixa."}
              </div>
            ) : (
              <div className="divide-y">
                {itensValidades.map(({ l, prod, dias, faixa }) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {prod?.nome ?? "Produto desconhecido"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        Lote: {l.lote} · Local: {l.local || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Qtd</p>
                        <p className="font-semibold">{l.qtd}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Vence</p>
                        <p className="font-semibold">{exibirValidade(l.validade)}</p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", FAIXAS[faixa as Exclude<Faixa, "ok">].cor)}>
                      {dias < 0
                        ? "Vencido"
                        : dias === 0
                          ? "Vence hoje"
                          : `${dias} dia${dias !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t p-3 text-right">
              <Link to="/painel/validades" className="text-sm text-primary hover:underline">
                Ver validades completo com ações →
              </Link>
            </div>
          </div>
        )}

        {/* ── Movimentações ─────────────────────────────────────────────────── */}
        {aba === "movs" && (
          <div>
            {ultMovs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                Nenhuma movimentação registrada ainda.
              </div>
            ) : (
              <div className="divide-y">
                {ultMovs.map((m) => {
                  const prod = produtos.find((p) => p.id === m.produtoId);
                  const conf = TIPOS_MOV[m.tipo];
                  return (
                    <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", conf.cor)}>
                        {conf.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {prod?.nome ?? m.produtoId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.origem} → {m.destino}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold">
                          {m.qtd > 0 ? "+" : ""}{m.qtd} un
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtData(m.data)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t p-3 text-right">
              <Link to="/painel/movimentacoes" className="text-sm text-primary hover:underline">
                Ver histórico completo →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Links rápidos para sub-telas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/painel/deposito",      label: "Depósito",        desc: "Lotes FEFO por produto" },
          { to: "/painel/gondola",        label: "Gôndola",         desc: "Exposição e reposição" },
          { to: "/painel/validades",      label: "Validades",       desc: "Ações para lotes a vencer" },
          { to: "/painel/movimentacoes",  label: "Movimentações",   desc: "Histórico completo" },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/30"
          >
            <p className="text-sm font-semibold">{link.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{link.desc}</p>
          </Link>
        ))}
      </div>

      {transf && <TransferirDialog produtoId={transf} onClose={() => setTransf(null)} />}
    </div>
  );
}
