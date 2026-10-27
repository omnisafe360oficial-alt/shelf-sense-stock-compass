import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, ScanLine, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onScan: (codigo: string) => void;
  onClose: () => void;
  titulo?: string;
};

export function BarcodeScanner({ onScan, onClose, titulo = "Escanear código" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [manual, setManual] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [modoManual, setModoManual] = useState(false);

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    async function iniciar() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          setErro("Nenhuma câmera encontrada");
          setModoManual(true);
          return;
        }
        const traseira = devices.find((d) =>
          /back|rear|environment/i.test(d.label),
        ) ?? devices[devices.length - 1];

        if (!videoRef.current || stopped) return;
        await reader.decodeFromVideoDevice(
          traseira.deviceId,
          videoRef.current,
          (result, err) => {
            if (stopped) return;
            if (result) {
              onScan(result.getText());
            }
            if (err && !(err instanceof Error && err.name === "NotFoundException")) {
              console.warn("[scanner]", err);
            }
          },
        );
      } catch (e) {
        if (!stopped) {
          const msg = e instanceof Error ? e.message : "Câmera não disponível";
          setErro(msg);
          setModoManual(true);
        }
      }
    }

    iniciar();

    return () => {
      stopped = true;
      try { readerRef.current?.reset(); } catch {}
    };
  }, [onScan]);

  function confirmarManual() {
    const codigo = manual.trim();
    if (codigo.length >= 6) onScan(codigo);
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <button onClick={onClose} className="text-muted-foreground">
          <X className="h-5 w-5" />
        </button>
        <p className="font-display text-sm font-semibold text-foreground">{titulo}</p>
        <button
          onClick={() => setModoManual((v) => !v)}
          className="text-muted-foreground"
          title="Alternar modo manual"
        >
          <Keyboard className="h-5 w-5" />
        </button>
      </div>

      {!modoManual ? (
        <div className="relative flex-1 bg-black overflow-hidden">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
          />
          {/* Viewfinder overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-48 w-64">
              <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-primary rounded-tl-xl" />
              <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-primary rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
              <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-primary/70 animate-pulse" />
            </div>
          </div>
          {erro && (
            <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/70 p-3 text-center text-xs text-white">
              {erro}
            </div>
          )}
        </div>
      ) : null}

      <div className={cn("px-4 space-y-4", modoManual ? "flex-1 pt-6" : "pt-4 pb-4")}>
        {modoManual && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <ScanLine className="h-4 w-4 text-primary" />
            <p className="text-xs text-foreground">Digite o código de barras manualmente</p>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {modoManual ? "Código de barras" : "Ou digite manualmente"}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmarManual(); }}
            placeholder="7891150037410"
            className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        {modoManual && (
          <button
            onClick={confirmarManual}
            disabled={manual.trim().length < 6}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Confirmar código
          </button>
        )}
      </div>
    </div>
  );
}
