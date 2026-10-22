import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { produtos } from "@/lib/mock-data";
import { executarTransferencia, lotesFefo, useEstoque } from "@/lib/estoque-store";

export function TransferirDialog({ produtoId, onClose }: { produtoId: string; onClose: () => void }) {
  const s = useEstoque();
  const p = produtos.find((x) => x.id === produtoId)!;
  const lotes = lotesFefo(s, produtoId);
  const disp = lotes.reduce((t, l) => t + l.qtd, 0);
  const atual = s.gondola[produtoId] ?? 0;
  const [qtd, setQtd] = useState(String(Math.max(0, Math.min(disp, p.minimo * 2 - atual))));
  const n = Number(qtd) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-card p-8 shadow-elegant">
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-semibold uppercase text-primary">Depósito → Gôndola</p><h2 className="text-xl font-bold">{p.nome}</h2></div>
          <button onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-6 grid grid-cols-3 items-center gap-2 text-center">
          <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Depósito</p><p className="font-display text-xl font-bold">{disp - n}</p></div>
          <ArrowRight className="mx-auto text-primary" />
          <div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Gôndola</p><p className="font-display text-xl font-bold">{atual + n}</p></div>
        </div>
        <label className="mt-6 block text-sm font-medium">Quantidade a levar</label>
        <Input autoFocus inputMode="numeric" className="mt-2 h-12 text-lg" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} />
        <p className="mt-2 text-xs text-muted-foreground">Sai primeiro o lote que vence antes: {lotes.map((l) => `${l.lote} (${l.qtd})`).join(", ") || "nenhum lote"}</p>
        <Button
          className="mt-6 h-11 w-full"
          disabled={n <= 0 || n > disp}
          onClick={() => {
            try {
              const m = executarTransferencia(produtoId, n);
              toast.success(`${n} un levadas para a gôndola`, { description: m.map((x) => `Lote ${x.lote}: ${x.qtd}`).join(" · ") });
              onClose();
            } catch (e) { toast.error((e as Error).message); }
          }}
        >
          Confirmar transferência
        </Button>
      </div>
    </div>
  );
}
