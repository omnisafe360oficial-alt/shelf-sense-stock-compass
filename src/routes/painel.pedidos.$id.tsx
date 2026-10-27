import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle, ChevronRight, Edit3, FileUp, Package,
  Plus, Save, Send, Trash2, X, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  usePedidos, atualizarStatusPedido, receberItemPedido,
  editarPedido, excluirPedido,
} from "@/lib/pedidos-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import type { PedidoStatus, ItemPedido } from "@/lib/pedidos-store";
import { brl } from "@/lib/mock-data";
import { lerNfe } from "@/lib/nfe";
import { cn } from "@/lib/utils";

type ConcItem = {
  item: ItemPedido;
  nomeProd: string;
  codigoProd: string;
  qtdNf: number | null;
};

export const Route = createFileRoute("/painel/pedidos/$id")({
  head: () => ({
    meta: [
      { title: "Pedido — OmniSafe 360" },
      { name: "description", content: "Detalhes e recebimento de pedido de compra." },
      { property: "og:title", content: "Pedido — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DetalhesPedido,
});

const SIT: Record<PedidoStatus, { t: string; c: string; borda: string }> = {
  rascunho:   { t: "Rascunho",   c: "bg-muted text-muted-foreground",              borda: "border-muted-foreground/20" },
  enviado:    { t: "Enviado",    c: "bg-primary/10 text-primary",                  borda: "border-primary/30" },
  confirmado: { t: "Confirmado", c: "bg-success/12 text-success",                  borda: "border-success/30" },
  parcial:    { t: "Parcial",    c: "bg-warning/15 text-warning",                  borda: "border-warning/30" },
  recebido:   { t: "Recebido",   c: "bg-success/20 text-success",                  borda: "border-success/50" },
  cancelado:  { t: "Cancelado",  c: "bg-destructive/10 text-destructive",          borda: "border-destructive/30" },
};

const STEPS: { status: PedidoStatus; t: string }[] = [
  { status: "rascunho", t: "Rascunho" },
  { status: "enviado", t: "Enviado" },
  { status: "confirmado", t: "Confirmado" },
  { status: "recebido", t: "Recebido" },
];

const fmtData = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

type ItemForm = Omit<ItemPedido, "id" | "qtdRecebida">;
const ITEM_VAZIO: ItemForm = { produtoId: "", qtdSolicitada: 1, precoUnitario: 0, unidade: "un" };

function BarraProgresso({ status }: { status: PedidoStatus }) {
  if (status === "cancelado") {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <XCircle className="h-4 w-4" /> Pedido cancelado
      </div>
    );
  }
  const idxAtual = status === "parcial" ? 2 : STEPS.findIndex((s) => s.status === status);
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1">
      {STEPS.map((step, i) => {
        const ativo = i <= idxAtual;
        const atual = i === idxAtual || (status === "parcial" && i === 2);
        return (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 transition",
                ativo
                  ? atual
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-success bg-success text-success-foreground"
                  : "border-muted bg-muted text-muted-foreground",
              )}>
                {ativo && !atual ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
              </div>
              <span className={cn("whitespace-nowrap text-[11px] font-medium", ativo ? "text-foreground" : "text-muted-foreground")}>
                {step.t}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-1 mb-5 h-0.5 w-8 shrink-0 sm:w-12", i < idxAtual ? "bg-success" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetalhesPedido() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { pedidos } = usePedidos();
  const produtos = useProdutos();
  const fornecedores = useFornecedores();
  const pedido = pedidos.find((p) => p.id === id);

  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState<"cancelar" | "excluir" | null>(null);
  const [showXml, setShowXml] = useState(false);
  const [xmlDrag, setXmlDrag] = useState(false);
  const [conciliacao, setConciliacao] = useState<ConcItem[] | null>(null);
  const [nfNumero, setNfNumero] = useState("");
  const xmlInputRef = useRef<HTMLInputElement>(null);

  const [eFornecedorId, setEFornecedorId] = useState("");
  const [eFornecedorNome, setEFornecedorNome] = useState("");
  const [eDataPrevista, setEDataPrevista] = useState("");
  const [eObservacao, setEObservacao] = useState("");
  const [eItens, setEItens] = useState<ItemForm[]>([]);

  if (!pedido) return (
    <div className="space-y-4">
      <Link to="/painel/pedidos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </Link>
      <p className="text-muted-foreground">Pedido não encontrado.</p>
    </div>
  );

  const nomeProduto = (pid: string) => produtos.find((p) => p.id === pid)?.nome ?? "Produto removido";
  const podaReceber = pedido.status === "confirmado" || pedido.status === "parcial";
  const podaEditar = pedido.status === "rascunho";

  const totalRecebido = useMemo(
    () => pedido.itens.reduce((s, i) => s + (qtds[i.id] ?? i.qtdRecebida), 0),
    [pedido.itens, qtds],
  );
  const totalSolicitado = pedido.itens.reduce((s, i) => s + i.qtdSolicitada, 0);
  const pctRecebido = totalSolicitado > 0 ? Math.min(100, (totalRecebido / totalSolicitado) * 100) : 0;

  const abrirEdicao = () => {
    setEFornecedorId(pedido.fornecedorId ?? "");
    setEFornecedorNome(pedido.fornecedorNome);
    setEDataPrevista(pedido.dataPrevista);
    setEObservacao(pedido.observacao);
    setEItens(pedido.itens.map((i) => ({
      produtoId: i.produtoId, qtdSolicitada: i.qtdSolicitada,
      precoUnitario: i.precoUnitario, unidade: i.unidade,
    })));
    setEditando(true);
  };

  const setEItem = <K extends keyof ItemForm>(i: number, k: K, v: ItemForm[K]) =>
    setEItens((prev) => prev.map((item, idx) => (idx === i ? { ...item, [k]: v } : item)));

  const salvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eFornecedorNome.trim()) { toast.error("Informe o fornecedor."); return; }
    if (eItens.some((i) => !i.produtoId)) { toast.error("Selecione o produto em todos os itens."); return; }
    editarPedido(id, { fornecedorId: eFornecedorId || null, fornecedorNome: eFornecedorNome, dataPrevista: eDataPrevista, observacao: eObservacao, itens: eItens });
    toast.success("Pedido atualizado!");
    setEditando(false);
  };

  const carregarXml = (xml: string) => {
    try {
      const n = lerNfe(xml);
      setNfNumero(n.numero);
      const conc: ConcItem[] = pedido.itens.map((item) => {
        const prod = produtos.find((p) => p.id === item.produtoId);
        const nfItem = n.itens.find((ni) => ni.codigo === prod?.codigo);
        return {
          item,
          nomeProd: nomeProduto(item.produtoId),
          codigoProd: prod?.codigo ?? "—",
          qtdNf: nfItem ? nfItem.qtdCompra : null,
        };
      });
      setConciliacao(conc);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirmarXml = () => {
    if (!conciliacao) return;
    for (const c of conciliacao) {
      receberItemPedido(pedido.id, c.item.id, c.qtdNf ?? 0);
    }
    const nDiv = conciliacao.filter((c) => c.qtdNf === null || c.qtdNf !== c.item.qtdSolicitada).length;
    if (nDiv > 0) {
      toast.warning(`Recebimento registrado com ${nDiv} divergência${nDiv !== 1 ? "s" : ""} — pedido parcial`);
    } else {
      toast.success(`NF nº ${nfNumero} conciliada — pedido recebido`);
    }
    setConciliacao(null);
    setShowXml(false);
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
    if (alguma) toast.success("Recebimento salvo!");
    else toast.info("Nenhuma quantidade foi alterada.");
    setQtds({});
  };

  const handleCancelar = () => {
    atualizarStatusPedido(pedido.id, "cancelado");
    toast.success("Pedido cancelado.");
    navigate({ to: "/painel/pedidos" });
  };

  const handleExcluir = () => {
    excluirPedido(pedido.id);
    toast.success("Pedido excluído.");
    navigate({ to: "/painel/pedidos" });
  };

  // ─── Modo edição ─────────────────────────────────────────────────────────────

  if (editando) {
    const totalEdit = eItens.reduce((s, i) => s + i.qtdSolicitada * i.precoUnitario, 0);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditando(false)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">Editar {pedido.numero}</h1>
        </div>

        <form onSubmit={salvarEdicao} className="space-y-5">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <h2 className="font-semibold">Fornecedor e datas</h2>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              {fornecedores.length > 0 && (
                <Select value={eFornecedorId} onValueChange={(v) => {
                  const f = fornecedores.find((x) => x.id === v);
                  setEFornecedorId(v); setEFornecedorNome(f?.nome ?? "");
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
                  <SelectContent>{fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {!eFornecedorId && <Input placeholder="Ou digitar nome manualmente" value={eFornecedorNome} onChange={(e) => setEFornecedorNome(e.target.value)} />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrega prevista</Label>
                <Input type="date" value={eDataPrevista} onChange={(e) => setEDataPrevista(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={eObservacao} onChange={(e) => setEObservacao(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Itens</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setEItens((p) => [...p, { ...ITEM_VAZIO }])}>
                <Plus className="h-4 w-4" /> Item
              </Button>
            </div>
            <div className="space-y-3">
              {eItens.map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/50 p-3">
                  <div className="min-w-0 flex-1 space-y-1" style={{ minWidth: "160px" }}>
                    <Label className="text-xs">Produto</Label>
                    <Select value={item.produtoId} onValueChange={(v) => {
                      const p = produtos.find((x) => x.id === v);
                      setEItem(idx, "produtoId", v);
                      if (p?.preco) setEItem(idx, "precoUnitario", p.preco);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" min="1" value={item.qtdSolicitada} onChange={(e) => setEItem(idx, "qtdSolicitada", Number(e.target.value))} />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Preço unit.</Label>
                    <Input type="number" min="0" step="0.01" value={item.precoUnitario} onChange={(e) => setEItem(idx, "precoUnitario", Number(e.target.value))} />
                  </div>
                  {eItens.length > 1 && (
                    <button type="button" className="mb-1 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setEItens((p) => p.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 text-sm font-semibold">Total: {brl(totalEdit)}</div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
            <Button type="submit"><Save className="h-4 w-4" /> Salvar alterações</Button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Modo visualização ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/painel/pedidos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-brand p-8 text-primary-foreground">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm text-primary-foreground/75">Pedido de compra</p>
            <h1 className="text-3xl font-bold">{pedido.numero}</h1>
            <p className="mt-1 text-primary-foreground/80">
              {pedido.fornecedorNome || "Fornecedor não informado"}
            </p>
          </div>
          <span className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", SIT[pedido.status].c)}>
            {SIT[pedido.status].t}
          </span>
        </div>
        <div className="mt-6">
          <BarraProgresso status={pedido.status} />
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        {podaEditar && (
          <Button variant="outline" onClick={abrirEdicao}><Edit3 className="h-4 w-4" /> Editar</Button>
        )}
        {pedido.status === "rascunho" && (
          <Button onClick={() => { atualizarStatusPedido(pedido.id, "enviado"); toast.success("Pedido marcado como enviado!"); }}>
            <Send className="h-4 w-4" /> Marcar como enviado
          </Button>
        )}
        {pedido.status === "enviado" && (
          <Button variant="outline" onClick={() => { atualizarStatusPedido(pedido.id, "confirmado"); toast.success("Pedido confirmado!"); }}>
            <CheckCircle className="h-4 w-4" /> Confirmar pedido
          </Button>
        )}
        {podaReceber && (
          <>
            <Button onClick={handleReceber}>
              <Package className="h-4 w-4" /> Salvar recebimento
            </Button>
            <Button variant="outline" onClick={() => { setShowXml((v) => !v); setConciliacao(null); }}>
              <FileUp className="h-4 w-4" /> Receber com XML
            </Button>
          </>
        )}
        {!["recebido", "cancelado"].includes(pedido.status) && (
          <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmando("cancelar")}>
            <XCircle className="h-4 w-4" /> Cancelar pedido
          </Button>
        )}
        {podaEditar && (
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmando("excluir")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Confirmação */}
      {confirmando && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <p className="font-semibold text-destructive">
            {confirmando === "cancelar" ? `Cancelar o pedido ${pedido.numero}?` : `Excluir o pedido ${pedido.numero}?`}
          </p>
          <p className="text-sm text-muted-foreground">
            {confirmando === "cancelar"
              ? "O pedido será marcado como cancelado e não poderá mais ser editado."
              : "O pedido será excluído permanentemente. Esta ação não pode ser desfeita."}
          </p>
          <div className="flex gap-3">
            <Button variant="destructive" onClick={confirmando === "cancelar" ? handleCancelar : handleExcluir}>
              {confirmando === "cancelar" ? <XCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              {confirmando === "cancelar" ? "Confirmar cancelamento" : "Confirmar exclusão"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmando(null)}>Voltar</Button>
          </div>
        </div>
      )}

      {/* Receber com XML */}
      {podaReceber && showXml && (
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Conciliar com XML da nota fiscal</h3>
            <button onClick={() => { setShowXml(false); setConciliacao(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!conciliacao ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setXmlDrag(true); }}
              onDragLeave={() => setXmlDrag(false)}
              onDrop={(e) => { e.preventDefault(); setXmlDrag(false); const f = e.dataTransfer.files[0]; f?.text().then(carregarXml); }}
              onClick={() => xmlInputRef.current?.click()}
              className={cn("flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-10 text-center transition", xmlDrag ? "border-primary bg-secondary/50" : "hover:border-primary/50")}
            >
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Arraste o XML da NF-e aqui</p>
              <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
              <input ref={xmlInputRef} type="file" accept=".xml,text/xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; f?.text().then(carregarXml); }} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">NF nº <strong>{nfNumero}</strong> — {conciliacao.length} item{conciliacao.length !== 1 ? "s" : ""} do pedido</p>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Produto</th>
                      <th className="px-4 py-2.5 text-right">Pedido</th>
                      <th className="px-4 py-2.5 text-right">NF</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {conciliacao.map((c) => {
                      const diverge = c.qtdNf === null || c.qtdNf !== c.item.qtdSolicitada;
                      return (
                        <tr key={c.item.id} className={diverge ? "bg-warning/5" : ""}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{c.nomeProd}</p>
                            <p className="font-mono text-xs text-muted-foreground">{c.codigoProd}</p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{c.item.qtdSolicitada}</td>
                          <td className={cn("px-4 py-3 text-right tabular-nums font-semibold",
                            c.qtdNf === null ? "text-destructive" : diverge ? "text-warning" : "text-success")}>
                            {c.qtdNf ?? "Ausente"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {diverge ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                                <AlertTriangle className="h-3 w-3" /> Divergência
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
                                <Check className="h-3 w-3" /> OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {conciliacao.some((c) => c.qtdNf === null || c.qtdNf !== c.item.qtdSolicitada) && (
                <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Divergências detectadas — o pedido ficará como parcial.
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button onClick={confirmarXml}>
                  <Package className="h-4 w-4" /> Confirmar recebimento
                </Button>
                <Button variant="outline" onClick={() => setConciliacao(null)}>Trocar XML</Button>
                <Button variant="ghost" onClick={() => { setConciliacao(null); setShowXml(false); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Emitido em", v: fmtData(pedido.dataEmissao) },
          { l: "Entrega prevista", v: fmtData(pedido.dataPrevista) },
          { l: "Itens solicitados", v: `${totalSolicitado} un` },
          { l: "Valor total", v: brl(pedido.total) },
        ].map(({ l, v }) => (
          <div key={l} className="rounded-2xl border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">{l}</p>
            <p className="mt-1 font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {pedido.observacao && (
        <div className="rounded-xl border bg-muted/40 px-5 py-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observação</p>
          <p>{pedido.observacao}</p>
        </div>
      )}

      {/* Itens */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold">
            Itens do pedido
            <span className="ml-2 text-muted-foreground font-normal text-base">({pedido.itens.length})</span>
          </h2>
          {podaReceber && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pctRecebido}%` }} />
                </div>
                <span className="text-muted-foreground">{Math.round(pctRecebido)}% recebido</span>
              </div>
            </div>
          )}
        </div>
        <div className="divide-y">
          {pedido.itens.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum item neste pedido.</div>
          ) : (
            pedido.itens.map((item) => {
              const qtdAtual = qtds[item.id] ?? item.qtdRecebida;
              const pctItem = item.qtdSolicitada > 0
                ? Math.min(100, (qtdAtual / item.qtdSolicitada) * 100)
                : 0;
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{nomeProduto(item.produtoId)}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.qtdSolicitada} {item.unidade} × {brl(item.precoUnitario)}
                    </p>
                    {podaReceber && (
                      <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pctItem}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{brl(item.qtdSolicitada * item.precoUnitario)}</p>
                    {podaReceber ? (
                      <div className="mt-1 flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">Recebido</span>
                        <Input
                          type="number" min="0" max={item.qtdSolicitada}
                          value={qtdAtual}
                          onChange={(e) => setQtds((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                          className="h-7 w-20 text-right text-sm"
                        />
                        <span className="text-xs text-muted-foreground">/ {item.qtdSolicitada}</span>
                      </div>
                    ) : item.qtdRecebida > 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Recebido: {item.qtdRecebida} / {item.qtdSolicitada}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {podaReceber && pedido.itens.length > 0 && (
          <div className="flex justify-end border-t px-6 py-4">
            <Button onClick={handleReceber}>
              <Package className="h-4 w-4" /> Salvar recebimento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
