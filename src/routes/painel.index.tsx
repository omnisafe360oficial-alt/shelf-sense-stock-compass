import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarClock, DollarSign, PackageMinus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/")({
  head: () => ({
    meta: [
      { title: "Início — OmniSafe 360" },
      { name: "description", content: "Resumo do dia: vendas, reposições, validades e inconsistências da sua loja." },
      { property: "og:title", content: "Início — OmniSafe 360" },
      { property: "og:description", content: "Resumo do dia da sua loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inicio,
});

const kpis = [
  { label: "Vendas hoje", valor: "R$ 18.420", extra: "+12% vs. ontem", icon: DollarSign, tom: "primary" },
  { label: "Abaixo do mínimo", valor: "14", extra: "repositor avisado", icon: PackageMinus, tom: "warning" },
  { label: "Lotes vencendo (7 dias)", valor: "9", extra: "3 vencem amanhã", icon: CalendarClock, tom: "destructive" },
  { label: "Inconsistências", valor: "2", extra: "aguardando análise", icon: AlertTriangle, tom: "warning" },
];
const tomCls: Record<string, string> = {
  primary: "bg-secondary text-primary",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};
const vendas = [42, 55, 38, 61, 72, 58, 80, 66, 90, 74, 84, 96];
const reposicao = [
  { p: "Sabonete Lux 85g", g: 10, min: 10, status: "Avisado" },
  { p: "Leite Integral 1L", g: 6, min: 24, status: "Em reposição" },
  { p: "Arroz Tio João 5kg", g: 4, min: 8, status: "Avisado" },
  { p: "Detergente Ypê 500ml", g: 9, min: 12, status: "Avisado" },
];
const validades = [
  { p: "Iogurte Natural 170g", lote: "L2310A", dias: 1, qtd: 36 },
  { p: "Pão de forma 500g", lote: "PF8821", dias: 2, qtd: 18 },
  { p: "Queijo Mussarela kg", lote: "QM0452", dias: 5, qtd: 12 },
  { p: "Presunto fatiado", lote: "PR1190", dias: 7, qtd: 20 },
];

function Inicio() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Quinta-feira, 22 de outubro</p>
        <h1 className="text-3xl font-bold">Bom dia, Maria 👋</h1>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, valor, extra, icon: Icon, tom }) => (
          <div key={label} className="rounded-2xl border bg-card p-5 shadow-elegant">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <span className={cn("rounded-lg p-2", tomCls[tom])}><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{extra}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Vendas por hora</h2>
            <span className="flex items-center gap-1 text-sm font-semibold text-success"><ArrowUpRight className="h-4 w-4" />12%</span>
          </div>
          <div className="mt-6 flex h-52 items-end gap-3">
            {vendas.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-gradient-brand" style={{ height: `${v}%` }} />
                <span className="text-[10px] text-muted-foreground">{8 + i}h</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><RefreshCw className="h-4 w-4 text-primary" />Reposição de gôndola</h2>
          <ul className="mt-4 divide-y">
            {reposicao.map((r) => (
              <li key={r.p} className="py-3">
                <div className="flex justify-between text-sm"><span className="font-medium">{r.p}</span><span className="text-xs text-muted-foreground">{r.status}</span></div>
                <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(100, (r.g / r.min) * 100)}%` }} /></div>
                <p className="mt-1 text-xs text-muted-foreground">{r.g} na gôndola · mínimo {r.min}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-4 w-4 text-destructive" />Lotes perto do vencimento</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr><th className="pb-3">Produto</th><th className="pb-3">Lote</th><th className="pb-3">Quantidade</th><th className="pb-3">Vence em</th></tr>
          </thead>
          <tbody className="divide-y">
            {validades.map((v) => (
              <tr key={v.lote}>
                <td className="py-3 font-medium">{v.p}</td>
                <td className="py-3 font-mono text-xs">{v.lote}</td>
                <td className="py-3">{v.qtd} un</td>
                <td className="py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", v.dias <= 2 ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning")}>{v.dias} {v.dias === 1 ? "dia" : "dias"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
