import { useSyncExternalStore } from "react";
import { getLojaId, onLojaChange } from "./loja-resolver";

export type Metas = {
  metaDiaria: number;
  metaMensal: number;
};

const PADRAO: Metas = { metaDiaria: 0, metaMensal: 0 };
let estado: Metas = { ...PADRAO };
const ouvintes = new Set<() => void>();
const emitir = (n: Metas) => { estado = n; ouvintes.forEach((o) => o()); };

function chave(lojaId: string) { return `omni-metas-${lojaId}`; }

function carregar() {
  const lojaId = getLojaId();
  if (!lojaId) { emitir({ ...PADRAO }); return; }
  try {
    const raw = localStorage.getItem(chave(lojaId));
    emitir(raw ? { ...PADRAO, ...(JSON.parse(raw) as Partial<Metas>) } : { ...PADRAO });
  } catch { emitir({ ...PADRAO }); }
}

function persistir() {
  const lojaId = getLojaId();
  if (!lojaId) return;
  try { localStorage.setItem(chave(lojaId), JSON.stringify(estado)); } catch {}
}

onLojaChange(() => carregar());
carregar();

export function useMetas(): Metas {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function salvarMetas(parcial: Partial<Metas>): void {
  emitir({ ...estado, ...parcial });
  persistir();
}
