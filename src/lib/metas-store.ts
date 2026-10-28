import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { getLojaId, onLojaChange } from "./loja-resolver";

export type Metas = {
  metaDiaria: number;
  metaMensal: number;
};

const PADRAO: Metas = { metaDiaria: 0, metaMensal: 0 };
let estado: Metas = { ...PADRAO };
const ouvintes = new Set<() => void>();
const emitir = (n: Metas) => { estado = n; ouvintes.forEach((o) => o()); };

async function carregar(lojaId: string) {
  const { data } = await supabase
    .from("metas")
    .select("meta_diaria, meta_mensal")
    .eq("loja_id", lojaId)
    .single();
  emitir(data
    ? { metaDiaria: Number(data.meta_diaria), metaMensal: Number(data.meta_mensal) }
    : { ...PADRAO });
}

onLojaChange(async (lojaId) => {
  if (!lojaId) { emitir({ ...PADRAO }); return; }
  await carregar(lojaId);
});

export function useMetas(): Metas {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function salvarMetas(parcial: Partial<Metas>): void {
  emitir({ ...estado, ...parcial });
  const lojaId = getLojaId();
  if (!lojaId) return;
  supabase
    .from("metas")
    .upsert(
      { loja_id: lojaId, meta_diaria: estado.metaDiaria, meta_mensal: estado.metaMensal, updated_at: new Date().toISOString() },
      { onConflict: "loja_id" },
    )
    .then(({ error }) => { if (error) toast.error("Erro ao salvar metas: " + error.message); });
}
