import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ClipboardList, Clock, Home, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recebe")({ component: RecebeLayout });

const ABAS = [
  { to: "/recebe" as const, label: "Início", icon: Home, exact: true },
  { to: "/recebe/receber" as const, label: "Receber", icon: PackageOpen },
  { to: "/recebe/pedidos" as const, label: "Pedidos", icon: ClipboardList },
  { to: "/recebe/historico" as const, label: "Histórico", icon: Clock },
] as const;

function RecebeLayout() {
  const location = useLocation();

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header fixo */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            <PackageOpen className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="font-display text-sm font-semibold text-foreground">OmniSafe</span>
            <span className="font-display text-sm font-semibold text-primary"> Recebe</span>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">
          CM
        </div>
      </header>

      {/* Conteúdo rolável */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t border-border bg-card">
        <div className="flex h-16 items-stretch">
          {ABAS.map((aba) => {
            const ativo = aba.exact
              ? location.pathname === aba.to
              : location.pathname.startsWith(aba.to);
            const Icon = aba.icon;
            return (
              <Link
                key={aba.to}
                to={aba.to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 transition-colors active:scale-95",
                  ativo ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{aba.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
