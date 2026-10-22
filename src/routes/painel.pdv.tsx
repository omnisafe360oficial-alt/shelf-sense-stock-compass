import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { BellRing, Minus, Plus, ScanBarcode, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { produtos, brl } from "@/lib/mock-data";
import { fecharVenda, useEstoque } from "@/lib/estoque-store";
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
const pagamentos = ["Dinheiro", "Pix", "Débito", "Crédito"] as const;
const minimos = Object.fromEntries(produtos.map((p) => [p.id, p.minimo]));

function Pdv() {
  const s = useEstoque();
  const [codigo, setCodigo] = useState("");
  const [itens, setItens] = useState<Linha[]>([]);
  const [pag, setPag] = useState<(typeof pagamentos)[number]>("Pix");
  const [recebido, setRecebido] = useState("");
  const [ultima, setUltima] = useState<{ total: number; itens: number } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const total = useMemo(() => itens.reduce((t, i) => t + i.qtd * (produtos.find((p) => p.id === i.produtoId)?.preco ?? 0), 0), [itens]);
  const troco = pag === "Dinheiro" ? Math.max(0, (Number(recebido.replace(",", ".")) || 0) - total) : 0;

  function adicionar(produtoId: string, delta = 1) {
    const naGondola = s.gondola[produtoId] ?? 0;
    setItens((atual) => {
      const ex = atual.find((i) => i.produtoId === produtoId);
      const nova = (ex?.qtd ?? 0) + delta;
      if (nova > naGondola) { toast.error(`Só há ${naGondola} na gôndola.`); return atual; }
      if (nova <= 0) return atual.filter((i) => i.produtoId !== produtoId);
      return ex ? atual.map((i) => (i.produtoId === produtoId ? { ...i, qtd: nova } : i)) : [...atual, { produtoId, qtd: nova }];
    });
  }

  function bipar(e: React.FormEvent) {
    e.preventDefault();
    const t = codigo.trim().toLowerCase();
    if (!t) return;
    const p = produtos.find((x) => x.codigo === t) ?? produtos.find((x) => x.nome.toLowerCase().includes(t));
    if (!p) toast.error("Produto não encontrado.");
    else { adicionar(p.id); setUltima(null); }
    setCodigo("");
    ref.current?.focus();
  }

  function finalizar() {
    try {
      const repor = fecharVenda(itens, "Caixa 1", minimos);
      setUltima({ total, itens: itens.reduce((t, i) => t + i.qtd, 0) });
      setItens([]); setRecebido("");
      toast.success(`Venda de ${brl(total)} concluída. Gôndola atualizada.`);
      repor.forEach((id) => toast.warning(`${produtos.find((p) => p.id === id)?.nome} chegou ao mínimo. Repositor avisado.`));
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">PDV · Caixa 1</h1><p className="text-muted-foreground">Bipe o código de barras ou digite o nome do produto</p></div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <form onSubmit={bipar} className="flex gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input ref={ref} autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código de barras ou nome" className="h-12 pl-10 text-lg" aria-label="Código do produto" />
            </div>
            <Button type="submit" size="lg" className="h-12">Adicionar</Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {produtos.map((p) => (
              <button key={p.id} onClick={() => adicionar(p.id)} className="rounded-lg border bg-card px-3 py-2 text-left text-xs hover:border-primary">
                <span className="block font-semibold">{p.nome}</span>
                <span className="text-muted-foreground">{brl(p.preco)} · gôndola {s.gondola[p.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            {itens.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                {ultima ? (
                  <div className="space-y-2"><CheckCircle2 className="mx-auto h-10 w-10 text-success" /><p className="font-semibold text-foreground">Venda concluída: {ultima.itens} itens · {brl(ultima.total)}</p><p>Pronto para o próximo cliente.</p></div>
                ) : "Nenhum item ainda. Bipe o primeiro produto."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Produto</th><th className="p-3">Qtd</th><th className="p-3 text-right">Unit.</th><th className="p-3 text-right">Total</th><th /></tr></thead>
                <tbody>
                  {itens.map((i) => {
                    const p = produtos.find((x) => x.id === i.produtoId)!;
                    return (
                      <tr key={i.produtoId} className="border-b last:border-0">
                        <td className="p-3"><p className="font-semibold">{p.nome}</p><p className="text-xs text-muted-foreground">{p.codigo}</p></td>
                        <td className="p-3"><div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adicionar(p.id, -1)} aria-label="Menos"><Minus className="h-3 w-3" /></Button>
                          <span className="w-8 text-center font-semibold">{i.qtd}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adicionar(p.id, 1)} aria-label="Mais"><Plus className="h-3 w-3" /></Button>
                        </div></td>
                        <td className="p-3 text-right">{brl(p.preco)}</td>
                        <td className="p-3 text-right font-semibold">{brl(p.preco * i.qtd)}</td>
                        <td className="p-3"><Button size="icon" variant="ghost" onClick={() => adicionar(p.id, -i.qtd)} aria-label="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-4 rounded-xl border bg-card p-5 shadow-elegant lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg bg-gradient-brand p-5 text-primary-foreground">
            <p className="text-sm opacity-80">Total da venda</p>
            <p className="font-display text-4xl font-bold">{brl(total)}</p>
            <p className="text-sm opacity-80">{itens.reduce((t, i) => t + i.qtd, 0)} itens</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {pagamentos.map((f) => (
                <button key={f} onClick={() => setPag(f)} className={cn("rounded-lg border px-3 py-2 text-sm font-semibold", pag === f ? "border-primary bg-primary/10 text-primary" : "")}>{f}</button>
              ))}
            </div>
          </div>
          {pag === "Dinheiro" && (
            <div className="space-y-2">
              <Input value={recebido} onChange={(e) => setRecebido(e.target.value)} placeholder="Valor recebido" inputMode="decimal" />
              <p className="text-sm">Troco: <span className="font-bold">{brl(troco)}</span></p>
            </div>
          )}
          <Button size="lg" className="w-full" disabled={!itens.length} onClick={finalizar}>Finalizar venda</Button>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><BellRing className="mt-0.5 h-4 w-4 shrink-0" />Ao finalizar, os produtos saem da gôndola. Se algum chegar ao mínimo, o repositor é avisado.</p>
        </aside>
      </div>
    </div>
  );
}
