import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getConfig, salvarConfig, type Config } from "@/lib/config-store";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

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
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Configuracoes,
});

type SetF = (k: keyof Config, v: string | number | boolean) => void;

function Campo({ label, field, type = "text", f, onSet }: { label: string; field: keyof Config; type?: string; f: Config; onSet: SetF }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={String(f[field])} onChange={(e) => onSet(field, type === "number" ? Number(e.target.value) : e.target.value)} />
    </div>
  );
}

function Aviso({ t, field, f, onSet }: { t: string; field: keyof Config; f: Config; onSet: SetF }) {
  return (
    <label className="flex items-center justify-between rounded-lg border p-3 text-sm md:col-span-2">
      {t}<Switch checked={f[field] as boolean} onCheckedChange={(v) => onSet(field, v)} />
    </label>
  );
}

function Bloco({ t, d, children }: { t: string; d: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-3">
      <div><h2 className="font-display font-semibold">{t}</h2><p className="text-sm text-muted-foreground">{d}</p></div>
      <div className="grid gap-4 md:col-span-2 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Configuracoes() {
  const [f, setF] = useState<Config>(getConfig);
  const onSet: SetF = (k, v) => setF((c) => ({ ...c, [k]: v }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajuste como o sistema funciona na sua loja.</p>
      </div>
      <Bloco t="Dados da loja" d="Aparecem nos relatórios e nos aplicativos.">
        <Campo label="Nome da loja" field="nomeLoja" f={f} onSet={onSet} />
        <Campo label="CNPJ / CPF" field="cnpj" f={f} onSet={onSet} />
        <Campo label="Cidade" field="cidade" f={f} onSet={onSet} />
        <Campo label="UF" field="uf" f={f} onSet={onSet} />
      </Bloco>
      <Bloco t="Estoque" d="Valores usados quando um produto novo é cadastrado.">
        <Campo label="Mínimo padrão na gôndola (un)" field="minimoPadrao" type="number" f={f} onSet={onSet} />
        <Campo label="Margem de lucro padrão (%)" field="margemPadrao" type="number" f={f} onSet={onSet} />
        <Campo label="Tolerância na conferência (un)" field="toleranciaConferencia" type="number" f={f} onSet={onSet} />
        <Campo label="Locais do depósito" field="locaisDeposito" f={f} onSet={onSet} />
      </Bloco>
      <Bloco t="Validades" d="Quando o sistema começa a avisar sobre um lote.">
        <Campo label="Primeiro aviso (dias antes)" field="avisoVencimento1" type="number" f={f} onSet={onSet} />
        <Campo label="Aviso urgente (dias antes)" field="avisoVencimentoUrgente" type="number" f={f} onSet={onSet} />
        <Aviso t="Sugerir promoção automática para lotes perto do vencimento" field="sugestaoPromocao" f={f} onSet={onSet} />
        <Aviso t="Bloquear venda de lote vencido no PDV" field="bloquearVencido" f={f} onSet={onSet} />
      </Bloco>
      <Bloco t="Avisos" d="O que chega para você e para a equipe.">
        <Aviso t="Avisar o repositor quando a gôndola atingir o mínimo" field="avisoRepositor" f={f} onSet={onSet} />
        <Aviso t="Me avisar de inconsistências na conferência" field="avisoInconsistencias" f={f} onSet={onSet} />
        <Aviso t="Resumo diário por e-mail (às 8h)" field="resumoDiario" f={f} onSet={onSet} />
        {f.resumoDiario && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>E-mail para o resumo diário</Label>
            <Input
              type="email"
              placeholder="exemplo@suaempresa.com.br"
              value={f.emailNotificacoes}
              onChange={(e) => onSet("emailNotificacoes", e.target.value)}
            />
          </div>
        )}
        <Aviso t="Avisos por WhatsApp" field="avisosWhatsApp" f={f} onSet={onSet} />
        {f.avisosWhatsApp && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>Número do WhatsApp (com DDI e DDD)</Label>
            <Input
              type="tel"
              placeholder="+55 11 99999-9999"
              value={f.telefoneWhatsApp}
              onChange={(e) => onSet("telefoneWhatsApp", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usado pela integração de notificações automáticas via WhatsApp Business.
            </p>
          </div>
        )}
      </Bloco>
      <Bloco t="Alertas" d="Controle quais alertas aparecem no sino de notificações.">
        <Aviso t="Alertar sobre produtos zerados no estoque" field="alertaEstoqueZerado" f={f} onSet={onSet} />
        <Aviso t="Alertar sobre produtos abaixo do mínimo (gôndola)" field="avisoRepositor" f={f} onSet={onSet} />
        <Aviso t="Alertar sobre lotes próximos ao vencimento" field="alertaVencimentos" f={f} onSet={onSet} />
        <Aviso t="Alertar sobre inconsistências abertas" field="avisoInconsistencias" f={f} onSet={onSet} />
        <Aviso t="Alertar sobre pedidos pendentes sem atualização" field="alertaPedidos" f={f} onSet={onSet} />
        <div className="space-y-1.5 md:col-span-2">
          <Label>Dias para alertar pedido pendente</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={30}
              className="w-24"
              value={f.diasAlertaPedido}
              onChange={(e) => onSet("diasAlertaPedido", Math.max(1, Number(e.target.value)))}
              disabled={!f.alertaPedidos}
            />
            <p className="text-sm text-muted-foreground">
              Alertar quando um pedido em rascunho ou enviado não for atualizado por esse número de dias.
            </p>
          </div>
        </div>
      </Bloco>
      <div className="flex justify-end">
        <Button onClick={() => { salvarConfig(f); toast.success("Configurações salvas"); }}>Salvar alterações</Button>
      </div>
    </div>
  );
}
