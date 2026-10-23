import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Edit3, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, categorias } from "@/lib/mock-data";
import { useProdutos, getProdutos, editarProduto } from "@/lib/produtos-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import { useEstoque } from "@/lib/estoque-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/produtos/$id")({
  loader: ({ params }) => {
    const p = getProdutos().find((x) => x.id === params.id);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.nome ?? "Produto"} — OmniSafe 360` },
      { name: "description", content: "Detalhe e edição do produto no OmniSafe 360." },
      { property: "og:title", content: `${loaderData?.nome ?? "Produto"} — OmniSafe 360` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  notFoundComponent: () => <p className="text-muted-foreground">Produto não encontrado.</p>,
  component: ProdutoDetalhe,
});

function ProdutoDetalhe() {
  const { id } = Route.useParams();
  const todos = useProdutos();
  const produto = todos.find((p) => p.id === id);

  const fornecedores = useFornecedores();
  const est = useEstoque();

  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ nome: "", categoria: "", fornecedor: "", preco: "", minimo: "" });

  if (!produto) return <p className="text-muted-foreground">Produto não encontrado.</p>;

  const dep = est.lotes.filter((l) => l.produtoId === produto.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0);
  const gond = est.gondola[produto.id] ?? 0;
  const lotesDoProduto = est.lotes.filter((l) => l.produtoId === produto.id && l.qtd > 0);

  const abrirEdicao = () => {
    setF({ nome: produto.nome, categoria: produto.categoria, fornecedor: produto.fornecedor, preco: String(produto.preco), minimo: String(produto.minimo) });
    setEditando(true);
  };

  const cancelar = () => setEditando(false);

  const salvar = () => {
    if (!f.nome.trim()) { toast.error("Nome não pode ser vazio."); return; }
    editarProduto(produto.id, {
      nome: f.nome.trim(),
      categoria: f.categoria,
      fornecedor: f.fornecedor,
      preco: Number(f.preco.replace(",", ".")) || produto.preco,
      minimo: Number(f.minimo) || produto.minimo,
    });
    setEditando(false);
    toast.success("Produto atualizado!");
  };

  return (
    <div className="space-y-6">
      <Link to="/painel/produtos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Produtos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-brand p-8 text-primary-foreground">
        <div>
          <p className="font-mono text-sm text-primary-foreground/75">{produto.codigo}</p>
          <h1 className="text-3xl font-bold">{produto.nome}</h1>
          <p className="mt-1 text-primary-foreground/75">{produto.categoria} · {produto.fornecedor}</p>
        </div>
        {!editando
          ? <Button variant="secondary" onClick={abrirEdicao}><Edit3 className="h-4 w-4" /> Editar</Button>
          : <Button variant="secondary" onClick={cancelar}><X className="h-4 w-4" /> Cancelar</Button>
        }
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Depósito", v: `${dep} un` },
          { l: "Gôndola", v: `${gond} un` },
          { l: "Mínimo gôndola", v: `${produto.minimo} un` },
          { l: "Preço de venda", v: brl(produto.preco) },
        ].map((c) => (
          <div key={c.l} className="rounded-2xl border bg-card p-5">
            <p className="text-xs uppercase text-muted-foreground">{c.l}</p>
            <p className="font-display text-2xl font-bold">{c.v}</p>
          </div>
        ))}
      </div>

      {editando && (
        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Editar produto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome</Label>
              <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Preço de venda (R$)</Label>
              <Input inputMode="decimal" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mínimo na gôndola</Label>
              <Input inputMode="numeric" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="flex flex-wrap gap-1.5">
                {categorias.map((c) => (
                  <button key={c} type="button" onClick={() => setF({ ...f, categoria: c })}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", f.categoria === c ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50")}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.fornecedor}
                onChange={(e) => setF({ ...f, fornecedor: e.target.value })}>
                <option value="">(sem fornecedor)</option>
                {fornecedores.map((x) => <option key={x.id} value={x.nome}>{x.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
            <Button onClick={salvar}><Save className="h-4 w-4" /> Salvar alterações</Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card">
        <h2 className="border-b p-5 font-semibold">Lotes em estoque</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Lote</th>
              <th className="px-5 py-3">Validade</th>
              <th className="px-5 py-3 text-right">Qtd no depósito</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lotesDoProduto.length === 0
              ? <tr><td colSpan={3} className="p-5 text-center text-muted-foreground">Sem lotes em estoque.</td></tr>
              : lotesDoProduto.map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3 font-mono">{l.lote}</td>
                    <td className="px-5 py-3">{l.validade.split("-").reverse().join("/")}</td>
                    <td className="px-5 py-3 text-right font-medium">{l.qtd}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
