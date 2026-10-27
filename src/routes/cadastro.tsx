import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — OmniSafe 360" },
      { name: "description", content: "Crie sua conta OmniSafe 360 em menos de um minuto." },
      { property: "og:title", content: "Criar conta — OmniSafe 360" },
      { property: "og:description", content: "Crie sua conta OmniSafe 360 em menos de um minuto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cadastro,
});

function Cadastro() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada! Verifique seu e-mail se necessário.");
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <AuthShell>
      <h2 className="text-3xl font-bold">Crie sua conta</h2>
      <p className="mt-2 text-muted-foreground">Leva menos de um minuto. Depois é só configurar a loja.</p>
      <div className="mt-8">
        <GoogleButton label="Cadastrar com Google" onClick={handleGoogle} />
      </div>
      <Divider />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="nome">Seu nome</Label>
          <Input id="nome" required placeholder="Maria Souza" className="h-11" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required placeholder="voce@sualoja.com.br" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" required minLength={6} placeholder="Mínimo de 6 caracteres" className="h-11" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={loading}>
          {loading ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/" className="font-semibold text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
