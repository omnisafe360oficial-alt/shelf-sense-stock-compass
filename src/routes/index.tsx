import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — OmniSafe 360" },
      { name: "description", content: "Acesse o painel OmniSafe 360 e controle o estoque do seu comércio." },
      { property: "og:title", content: "Entrar — OmniSafe 360" },
      { property: "og:description", content: "Acesse o painel OmniSafe 360 e controle o estoque do seu comércio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const go = () => navigate({ to: "/configurar-loja" });

  return (
    <AuthShell>
      <h2 className="text-3xl font-bold">Bem-vindo de volta</h2>
      <p className="mt-2 text-muted-foreground">Entre para acessar o painel da sua loja.</p>
      <div className="mt-8">
        <GoogleButton label="Entrar com Google" onClick={go} />
      </div>
      <Divider />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required placeholder="voce@sualoja.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="password">Senha</Label>
            <button type="button" className="text-sm font-medium text-primary hover:underline">Esqueci a senha</button>
          </div>
          <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" className="h-11 w-full text-base font-semibold">Entrar</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-semibold text-primary hover:underline">Criar conta grátis</Link>
      </p>
    </AuthShell>
  );
}
