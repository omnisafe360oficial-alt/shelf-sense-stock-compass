import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing, CheckCircle2, Copy, MessageCircle, Minus, Pencil, Plus, Receipt, ScanBarcode, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, isFracionado, stepUnidade } from "@/lib/mock-data";
import { fecharVenda, useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { promocaoAtivaParaProduto, usePromocoes } from "@/lib/promocoes-store";
import { HOJE } from "@/lib/computed";

export const Route = createFileRoute("/painel/pdv")({
  head: () => ({
    meta: [
      { title: "PDV (Caixa) — OmniSafe 360" },
      { name: "description", content: "Bipe os produtos, feche a venda e a gôndola é atualizada na hora." },
      { property: "og:title", content: "PDV (Caixa) — OmniSafe 360" },
      { property: "og:description", content: "Frente de caixa integrada ao estoque da gôndola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pdv,
});

type Linha = { produtoId: string; qtd: number };
type VendaHistorico = {
  id: string; hora: string; total: number; qtdItens: number; pagamento: string;
  descontoVal: number; troco: number;
  linhas: { nome: string; qtd: number; preco: number }[];
};

const PAGAMENTOS = [
  { id: "Pix" as const, emoji: "📲" },
  { id: "Dinheiro" as const, emoji: "💵" },
  { id: "Débito" as const, emoji: "💳" },
  { id: "Crédito" as const, emoji: "💳" },
];
type Pagamento = (typeof PAGAMENTOS)[number]["id"];

const RAPIDOS = [5, 10, 20, 50, 100, 200];

function Pdv() {
  const s = useEstoque();
  const produtos = useProdutos();
  const auth = useAuth();
  const operador = auth.nomeProprietario ?? "Caixa";
  const promoEstado = usePromocoes();

  const minimos = useMemo(
    () => Object.fromEntries(produtos.map((p) => [p.id, p.minimo])),
    [produtos],
  );

  const [busca, setBusca] = useState("");
  const [sugestaoIdx, setSugestaoIdx] = useState(-1);
  const [itens, setItens] = useState<Linha[]>([]);
  const [pag, setPag] = useState<Pagamento>("Pix");
  const [recebido, setRecebido] = useState("");
  const [desconto, setDesconto] = useState("");
  const [historico, setHistorico] = useState<VendaHistorico[]>([]);
  const [ultimaVenda, setUltimaVenda] = useState<VendaHistorico | null>(null);
  const [showRecibo, setShowRecibo] = useState(false);
  const [descontoItens, setDescontoItens] = useState<Record<string, { val: string; modo: "%" | "R$" }>>({});
  const [editDescId, setEditDescId] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const buscaWrapRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  const [showSug, setShowSug] = useState(false);
  useEffect(() => {
    if (!showSug) return;
    const handler = (e: MouseEvent) => {
      if (!buscaWrapRef.current?.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSug]);

  const precoLiquido = (produtoId: string): number => {
    const p = produtos.find((x) => x.id === produtoId);
    if (!p) return 0;
    const d = descontoItens[produtoId];
    if (!d || !d.val) return p.preco;
    const v = parseFloat(d.val.replace(",", ".")) || 0;
    if (v <= 0) return p.preco;
    return d.modo === "%" ? Math.max(0, p.preco * (1 - v / 100)) : Math.max(0, p.preco - v);
  };

  const subtotal = useMemo(
    () => itens.reduce((t, i) => t + i.qtd * precoLiquido(i.produtoId), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itens, produtos, descontoItens],
  );

  const breakdown = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    for (const v of historico) {
      for (const l of v.linhas) {
        const ex = map.get(l.nome);
        if (ex) { ex.qtd += l.qtd; ex.valor += l.qtd * l.preco; }
        else map.set(l.nome, { nome: l.nome, qtd: l.qtd, valor: l.qtd * l.preco });
      }
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  }, [historico]);
  const descontoVal = useMemo(() => {
    const d = Number(desconto.replace(",", "."));
    if (!desconto || isNaN(d) || d <= 0) return 0;
    return d >= 100 ? subtotal : subtotal * (d / 100);
  }, [desconto, subtotal]);
  const total = Math.max(0, subtotal - descontoVal);
  const recebidoNum = Number(recebido.replace(",", ".")) || 0;
  const troco = pag === "Dinheiro" ? Math.max(0, recebidoNum - total) : 0;
  const qtdTotal = itens.reduce((t, i) => t + i.qtd, 0);

  const fatSessao = historico.reduce((s, v) => s + v.total, 0);

  const sugestoes = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    return produtos
      .filter((p) => p.nome.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t))
      .slice(0, 8);
  }, [busca, produtos]);

  function adicionar(produtoId: string, deltaOverride?: number) {
    const prod = produtos.find((x) => x.id === produtoId);
    const step = deltaOverride !== undefined ? deltaOverride : stepUnidade(prod?.unidade);
    const naGondola = s.gondola[produtoId] ?? 0;
    const ex = itens.find((i) => i.produtoId === produtoId);
    const nova = Math.round(((ex?.qtd ?? 0) + step) * 1000) / 1000;
    if (nova > naGondola + 0.0005) { toast.error(`Só há ${naGondola} ${prod?.unidade ?? "un"} na gôndola.`); return; }
    if (nova <= 0) {
      setItens((prev) => prev.filter((i) => i.produtoId !== produtoId));
      setDescontoItens((prev) => { const n = { ...prev }; delete n[produtoId]; return n; });
      if (editDescId === produtoId) setEditDescId(null);
      return;
    }
    const isNovo = !ex;
    setItens((prev) =>
      ex
        ? prev.map((i) => (i.produtoId === produtoId ? { ...i, qtd: nova } : i))
        : [...prev, { produtoId, qtd: nova }],
    );
    if (isNovo && !descontoItens[produtoId]) {
      const promo = promocaoAtivaParaProduto(promoEstado.promocoes, produtoId, HOJE);
      if (promo) {
        setDescontoItens((prev) => ({
          ...prev,
          [produtoId]: { val: String(promo.valor), modo: promo.tipo === "pct" ? "%" : "R$" },
        }));
        toast.success(`Promoção "${promo.nome}" aplicada`);
      }
    }
  }

  function setQty(produtoId: string, qtd: number) {
    const prod = produtos.find((x) => x.id === produtoId);
    const naGondola = s.gondola[produtoId] ?? 0;
    const min = isFracionado(prod?.unidade) ? 0.001 : 1;
    const safe = Math.max(min, Math.min(naGondola, qtd));
    if (qtd > naGondola) toast.error(`Só há ${naGondola} ${prod?.unidade ?? "un"} na gôndola.`);
    setItens((prev) => prev.map((i) => i.produtoId === produtoId ? { ...i, qtd: safe } : i));
  }

  function adicionarESumir(produtoId: string) {
    adicionar(produtoId);
    setBusca("");
    setShowSug(false);
    setSugestaoIdx(-1);
    buscaRef.current?.focus();
  }

  function bipar(e: React.FormEvent) {
    e.preventDefault();
    const t = busca.trim().toLowerCase();
    if (!t) return;
    const exato = produtos.find((x) => x.codigo.toLowerCase() === t);
    if (exato) { adicionarESumir(exato.id); return; }
    if (sugestaoIdx >= 0 && sugestoes[sugestaoIdx]) { adicionarESumir(sugestoes[sugestaoIdx].id); return; }
    if (sugestoes.length === 1) { adicionarESumir(sugestoes[0]!.id); return; }
    if (sugestoes.length === 0) toast.error("Produto não encontrado.");
  }

  function onBuscaKeyDown(e: React.KeyboardEvent) {
    if (!sugestoes.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSugestaoIdx((i) => Math.min(i + 1, sugestoes.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSugestaoIdx((i) => Math.max(i - 1, -1)); }
    if (e.key === "Escape") { setShowSug(false); setSugestaoIdx(-1); }
  }

  function finalizar() {
    try {
      const snapDesconto = descontoVal;
      const snapTroco = troco;
      const itensComPreco = itens.map((i) => ({
        produtoId: i.produtoId,
        qtd: i.qtd,
        preco: precoLiquido(i.produtoId),
      }));
      const repor = fecharVenda(itensComPreco, operador, minimos);
      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const linhas = itens.map((i) => {
        const p = produtos.find((x) => x.id === i.produtoId)!;
        return { nome: p.nome, qtd: i.qtd, preco: precoLiquido(i.produtoId) };
      });
      const entrada: VendaHistorico = {
        id: crypto.randomUUID(), hora, total,
        qtdItens: itens.reduce((t, i) => t + i.qtd, 0),
        pagamento: pag, descontoVal: snapDesconto, troco: snapTroco, linhas,
      };
      setHistorico((h) => [entrada, ...h].slice(0, 20));
      setUltimaVenda(entrada);
      setShowRecibo(true);
      setItens([]);
      setDescontoItens({});
      setEditDescId(null);
      setRecebido("");
      setDesconto("");
      setBusca("");
      repor.forEach((id) =>
        toast.warning(`${produtos.find((p) => p.id === id)?.nome} chegou ao mínimo. Repositor avisado.`),
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const podeFinalizar = itens.length > 0 && (pag !== "Dinheiro" || recebidoNum >= total);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">PDV · Caixa</h1>
          <p className="text-muted-foreground">Operador: {operador}</p>
        </div>
        {historico.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{historico.length}</span>
            <span className="text-muted-foreground">venda{historico.length !== 1 ? "s" : ""} hoje ·</span>
            <span className="text-lg font-bold text-success">{brl(fatSessao)}</span>
          </div>
        )}
      </div>

      {/* Aviso de troco pendente (dinheiro) */}
      {pag === "Dinheiro" && itens.length > 0 && recebidoNum > 0 && recebidoNum < total && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-warning">
          <BellRing className="h-4 w-4 shrink-0" />
          Valor recebido insuficiente — faltam {brl(total - recebidoNum)}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* ── Coluna esquerda: busca + carrinho ───────────────────────────────── */}
        <div className="space-y-4">

          {/* Busca */}
          <div ref={buscaWrapRef} className="relative">
            <form onSubmit={bipar} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={buscaRef}
                  autoFocus
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setShowSug(true); setSugestaoIdx(-1); }}
                  onFocus={() => setShowSug(true)}
                  onKeyDown={onBuscaKeyDown}
                  placeholder="Código de barras ou nome do produto"
                  className="h-12 pl-10 pr-10 text-base"
                  aria-label="Buscar produto"
                  autoComplete="off"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => { setBusca(""); setShowSug(false); buscaRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                ↑↓ para navegar · Enter para adicionar · Bipe diretamente o código
              </p>
            </form>

            {/* Dropdown flutuante de sugestões */}
            {showSug && sugestoes.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border bg-popover shadow-xl">
                {sugestoes.map((p, idx) => {
                  const gondola = s.gondola[p.id] ?? 0;
                  const semEstoque = gondola === 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); if (!semEstoque) adicionarESumir(p.id); }}
                      disabled={semEstoque}
                      className={cn(
                        "flex w-full items-center gap-4 px-4 py-3 text-left transition",
                        idx === sugestaoIdx ? "bg-primary/10" : "hover:bg-muted/60",
                        semEstoque && "opacity-40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.nome}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold">{brl(p.preco)}</p>
                        <p className={cn("text-xs", semEstoque ? "text-destructive font-semibold" : "text-muted-foreground")}>
                          {semEstoque ? "Sem estoque" : `${gondola} ${p.unidade ?? "un"} na gôndola`}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {busca && (
                  <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                    {sugestoes.length} resultado{sugestoes.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}
            {showSug && busca && sugestoes.length === 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-2xl border bg-popover px-4 py-3 text-sm text-muted-foreground shadow-xl">
                Nenhum produto encontrado para "<strong>{busca}</strong>"
              </div>
            )}
          </div>

          {/* Carrinho */}
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                {ultimaVenda ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-success" />
                    <p className="text-lg font-bold">Venda de {brl(ultimaVenda.total)} concluída!</p>
                    <p className="text-muted-foreground">
                      {ultimaVenda.qtdItens} iten{ultimaVenda.qtdItens !== 1 ? "s" : ""} · {ultimaVenda.pagamento} · {ultimaVenda.hora}
                    </p>
                    <button
                      onClick={() => setShowRecibo(true)}
                      className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Receipt className="h-3.5 w-3.5" /> Ver recibo
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">Pronto para o próximo cliente — bipe o primeiro produto</p>
                  </>
                ) : (
                  <>
                    <ScanBarcode className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Carrinho vazio — bipe ou busque o primeiro produto</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Header do carrinho */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {qtdTotal} iten{qtdTotal !== 1 ? "s" : ""} no carrinho
                  </p>
                  <button
                    onClick={() => { if (confirm("Limpar o carrinho?")) { setItens([]); setDescontoItens({}); setEditDescId(null); } }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Limpar tudo
                  </button>
                </div>

                {/* Linhas */}
                <div className="divide-y">
                  {itens.map((item) => {
                    const p = produtos.find((x) => x.id === item.produtoId)!;
                    const gondola = s.gondola[item.produtoId] ?? 0;
                    const liq = precoLiquido(item.produtoId);
                    const temDesc = !!descontoItens[item.produtoId]?.val;
                    const fracionado = isFracionado(p.unidade);
                    const stepQty = stepUnidade(p.unidade);
                    return (
                      <div key={item.produtoId} className="flex flex-col px-4 py-3">
                        {/* main row */}
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{p.nome}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {p.codigo} ·{" "}
                              {temDesc ? (
                                <><span className="line-through">{brl(p.preco)}</span> <span className="text-primary font-semibold">{brl(liq)}</span></>
                              ) : brl(p.preco)}{" "}{p.unidade ?? "un"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button onClick={() => adicionar(p.id, -stepQty)} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted" aria-label="Remover">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min={fracionado ? 0.001 : 1}
                              max={gondola}
                              step={stepQty}
                              inputMode={fracionado ? "decimal" : "numeric"}
                              value={item.qtd}
                              onChange={(e) => setQty(item.produtoId, parseFloat(e.target.value.replace(",", ".")) || stepQty)}
                              className={cn("h-8 rounded-lg border bg-transparent text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary", fracionado ? "w-20" : "w-12")}
                            />
                            <button onClick={() => adicionar(p.id, stepQty)} className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted" aria-label="Adicionar">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={cn("w-20 font-semibold", temDesc && "text-primary")}>{brl(liq * item.qtd)}</p>
                            {fracionado && <p className="w-20 text-xs text-muted-foreground">{item.qtd} {p.unidade}</p>}
                          </div>
                          <button
                            onClick={() => setEditDescId(editDescId === item.produtoId ? null : item.produtoId)}
                            className={cn("shrink-0 rounded-lg p-1.5 transition", temDesc ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted")}
                            aria-label="Desconto no item"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setItens((prev) => prev.filter((i) => i.produtoId !== item.produtoId));
                              setDescontoItens((prev) => { const n = { ...prev }; delete n[item.produtoId]; return n; });
                              if (editDescId === item.produtoId) setEditDescId(null);
                            }}
                            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Remover item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {/* inline discount form */}
                        {editDescId === item.produtoId && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
                            <span className="text-xs font-medium text-muted-foreground">Desconto:</span>
                            <Input
                              type="number" min="0" placeholder="0"
                              value={descontoItens[item.produtoId]?.val ?? ""}
                              onChange={(e) => setDescontoItens((prev) => ({ ...prev, [item.produtoId]: { val: e.target.value, modo: prev[item.produtoId]?.modo ?? "%" } }))}
                              className="h-8 w-20 text-right"
                            />
                            <div className="flex overflow-hidden rounded-lg border">
                              {(["%", "R$"] as const).map((m) => (
                                <button key={m} type="button"
                                  onClick={() => setDescontoItens((prev) => ({ ...prev, [item.produtoId]: { val: prev[item.produtoId]?.val ?? "", modo: m } }))}
                                  className={cn("px-2.5 py-1 text-xs font-semibold transition",
                                    (descontoItens[item.produtoId]?.modo ?? "%") === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                                >{m}</button>
                              ))}
                            </div>
                            {descontoItens[item.produtoId]?.val && (
                              <span className="text-xs text-primary font-medium">= {brl(liq)} / un</span>
                            )}
                            <button type="button" onClick={() => { setDescontoItens((prev) => { const n = { ...prev }; delete n[item.produtoId]; return n; }); setEditDescId(null); }}
                              className="text-xs text-muted-foreground hover:text-destructive">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé do carrinho */}
                <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3">
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="text-xl font-bold">{brl(subtotal)}</p>
                </div>
              </>
            )}
          </div>

          {/* Histórico da sessão */}
          {historico.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vendas desta sessão
                </p>
                <button onClick={() => setShowBreakdown((v) => !v)} className="text-xs text-primary hover:underline">
                  {showBreakdown ? "Por venda" : "Por produto"}
                </button>
              </div>
              {showBreakdown ? (
                <div className="space-y-1">
                  {breakdown.map((item) => (
                    <div key={item.nome} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{item.qtd}×</span>
                        <span className="truncate">{item.nome}</span>
                      </div>
                      <span className="shrink-0 font-semibold">{brl(item.valor)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t pt-2 text-xs font-semibold text-muted-foreground">
                    <span>{breakdown.reduce((t, i) => t + i.qtd, 0)} un · {breakdown.length} produto{breakdown.length !== 1 ? "s"  : ""}</span>
                    <span>{brl(fatSessao)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {historico.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { setUltimaVenda(v); setShowRecibo(true); }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-muted/50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{v.hora}</span>
                        <span>{v.qtdItens} iten{v.qtdItens !== 1 ? "s" : ""}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{v.pagamento}</span>
                      </div>
                      <span className="font-semibold">{brl(v.total)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Coluna direita: pagamento ────────────────────────────────────────── */}
        <aside className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          {/* Total */}
          <div className="rounded-2xl bg-gradient-brand p-5 text-primary-foreground">
            <p className="text-sm opacity-80">Total da venda</p>
            <p className="text-5xl font-bold tabular-nums">{brl(total)}</p>
            <p className="mt-1 text-sm opacity-75">
              {qtdTotal} iten{qtdTotal !== 1 ? "s" : ""}
              {descontoVal > 0 && ` · Desconto ${brl(descontoVal)}`}
            </p>
          </div>

          {/* Desconto */}
          <div className="space-y-1.5">
            <Label className="text-sm">Desconto (%)</Label>
            <Input
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="h-9"
            />
            {subtotal > 0 && descontoVal > 0 && (
              <p className="text-xs text-muted-foreground">
                {brl(subtotal)} − {brl(descontoVal)} = <span className="font-bold text-success">{brl(total)}</span>
              </p>
            )}
          </div>

          {/* Forma de pagamento */}
          <div>
            <Label className="mb-2 block text-sm">Pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAGAMENTOS.map(({ id: f, emoji }) => (
                <button
                  key={f}
                  onClick={() => setPag(f)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition",
                    pag === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/50",
                  )}
                >
                  <span>{emoji}</span> {f}
                </button>
              ))}
            </div>
          </div>

          {/* Dinheiro: valor recebido + troco */}
          {pag === "Dinheiro" && (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Valor recebido</Label>
                <Input
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="h-10 text-base"
                />
              </div>
              {/* Atalhos de notas */}
              <div className="grid grid-cols-3 gap-1.5">
                {RAPIDOS.filter((v) => v >= Math.ceil(total) || v === RAPIDOS[RAPIDOS.length - 1]).slice(0, 6).map((v) => (
                  <button
                    key={v}
                    onClick={() => setRecebido(String(v))}
                    className={cn(
                      "rounded-lg border py-2 text-sm font-semibold transition",
                      recebidoNum === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    R${v}
                  </button>
                ))}
              </div>
              {/* Troco */}
              {recebidoNum > 0 && (
                <div className={cn(
                  "rounded-xl p-3 text-center",
                  troco > 0 ? "bg-success/10" : "bg-destructive/10",
                )}>
                  {troco > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground">Troco</p>
                      <p className="text-2xl font-bold text-success">{brl(troco)}</p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-destructive">
                      Faltam {brl(total - recebidoNum)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Botão finalizar */}
          <Button
            size="lg"
            className="h-14 w-full gap-2 text-lg font-bold"
            disabled={!podeFinalizar}
            onClick={finalizar}
          >
            <CheckCircle2 className="h-5 w-5" /> Finalizar venda
          </Button>

          {itens.length > 0 && pag === "Dinheiro" && recebidoNum < total && (
            <p className="text-center text-xs text-warning">Informe o valor recebido para habilitar</p>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            Ao finalizar, os produtos saem da gôndola automaticamente.
          </p>
        </aside>
      </div>

      {/* ── Modal de recibo ──────────────────────────────────────────────────── */}
      {showRecibo && ultimaVenda && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setShowRecibo(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="text-lg font-bold">Recibo</h2>
              </div>
              <button onClick={() => setShowRecibo(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="space-y-1.5">
                {ultimaVenda.linhas.map((l, i) => {
                  const prod = produtos.find((x) => x.nome === l.nome);
                  const un = prod?.unidade ?? "un";
                  return (
                    <div key={i} className="flex justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{l.qtd} {un} · {l.nome}</span>
                      <span className="shrink-0 font-medium">{brl(l.preco * l.qtd)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {ultimaVenda.descontoVal > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Desconto</span>
                <span>− {brl(ultimaVenda.descontoVal)}</span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-gradient-brand p-4 text-primary-foreground">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold">{brl(ultimaVenda.total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Pagamento</p>
                <p className="mt-0.5 font-semibold">{ultimaVenda.pagamento}</p>
              </div>
              {ultimaVenda.pagamento === "Dinheiro" && ultimaVenda.troco > 0 && (
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-xs text-muted-foreground">Troco</p>
                  <p className="mt-0.5 font-bold text-success">{brl(ultimaVenda.troco)}</p>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {ultimaVenda.hora} · Operador: {operador}
            </p>

            {/* Compartilhar */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const linhas = ultimaVenda.linhas.map((l) => `${l.qtd}x ${l.nome}  ${brl(l.preco * l.qtd)}`).join("\n");
                  const descLine = ultimaVenda.descontoVal > 0 ? `\nDesconto: -${brl(ultimaVenda.descontoVal)}` : "";
                  const trocoLine = ultimaVenda.troco > 0 ? `\nTroco: ${brl(ultimaVenda.troco)}` : "";
                  const texto = `*Cupom OmniSafe 360*\n${ultimaVenda.hora}\n─────────────\n${linhas}${descLine}\n─────────────\n*Total: ${brl(ultimaVenda.total)}*\nPagamento: ${ultimaVenda.pagamento}${trocoLine}\nOp: ${operador}`;
                  navigator.clipboard.writeText(texto).then(
                    () => toast.success("Cupom copiado!"),
                    () => toast.error("Não foi possível copiar"),
                  );
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium hover:bg-muted transition"
              >
                <Copy className="h-4 w-4" /> Copiar
              </button>
              <a
                href={(() => {
                  const linhas = ultimaVenda.linhas.map((l) => `${l.qtd}x ${l.nome}  ${brl(l.preco * l.qtd)}`).join("\n");
                  const descLine = ultimaVenda.descontoVal > 0 ? `\nDesconto: -${brl(ultimaVenda.descontoVal)}` : "";
                  const trocoLine = ultimaVenda.troco > 0 ? `\nTroco: ${brl(ultimaVenda.troco)}` : "";
                  const texto = `*Cupom OmniSafe 360*\n${ultimaVenda.hora}\n─────────────\n${linhas}${descLine}\n─────────────\n*Total: ${brl(ultimaVenda.total)}*\nPagamento: ${ultimaVenda.pagamento}${trocoLine}\nOp: ${operador}`;
                  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 py-3 text-sm font-medium text-[#25D366] hover:bg-[#25D366]/20 transition"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => { setShowRecibo(false); buscaRef.current?.focus(); }}
            >
              Próximo cliente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
