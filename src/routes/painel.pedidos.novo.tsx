import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFornecedores } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import { criarPedido } from "@/lib/pedidos-store";
import type { ItemPedido } from "@/lib/pedidos-store";
import { brl } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/pedidos/novo")({
  head: () => ({
    meta: [
      { title: "Novo Pedido — OmniSafe 360" },
      { name: "description", content: "Crie um pedido de compra para enviar ao fornecedor." },
      { property: "og:title", content: "Novo Pedido — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovoPedido,
});

type ItemForm = Omit<ItemPedido, "id" | "qtdRecebida">;

function NovoPedido() {
  const navigate = useNavigate();
  const fornecedores = useFornecedores();
  const produtos = useProdutos();
  const searchRef = useRef<HTMLInputElement>(null);

  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<(ItemForm & { tempId: string })[]>([]);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const sugestoes = useMemo(() => {
    if (!busca.trim()) return [];
    const t = busca.toLowerCase();
    return produtos
      .filter((p) => p.nome.toLowerCase().includes(t) || p.codigo.includes(t))
      .slice(0, 6);
  }, [busca, produtos]);

  const fornSelecionado = fornecedores.find((f) => f.id === fornecedorId);

  const adicionarItem = (produtoId: string) => {
    const p = produtos.find((x) => x.id === produtoId);
    if (!p) return;
    const existe = itens.find((i) => i.produtoId === produtoId);
    if (existe) {
      setItens((prev) =>
        prev.map((i) => i.produtoId === produtoId ? { ...i, qtdSolicitada: i.qtdSolicitada + 1 } : i),
      );
    } else {
      setItens((prev) => [
        ...prev,
        { tempId: crypto.randomUUID(), produtoId, qtdSolicitada: 1, precoUnitario: p.preco, unidade: "un" },
      ]);
    }
    setBusca("");
    searchRef.current?.focus();
  };

  const setItem = <K extends keyof ItemForm>(tempId: string, k: K, v: ItemForm[K]) =>
    setItens((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, [k]: v } : i)));

  const removerItem = (tempId: string) =>
    setItens((prev) => prev.filter((i) => i.tempId !== tempId));

  const total = itens.reduce((s, i) => s + i.qtdSolicitada * i.precoUnitario, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = fornecedorNome.trim() || fornSelecionado?.nome || "";
    if (!nome) { toast.error("Informe o fornecedor."); return; }
    if (itens.length === 0) { toast.error("Adicione pelo menos um produto."); return; }
    setSalvando(true);
    const pedidoId = criarPedido({
      fornecedorId: fornecedorId || undefined,
      fornecedorNome: nome,
      dataPrevista,
      observacao,
      itens: itens.map(({ tempId: _t, ...i }) => i),
    });
    if (pedidoId) {
      toast.success("Pedido criado!");
      navigate({ to: "/painel/pedidos/$id", params: { id: pedidoId } });
    } else {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/painel/pedidos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </Link>
      <div>
        <h1 className="text-3xl font-bold">Novo pedido de compra</h1>
        <p className="text-muted-foreground">Selecione o fornecedor e os produtos que você quer pedir.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Coluna esquerda: fornecedor + datas */}
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Fornecedor</h2>

            {fornecedores.length > 0 && (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {fornecedores.slice(0, 4).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setFornecedorId(f.id); setFornecedorNome(""); }}
                      className={cn(
                        "rounded-xl border-2 p-3 text-left transition",
                        fornecedorId === f.id
                          ? "border-primary bg-secondary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <p className="text-sm font-semibold truncate">{f.nome}</p>
                      {f.cidade && <p className="text-xs text-muted-foreground truncate">{f.cidade}</p>}
                    </button>
                  ))}
                </div>
                {fornecedores.length > 4 && (
                  <p className="text-xs text-muted-foreground">+ {fornecedores.length - 4} outros. Ou digite abaixo.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{fornecedores.length > 0 ? "Ou digitar nome do fornecedor" : "Nome do fornecedor"}</Label>
              <Input
                value={fornecedorId ? (fornecedores.find((f) => f.id === fornecedorId)?.nome ?? "") : fornecedorNome}
                onChange={(e) => { setFornecedorId(""); setFornecedorNome(e.target.value); }}
                onFocus={() => { if (fornecedorId) { setFornecedorNome(fornecedores.find((f) => f.id === fornecedorId)?.nome ?? ""); setFornecedorId(""); } }}
                placeholder="Nome da distribuidora ou vendedor"
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Datas e observação</h2>
            <div className="space-y-2">
              <Label>Entrega prevista</Label>
              <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação <span className="font-normal text-muted-foreground text-xs">(opcional)</span></Label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: pagar em 30 dias, embalagem especial…" />
            </div>
          </div>
        </div>

        {/* Coluna direita: buscar produtos + lista */}
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="border-b p-4">
              <h2 className="mb-3 font-semibold">Produtos do pedido</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto pelo nome ou código de barras…"
                  className="pl-9 pr-9"
                  autoComplete="off"
                />
                {busca && (
                  <button type="button" onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {sugestoes.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border bg-popover shadow-elegant">
                  {sugestoes.map((p) => {
                    const jaAdicionado = itens.some((i) => i.produtoId === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => adicionarItem(p.id)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/60 transition"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.nome}</p>
                          <p className="font-mono text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{brl(p.preco)}</p>
                          {jaAdicionado
                            ? <span className="text-xs text-success">Já adicionado</span>
                            : <Plus className="ml-auto h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {busca && sugestoes.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">Nenhum produto encontrado para "{busca}".</p>
              )}
            </div>

            {/* Lista de itens adicionados */}
            {itens.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-semibold text-muted-foreground">Nenhum produto adicionado</p>
                <p className="mt-1 text-xs text-muted-foreground">Use a busca acima para adicionar produtos ao pedido.</p>
              </div>
            ) : (
              <div className="divide-y">
                {itens.map((item) => {
                  const p = produtos.find((x) => x.id === item.produtoId);
                  return (
                    <div key={item.tempId} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p?.nome ?? "Produto"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p?.codigo}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20">
                          <Input
                            type="number" min="1"
                            value={item.qtdSolicitada}
                            onChange={(e) => setItem(item.tempId, "qtdSolicitada", Math.max(1, Number(e.target.value)))}
                            className="h-8 text-center text-sm"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">un</span>
                        <div className="w-24">
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.precoUnitario}
                            onChange={(e) => setItem(item.tempId, "precoUnitario", Number(e.target.value))}
                            className="h-8 text-right text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removerItem(item.tempId)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {itens.length > 0 && (
              <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/30">
                <p className="text-sm text-muted-foreground">{itens.length} produto{itens.length !== 1 ? "s" : ""}</p>
                <p className="font-semibold">Total: {brl(total)}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" asChild>
              <Link to="/painel/pedidos">Cancelar</Link>
            </Button>
            <Button type="submit" size="lg" disabled={salvando || itens.length === 0}>
              <ShoppingCart className="h-4 w-4" /> Criar pedido
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
