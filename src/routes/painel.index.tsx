import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarClock, DollarSign, PackageMinus, RefreshCw } from "lucide-react";
import { useEstoque } from "@/lib/estoque-store";
import { useOperacao } from "@/lib/operacao-store";
import { abaixoDoMinimo, HOJE, lotesVencendo, vendasHoje, vendasOntem, vendasPorHora } from "@/lib/computed";
import { brl } from "@/lib/mock-data";
import { useConfig } from "@/lib/config-store";
import { useEquipe } from "@/lib/equipe-store";
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

const tomCls: Record<string, string> = {
  primary: "bg-secondary text-primary",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

function dataFormatada() {
  const s = new Date(HOJE + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Inicio() {
  const est = useEstoque();
  const op = useOperacao();
  const config = useConfig();
  const equipe = useEquipe();
  const dono = equipe[0];

  const hoje = vendasHoje(est.movs);
  const ontem = vendasOntem(est.movs);
  const pct = ontem > 0 ? Math.round(((hoje - ontem) / ontem) * 100) : 0;
  const pctLabel = `${pct >= 0 ? "+" : ""}${pct}% vs. ontem`;

  const abaixo = abaixoDoMinimo(est.gondola);
  const vencendoUrgente = lotesVencendo(est.lotes, config.avisoVencimentoUrgente);
  const vencendoAmanha = vencendoUrgente.filter((l) => l.dias >= 0 && l.dias <= 1).length;
  const inconsAbertas = op.inconsistencias.filter((i) => i.status === "aberta");

  const horas = vendasPorHora(est.movs);
  const maxHora = Math.max(...horas, 1);

  const reposicao = abaixo.slice(0, 4);
  const validades = lotesVencendo(est.lotes, config.avisoVencimento1);

  const kpis = [
    { label: "Vendas hoje", valor: brl(hoje), extra: pctLabel, icon: DollarSign, tom: "primary" },
    { label: "Abaixo do mínimo", valor: String(abaixo.length), extra: `${abaixo.length} aguardam reposição`, icon: PackageMinus, tom: "warning" },
    {
      label: `Lotes vencendo (${config.avisoVencimentoUrgente} dias)`,
      valor: String(vencendoUrgente.length),
      extra: vencendoAmanha > 0 ? `${vencendoAmanha} vence${vencendoAmanha > 1 ? "m" : ""} amanhã` : "dentro do prazo",
      icon: CalendarClock,
      tom: vencendoUrgente.length > 0 ? "destructive" : "primary",
    },
    { label: "Inconsistências", valor: String(inconsAbertas.length), extra: "aguardando análise", icon: AlertTriangle, tom: inconsAbertas.length > 0 ? "warning" : "primary" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">{dataFormatada()}</p>
        <h1 className="text-3xl font-bold">{saudacao()}, {dono?.nome.split(" ")[0] ?? "Maria"} 👋</h1>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, valor, extra, icon: Icon, tom }) => (
          <div key={label} className="rounded-2xl border bg-card p-5 shadow-elegant">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <span className={cn("rounded-lg p-2", tomCls[tom])}>
                <Icon className="h-4 w-4" />
              </span>
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
            <span className={cn("flex items-center gap-1 text-sm font-semibold", pct >= 0 ? "text-success" : "text-destructive")}>
              <ArrowUpRight className={cn("h-4 w-4", pct < 0 && "rotate-180")} />
              {Math.abs(pct)}%
            </span>
          </div>
          <div className="mt-6 flex h-52 items-end gap-3">
            {horas.map((v, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-md bg-gradient-brand" style={{ height: `${Math.max(4, Math.round((v / maxHora) * 160))}px` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{8 + i}h</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <RefreshCw className="h-4 w-4 text-primary" />
            Reposição de gôndola
          </h2>
          {reposicao.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Todos os produtos acima do mínimo.</p>
          ) : (
            <ul className="mt-4 divide-y">
              {reposicao.map((p) => {
                const qtd = est.gondola[p.id] ?? 0;
                const pctBar = Math.min(100, (qtd / p.minimo) * 100);
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">{qtd === 0 ? "Zerado" : "Abaixo"}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-warning" style={{ width: `${pctBar}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {qtd} na gôndola · mínimo {p.minimo}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="h-4 w-4 text-destructive" />
          Lotes perto do vencimento
        </h2>
        {validades.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum lote vence nos próximos {config.avisoVencimento1} dias.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-3">Produto</th>
                <th className="pb-3">Lote</th>
                <th className="pb-3">Quantidade</th>
                <th className="pb-3">Vence em</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {validades.map((v) => (
                <tr key={v.id}>
                  <td className="py-3 font-medium">{v.produto.nome}</td>
                  <td className="py-3 font-mono text-xs">{v.lote}</td>
                  <td className="py-3">{v.qtd} un</td>
                  <td className="py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        v.faixa === "vencido" || v.faixa === "7"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-warning/15 text-warning",
                      )}
                    >
                      {v.faixa === "vencido" ? "Vencido" : `${v.dias} ${v.dias === 1 ? "dia" : "dias"}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
