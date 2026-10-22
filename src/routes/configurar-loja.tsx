import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Cross, IceCreamCone, Shirt, ShoppingCart, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configurar-loja")({
  head: () => ({
    meta: [
      { title: "Configurar loja — OmniSafe 360" },
      { name: "description", content: "Informe os dados da sua loja para começar a usar o OmniSafe 360." },
      { property: "og:title", content: "Configurar loja — OmniSafe 360" },
      { property: "og:description", content: "Informe os dados da sua loja para começar a usar o OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfigurarLoja,
});

const tipos = [
  { id: "supermercado", label: "Supermercado", icon: ShoppingCart },
  { id: "farmacia", label: "Farmácia", icon: Cross },
  { id: "sorveteria", label: "Sorveteria", icon: IceCreamCone },
  { id: "roupas", label: "Loja de roupas", icon: Shirt },
  { id: "outro", label: "Outro comércio", icon: Store },
];
const passos = ["Tipo de comércio", "Dados da loja", "Localização"];

function maskDoc(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function ConfigurarLoja() {
  const [step, setStep] = useState(0);
  const [tipo, setTipo] = useState("");
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const digits = doc.replace(/\D/g, "").length;
  const canNext = [!!tipo, nome.trim().length > 1 && (digits === 11 || digits === 14), cidade.trim().length > 1 && uf.length === 2][step];

  const next = () => {
    if (step < 2) return setStep(step + 1);
    toast.success(`Loja "${nome}" configurada! O painel chega na próxima etapa.`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <span className="text-sm text-muted-foreground">Passo {step + 1} de 3</span>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ol className="mb-10 flex items-center gap-2">
          {passos.map((p, i) => (
            <li key={p} className="flex flex-1 items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", i < step ? "bg-success text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("hidden text-sm font-medium sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>{p}</span>
              {i < 2 && <span className={cn("h-0.5 flex-1 rounded", i < step ? "bg-success" : "bg-border")} />}
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border bg-card p-8 shadow-elegant">
          {step === 0 && (
            <>
              <h2 className="text-2xl font-bold">Qual é o seu tipo de comércio?</h2>
              <p className="mt-1 text-muted-foreground">Vamos adaptar o sistema para o seu negócio.</p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tipos.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setTipo(id)} className={cn("flex flex-col items-center gap-3 rounded-xl border-2 p-5 font-semibold transition", tipo === id ? "border-primary bg-secondary text-primary" : "border-border hover:border-primary/40")}>
                    <Icon className="h-7 w-7" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold">Dados da loja</h2>
              <p className="mt-1 text-muted-foreground">Pode ser CNPJ ou CPF, se você for autônomo.</p>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da loja</Label>
                  <Input id="nome" className="h-11" placeholder="Ex.: Mercado Bom Preço" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc">CNPJ ou CPF</Label>
                  <Input id="doc" className="h-11" inputMode="numeric" placeholder="00.000.000/0000-00" value={doc} onChange={(e) => setDoc(maskDoc(e.target.value))} />
                  {digits > 0 && <p className="text-xs text-muted-foreground">{digits <= 11 ? "CPF" : "CNPJ"} {digits === 11 || digits === 14 ? "✓ completo" : "incompleto"}</p>}
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold">Onde fica sua loja?</h2>
              <p className="mt-1 text-muted-foreground">Último passo!</p>
              <div className="mt-6 grid grid-cols-[1fr_6rem] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" className="h-11" placeholder="Ex.: Campinas" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf">UF</Label>
                  <Input id="uf" className="h-11 uppercase" maxLength={2} placeholder="SP" value={uf} onChange={(e) => setUf(e.target.value.replace(/[^a-z]/gi, "").toUpperCase())} />
                </div>
              </div>
            </>
          )}

          <div className="mt-8 flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ArrowLeft /> Voltar
            </Button>
            <Button size="lg" disabled={!canNext} onClick={next}>
              {step < 2 ? "Continuar" : "Concluir e abrir painel"} <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
