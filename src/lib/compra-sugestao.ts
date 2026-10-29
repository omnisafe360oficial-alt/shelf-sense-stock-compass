import type { Produto } from "@/lib/mock-data";

/** Mínimo de depósito usado quando o produto não tem um definido. */
export const MINIMO_DEPOSITO_PADRAO = 10;

export type ItemSugerido = { produto: Produto; atual: number; minimo: number; qtd: number };
export type GrupoCompra = {
  chave: string;
  fornecedorId?: string;
  fornecedorNome: string; // "" = sem fornecedor
  itens: ItemSugerido[];
};

/**
 * Regra do pedido de compra automático: olha SÓ o depósito.
 * Entra na lista se o depósito chegou ao mínimo ou acabou (zerado),
 * e se o produto ainda não está num pedido aberto. Agrupa por fornecedor.
 */
export function sugerirCompras(
  produtos: Produto[],
  totaisDeposito: Record<string, number>,
  idsComPedidoAberto: Set<string>,
): GrupoCompra[] {
  const grupos = new Map<string, GrupoCompra>();
  for (const p of produtos) {
    if (idsComPedidoAberto.has(p.id)) continue;
    const atual = totaisDeposito[p.id] ?? 0;
    const minimo = p.minimoDeposito && p.minimoDeposito > 0 ? p.minimoDeposito : MINIMO_DEPOSITO_PADRAO;
    if (atual > minimo && atual > 0) continue;
    const alvo = p.maximoDeposito && p.maximoDeposito > minimo ? p.maximoDeposito : minimo * 2;
    const qtd = Math.max(1, alvo - atual);
    const nome = (p.fornecedor ?? "").trim();
    const chave = p.fornecedorId ? `id:${p.fornecedorId}` : nome ? `nome:${nome.toLowerCase()}` : "sem";
    let g = grupos.get(chave);
    if (!g) {
      g = { chave, fornecedorId: p.fornecedorId, fornecedorNome: nome, itens: [] };
      grupos.set(chave, g);
    }
    g.itens.push({ produto: p, atual, minimo, qtd });
  }
  // Fornecedores com nome primeiro; "sem fornecedor" por último.
  return [...grupos.values()].sort((a, b) =>
    a.chave === "sem" ? 1 : b.chave === "sem" ? -1 : a.fornecedorNome.localeCompare(b.fornecedorNome),
  );
}
