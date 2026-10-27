import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, Edit3, Mail, MapPin, Package, Phone, Save, ShoppingCart, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/mock-data";
import { useFornecedores, getFornecedores, editarFornecedor, excluirFornecedor } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import { useEstoque } from "@/lib/estoque-store";
import { usePedidos } from "@/lib/pedidos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/fornecedores/$id")({
  loader: ({ params }) => {
    const f = getFornecedores().find((x) => x.id === params.id);
    if (!f) throw notFound();
    return f;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.nome ?? "Fornecedor"} — OmniSafe 360` },
      { name: "description", content: "Ficha do fornecedor com contatos, produtos e pedidos de compra." },
      { property: "og:title", content: `${loaderData?.nome ?? "Fornecedor"} — OmniSafe 360` },
      { property: "og:description", content: "Ficha do fornecedor no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  notFoundComponent: () => <p className="text-muted-foreground">Fornecedor não encontrado.</p>,
  component: Ficha,
});

type FForm = { nome: string; cnpj: string; contato: string; telefone: string; email: string; cidade: string; prazo: string };

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  confirmado: "Confirmado",
  parcial: "Parcialmente recebido",
  recebido: "Recebido",
  cancelado: "Cancelado",
};
const STATUS_COR: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-primary/10 text-primary",
  confirmado: "bg-success/12 text-success",
  parcial: "bg-warning/15 text-warning",
  recebido: "bg-success/12 text-success",
  cancelado: "bg-destructive/10 text-destructive",
};

function Ficha() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const todos = useFornecedores();
  const f = todos.find((x) => x.id === id);

  const produtos = useProdutos();
  const est = useEstoque();
  const { pedidos } = usePedidos();

  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [form, setForm] = useState<FForm>({ nome: "", cnpj: "", contato: "", telefone: "", email: "", cidade: "", prazo: "" });

  const mesPedidos = useMemo(() => {
    if (!f) return [];
    return pedidos.filter((p) => p.fornecedorId === f.id).sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));
  }, [pedidos, f]);

  const itens = useMemo(() => (f ? produtos.filter((p) => p.fornecedor === f.nome) : []), [produtos, f]);

  if (!f) return <p className="text-muted-foreground">Fornecedor não encontrado.</p>;

  const pendentes = mesPedidos.filter((p) => ["enviado", "confirmado", "parcial"].includes(p.status));
  const totalPedidos = mesPedidos.reduce((s, p) => s + p.total, 0);

  const abrirEdicao = () => {
    setForm({ nome: f.nome, cnpj: f.cnpj, contato: f.contato, telefone: f.telefone, email: f.email, cidade: f.cidade, prazo: f.prazo });
    setEditando(true);
  };

  const cancelar = () => { setEditando(false); setConfirmando(false); };

  const salvar = () => {
    if (!form.nome.trim()) { toast.error("Nome não pode ser vazio."); return; }
    editarFornecedor(f.id, { ...form, nome: form.nome.trim() });
    setEditando(false);
    toast.success("Fornecedor atualizado!");
  };

  const confirmarExclusao = () => {
    excluirFornecedor(f.id);
    toast.success(`"${f.nome}" excluído.`);
    navigate({ to: "/painel/fornecedores" });
  };

  const info = [
    f.contato && { icon: User, l: "Contato", v: f.contato },
    f.telefone && { icon: Phone, l: "Telefone", v: f.telefone },
    f.email && { icon: Mail, l: "E-mail", v: f.email },
    f.cidade && { icon: MapPin, l: "Cidade", v: f.cidade },
    f.prazo && { icon: Clock, l: "Prazo de pagamento", v: f.prazo },
  ].filter(Boolean) as { icon: typeof User; l: string; v: string }[];

  return (
    <div className="space-y-6">
      <Link to="/painel/fornecedores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Fornecedores
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-brand p-8 text-primary-foreground">
        <div className="flex items-center gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 font-display text-2xl font-bold">
            {f.nome[0]}
          </span>
          <div>
            <h1 className="text-3xl font-bold">{f.nome}</h1>
            {f.cnpj && <p className="font-mono text-sm text-primary-foreground/75">CNPJ {f.cnpj}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editando ? (
            <>
              <Button variant="secondary" onClick={abrirEdicao}><Edit3 className="h-4 w-4" /> Editar</Button>
              <Button variant="destructive" size="icon" onClick={() => setConfirmando(true)} title="Excluir fornecedor">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={cancelar}><X className="h-4 w-4" /> Cancelar</Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: Package, l: "Produtos", v: itens.length },
          { icon: ShoppingCart, l: "Pedidos total", v: mesPedidos.length },
          { icon: ShoppingCart, l: "Em aberto", v: pendentes.length },
          { icon: ShoppingCart, l: "Volume total", v: brl(totalPedidos) },
        ].map(({ icon: Icon, l, v }) => (
          <div key={l} className="rounded-xl border bg-card px-4 py-4">
            <Icon className="h-4 w-4 text-primary mb-1.5" />
            <p className="text-xl font-bold">{v}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{l}</p>
          </div>
        ))}
      </div>

      {/* Confirmação de exclusão */}
      {confirmando && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="font-semibold text-destructive">Excluir "{f.nome}"?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. O fornecedor será removido permanentemente.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="destructive" onClick={confirmarExclusao}><Trash2 className="h-4 w-4" /> Confirmar exclusão</Button>
            <Button variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Formulário de edição */}
      {editando && (
        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Editar fornecedor</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome / razão social</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ / CPF</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Prazo de pagamento</Label>
              <Input value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} placeholder="Ex.: 30 dias" />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
            <Button onClick={salvar}><Save className="h-4 w-4" /> Salvar alterações</Button>
          </div>
        </div>
      )}

      {/* Layout duas colunas */}
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Contato */}
        <div className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Dados de contato</h2>
          {info.length > 0 ? (
            <div className="space-y-4">
              {info.map(({ icon: Icon, l, v }) => (
                <div key={l} className="flex gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{l}</p>
                    <p className="font-medium">{v}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado de contato cadastrado.</p>
          )}
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={abrirEdicao}>
            <Edit3 className="h-4 w-4" /> Editar contato
          </Button>
        </div>

        {/* Produtos fornecidos */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <h2 className="border-b p-5 text-lg font-semibold">
            Produtos fornecidos <span className="text-muted-foreground font-normal text-base">({itens.length})</span>
          </h2>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Produto</th>
                <th className="px-5 py-3 text-right">Preço</th>
                <th className="px-5 py-3 text-right">Estoque</th>
                <th className="px-5 py-3 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itens.map((p) => {
                const dep = est.lotes.filter((l) => l.produtoId === p.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0);
                const gond = est.gondola[p.id] ?? 0;
                const total = dep + gond;
                const sit: "ok" | "baixo" | "sem" = total === 0 ? "sem" : gond <= p.minimo ? "baixo" : "ok";
                const labels = { ok: "Estoque ok", baixo: "Repor gôndola", sem: "Sem estoque" };
                const cores = { ok: "bg-success/12 text-success", baixo: "bg-warning/15 text-warning", sem: "bg-destructive/10 text-destructive" };
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <Link to="/painel/produtos/$id" params={{ id: p.id }} className="group">
                        <p className="font-semibold group-hover:text-primary">{p.nome}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.codigo}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right">{brl(p.preco)}</td>
                    <td className="px-5 py-3 text-right">{total} un</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", cores[sit])}>
                        {labels[sit]}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Nenhum produto vinculado a este fornecedor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de pedidos */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-lg font-semibold">
            Pedidos de compra <span className="text-muted-foreground font-normal text-base">({mesPedidos.length})</span>
          </h2>
          <Link
            to="/painel/pedidos/novo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <ShoppingCart className="h-4 w-4" /> Novo pedido
          </Link>
        </div>
        {mesPedidos.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum pedido de compra com este fornecedor ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Número</th>
                <th className="px-5 py-3">Emissão</th>
                <th className="px-5 py-3">Prev. entrega</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mesPedidos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3">
                    <Link to="/painel/pedidos/$id" params={{ id: p.id }} className="font-semibold hover:text-primary">
                      {p.numero}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {p.dataEmissao ? new Date(p.dataEmissao).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {p.dataPrevista ? new Date(p.dataPrevista).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">{brl(p.total)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_COR[p.status] ?? "bg-muted text-muted-foreground")}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
