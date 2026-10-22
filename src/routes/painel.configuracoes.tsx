import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/painel/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — OmniSafe 360" },
      { name: "description", content: "Dados da loja, regras de estoque, validade e avisos." },
      { property: "og:title", content: "Configurações — OmniSafe 360" },
      { property: "og:description", content: "Configurações da loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Configuracoes,
});

function Campo({ label, ...p }: { label: string } & React.ComponentProps<typeof Input>) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input {...p} /></div>;
}

function Bloco({ t, d, children }: { t: string; d: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-3">
      <div><h2 className="font-display font-semibold">{t}</h2><p className="text-sm text-muted-foreground">{d}</p></div>
      <div className="grid gap-4 md:col-span-2 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Aviso({ t, on = true }: { t: string; on?: boolean }) {
  return <label className="flex items-center justify-between rounded-lg border p-3 text-sm md:col-span-2">{t}<Switch defaultChecked={on} /></label>;
}

function Configuracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajuste como o sistema funciona na sua loja.</p>
      </div>
      <Bloco t="Dados da loja" d="Aparecem nos relatórios e nos aplicativos.">
        <Campo label="Nome da loja" defaultValue="Mercado Bom Preço" />
        <Campo label="CNPJ / CPF" defaultValue="12.345.678/0001-90" />
        <Campo label="Cidade" defaultValue="Campinas" />
        <Campo label="UF" defaultValue="SP" />
      </Bloco>
      <Bloco t="Estoque" d="Valores usados quando um produto novo é cadastrado.">
        <Campo label="Mínimo padrão na gôndola (un)" type="number" defaultValue={10} />
        <Campo label="Margem de lucro padrão (%)" type="number" defaultValue={45} />
        <Campo label="Tolerância na conferência (un)" type="number" defaultValue={0} />
        <Campo label="Locais do depósito" defaultValue="C1, C2, C3, C4, Câmara fria" />
      </Bloco>
      <Bloco t="Validades" d="Quando o sistema começa a avisar sobre um lote.">
        <Campo label="Primeiro aviso (dias antes)" type="number" defaultValue={30} />
        <Campo label="Aviso urgente (dias antes)" type="number" defaultValue={7} />
        <Aviso t="Sugerir promoção automática para lotes perto do vencimento" />
        <Aviso t="Bloquear venda de lote vencido no PDV" />
      </Bloco>
      <Bloco t="Avisos" d="O que chega para você e para a equipe.">
        <Aviso t="Avisar o repositor quando a gôndola atingir o mínimo" />
        <Aviso t="Me avisar de inconsistências na conferência" />
        <Aviso t="Resumo diário por e-mail" on={false} />
        <Aviso t="Avisos por WhatsApp" on={false} />
      </Bloco>
      <div className="flex justify-end"><Button onClick={() => toast.success("Configurações salvas")}>Salvar alterações</Button></div>
    </div>
  );
}
