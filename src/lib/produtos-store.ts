import { useSyncExternalStore } from "react";
import { produtos as seed, type Produto } from "./mock-data";
import { carregar, salvar, CHAVE } from "./persist";

let estado: Produto[] = carregar(CHAVE.produtos, [...seed]);
const ouvintes = new Set<() => void>();
const notificar = () => { salvar(CHAVE.produtos, estado); ouvintes.forEach((fn) => fn()); };

export function useProdutos(): Produto[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function getProdutos(): Produto[] { return estado; }

export function cadastrarProduto(dados: Omit<Produto, "id">): string {
  const id = `p${Date.now()}`;
  estado = [...estado, { ...dados, id }];
  notificar();
  return id;
}

export function editarProduto(id: string, dados: Partial<Omit<Produto, "id">>): void {
  estado = estado.map((p) => (p.id === id ? { ...p, ...dados } : p));
  notificar();
}
