import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, Edit3, Mail, MapPin, Phone, Save, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/mock-data";
import { useFornecedores, getFornecedores, editarFornecedor, excluirFornecedor } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import { useEstoque } from "@/lib/estoque-store";
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

type FForm = { nome: string; cnpj: string; contato: string; telefone: string; email: string; cidade: string; prazo: string };

function Ficha() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const todos = useFornecedores();
  const f = todos.find((x) => x.id === id);

  const produtos = useProdutos();
  const est = useEstoque();

  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [form, setForm] = useState<FForm>({ nome: "", cnpj: "", contato: "", telefone: "", email: "", cidade: "", prazo: "" });

  if (!f) return <p className="text-muted-foreground">Fornecedor não encontrado.</p>;

  const itens = produtos.filter((p) => p.fornecedor === f.nome);

  const abrirEdicao = () => {
    setForm({ nome: f.nome, cnpj: f.cnpj, contato: f.contato, telefone: f.telefone, email: f.email, cidade: f.cidade, prazo: f.prazo });
    setEditando(true);
  };

  const cancelar = () => { setEditando(false); setConfirmando(false); };

  const salvar = () => {
    if (!form.nome.trim()) { toast.error("Nome não pode ser vazio."); return; }
    editarFornecedor(f.id, { ...form, nome: form.nome.trim() });
    setEditando(false);
    toast.success("Fornecedor atualizado!");
  };

  const confirmarExclusao = () => {
    excluirFornecedor(f.id);
    toast.success(`"${f.nome}" excluído.`);
    navigate({ to: "/painel/fornecedores" });
  };

  const info = [
    { icon: User, l: "Contato", v: f.contato },
    { icon: Phone, l: "Telefone", v: f.telefone },
    { icon: Mail, l: "E-mail", v: f.email },
    { icon: MapPin, l: "Cidade", v: f.cidade },
    { icon: Clock, l: "Prazo de pagamento", v: f.prazo },
  ];

  return (
    <div className="space-y-6">
      <Link to="/painel/fornecedores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Fornecedores
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-brand p-8 text-primary-foreground">
        <div className="flex items-center gap-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15 font-display text-2xl font-bold">{f.nome[0]}</span>
          <div>
            <h1 className="text-3xl font-bold">{f.nome}</h1>
            <p className="font-mono text-sm text-primary-foreground/75">CNPJ {f.cnpj}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editando ? (
            <>
              <Button variant="secondary" onClick={abrirEdicao}><Edit3 className="h-4 w-4" /> Editar</Button>
              <Button variant="destructive" size="icon" onClick={() => setConfirmando(true)} title="Excluir fornecedor"><Trash2 className="h-4 w-4" /></Button>
            </>
          ) : (
            <Button variant="secondary" onClick={cancelar}><X className="h-4 w-4" /> Cancelar</Button>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="font-semibold text-destructive">Excluir "{f.nome}"?</p>
          <p className="mt-1 text-sm text-muted-foreground">Esta ação não pode ser desfeita. O fornecedor será removido permanentemente.</p>
          <div className="mt-4 flex gap-3">
            <Button variant="destructive" onClick={confirmarExclusao}><Trash2 className="h-4 w-4" /> Confirmar exclusão</Button>
            <Button variant="ghost" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {editando && (
        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Editar fornecedor</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Prazo de pagamento</Label>
              <Input value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} placeholder="Ex.: 30 dias" />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="ghost" onClick={cancelar}>Cancelar</Button>
            <Button onClick={salvar}><Save className="h-4 w-4" /> Salvar alterações</Button>
          </div>
        </div>
      )}

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
                const dep = est.lotes.filter((l) => l.produtoId === p.id && l.qtd > 0).reduce((t, l) => t + l.qtd, 0);
                const gond = est.gondola[p.id] ?? 0;
                const total = dep + gond;
                const sit: "ok" | "baixo" | "sem" = total === 0 ? "sem" : gond <= p.minimo ? "baixo" : "ok";
                const labels = { ok: "Estoque ok", baixo: "Repor gôndola", sem: "Sem estoque" };
                const cores = { ok: "bg-success/12 text-success", baixo: "bg-warning/15 text-warning", sem: "bg-destructive/10 text-destructive" };
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <Link to="/painel/produtos/$id" params={{ id: p.id }} className="group">
                        <p className="font-semibold group-hover:text-primary">{p.nome}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.codigo}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right">{brl(p.preco)}</td>
                    <td className="px-5 py-3 text-right">{total} un</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", cores[sit])}>
                        {labels[sit]}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {itens.length === 0 && (
                <tr><td colSpan={4} className="p-5 text-center text-muted-foreground">Nenhum produto vinculado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
