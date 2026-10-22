import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileCode2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, categorias, produtos, situacao } from "@/lib/mock-data";
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

const badge = {
  ok: { t: "Estoque ok", c: "bg-success/12 text-success" },
  baixo: { t: "Repor gôndola", c: "bg-warning/15 text-warning" },
  sem: { t: "Sem estoque", c: "bg-destructive/10 text-destructive" },
};

function Produtos() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const lista = useMemo(
    () => produtos.filter((p) => (cat === "Todas" || p.categoria === cat) && (p.nome.toLowerCase().includes(q.toLowerCase()) || p.codigo.includes(q))),
    [q, cat],
  );
  const cont = { ok: 0, baixo: 0, sem: 0 };
  produtos.forEach((p) => cont[situacao(p)]++);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">{produtos.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" disabled title="Etapa 5"><FileCode2 /> Importar XML</Button>
          <Button asChild size="lg"><Link to="/painel/produtos/novo"><Plus /> Novo produto</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.keys(badge) as (keyof typeof badge)[]).map((k) => (
          <div key={k} className="flex items-center justify-between rounded-2xl border bg-card p-5">
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", badge[k].c)}>{badge[k].t}</span>
            <span className="font-display text-2xl font-bold">{cont[k]}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou código de barras" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Todas", ...categorias].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{c}</button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produto</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3 text-right">Preço</th>
              <th className="px-4 py-3 text-right">Depósito</th><th className="px-4 py-3 text-right">Gôndola / mín.</th><th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.map((p) => {
              const s = badge[situacao(p)];
              return (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3"><p className="font-semibold">{p.nome}</p><p className="font-mono text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.fornecedor}</td>
                  <td className="px-4 py-3 text-right font-medium">{brl(p.preco)}</td>
                  <td className="px-4 py-3 text-right">{p.deposito}</td>
                  <td className="px-4 py-3 text-right">{p.gondola} / {p.minimo}</td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", s.c)}>{s.t}</span></td>
                </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
