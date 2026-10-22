import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowRightLeft, BarChart3, Bell, Boxes, CalendarClock, LayoutDashboard,
  Package, PackageOpen, RefreshCw, ScanBarcode, Search, Settings, Truck, Users, Warehouse,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/painel")({ component: PainelLayout });

const grupos = [
  { titulo: "Visão geral", itens: [{ label: "Início", icon: LayoutDashboard, to: "/painel" as const, exact: true }] },
  { titulo: "Cadastros", itens: [{ label: "Produtos", icon: Package, to: "/painel/produtos" as const }, { label: "Fornecedores", icon: Truck, to: "/painel/fornecedores" as const }] },
  { titulo: "Estoque", itens: [{ label: "Depósito", icon: Warehouse, to: "/painel/deposito" as const }, { label: "Gôndola", icon: Boxes, to: "/painel/gondola" as const }, { label: "Movimentações", icon: ArrowRightLeft, to: "/painel/movimentacoes" as const }, { label: "Validades", icon: CalendarClock, to: "/painel/validades" as const }] },
  { titulo: "Operação", itens: [{ label: "PDV", icon: ScanBarcode }, { label: "Reposição", icon: RefreshCw }, { label: "Recebimentos", icon: PackageOpen }, { label: "Inconsistências", icon: AlertTriangle }] },
  { titulo: "Gestão", itens: [{ label: "Relatórios", icon: BarChart3 }, { label: "Equipe", icon: Users }, { label: "Configurações", icon: Settings }] },
];

function PainelLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-6"><Logo light /></div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">{g.titulo}</p>
              {g.itens.map((i) => {
                const Icon = i.icon;
                const base = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";
                return "to" in i && i.to ? (
                  <Link key={i.label} to={i.to} activeOptions={{ exact: "exact" in i && !!i.exact }} className={base} activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
                    <Icon className="h-4 w-4 text-sidebar-primary" /> {i.label}
                  </Link>
                ) : (
                  <span key={i.label} className={`${base} cursor-default text-sidebar-foreground/55`} title="Em breve">
                    <Icon className="h-4 w-4" /> {i.label}
                    <span className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 text-[9px] uppercase">breve</span>
                  </span>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <p className="font-semibold text-sidebar-accent-foreground">Mercado Bom Preço</p>
          <p className="text-xs text-sidebar-foreground/55">Campinas · SP</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card/90 px-8 backdrop-blur">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar produto, código de barras ou lote…" className="h-10 pl-9" />
          </div>
          <button className="relative ml-auto rounded-lg p-2 hover:bg-muted" aria-label="Notificações">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          </button>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground">MS</span>
            <div className="text-sm leading-tight"><p className="font-semibold">Maria Souza</p><p className="text-xs text-muted-foreground">Proprietária</p></div>
          </div>
        </header>
        <main className="flex-1 p-8"><Outlet /></main>
      </div>
    </div>
  );
}


