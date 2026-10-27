import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Edit3, MapPin, Save, Trash2, Warehouse, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, categorias, type LocalDeposito, type LocalGondola } from "@/lib/mock-data";
import { useProdutos, getProdutos, editarProduto, excluirProduto } from "@/lib/produtos-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import { useEstoque, ajustarEstoque } from "@/lib/estoque-store";
import { cn } from "@/lib/utils";
import { diasAte, exibirValidade, faixaValidade } from "@/lib/estoque-store";

export const Route = createFileRoute("/painel/produtos/$id")({
  loader: ({ params }) => {
    const p = getProdutos().find((x) => x.id === params.id);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.nome ?? "Produto"} — OmniSafe 360` },
      { name: "description", content: "Ficha do produto com estoque, lotes, localização e histórico de movimentações." },
      { property: "og:title", content: `${loaderData?.nome ?? "Produto"} — OmniSafe 360` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  notFoundComponent: () => <p className="text-muted-foreground">Produto não encontrado.</p>,
  component: ProdutoDetalhe,
});

type FormState = {
  nome: string; categoria: string; fornecedor: string; preco: string; minimo: string; maximo: string;
  depRua: string; depPrateleira: string; depNivel: string;
  gondCorredor: string; gondGondola: string; gondNivel: "" | "Alto" | "Médio" | "Baixo"; gondPosicao: string;
};

const MOV_LABEL: Record<string, { t: string; ic: typeof ArrowUp; c: string }> = {
  entrada:      { t: "Entrada no depósito", ic: ArrowDown, c: "text-success" },
  transferencia:{ t: "Reposto na gôndola",  ic: ArrowUp,   c: "text-primary" },
  venda:        { t: "Vendido",              ic: ArrowUp,   c: "text-muted-foreground" },
  ajuste:       { t: "Ajuste de estoque",    ic: ArrowUpDown, c: "text-warning" },
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
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [ajusteVal, setAjusteVal] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [f, setF] = useState<FormState>({
    nome: "", categoria: "", fornecedor: "", preco: "", minimo: "", maximo: "",
    depRua: "", depPrateleira: "", depNivel: "",
    gondCorredor: "", gondGondola: "", gondNivel: "", gondPosicao: "",
  });

  const dep = useMemo(
    () => est.lotes.filter((l) => l.produtoId === produto?.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0),
    [est.lotes, produto?.id],
  );
  const gond = produto ? (est.gondola[produto.id] ?? 0) : 0;
  const lotesDoProduto = useMemo(
    () => est.lotes.filter((l) => l.produtoId === produto?.id && l.qtd > 0).sort((a, b) => a.validade.localeCompare(b.validade)),
    [est.lotes, produto?.id],
  );
  const movsProduto = useMemo(
    () => est.movs.filter((m) => m.produtoId === produto?.id).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 15),
    [est.movs, produto?.id],
  );

  if (!produto) return <p className="text-muted-foreground">Produto não encontrado.</p>;

  const total = dep + gond;
  const sit: "ok" | "baixo" | "sem" =
    total === 0 ? "sem" : gond <= produto.minimo ? "baixo" : "ok";
  const sitLabel = { ok: "Estoque ok", baixo: "Repor gôndola", sem: "Sem estoque" };
  const sitCor = {
    ok:    "bg-success/12 text-success",
    baixo: "bg-warning/15 text-warning",
    sem:   "bg-destructive/10 text-destructive",
  };
  const capacidade = produto.maximo && produto.maximo > 0 ? produto.maximo : produto.minimo > 0 ? produto.minimo * 2 : 0;
  const pctGond = capacidade > 0 ? Math.min(100, (gond / capacidade) * 100) : gond > 0 ? 100 : 0;
  const barCor = gond === 0 ? "bg-destructive" : gond <= produto.minimo ? "bg-warning" : produto.maximo && gond >= produto.maximo ? "bg-primary" : "bg-success";

  const abrirEdicao = () => {
    const ld = produto.localDeposito;
    const lg = produto.localGondola;
    setF({
      nome: produto.nome, categoria: produto.categoria, fornecedor: produto.fornecedor,
      preco: String(produto.preco), minimo: String(produto.minimo), maximo: String(produto.maximo ?? 0),
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
      maximo: Number(f.maximo) || 0,
      localDeposito,
      localGondola,
    });
    setEditando(false);
    toast.success("Produto atualizado!");
  };

  const abrirAjuste = (loteId: string, qtdAtual: number) => {
    setAjustando(loteId);
    setAjusteVal(String(qtdAtual));
    setAjusteMotivo("");
  };

  const salvarAjuste = (loteId: string) => {
    const novo = Number(ajusteVal);
    if (isNaN(novo) || novo < 0) { toast.error("Saldo inválido."); return; }
    if (!ajusteMotivo.trim()) { toast.error("Informe o motivo do ajuste."); return; }
    ajustarEstoque(loteId, novo, ajusteMotivo.trim());
    toast.success("Estoque ajustado.");
    setAjustando(null);
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

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-brand p-8 text-primary-foreground">
        <div>
          <p className="font-mono text-sm text-primary-foreground/75">{produto.codigo}</p>
          <h1 className="text-3xl font-bold">{produto.nome}</h1>
          <p className="mt-1 text-primary-foreground/75">{produto.categoria} · {produto.fornecedor || "Fornecedor não informado"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", sitCor[sit])}>
            {sitLabel[sit]}
          </span>
          {!editando ? (
            <>
              <Button variant="secondary" onClick={abrirEdicao}><Edit3 className="h-4 w-4" /> Editar</Button>
              <Button variant="destructive" size="icon" onClick={() => setConfirmando(true)} title="Excluir produto">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={cancelar}><X className="h-4 w-4" /> Cancelar</Button>
          )}
        </div>
      </div>

      {/* Confirmação de exclusão */}
      {confirmando && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="font-semibold text-destructive">Excluir "{produto.nome}"?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. Todos os dados do produto serão removidos.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="destructive" onClick={confirmarExclusao}><Trash2 className="h-4 w-4" /> Confirmar exclusão</Button>
            <Button variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">No depósito</p>
          <p className="font-display text-2xl font-bold">{dep} un</p>
          <p className="mt-1 text-xs text-muted-foreground">aguardando reposição</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Na gôndola</p>
          <p className="font-display text-2xl font-bold">{gond} un</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all", barCor)} style={{ width: `${pctGond}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">mín: {produto.minimo}{produto.maximo ? ` · máx: ${produto.maximo}` : ""} un</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Total em estoque</p>
          <p className="font-display text-2xl font-bold">{total} un</p>
          <p className="mt-1 text-xs text-muted-foreground">depósito + gôndola</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Preço de venda</p>
          <p className="font-display text-2xl font-bold">{brl(produto.preco)}</p>
          <p className="mt-1 text-xs text-muted-foreground">por unidade</p>
        </div>
      </div>

      {/* Formulário de edição */}
      {editando && (
        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Editar produto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome do produto</Label>
              <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Preço de venda (R$)</Label>
              <Input inputMode="decimal" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mínimo na gôndola <span className="font-normal text-muted-foreground text-xs">— quando atingir esse número, o repositor é avisado</span></Label>
              <Input inputMode="numeric" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div className="space-y-2">
              <Label>Máximo na gôndola <span className="font-normal text-muted-foreground text-xs">— capacidade total da gôndola (0 = não definido)</span></Label>
              <Input inputMode="numeric" value={f.maximo} onChange={(e) => setF({ ...f, maximo: e.target.value.replace(/\D/g, "") })} />
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
            <p className="text-sm font-semibold text-muted-foreground">
              Onde fica no depósito <span className="font-normal">(opcional — ajuda o repositor a encontrar)</span>
            </p>
            <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Rua</Label><Input value={f.depRua} onChange={(e) => setF({ ...f, depRua: e.target.value })} placeholder="Ex.: A" /></div>
              <div className="space-y-2"><Label>Prateleira</Label><Input value={f.depPrateleira} onChange={(e) => setF({ ...f, depPrateleira: e.target.value })} placeholder="Ex.: B3" /></div>
              <div className="space-y-2"><Label>Nível</Label><Input inputMode="numeric" value={f.depNivel} onChange={(e) => setF({ ...f, depNivel: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 2" /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">
              Onde fica na gôndola <span className="font-normal">(opcional)</span>
            </p>
            <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
              <div className="space-y-2"><Label>Corredor</Label><Input value={f.gondCorredor} onChange={(e) => setF({ ...f, gondCorredor: e.target.value })} placeholder="Ex.: 3" /></div>
              <div className="space-y-2"><Label>Gôndola</Label><Input value={f.gondGondola} onChange={(e) => setF({ ...f, gondGondola: e.target.value })} placeholder="Ex.: G2" /></div>
              <div className="space-y-2">
                <Label>Altura</Label>
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

      {/* Localização */}
      {(produto.localDeposito || produto.localGondola) && !editando && (
        <div className="grid gap-4 sm:grid-cols-2">
          {produto.localDeposito && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Onde fica no depósito</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Rua", val: produto.localDeposito.rua },
                  { label: "Prateleira", val: produto.localDeposito.prateleira },
                  { label: "Nível", val: produto.localDeposito.nivel },
                ].map((c) => (
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
                <h2 className="font-semibold">Onde fica na gôndola</h2>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Corredor", val: produto.localGondola.corredor },
                  { label: "Gôndola", val: produto.localGondola.gondola },
                  { label: "Altura", val: produto.localGondola.nivel },
                  { label: "Posição", val: String(produto.localGondola.posicao) },
                ].map((c) => (
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lotes */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <h2 className="border-b p-5 font-semibold">
            Lotes no depósito <span className="text-muted-foreground font-normal text-base">({lotesDoProduto.length})</span>
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Lote</th>
                <th className="px-5 py-3">Validade</th>
                <th className="px-5 py-3 text-right">Qtd</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lotesDoProduto.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum lote no depósito.</td></tr>
              ) : (
                lotesDoProduto.map((l) => {
                  const dias = diasAte(l.validade);
                  const faixa = faixaValidade(dias);
                  const corVal = faixa === "vencido" ? "text-destructive" : faixa === "critico" ? "text-destructive" : faixa === "atencao" ? "text-warning" : "text-foreground";
                  return (
                    <>
                      <tr key={l.id}>
                        <td className="px-5 py-3 font-mono">{l.lote}</td>
                        <td className={cn("px-5 py-3 font-medium", corVal)}>
                          {exibirValidade(l.validade)}
                          {l.validade < "2099-01-01" && dias <= 30 && <span className="ml-2 text-xs opacity-70">({dias <= 0 ? "vencido" : `${dias}d`})</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-medium">{l.qtd} un</td>
                        <td className="px-5 py-3 text-right">
                          {ajustando === l.id ? (
                            <Button variant="ghost" size="sm" onClick={() => setAjustando(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => abrirAjuste(l.id, l.qtd)}>
                              Ajustar
                            </Button>
                          )}
                        </td>
                      </tr>
                      {ajustando === l.id && (
                        <tr key={`${l.id}-ajuste`} className="bg-muted/30">
                          <td colSpan={4} className="px-5 py-4">
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Novo saldo (un)</label>
                                <Input
                                  type="number" min={0} className="h-8 w-24"
                                  value={ajusteVal}
                                  onChange={(e) => setAjusteVal(e.target.value)}
                                />
                              </div>
                              <div className="flex-1 space-y-1 min-w-40">
                                <label className="text-xs font-medium text-muted-foreground">Motivo</label>
                                <Input
                                  className="h-8" placeholder="Ex: Contagem física, quebra…"
                                  value={ajusteMotivo}
                                  onChange={(e) => setAjusteMotivo(e.target.value)}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => salvarAjuste(l.id)}>
                                  <Save className="h-3.5 w-3.5" /> Salvar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setAjustando(null)}>Cancelar</Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Histórico de movimentações */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <h2 className="border-b p-5 font-semibold">Últimas movimentações</h2>
          <div className="divide-y">
            {movsProduto.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada.
              </p>
            ) : (
              movsProduto.map((m) => {
                const ml = MOV_LABEL[m.tipo] ?? { t: m.tipo, ic: ArrowUpDown, c: "text-muted-foreground" };
                const Icon = ml.ic;
                const dataFmt = new Date(m.data.slice(0, 10)).toLocaleDateString("pt-BR");
                const hora = m.data.length >= 19 ? m.data.slice(11, 16) : "";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted", ml.c)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ml.t}</p>
                      <p className="text-xs text-muted-foreground">{m.usuario || "Sistema"}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{m.qtd > 0 ? "+" : ""}{m.qtd} un</p>
                      <p className="text-xs text-muted-foreground">{dataFmt}{hora ? ` ${hora}` : ""}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
