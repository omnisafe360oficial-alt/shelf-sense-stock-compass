import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Printer, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/etiquetas")({
  head: () => ({
    meta: [
      { title: "Etiquetas — OmniSafe 360" },
      { name: "description", content: "Imprima etiquetas de gôndola com preço e código de barras." },
      { property: "og:title", content: "Etiquetas — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Etiquetas,
});

function brlPreco(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Etiquetas() {
  const produtos = useProdutos();
  const [q, setQ] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const lista = produtos.filter(
    (p) => p.nome.toLowerCase().includes(q.toLowerCase()) || p.codigo.includes(q),
  );

  const toggle = (id: string) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const selecionadosList = produtos.filter((p) => selecionados.has(p.id));

  return (
    <>
      <style>{`
        @media print {
          aside, header, .etiquetas-ui { display: none !important; }
          main { padding: 0 !important; }
          .etiquetas-grid { display: flex !important; }
        }
        .etiquetas-grid { display: none; }
      `}</style>

      <div className="etiquetas-ui space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Etiquetas de Gôndola</h1>
            <p className="text-muted-foreground">Selecione os produtos e imprima as etiquetas de preço</p>
          </div>
          <div className="flex items-center gap-3">
            {selecionados.size > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelecionados(new Set())}>
                Limpar seleção
              </Button>
            )}
            <Button disabled={selecionados.size === 0} onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir {selecionados.size > 0 ? `(${selecionados.size})` : ""}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Seleção de produtos */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto ou código…" className="h-11 pl-9" />
            </div>
            <div className="rounded-2xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <p className="text-sm font-semibold">{lista.length} produtos</p>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelecionados(new Set(lista.map((p) => p.id)))}
                >
                  Selecionar todos
                </button>
              </div>
              {lista.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  <Tag className="mx-auto mb-2 h-6 w-6 opacity-30" />
                  Nenhum produto encontrado.
                </div>
              ) : (
                <ul className="max-h-[60vh] divide-y overflow-y-auto">
                  {lista.map((p) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={selecionados.has(p.id)}
                          onChange={() => toggle(p.id)}
                          className="h-4 w-4 accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.nome}</p>
                          <p className="font-mono text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">R$ {brlPreco(p.preco)}</p>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Pré-visualização */}
          <div>
            <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pré-visualização</p>
            {selecionadosList.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card py-16 text-center text-muted-foreground">
                <Tag className="mx-auto mb-2 h-8 w-8 opacity-25" />
                <p className="text-sm">Selecione produtos para ver as etiquetas</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 rounded-2xl border bg-muted/30 p-4">
                {selecionadosList.map((p) => (
                  <div key={p.id} className="w-40 rounded-xl border-2 border-border bg-card p-3 shadow-sm">
                    <p className="line-clamp-2 text-xs font-bold leading-tight">{p.nome}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{p.codigo}</p>
                    <p className="mt-2 font-display text-2xl font-bold leading-none">
                      <span className="text-xs font-normal">R$</span> {brlPreco(p.preco)}
                    </p>
                    <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                      <span>Mín {p.minimo}</span>
                      <span>Máx {p.maximo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grade de impressão */}
      <div className="etiquetas-grid flex-wrap gap-6 bg-white p-8 content-start">
        {selecionadosList.map((p) => (
          <div
            key={p.id}
            style={{ width: "160px", border: "1.5px solid #000", borderRadius: "8px", padding: "10px", breakInside: "avoid" }}
          >
            <p style={{ fontSize: "11px", fontWeight: "700", lineHeight: "1.3", margin: 0 }}>{p.nome}</p>
            <p style={{ fontSize: "9px", fontFamily: "monospace", color: "#555", margin: "4px 0 0" }}>{p.codigo}</p>
            <p style={{ fontSize: "22px", fontWeight: "900", margin: "6px 0 0", letterSpacing: "-0.5px" }}>
              <span style={{ fontSize: "11px", fontWeight: "400" }}>R$</span> {brlPreco(p.preco)}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666", marginTop: "6px" }}>
              <span>Mín: {p.minimo}</span>
              <span>Máx: {p.maximo}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
