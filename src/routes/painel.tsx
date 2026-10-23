import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  AlertTriangle, ArrowRightLeft, BarChart3, Bell, Boxes, CalendarClock, LayoutDashboard,
  Menu, Package, PackageOpen, RefreshCw, ScanBarcode, Search, Settings, Truck, Users, Warehouse, X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/input";
import { useEstoque } from "@/lib/estoque-store";
import { useOperacao } from "@/lib/operacao-store";
import { abaixoDoMinimo, lotesVencendo } from "@/lib/computed";
import { useProdutos } from "@/lib/produtos-store";
import { useConfig } from "@/lib/config-store";
import { useEquipe } from "@/lib/equipe-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel")({ component: PainelLayout });

const grupos = [
  { titulo: "Visão geral", itens: [{ label: "Início", icon: LayoutDashboard, to: "/painel" as const, exact: true }] },
  { titulo: "Cadastros", itens: [{ label: "Produtos", icon: Package, to: "/painel/produtos" as const }, { label: "Fornecedores", icon: Truck, to: "/painel/fornecedores" as const }] },
  { titulo: "Estoque", itens: [{ label: "Depósito", icon: Warehouse, to: "/painel/deposito" as const }, { label: "Gôndola", icon: Boxes, to: "/painel/gondola" as const }, { label: "Movimentações", icon: ArrowRightLeft, to: "/painel/movimentacoes" as const }, { label: "Validades", icon: CalendarClock, to: "/painel/validades" as const }] },
  { titulo: "Operação", itens: [{ label: "PDV", icon: ScanBarcode, to: "/painel/pdv" as const }, { label: "Reposição", icon: RefreshCw, to: "/painel/reposicao" as const }, { label: "Recebimentos", icon: PackageOpen, to: "/painel/recebimentos" as const }, { label: "Inconsistências", icon: AlertTriangle, to: "/painel/inconsistencias" as const }] },
  { titulo: "Gestão", itens: [{ label: "Relatórios", icon: BarChart3, to: "/painel/relatorios" as const }, { label: "Equipe", icon: Users, to: "/painel/equipe" as const }, { label: "Configurações", icon: Settings, to: "/painel/configuracoes" as const }] },
];

function PainelLayout() {
  const est = useEstoque();
  const op = useOperacao();
  const produtos = useProdutos();
  const config = useConfig();
  const equipe = useEquipe();
  const dono = equipe[0];

  // --- Sidebar mobile ---
  const [sidebarAberto, setSidebarAberto] = useState(false);

  // --- Busca global ---
  const [busca, setBusca] = useState("");
  const [buscaFocada, setBuscaFocada] = useState(false);
  const resultados = busca.length >= 2
    ? produtos.filter((p) =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoria.toLowerCase().includes(busca.toLowerCase()),
      ).slice(0, 6)
    : [];

  // --- Notificações ---
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const abaixo = abaixoDoMinimo(est.gondola);
  const vencendo7 = lotesVencendo(est.lotes, config.avisoVencimentoUrgente);
  const inconsAbertas = op.inconsistencias.filter((i) => i.status === "aberta");
  const totalAlertas = abaixo.length + vencendo7.length + inconsAbertas.length;

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarAberto && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarAberto(false)} />
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:translate-x-0",
        sidebarAberto ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="flex items-center justify-between px-5 py-6">
          <Logo light />
          <button className="rounded-lg p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden" onClick={() => setSidebarAberto(false)} aria-label="Fechar menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">{g.titulo}</p>
              {g.itens.map((i) => {
                const Icon = i.icon;
                const base = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";
                return (
                  <Link
                    key={i.label}
                    to={i.to}
                    activeOptions={{ exact: "exact" in i && !!i.exact }}
                    className={base}
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                    onClick={() => setSidebarAberto(false)}
                  >
                    <Icon className="h-4 w-4 text-sidebar-primary" /> {i.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <p className="font-semibold text-sidebar-accent-foreground">{config.nomeLoja}</p>
          <p className="text-xs text-sidebar-foreground/55">{config.cidade} · {config.uf}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card/90 px-4 backdrop-blur lg:px-8">
          <button
            className="rounded-lg p-2 hover:bg-muted lg:hidden"
            aria-label="Menu"
            onClick={() => setSidebarAberto((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Busca global */}
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, código ou categoria…"
              className="h-10 pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onFocus={() => setBuscaFocada(true)}
              onBlur={() => setTimeout(() => setBuscaFocada(false), 150)}
            />
            {buscaFocada && resultados.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border bg-card shadow-xl">
                {resultados.map((p) => (
                  <Link
                    key={p.id}
                    to="/painel/produtos/$id"
                    params={{ id: p.id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                    onClick={() => setBusca("")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.codigo} · {p.categoria}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{est.gondola[p.id] ?? 0} na gôndola</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Notificações */}
          <div ref={notifRef} className="relative ml-auto">
            <button
              className="relative rounded-lg p-2 hover:bg-muted"
              aria-label="Notificações"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="h-5 w-5" />
              {totalAlertas > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {totalAlertas > 9 ? "9+" : totalAlertas}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-card p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Alertas ativos</p>
                    <button className="rounded p-0.5 hover:bg-muted" onClick={() => setNotifOpen(false)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {totalAlertas === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem alertas no momento.</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {abaixo.length > 0 && (
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                            {abaixo.length} produto{abaixo.length > 1 ? "s" : ""} abaixo do mínimo
                          </p>
                          {abaixo.slice(0, 3).map((p) => (
                            <div key={p.id} className="flex justify-between border-b py-1.5 last:border-0">
                              <span className="truncate">{p.nome}</span>
                              <span className="ml-2 shrink-0 text-muted-foreground">{est.gondola[p.id] ?? 0}/{p.minimo}</span>
                            </div>
                          ))}
                          {abaixo.length > 3 && (
                            <p className="mt-1 text-xs text-muted-foreground">+{abaixo.length - 3} outros</p>
                          )}
                        </div>
                      )}
                      {vencendo7.length > 0 && (
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                            {vencendo7.length} lote{vencendo7.length > 1 ? "s" : ""} vencendo em 7 dias
                          </p>
                          {vencendo7.slice(0, 3).map((l) => (
                            <div key={l.id} className="flex justify-between border-b py-1.5 last:border-0">
                              <span className="truncate">{l.produto.nome}</span>
                              <span className="ml-2 shrink-0 text-muted-foreground">
                                {l.faixa === "vencido" ? "Vencido" : `${l.dias}d`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {inconsAbertas.length > 0 && (
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                            {inconsAbertas.length} inconsistência{inconsAbertas.length > 1 ? "s" : ""} aberta{inconsAbertas.length > 1 ? "s" : ""}
                          </p>
                          {inconsAbertas.slice(0, 3).map((i) => (
                            <div key={i.id} className="truncate border-b py-1.5 last:border-0">
                              {produtos.find((p) => p.id === i.produtoId)?.nome ?? "Produto"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Usuário */}
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground">
              {(dono?.nome ?? "MS").split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <div className="text-sm leading-tight">
              <p className="font-semibold">{dono?.nome ?? "Usuário"}</p>
              <p className="text-xs text-muted-foreground">{dono?.papel ?? "Proprietário"}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
