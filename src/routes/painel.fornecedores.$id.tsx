import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Clock, Edit3, Mail, MapPin, Package, Phone,
  Save, ShoppingCart, Trash2, User, X, TrendingUp, AlertTriangle, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/mock-data";
import { useFornecedores, getFornecedores, editarFornecedor, excluirFornecedor } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import { useEstoque } from "@/lib/estoque-store";
import { usePedidos } from "@/lib/pedidos-store";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

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
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Ficha,
});

type FForm = { nome: string; cnpj: string; contato: string; telefone: string; email: string; cidade: string; prazo: string };
type FiltroPed = "todos" | "aberto" | "recebido" | "cancelado";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  confirmado: "Confirmado",
  parcial: "Parc. recebido",
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

const FILTROS_PED: { key: FiltroPed; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aberto", label: "Em aberto" },
  { key: "recebido", label: "Recebidos" },
  { key: "cancelado", label: "Cancelados" },
];

function Ficha() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const todos = useFornecedores();
  const f = todos.find((x) => x.id === id);

  const produtos = useProdutos();
  const est = useEstoque();
  const { pedidos } = usePedidos();

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

  const [form, setForm] = useState<FForm>({ nome: "", cnpj: "", contato: "", telefone: "", email: "", cidade: "", prazo: "" });
  const [filtroPed, setFiltroPed] = useState<FiltroPed>("todos");

  const todosPedidos = useMemo(() => {
    if (!f) return [];
    return pedidos.filter((p) => p.fornecedorId === f.id).sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));
  }, [pedidos, f]);

  const pedidosFiltrados = useMemo(() => {
    if (filtroPed === "todos") return todosPedidos;
    if (filtroPed === "aberto") return todosPedidos.filter((p) => ["enviado", "confirmado", "parcial"].includes(p.status));
    if (filtroPed === "recebido") return todosPedidos.filter((p) => p.status === "recebido");
    return todosPedidos.filter((p) => p.status === "cancelado");
  }, [todosPedidos, filtroPed]);

  const itens = useMemo(() => (f ? produtos.filter((p) => p.fornecedor === f.nome) : []), [produtos, f]);

  const stats = useMemo(() => {
    const pendentes = todosPedidos.filter((p) => ["enviado", "confirmado", "parcial"].includes(p.status));
    const recebidos = todosPedidos.filter((p) => p.status === "recebido");
    const volumeTotal = todosPedidos.reduce((s, p) => s + p.total, 0);
    const ticketMedio = recebidos.length > 0 ? recebidos.reduce((s, p) => s + p.total, 0) / recebidos.length : 0;

    const valorEstoque = itens.reduce((s, p) => {
      const dep = est.lotes.filter((l) => l.produtoId === p.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0);
      const gond = est.gondola[p.id] ?? 0;
      return s + (dep + gond) * (p.custoUltimaCompra ?? 0);
    }, 0);

    const prodsBaixo = itens.filter((p) => {
      const gond = est.gondola[p.id] ?? 0;
      return gond <= p.minimo;
    });

    const ultimaCompra = recebidos[0] ?? null;
    const pedidoMaisAntigo = pendentes.sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao))[0] ?? null;

    // Score de qualidade do fornecedor (0–100)
    const naoCancelados = todosPedidos.filter((p) => p.status !== "cancelado" && p.status !== "rascunho");
    const taxaEntrega = naoCancelados.length > 0 ? (recebidos.length / naoCancelados.length) * 100 : 0;
    const taxaParcial = naoCancelados.length > 0 ? (naoCancelados.filter((p) => p.status === "parcial").length / naoCancelados.length) * 100 : 0;
    const atrasados = pendentes.filter((p) => p.dataPrevista && p.dataPrevista < new Date().toISOString().slice(0, 10)).length;
    const taxaAtraso = pendentes.length > 0 ? (atrasados / pendentes.length) * 100 : 0;
    const scoreQualidade = naoCancelados.length === 0 ? null :
      Math.round(Math.max(0, taxaEntrega * 0.6 - taxaParcial * 0.2 - taxaAtraso * 0.2));

    return { pendentes: pendentes.length, volumeTotal, ticketMedio, valorEstoque, prodsBaixo, ultimaCompra, pedidoMaisAntigo, scoreQualidade, taxaEntrega, taxaParcial, taxaAtraso };
  }, [todosPedidos, itens, est]);

  if (!f) return <p className="text-muted-foreground">Fornecedor não encontrado.</p>;

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
            {f.cidade && <p className="text-sm text-primary-foreground/60">{f.cidade}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editando ? (
            <>
              <Button variant="secondary" onClick={abrirEdicao}><Edit3 className="h-4 w-4" /> Editar</Button>
              <Button variant="destructive" size="icon" onClick={() => setConfirmando(true)} title="Excluir fornecedor" aria-label="Excluir fornecedor">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={cancelar}><X className="h-4 w-4" /> Cancelar</Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: Package, l: "Produtos", v: itens.length, sub: "fornecidos" },
          { icon: TrendingUp, l: "Valor em estoque", v: brl(stats.valorEstoque), sub: "custo × qtd" },
          { icon: ShoppingCart, l: "Total de pedidos", v: todosPedidos.length, sub: "desde o início" },
          { icon: ShoppingCart, l: "Em aberto", v: stats.pendentes, sub: "aguardando entrega", alerta: stats.pendentes > 0 },
          { icon: TrendingUp, l: "Volume comprado", v: brl(stats.volumeTotal), sub: "todos os pedidos" },
          { icon: TrendingUp, l: "Ticket médio", v: stats.ticketMedio > 0 ? brl(stats.ticketMedio) : "—", sub: "por pedido recebido" },
        ].map(({ icon: Icon, l, v, sub, alerta }) => (
          <div key={l} className="rounded-xl border bg-card px-4 py-4">
            <Icon className={cn("h-4 w-4 mb-1.5", alerta ? "text-warning" : "text-primary")} />
            <p className="text-xl font-bold">{v}</p>
            <p className="text-xs font-medium text-foreground/80">{l}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Confirmação de exclusão */}
      {confirmando && (
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="font-semibold text-destructive">Excluir "{f.nome}"?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. O fornecedor será removido permanentemente.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="destructive" onClick={confirmarExclusao}><Trash2 className="h-4 w-4" /> Confirmar exclusão</Button>
            <Button ref={cancelRef} variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Formulário de edição */}
      {editando && (
        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Editar fornecedor</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${fid}-nome`}>Nome / razão social</Label>
              <Input id={`${fid}-nome`} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-cnpj`}>CNPJ / CPF</Label>
              <Input id={`${fid}-cnpj`} value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-contato`}>Contato</Label>
              <Input id={`${fid}-contato`} value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-telefone`}>Telefone</Label>
              <Input id={`${fid}-telefone`} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-email`}>E-mail</Label>
              <Input id={`${fid}-email`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-cidade`}>Cidade</Label>
              <Input id={`${fid}-cidade`} value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fid}-prazo`}>Prazo de pagamento</Label>
              <Input id={`${fid}-prazo`} value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} placeholder="Ex.: 30 dias" />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
            <Button onClick={salvar}><Save className="h-4 w-4" /> Salvar alterações</Button>
          </div>
        </div>
      )}

      {/* Atividade recente */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Última compra */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Última compra</p>
          {stats.ultimaCompra ? (
            <>
              <Link to="/painel/pedidos/$id" params={{ id: stats.ultimaCompra.id }} className="font-semibold hover:text-primary">
                {stats.ultimaCompra.numero}
              </Link>
              <p className="mt-0.5 text-xl font-bold">{brl(stats.ultimaCompra.total)}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(stats.ultimaCompra.dataEmissao).toLocaleDateString("pt-BR")}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pedido recebido ainda.</p>
          )}
        </div>

        {/* Pedido pendente mais antigo */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Pedido mais antigo em aberto</p>
          {stats.pedidoMaisAntigo ? (
            <>
              <Link to="/painel/pedidos/$id" params={{ id: stats.pedidoMaisAntigo.id }} className="font-semibold hover:text-primary">
                {stats.pedidoMaisAntigo.numero}
              </Link>
              <p className="mt-0.5 text-xl font-bold">{brl(stats.pedidoMaisAntigo.total)}</p>
              <p className="text-sm text-muted-foreground">
                Emitido em {new Date(stats.pedidoMaisAntigo.dataEmissao).toLocaleDateString("pt-BR")}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pedido em aberto.</p>
          )}
        </div>

        {/* Alertas de estoque */}
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Produtos com estoque baixo</p>
          {stats.prodsBaixo.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                <p className="text-xl font-bold">{stats.prodsBaixo.length}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.prodsBaixo.slice(0, 2).map((p) => p.nome).join(", ")}
                {stats.prodsBaixo.length > 2 && ` +${stats.prodsBaixo.length - 2}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Todos os produtos estão bem abastecidos.</p>
          )}
        </div>
      </div>

      {/* Score de Qualidade */}
      {stats.scoreQualidade !== null && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Score de Qualidade do Fornecedor</h2>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex flex-col items-center">
              <div className={`text-5xl font-bold ${stats.scoreQualidade >= 70 ? "text-green-600 dark:text-green-400" : stats.scoreQualidade >= 40 ? "text-amber-500" : "text-destructive"}`}>
                {stats.scoreQualidade}
              </div>
              <p className="text-xs text-muted-foreground mt-1">/ 100</p>
              <p className={`text-xs font-semibold mt-1 ${stats.scoreQualidade >= 70 ? "text-green-600 dark:text-green-400" : stats.scoreQualidade >= 40 ? "text-amber-500" : "text-destructive"}`}>
                {stats.scoreQualidade >= 70 ? "Bom fornecedor" : stats.scoreQualidade >= 40 ? "Regular" : "Atenção necessária"}
              </p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4 min-w-0">
              <div>
                <p className="text-xs text-muted-foreground">Taxa de entrega</p>
                <p className="text-lg font-bold">{stats.taxaEntrega.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">pedidos recebidos</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entregas parciais</p>
                <p className={`text-lg font-bold ${stats.taxaParcial > 20 ? "text-amber-500" : ""}`}>{stats.taxaParcial.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">do total enviado</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedidos atrasados</p>
                <p className={`text-lg font-bold ${stats.taxaAtraso > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>{stats.taxaAtraso.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">em aberto vencidos</p>
              </div>
            </div>
          </div>
          <div className="mt-4 w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${stats.scoreQualidade >= 70 ? "bg-green-500" : stats.scoreQualidade >= 40 ? "bg-amber-400" : "bg-destructive"}`}
              style={{ width: `${stats.scoreQualidade}%` }}
            />
          </div>
        </div>
      )}

      {/* Layout duas colunas: contato + produtos */}
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Dados de contato */}
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
            Produtos fornecidos{" "}
            <span className="text-muted-foreground font-normal text-base">({itens.length})</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3 text-right">Preço</th>
                  <th className="px-5 py-3 text-right">Custo</th>
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
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3">
                        <Link to="/painel/produtos/$id" params={{ id: p.id }} className="group">
                          <p className="font-semibold group-hover:text-primary">{p.nome}</p>
                          <p className="font-mono text-xs text-muted-foreground">{p.codigo}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right">{brl(p.preco)}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {p.custoUltimaCompra ? brl(p.custoUltimaCompra) : "—"}
                      </td>
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
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Nenhum produto vinculado a este fornecedor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Histórico de pedidos */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <h2 className="text-lg font-semibold">
            Pedidos de compra{" "}
            <span className="text-muted-foreground font-normal text-base">({todosPedidos.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              {FILTROS_PED.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFiltroPed(key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    filtroPed === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link
              to="/painel/pedidos/novo"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <ShoppingCart className="h-4 w-4" /> Novo pedido
            </Link>
          </div>
        </div>
        {pedidosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {todosPedidos.length === 0
              ? "Nenhum pedido de compra com este fornecedor ainda."
              : "Nenhum pedido neste filtro."}
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {pedidosFiltrados.map((p) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
