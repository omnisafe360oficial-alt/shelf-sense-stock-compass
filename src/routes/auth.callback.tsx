import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Autenticando — OmniSafe 360" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const auth = useAuth();
  const attempted = useRef(false);

  // Handle ?error= params Google sends when the user cancels or OAuth fails.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      sessionStorage.removeItem("oauth_pending");
      const desc = params.get("error_description");
      toast.error(desc ? decodeURIComponent(desc.replace(/\+/g, " ")) : "Falha ao autenticar com Google");
      navigate({ to: "/", replace: true });
    }
  }, [navigate]);

  // Troca explícita do code PKCE — garante que funciona mesmo
  // se detectSessionInUrl não processou antes do componente montar.
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error && error.message !== "code already used") {
        sessionStorage.removeItem("oauth_pending");
        toast.error("Falha ao autenticar: " + error.message);
        navigate({ to: "/", replace: true });
      }
    });
  }, [navigate]);

  // Redireciona assim que o estado de auth estiver resolvido.
  useEffect(() => {
    if (auth.loading) return;
    if (auth.session) {
      navigate({
        to: auth.lojaId ? "/painel" : "/configurar-loja",
        replace: true,
      });
    } else {
      // Só redireciona para login se não há código em processamento
      const hasCode = new URLSearchParams(window.location.search).has("code");
      if (!hasCode) {
        sessionStorage.removeItem("oauth_pending");
        navigate({ to: "/", replace: true });
      }
    }
  }, [auth.loading, auth.session, auth.lojaId, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <Logo />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Verificando sua conta…</p>
      </div>
    </div>
  );
}
