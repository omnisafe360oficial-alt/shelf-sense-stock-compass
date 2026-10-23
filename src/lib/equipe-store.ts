import { useSyncExternalStore } from "react";
import { carregar, salvar, CHAVE } from "./persist";

export const PAPEIS = {
  Proprietário: "Acesso a tudo",
  Gerente: "Tudo, menos configurações da loja",
  Caixa: "Somente o PDV",
  Repositor: "App do repositor e gôndola",
  Recebimento: "App de recebimento (conferência cega)",
} as const;
export type Papel = keyof typeof PAPEIS;

export type Membro = { id: string; nome: string; email: string; papel: Papel; ativo: boolean };

const SEED: Membro[] = [
  { id: "eq1", nome: "Maria Souza", email: "maria@bompreco.com.br", papel: "Proprietário", ativo: true },
  { id: "eq2", nome: "Rafael Lima", email: "rafael@bompreco.com.br", papel: "Caixa", ativo: true },
  { id: "eq3", nome: "Luana Alves", email: "luana@bompreco.com.br", papel: "Caixa", ativo: true },
  { id: "eq4", nome: "Pedro Rocha", email: "pedro@bompreco.com.br", papel: "Repositor", ativo: true },
  { id: "eq5", nome: "João Mendes", email: "joao@bompreco.com.br", papel: "Recebimento", ativo: false },
];

let estado: Membro[] = carregar(CHAVE.equipe, [...SEED]);
const ouvintes = new Set<() => void>();
const notificar = () => { salvar(CHAVE.equipe, estado); ouvintes.forEach((fn) => fn()); };

export function useEquipe(): Membro[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function getEquipe(): Membro[] { return estado; }

export function convidarMembro(dados: Omit<Membro, "id">): void {
  estado = [...estado, { ...dados, id: `eq${Date.now()}` }];
  notificar();
}

export function alterarPapel(id: string, papel: Papel): void {
  estado = estado.map((m) => (m.id === id ? { ...m, papel } : m));
  notificar();
}

export function alterarStatus(id: string, ativo: boolean): void {
  estado = estado.map((m) => (m.id === id ? { ...m, ativo } : m));
  notificar();
}
