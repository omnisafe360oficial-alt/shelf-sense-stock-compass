export const CHAVE = {
  config: "omni:config",
  equipe: "omni:equipe",
  fornecedores: "omni:fornecedores",
  produtos: "omni:produtos",
  estoque: "omni:estoque",
  operacao: "omni:operacao",
} as const;

export function carregar<T>(chave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(chave);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function salvar<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // quota exceeded ou modo privado — ignora silenciosamente
  }
}
