import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Calendar, Edit3,
  GitBranch, MapPin, Package, Plus, Save, ShoppingCart,
  TrendingDown, TrendingUp, Trash2, Warehouse, X, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, categorias, UNIDADES, type LocalDeposito, type LocalGondola } from "@/lib/mock-data";
import { useProdutos, getProdutos, editarProduto, excluirProduto, cadastrarVariante } from "@/lib/produtos-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import { useEstoque, ajustarEstoque, inicializarProduto } from "@/lib/estoque-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { diasAte, exibirValidade, faixaValidade } from "@/lib/estoque-store";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

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
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: ProdutoDetalhe,
});

type FormState = {
  nome: string; categoria: string; fornecedor: string; fornecedorId?: string; preco: string; custo: string; minimo: string; maximo: string;
  minimoDeposito: string; maximoDeposito: string;
  depRua: string; depPrateleira: string; depNivel: string;
  gondCorredor: string; gondGondola: string; gondNivel: "" | "Alto" | "Médio" | "Baixo"; gondPosicao: string;
};

type FiltroMov = "todas" | "entrada" | "venda" | "transferencia" | "ajuste";

const MOV_LABEL: Record<string, { t: string; ic: typeof ArrowUp; c: string }> = {
  entrada:      { t: "Entrada no depósito", ic: ArrowDown,    c: "text-success" },
  transferencia:{ t: "Reposto na gôndola",  ic: ArrowUp,      c: "text-primary" },
  venda:        { t: "Vendido",             ic: TrendingDown, c: "text-muted-foreground" },
  ajuste:       { t: "Ajuste de estoque",   ic: ArrowUpDown,  c: "text-warning" },
};

const FILTROS: { key: FiltroMov; label: string }[] = [
  { key: "todas",        label: "Todas" },
  { key: "entrada",      label: "Entradas" },
  { key: "venda",        label: "Vendas" },
  { key: "transferencia",label: "Transferências" },
  { key: "ajuste",       label: "Ajustes" },
];

function ProdutoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const todos = useProdutos();
  const produto = todos.find((p) => p.id === id);

  const fornecedores = useFornecedores();
  const est = useEstoque();
  const auth = useAuth();

  const fid = useId();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmando) return;
    cancelRef.current?.focus();
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirmando(false); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [confirmando]);

  const [ajustando, setAjustando] = useState<string | null>(null);
  const [ajusteVal, setAjusteVal] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [addingVariant, setAddingVariant] = useState(false);
  const [filtroMov, setFiltroMov] = useState<FiltroMov>("todas");
  const [vf, setVf] = useState({ variante: "", codigo: "", preco: "", unidade: "un" });
  const [f, setF] = useState<FormState>({
    nome: "", categoria: "", fornecedor: "", fornecedorId: undefined, preco: "", custo: "", minimo: "", maximo: "",
    minimoDeposito: "10", maximoDeposito: "100",
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

  const todasMovsProduto = useMemo(
    () => est.movs.filter((m) => m.produtoId === produto?.id).sort((a, b) => b.data.localeCompare(a.data)),
    [est.movs, produto?.id],
  );

  const movsFiltradas = useMemo(
    () => filtroMov === "todas" ? todasMovsProduto : todasMovsProduto.filter((m) => m.tipo === filtroMov),
    [todasMovsProduto, filtroMov],
  );

  // Analytics: últimos 30 dias
  const h30 = useMemo(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), []);
  const vendasUlt30 = useMemo(
    () => todasMovsProduto.filter((m) => m.tipo === "venda" && m.data.slice(0, 10) >= h30),
    [todasMovsProduto, h30],
  );
  const qtdVendida30 = useMemo(() => vendasUlt30.reduce((s, m) => s + m.qtd, 0), [vendasUlt30]);

  const ultimaCompra = useMemo(
    () => todasMovsProduto.find((m) => m.tipo === "entrada"),
    [todasMovsProduto],
  );
  const ultimaVenda = useMemo(
    () => todasMovsProduto.find((m) => m.tipo === "venda"),
    [todasMovsProduto],
  );

  const isVariant = !!produto?.parentId;
  const parentProd = isVariant ? todos.find((p) => p.id === produto?.parentId) : null;
  const variantes = useMemo(
    () => produto && !isVariant ? todos.filter((p) => p.parentId === produto.id) : [],
    [todos, produto, isVariant],
  );

  const salvarVariante = () => {
    if (!vf.variante.trim()) { toast.error("Informe o nome da variante (ex.: Azul - G)."); return; }
    if (!vf.codigo.trim()) { toast.error("Informe o código de barras da variante."); return; }
    if (!produto) return;
    const novoId = cadastrarVariante(produto.id, {
      nome: produto.nome,
      codigo: vf.codigo.trim(),
      variante: vf.variante.trim(),
      categoria: produto.categoria,
      fornecedor: produto.fornecedor,
      preco: Number(vf.preco.replace(",", ".")) || produto.preco,
      minimo: produto.minimo,
      maximo: produto.maximo,
      unidade: vf.unidade,
      localDeposito: produto.localDeposito,
      localGondola: produto.localGondola,
    });
    inicializarProduto(novoId);
    toast.success(`Variante "${vf.variante}" criada.`);
    setVf({ variante: "", codigo: "", preco: "", unidade: "un" });
    setAddingVariant(false);
  };

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

  const mediaDiaria = qtdVendida30 / 30;
  const cobertura = mediaDiaria > 0 ? Math.floor(total / mediaDiaria) : null;
  const valorEstoque = produto.custoUltimaCompra ? total * produto.custoUltimaCompra : null;
  const receitaEst30 = qtdVendida30 * produto.preco;

  const abrirEdicao = () => {
    const ld = produto.localDeposito;
    const lg = produto.localGondola;
    const matchedForn = produto.fornecedorId
      ? fornecedores.find((x) => x.id === produto.fornecedorId)
      : fornecedores.find((x) => x.nome === produto.fornecedor);
    setF({
      nome: produto.nome, categoria: produto.categoria,
      fornecedor: matchedForn?.nome ?? produto.fornecedor,
      fornecedorId: matchedForn?.id,
      preco: String(produto.preco), custo: String(produto.custoUltimaCompra ?? ""), minimo: String(produto.minimo), maximo: String(produto.maximo ?? 0),
      minimoDeposito: String(produto.minimoDeposito ?? 10), maximoDeposito: String(produto.maximoDeposito ?? 100),
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
      fornecedorId: f.fornecedorId,
      preco: Number(f.preco.replace(",", ".")) || produto.preco,
      custoUltimaCompra: f.custo ? Number(f.custo.replace(",", ".")) : produto.custoUltimaCompra,
      minimo: Number(f.minimo) || produto.minimo,
      maximo: Number(f.maximo) || 0,
      minimoDeposito: Number(f.minimoDeposito) || 10,
      maximoDeposito: Number(f.maximoDeposito) || 100,
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
    ajustarEstoque(loteId, novo, ajusteMotivo.trim(), auth.nomeProprietario ?? "Gerente");
    toast.success("Estoque ajustado.");
    setAjustando(null);
  };

  const confirmarExclusao = () => {
    excluirProduto(produto.id);
    toast.success(`"${produto.nome}" excluído.`);
    navigate({ to: "/painel/produtos" });
  };

  const fmtData = (iso: string) =>
    new Date(iso.slice(0, 10)).toLocaleDateString("pt-BR");

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
              <Button variant="destructive" size="icon" onClick={() => setConfirmando(true)} title="Excluir produto" aria-label="Excluir produto">
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
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="font-semibold text-destructive">Excluir "{produto.nome}"?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. Todos os dados do produto serão removidos.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="destructive" onClick={confirmarExclusao}><Trash2 className="h-4 w-4" /> Confirmar exclusão</Button>
            <Button ref={cancelRef} variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* KPIs — 3 colunas × 2 linhas */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Linha 1: estoque */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">No depósito</p>
          <p className="font-display text-2xl font-bold">{dep} un</p>
          {(() => {
            const minDep = produto.minimoDeposito ?? 10;
            const maxDep = produto.maximoDeposito && produto.maximoDeposito > 0 ? produto.maximoDeposito : minDep * 2;
            const pct = maxDep > 0 ? Math.min(100, (dep / maxDep) * 100) : dep > 0 ? 100 : 0;
            const cor = dep === 0 ? "bg-destructive" : dep <= minDep ? "bg-warning" : produto.maximoDeposito && dep >= produto.maximoDeposito ? "bg-primary" : "bg-success";
            return (
              <>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", cor)} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">mín: {minDep}{produto.maximoDeposito ? ` · máx: ${produto.maximoDeposito}` : ""} un</p>
              </>
            );
          })()}
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
          {cobertura !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              cobertura estimada: <span className={cn("font-semibold", cobertura <= 7 ? "text-destructive" : cobertura <= 15 ? "text-warning" : "text-success")}>{cobertura}d</span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">depósito + gôndola</p>
          )}
        </div>

        {/* Linha 2: financeiro + vendas */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Preço de venda</p>
          <p className="font-display text-2xl font-bold">{brl(produto.preco)}</p>
          {produto.custoUltimaCompra ? (
            <p className="mt-1 text-xs text-muted-foreground">
              custo: {brl(produto.custoUltimaCompra)} · margem: {(((produto.preco - produto.custoUltimaCompra) / produto.preco) * 100).toFixed(1)}%
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">por unidade</p>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Vendas — 30 dias
          </div>
          <p className="font-display text-2xl font-bold">{qtdVendida30} un</p>
          <p className="mt-1 text-xs text-muted-foreground">
            receita est.: {brl(receitaEst30)} · média: {mediaDiaria.toFixed(1)} un/dia
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
            <Package className="h-3 w-3" /> Valor em estoque
          </div>
          {valorEstoque !== null ? (
            <>
              <p className="font-display text-2xl font-bold">{brl(valorEstoque)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {total} un × {brl(produto.custoUltimaCompra!)} custo
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-bold text-muted-foreground">—</p>
              <p className="mt-1 text-xs text-muted-foreground">cadastre o custo para calcular</p>
            </>
          )}
        </div>
      </div>

      {/* Atividade recente */}
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Atividade recente</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Última compra</p>
              {ultimaCompra ? (
                <>
                  <p className="text-sm font-semibold">{fmtData(ultimaCompra.data)}</p>
                  <p className="text-xs text-muted-foreground">{ultimaCompra.origem || "Fornecedor"} · {ultimaCompra.qtd} un</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma entrada</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <TrendingDown className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Última venda</p>
              {ultimaVenda ? (
                <>
                  <p className="text-sm font-semibold">{fmtData(ultimaVenda.data)}</p>
                  <p className="text-xs text-muted-foreground">{ultimaVenda.qtd} un · {brl(ultimaVenda.qtd * produto.preco)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma venda</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Giro — últimos 30 dias</p>
              <p className="text-sm font-semibold">{qtdVendida30} unidades vendidas</p>
              <p className="text-xs text-muted-foreground">{vendasUlt30.length} operações de venda</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Calendar className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Cobertura de estoque</p>
              {cobertura !== null ? (
                <>
                  <p className={cn("text-sm font-semibold", cobertura <= 7 ? "text-destructive" : cobertura <= 15 ? "text-warning" : "text-success")}>
                    ~{cobertura} dias
                  </p>
                  <p className="text-xs text-muted-foreground">baseado no giro dos últimos 30d</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Sem dados de venda</p>
                  <p className="text-xs text-muted-foreground">nenhuma venda registrada</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Previsão de demanda e ponto de pedido */}
      {mediaDiaria > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Previsão de Demanda</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Média diária (30d)</p>
              <p className="text-xl font-bold">{mediaDiaria.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">un/dia</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Previsão 7 dias</p>
              <p className="text-xl font-bold">{Math.ceil(mediaDiaria * 7)} <span className="text-sm font-normal text-muted-foreground">un</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Previsão 30 dias</p>
              <p className="text-xl font-bold">{Math.ceil(mediaDiaria * 30)} <span className="text-sm font-normal text-muted-foreground">un</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ponto de pedido</p>
              <p className={cn("text-xl font-bold", total <= Math.ceil(mediaDiaria * 7 + produto.minimo) ? "text-destructive" : "text-foreground")}>
                {Math.ceil(mediaDiaria * 7 + produto.minimo)} <span className="text-sm font-normal text-muted-foreground">un</span>
              </p>
              <p className="text-xs text-muted-foreground">7d de lead + estoque mínimo</p>
            </div>
          </div>
          {total <= Math.ceil(mediaDiaria * 7 + produto.minimo) && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <TrendingDown className="h-4 w-4 shrink-0" />
              <span>Abaixo do ponto de pedido — considere reabastecer agora para cobrir a demanda dos próximos 7 dias.</span>
            </div>
          )}
        </div>
      )}

      {/* Formulário de edição */}
      {editando && (
        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Editar produto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${fid}-nome`}>Nome do produto</Label>
              <Input id={`${fid}-nome`} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-custo`}>Custo de compra (R$) <span className="font-normal text-muted-foreground text-xs">— custo por unidade na última compra</span></Label>
              <Input id={`${fid}-custo`} inputMode="decimal" placeholder="0,00" value={f.custo} onChange={(e) => setF({ ...f, custo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-preco`}>Preço de venda (R$)</Label>
              <Input id={`${fid}-preco`} inputMode="decimal" placeholder="0,00" value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} />
            </div>
            {(() => {
              const custo = Number(f.custo.replace(",", "."));
              const venda = Number(f.preco.replace(",", "."));
              const margem = custo > 0 && venda > 0 ? ((venda - custo) / venda) * 100 : null;
              return margem !== null ? (
                <div className={cn("sm:col-span-2 rounded-xl p-4 text-sm", margem < 10 ? "bg-destructive/10" : "bg-success/12")}>
                  <p className="text-xs text-muted-foreground">Margem calculada</p>
                  <p className="font-display text-2xl font-bold">{margem.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Lucro de {brl(venda - custo)} por {produto.unidade ?? "un"}</p>
                </div>
              ) : null;
            })()}
            <div className="space-y-2">
              <Label htmlFor={`${fid}-minimo`}>Mínimo na gôndola <span className="font-normal text-muted-foreground text-xs">— quando atingir esse número, o repositor é avisado</span></Label>
              <Input id={`${fid}-minimo`} inputMode="numeric" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-maximo`}>Máximo na gôndola <span className="font-normal text-muted-foreground text-xs">— capacidade total da gôndola (0 = não definido)</span></Label>
              <Input id={`${fid}-maximo`} inputMode="numeric" value={f.maximo} onChange={(e) => setF({ ...f, maximo: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-minimoDeposito`}>Mínimo no depósito <span className="font-normal text-muted-foreground text-xs">— alerta quando cair abaixo desse valor</span></Label>
              <Input id={`${fid}-minimoDeposito`} inputMode="numeric" value={f.minimoDeposito} onChange={(e) => setF({ ...f, minimoDeposito: e.target.value.replace(/\D/g, "") })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-maximoDeposito`}>Máximo no depósito <span className="font-normal text-muted-foreground text-xs">— capacidade total do depósito (0 = não definido)</span></Label>
              <Input id={`${fid}-maximoDeposito`} inputMode="numeric" value={f.maximoDeposito} onChange={(e) => setF({ ...f, maximoDeposito: e.target.value.replace(/\D/g, "") })} />
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
              <Label htmlFor={`${fid}-fornecedor`}>Fornecedor</Label>
              <select id={`${fid}-fornecedor`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.fornecedorId ?? ""}
                onChange={(e) => {
                  const sel = fornecedores.find((x) => x.id === e.target.value);
                  setF({ ...f, fornecedor: sel?.nome ?? "", fornecedorId: sel?.id });
                }}>
                <option value="">(sem fornecedor)</option>
                {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">
              Onde fica no depósito <span className="font-normal">(opcional — ajuda o repositor a encontrar)</span>
            </p>
            <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
              <div className="space-y-2"><Label htmlFor={`${fid}-depRua`}>Rua</Label><Input id={`${fid}-depRua`} value={f.depRua} onChange={(e) => setF({ ...f, depRua: e.target.value })} placeholder="Ex.: A" /></div>
              <div className="space-y-2"><Label htmlFor={`${fid}-depPrateleira`}>Prateleira</Label><Input id={`${fid}-depPrateleira`} value={f.depPrateleira} onChange={(e) => setF({ ...f, depPrateleira: e.target.value })} placeholder="Ex.: B3" /></div>
              <div className="space-y-2"><Label htmlFor={`${fid}-depNivel`}>Nível</Label><Input id={`${fid}-depNivel`} inputMode="numeric" value={f.depNivel} onChange={(e) => setF({ ...f, depNivel: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 2" /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">
              Onde fica na gôndola <span className="font-normal">(opcional)</span>
            </p>
            <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
              <div className="space-y-2"><Label htmlFor={`${fid}-gondCorredor`}>Corredor</Label><Input id={`${fid}-gondCorredor`} value={f.gondCorredor} onChange={(e) => setF({ ...f, gondCorredor: e.target.value })} placeholder="Ex.: 3" /></div>
              <div className="space-y-2"><Label htmlFor={`${fid}-gondGondola`}>Gôndola</Label><Input id={`${fid}-gondGondola`} value={f.gondGondola} onChange={(e) => setF({ ...f, gondGondola: e.target.value })} placeholder="Ex.: G2" /></div>
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
              <div className="space-y-2"><Label htmlFor={`${fid}-gondPosicao`}>Posição</Label><Input id={`${fid}-gondPosicao`} inputMode="numeric" value={f.gondPosicao} onChange={(e) => setF({ ...f, gondPosicao: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 4" /></div>
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

      {/* Variante: link para produto pai */}
      {isVariant && parentProd && (
        <div className="flex items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm">
          <GitBranch className="h-4 w-4 text-primary shrink-0" />
          <span className="text-muted-foreground">Variante de</span>
          <Link to="/painel/produtos/$id" params={{ id: parentProd.id }} className="font-medium hover:underline text-primary">
            {parentProd.nome}
          </Link>
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{produto.variante}</span>
        </div>
      )}

      {/* Variantes do produto pai */}
      {!isVariant && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Variantes <span className="text-muted-foreground font-normal text-sm">({variantes.length})</span></h2>
            </div>
            {!addingVariant && (
              <Button variant="outline" size="sm" onClick={() => setAddingVariant(true)}>
                <Plus className="h-3.5 w-3.5" /> Nova variante
              </Button>
            )}
          </div>

          {addingVariant && (
            <div className="border-b bg-muted/30 p-5 space-y-4">
              <p className="text-sm font-medium">Nova variante de <span className="text-primary">{produto.nome}</span></p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${fid}-variantNome`}>Nome da variante <span className="text-muted-foreground font-normal text-xs">Ex.: Azul - G, 200ml, Chocolate</span></Label>
                  <Input id={`${fid}-variantNome`} placeholder="Ex.: Vermelho - M" value={vf.variante} onChange={(e) => setVf({ ...vf, variante: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${fid}-variantCodigo`}>Código de barras</Label>
                  <Input id={`${fid}-variantCodigo`} placeholder="EAN-13" value={vf.codigo} onChange={(e) => setVf({ ...vf, codigo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${fid}-variantPreco`}>Preço de venda (R$) <span className="text-muted-foreground font-normal text-xs">— deixe em branco para herdar do pai</span></Label>
                  <Input id={`${fid}-variantPreco`} inputMode="decimal" placeholder={String(produto.preco)} value={vf.preco} onChange={(e) => setVf({ ...vf, preco: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${fid}-variantUnidade`}>Unidade</Label>
                  <select id={`${fid}-variantUnidade`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vf.unidade} onChange={(e) => setVf({ ...vf, unidade: e.target.value })}>
                    {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarVariante}><Save className="h-3.5 w-3.5" /> Criar variante</Button>
                <Button variant="ghost" size="sm" onClick={() => setAddingVariant(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {variantes.length === 0 && !addingVariant ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma variante cadastrada. Use "Nova variante" para adicionar tamanhos, cores ou sabores.</p>
          ) : (
            <div className="divide-y">
              {variantes.map((v) => {
                const vGond = est.gondola[v.id] ?? 0;
                const vDep = est.lotes.filter((l) => l.produtoId === v.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0);
                return (
                  <Link
                    key={v.id}
                    to="/painel/produtos/$id"
                    params={{ id: v.id }}
                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary shrink-0">{v.variante}</span>
                      <span className="font-mono text-xs text-muted-foreground truncate">{v.codigo}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm shrink-0">
                      <span className="text-muted-foreground">{brl(v.preco)}</span>
                      <div className="text-right">
                        <p className="font-medium">{vGond} na gôndola</p>
                        <p className="text-xs text-muted-foreground">{vDep} no depósito</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
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
                  const corVal = faixa === "vencido" ? "text-destructive" : faixa === "7" ? "text-destructive" : faixa === "15" ? "text-warning" : "text-foreground";
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

        {/* Histórico de movimentações com filtro */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="border-b p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Histórico de movimentações</h2>
              <span className="text-xs text-muted-foreground">{movsFiltradas.length} registro{movsFiltradas.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFiltroMov(f.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition border",
                    filtroMov === f.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  {f.label}
                  {f.key !== "todas" && (
                    <span className="ml-1 opacity-60">
                      ({todasMovsProduto.filter((m) => m.tipo === f.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y max-h-[480px] overflow-y-auto">
            {movsFiltradas.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma movimentação{filtroMov !== "todas" ? " deste tipo" : ""}.
              </p>
            ) : (
              movsFiltradas.map((m) => {
                const ml = MOV_LABEL[m.tipo] ?? { t: m.tipo, ic: ArrowUpDown, c: "text-muted-foreground" };
                const Icon = ml.ic;
                const dataFmt = fmtData(m.data);
                const hora = m.data.length >= 19 ? m.data.slice(11, 16) : "";
                const origem = m.tipo === "entrada" && m.origem ? m.origem : null;
                const valor = m.tipo === "venda" ? m.qtd * produto.preco : m.tipo === "entrada" && produto.custoUltimaCompra ? m.qtd * produto.custoUltimaCompra : null;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted", ml.c)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ml.t}</p>
                      <p className="text-xs text-muted-foreground">
                        {origem ? origem : (m.usuario || "Sistema")}
                      </p>
                    </div>
                    <div className="text-right text-sm shrink-0">
                      <p className="font-semibold">{m.qtd > 0 ? "+" : ""}{m.qtd} un</p>
                      {valor !== null ? (
                        <p className="text-xs text-muted-foreground">{brl(valor)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{dataFmt}{hora ? ` ${hora}` : ""}</p>
                      )}
                      {valor !== null && <p className="text-xs text-muted-foreground">{dataFmt}</p>}
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
