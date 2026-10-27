import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileCode2, Package, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, categorias } from "@/lib/mock-data";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos — OmniSafe 360" },
      { name: "description", content: "Todos os produtos da loja com estoque de depósito, gôndola e mínimo." },
      { property: "og:title", content: "Produtos — OmniSafe 360" },
      { property: "og:description", content: "Todos os produtos da loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Produtos,
});

type Situacao = "todos" | "ok" | "baixo" | "sem";

const SIT = {
  ok:    { t: "Estoque ok",     c: "bg-success/12 text-success",       borda: "border-success/40"   },
  baixo: { t: "Repor gôndola",  c: "bg-warning/15 text-warning",       borda: "border-warning/40"   },
  sem:   { t: "Sem estoque",    c: "bg-destructive/10 text-destructive",borda: "border-destructive/40"},
};

function situacao(dep: number, gond: number, min: number): "ok" | "baixo" | "sem" {
  if (dep + gond === 0) return "sem";
  if (gond <= min) return "baixo";
  return "ok";
}

function BarraEstoque({ gond, min }: { gond: number; min: number }) {
  const pct = min > 0 ? Math.min(100, (gond / (min * 2)) * 100) : (gond > 0 ? 100 : 0);
  const cor = gond === 0 ? "bg-destructive" : gond <= min ? "bg-warning" : "bg-success";
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", cor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Produtos() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [sit, setSit] = useState<Situacao>("todos");
  const est = useEstoque();
  const produtos = useProdutos();

  const live = useMemo(() => {
    const map: Record<string, { dep: number; gond: number }> = {};
    for (const p of produtos) {
      const dep = est.lotes.filter((l) => l.produtoId === p.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0);
      map[p.id] = { dep, gond: est.gondola[p.id] ?? 0 };
    }
    return map;
  }, [est.lotes, est.gondola, produtos]);

  const cont = useMemo(() => {
    const c = { ok: 0, baixo: 0, sem: 0 };
    produtos.forEach((p) => {
      const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
      c[situacao(dep, gond, p.minimo)]++;
    });
    return c;
  }, [live, produtos]);

  const lista = useMemo(() => {
    const t = q.toLowerCase();
    return produtos.filter((p) => {
      if (cat !== "Todas" && p.categoria !== cat) return false;
      if (t && !p.nome.toLowerCase().includes(t) && !p.codigo.includes(t)) return false;
      if (sit !== "todos") {
        const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
        if (situacao(dep, gond, p.minimo) !== sit) return false;
      }
      return true;
    });
  }, [q, cat, sit, produtos, live]);

  if (produtos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Produtos</h1>
            <p className="text-muted-foreground">Nenhum produto cadastrado ainda</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="lg"><Link to="/painel/produtos/importar"><FileCode2 /> Importar XML</Link></Button>
            <Button asChild size="lg"><Link to="/painel/produtos/novo"><Plus /> Novo produto</Link></Button>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed bg-card py-20 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-xl font-semibold">Cadastre seu primeiro produto</p>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Você pode cadastrar um a um ou importar todos de uma vez pelo XML da nota fiscal.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="outline" size="lg"><Link to="/painel/produtos/importar"><FileCode2 /> Importar XML</Link></Button>
            <Button asChild size="lg"><Link to="/painel/produtos/novo"><Plus /> Cadastrar produto</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">{produtos.length} produto{produtos.length !== 1 ? "s" : ""} cadastrado{produtos.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" size="lg"><Link to="/painel/produtos/importar"><FileCode2 /> Importar XML</Link></Button>
          <Button asChild size="lg"><Link to="/painel/produtos/novo"><Plus /> Novo produto</Link></Button>
        </div>
      </div>

      {/* Tiles de situação — clicáveis como filtro */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(SIT) as (keyof typeof SIT)[]).map((k) => (
          <button
            key={k}
            onClick={() => setSit(sit === k ? "todos" : k)}
            className={cn(
              "flex items-center justify-between rounded-2xl border bg-card p-5 transition hover:shadow-elegant",
              sit === k && SIT[k].borda,
            )}
          >
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", SIT[k].c)}>{SIT[k].t}</span>
            <span className="font-display text-2xl font-bold">{cont[k]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou código de barras"
              className="pl-9"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
                  cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3 hidden md:table-cell">Fornecedor</th>
              <th className="px-4 py-3 text-right">Preço de venda</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">No depósito</th>
              <th className="px-4 py-3 text-right">Na gôndola · mín.</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.map((p) => {
              const { dep, gond } = live[p.id] ?? { dep: 0, gond: 0 };
              const s = situacao(dep, gond, p.minimo);
              return (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link to="/painel/produtos/$id" params={{ id: p.id }} className="group">
                      <p className="font-semibold group-hover:text-primary">{p.nome}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.fornecedor || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{brl(p.preco)}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">{dep} un</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <BarraEstoque gond={gond} min={p.minimo} />
                      <span>{gond} / {p.minimo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", SIT[s].c)}>
                      {SIT[s].t}
                    </span>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {sit !== "todos"
                    ? `Nenhum produto com situação "${SIT[sit as keyof typeof SIT]?.t}" encontrado.`
                    : "Nenhum produto encontrado para esta busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
