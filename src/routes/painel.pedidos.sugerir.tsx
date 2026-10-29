import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ArrowLeft, Lightbulb, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEstoque } from "@/lib/estoque-store";
import { criarPedido } from "@/lib/pedidos-store";
import { sugestoesPedido, HOJE } from "@/lib/computed";
import { brl } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/pedidos/sugerir")({
  head: () => ({ meta: [{ title: "Sugestão de Pedido — OmniSafe 360" }] }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: SugerirPedidoPage,
});

function urgenciaCls(dias: number): string {
  if (dias >= 999) return "text-muted-foreground";
  if (dias === 0) return "text-destructive font-bold";
  if (dias <= 3) return "text-destructive";
  if (dias <= 7) return "text-warning";
  return "text-success";
}

function urgenciaLabel(dias: number): string {
  if (dias >= 999) return "sem histórico";
  if (dias === 0) return "zerado";
  return `${dias} dia${dias !== 1 ? "s" : ""}`;
}

function SugerirPedidoPage() {
  const est = useEstoque();
  const navigate = useNavigate();
  const [diasLead, setDiasLead] = useState(7);
  const [overrides, setOverrides] = useState<Record<string, { qtd: number; sel: boolean }>>({});

  const sugestoes = useMemo(
    () => sugestoesPedido(est.movs, est.gondola, diasLead),
    [est.movs, est.gondola, diasLead]
  );

  const linhas = sugestoes.map((s) => ({
    ...s,
    qtdEditada: overrides[s.produto.id]?.qtd ?? s.qtdSugerida,
    selecionada: overrides[s.produto.id]?.sel ?? true,
  }));

  function setQtd(id: string, qtd: number) {
    setOverrides((prev) => ({ ...prev, [id]: { qtd, sel: prev[id]?.sel ?? true } }));
  }

  function setSel(id: string, sel: boolean, sugerida: number) {
    setOverrides((prev) => ({ ...prev, [id]: { qtd: prev[id]?.qtd ?? sugerida, sel } }));
  }

  function updateLeadTime(val: number) {
    setDiasLead(val);
    setOverrides({});
  }

  const grupos = linhas.reduce<Record<string, typeof linhas>>((acc, l) => {
    const forn = l.produto.fornecedor || "Sem fornecedor";
    (acc[forn] = acc[forn] ?? []).push(l);
    return acc;
  }, {});

  const selecionados = linhas.filter((l) => l.selecionada && l.qtdEditada > 0);
  const totalValor = selecionados.reduce((s, l) => s + l.qtdEditada * (l.produto.custoUltimaCompra ?? l.produto.preco), 0);
  const fornecedoresSet = new Set(selecionados.map((l) => l.produto.fornecedor || "Sem fornecedor"));
  const fornecedoresCount = fornecedoresSet.size;

  function criarRascunhos() {
    if (selecionados.length === 0) {
      toast.error("Selecione ao menos um produto");
      return;
    }

    const porFornecedor: Record<string, typeof selecionados> = {};
    for (const s of selecionados) {
      const forn = s.produto.fornecedor || "Sem fornecedor";
      (porFornecedor[forn] = porFornecedor[forn] ?? []).push(s);
    }

    const dp = new Date(HOJE);
    dp.setDate(dp.getDate() + diasLead);
    const dataPrevista = dp.toISOString().slice(0, 10);

    let count = 0;
    for (const [fornNome, itens] of Object.entries(porFornecedor)) {
      const fornId = itens.find((s) => s.produto.fornecedorId)?.produto.fornecedorId;
      criarPedido({
        fornecedorId: fornId,
        fornecedorNome: fornNome === "Sem fornecedor" ? "" : fornNome,
        dataPrevista,
        observacao: "Gerado por sugestão automática de pedido",
        itens: itens.map((s) => ({
          produtoId: s.produto.id,
          qtdSolicitada: s.qtdEditada,
          precoUnitario: s.produto.preco,
          unidade: "un",
        })),
      });
      count++;
    }

    toast.success(`${count} rascunho${count !== 1 ? "s" : ""} criado${count !== 1 ? "s" : ""}`);
    navigate({ to: "/painel/pedidos" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/painel/pedidos" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Sugestão de Pedido</h1>
            <p className="text-muted-foreground">Produtos com estoque abaixo do prazo de reposição</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Prazo de entrega</span>
          <input
            type="number"
            min={1}
            max={90}
            value={diasLead}
            onChange={(e) => updateLeadTime(Math.max(1, Number(e.target.value)))}
            className="w-16 rounded-md border bg-card px-2 py-1 text-center text-sm font-semibold"
          />
          <span className="text-muted-foreground">dias</span>
        </label>
      </div>

      {sugestoes.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Lightbulb className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">Nenhuma sugestão encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os produtos têm estoque suficiente para os próximos {diasLead + 3} dias.
          </p>
        </div>
      ) : (
        <>
          {Object.entries(grupos).map(([fornNome, itens]) => {
            const todosSelected = itens.every((i) => i.selecionada);
            const algumSelected = itens.some((i) => i.selecionada);
            return (
              <div key={fornNome} className="rounded-xl border bg-card">
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todosSelected}
                    ref={(el) => { if (el) el.indeterminate = !todosSelected && algumSelected; }}
                    onChange={(e) => itens.forEach((i) => setSel(i.produto.id, e.target.checked, i.qtdSugerida))}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <p className="font-semibold">{fornNome}</p>
                  <span className="text-sm text-muted-foreground">{itens.length} produto{itens.length !== 1 ? "s" : ""}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 w-10" />
                      <th className="px-4 py-2">Produto</th>
                      <th className="px-4 py-2 text-right">Estoque</th>
                      <th className="hidden px-4 py-2 text-right sm:table-cell">Consumo/dia</th>
                      <th className="px-4 py-2 text-right">Dias rest.</th>
                      <th className="px-4 py-2 text-right">Qtd pedido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itens.map((l) => (
                      <tr key={l.produto.id} className={cn(!l.selecionada && "opacity-50")}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={l.selecionada}
                            onChange={(e) => setSel(l.produto.id, e.target.checked, l.qtdSugerida)}
                            className="h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{l.produto.nome}</p>
                          <p className="text-xs text-muted-foreground">{l.produto.codigo}</p>
                        </td>
                        <td className="px-4 py-3 text-right">{l.gondolaAtual} un</td>
                        <td className="hidden px-4 py-3 text-right sm:table-cell">
                          {l.mediaDiaria > 0 ? l.mediaDiaria.toFixed(1) : "—"}
                        </td>
                        <td className={cn("px-4 py-3 text-right font-semibold", urgenciaCls(l.diasRestantes))}>
                          {urgenciaLabel(l.diasRestantes)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={1}
                            value={l.qtdEditada}
                            onChange={(e) => setQtd(l.produto.id, Math.max(1, Number(e.target.value)))}
                            disabled={!l.selecionada}
                            className="w-20 rounded-md border bg-card px-2 py-1 text-right text-sm font-semibold disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card px-6 py-4 shadow-elegant">
            <div>
              <p className="font-semibold">
                {selecionados.length} produto{selecionados.length !== 1 ? "s" : ""} selecionado{selecionados.length !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {fornecedoresCount} fornecedor{fornecedoresCount !== 1 ? "es" : ""} · valor estimado {brl(totalValor)}
              </p>
            </div>
            <Button size="lg" onClick={criarRascunhos} disabled={selecionados.length === 0}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Criar {fornecedoresCount} rascunho{fornecedoresCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
