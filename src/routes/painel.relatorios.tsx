import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, PackageX, TrendingDown, Trophy } from "lucide-react";
import { brl, produtos } from "@/lib/mock-data";
import { useEstoque } from "@/lib/estoque-store";

export const Route = createFileRoute("/painel/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — OmniSafe 360" },
      { name: "description", content: "Curva ABC, produtos parados e perdas do mês." },
      { property: "og:title", content: "Relatórios — OmniSafe 360" },
      { property: "og:description", content: "Relatórios de vendas e estoque no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

// Vendas do mês (exemplo) em unidades e último dia com venda
const vendasMes: Record<string, { un: number; ultima: number }> = {
  "1": { un: 620, ultima: 0 }, "2": { un: 1480, ultima: 0 }, "3": { un: 210, ultima: 1 },
  "4": { un: 540, ultima: 0 }, "5": { un: 390, ultima: 0 }, "6": { un: 18, ultima: 23 }, "7": { un: 330, ultima: 2 },
};

export function curvaAbc() {
  const linhas = produtos.map((p) => ({ p, fat: (vendasMes[p.id]?.un ?? 0) * p.preco })).sort((a, b) => b.fat - a.fat);
  const total = linhas.reduce((s, l) => s + l.fat, 0);
  let acum = 0;
  return linhas.map((l) => {
    acum += l.fat;
    const pct = (acum / total) * 100;
    return { ...l, pct: (l.fat / total) * 100, classe: pct <= 80 ? "A" : pct <= 95 ? "B" : "C" };
  });
}

function Relatorios() {
  const est = useEstoque();
  const abc = curvaAbc();
  const total = abc.reduce((s, l) => s + l.fat, 0);
  const perdas = est.movs.filter((m) => m.tipo === "ajuste" && m.qtd < 0);
  const valorPerdas = perdas.reduce((s, m) => s + Math.abs(m.qtd) * (produtos.find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
  const parados = produtos.filter((p) => (vendasMes[p.id]?.ultima ?? 99) >= 15);
  const cor = { A: "bg-success/15 text-success", B: "bg-warning/15 text-warning", C: "bg-muted text-muted-foreground" } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Outubro de 2026 · o que mais vende, o que está parado e o que se perdeu.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { t: "Faturamento do mês", v: brl(total), i: BarChart3 },
          { t: "Produtos parados (15+ dias)", v: String(parados.length), i: PackageX },
          { t: "Perdas registradas", v: brl(valorPerdas), i: TrendingDown },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border bg-card p-5 shadow-sm">
            <k.i className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{k.t}</p>
            <p className="font-display text-2xl font-bold">{k.v}</p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Trophy className="h-5 w-5 text-primary" /> Curva ABC</h2>
        <p className="mb-4 text-sm text-muted-foreground">A = 80% do faturamento (nunca pode faltar) · B = próximos 15% · C = restante.</p>
        <div className="space-y-3">
          {abc.map((l) => (
            <div key={l.p.id} className="flex items-center gap-4">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${cor[l.classe as "A"]}`}>{l.classe}</span>
              <div className="flex-1">
                <div className="flex justify-between text-sm"><span className="font-medium">{l.p.nome}</span><span>{brl(l.fat)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-gradient-brand" style={{ width: `${l.pct}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Produtos parados</h2>
          {parados.map((p) => (
            <div key={p.id} className="flex justify-between border-b py-2 text-sm last:border-0">
              <span>{p.nome}</span><span className="text-warning">sem venda há {vendasMes[p.id]?.ultima} dias</span>
            </div>
          ))}
        </section>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Perdas</h2>
          {perdas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma perda registrada.</p>}
          {perdas.map((m) => (
            <div key={m.id} className="flex justify-between border-b py-2 text-sm last:border-0">
              <span>{produtos.find((p) => p.id === m.produtoId)?.nome} · {m.destino}</span><span className="text-destructive">{m.qtd} un</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
