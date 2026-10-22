import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/painel/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — OmniSafe 360" },
      { name: "description", content: "Pessoas da loja e o que cada uma pode fazer." },
      { property: "og:title", content: "Equipe — OmniSafe 360" },
      { property: "og:description", content: "Gestão da equipe da loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Equipe,
});

const papeis = {
  Proprietário: "Acesso a tudo",
  Gerente: "Tudo, menos configurações da loja",
  Caixa: "Somente o PDV",
  Repositor: "App do repositor e gôndola",
  Recebimento: "App de recebimento (conferência cega)",
} as const;
type Papel = keyof typeof papeis;

function Equipe() {
  const [membros, setMembros] = useState<{ nome: string; email: string; papel: Papel; ativo: boolean }[]>([
    { nome: "Maria Souza", email: "maria@bompreco.com.br", papel: "Proprietário", ativo: true },
    { nome: "Rafael Lima", email: "rafael@bompreco.com.br", papel: "Caixa", ativo: true },
    { nome: "Luana Alves", email: "luana@bompreco.com.br", papel: "Caixa", ativo: true },
    { nome: "Pedro Rocha", email: "pedro@bompreco.com.br", papel: "Repositor", ativo: true },
    { nome: "João Mendes", email: "joao@bompreco.com.br", papel: "Recebimento", ativo: false },
  ]);
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState({ nome: "", email: "", papel: "Caixa" as Papel });

  const convidar = () => {
    if (!novo.nome || !novo.email.includes("@")) { toast.error("Preencha nome e e-mail."); return; }
    setMembros((m) => [...m, { ...novo, ativo: true }]);
    setAberto(false);
    setNovo({ nome: "", email: "", papel: "Caixa" });
    toast.success(`Convite enviado para ${novo.email}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground">Quem trabalha na loja e o que cada um pode acessar.</p>
        </div>
        <Button onClick={() => setAberto(true)}><UserPlus className="h-4 w-4" /> Convidar pessoa</Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-4">Pessoa</th><th className="p-4">Função</th><th className="p-4">Pode acessar</th><th className="p-4">Situação</th></tr>
          </thead>
          <tbody>
            {membros.map((m, i) => (
              <tr key={m.email} className="border-t">
                <td className="p-4"><p className="font-semibold">{m.nome}</p><p className="text-xs text-muted-foreground">{m.email}</p></td>
                <td className="p-4">
                  <select className="rounded-md border bg-background px-2 py-1" value={m.papel} disabled={m.papel === "Proprietário" && i === 0}
                    onChange={(e) => setMembros((ms) => ms.map((x, j) => (j === i ? { ...x, papel: e.target.value as Papel } : x)))}>
                    {Object.keys(papeis).map((p) => <option key={p}>{p}</option>)}
                  </select>
                </td>
                <td className="p-4 text-muted-foreground">{papeis[m.papel]}</td>
                <td className="p-4">
                  <button disabled={i === 0} onClick={() => setMembros((ms) => ms.map((x, j) => (j === i ? { ...x, ativo: !x.ativo } : x)))}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {m.ativo ? "Ativo" : "Bloqueado"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar pessoa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <Input placeholder="E-mail" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            <div className="grid gap-2">
              {(Object.keys(papeis) as Papel[]).filter((p) => p !== "Proprietário").map((p) => (
                <button key={p} onClick={() => setNovo({ ...novo, papel: p })}
                  className={`rounded-lg border p-3 text-left text-sm ${novo.papel === p ? "border-primary bg-secondary" : ""}`}>
                  <span className="font-semibold">{p}</span> <span className="text-muted-foreground">· {papeis[p]}</span>
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={convidar}>Enviar convite</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
