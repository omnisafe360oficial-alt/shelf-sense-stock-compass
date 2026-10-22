export type Produto = {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  fornecedor: string;
  preco: number;
  deposito: number;
  gondola: number;
  minimo: number;
  validade?: string;
};

export const fornecedores = [
  { id: "f1", nome: "Unilever Brasil", cnpj: "61.068.276/0001-04" },
  { id: "f2", nome: "Laticínios Serra Verde", cnpj: "12.345.678/0001-90" },
  { id: "f3", nome: "Distribuidora Camil", cnpj: "64.904.295/0001-03" },
  { id: "f4", nome: "Química Amparo (Ypê)", cnpj: "43.461.789/0001-90" },
];

export const categorias = ["Higiene", "Laticínios", "Mercearia", "Limpeza", "Padaria", "Bebidas", "Frios"];

export const produtos: Produto[] = [
  { id: "1", nome: "Sabonete Lux 85g", codigo: "7891150037410", categoria: "Higiene", fornecedor: "Unilever Brasil", preco: 2.79, deposito: 240, gondola: 10, minimo: 10, validade: "2027-08-10" },
  { id: "2", nome: "Leite Integral 1L", codigo: "7896051111110", categoria: "Laticínios", fornecedor: "Laticínios Serra Verde", preco: 5.49, deposito: 180, gondola: 6, minimo: 24, validade: "2026-11-20" },
  { id: "3", nome: "Arroz Tio João 5kg", codigo: "7893500020110", categoria: "Mercearia", fornecedor: "Distribuidora Camil", preco: 27.9, deposito: 60, gondola: 4, minimo: 8, validade: "2027-05-01" },
  { id: "4", nome: "Detergente Ypê 500ml", codigo: "7896098900208", categoria: "Limpeza", fornecedor: "Química Amparo (Ypê)", preco: 2.49, deposito: 300, gondola: 9, minimo: 12, validade: "2028-01-15" },
  { id: "5", nome: "Iogurte Natural 170g", codigo: "7891025101451", categoria: "Laticínios", fornecedor: "Laticínios Serra Verde", preco: 3.29, deposito: 36, gondola: 30, minimo: 12, validade: "2026-10-23" },
  { id: "6", nome: "Shampoo Seda 325ml", codigo: "7891037000325", categoria: "Higiene", fornecedor: "Unilever Brasil", preco: 14.9, deposito: 72, gondola: 22, minimo: 8, validade: "2028-03-02" },
  { id: "7", nome: "Feijão Carioca 1kg", codigo: "7896006711112", categoria: "Mercearia", fornecedor: "Distribuidora Camil", preco: 8.99, deposito: 0, gondola: 3, minimo: 15, validade: "2027-02-10" },
];

export function situacao(p: Produto): "ok" | "baixo" | "sem" {
  if (p.gondola + p.deposito === 0 || (p.deposito === 0 && p.gondola < p.minimo)) return "sem";
  if (p.gondola <= p.minimo) return "baixo";
  return "ok";
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
