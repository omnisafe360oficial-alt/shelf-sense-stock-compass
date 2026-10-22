import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, MapPin, Phone, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fornecedores, produtos } from "@/lib/mock-data";

export const Route = createFileRoute("/painel/fornecedores/")({
  head: () => ({
    meta: [
      { title: "Fornecedores — OmniSafe 360" },
      { name: "description", content: "Todos os fornecedores da loja, com contatos e produtos fornecidos." },
      { property: "og:title", content: "Fornecedores — OmniSafe 360" },
      { property: "og:description", content: "Todos os fornecedores da loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Fornecedores,
});

function Fornecedores() {
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const lista = fornecedores.filter((f) => f.nome.toLowerCase().includes(q.toLowerCase()) || f.cnpj.includes(q));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">{fornecedores.length} fornecedores cadastrados</p>
        </div>
        <Button size="lg" onClick={() => setNovo(true)}><Plus /> Novo fornecedor</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CNPJ" className="h-11 pl-9" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((f) => {
          const itens = produtos.filter((p) => p.fornecedor === f.nome);
          return (
            <Link key={f.id} to="/painel/fornecedores/$id" params={{ id: f.id }} className="group rounded-2xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elegant">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand font-display text-lg font-bold text-primary-foreground">{f.nome[0]}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold group-hover:text-primary">{f.nome}</p>
                  <p className="font-mono text-xs text-muted-foreground">{f.cnpj}</p>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{f.telefone}</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{f.email}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{f.cidade}</p>
              </div>
              <div className="mt-5 flex justify-between border-t pt-4 text-sm">
                <span><strong>{itens.length}</strong> produtos</span>
                <span className="text-muted-foreground">Prazo {f.prazo}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {novo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setNovo(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); setNovo(false); toast.success("Fornecedor cadastrado!"); }}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-8 shadow-elegant"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Novo fornecedor</h2>
              <button type="button" onClick={() => setNovo(false)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2"><Label>Nome / razão social</Label><Input required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>CNPJ</Label><Input required /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input /></div>
            </div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cidade</Label><Input /></div>
              <div className="space-y-2"><Label>Prazo de pagamento</Label><Input placeholder="28 dias" /></div>
            </div>
            <Button type="submit" className="h-11 w-full">Salvar fornecedor</Button>
          </form>
        </div>
      )}
    </div>
  );
}
