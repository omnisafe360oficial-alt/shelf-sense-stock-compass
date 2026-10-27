import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFornecedores } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import { criarPedido } from "@/lib/pedidos-store";
import type { ItemPedido } from "@/lib/pedidos-store";

export const Route = createFileRoute("/painel/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo Pedido — OmniSafe 360" }] }),
  component: NovoPedido,
});

type ItemForm = Omit<ItemPedido, "id" | "qtdRecebida">;

const ITEM_VAZIO: ItemForm = { produtoId: "", qtdSolicitada: 1, precoUnitario: 0, unidade: "un" };

function NovoPedido() {
  const navigate = useNavigate();
  const fornecedores = useFornecedores();
  const produtos = useProdutos();

  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([{ ...ITEM_VAZIO }]);
  const [salvando, setSalvando] = useState(false);

  const setItem = <K extends keyof ItemForm>(i: number, k: K, v: ItemForm[K]) =>
    setItens((prev) => prev.map((item, idx) => (idx === i ? { ...item, [k]: v } : item)));

  const total = itens.reduce((s, i) => s + i.qtdSolicitada * i.precoUnitario, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedorNome.trim()) { toast.error("Informe o fornecedor"); return; }
    if (itens.some((i) => !i.produtoId)) { toast.error("Selecione o produto em todos os itens"); return; }
    setSalvando(true);
    const id = criarPedido({ fornecedorId: fornecedorId || undefined, fornecedorNome, dataPrevista, observacao, itens });
    if (id) {
      toast.success("Pedido criado!");
      navigate({ to: "/painel/pedidos/$id", params: { id } });
    } else {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Novo Pedido de Compra</h1>
        <p className="text-muted-foreground">Crie um pedido para enviar ao fornecedor</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cabeçalho */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Fornecedor e datas</h2>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            {fornecedores.length > 0 && (
              <Select
                value={fornecedorId}
                onValueChange={(v) => {
                  const f = fornecedores.find((x) => x.id === v);
                  setFornecedorId(v);
                  setFornecedorNome(f?.nome ?? "");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar fornecedor cadastrado" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!fornecedorId && (
              <Input
                placeholder={fornecedores.length > 0 ? "Ou digitar nome manualmente" : "Nome do fornecedor"}
                value={fornecedorNome}
                onChange={(e) => setFornecedorNome(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entrega prevista</Label>
              <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Itens do pedido</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setItens((p) => [...p, { ...ITEM_VAZIO }])}>
              <Plus className="mr-1 h-4 w-4" /> Item
            </Button>
          </div>

          <div className="space-y-3">
            {itens.map((item, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/50 p-3">
                <div className="min-w-0 flex-1 space-y-1" style={{ minWidth: "160px" }}>
                  <Label className="text-xs">Produto</Label>
                  <Select
                    value={item.produtoId}
                    onValueChange={(v) => {
                      const p = produtos.find((x) => x.id === v);
                      setItem(idx, "produtoId", v);
                      if (p?.preco) setItem(idx, "precoUnitario", p.preco);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number" min="1"
                    value={item.qtdSolicitada}
                    onChange={(e) => setItem(idx, "qtdSolicitada", Number(e.target.value))}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Preço unit.</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={item.precoUnitario}
                    onChange={(e) => setItem(idx, "precoUnitario", Number(e.target.value))}
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Unidade</Label>
                  <Input value={item.unidade} onChange={(e) => setItem(idx, "unidade", e.target.value)} />
                </div>
                {itens.length > 1 && (
                  <button
                    type="button"
                    className="mb-1 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 text-sm font-semibold">
            Total: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/painel/pedidos" })}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            Criar pedido
          </Button>
        </div>
      </form>
    </div>
  );
}
