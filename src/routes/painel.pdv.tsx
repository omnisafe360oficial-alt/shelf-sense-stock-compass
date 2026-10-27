import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { BellRing, CheckCircle2, Minus, Plus, Receipt, ScanBarcode, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/mock-data";
import { fecharVenda, useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
type VendaHistorico = { id: string; hora: string; total: number; qtdItens: number; pagamento: string };
const PAGAMENTOS = ["Dinheiro", "Pix", "Débito", "Crédito"] as const;
type Pagamento = (typeof PAGAMENTOS)[number];

function Pdv() {
  const s = useEstoque();
  const produtos = useProdutos();
  const auth = useAuth();
  const operador = auth.nomeProprietario ?? "Caixa";

  const minimos = useMemo(
    () => Object.fromEntries(produtos.map((p) => [p.id, p.minimo])),
    [produtos],
  );

  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Linha[]>([]);
  const [pag, setPag] = useState<Pagamento>("Pix");
  const [recebido, setRecebido] = useState("");
  const [desconto, setDesconto] = useState("");
  const [historico, setHistorico] = useState<VendaHistorico[]>([]);
  const [recibo, setRecibo] = useState<VendaHistorico & { linhas: { nome: string; qtd: number; preco: number }[] } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const subtotal = useMemo(
    () => itens.reduce((t, i) => t + i.qtd * (produtos.find((p) => p.id === i.produtoId)?.preco ?? 0), 0),
    [itens, produtos],
  );
  const descontoVal = useMemo(() => {
    const d = Number(desconto.replace(",", "."));
    if (!desconto || isNaN(d) || d <= 0) return 0;
    return d >= 100 ? subtotal : subtotal * (d / 100);
  }, [desconto, subtotal]);
  const total = Math.max(0, subtotal - descontoVal);
  const troco = pag === "Dinheiro" ? Math.max(0, (Number(recebido.replace(",", ".")) || 0) - total) : 0;

  const sugestoes = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    return produtos
      .filter((p) => p.nome.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t))
      .slice(0, 8);
  }, [busca, produtos]);

  function adicionar(produtoId: string, delta = 1) {
    const naGondola = s.gondola[produtoId] ?? 0;
    setItens((atual) => {
      const ex = atual.find((i) => i.produtoId === produtoId);
      const nova = (ex?.qtd ?? 0) + delta;
      if (nova > naGondola) {
        toast.error(`Só há ${naGondola} na gôndola.`);
        return atual;
      }
      if (nova <= 0) return atual.filter((i) => i.produtoId !== produtoId);
      return ex
        ? atual.map((i) => (i.produtoId === produtoId ? { ...i, qtd: nova } : i))
        : [...atual, { produtoId, qtd: nova }];
    });
  }

  function bipar(e: React.FormEvent) {
    e.preventDefault();
    const t = busca.trim().toLowerCase();
    if (!t) return;
    const exato = produtos.find((x) => x.codigo.toLowerCase() === t);
    if (exato) {
      adicionar(exato.id);
      setBusca("");
      ref.current?.focus();
      return;
    }
    if (sugestoes.length === 1) {
      adicionar(sugestoes[0].id);
      setBusca("");
      ref.current?.focus();
      return;
    }
    if (sugestoes.length === 0) toast.error("Produto não encontrado.");
  }

  function finalizar() {
    try {
      const repor = fecharVenda(itens, operador, minimos);
      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const reciboLinhas = itens.map((i) => {
        const p = produtos.find((x) => x.id === i.produtoId)!;
        return { nome: p.nome, qtd: i.qtd, preco: p.preco };
      });
      const entrada: VendaHistorico = {
        id: crypto.randomUUID(),
        hora,
        total,
        qtdItens: itens.reduce((t, i) => t + i.qtd, 0),
        pagamento: pag,
      };
      setHistorico((h) => [entrada, ...h].slice(0, 20));
      setRecibo({ ...entrada, linhas: reciboLinhas });
      setItens([]);
      setRecebido("");
      setDesconto("");
      setBusca("");
      ref.current?.focus();
      repor.forEach((id) =>
        toast.warning(`${produtos.find((p) => p.id === id)?.nome} chegou ao mínimo. Repositor avisado.`),
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const qtdTotal = itens.reduce((t, i) => t + i.qtd, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">PDV · Caixa</h1>
          <p className="text-muted-foreground">Operador: {operador}</p>
        </div>
        {historico.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{historico.length}</span>
            <span className="text-muted-foreground">venda{historico.length !== 1 ? "s" : ""} hoje ·</span>
            <span className="font-semibold text-success">
              {brl(historico.reduce((s, v) => s + v.total, 0))}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          {/* Busca */}
          <form onSubmit={bipar} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={ref}
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código de barras ou nome do produto"
                className="h-12 pl-10 text-base"
                aria-label="Buscar produto"
              />
            </div>
            {/* Sugestões */}
            {sugestoes.length > 0 && (
              <div className="grid gap-1">
                {sugestoes.map((p) => {
                  const gondola = s.gondola[p.id] ?? 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { adicionar(p.id); setBusca(""); ref.current?.focus(); }}
                      disabled={gondola === 0}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted",
                        gondola === 0 && "opacity-40",
                      )}
                    >
                      <div>
                        <span className="font-medium">{p.nome}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{p.codigo}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{brl(p.preco)}</span>
                        <span className={cn("ml-2 text-xs", gondola === 0 ? "text-destructive" : "text-muted-foreground")}>
                          gôndola {gondola}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {busca && sugestoes.length === 0 && (
              <p className="px-2 text-sm text-muted-foreground">Nenhum produto encontrado para "{busca}"</p>
            )}
          </form>

          {/* Itens da venda */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {itens.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                {recibo ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                    <p className="font-semibold text-foreground">
                      Venda concluída: {recibo.qtdItens} iten{recibo.qtdItens !== 1 ? "s" : ""} · {brl(recibo.total)}
                    </p>
                    <p>Pronto para o próximo cliente.</p>
                    <button
                      onClick={() => setRecibo(recibo)}
                      className="mt-2 text-xs text-primary underline"
                    >
                      Ver recibo
                    </button>
                  </div>
                ) : (
                  "Nenhum item ainda. Bipe ou busque o primeiro produto."
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3">Qtd</th>
                    <th className="p-3 text-right">Unit.</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => {
                    const p = produtos.find((x) => x.id === item.produtoId)!;
                    return (
                      <tr key={item.produtoId} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3">
                          <p className="font-semibold">{p.nome}</p>
                          <p className="font-mono text-xs text-muted-foreground">{p.codigo}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adicionar(p.id, -1)} aria-label="Menos">
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-bold">{item.qtd}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adicionar(p.id, 1)} aria-label="Mais">
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-3 text-right">{brl(p.preco)}</td>
                        <td className="p-3 text-right font-semibold">{brl(p.preco * item.qtd)}</td>
                        <td className="p-3">
                          <Button size="icon" variant="ghost" onClick={() => adicionar(p.id, -item.qtd)} aria-label="Remover">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Histórico da sessão */}
          {historico.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vendas desta sessão</p>
              <div className="space-y-1">
                {historico.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">{v.hora}</span>
                      <span>{v.qtdItens} iten{v.qtdItens !== 1 ? "s" : ""}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{v.pagamento}</span>
                    </div>
                    <span className="font-semibold">{brl(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Aside: pagamento */}
        <aside className="space-y-4 rounded-xl border bg-card p-5 shadow-elegant lg:sticky lg:top-6 lg:self-start">
          {/* Totalizador */}
          <div className="rounded-xl bg-gradient-brand p-5 text-primary-foreground">
            <p className="text-sm opacity-80">Total da venda</p>
            <p className="text-4xl font-bold">{brl(total)}</p>
            <p className="text-sm opacity-80">{qtdTotal} iten{qtdTotal !== 1 ? "s" : ""}</p>
            {descontoVal > 0 && (
              <p className="mt-1 text-xs opacity-70">Desconto: {brl(descontoVal)} ({desconto}%)</p>
            )}
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
                Subtotal {brl(subtotal)} → <span className="font-semibold text-success">{brl(total)}</span>
              </p>
            )}
          </div>

          {/* Forma de pagamento */}
          <div>
            <Label className="mb-2 block text-sm">Pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAGAMENTOS.map((f) => (
                <button
                  key={f}
                  onClick={() => setPag(f)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                    pag === f ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Troco */}
          {pag === "Dinheiro" && (
            <div className="space-y-1.5">
              <Label className="text-sm">Valor recebido</Label>
              <Input
                value={recebido}
                onChange={(e) => setRecebido(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="h-9"
              />
              <p className="text-sm">
                Troco: <span className="font-bold">{brl(troco)}</span>
              </p>
            </div>
          )}

          <Button
            size="lg"
            className="h-12 w-full text-base"
            disabled={!itens.length}
            onClick={finalizar}
          >
            Finalizar venda
          </Button>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
            Ao finalizar, os produtos saem da gôndola automaticamente.
          </p>
        </aside>
      </div>

      {/* Modal de recibo */}
      {recibo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setRecibo(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-elegant space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="text-lg font-bold">Venda concluída</h2>
              </div>
              <button onClick={() => setRecibo(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-muted/50 p-4 space-y-1">
              {recibo.linhas.map((l, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{l.qtd}× {l.nome}</span>
                  <span className="font-medium">{brl(l.preco * l.qtd)}</span>
                </div>
              ))}
            </div>

            {descontoVal > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Desconto ({desconto}%)</span>
                <span>− {brl(descontoVal)}</span>
              </div>
            )}

            <div className="flex justify-between border-t pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">{brl(recibo.total)}</span>
            </div>

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pagamento</span>
              <span className="font-medium">{recibo.pagamento}</span>
            </div>

            {troco > 0 && (
              <div className="flex justify-between text-sm">
                <span>Troco</span>
                <span className="font-bold text-success">{brl(troco)}</span>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {recibo.hora} · Operador: {operador}
            </p>

            <Button className="w-full" onClick={() => { setRecibo(null); ref.current?.focus(); }}>
              Próximo cliente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
