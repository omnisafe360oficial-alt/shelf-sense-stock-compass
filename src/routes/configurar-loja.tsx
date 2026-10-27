import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronsUpDown, Cross, Hammer, IceCreamCone, Loader2, MapPin, Shirt, ShoppingCart, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth, recarregarLoja } from "@/lib/auth";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  { id: "supermercado", label: "Supermercado",       icon: ShoppingCart, iconCls: "text-emerald-600", iconBg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { id: "farmacia",     label: "Farmácia",            icon: Cross,        iconCls: "text-red-500",     iconBg: "bg-red-50 dark:bg-red-950/30"       },
  { id: "sorveteria",   label: "Sorveteria",          icon: IceCreamCone, iconCls: "text-violet-500",  iconBg: "bg-violet-50 dark:bg-violet-950/30" },
  { id: "roupas",       label: "Loja de roupas",      icon: Shirt,        iconCls: "text-sky-500",     iconBg: "bg-sky-50 dark:bg-sky-950/30"       },
  { id: "construcao",   label: "Construção",          icon: Hammer,       iconCls: "text-orange-500",  iconBg: "bg-orange-50 dark:bg-orange-950/30" },
  { id: "outro",        label: "Outro comércio",      icon: Store,        iconCls: "text-slate-500",   iconBg: "bg-slate-100 dark:bg-slate-800/30"  },
];

const ESTADOS = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

const passos = ["Tipo de comércio", "Dados da loja", "Localização"];

function toTitleCase(s: string) {
  return s.replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

function maskDoc(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function ConfigurarLoja() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [step, setStep] = useState(0);
  const [tipo, setTipo] = useState("");
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [loading, setLoading] = useState(false);

  // Localização — estado
  const [cidades, setCidades] = useState<string[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [cidadeOpen, setCidadeOpen] = useState(false);

  const digits = doc.replace(/\D/g, "").length;
  const canNext = [!!tipo, nome.trim().length > 1 && (digits === 11 || digits === 14), cidade.trim().length > 1 && uf.length === 2][step];

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) navigate({ to: "/" });
    else if (auth.lojaId) navigate({ to: "/painel" });
  }, [auth.loading, auth.session, auth.lojaId, navigate]);

  // Carrega municípios via IBGE quando o UF muda
  useEffect(() => {
    if (!uf) { setCidades([]); setCidade(""); return; }
    setLoadingCidades(true);
    setCidade("");
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((data: { nome: string }[]) => setCidades(data.map((m) => m.nome)))
      .catch(() => toast.error("Erro ao carregar cidades. Tente novamente."))
      .finally(() => setLoadingCidades(false));
  }, [uf]);

  const next = async () => {
    if (step < 2) return setStep(step + 1);

    setLoading(true);
    const nomeProprietario =
      auth.session?.user.user_metadata?.nome ??
      auth.session?.user.user_metadata?.full_name ??
      auth.session?.user.email?.split("@")[0] ??
      "Proprietário";

    const { error } = await supabase.rpc("criar_loja", {
      p_nome_loja: nome.trim(),
      p_cnpj: doc.replace(/\D/g, ""),
      p_cidade: cidade.trim(),
      p_uf: uf,
      p_tipo_comercio: tipo,
      p_nome_proprietario: nomeProprietario.trim(),
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Atualiza auth.lojaId em memória antes de navegar para o painel,
    // evitando que o guard do painel redirecione de volta para /configurar-loja.
    await recarregarLoja();

    toast.success(`Loja "${nome}" configurada com sucesso!`);
    navigate({ to: "/painel" });
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
                {tipos.map(({ id, label, icon: Icon, iconCls, iconBg }) => {
                  const selected = tipo === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTipo(id)}
                      className={cn(
                        "group relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/50 hover:shadow-sm"
                      )}
                    >
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200",
                        selected ? "bg-primary/10" : iconBg
                      )}>
                        <Icon className={cn("h-6 w-6 transition-colors duration-200", selected ? "text-primary" : iconCls)} />
                      </div>
                      <span className={cn(
                        "text-sm font-semibold text-center leading-tight",
                        selected ? "text-primary" : "text-foreground"
                      )}>{label}</span>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>
                      )}
                    </button>
                  );
                })}
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
                  <Input id="nome" className="h-11" placeholder="Ex.: Mercado Bom Preço" value={nome} onChange={(e) => setNome(toTitleCase(e.target.value))} />
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
              <p className="mt-1 text-muted-foreground">Selecione o estado e a cidade — último passo!</p>

              <div className="mt-6 space-y-4">
                {/* Estado */}
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={uf} onValueChange={(v) => setUf(v)}>
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Selecione o estado…" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-64">
                        {ESTADOS.map((e) => (
                          // UF sigla fica fora do ItemText para o trigger mostrar só o nome
                          <SelectPrimitive.Item
                            key={e.uf}
                            value={e.uf}
                            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                          >
                            <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                              <SelectPrimitive.ItemIndicator>
                                <Check className="h-4 w-4" />
                              </SelectPrimitive.ItemIndicator>
                            </span>
                            <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">{e.uf}</span>
                            <SelectPrimitive.ItemText>{e.nome}</SelectPrimitive.ItemText>
                          </SelectPrimitive.Item>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cidade */}
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Popover open={cidadeOpen} onOpenChange={setCidadeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={cidadeOpen}
                        disabled={!uf || loadingCidades}
                        className={cn(
                          "h-11 w-full justify-between font-normal",
                          !cidade && "text-muted-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {loadingCidades ? (
                            <><Loader2 className="h-4 w-4 animate-spin shrink-0" /> Carregando cidades…</>
                          ) : cidade ? (
                            <><MapPin className="h-4 w-4 shrink-0 text-primary" />{cidade}</>
                          ) : !uf ? (
                            "Selecione o estado primeiro"
                          ) : (
                            "Selecione a cidade…"
                          )}
                        </span>
                        {!loadingCidades && <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cidade…" className="h-10" />
                        <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-60">
                            {cidades.map((c) => (
                              <CommandItem
                                key={c}
                                value={c}
                                onSelect={() => { setCidade(c); setCidadeOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4 shrink-0", cidade === c ? "opacity-100" : "opacity-0")} />
                                {c}
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Resumo selecionado */}
                {cidade && uf && (
                  <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
                    <MapPin className="h-4 w-4 shrink-0 text-success" />
                    <p className="text-sm font-medium text-success">
                      {cidade} — {ESTADOS.find((e) => e.uf === uf)?.nome} ({uf})
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="mt-8 flex justify-between">
            <Button variant="ghost" disabled={step === 0 || loading} onClick={() => setStep(step - 1)}>
              <ArrowLeft /> Voltar
            </Button>
            <Button size="lg" disabled={!canNext || loading} onClick={next}>
              {loading ? "Salvando…" : step < 2 ? "Continuar" : "Concluir e abrir painel"} {!loading && <ArrowRight />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
