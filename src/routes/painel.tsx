import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRightLeft, ArrowLeftRight, BarChart3, BarChart2, Bell, Boxes, CalendarClock, ClipboardCheck, ClipboardList, LayoutDashboard,
  LogOut, Menu, Moon, Package, PackageOpen, RefreshCw, ScanBarcode, Search, Settings, ShoppingCart, ShieldAlert, Sun, Tag, Target, Truck, Users, Warehouse, X, Shield,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/input";
import { useEstoque } from "@/lib/estoque-store";
import { useOperacao } from "@/lib/operacao-store";
import { abaixoDoMinimo, lotesVencendo, HOJE } from "@/lib/computed";
import { useProdutos } from "@/lib/produtos-store";
import { useConfig } from "@/lib/config-store";
import { useEquipe } from "@/lib/equipe-store";
import { useTema, alternarTema } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAuth, signOut } from "@/lib/auth";
import { usePedidos } from "@/lib/pedidos-store";
import { calcularAlertas } from "@/lib/antifurto-store";

export const Route = createFileRoute("/painel")({ component: PainelLayout });

const grupos = [
  { titulo: "Visão geral", itens: [{ label: "Início", icon: LayoutDashboard, to: "/painel" as const, exact: true }] },
  { titulo: "Cadastros", itens: [{ label: "Produtos", icon: Package, to: "/painel/produtos" as const }, { label: "Fornecedores", icon: Truck, to: "/painel/fornecedores" as const }] },
  { titulo: "Estoque", itens: [{ label: "Depósito", icon: Warehouse, to: "/painel/deposito" as const }, { label: "Gôndola", icon: Boxes, to: "/painel/gondola" as const }, { label: "Movimentações", icon: ArrowRightLeft, to: "/painel/movimentacoes" as const }, { label: "Validades", icon: CalendarClock, to: "/painel/validades" as const }, { label: "Etiquetas", icon: Tag, to: "/painel/etiquetas" as const }] },
  { titulo: "Operação", itens: [{ label: "PDV", icon: ScanBarcode, to: "/painel/pdv" as const }, { label: "Promoções", icon: Tag, to: "/painel/promocoes" as const }, { label: "Reposição", icon: RefreshCw, to: "/painel/reposicao" as const }, { label: "Recebimentos", icon: PackageOpen, to: "/painel/recebimentos" as const }, { label: "Inconsistências", icon: AlertTriangle, to: "/painel/inconsistencias" as const }, { label: "Pedidos de Compra", icon: ClipboardList, to: "/painel/pedidos" as const }, { label: "Devoluções", icon: ArrowLeftRight, to: "/painel/devolucoes" as const }, { label: "Antifurto", icon: ShieldAlert, to: "/painel/antifurto" as const }] },
  { titulo: "Gestão", itens: [{ label: "Alertas", icon: Bell, to: "/painel/alertas" as const }, { label: "Metas", icon: Target, to: "/painel/metas" as const }, { label: "Inventário", icon: ClipboardCheck, to: "/painel/inventario" as const }, { label: "Relatórios", icon: BarChart3, to: "/painel/relatorios" as const }, { label: "Rel. Vendas", icon: BarChart2, to: "/painel/relatorio-vendas" as const }, { label: "Equipe", icon: Users, to: "/painel/equipe" as const }, { label: "Auditoria", icon: Shield, to: "/painel/auditoria" as const }, { label: "Configurações", icon: Settings, to: "/painel/configuracoes" as const }] },
];

