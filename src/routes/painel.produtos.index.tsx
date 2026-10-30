import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonListPage } from "@/components/ui/skeleton-page";
import { useMemo, useState } from "react";
import {
  ArrowUpDown, ChevronDown, ChevronUp,
  Download, FileCode2, GitBranch, Package, Plus, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, categorias } from "@/lib/mock-data";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/produtos/")({
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  head: () => ({
    meta: [
      { title: "Produtos — OmniSafe 360" },
      { name: "description", content: "Todos os produtos da loja com estoque de depósito, gôndola e mínimo." },
      { property: "og:title", content: "Produtos — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Produtos,
});

type Situacao = "todos" | "ok" | "baixo" | "sem";
type Coluna = "nome" | "preco" | "dep" | "gond" | "total" | "valor";
type Ordem = "asc" | "desc";

const SIT = {
  ok:    { t: "Estoque ok",    c: "bg-success/12 text-success",        borda: "border-success/40"    },
  baixo: { t: "Repor gôndola", c: "bg-warning/15 text-warning",        borda: "border-warning/40"    },
  sem:   { t: "Sem estoque",   c: "bg-destructive/10 text-destructive", borda: "border-destructive/40" },
} as const;

function situacao(dep: number, gond: number, min: number): "ok" | "baixo" | "sem" {
  if (dep + gond === 0) return "sem";
  if (gond <= min) return "baixo";
  return "ok";
}

function BarraGondola({ gond, min }: { gond: number; min: number }) {
  const pct = min > 0 ? Math.min(100, (gond / (min * 2)) * 100) : gond > 0 ? 100 : 0;
  const cor = gond === 0 ? "bg-destructive" : gond <= min ? "bg-warning" : "bg-success";
  return (
    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", cor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SortBtn({
  col, ativa, ordem, onClick,
}: { col: Coluna; ativa: Coluna; ordem: Ordem; onClick: () => void }) {
  const ativo = ativa === col;
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground transition">
      {ativo ? (
        ordem === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

function Produtos() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [sit, setSit] = useState<Situacao>("todos");
  const [sortCol, setSortCol] = useState<Coluna>("nome");
  const [sortOrd, setSortOrd] = useState<Ordem>("asc");

  const est     = useProdutos();
  const estoque = useEstoque();

  const live = useMemo(() => {
    const map: Record<string, { dep: number; gond: number }> = {};
    for (const p of est) {
      const dep = estoque.lotes
        .filter((l) => l.produtoId === p.id && l.qtd > 0)
        .reduce((t, l) => t + l.qtd, 0);
      map[p.id] = { dep, gond: estoque.gondola[p.id] ?? 0 };
    }
    return map;
  }, [estoque.lotes, estoque.gondola, est]);

  const cont = useMemo(() => {
    const c = { ok: 0, baixo: 0, sem: 0 };
    est.forEach((p) => {
      const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
      c[situacao(dep, gond, p.minimo)]++;
    });
    return c;
  }, [live, est]);

  // KPIs de valor
  const valorTotal = useMemo(
    () =>
      est.reduce((s, p) => {
        const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
        return s + (dep + gond) * p.preco;
      }, 0),
    [est, live],
  );

  function exportarCSV() {
    const hoje = new Date().toISOString().slice(0, 10);
    const cabecalho = ["Código", "Nome", "Categoria", "Fornecedor", "Preço", "Mín", "Máx", "Depósito", "Gôndola", "Total", "Valor estoque", "Situação"];
    const linhas = lista.map((p) => {
      const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
      const sit = situacao(dep, gond, p.minimo);
      return [p.codigo, p.nome, p.categoria, p.fornecedor ?? "", p.preco.toFixed(2), String(p.minimo), String(p.maximo), String(dep), String(gond), String(dep + gond), ((dep + gond) * p.preco).toFixed(2), SIT[sit].t];
    });
    const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `produtos-${hoje}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSort(col: Coluna) {
    if (sortCol === col) {
      setSortOrd((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortOrd(col === "nome" ? "asc" : "desc");
    }
  }

  const lista = useMemo(() => {
    const t = q.toLowerCase();
    const filtrada = est.filter((p) => {
      if (cat !== "Todas" && p.categoria !== cat) return false;
      if (t && !p.nome.toLowerCase().includes(t) && !p.codigo.includes(t)) return false;
      if (sit !== "todos") {
        const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
        if (situacao(dep, gond, p.minimo) !== sit) return false;
      }
      return true;
    });

    return [...filtrada].sort((a, b) => {
      const la = live[a.id] ?? { dep: 0, gond: 0 };
      const lb = live[b.id] ?? { dep: 0, gond: 0 };
      let va = 0, vb = 0;
      switch (sortCol) {
        case "nome":   return sortOrd === "asc" ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
        case "preco":  va = a.preco; vb = b.preco; break;
        case "dep":    va = la.dep;  vb = lb.dep;  break;
        case "gond":   va = la.gond; vb = lb.gond; break;
        case "total":  va = la.dep + la.gond; vb = lb.dep + lb.gond; break;
        case "valor":  va = (la.dep + la.gond) * a.preco; vb = (lb.dep + lb.gond) * b.preco; break;
      }
      return sortOrd === "asc" ? va - vb : vb - va;
    });
  }, [q, cat, sit, sortCol, sortOrd, est, live]);

  if (est.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Produtos</h1>
            <p className="text-muted-foreground">Nenhum produto cadastrado ainda</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="lg">
              <Link to="/painel/produtos/importar"><FileCode2 className="h-4 w-4" /> Importar XML</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/painel/produtos/novo"><Plus className="h-4 w-4" /> Novo produto</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed bg-card py-20 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-xl font-semibold">Cadastre seu primeiro produto</p>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Você pode cadastrar um a um ou importar todos de uma vez pelo XML da nota fiscal.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link to="/painel/produtos/importar"><FileCode2 className="h-4 w-4" /> Importar XML</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/painel/produtos/novo"><Plus className="h-4 w-4" /> Cadastrar produto</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">
            {est.length} produto{est.length !== 1 ? "s" : ""} cadastrado{est.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          {lista.length > 0 && (
            <Button variant="outline" size="lg" onClick={exportarCSV}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link to="/painel/produtos/importar"><FileCode2 className="h-4 w-4" /> Importar XML</Link>
          </Button>
          <Button asChild size="lg">
            <Link to="/painel/produtos/novo"><Plus className="h-4 w-4" /> Novo produto</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total de SKUs</p>
          <p className="mt-2 font-display text-3xl font-bold">{est.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">produtos cadastrados</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor em estoque</p>
          <p className="mt-2 font-display text-3xl font-bold">{brl(valorTotal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">depósito + gôndola × preço</p>
        </div>
        {(["baixo", "sem"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSit(sit === k ? "todos" : k)}
            className={cn(
              "rounded-2xl border p-5 text-left transition hover:shadow-elegant",
              sit === k ? SIT[k].borda : "",
              k === "sem" && cont[k] > 0 ? "border-destructive/30 bg-destructive/5" : "",
              k === "baixo" && cont[k] > 0 ? "border-warning/30 bg-warning/5" : "bg-card",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{SIT[k].t}</p>
            <p className={cn(
              "mt-2 font-display text-3xl font-bold",
              cont[k] > 0 && (k === "sem" ? "text-destructive" : "text-warning"),
            )}>
              {cont[k]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {cont[k] === 0 ? "tudo ok" : `produto${cont[k] !== 1 ? "s" : ""} — clique para filtrar`}
            </p>
          </button>
        ))}
      </div>

      {/* Painel com filtros e tabela */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou código de barras"
              className="pl-9 pr-9"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Todas", ...categorias].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  cat === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {(sit !== "todos" || cat !== "Todas" || q) && (
            <button
              onClick={() => { setSit("todos"); setCat("Todas"); setQ(""); }}
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <button
                    onClick={() => toggleSort("nome")}
                    className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition"
                  >
                    Produto
                    <SortBtn col="nome" ativa={sortCol} ordem={sortOrd} onClick={() => toggleSort("nome")} />
                  </button>
                </th>
                <th className="hidden px-4 py-3 md:table-cell">Fornecedor</th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort("preco")}
                    className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition"
                  >
                    Preço
                    <SortBtn col="preco" ativa={sortCol} ordem={sortOrd} onClick={() => toggleSort("preco")} />
                  </button>
                </th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">
                  <button
                    onClick={() => toggleSort("dep")}
                    className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition"
                  >
                    Depósito
                    <SortBtn col="dep" ativa={sortCol} ordem={sortOrd} onClick={() => toggleSort("dep")} />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort("gond")}
                    className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition"
                  >
                    Gôndola
                    <SortBtn col="gond" ativa={sortCol} ordem={sortOrd} onClick={() => toggleSort("gond")} />
                  </button>
                </th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">
                  <button
                    onClick={() => toggleSort("valor")}
                    className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition"
                  >
                    Valor em estoque
                    <SortBtn col="valor" ativa={sortCol} ordem={sortOrd} onClick={() => toggleSort("valor")} />
                  </button>
                </th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((p) => {
                const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
                const s       = situacao(dep, gond, p.minimo);
                const valor   = (dep + gond) * p.preco;
                return (
                  <tr key={p.id} className={cn("hover:bg-muted/40 transition", p.parentId ? "bg-muted/20" : "")}>
                    <td className="px-4 py-3">
                      <Link
                        to="/painel/produtos/$id"
                        params={{ id: p.id }}
                        className="group block"
                      >
                        <div className="flex items-center gap-2">
                          {p.parentId && <GitBranch className="h-3 w-3 text-primary/60 shrink-0" />}
                          <p className="font-semibold group-hover:text-primary transition">{p.nome}</p>
                          {p.variante && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary shrink-0">{p.variante}</span>
                          )}
                        </div>
                        <p className={cn("font-mono text-xs text-muted-foreground", p.parentId ? "ml-5" : "")}>
                          {p.codigo} · {p.categoria}
                        </p>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      {p.fornecedor || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{brl(p.preco)}</td>
                    <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                      {dep} un
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <BarraGondola gond={gond} min={p.minimo} />
                        <span className={cn(gond <= p.minimo && gond > 0 ? "text-warning" : gond === 0 ? "text-destructive" : "")}>
                          {gond}
                          <span className="text-muted-foreground">/{p.minimo}</span>
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right lg:table-cell">
                      <span className={cn(
                        "font-medium",
                        valor === 0 ? "text-muted-foreground" : "",
                      )}>
                        {brl(valor)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/painel/produtos/$id"
                        params={{ id: p.id }}
                        className={cn(
                          "inline-block rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-80",
                          SIT[s].c,
                        )}
                      >
                        {SIT[s].t}
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    {sit !== "todos"
                      ? `Nenhum produto com situação "${SIT[sit as keyof typeof SIT]?.t}".`
                      : "Nenhum produto encontrado para esta busca."}
                  </td>
                </tr>
              )}
            </tbody>

            {lista.length > 0 && (
              <tfoot className="border-t bg-muted/20 text-xs text-muted-foreground">
                <tr>
                  <td className="px-4 py-2.5 font-semibold" colSpan={2}>
                    {lista.length} produto{lista.length !== 1 ? "s" : ""}
                    {lista.length < est.length && ` (de ${est.length})`}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right sm:table-cell" />
                  <td className="hidden px-4 py-2.5 text-right sm:table-cell" />
                  <td className="px-4 py-2.5 text-right" />
                  <td className="hidden px-4 py-2.5 text-right font-semibold lg:table-cell">
                    {brl(lista.reduce((s, p) => {
                      const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
                      return s + (dep + gond) * p.preco;
                    }, 0))}
                  </td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
