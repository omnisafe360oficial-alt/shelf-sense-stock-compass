import { useSyncExternalStore } from "react";
import { fornecedores as seed, type Fornecedor } from "./mock-data";
import { carregar, salvar, CHAVE } from "./persist";

let estado: Fornecedor[] = carregar(CHAVE.fornecedores, [...seed]);
const ouvintes = new Set<() => void>();
const notificar = () => { salvar(CHAVE.fornecedores, estado); ouvintes.forEach((fn) => fn()); };

export function useFornecedores(): Fornecedor[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function getFornecedores(): Fornecedor[] { return estado; }

export function cadastrarFornecedor(dados: Omit<Fornecedor, "id">): string {
  const id = `f${Date.now()}`;
  estado = [...estado, { ...dados, id }];
  notificar();
  return id;
}

export function editarFornecedor(id: string, dados: Partial<Omit<Fornecedor, "id">>): void {
  estado = estado.map((f) => (f.id === id ? { ...f, ...dados } : f));
  notificar();
}
