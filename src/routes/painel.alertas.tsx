import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle, Bell, CheckCircle2, Clock, Download,
  Package, PackageX, ShoppingCart, Timer, XCircle,
} from "lucide-react";
import { useEstoque } from "@/lib/estoque-store";
import { useOperacao } from "@/lib/operacao-store";
import { useProdutos } from "@/lib/produtos-store";
import { useConfig } from "@/lib/config-store";
import { usePedidos } from "@/lib/pedidos-store";
import {
  abaixoDoMinimo, abaixoDoMinimoDeposito, diasSemVenda, lotesVencendo, vendasPorProduto, HOJE,
  inteligenciaProdutos, gerarAlertasIntel, type AlertaIntel,
} from "@/lib/computed";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/alertas")({
  head: () => ({
    meta: [{ title: "Central de Alertas — OmniSafe 360" }],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Alertas,
});

const DIAS_PARADO = 30;
const DIAS_INCONS_ANTIGA = 3;

type Categoria = {
  id: string;
  titulo: string;
  cor: string;
  icone: React.ReactNode;
  link: string;
  itens: { label: string; detalhe: string }[];
};

function Alertas() {
  const est = useEstoque();
  const op = useOperacao();
  const produtos = useProdutos();
  const config = useConfig();
  const { pedidos } = usePedidos();

  const categorias = useMemo<Categoria[]>(() => {
    const abaixoTodos = abaixoDoMinimo(est.gondola);
    const zerados = abaixoTodos.filter((p) => (est.gondola[p.id] ?? 0) === 0);
    const abaixo = abaixoTodos.filter((p) => (est.gondola[p.id] ?? 0) > 0);
    const totaisDeposito: Record<string, number> = {};
    for (const l of est.lotes) {
      if (l.qtd > 0) totaisDeposito[l.produtoId] = (totaisDeposito[l.produtoId] ?? 0) + l.qtd;
    }
    const depositoBaixo = abaixoDoMinimoDeposito(est.lotes);
    const vencendo = lotesVencendo(est.lotes, config.avisoVencimentoUrgente);
    const inconsAntigas = op.inconsistencias.filter((i) => {
      if (i.status !== "aberta") return false;
      const dias = Math.floor((new Date(HOJE).getTime() - new Date(i.data).getTime()) / 86_400_000);
      return dias >= DIAS_INCONS_ANTIGA;
    });
    const pedidosAtencao = pedidos.filter((p) => {
      if (!["rascunho", "enviado"].includes(p.status)) return false;
      const dias = Math.floor((new Date(HOJE).getTime() - new Date(p.dataEmissao).getTime()) / 86_400_000);
      return dias >= config.diasAlertaPedido;
    });
    const vendasMap = vendasPorProduto(est.movs);
    const parados = produtos.filter((p) => diasSemVenda(vendasMap[p.id]?.ultimaData ?? null) >= DIAS_PARADO);
    const nuncaVendeu = parados.filter((p) => !vendasMap[p.id]);
    const paradoHaDias = parados.filter((p) => vendasMap[p.id]);

    return [
      {
        id: "deposito-baixo",
        titulo: "Depósito abaixo do mínimo",
        cor: "text-primary",
        icone: <Package className="h-4 w-4" />,
        link: "/painel/deposito",
        itens: depositoBaixo.map((p) => ({
          label: p.nome,
          detalhe: `${totaisDeposito[p.id] ?? 0} / mín ${p.minimoDeposito ?? 10} un`,
        })),
      },
      {
        id: "zerado",
        titulo: "Estoque zerado na gôndola",
        cor: "text-destructive",
        icone: <PackageX className="h-4 w-4" />,
        link: "/painel/gondola",
        itens: zerados.map((p) => ({
          label: p.nome,
          detalhe: `Mínimo: ${p.minimo} un`,
        })),
      },
      {
        id: "abaixo",
        titulo: "Abaixo do mínimo",
        cor: "text-orange-500",
        icone: <AlertTriangle className="h-4 w-4" />,
        link: "/painel/reposicao",
        itens: abaixo.map((p) => ({
          label: p.nome,
          detalhe: `${est.gondola[p.id] ?? 0} / ${p.minimo} un`,
        })),
      },
      {
        id: "vencendo",
        titulo: "Lotes vencendo em breve",
        cor: "text-destructive",
        icone: <Timer className="h-4 w-4" />,
        link: "/painel/validades",
        itens: vencendo.map((l) => ({
          label: l.produto.nome,
          detalhe: l.faixa === "vencido" ? "Vencido · lote " + l.lote : `${l.dias}d restantes · lote ${l.lote}`,
        })),
      },
      {
        id: "incons",
        titulo: `Inconsistências abertas há +${DIAS_INCONS_ANTIGA}d`,
        cor: "text-orange-500",
        icone: <AlertTriangle className="h-4 w-4" />,
        link: "/painel/inconsistencias",
        itens: inconsAntigas.map((i) => {
          const p = produtos.find((x) => x.id === i.produtoId);
          const dias = Math.floor((new Date(HOJE).getTime() - new Date(i.data).getTime()) / 86_400_000);
          return { label: p?.nome ?? "Produto desconhecido", detalhe: `${i.origem} · ${dias}d aberta` };
        }),
      },
      {
        id: "pedidos",
        titulo: `Pedidos parados há +${config.diasAlertaPedido}d`,
        cor: "text-primary",
        icone: <ShoppingCart className="h-4 w-4" />,
        link: "/painel/pedidos",
        itens: pedidosAtencao.map((p) => {
          const dias = Math.floor((new Date(HOJE).getTime() - new Date(p.dataEmissao).getTime()) / 86_400_000);
          return { label: p.numero, detalhe: `${p.fornecedorNome || "—"} · ${dias}d · ${p.status}` };
        }),
      },
      {
        id: "nunca-vendeu",
        titulo: "Nunca vendidos (sem registro de venda)",
        cor: "text-muted-foreground",
        icone: <XCircle className="h-4 w-4" />,
        link: "/painel/relatorios",
        itens: nuncaVendeu.map((p) => {
          const depTotal = est.lotes.filter((l) => l.produtoId === p.id).reduce((s, l) => s + l.qtd, 0);
          return { label: p.nome, detalhe: `Estoque: ${(est.gondola[p.id] ?? 0) + depTotal} un. · nunca vendido` };
        }),
      },
      {
        id: "parado",
        titulo: `Parado há +${DIAS_PARADO}d (tinha vendas)`,
        cor: "text-muted-foreground",
        icone: <Clock className="h-4 w-4" />,
        link: "/painel/relatorios",
        itens: paradoHaDias.map((p) => {
          const dsv = diasSemVenda(vendasMap[p.id]?.ultimaData ?? null);
          return { label: p.nome, detalhe: `${dsv}d sem venda` };
        }),
      },
    ].filter((c) => c.itens.length > 0);
  }, [est, op, produtos, config, pedidos]);

  const total = categorias.reduce((s, c) => s + c.itens.length, 0);

  const alertasIA = useMemo<AlertaIntel[]>(() => {
    const intel = inteligenciaProdutos(est.movs, est.gondola, est.lotes);
    return gerarAlertasIntel(intel, est.gondola, est.lotes);
  }, [est.movs, est.gondola, est.lotes]);

  function exportarCSV() {
    const rows = ["Categoria,Produto / Referência,Detalhe"];
    for (const cat of categorias) {
      for (const item of cat.itens) {
        rows.push(`"${cat.titulo}","${item.label.replace(/"/g, '""')}","${item.detalhe.replace(/"/g, '""')}"`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alertas-${HOJE}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Central de Alertas</h1>
            <p className="text-sm text-muted-foreground">
              {total > 0
                ? `${total} alerta${total !== 1 ? "s" : ""} ativo${total !== 1 ? "s" : ""}`
                : "Nenhum alerta ativo no momento"}
            </p>
          </div>
        </div>
        {total > 0 && (
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        )}
      </div>

      {/* Motor de Inteligência */}
      {alertasIA.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between border-b border-primary/15 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Bell className="h-4 w-4" />
              <span>Motor de Inteligência</span>
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold">
                {alertasIA.length}
              </span>
            </div>
            <Link to="/painel/pedidos/sugerir" className="text-xs text-primary hover:underline">
              Sugerir pedido →
            </Link>
          </div>
          <div className="divide-y divide-primary/10 text-sm">
            {alertasIA.map((a) => (
              <Link
                key={a.produtoId}
                to="/painel/produtos/$id"
                params={{ id: a.produtoId }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors"
              >
                <span className={cn(
                  "shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                  a.tipo === "critico" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning",
                )}>
                  {a.tipo === "critico" ? "Crítico" : "Atenção"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.produtoNome}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.titulo}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{a.detalhe.split(" · ")[0]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tudo ok */}
      {total === 0 && alertasIA.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <p className="text-lg font-semibold">Tudo em ordem!</p>
          <p className="text-sm text-muted-foreground">
            Não há alertas ativos no momento.
          </p>
          <Link to="/painel/configuracoes" className="mt-2 text-xs text-primary hover:underline">
            Configurar limiares de alerta →
          </Link>
        </div>
      )}

      {/* Categorias */}
      {categorias.map((cat) => (
        <div key={cat.id} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className={cn("flex items-center gap-2 font-semibold text-sm", cat.cor)}>
              {cat.icone}
              <span>{cat.titulo}</span>
              <span className="ml-1 rounded-full bg-current/10 px-2 py-0.5 text-xs font-bold">
                {cat.itens.length}
              </span>
            </div>
            <Link
              to={cat.link as "/painel/gondola"}
              className="text-xs text-primary hover:underline"
            >
              Ver →
            </Link>
          </div>
          <div className="divide-y text-sm">
            {cat.itens.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                <span className="ml-4 shrink-0 text-xs text-muted-foreground">{item.detalhe}</span>
              </div>
            ))}
          </div>
          {cat.itens.length > 10 && (
            <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
              Mostrando todos os {cat.itens.length} itens · exporte o CSV para ver fora da tela
            </div>
          )}
        </div>
      ))}

      {/* Link configurações */}
      <div className="text-center text-xs text-muted-foreground">
        <Link to="/painel/configuracoes" className="hover:text-foreground hover:underline">
          Configurar limiares de alerta →
        </Link>
      </div>
    </div>
  );
}
