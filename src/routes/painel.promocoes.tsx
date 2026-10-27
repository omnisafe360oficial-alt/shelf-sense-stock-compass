import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calendar, Pencil, Percent, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addPromocao, Promocao, removePromocao, updatePromocao, usePromocoes,
} from "@/lib/promocoes-store";
import { useProdutos } from "@/lib/produtos-store";
import { HOJE } from "@/lib/computed";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/mock-data";

export const Route = createFileRoute("/painel/promocoes")({
  head: () => ({
    meta: [{ title: "Promoções — OmniSafe 360" }],
  }),
  component: Promocoes,
});

type Status = "ativa" | "futura" | "encerrada";

function statusDe(p: Promocao, hoje: string): Status {
  if (p.dataFim < hoje) return "encerrada";
  if (p.dataInicio > hoje) return "futura";
  return "ativa";
}

const STATUS_LABEL: Record<Status, string> = {
  ativa: "Ativa", futura: "Futura", encerrada: "Encerrada",
};
const STATUS_COR: Record<Status, string> = {
  ativa: "bg-success/10 text-success",
  futura: "bg-primary/10 text-primary",
  encerrada: "bg-muted text-muted-foreground",
};

const FORM_VAZIO = {
  nome: "", descricao: "", tipo: "pct" as "pct" | "fixo",
  valor: "", dataInicio: HOJE, dataFim: HOJE, todos: true, buscaProd: "",
};

