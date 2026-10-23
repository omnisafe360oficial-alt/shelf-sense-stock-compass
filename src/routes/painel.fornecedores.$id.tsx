import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, Mail, MapPin, Phone, User } from "lucide-react";
import { brl, situacao } from "@/lib/mock-data";
import { getFornecedores } from "@/lib/fornecedores-store";
import { getProdutos } from "@/lib/produtos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/fornecedores/$id")({
  loader: ({ params }) => {
    const f = getFornecedores().find((x) => x.id === params.id);
    if (!f) throw notFound();
    return f;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.nome ?? "Fornecedor"} — OmniSafe 360` },
      { name: "description", content: "Ficha do fornecedor com contatos e produtos fornecidos." },
      { property: "og:title", content: `${loaderData?.nome ?? "Fornecedor"} — OmniSafe 360` },
      { property: "og:description", content: "Ficha do fornecedor no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  notFoundComponent: () => <p className="text-muted-foreground">Fornecedor não encontrado.</p>,
  component: Ficha,
});

function Ficha() {
  const f = Route.useLoaderData();
  const itens = getProdutos().filter((p) => p.fornecedor === f.nome);
  const info = [
    { icon: User, l: "Contato", v: f.contato },
    { icon: Phone, l: "Telefone", v: f.telefone },
    { icon: Mail, l: "E-mail", v: f.email },
    { icon: MapPin, l: "Cidade", v: f.cidade },
    { icon: Clock, l: "Prazo de pagamento", v: f.prazo },
  ];
  return (
    <div className="space-y-6">
      <Link to="/painel/fornecedores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Fornecedores</Link>
      <div className="flex items-center gap-5 rounded-2xl bg-gradient-brand p-8 text-primary-foreground">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15 font-display text-2xl font-bold">{f.nome[0]}</span>
        <div>
          <h1 className="text-3xl font-bold">{f.nome}</h1>
          <p className="font-mono text-sm text-primary-foreground/75">CNPJ {f.cnpj}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-4 rounded-2xl border bg-card p-6">
          {info.map(({ icon: Icon, l, v }) => (
            <div key={l} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 text-primary" />
              <div><p className="text-xs uppercase text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-card">
          <h2 className="border-b p-5 text-lg font-semibold">Produtos fornecidos ({itens.length})</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {itens.map((p) => {
                const s = situacao(p);
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3"><p className="font-semibold">{p.nome}</p><p className="font-mono text-xs text-muted-foreground">{p.codigo}</p></td>
                    <td className="px-5 py-3 text-right">{brl(p.preco)}</td>
                    <td className="px-5 py-3 text-right">{p.deposito + p.gondola} un</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", s === "ok" ? "bg-success/12 text-success" : s === "baixo" ? "bg-warning/15 text-warning" : "bg-destructive/10 text-destructive")}>
                        {s === "ok" ? "Estoque ok" : s === "baixo" ? "Repor gôndola" : "Sem estoque"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
