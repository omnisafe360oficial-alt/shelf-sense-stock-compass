import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useId, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Clock, Mail, MapPin, MessageCircle, Phone, Save, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cadastrarFornecedor, avisarErroFornecedor } from "@/lib/fornecedores-store";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/fornecedores/novo")({
  head: () => ({
    meta: [
      { title: "Novo fornecedor — OmniSafe 360" },
      { name: "description", content: "Cadastre um novo fornecedor com contatos, localização e prazo de pagamento." },
      { property: "og:title", content: "Novo fornecedor — OmniSafe 360" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: NovoFornecedor,
});

const INICIAL = {
  nome: "", cnpj: "", contato: "", telefone: "", whatsapp: "", email: "", cidade: "", prazo: "",
};

function Secao({ icon: Icon, titulo, children }: { icon: React.ElementType; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2.5 border-b pb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-semibold">{titulo}</h2>
      </div>
      {children}
    </div>
  );
}

function Campo({ label, dica, children }: { label: string; dica?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })}
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

const PRAZOS_COMUNS = ["7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "45 dias", "60 dias"];

const soDigitos = (s: string) => s.replace(/\D/g, "");

function mascaraDoc(v: string) {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  if (resto.length <= corte) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
function capitalizar(v: string) {
  return v
    .split(" ")
    .map((p, i) => {
      if (!p) return p;
      const low = p.toLowerCase();
      if (i > 0 && MINUSCULAS.has(low)) return low;
      // mantém siglas digitadas em maiúsculas (ex.: LTDA, ME, SP)
      if (p.length > 1 && p === p.toUpperCase() && /[A-ZÀ-Ý]/.test(p)) return p;
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(" ");
}

function formatarCampo(k: string, v: string) {
  switch (k) {
    case "cnpj": return mascaraDoc(v);
    case "telefone":
    case "whatsapp": return mascaraTelefone(v);
    case "email": return v.trim().toLowerCase();
    case "nome":
    case "contato":
    case "cidade": return capitalizar(v);
    default: return v;
  }
}

function NovoFornecedor() {
  const navigate = useNavigate();
  const [f, setF] = useState(INICIAL);
  const set = (k: keyof typeof INICIAL) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = formatarCampo(k, e.target.value);
    setF((prev) => ({ ...prev, [k]: v }));
  };

  const podeSubmeter = f.nome.trim().length >= 2;

  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!podeSubmeter || salvando) { if (!podeSubmeter) toast.error("Nome é obrigatório."); return; }
    setSalvando(true);
    try {
    const id = await cadastrarFornecedor({
      nome: f.nome.trim(),
      cnpj: f.cnpj.trim(),
      contato: f.contato.trim(),
      telefone: f.telefone.trim(),
      whatsapp: f.whatsapp.trim(),
      email: f.email.trim(),
      cidade: f.cidade.trim(),
      prazo: f.prazo.trim(),
    });
    toast.success(`Fornecedor "${f.nome.trim()}" cadastrado!`);
    navigate({ to: "/painel/fornecedores/$id", params: { id } });
    } catch (e) {
      avisarErroFornecedor(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/painel/fornecedores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Fornecedores
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-brand p-8 text-primary-foreground">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Building2 className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{f.nome.trim() || "Novo fornecedor"}</h1>
          <p className="text-primary-foreground/75 text-sm">
            {f.cnpj || "CNPJ não informado"}
          </p>
        </div>
      </div>

      {/* Identificação */}
      <Secao icon={Building2} titulo="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo label="Nome / razão social">
              <Input
                autoFocus
                value={f.nome}
                onChange={set("nome")}
                placeholder="Ex.: Distribuidora ABC Ltda"
                className="h-11 text-base"
              />
            </Campo>
          </div>
          <Campo label="CNPJ / CPF" dica="Usado para emissão de notas e pedidos.">
            <Input
              value={f.cnpj}
              onChange={set("cnpj")}
              placeholder="00.000.000/0001-00"
            />
          </Campo>
        </div>
      </Secao>

      {/* Contato */}
      <Secao icon={User} titulo="Contato comercial">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo label="Nome do responsável / representante">
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={f.contato}
                  onChange={set("contato")}
                  placeholder="Ex.: João Silva"
                  className="pl-9"
                />
              </div>
            </Campo>
          </div>
          <Campo label="Telefone">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={f.telefone}
                onChange={set("telefone")}
                placeholder="(11) 99999-9999"
                className="pl-9"
              />
            </div>
          </Campo>
          <Campo label="WhatsApp" dica="Com DDI e DDD — ex: 5511999998888. Usado para enviar pedidos.">
            <div className="relative">
              <MessageCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={f.whatsapp}
                onChange={set("whatsapp")}
                placeholder="5511999998888"
                className="pl-9"
                inputMode="numeric"
              />
            </div>
          </Campo>
          <Campo label="E-mail">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={f.email}
                onChange={set("email")}
                placeholder="pedidos@empresa.com.br"
                className="pl-9"
              />
            </div>
          </Campo>
        </div>
      </Secao>

      {/* Localização */}
      <Secao icon={MapPin} titulo="Localização">
        <Campo label="Cidade · Estado" dica='Ex.: "São Paulo · SP" ou "Belo Horizonte · MG"'>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={f.cidade}
              onChange={set("cidade")}
              placeholder="São Paulo · SP"
              className="pl-9"
            />
          </div>
        </Campo>
      </Secao>

      {/* Comercial */}
      <Secao icon={Clock} titulo="Condições comerciais">
        <Campo label="Prazo de pagamento" dica="Quantos dias após a entrega o pagamento é feito.">
          <div className="space-y-2">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={f.prazo}
                onChange={set("prazo")}
                placeholder="Ex.: 28 dias, boleto 30 dias"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRAZOS_COMUNS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setF((prev) => ({ ...prev, prazo: p }))}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    f.prazo === p ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Campo>
      </Secao>

      {/* Ações */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-6 py-4">
        <Link to="/painel/fornecedores">
          <Button variant="ghost">Cancelar</Button>
        </Link>
        <Button size="lg" disabled={!podeSubmeter || salvando} onClick={salvar}>
          <Save className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar fornecedor"}
        </Button>
      </div>
    </div>
  );
}
