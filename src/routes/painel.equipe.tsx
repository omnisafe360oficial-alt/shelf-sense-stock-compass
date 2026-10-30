import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, RefreshCw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEquipe, alterarPapel, alterarStatus, removerMembro, PAPEIS, type Papel } from "@/lib/equipe-store";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — OmniSafe 360" },
      { name: "description", content: "Pessoas da loja e o que cada uma pode fazer." },
      { property: "og:title", content: "Equipe — OmniSafe 360" },
      { property: "og:description", content: "Gestão da equipe da loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Equipe,
});

function Equipe() {
  const membros = useEquipe();
  const auth = useAuth();
  const [codigoConvite, setCodigoConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<string | null>(null);
  const podeGerenciar = auth.papel === "Proprietário" || auth.papel === "Gerente";

  useEffect(() => {
    if (!auth.lojaId) return;
    supabase
      .from("lojas")
      .select("codigo_convite")
      .eq("id", auth.lojaId)
      .single()
      .then(({ data, error }) => {
        if (error) { toast.error("Erro ao carregar código de convite."); return; }
        setCodigoConvite(data?.codigo_convite ?? null);
      });
  }, [auth.lojaId]);

  const renovarCodigo = async () => {
    if (!auth.lojaId) return;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const novoCodigo = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => chars[b % chars.length])
      .join("");
    setRenovando(true);
    const { error } = await supabase
      .from("lojas")
      .update({ codigo_convite: novoCodigo })
      .eq("id", auth.lojaId);
    setRenovando(false);
    if (error) { toast.error("Erro ao renovar código: " + error.message); return; }
    setCodigoConvite(novoCodigo);
    toast.success("Código renovado! O código anterior não funciona mais.");
  };

  const copiar = () => {
    if (!codigoConvite) return;
    navigator.clipboard.writeText(codigoConvite).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }).catch(() => {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Equipe</h1>
        <p className="text-sm text-muted-foreground">Quem trabalha na loja e o que cada um pode acessar.</p>
      </div>

      {/* Código de convite */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Convidar pessoa para a equipe</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compartilhe este código. A pessoa abre o app, escolhe "Entrar numa loja" e digita o código.
            </p>
            <div className="mt-3 flex items-center gap-2">
              {codigoConvite ? (
                <>
                  <span className="inline-block rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-2 font-mono text-xl font-bold tracking-[0.25em] text-primary select-all">
                    {codigoConvite}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copiar}
                    className="shrink-0 gap-1.5"
                  >
                    {copiado ? (
                      <><Check className="h-4 w-4 text-success" /> Copiado!</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copiar</>
                    )}
                  </Button>
                  {(auth.papel === "Proprietário" || auth.papel === "Gerente") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={renovarCodigo}
                      disabled={renovando}
                      className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                      title="Gera um novo código — o anterior para de funcionar"
                    >
                      <RefreshCw className={`h-4 w-4 ${renovando ? "animate-spin" : ""}`} />
                      Renovar
                    </Button>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Carregando…</span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Novos membros entram como <strong>Caixa</strong> — você pode mudar a função abaixo após o acesso.
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de membros */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-4">Pessoa</th>
              <th className="p-4">Função</th>
              <th className="p-4">Pode acessar</th>
              <th className="p-4">Situação</th>
              {podeGerenciar && <th className="p-4" />}
            </tr>
          </thead>
          <tbody>
            {membros.map((m, i) => (
              <tr key={m.id} className="border-t">
                <td className="p-4">
                  <p className="font-semibold">{m.nome}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </td>
                <td className="p-4">
                  <select
                    className="rounded-md border bg-background px-2 py-1"
                    value={m.papel}
                    disabled={i === 0}
                    onChange={(e) => alterarPapel(m.id, e.target.value as Papel)}
                  >
                    {(Object.keys(PAPEIS) as Papel[]).map((p) => <option key={p}>{p}</option>)}
                  </select>
                </td>
                <td className="p-4 text-muted-foreground">{PAPEIS[m.papel]}</td>
                <td className="p-4">
                  <button
                    disabled={i === 0}
                    onClick={() => alterarStatus(m.id, !m.ativo)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {m.ativo ? "Ativo" : "Bloqueado"}
                  </button>
                </td>
                {podeGerenciar && (
                  <td className="p-4">
                    {i !== 0 && (
                      confirmandoRemocao === m.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { removerMembro(m.id); setConfirmandoRemocao(null); }}
                            className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmandoRemocao(null)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmandoRemocao(m.id)}
                          title="Remover membro"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
