import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClipboardList, Clock, Home, PackageOpen, ShieldOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recebe")({ component: RecebeLayout });

const ABAS = [
  { to: "/recebe" as const, label: "Início", icon: Home, exact: true },
  { to: "/recebe/receber" as const, label: "Receber", icon: PackageOpen },
  { to: "/recebe/pedidos" as const, label: "Pedidos", icon: ClipboardList },
  { to: "/recebe/historico" as const, label: "Histórico", icon: Clock },
] as const;

const PAPEIS_PERMITIDOS = ["Recebimento", "Gerente", "Proprietário"];

function iniciais(nome: string | null) {
  if (!nome) return "CM";
  return nome.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

function RecebeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) navigate({ to: "/" });
    else if (!auth.lojaId) navigate({ to: "/configurar-loja" });
  }, [auth.loading, auth.session, auth.lojaId, navigate]);

  if (auth.loading || !auth.session) return null;

  if (auth.papel && !PAPEIS_PERMITIDOS.includes(auth.papel)) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldOff className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-foreground">Acesso restrito</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O seu perfil <strong>{auth.papel}</strong> não tem acesso ao app Recebimento.
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/painel" })}
          className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground"
        >
          Ir ao painel
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
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
          {iniciais(auth.nomeProprietario)}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="shrink-0 border-t border-border bg-card">
        <div className="flex h-16 items-stretch">
          {ABAS.map((aba) => {
            const ativo = "exact" in aba && aba.exact
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