function PainelLayout() {
  const navigate = useNavigate();
  const auth = useAuth();
  const est = useEstoque();
  const op = useOperacao();
  const produtos = useProdutos();
  const config = useConfig();
  const equipe = useEquipe();
  const dono = equipe[0];
  const tema = useTema();
  const { pedidos } = usePedidos();

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) navigate({ to: "/" });
    else if (!auth.lojaId) navigate({ to: "/configurar-loja" });
    else if (auth.papel === "Repositor") navigate({ to: "/repositor" });
    else if (auth.papel === "Recebimento") navigate({ to: "/recebe" });
    else if (auth.papel === "Caixa") navigate({ to: "/painel/pdv" });
  }, [auth.loading, auth.session, auth.lojaId, auth.papel, navigate]);

  if (auth.loading || !auth.session) return null;

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
  const fecharNotif = () => setNotifOpen(false);

  const abaixoTodos = abaixoDoMinimo(est.gondola);
  const zerados = abaixoTodos.filter((p) => (est.gondola[p.id] ?? 0) === 0);
  const abaixo = abaixoTodos.filter((p) => (est.gondola[p.id] ?? 0) > 0);
  const vencendo7 = lotesVencendo(est.lotes, config.avisoVencimentoUrgente);
  const inconsAbertas = op.inconsistencias.filter((i) => i.status === "aberta");
  const pedidosAtencao = pedidos.filter((p) => {
    if (!["rascunho", "enviado"].includes(p.status)) return false;
    const dias = Math.floor((new Date(HOJE).getTime() - new Date(p.dataEmissao).getTime()) / 86_400_000);
    return dias >= config.diasAlertaPedido;
  });

  const alertasAntifurto = config.alertaAntifurto
    ? calcularAlertas(est.movs, produtos, config.limiteAntifurtoUnidades ?? 2)
    : [];

  const totalAlertas =
    (config.alertaEstoqueZerado ? zerados.length : 0) +
    (config.avisoRepositor ? abaixo.length : 0) +
    (config.alertaVencimentos ? vencendo7.length : 0) +
    (config.avisoInconsistencias ? inconsAbertas.length : 0) +
    (config.alertaPedidos ? pedidosAtencao.length : 0) +
    alertasAntifurto.filter((a) => a.severidade === "alto").length;

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

          {/* Tema */}
          <button
            className="ml-auto rounded-lg p-2 hover:bg-muted"
            aria-label={tema === "escuro" ? "Modo claro" : "Modo escuro"}
            onClick={alternarTema}
          >
            {tema === "escuro" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Notificações */}
          <div ref={notifRef} className="relative">
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
                <div className="fixed inset-0 z-40" onClick={fecharNotif} />
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-card shadow-xl">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <p className="text-sm font-semibold">Alertas ativos</p>
                    <button className="rounded p-0.5 hover:bg-muted" onClick={fecharNotif}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {totalAlertas === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum alerta no momento.
                    </div>
                  ) : (
                    <div className="max-h-[70vh] overflow-y-auto divide-y text-sm">
                      {config.alertaEstoqueZerado && zerados.length > 0 && (
                        <div className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">
                              🔴 {zerados.length} produto{zerados.length > 1 ? "s" : ""} zerado{zerados.length > 1 ? "s" : ""}
                            </p>
                            <Link to="/painel/gondola" className="text-[11px] text-primary hover:underline" onClick={fecharNotif}>Ver →</Link>
                          </div>
                          {zerados.slice(0, 4).map((p) => (
                            <div key={p.id} className="flex justify-between border-b py-1.5 last:border-0">
                              <span className="truncate font-medium">{p.nome}</span>
                              <span className="ml-2 shrink-0 text-destructive font-semibold">0/{p.minimo}</span>
                            </div>
                          ))}
                          {zerados.length > 4 && <p className="mt-1 text-xs text-muted-foreground">+{zerados.length - 4} outros</p>}
                        </div>
                      )}
                      {config.avisoRepositor && abaixo.length > 0 && (
                        <div className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-warning">
                              🟡 {abaixo.length} abaixo do mínimo
                            </p>
                            <Link to="/painel/reposicao" className="text-[11px] text-primary hover:underline" onClick={fecharNotif}>Ver →</Link>
                          </div>
                          {abaixo.slice(0, 3).map((p) => (
                            <div key={p.id} className="flex justify-between border-b py-1.5 last:border-0">
                              <span className="truncate">{p.nome}</span>
                              <span className="ml-2 shrink-0 text-muted-foreground">{est.gondola[p.id] ?? 0}/{p.minimo}</span>
                            </div>
                          ))}
                          {abaixo.length > 3 && <p className="mt-1 text-xs text-muted-foreground">+{abaixo.length - 3} outros</p>}
                        </div>
                      )}
                      {config.alertaVencimentos && vencendo7.length > 0 && (
                        <div className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">
                              🔴 {vencendo7.length} lote{vencendo7.length > 1 ? "s" : ""} vencendo
                            </p>
                            <Link to="/painel/validades" className="text-[11px] text-primary hover:underline" onClick={fecharNotif}>Ver →</Link>
                          </div>
                          {vencendo7.slice(0, 3).map((l) => (
                            <div key={l.id} className="flex justify-between border-b py-1.5 last:border-0">
                              <span className="truncate">{l.produto.nome}</span>
                              <span className="ml-2 shrink-0 text-muted-foreground">{l.faixa === "vencido" ? "Vencido" : `${l.dias}d`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {config.avisoInconsistencias && inconsAbertas.length > 0 && (
                        <div className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-warning">
                              🟠 {inconsAbertas.length} inconsistência{inconsAbertas.length > 1 ? "s" : ""} aberta{inconsAbertas.length > 1 ? "s" : ""}
                            </p>
                            <Link to="/painel/inconsistencias" className="text-[11px] text-primary hover:underline" onClick={fecharNotif}>Ver →</Link>
                          </div>
                          {inconsAbertas.slice(0, 3).map((i) => (
                            <div key={i.id} className="truncate border-b py-1.5 last:border-0">
                              {produtos.find((p) => p.id === i.produtoId)?.nome ?? "Produto"}
                            </div>
                          ))}
                        </div>
                      )}
                      {config.alertaPedidos && pedidosAtencao.length > 0 && (
                        <div className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-500">
                              🔵 {pedidosAtencao.length} pedido{pedidosAtencao.length > 1 ? "s" : ""} pendente{pedidosAtencao.length > 1 ? "s" : ""}
                            </p>
                            <Link to="/painel/pedidos" className="text-[11px] text-primary hover:underline" onClick={fecharNotif}>Ver →</Link>
                          </div>
                          {pedidosAtencao.slice(0, 3).map((p) => (
                            <div key={p.id} className="flex justify-between border-b py-1.5 last:border-0">
                              <span className="truncate font-medium">{p.numero}</span>
                              <span className="ml-2 shrink-0 text-muted-foreground capitalize">{p.fornecedorNome || "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {config.alertaAntifurto && alertasAntifurto.filter((a) => a.severidade === "alto").length > 0 && (
                    <div className="p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-rose-500">
                          🔴 {alertasAntifurto.filter((a) => a.severidade === "alto").length} alerta{alertasAntifurto.filter((a) => a.severidade === "alto").length > 1 ? "s" : ""} antifurto
                        </p>
                        <Link to="/painel/antifurto" className="text-[11px] text-primary hover:underline" onClick={fecharNotif}>Ver →</Link>
                      </div>
                      {alertasAntifurto.filter((a) => a.severidade === "alto").slice(0, 3).map((a) => (
                        <div key={a.produtoId} className="flex justify-between border-b py-1.5 last:border-0">
                          <span className="truncate font-medium">{a.produtoNome}</span>
                          <span className="ml-2 shrink-0 text-rose-500">−{a.perdaAcumulada} un.</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t px-4 py-2 flex items-center justify-between">
                    <Link to="/painel/alertas" className="text-xs font-medium text-primary hover:underline" onClick={fecharNotif}>
                      Ver central de alertas →
                    </Link>
                    <Link to="/painel/configuracoes" className="text-xs text-muted-foreground hover:text-foreground" onClick={fecharNotif}>
                      Configurar →
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Usuário */}
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground">
              {(auth.nomeProprietario ?? dono?.nome ?? "MS").split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
            <div className="text-sm leading-tight">
              <p className="font-semibold">{auth.nomeProprietario ?? dono?.nome ?? "Usuário"}</p>
              <p className="text-xs text-muted-foreground">{auth.papel ?? dono?.papel ?? "Proprietário"}</p>
            </div>
            <button
              className="ml-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Sair"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
