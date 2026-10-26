import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Edit3, MapPin, Save, Trash2, Warehouse, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, categorias, type LocalDeposito, type LocalGondola } from "@/lib/mock-data";
import { useProdutos, getProdutos, editarProduto, excluirProduto } from "@/lib/produtos-store";
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

type FormState = {
  nome: string; categoria: string; fornecedor: string; preco: string; minimo: string;
  depRua: string; depPrateleira: string; depNivel: string;
  gondCorredor: string; gondGondola: string; gondNivel: "" | "Alto" | "Médio" | "Baixo"; gondPosicao: string;
};

function ProdutoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const todos = useProdutos();
  const produto = todos.find((p) => p.id === id);

  const fornecedores = useFornecedores();
  const est = useEstoque();

  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [f, setF] = useState<FormState>({
    nome: "", categoria: "", fornecedor: "", preco: "", minimo: "",
    depRua: "", depPrateleira: "", depNivel: "",
    gondCorredor: "", gondGondola: "", gondNivel: "", gondPosicao: "",
  });

  if (!produto) return <p className="text-muted-foreground">Produto não encontrado.</p>;

  const dep = est.lotes.filter((l) => l.produtoId === produto.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0);
  const gond = est.gondola[produto.id] ?? 0;
  const lotesDoProduto = est.lotes.filter((l) => l.produtoId === produto.id && l.qtd > 0);

  const abrirEdicao = () => {
    const ld = produto.localDeposito;
    const lg = produto.localGondola;
    setF({
      nome: produto.nome, categoria: produto.categoria, fornecedor: produto.fornecedor,
      preco: String(produto.preco), minimo: String(produto.minimo),
      depRua: ld?.rua ?? "", depPrateleira: ld?.prateleira ?? "", depNivel: ld ? String(ld.nivel) : "",
      gondCorredor: lg?.corredor ?? "", gondGondola: lg?.gondola ?? "",
      gondNivel: lg?.nivel ?? "", gondPosicao: lg ? String(lg.posicao) : "",
    });
    setEditando(true);
  };

  const cancelar = () => { setEditando(false); setConfirmando(false); };

  const salvar = () => {
    if (!f.nome.trim()) { toast.error("Nome não pode ser vazio."); return; }
    const localDeposito: LocalDeposito | undefined = f.depRua && f.depPrateleira && f.depNivel
      ? { rua: f.depRua, prateleira: f.depPrateleira, nivel: Number(f.depNivel) }
      : undefined;
    const localGondola: LocalGondola | undefined = f.gondCorredor && f.gondGondola && f.gondNivel && f.gondPosicao
      ? { corredor: f.gondCorredor, gondola: f.gondGondola, nivel: f.gondNivel as "Alto" | "Médio" | "Baixo", posicao: Number(f.gondPosicao) }
      : undefined;
    editarProduto(produto.id, {
      nome: f.nome.trim(),
      categoria: f.categoria,
      fornecedor: f.fornecedor,
      preco: Number(f.preco.replace(",", ".")) || produto.preco,
      minimo: Number(f.minimo) || produto.minimo,
      localDeposito,
      localGondola,
    });
    setEditando(false);
    toast.success("Produto atualizado!");
  };

  const confirmarExclusao = () => {
    excluirProduto(produto.id);
    toast.success(`"${produto.nome}" excluído.`);
    navigate({ to: "/painel/produtos" });
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
        <div className="flex gap-2">
          {!editando ? (
            <>
              <Button variant="secondary" onClick={abrirEdicao}><Edit3 className="h-4 w-4" /> Editar</Button>
              <Button variant="destructive" size="icon" onClick={() => setConfirmando(true)} title="Excluir produto"><Trash2 className="h-4 w-4" /></Button>
            </>
          ) : (
            <Button variant="secondary" onClick={cancelar}><X className="h-4 w-4" /> Cancelar</Button>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="font-semibold text-destructive">Excluir "{produto.nome}"?</p>
          <p className="mt-1 text-sm text-muted-foreground">Esta ação não pode ser desfeita. Todos os dados do produto serão removidos.</p>
          <div className="mt-4 flex gap-3">
            <Button variant="destructive" onClick={confirmarExclusao}><Trash2 className="h-4 w-4" /> Confirmar exclusão</Button>
            <Button variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

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
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">Localização no depósito <span className="font-normal">(opcional)</span></p>
            <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Rua</Label><Input value={f.depRua} onChange={(e) => setF({ ...f, depRua: e.target.value })} placeholder="Ex.: A" /></div>
              <div className="space-y-2"><Label>Prateleira</Label><Input value={f.depPrateleira} onChange={(e) => setF({ ...f, depPrateleira: e.target.value })} placeholder="Ex.: B3" /></div>
              <div className="space-y-2"><Label>Nível</Label><Input inputMode="numeric" value={f.depNivel} onChange={(e) => setF({ ...f, depNivel: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 2" /></div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">Localização na gôndola <span className="font-normal">(opcional)</span></p>
            <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
              <div className="space-y-2"><Label>Corredor</Label><Input value={f.gondCorredor} onChange={(e) => setF({ ...f, gondCorredor: e.target.value })} placeholder="Ex.: 3" /></div>
              <div className="space-y-2"><Label>Gôndola</Label><Input value={f.gondGondola} onChange={(e) => setF({ ...f, gondGondola: e.target.value })} placeholder="Ex.: G2" /></div>
              <div className="space-y-2">
                <Label>Nível</Label>
                <div className="flex gap-1.5">
                  {(["Alto", "Médio", "Baixo"] as const).map((n) => (
                    <button key={n} type="button" onClick={() => setF({ ...f, gondNivel: n })}
                      className={cn("flex-1 rounded-lg border py-2 text-xs font-semibold", f.gondNivel === n ? "border-primary bg-primary text-primary-foreground" : "")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2"><Label>Posição</Label><Input inputMode="numeric" value={f.gondPosicao} onChange={(e) => setF({ ...f, gondPosicao: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 4" /></div>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
            <Button onClick={salvar}><Save className="h-4 w-4" /> Salvar alterações</Button>
          </div>
        </div>
      )}

      {(produto.localDeposito || produto.localGondola) && !editando && (
        <div className="grid gap-4 sm:grid-cols-2">
          {produto.localDeposito && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Localização no Depósito</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[{ label: "Rua", val: produto.localDeposito.rua }, { label: "Prateleira", val: produto.localDeposito.prateleira }, { label: "Nível", val: produto.localDeposito.nivel }].map((c) => (
                  <div key={c.label} className="rounded-lg bg-muted p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">{c.label}</p>
                    <p className="font-display text-lg font-bold">{c.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {produto.localGondola && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Localização na Gôndola</h2>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[{ label: "Corredor", val: produto.localGondola.corredor }, { label: "Gôndola", val: produto.localGondola.gondola }, { label: "Nível", val: produto.localGondola.nivel }, { label: "Posição", val: String(produto.localGondola.posicao) }].map((c) => (
                  <div key={c.label} className="rounded-lg bg-muted p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">{c.label}</p>
                    <p className="font-display text-sm font-bold">{c.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
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
