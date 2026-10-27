import { useSyncExternalStore } from "react";
import { getLojaId, onLojaChange } from "./loja-resolver";

export type TipoDesconto = "pct" | "fixo";

export type Promocao = {
  id: string;
  nome: string;
  descricao: string;
  tipo: TipoDesconto;
  valor: number;
  dataInicio: string;
  dataFim: string;
  todos: boolean;
  produtoIds: string[];
};

type Estado = { promocoes: Promocao[] };

const VAZIO: Estado = { promocoes: [] };
let estado: Estado = { ...VAZIO };
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => { estado = n; ouvintes.forEach((o) => o()); };

function chave(lojaId: string) { return `omni-promocoes-${lojaId}`; }

function carregar() {
  const lojaId = getLojaId();
  if (!lojaId) { emitir({ ...VAZIO }); return; }
  try {
    const raw = localStorage.getItem(chave(lojaId));
    emitir(raw ? (JSON.parse(raw) as Estado) : { ...VAZIO });
  } catch { emitir({ ...VAZIO }); }
}

function persistir() {
  const lojaId = getLojaId();
  if (!lojaId) return;
  try { localStorage.setItem(chave(lojaId), JSON.stringify(estado)); } catch {}
}

onLojaChange(() => carregar());
carregar();

export function usePromocoes() {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function addPromocao(p: Omit<Promocao, "id">): void {
  const nova: Promocao = { ...p, id: crypto.randomUUID() };
  emitir({ ...estado, promocoes: [...estado.promocoes, nova] });
  persistir();
}

export function updatePromocao(parcial: Partial<Promocao> & { id: string }): void {
  emitir({
    ...estado,
    promocoes: estado.promocoes.map((p) => p.id === parcial.id ? { ...p, ...parcial } : p),
  });
  persistir();
}

export function removePromocao(id: string): void {
  emitir({ ...estado, promocoes: estado.promocoes.filter((p) => p.id !== id) });
  persistir();
}

export function getPromocoes(): Promocao[] { return estado.promocoes; }

export function promocaoAtivaParaProduto(
  promocoes: Promocao[],
  produtoId: string,
  hoje: string,
): Promocao | null {
  return (
    promocoes.find(
      (p) =>
        p.dataInicio <= hoje &&
        p.dataFim >= hoje &&
        (p.todos || p.produtoIds.includes(produtoId)),
    ) ?? null
  );
}
