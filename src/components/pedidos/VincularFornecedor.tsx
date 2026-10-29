import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cadastrarFornecedor, useFornecedores } from "@/lib/fornecedores-store";
import { editarProduto } from "@/lib/produtos-store";

const NOVO = "__novo__";

/** Liga um ou vários produtos a um fornecedor, ou cadastra um fornecedor novo na hora. */
export function VincularFornecedor({ produtoIds, rotulo = "Escolher fornecedor" }: { produtoIds: string[]; rotulo?: string }) {
  const fornecedores = useFornecedores();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [salvando, setSalvando] = useState(false);

  function vincular(id: string, nomeForn: string) {
    for (const pid of produtoIds) editarProduto(pid, { fornecedorId: id, fornecedor: nomeForn });
    toast.success(
      produtoIds.length === 1 ? `Produto ligado a ${nomeForn}.` : `${produtoIds.length} produtos ligados a ${nomeForn}.`,
    );
  }

  async function salvarNovo() {
    const n = nome.trim();
    if (n.length < 2) { toast.error("Digite o nome do fornecedor."); return; }
    setSalvando(true);
    try {
      const id = await cadastrarFornecedor({
        nome: n, cnpj: "", contato: "", telefone: "", email: "", cidade: "", prazo: "", whatsapp: whats.trim(),
      });
      vincular(id, n);
      setAberto(false); setNome(""); setWhats("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o fornecedor.", { duration: 15000 });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <select
        aria-label={rotulo}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v === NOVO) { setAberto(true); return; }
          const f = fornecedores.find((x) => x.id === v);
          if (f) vincular(f.id, f.nome);
        }}
        className="h-8 max-w-48 rounded-md border bg-background px-2 text-xs"
      >
        <option value="">{rotulo}</option>
        {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        <option value={NOVO}>+ Cadastrar novo fornecedor</option>
      </select>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome do fornecedor</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Distribuidora Paraná" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">WhatsApp (para enviar os pedidos)</label>
              <Input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" />
            </div>
            <p className="text-xs text-muted-foreground">O resto dos dados você completa depois em Fornecedores.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={salvando}>
              <Plus className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar e ligar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
