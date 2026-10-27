import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — OmniSafe 360" },
      { name: "description", content: "Acesse o painel OmniSafe 360 e controle o estoque do seu comércio." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.loading) return;
    if (auth.session) {
      navigate({ to: auth.lojaId ? "/painel" : "/configurar-loja" });
    }
  }, [auth.loading, auth.session, auth.lojaId, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/configurar-loja` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <AuthShell>
      <h2 className="text-3xl font-bold">Bem-vindo de volta</h2>
      <p className="mt-2 text-muted-foreground">Entre para acessar o painel da sua loja.</p>
      <div className="mt-8">
        <GoogleButton label="Entrar com Google" onClick={handleGoogle} />
      </div>
      <Divider />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required placeholder="voce@sualoja.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="password">Senha</Label>
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={async () => {
                if (!email) { toast.error("Informe o e-mail primeiro"); return; }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/`,
                });
                if (error) toast.error(error.message);
                else toast.success("E-mail de recuperação enviado!");
              }}
            >
              Esqueci a senha
            </button>
          </div>
          <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-semibold text-primary hover:underline">Criar conta grátis</Link>
      </p>
    </AuthShell>
  );
}
