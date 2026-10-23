import { useSyncExternalStore } from "react";
import { produtos as seed, type Produto } from "./mock-data";

let estado: Produto[] = [...seed];
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

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
