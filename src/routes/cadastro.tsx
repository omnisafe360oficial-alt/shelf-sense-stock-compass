import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/AuthShell";

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
  const go = () => navigate({ to: "/configurar-loja" });
  return (
    <AuthShell>
      <h2 className="text-3xl font-bold">Crie sua conta</h2>
      <p className="mt-2 text-muted-foreground">Leva menos de um minuto. Depois é só configurar a loja.</p>
      <div className="mt-8">
        <GoogleButton label="Cadastrar com Google" onClick={go} />
      </div>
      <Divider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div className="space-y-2">
          <Label htmlFor="nome">Seu nome</Label>
          <Input id="nome" required placeholder="Maria Souza" className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required placeholder="voce@sualoja.com.br" className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" required minLength={6} placeholder="Mínimo de 6 caracteres" className="h-11" />
        </div>
        <Button type="submit" className="h-11 w-full text-base font-semibold">Criar conta</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem conta? <Link to="/" className="font-semibold text-primary hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