function Promocoes() {
  const { promocoes } = usePromocoes();
  const produtos = useProdutos();

  const [formAberto, setFormAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(FORM_VAZIO);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  function abrirNovo() {
    setF(FORM_VAZIO);
    setSelecionados([]);
    setEditId(null);
    setFormAberto(true);
  }

  function abrirEditar(p: Promocao) {
    setF({
      nome: p.nome, descricao: p.descricao, tipo: p.tipo,
      valor: String(p.valor), dataInicio: p.dataInicio, dataFim: p.dataFim,
      todos: p.todos, buscaProd: "",
    });
    setSelecionados(p.produtoIds);
    setEditId(p.id);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditId(null);
  }

  function salvar() {
    const nome = f.nome.trim();
    const valor = parseFloat(f.valor.replace(",", "."));
    if (!nome) { toast.error("Nome obrigatório"); return; }
    if (isNaN(valor) || valor <= 0) { toast.error("Valor deve ser maior que zero"); return; }
    if (f.dataInicio > f.dataFim) { toast.error("Data de início deve ser anterior ao fim"); return; }
    if (!f.todos && selecionados.length === 0) { toast.error("Selecione ao menos um produto"); return; }

    const dados = {
      nome, descricao: f.descricao.trim(), tipo: f.tipo, valor,
      dataInicio: f.dataInicio, dataFim: f.dataFim,
      todos: f.todos, produtoIds: f.todos ? [] : selecionados,
    };

    if (editId) {
      updatePromocao({ id: editId, ...dados });
      toast.success("Promoção atualizada");
    } else {
      addPromocao(dados);
      toast.success("Promoção criada");
    }
    fecharForm();
  }

  function excluir(id: string) {
    if (!window.confirm("Excluir esta promoção?")) return;
    removePromocao(id);
    toast.success("Promoção removida");
  }

  const produtosFiltrados = useMemo(() => {
    const t = f.buscaProd.trim().toLowerCase();
    if (!t) return produtos.slice(0, 20);
    return produtos.filter((p) => p.nome.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t)).slice(0, 20);
  }, [f.buscaProd, produtos]);

  const ordenadas = useMemo(
    () => [...promocoes].sort((a, b) => {
      const order: Record<Status, number> = { ativa: 0, futura: 1, encerrada: 2 };
      return order[statusDe(a, HOJE)] - order[statusDe(b, HOJE)] || a.dataFim.localeCompare(b.dataFim);
    }),
    [promocoes],
  );

  const ativas = ordenadas.filter((p) => statusDe(p, HOJE) === "ativa");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Promoções</h1>
            <p className="text-sm text-muted-foreground">
              {ativas.length > 0
                ? `${ativas.length} ativa${ativas.length !== 1 ? "s" : ""} agora`
                : "Nenhuma promoção ativa"}
            </p>
          </div>
        </div>
        {!formAberto && (
          <Button onClick={abrirNovo} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nova promoção
          </Button>
        )}
      </div>

      {/* Form */}
      {formAberto && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editId ? "Editar promoção" : "Nova promoção"}</h2>
            <button onClick={fecharForm} className="rounded-lg p-1 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome da promoção</Label>
              <Input
                placeholder="Ex: Semana do Leite"
                value={f.nome}
                onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Detalhe visível na listagem"
                value={f.descricao}
                onChange={(e) => setF((x) => ({ ...x, descricao: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Tipo de desconto</Label>
              <div className="flex gap-2">
                {(["pct", "fixo"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setF((x) => ({ ...x, tipo: t }))}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition",
                      f.tipo === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {t === "pct" ? "% Percentual" : "R$ Fixo"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Valor do desconto ({f.tipo === "pct" ? "%" : "R$"})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={f.tipo === "pct" ? "10" : "5,00"}
                value={f.valor}
                onChange={(e) => setF((x) => ({ ...x, valor: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Data início</Label>
              <Input
                type="date"
                value={f.dataInicio}
                onChange={(e) => setF((x) => ({ ...x, dataInicio: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Data fim</Label>
              <Input
                type="date"
                value={f.dataFim}
                onChange={(e) => setF((x) => ({ ...x, dataFim: e.target.value }))}
              />
            </div>

            {/* Escopo */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Abrangência</Label>
              <div className="flex gap-2">
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setF((x) => ({ ...x, todos: v }))}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm font-medium transition",
                      f.todos === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {v ? "Todos os produtos" : "Produtos específicos"}
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de produtos */}
            {!f.todos && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Produtos ({selecionados.length} selecionados)</Label>
                <Input
                  placeholder="Buscar produto..."
                  value={f.buscaProd}
                  onChange={(e) => setF((x) => ({ ...x, buscaProd: e.target.value }))}
                />
                <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                  {produtosFiltrados.map((p) => {
                    const marcado = selecionados.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition hover:bg-muted/50",
                          marcado && "bg-primary/5",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setSelecionados((prev) =>
                              marcado ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                            )
                          }
                          className="h-4 w-4 rounded accent-primary"
                        />
                        <span className="flex-1 truncate">{p.nome}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{brl(p.preco)}</span>
                      </label>
                    );
                  })}
                  {produtosFiltrados.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={fecharForm}>Cancelar</Button>
            <Button onClick={salvar}>{editId ? "Salvar alterações" : "Criar promoção"}</Button>
          </div>
        </div>
      )}

      {/* Lista vazia */}
      {ordenadas.length === 0 && !formAberto && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <Percent className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold">Nenhuma promoção cadastrada</p>
          <p className="text-sm text-muted-foreground">
            Crie promoções com desconto percentual ou fixo.<br />
            Elas são aplicadas automaticamente no PDV.
          </p>
          <Button onClick={abrirNovo} className="mt-2 gap-2">
            <Plus className="h-4 w-4" /> Criar primeira promoção
          </Button>
        </div>
      )}

      {/* Lista de promoções */}
      {ordenadas.length > 0 && (
        <div className="space-y-2">
          {ordenadas.map((p) => {
            const st = statusDe(p, HOJE);
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-start gap-4 rounded-xl border bg-card p-4 transition",
                  st === "encerrada" && "opacity-50",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.nome}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_COR[st])}>
                      {STATUS_LABEL[st]}
                    </span>
                  </div>
                  {p.descricao && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{p.descricao}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" />
                      {p.tipo === "pct" ? `${p.valor}% de desconto` : `R$ ${p.valor.toFixed(2)} de desconto`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {p.dataInicio} → {p.dataFim}
                    </span>
                    <span>
                      {p.todos ? "Todos os produtos" : `${p.produtoIds.length} produto${p.produtoIds.length !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => abrirEditar(p)}
                    className="rounded-lg p-2 hover:bg-muted"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => excluir(p.id)}
                    className="rounded-lg p-2 hover:bg-destructive/10 text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
