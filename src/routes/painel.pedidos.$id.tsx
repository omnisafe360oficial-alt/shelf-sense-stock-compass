import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Package, Pencil, Plus, Send, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePedidos, atualizarStatusPedido, receberItemPedido, editarPedido, excluirPedido } from "@/lib/pedidos-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import type { PedidoStatus, ItemPedido } from "@/lib/pedidos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/pedidos/$id")({
  head: () => ({ meta: [{ title: "Pedido — OmniSafe 360" }] }),
  component: DetalhesPedido,
});

const STATUS_LABEL: Record<PedidoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  confirmado: "Confirmado",
  parcial: "Parcial",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<PedidoStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  parcial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  recebido: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

type ItemForm = Omit<ItemPedido, "id" | "qtdRecebida">;
const ITEM_VAZIO: ItemForm = { produtoId: "", qtdSolicitada: 1, precoUnitario: 0, unidade: "un" };

function DetalhesPedido() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { pedidos } = usePedidos();
  const produtos = useProdutos();
  const fornecedores = useFornecedores();
  const pedido = pedidos.find((p) => p.id === id);

  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // form de edição
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itensEdit, setItensEdit] = useState<ItemForm[]>([]);

  if (!pedido) return (
    <div className="space-y-4">
      <Link to="/painel/pedidos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar aos pedidos
      </Link>
      <p className="text-muted-foreground">Pedido não encontrado.</p>
    </div>
  );

  const nomeProduto = (pid: string) => produtos.find((p) => p.id === pid)?.nome ?? "Produto";
  const podaReceber = pedido.status === "confirmado" || pedido.status === "parcial";
  const podaEditar = pedido.status === "rascunho";

  const abrirEdicao = () => {
    setFornecedorId(pedido.fornecedorId ?? "");
    setFornecedorNome(pedido.fornecedorNome);
    setDataPrevista(pedido.dataPrevista);
    setObservacao(pedido.observacao);
    setItensEdit(pedido.itens.map((i) => ({
      produtoId: i.produtoId,
      qtdSolicitada: i.qtdSolicitada,
      precoUnitario: i.precoUnitario,
      unidade: i.unidade,
    })));
    setEditando(true);
  };

  const setItem = <K extends keyof ItemForm>(i: number, k: K, v: ItemForm[K]) =>
    setItensEdit((prev) => prev.map((item, idx) => (idx === i ? { ...item, [k]: v } : item)));

  const salvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedorNome.trim()) { toast.error("Informe o fornecedor"); return; }
    if (itensEdit.some((i) => !i.produtoId)) { toast.error("Selecione o produto em todos os itens"); return; }
    editarPedido(id, { fornecedorId: fornecedorId || null, fornecedorNome, dataPrevista, observacao, itens: itensEdit });
    toast.success("Pedido atualizado!");
    setEditando(false);
  };

  const handleReceber = () => {
    let alguma = false;
    for (const item of pedido.itens) {
      const qtd = qtds[item.id] ?? item.qtdRecebida;
      if (qtd !== item.qtdRecebida) {
        receberItemPedido(pedido.id, item.id, qtd);
        alguma = true;
      }
    }
    if (alguma) toast.success("Recebimento registrado!");
    else toast.info("Nenhuma quantidade foi alterada");
  };

  const handleCancelar = () => {
    atualizarStatusPedido(pedido.id, "cancelado");
    toast.success("Pedido cancelado");
    navigate({ to: "/painel/pedidos" });
  };

  const handleExcluir = () => {
    excluirPedido(pedido.id);
    toast.success("Pedido excluído");
    navigate({ to: "/painel/pedidos" });
  };

  // ─── Modo edição ──────────────────────────────────────────────────────────────

  if (editando) {
    const totalEdit = itensEdit.reduce((s, i) => s + i.qtdSolicitada * i.precoUnitario, 0);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditando(false)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-bold">Editar Pedido {pedido.numero}</h1>
        </div>

        <form onSubmit={salvarEdicao} className="space-y-6">
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
            <div className="space-y-2">
              <Label>Entrega prevista</Label>
              <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Itens do pedido</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setItensEdit((p) => [...p, { ...ITEM_VAZIO }])}>
                <Plus className="mr-1 h-4 w-4" /> Item
              </Button>
            </div>
            <div className="space-y-3">
              {itensEdit.map((item, idx) => (
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
                    <Input type="number" min="1" value={item.qtdSolicitada} onChange={(e) => setItem(idx, "qtdSolicitada", Number(e.target.value))} />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Preço unit.</Label>
                    <Input type="number" min="0" step="0.01" value={item.precoUnitario} onChange={(e) => setItem(idx, "precoUnitario", Number(e.target.value))} />
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Unidade</Label>
                    <Input value={item.unidade} onChange={(e) => setItem(idx, "unidade", e.target.value)} />
                  </div>
                  {itensEdit.length > 1 && (
                    <button
                      type="button"
                      className="mb-1 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setItensEdit((p) => p.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 text-sm font-semibold">
              Total: R$ {totalEdit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
            <Button type="submit">Salvar alterações</Button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Modo visualização ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/painel/pedidos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar aos pedidos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{pedido.numero}</h1>
            <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", STATUS_COLOR[pedido.status])}>
              {STATUS_LABEL[pedido.status]}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{pedido.fornecedorNome || "Sem fornecedor"}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {podaEditar && (
            <Button variant="outline" onClick={abrirEdicao} className="gap-2">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
          {pedido.status === "rascunho" && (
            <Button onClick={() => { atualizarStatusPedido(pedido.id, "enviado"); toast.success("Pedido enviado!"); }} className="gap-2">
              <Send className="h-4 w-4" /> Enviar pedido
            </Button>
          )}
          {pedido.status === "enviado" && (
            <Button variant="outline" onClick={() => { atualizarStatusPedido(pedido.id, "confirmado"); toast.success("Pedido confirmado!"); }} className="gap-2">
              <CheckCircle className="h-4 w-4" /> Confirmar pedido
            </Button>
          )}
          {podaReceber && (
            <Button onClick={handleReceber} className="gap-2">
              <Package className="h-4 w-4" /> Registrar recebimento
            </Button>
          )}
          {!["recebido", "cancelado"].includes(pedido.status) && (
            <Button variant="destructive" onClick={handleCancelar} className="gap-2">
              <XCircle className="h-4 w-4" /> Cancelar
            </Button>
          )}
          {pedido.status === "rascunho" && (
            <Button variant="ghost" size="icon" onClick={() => setConfirmando(true)} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-5 space-y-3">
          <p className="font-semibold text-destructive">Excluir pedido {pedido.numero}?</p>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. Todos os itens do pedido serão removidos.</p>
          <div className="flex gap-3">
            <Button variant="destructive" onClick={handleExcluir}>Sim, excluir</Button>
            <Button variant="outline" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Emitido em</p>
          <p className="font-semibold">{pedido.dataEmissao || "—"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Entrega prevista</p>
          <p className="font-semibold">{pedido.dataPrevista || "—"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="font-semibold">R$ {pedido.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {pedido.observacao && (
        <div className="rounded-2xl border bg-muted/50 px-5 py-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observação</p>
          <p className="mt-1">{pedido.observacao}</p>
        </div>
      )}

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Itens do pedido ({pedido.itens.length})</h2>
        </div>
        <div className="divide-y">
          {pedido.itens.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{nomeProduto(item.produtoId)}</p>
                <p className="text-sm text-muted-foreground">
                  {item.qtdSolicitada} {item.unidade} × R$ {item.precoUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  R$ {(item.qtdSolicitada * item.precoUnitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                {podaReceber ? (
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="text-xs text-muted-foreground">Recebido:</span>
                    <Input
                      type="number" min="0" max={item.qtdSolicitada}
                      value={qtds[item.id] ?? item.qtdRecebida}
                      onChange={(e) => setQtds((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                      className="h-7 w-20 text-right text-sm"
                    />
                    <span className="text-xs text-muted-foreground">/ {item.qtdSolicitada}</span>
                  </div>
                ) : item.qtdRecebida > 0 && (
                  <p className="text-xs text-muted-foreground">Recebido: {item.qtdRecebida} / {item.qtdSolicitada}</p>
                )}
              </div>
            </div>
          ))}
          {pedido.itens.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              Nenhum item neste pedido.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
